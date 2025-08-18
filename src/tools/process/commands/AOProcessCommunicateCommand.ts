import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { z } from "zod";

import type {
  AOProcessCommunicateArgs,
  EnhancedHandlerMatch,
  UnifiedProcessResponse,
} from "../../../types/unified-communication.js";

import { defaultProcessService } from "../../../services/DefaultProcessService.js";
import {
  DocumentationProtocolService,
  type ExtendedInfoResponse,
  type HandlerMetadata,
} from "../../../services/DocumentationProtocolService.js";
import { OperationDetectionService } from "../../../services/OperationDetectionService.js";
import { ProcessCacheService } from "../../../services/ProcessCacheService.js";
import {
  processCommunicationService,
  type ProcessDefinition,
} from "../../../services/ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "../../../services/TokenProcessTemplateService.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

export class AOProcessCommunicateCommand extends ToolCommand<
  AOProcessCommunicateArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Single intelligent tool for all AO process communication that automatically detects operation types and provides proper execution paths and result formatting. Consolidates functionality from executeAction and sendMessage tools with enhanced ADP-based handler discovery and intelligent mode detection.`,
    name: "aoProcessCommunicate",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Unified AO Process Communication",
  };

  protected parametersSchema = z.object({
    formatting: z
      .enum(["compact", "detailed", "json"])
      .optional()
      .describe("Response formatting preference (default: detailed)"),
    mode: z
      .enum(["auto", "read", "write", "validate"])
      .optional()
      .describe(
        "Operation mode: auto (detect automatically), read (query only), write (transaction), validate (dry-run)",
      ),
    parameters: z
      .record(z.unknown())
      .optional()
      .describe("Optional explicit parameters for structured requests"),
    processId: CommonSchemas.processId.describe(
      "The AO process ID to communicate with",
    ),
    processMarkdown: z
      .string()
      .optional()
      .describe(
        "Optional markdown documentation describing the process handlers and parameters",
      ),
    processType: z
      .string()
      .optional()
      .describe(
        "Optional process type hint (e.g., 'token') to use embedded templates",
      ),
    request: z
      .string()
      .describe(
        "Natural language description OR structured action for the AO process",
      ),
    requireConfirmation: z
      .boolean()
      .optional()
      .describe("Force user confirmation before execution"),
    timeout: z
      .number()
      .optional()
      .describe("Custom timeout in milliseconds (default: 30000)"),
    validateOnly: z
      .boolean()
      .optional()
      .describe("Perform validation only without executing (dry-run mode)"),
  });

  private lastDetectionResult?: import("../../../types/unified-communication.js").OperationDetectionResult;

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: AOProcessCommunicateArgs): Promise<string> {
    const startTime = Date.now();
    let processInfo: Record<string, unknown> = {};

    try {
      // Validate required parameters
      if (!args.processId || args.processId.trim() === "") {
        throw new Error("Process ID is required and cannot be empty");
      }

      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Step 1: Handle validation-only mode early to avoid unnecessary processing
      if (args.validateOnly) {
        return await this.performValidation(args, {}, args.mode || "validate");
      }

      // Step 2: Get or discover process information with ADP support
      processInfo = await this.getProcessInfo(args, keyPair);

      // Step 3: Detect operation mode if auto
      const detectedMode = await this.detectOperationMode(args, processInfo);

      // Step 4: Handle validation mode based on detection
      if (detectedMode === "validate") {
        return await this.performValidation(args, processInfo, detectedMode);
      }

      // Step 5: Execute unified request
      const result = await this.executeUnifiedRequest(
        args,
        processInfo,
        detectedMode,
        keyPair,
        startTime,
      );

      const spacing = args.formatting === "compact" ? 0 : 2;
      return JSON.stringify(result, null, spacing);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorDetails = this.generateEnhancedErrorDetails(
        error,
        args,
        processInfo,
      );

      const errorResponse: UnifiedProcessResponse = {
        executionTime,
        handlerUsed: "none",
        operation: "unknown",
        parameters: args.parameters || {},
        processingMode: args.mode || "auto",
        result: {
          details: errorDetails,
          rawResponse: null,
          summary: "Communication failed",
        },
        success: false,
      };

      const spacing = args.formatting === "compact" ? 0 : 2;
      return JSON.stringify(errorResponse, null, spacing);
    }
  }

  private analyzeRequestForOperationType(
    request: string,
  ): "read" | "unknown" | "validate" | "write" {
    const requestLower = request.toLowerCase();

    const writeKeywords = [
      "send",
      "transfer",
      "create",
      "update",
      "delete",
      "set",
      "add",
      "remove",
      "mint",
      "burn",
      "stake",
      "withdraw",
      "deposit",
      "register",
      "vote",
    ];

    const readKeywords = [
      "get",
      "fetch",
      "read",
      "check",
      "balance",
      "info",
      "status",
      "list",
      "query",
      "view",
      "show",
      "find",
    ];

    for (const keyword of writeKeywords) {
      if (requestLower.includes(keyword)) {
        return "write";
      }
    }

    for (const keyword of readKeywords) {
      if (requestLower.includes(keyword)) {
        return "read";
      }
    }

    return "read"; // Default to read for safety
  }

  private calculateADPMatchScore(
    request: string,
    handler: HandlerMetadata,
  ): number {
    let score = 0;

    // Check if action name is in request
    if (request.includes(handler.action.toLowerCase())) {
      score += 0.6;
    }

    // Check description keywords
    if (handler.description) {
      const descriptionWords = handler.description.toLowerCase().split(/\s+/);
      const requestWords = request.split(/\s+/);

      for (const word of requestWords) {
        if (descriptionWords.includes(word) && word.length > 2) {
          score += 0.1;
        }
      }
    }

    // Check examples
    if (handler.examples) {
      for (const example of handler.examples) {
        const exampleWords = example.toLowerCase().split(/\s+/);
        const requestWords = request.split(/\s+/);

        const commonWords = exampleWords.filter(
          (word) => requestWords.includes(word) && word.length > 2,
        );
        score += commonWords.length * 0.05;
      }
    }

    // Check parameter names
    if (handler.parameters) {
      for (const param of handler.parameters) {
        if (request.includes(param.name.toLowerCase())) {
          score += 0.2;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  private convertTemplateToMarkdown(template: ProcessDefinition): string {
    let markdown = `# ${template.name}\n\n`;

    for (const handler of template.handlers) {
      markdown += `## ${handler.action}\n\n`;
      markdown += `${handler.description}\n\n`;

      if (handler.parameters && handler.parameters.length > 0) {
        for (const param of handler.parameters) {
          const required = param.required ? "required" : "optional";
          markdown += `- ${param.name}: ${param.description} (${required})\n`;
        }
        markdown += "\n";
      }

      if (handler.examples && handler.examples.length > 0) {
        markdown += "Examples:\n";
        for (const example of handler.examples) {
          markdown += `- ${example}\n`;
        }
        markdown += "\n";
      }
    }

    return markdown;
  }

  private async detectOperationMode(
    args: AOProcessCommunicateArgs,
    processInfo: {
      adpInfo?: ExtendedInfoResponse;
      handlers?: HandlerMetadata[];
    },
  ): Promise<"read" | "unknown" | "validate" | "write"> {
    if (args.mode && args.mode !== "auto") {
      return args.mode;
    }

    // Use enhanced multi-layer operation detection
    const detectionResult = OperationDetectionService.detectOperationType(
      args.request,
      processInfo.handlers,
      args.mode,
    );

    // Store detection result for enhanced error reporting
    this.lastDetectionResult = detectionResult;

    return detectionResult.operationType === "unknown"
      ? "read"
      : detectionResult.operationType;
  }

  private determineOperationTypeFromHandler(
    handler: HandlerMetadata,
  ): "read" | "unknown" | "write" {
    // Use ADP isWrite field if available - primary detection method
    if (handler.isWrite !== undefined) {
      return handler.isWrite ? "write" : "read";
    }

    // Fallback to action name analysis
    const writeActions = [
      "transfer",
      "send",
      "mint",
      "burn",
      "create",
      "update",
      "delete",
      "set",
      "add",
      "remove",
      "stake",
      "withdraw",
      "deposit",
      "register",
      "vote",
    ];

    const readActions = [
      "balance",
      "balances",
      "info",
      "get",
      "fetch",
      "read",
      "check",
      "status",
      "list",
      "query",
      "view",
      "show",
      "find",
    ];

    const actionLower = handler.action.toLowerCase();

    if (writeActions.some((action) => actionLower.includes(action))) {
      return "write";
    }

    if (readActions.some((action) => actionLower.includes(action))) {
      return "read";
    }

    return "unknown";
  }

  private async executeUnifiedRequest(
    args: AOProcessCommunicateArgs,
    processInfo: Record<string, unknown>,
    detectedMode: "read" | "unknown" | "validate" | "write",
    keyPair: JWKInterface,
    startTime: number,
  ): Promise<UnifiedProcessResponse> {
    let result;

    // Use the existing ProcessCommunicationService for execution
    if (
      processInfo.processMarkdown &&
      typeof processInfo.processMarkdown === "string"
    ) {
      result = await processCommunicationService.executeProcessRequest(
        processInfo.processMarkdown,
        args.processId,
        args.request,
        keyPair,
      );
    } else {
      result = await processCommunicationService.executeSmartRequest(
        args.processId,
        args.request,
        keyPair,
        typeof processInfo.processMarkdown === "string"
          ? processInfo.processMarkdown
          : undefined,
        this.context.embeddedTemplates,
      );
    }

    const executionTime = Date.now() - startTime;

    // Transform to unified response format
    const unifiedResponse: UnifiedProcessResponse = {
      executionTime,
      handlerUsed: result.handlerUsed || "unknown",
      operation: detectedMode,
      parameters: (result.parameters || args.parameters || {}) as Record<
        string,
        unknown
      >,
      processingMode: args.mode || "auto",
      result: {
        details: (result.data || {}) as Record<string, unknown>,
        rawResponse: result,
        summary: result.success
          ? "Operation completed successfully"
          : result.error || "Operation failed",
      },
      success: result.success,
    };

    // Add transaction info for write operations
    if (detectedMode === "write" && result.success) {
      unifiedResponse.transaction = {
        hash: "pending", // This would come from the actual AO response
        status: "pending",
      };
    }

    return unifiedResponse;
  }

  private extractADPParameters(
    request: string,
    handler: HandlerMetadata,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const requestLower = request.toLowerCase();

    if (handler.parameters) {
      for (const param of handler.parameters) {
        const value = this.extractParameterValue(
          requestLower,
          param.name.toLowerCase(),
          param.type,
        );
        if (value !== null) {
          parameters[param.name] = value;
        }
      }
    }

    return parameters;
  }

  private extractParameterValue(
    request: string,
    paramName: string,
    paramType: string,
  ): unknown {
    // Parameter-specific patterns
    const specificPatterns = [
      new RegExp(`${paramName}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
      new RegExp(`${paramName}\\s+([^\\s]+)`, "i"),
    ];

    for (const pattern of specificPatterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        const value = match[1];
        if (paramType === "number" || paramType === "string") {
          const num = parseFloat(value);
          return isNaN(num) ? value : paramType === "number" ? num : value;
        }
        return value;
      }
    }

    // Type-specific fallback patterns
    if (paramType === "number" || paramType === "string") {
      const numberPatterns = [
        /send\s+([0-9.]+)/i,
        /transfer\s+([0-9.]+)/i,
        /amount\s*[=:]?\s*([0-9.]+)/i,
        /([0-9.]+)\s+tokens?/i,
        /([0-9.]+)\s+to/i,
        /([0-9.]+)/,
      ];

      for (const pattern of numberPatterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          const value = match[1];
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return paramType === "number" ? num : value;
          }
        }
      }
    }

    if (paramType === "string" || paramType === "address") {
      const lowerParamName = paramName.toLowerCase();
      if (lowerParamName === "target" || lowerParamName === "recipient") {
        const addressPatterns = [
          /to\s+([^\s]+)/i,
          /recipient\s+([^\s]+)/i,
          /for\s+([^\s]+)/i,
          /send\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i,
          /transfer\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i,
          /balance\s+for\s+([^\s]+)/i,
          /check\s+balance\s+for\s+([^\s]+)/i,
        ];

        for (const pattern of addressPatterns) {
          const match = request.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }

    return null;
  }

  private generateEnhancedErrorDetails(
    error: unknown,
    args: AOProcessCommunicateArgs,
    processInfo: Record<string, unknown>,
  ): Record<string, unknown> {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const details: Record<string, unknown> = { error: errorMessage };

    // Add contextual information
    details.requestAnalysis = {
      hasExplicitParameters:
        !!args.parameters && Object.keys(args.parameters).length > 0,
      hasProcessMarkdown: !!args.processMarkdown,
      hasProcessType: !!args.processType,
      mode: args.mode || "auto",
      requestLength: args.request.length,
    };

    // Process-specific suggestions
    if (errorMessage.toLowerCase().includes("insufficient balance")) {
      details.suggestions = [
        "Check your token balance before attempting transfers",
        "Ensure you have enough tokens including any fees",
        "Consider using the Balance action to check current funds",
      ];
      details.nextActions = [
        "Use: 'get my balance' to check current balance",
        "Use: 'get process info' to understand token details",
      ];
    } else if (errorMessage.toLowerCase().includes("invalid parameters")) {
      details.suggestions = [
        "Check parameter names and formats",
        "Ensure required parameters are provided",
        "Verify parameter types match expected values",
      ];

      // Add parameter suggestions if we have handler metadata
      if (processInfo?.handlers) {
        const handlers = processInfo.handlers as HandlerMetadata[];
        const suggestions = this.generateParameterSuggestions(
          args.request,
          handlers,
        );
        if (suggestions.length > 0) {
          details.parameterSuggestions = suggestions;
        }
      }
    } else if (errorMessage.toLowerCase().includes("handler not found")) {
      details.suggestions = [
        "Check available handlers using process info",
        "Verify the action name is correct",
        "Ensure process documentation is up to date",
      ];

      if (processInfo?.handlers) {
        const handlers = processInfo.handlers as HandlerMetadata[];
        details.availableHandlers = handlers.map((h) => ({
          action: h.action,
          description: h.description,
          isWrite: h.isWrite,
        }));
      }
    } else if (errorMessage.toLowerCase().includes("timeout")) {
      details.suggestions = [
        "Try increasing the timeout parameter",
        "Check network connectivity",
        "Verify the process is responsive with a Ping action",
      ];
      details.nextActions = [
        "Use: 'ping' to test process connectivity",
        "Increase timeout: add 'timeout: 60000' parameter",
      ];
    } else {
      // General error suggestions
      details.suggestions = [
        "Check process ID is correct and process exists",
        "Ensure request format matches expected patterns",
        "Try using explicit processMarkdown for better accuracy",
      ];
    }

    // Add conversion examples for common use cases
    if (args.mode === "auto" && !args.processMarkdown) {
      details.improvementTips = [
        "Provide processMarkdown for more accurate handler matching",
        "Use explicit mode ('read' or 'write') for better performance",
        "Consider using processType hint if available",
      ];
      details.exampleImprovement = {
        current: `{ processId: "${args.processId}", request: "${args.request}" }`,
        improved: `{ processId: "${args.processId}", request: "${args.request}", mode: "read", processType: "token" }`,
      };
    }

    return details;
  }

  private generateParameterSuggestions(
    request: string,
    handlers: HandlerMetadata[],
  ): string[] {
    const suggestions: string[] = [];
    const requestLower = request.toLowerCase();

    // Find likely handler based on request
    const matchingHandlers = handlers.filter((handler) =>
      requestLower.includes(handler.action.toLowerCase()),
    );

    for (const handler of matchingHandlers) {
      if (handler.parameters) {
        const missingRequired = handler.parameters
          .filter((param) => param.required)
          .filter((param) => !requestLower.includes(param.name.toLowerCase()));

        for (const param of missingRequired) {
          suggestions.push(
            `Missing required parameter '${param.name}': ${param.description}`,
          );

          if (param.examples && param.examples.length > 0) {
            suggestions.push(`Example ${param.name}: ${param.examples[0]}`);
          }
        }
      }
    }

    return suggestions;
  }

  private async getProcessInfo(
    args: AOProcessCommunicateArgs,
    keyPair: JWKInterface,
  ): Promise<{
    adpInfo?: ExtendedInfoResponse;
    handlers?: HandlerMetadata[];
    processMarkdown?: string;
  }> {
    let processMarkdown: string | undefined = args.processMarkdown;
    let adpInfo: ExtendedInfoResponse | undefined;

    // If processMarkdown not provided, try to get from cache or discover process capabilities
    if (!processMarkdown) {
      try {
        // First, try to get cached process info with automatic discovery
        const cachedInfo = await ProcessCacheService.getProcessInfo(
          args.processId,
          keyPair,
        );

        if (cachedInfo && cachedInfo.success) {
          // Try to parse as ADP format
          if (cachedInfo.processMarkdown) {
            try {
              // Only attempt JSON parsing if it looks like JSON
              if (cachedInfo.processMarkdown.trim().startsWith("{")) {
                const parsedAdp =
                  DocumentationProtocolService.parseInfoResponse(
                    cachedInfo.processMarkdown,
                  );
                if (parsedAdp) {
                  adpInfo = parsedAdp;
                } else {
                  processMarkdown = cachedInfo.processMarkdown;
                }
              } else {
                processMarkdown = cachedInfo.processMarkdown;
              }
            } catch {
              processMarkdown = cachedInfo.processMarkdown;
            }
          }
        } else if (args.processType) {
          // Fallback to template-based approach
          if (TokenProcessTemplateService.isSupported(args.processType)) {
            processMarkdown =
              TokenProcessTemplateService.getTokenTemplateAsMarkdown(
                args.processId,
              );
          } else {
            const template = defaultProcessService.getDefaultProcess(
              args.processType,
              args.processId,
            );
            if (template) {
              processMarkdown = this.convertTemplateToMarkdown(template);
            }
          }
        }
      } catch (error) {
        // Gracefully handle cache errors by continuing without process info
        // This allows validation mode and other operations to still work
      }
    }

    return {
      adpInfo,
      handlers: adpInfo?.handlers,
      processMarkdown,
    };
  }

  private async matchRequestToADPHandler(
    request: string,
    handlers: HandlerMetadata[],
  ): Promise<EnhancedHandlerMatch | null> {
    const requestLower = request.toLowerCase();
    let bestMatch: EnhancedHandlerMatch | null = null;
    let highestScore = 0;

    for (const handler of handlers) {
      const score = this.calculateADPMatchScore(requestLower, handler);
      if (score > highestScore && score > 0.3) {
        const parameters = this.extractADPParameters(request, handler);
        const operationType = this.determineOperationTypeFromHandler(handler);

        bestMatch = {
          confidence: score,
          handler,
          operationType,
          parameters,
          source: "adp",
        };
        highestScore = score;
      }
    }

    return bestMatch;
  }

  private async performValidation(
    args: AOProcessCommunicateArgs,
    processInfo: Record<string, unknown>,
    mode: string,
  ): Promise<string> {
    const validationResult: UnifiedProcessResponse = {
      executionTime: 0,
      handlerUsed: "validation",
      operation: "validate",
      parameters: args.parameters || {},
      processingMode: mode,
      result: {
        details: {
          mode,
          parametersProvided: Object.keys(args.parameters || {}),
          processInfoAvailable:
            !!processInfo.processMarkdown || !!processInfo.adpInfo,
          validationStatus: "completed",
        },
        rawResponse: null,
        summary: "Validation completed successfully",
      },
      success: true,
    };

    const spacing = args.formatting === "compact" ? 0 : 2;
    return JSON.stringify(validationResult, null, spacing);
  }
}
