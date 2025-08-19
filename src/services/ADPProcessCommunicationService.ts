import { JWKInterface } from "arweave/node/lib/wallet.js";

import { Tag } from "../models/Tag.js";
import { read, send } from "../process.js";
import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
  HandlerMetadata,
  HandlerParameter,
} from "./DocumentationProtocolService.js";

/**
 * ADP Process Communication Service
 *
 * Provides clean, standardized communication with AO processes that implement
 * the AO Documentation Protocol (ADP). This service focuses on ADP-specific
 * operations and delegates to DocumentationProtocolService for metadata handling.
 */

export interface ADPCache {
  [processId: string]: {
    response: ExtendedInfoResponse;
    timestamp: number;
  };
}

export interface ADPCommunicationResult {
  approach: "ADP";
  availableHandlers?: string[];
  confidence?: number;
  data?: unknown;
  debugContext?: Record<string, any>;
  error?: string;
  // Enhanced error context for debugging (only in development mode)
  errorContext?: ErrorContext;
  extractionStep?: string;
  fallbackMethod?: "dataField" | "directFormat" | "processSpecific";
  // New fallback-specific fields
  fallbackUsed?: boolean;
  handlerUsed?: string;
  methodUsed?: "read" | "send";
  originalExtractionFailed?: boolean;
  parameterFormat?: "direct" | "json" | "natural";
  parametersUsed?: Record<string, unknown>;
  success: boolean;
  suggestedAlternatives?: string[];
  suggestedFixes?: string[];
  validationErrors?: string[];
}

export type ErrorCategory =
  | "configuration"
  | "discovery"
  | "execution"
  | "extraction"
  | "matching"
  | "network"
  | "validation";

export interface ErrorContext {
  availableHandlers?: string[];
  category: ErrorCategory;
  executionTimeMs?: number;
  extractedParameters?: Record<string, any>;
  processId: string;
  retryAttempted?: boolean;
  sessionId: string;
  step: string;
  suggestedFixes?: string[];
  timestamp: string;
  userRequest: string;
  validationErrors?: string[];
}

export interface ValidationResult {
  errors: string[];
  suggestedFixes?: string[];
  valid: boolean;
  warnings?: string[];
}

interface ProcessFormatCache {
  strategy: "data" | "hybrid" | "tags";
  timestamp: number;
}

export class ADPProcessCommunicationService {
  private static readonly ADP_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private static adpCache: ADPCache = {};
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly PROCESS_FORMAT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static processFormatCache = new Map<string, ProcessFormatCache>();
  private static readonly RETRY_DELAY_MS = 100;
  private static verboseLogging = process.env.ADP_VERBOSE_LOGGING === "true";

  /**
   * Clear ADP cache for a specific process or all processes
   */
  static clearCache(processId?: string): void {
    if (processId) {
      delete this.adpCache[processId];
    } else {
      Object.keys(this.adpCache).forEach((key) => delete this.adpCache[key]);
    }
  }

  /**
   * Detect parameter format type in user request
   * Enhanced to detect complex structures
   */
  static detectParameterFormat(request: string): "direct" | "json" | "natural" {
    // Check for JSON pattern first (more specific)
    if (/^\s*\{.*\}\s*$/.test(request) || /\{.*".*".*:.*\}/.test(request)) {
      return "json";
    }

    // Check for complex JSON structures
    if (this.hasComplexJsonStructures(request)) {
      return "json";
    }

    // Check for direct format patterns
    const directResult = this.parseDirectParameterFormat(request);
    if (directResult && !/^\s*\{.*\}\s*$/.test(request)) {
      return "direct";
    }

    return "natural";
  }

  /**
   * Try to discover if a process supports ADP by making a read call to Info handler
   */
  static async discoverADPSupport(
    processId: string,
    signer: JWKInterface,
  ): Promise<ExtendedInfoResponse | null> {
    try {
      // Check cache first
      const cached = this.adpCache[processId];
      if (cached && Date.now() - cached.timestamp < this.ADP_CACHE_TTL) {
        return cached.response;
      }

      // Use the read method from process.ts for ADP discovery
      const response = await read(processId, [
        { name: "Action", value: "Info" },
      ]);

      if (response && response.Data) {
        // Try to parse as ADP response
        const adpResponse = DocumentationProtocolService.parseInfoResponse(
          response.Data,
        );

        if (adpResponse) {
          // Cache the ADP response
          this.adpCache[processId] = {
            response: adpResponse,
            timestamp: Date.now(),
          };
          return adpResponse;
        }
      }
    } catch (error) {
      console.warn(
        `ADP discovery failed for process ${processId} with signer:`,
        error,
      );
    }

    return null;
  }

  /**
   * Execute a natural language request against an ADP-compliant process
   */
  static async executeRequest(
    processId: string,
    userRequest: string,
    signer: JWKInterface,
    adpResponse?: ExtendedInfoResponse,
  ): Promise<ADPCommunicationResult> {
    const startTime = Date.now();
    const sessionId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Log initial request
      this.debugLog(`[${sessionId}] Starting parameter translation pipeline`, {
        hasPreloadedMetadata: !!adpResponse,
        processId,
        timestamp: new Date().toISOString(),
        userRequest,
      });

      // Ensure we have ADP metadata
      const metadata =
        adpResponse || (await this.discoverADPSupport(processId, signer));

      // If we just performed discovery, add delay before execution
      if (!adpResponse) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!metadata) {
        const error = "Process does not support ADP or discovery failed";
        const errorContext = this.createErrorContext(
          "discovery",
          "ADP discovery failed",
          sessionId,
          processId,
          userRequest,
          startTime,
        );

        this.debugLog(`[${sessionId}] ADP discovery failed`, {
          error,
          errorContext,
        });
        return {
          approach: "ADP",
          error,
          errorContext: this.shouldIncludeDebugContext()
            ? errorContext
            : undefined,
          success: false,
        };
      }

      // Log ADP discovery results
      this.debugLog(`[${sessionId}] ADP discovery successful`, {
        availableHandlers: metadata.handlers?.map((h) => h.action) || [],
        handlerCount: metadata.handlers?.length || 0,
        hasDescription: !!(metadata as any).description,
        protocolVersion: metadata.protocolVersion,
      });

      // Find matching handler using natural language matching
      const matchedHandler = this.findBestHandlerMatch(
        userRequest,
        metadata.handlers || [],
      );

      if (!matchedHandler) {
        const error = "Could not match request to any available ADP handler";
        const availableHandlers = metadata.handlers?.map((h) => h.action) || [];
        const errorContext = this.createErrorContext(
          "matching",
          "Handler matching failed",
          sessionId,
          processId,
          userRequest,
          startTime,
          {
            availableHandlers,
            suggestedFixes: [
              `Available handlers: ${availableHandlers.join(", ") || "none"}`,
              "Try rephrasing your request to match one of the available handlers",
              "Use action-specific keywords like 'add', 'transfer', 'balance', etc.",
            ],
          },
        );

        this.debugLog(`[${sessionId}] Handler matching failed`, {
          availableHandlers,
          error,
          errorContext,
          userRequest,
        });
        return {
          approach: "ADP",
          availableHandlers,
          error,
          errorContext: this.shouldIncludeDebugContext()
            ? errorContext
            : undefined,
          success: false,
        };
      }

      // Log handler matching results
      this.debugLog(`[${sessionId}] Handler matching successful`, {
        confidence: matchedHandler.confidence,
        handlerParameters:
          matchedHandler.handler.parameters?.map((p) => ({
            name: p.name,
            required: p.required,
            type: p.type,
          })) || [],
        matchingReason: `Confidence score: ${matchedHandler.confidence.toFixed(2)}`,
        selectedHandler: matchedHandler.handler.action,
      });

      // Extract parameters from user request
      const parameters = this.extractParametersFromRequest(
        userRequest,
        matchedHandler.handler,
      );

      // Log parameter extraction results
      const extractionErrors = parameters._extractionErrors || [];
      delete parameters._extractionErrors; // Remove internal metadata

      this.debugLog(`[${sessionId}] Parameter extraction completed`, {
        expectedParameters: matchedHandler.handler.parameters?.length || 0,
        extractedParameters: parameters,
        extractionErrors,
        extractionSuccess: extractionErrors.length === 0,
        parameterCount: Object.keys(parameters).length,
      });

      // Enhanced parameter validation middleware
      const middlewareValidation = await this.validateExtractedParameters(
        sessionId,
        matchedHandler.handler,
        parameters,
      );

      if (!middlewareValidation.valid) {
        // Before failing, try fallback mechanisms
        this.debugLog(
          `[${sessionId}] Primary validation failed, attempting fallback mechanisms`,
          {
            parameterFormat: this.detectParameterFormat(userRequest),
            validationErrors: middlewareValidation.errors,
          },
        );

        const fallbackResult = await this.attemptFallbackExtraction(
          sessionId,
          userRequest,
          matchedHandler.handler,
          processId,
          signer,
          startTime,
          metadata,
        );

        if (fallbackResult.success) {
          return fallbackResult;
        }

        // If fallback also failed, return original error with suggestions
        const error = `Parameter validation failed: ${middlewareValidation.errors.join(", ")}`;
        const errorContext = this.createErrorContext(
          "validation",
          "Parameter validation failed (middleware)",
          sessionId,
          processId,
          userRequest,
          startTime,
          {
            extractedParameters: parameters,
            fallbackAttempted: true,
            suggestedAlternatives: this.generateAlternativeFormats(
              matchedHandler.handler,
              userRequest,
            ),
            suggestedFixes: middlewareValidation.suggestedFixes || [],
            validationErrors: middlewareValidation.errors,
          },
        );

        this.debugLog(
          `[${sessionId}] Middleware validation failed after fallback attempts`,
          {
            error,
            errorContext,
            expectedParameters: matchedHandler.handler.parameters,
            extractedParameters: parameters,
            fallbackAttempted: true,
            suggestedFixes: middlewareValidation.suggestedFixes,
            validationErrors: middlewareValidation.errors,
          },
        );

        return {
          approach: "ADP",
          error,
          errorContext: this.shouldIncludeDebugContext()
            ? errorContext
            : undefined,
          fallbackUsed: false,
          originalExtractionFailed: true,
          success: false,
          suggestedAlternatives: this.generateAlternativeFormats(
            matchedHandler.handler,
            userRequest,
          ),
          suggestedFixes: middlewareValidation.suggestedFixes,
          validationErrors: middlewareValidation.errors,
        };
      }

      // Fallback to legacy validation for compatibility with existing tests
      const legacyValidation = DocumentationProtocolService.validateParameters(
        matchedHandler.handler,
        parameters,
      );

      if (!legacyValidation.valid) {
        const error = `Parameter validation failed: ${legacyValidation.errors.join(", ")}`;
        const errorContext = this.createErrorContext(
          "validation",
          "Parameter validation failed (legacy)",
          sessionId,
          processId,
          userRequest,
          startTime,
          {
            extractedParameters: parameters,
            validationErrors: legacyValidation.errors,
          },
        );

        this.debugLog(`[${sessionId}] Legacy validation failed`, {
          error,
          errorContext,
          expectedParameters: matchedHandler.handler.parameters,
          extractedParameters: parameters,
          validationErrors: legacyValidation.errors,
        });
        return {
          approach: "ADP",
          error,
          errorContext: this.shouldIncludeDebugContext()
            ? errorContext
            : undefined,
          success: false,
        };
      }

      // Log successful parameter validation
      this.debugLog(`[${sessionId}] Parameter validation successful`, {
        parameterCount: Object.keys(parameters).length,
        validatedParameters: parameters,
        validationWarnings: middlewareValidation.warnings,
      });

      // Generate message tags using ADP
      const tags = DocumentationProtocolService.generateMessageTags(
        matchedHandler.handler,
        parameters,
      );

      // Log message tag generation
      this.debugLog(`[${sessionId}] Message tags generated`, {
        handlerAction: matchedHandler.handler.action,
        tagCount: tags.length,
        tags: tags.map((t) => ({ name: t.name, value: t.value })),
      });

      // Add delay to avoid rate limiting issues with rapid successive calls
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Determine if this is a write operation or read operation
      const isWriteOperation = this.isWriteHandler(matchedHandler.handler);
      const methodUsed = isWriteOperation ? "send" : "read";

      // Log execution method selection
      this.debugLog(`[${sessionId}] Executing ${methodUsed} operation`, {
        handlerAction: matchedHandler.handler.action,
        isWriteOperation,
        method: methodUsed,
      });

      // Execute the message using appropriate method from process.ts
      let response;
      if (isWriteOperation) {
        // Use send() for write operations (state-changing)
        response = await send(signer, processId, tags, null);
      } else {
        // Use read() for read-only operations
        response = await read(processId, tags);
      }

      // Log execution completion
      const executionTime = Date.now() - startTime;
      this.debugLog(`[${sessionId}] Execution completed`, {
        executionTimeMs: executionTime,
        hasData: !!(response?.Data || response),
        responseType: typeof response,
        success: !!response,
      });

      // Parse response data if it's JSON
      let parsedData = response?.Data || response;
      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      const result = {
        approach: "ADP" as const,
        confidence: matchedHandler.confidence,
        data: parsedData,
        handlerUsed: matchedHandler.handler.action,
        methodUsed: methodUsed as "read" | "send",
        parametersUsed: parameters,
        success: !!response,
      };

      // Log final result
      this.debugLog(`[${sessionId}] Pipeline completed successfully`, {
        result: {
          confidence: result.confidence,
          handlerUsed: result.handlerUsed,
          methodUsed: result.methodUsed,
          parametersUsed: result.parametersUsed,
          success: result.success,
        },
        totalExecutionTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? `ADP execution failed: ${error.message}`
          : "ADP execution failed";

      const errorContext = this.createErrorContext(
        error instanceof TypeError ? "configuration" : "execution",
        "Unexpected error during execution",
        sessionId || `err_${Date.now()}`,
        processId,
        userRequest,
        startTime,
        {
          suggestedFixes: [
            "Check if the process ID is correct",
            "Verify network connectivity",
            "Ensure the process supports ADP",
            "Try again with a simpler request",
          ],
        },
      );

      this.debugLog(`[${sessionId}] Pipeline failed with error`, {
        error: errorMessage,
        errorContext,
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        totalExecutionTimeMs: Date.now() - startTime,
      });

      return {
        approach: "ADP",
        error: errorMessage,
        errorContext: this.shouldIncludeDebugContext()
          ? errorContext
          : undefined,
        success: false,
      };
    }
  }

  /**
   * Generate data field parameters for fallback mechanism
   * Enhanced to support complex nested structures
   */
  static generateDataFieldParameters(parameters: Record<string, any>): string {
    // Remove internal metadata fields
    const cleanParameters = { ...parameters };
    delete cleanParameters._extractionErrors;

    try {
      // For complex structures, use enhanced serialization
      if (this.hasComplexStructures(cleanParameters)) {
        return this.serializeComplexParameters(cleanParameters);
      }

      return JSON.stringify(cleanParameters);
    } catch (error) {
      throw new Error(`Failed to generate data field parameters: ${error}`);
    }
  }

  /**
   * Generate interactive format suggestion system with context-aware recommendations
   */
  static generateInteractiveGuidance(
    handler: HandlerMetadata,
    userRequest: string,
    extractionErrors: string[],
    validationErrors: string[],
  ): {
    alternatives: string[];
    examples: string[];
    primarySuggestion: string;
    troubleshooting: string[];
  } {
    const alternatives = this.generateAlternativeFormats(handler, userRequest);

    // Determine primary suggestion based on error types
    let primarySuggestion =
      alternatives[0] || "Try using direct parameter format";

    if (extractionErrors.some((e) => e.includes("could not be extracted"))) {
      primarySuggestion =
        alternatives.find((a) => a.includes("Direct format")) ||
        primarySuggestion;
    }

    if (validationErrors.some((e) => e.includes("type"))) {
      primarySuggestion = "Check parameter types and use correct format";
    }

    // Generate troubleshooting steps
    const troubleshooting: string[] = [];

    if (extractionErrors.length > 0) {
      troubleshooting.push(
        "Parameter extraction failed - try being more explicit",
      );
      troubleshooting.push("Use parameter names directly (A=5, B=3)");
    }

    if (validationErrors.length > 0) {
      troubleshooting.push(
        "Parameter validation failed - check types and values",
      );
      if (handler.parameters?.some((p) => p.type === "number")) {
        troubleshooting.push("Ensure numeric parameters are valid numbers");
      }
      if (handler.parameters?.some((p) => p.type === "address")) {
        troubleshooting.push(
          "Ensure address parameters are alphanumeric strings",
        );
      }
    }

    // Generate working examples
    const examples = this.generateWorkingExamples(handler, userRequest);

    return {
      alternatives: alternatives.slice(1),
      examples,
      primarySuggestion,
      troubleshooting,
    };
  }

  /**
   * Debugging utility: Generate diagnostic report for parameter extraction issues
   */
  static generateParameterDiagnosticReport(
    userRequest: string,
    handler: HandlerMetadata,
    extractionResult: any,
    validationResult: ValidationResult,
  ): {
    diagnostics: Array<{
      category: string;
      message: string;
      suggestion: string;
    }>;
    quickFixes: string[];
    severity: "error" | "info" | "warning";
    summary: string;
  } {
    const diagnostics: Array<{
      category: string;
      message: string;
      suggestion: string;
    }> = [];
    const quickFixes: string[] = [];

    // Analyze request structure
    const requestWords = userRequest.trim().split(/\s+/);
    const requestLength = requestWords.length;
    const hasNumbers = /\d/.test(userRequest);
    const hasSpecialChars = /[^\w\s]/.test(userRequest);

    if (requestLength < 3) {
      diagnostics.push({
        category: "Request Structure",
        message: "Request is very short and may lack necessary context",
        suggestion:
          "Try adding more descriptive words about the desired action",
      });
      quickFixes.push("Add more context to your request");
    }

    if (!hasNumbers && handler.parameters?.some((p) => p.type === "number")) {
      diagnostics.push({
        category: "Parameter Content",
        message: "Request lacks numbers but handler expects numeric parameters",
        suggestion: "Include specific numbers in your request",
      });
      quickFixes.push("Add numeric values to your request");
    }

    // Analyze extraction results
    if (extractionResult.extractionErrors.length > 0) {
      diagnostics.push({
        category: "Parameter Extraction",
        message: `Failed to extract ${extractionResult.extractionErrors.length} parameters`,
        suggestion: "Use more explicit parameter naming or values",
      });
    }

    // Analyze validation results
    if (!validationResult.valid) {
      diagnostics.push({
        category: "Parameter Validation",
        message: `Validation failed with ${validationResult.errors.length} errors`,
        suggestion: "Check parameter types and required fields",
      });

      if (validationResult.suggestedFixes) {
        quickFixes.push(...validationResult.suggestedFixes);
      }
    }

    // Analyze handler compatibility
    const requiredParams = handler.parameters?.filter((p) => p.required) || [];
    const extractedParams = Object.keys(extractionResult.parameters);
    const missingRequired = requiredParams.filter(
      (p) => !extractedParams.includes(p.name),
    );

    if (missingRequired.length > 0) {
      diagnostics.push({
        category: "Required Parameters",
        message: `Missing ${missingRequired.length} required parameters: ${missingRequired.map((p) => p.name).join(", ")}`,
        suggestion: "Ensure your request includes all required parameters",
      });
    }

    // Determine severity
    let severity: "error" | "info" | "warning" = "info";
    if (validationResult.errors.length > 0) {
      severity = "error";
    } else if (extractionResult.extractionErrors.length > 0) {
      severity = "warning";
    }

    // Generate summary
    const summary =
      severity === "error"
        ? "Parameter extraction failed with validation errors"
        : severity === "warning"
          ? "Parameter extraction completed with warnings"
          : "Parameter extraction completed successfully";

    return {
      diagnostics,
      quickFixes: [...new Set(quickFixes)], // Remove duplicates
      severity,
      summary,
    };
  }

  /**
   * Get ADP cache statistics
   */
  static getCacheStats(): { entries: string[]; size: number } {
    return {
      entries: Object.keys(this.adpCache),
      size: Object.keys(this.adpCache).length,
    };
  }

  /**
   * Get optimal fallback strategy for a specific process and handler
   * Uses ADP metadata to optimize parameter format for specific processes
   */
  static getFallbackStrategy(
    processId: string,
    handler: HandlerMetadata,
    adpMetadata?: ExtendedInfoResponse,
  ): "data" | "hybrid" | "tags" {
    // Process-specific optimization based on known patterns
    const processOptimizations = this.getProcessSpecificOptimizations(
      processId,
      adpMetadata,
    );
    if (processOptimizations) {
      return processOptimizations;
    }

    // Handler-based optimization
    if (handler.parameters && handler.parameters.length > 3) {
      return "data"; // Use data field for complex parameter structures
    }

    // Mathematical operations work well with tags
    const mathActions = ["add", "subtract", "multiply", "divide", "calculate"];
    if (mathActions.includes(handler.action.toLowerCase())) {
      return "tags"; // Mathematical operations prefer tag-based parameters
    }

    // Token operations might prefer data field for complex transactions
    const tokenActions = ["transfer", "mint", "burn", "approve"];
    if (
      tokenActions.includes(handler.action.toLowerCase()) &&
      handler.parameters &&
      handler.parameters.length > 2
    ) {
      return "data"; // Complex token operations use data field
    }

    // Check for complex types (Note: current AO ecosystem mainly uses basic types)
    if (
      handler.parameters &&
      handler.parameters.some(
        (p) =>
          p.type &&
          !["address", "boolean", "number", "string"].includes(p.type),
      )
    ) {
      return "data"; // Use data field for complex types
    }

    return "hybrid"; // Use both tags and data field as default
  }

  /**
   * Debugging utility: Inspect parameter translation for a given request
   * Provides detailed breakdown of each extraction step without executing
   */
  static async inspectParameterTranslation(
    userRequest: string,
    handler: HandlerMetadata,
  ): Promise<{
    bestStrategy: string;
    finalParameters: Record<string, any>;
    handler: string;
    request: string;
    strategies: Array<{
      errors: string[];
      name: string;
      parameters: Record<string, any>;
      success: boolean;
    }>;
    troubleshootingTips: string[];
    validationResult: ValidationResult;
  }> {
    const sessionId = `inspect_${Date.now()}`;
    const strategies = ["primary", "fallback", "coercion", "fuzzy"];
    const results: any[] = [];

    // Test each strategy
    for (const strategy of strategies) {
      const result = await this.extractParametersWithStrategy(
        userRequest,
        handler,
        strategy,
      );

      const success = this.isExtractionSuccessful(
        handler,
        result.parameters,
        result.extractionErrors,
      );

      results.push({
        errors: result.extractionErrors,
        name: strategy,
        parameters: result.parameters,
        success,
      });
    }

    // Find best strategy
    const bestResult = results.find((r) => r.success) || results[0];
    const finalParameters = bestResult.parameters;

    // Run validation
    const validationResult = await this.validateExtractedParameters(
      sessionId,
      handler,
      finalParameters,
    );

    // Generate troubleshooting tips
    const troubleshootingTips = this.generateTroubleshootingTips(
      userRequest,
      handler,
      results,
      validationResult,
    );

    return {
      bestStrategy: bestResult.name,
      finalParameters,
      handler: handler.action,
      request: userRequest,
      strategies: results,
      troubleshootingTips,
      validationResult,
    };
  }

  /**
   * Parse complex parameter structures including nested objects and arrays
   */
  static parseComplexParameterStructures(
    request: string,
  ): null | Record<string, any> {
    // Try to parse array-like structures first: "items=[1,2,3]" or "tags=["a","b"]"
    const arrayMatches = request.match(/([a-zA-Z_]\w*)\s*=\s*(\[[^\]]*\])/g);
    if (arrayMatches) {
      const result: Record<string, any> = {};
      for (const arrayMatch of arrayMatches) {
        const [, paramName, arrayValue] =
          arrayMatch.match(/([a-zA-Z_]\w*)\s*=\s*(\[[^\]]*\])/) || [];
        if (paramName && arrayValue) {
          try {
            result[paramName] = JSON.parse(arrayValue);
          } catch {
            // If JSON parsing fails, split by comma
            const cleanArray = arrayValue.slice(1, -1); // Remove brackets
            result[paramName] = cleanArray
              .split(",")
              .map((item) => this.parseDirectValue(item.trim()));
          }
        }
      }
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // Try to parse object-like structures: "user={name:"john",age:30}"
    const objectMatches = request.match(/([a-zA-Z_]\w*)\s*=\s*(\{[^}]*\})/g);
    if (objectMatches) {
      const result: Record<string, any> = {};
      for (const objectMatch of objectMatches) {
        const match = objectMatch.match(/([a-zA-Z_]\w*)\s*=\s*(\{.*\})/);
        if (match) {
          const [, paramName, objectValue] = match;
          if (paramName && objectValue) {
            try {
              result[paramName] = JSON.parse(objectValue);
            } catch {
              // Try to parse as simple key:value pairs
              result[paramName] = this.parseSimpleObject(objectValue);
            }
          }
        }
      }
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // Try to find and parse complete JSON objects (including nested) as last resort
    try {
      // Pattern for nested JSON objects with balanced braces
      const nestedJsonPattern = this.extractBalancedJson(request);
      if (nestedJsonPattern) {
        const parsed = JSON.parse(nestedJsonPattern);
        if (typeof parsed === "object" && parsed !== null) {
          return this.validateComplexStructure(parsed);
        }
      }
    } catch (error) {
      // JSON parsing failed
    }

    return null;
  }

  /**
   * Parse direct parameter format (e.g., "A=5 B=3" or "A:5,B:3")
   * Enhanced to support complex nested structures
   */
  static parseDirectParameterFormat(
    request: string,
  ): null | Record<string, any> {
    // First, try to parse complex JSON structures
    const complexResult = this.parseComplexParameterStructures(request);
    if (complexResult) {
      return complexResult;
    }

    return this.parseSimpleDirectFormat(request);
  }

  /**
   * Enable or disable verbose logging for debugging
   */
  static setVerboseLogging(enabled: boolean): void {
    this.verboseLogging = enabled;
  }

  /**
   * Debugging utility: Test parameter extraction against a known process schema
   * Validates that extraction works correctly for expected input patterns
   */
  static async validateExtractionAgainstSchema(
    processId: string,
    testCases: Array<{
      description: string;
      expectedParameters: Record<string, any>;
      input: string;
    }>,
    signer: any,
  ): Promise<{
    adpMetadata: any;
    overallSuccess: boolean;
    processId: string;
    testResults: Array<{
      actual: Record<string, any>;
      description: string;
      errors: string[];
      expected: Record<string, any>;
      input: string;
      passed: boolean;
    }>;
  }> {
    // Get ADP metadata
    const adpMetadata = await this.discoverADPSupport(processId, signer);
    if (!adpMetadata) {
      throw new Error(`Process ${processId} does not support ADP`);
    }

    const testResults = [];

    for (const testCase of testCases) {
      // Find best matching handler for this test case
      const matchedHandler = this.findBestHandlerMatch(
        testCase.input,
        adpMetadata.handlers || [],
      );

      if (!matchedHandler) {
        testResults.push({
          actual: {},
          description: testCase.description,
          errors: ["No matching handler found"],
          expected: testCase.expectedParameters,
          input: testCase.input,
          passed: false,
        });
        continue;
      }

      // Extract parameters
      const extractionResult = await this.extractParametersWithRetry(
        `test_${Date.now()}`,
        testCase.input,
        matchedHandler.handler,
      );

      // Compare with expected
      const passed = this.compareParameters(
        testCase.expectedParameters,
        extractionResult.parameters,
      );

      testResults.push({
        actual: extractionResult.parameters,
        description: testCase.description,
        errors: extractionResult.extractionErrors,
        expected: testCase.expectedParameters,
        input: testCase.input,
        passed,
      });
    }

    const overallSuccess = testResults.every((result) => result.passed);

    return {
      adpMetadata,
      overallSuccess,
      processId,
      testResults,
    };
  }

  /**
   * Analyze ADP metadata to determine optimal parameter format
   */
  private static analyzeADPForOptimization(
    adpMetadata: ExtendedInfoResponse,
  ): "data" | "hybrid" | "tags" | null {
    const handlers = adpMetadata.handlers || [];

    // If most handlers have few parameters, prefer tags
    const avgParamCount =
      handlers.reduce((sum, h) => sum + (h.parameters?.length || 0), 0) /
      handlers.length;

    if (avgParamCount <= 2) {
      return "tags";
    }

    // If handlers have complex parameter structures, prefer data field
    const hasComplexParams = handlers.some((h) =>
      h.parameters?.some(
        (p) =>
          p.type &&
          !["address", "boolean", "number", "string"].includes(p.type),
      ),
    );

    if (hasComplexParams) {
      return "data";
    }

    // If many handlers, hybrid approach might be best
    if (handlers.length > 5) {
      return "hybrid";
    }

    return null; // No clear optimization
  }

  /**
   * Apply fallback patterns when primary extraction fails
   */
  private static applyFallbackPatterns(
    request: string,
    param: { name: string; type: string },
  ): any {
    const paramName = param.name.toLowerCase();

    // Mathematical fallback patterns for when specific patterns fail
    if (param.type === "number" && (paramName === "a" || paramName === "b")) {
      const numberMatches = request.match(/[0-9.-]+/g);
      if (numberMatches && numberMatches.length >= 2) {
        // For A parameter, try first number; for B parameter, try second number
        const index = paramName === "a" ? 0 : 1;
        if (numberMatches[index]) {
          const num = parseFloat(numberMatches[index]);
          if (!isNaN(num)) {
            return num;
          }
        }
      }
    }

    // Generic number extraction fallback
    if (param.type === "number") {
      const numberMatch = request.match(/[0-9.-]+/);
      if (numberMatch) {
        const num = parseFloat(numberMatch[0]);
        if (!isNaN(num)) {
          return num;
        }
      }
    }

    // Generic string extraction fallback
    if (param.type === "string" || param.type === "address") {
      // Look for quoted strings
      const quotedMatch = request.match(/["']([^"']+)["']/);
      if (quotedMatch) {
        return quotedMatch[1];
      }

      // Look for word-like patterns
      const wordMatch = request.match(/\b([a-zA-Z0-9_-]+)\b/);
      if (wordMatch && wordMatch[1].length > 2) {
        return wordMatch[1];
      }
    }

    return null;
  }

  /**
   * Attempt fallback extraction mechanisms when primary extraction fails
   */
  private static async attemptFallbackExtraction(
    sessionId: string,
    userRequest: string,
    handler: HandlerMetadata,
    processId: string,
    signer: JWKInterface,
    startTime: number,
    adpMetadata?: ExtendedInfoResponse,
  ): Promise<ADPCommunicationResult> {
    this.debugLog(`[${sessionId}] Starting fallback extraction attempts`);

    const parameterFormat = this.detectParameterFormat(userRequest);

    // Try direct parameter format first
    if (parameterFormat === "direct") {
      const directResult = await this.tryDirectParameterFallback(
        sessionId,
        userRequest,
        handler,
        processId,
        signer,
        startTime,
      );

      if (directResult.success) {
        return directResult;
      }
    }

    // Try data field fallback
    const dataFieldResult = await this.tryDataFieldFallback(
      sessionId,
      userRequest,
      handler,
      processId,
      signer,
      startTime,
      adpMetadata,
    );

    if (dataFieldResult.success) {
      return dataFieldResult;
    }

    // All fallback attempts failed
    return {
      approach: "ADP",
      error: "All fallback extraction attempts failed",
      fallbackUsed: false,
      originalExtractionFailed: true,
      success: false,
      suggestedAlternatives: this.generateAlternativeFormats(
        handler,
        userRequest,
      ),
    };
  }

  /**
   * Enhanced parameter type coercion with validation
   */
  private static coerceParameterType(
    value: any,
    targetType: string,
  ): { error?: string; success: boolean; value: any } {
    try {
      switch (targetType) {
        case "address":
          if (typeof value === "string" && value.trim().length > 0) {
            return { success: true, value: value.trim() };
          }
          return {
            error: `Cannot coerce '${value}' to address`,
            success: false,
            value,
          };

        case "boolean":
          if (typeof value === "string") {
            const lower = value.toLowerCase();
            if (["1", "on", "true", "yes"].includes(lower)) {
              return { success: true, value: true };
            }
            if (["0", "false", "no", "off"].includes(lower)) {
              return { success: true, value: false };
            }
          } else if (typeof value === "boolean") {
            return { success: true, value };
          }
          return {
            error: `Cannot coerce '${value}' to boolean`,
            success: false,
            value,
          };

        case "number":
          if (typeof value === "string") {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              return { success: true, value: num };
            }
          } else if (typeof value === "number") {
            return { success: true, value };
          }
          return {
            error: `Cannot coerce '${value}' to number`,
            success: false,
            value,
          };

        case "string":
          if (value === null || value === undefined) {
            return {
              error: "Cannot coerce null/undefined to string",
              success: false,
              value,
            };
          }
          return { success: true, value: String(value) };

        default:
          return { success: true, value };
      }
    } catch (error) {
      return { error: `Type coercion failed: ${error}`, success: false, value };
    }
  }

  /**
   * Compare two parameter objects for equality (used in testing)
   */
  private static compareParameters(
    expected: Record<string, any>,
    actual: Record<string, any>,
  ): boolean {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    // Check if all expected keys are present
    for (const key of expectedKeys) {
      if (!(key in actual)) {
        return false;
      }

      // Type-aware comparison
      if (
        typeof expected[key] === "number" &&
        typeof actual[key] === "number"
      ) {
        if (Math.abs(expected[key] - actual[key]) > 0.001) {
          return false;
        }
      } else if (expected[key] !== actual[key]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert parameter value to correct type
   */
  private static convertParameterValue(value: string, type: string): any {
    switch (type) {
      case "boolean":
        return value.toLowerCase() === "true";
      case "number": {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      default:
        return value;
    }
  }

  /**
   * Create standardized error context for debugging
   */
  private static createErrorContext(
    category: ErrorCategory,
    step: string,
    sessionId: string,
    processId: string,
    userRequest: string,
    startTime: number,
    additionalContext?: Record<string, any>,
  ): ErrorContext {
    return {
      category,
      executionTimeMs: Date.now() - startTime,
      processId,
      sessionId,
      step,
      timestamp: new Date().toISOString(),
      userRequest,
      ...additionalContext,
    };
  }

  /**
   * Debug logger for parameter extraction (only in development)
   * Enhanced logging with structured output and optional verbose mode
   */
  private static debugLog(message: string, data?: any): void {
    if (process.env.NODE_ENV === "development" || this.verboseLogging) {
      if (data && typeof data === "object") {
        console.log(`[ADPParameterExtraction] ${message}:`);
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`[ADPParameterExtraction] ${message}`, data || "");
      }
    }
  }

  /**
   * Extract balanced JSON from string (handles nested braces)
   */
  private static extractBalancedJson(text: string): null | string {
    const openBrace = text.indexOf("{");
    if (openBrace === -1) return null;

    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = openBrace; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            return text.substring(openBrace, i + 1);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract parameters from user request based on handler metadata
   */
  private static extractParametersFromRequest(
    userRequest: string,
    handler: HandlerMetadata,
  ): Record<string, any> {
    const parameters: Record<string, any> = {};
    const requestLower = userRequest.toLowerCase();
    const extractionErrors: string[] = [];

    if (!handler.parameters) {
      // If handler doesn't define parameters but has examples, try to infer parameters from examples
      const inferredParams = this.inferParametersFromExamples(handler);
      if (inferredParams.length > 0) {
        // Use inferred parameters for extraction
        for (const param of inferredParams) {
          let value = this.extractParameterValue(requestLower, param);

          // If primary extraction failed, try fallback patterns
          if (value === null) {
            value = this.applyFallbackPatterns(requestLower, param);
          }

          // Validate the extracted value
          if (value !== null) {
            const validation = this.validateParameterValue(value, param);
            if (validation.isValid) {
              parameters[param.name] = value;
            } else {
              extractionErrors.push(
                validation.error || `Invalid value for ${param.name}`,
              );
            }
          } else if (param.required) {
            extractionErrors.push(
              `Required parameter '${param.name}' could not be extracted from request`,
            );
          }
        }

        // Add extraction errors as metadata for debugging
        if (extractionErrors.length > 0) {
          parameters._extractionErrors = extractionErrors;
        }
      }
      return parameters;
    }

    for (const param of handler.parameters) {
      let value = this.extractParameterValue(requestLower, param);

      // If primary extraction failed, try fallback patterns
      if (value === null) {
        value = this.applyFallbackPatterns(requestLower, param);
      }

      // Validate the extracted value
      if (value !== null) {
        const validation = this.validateParameterValue(value, param);
        if (validation.isValid) {
          parameters[param.name] = value;
        } else {
          extractionErrors.push(
            validation.error || `Invalid value for ${param.name}`,
          );
        }
      } else if (param.required) {
        extractionErrors.push(
          `Required parameter '${param.name}' could not be extracted from request`,
        );
      }
    }

    // Add extraction errors as metadata for debugging
    if (extractionErrors.length > 0) {
      parameters._extractionErrors = extractionErrors;
    }

    return parameters;
  }

  /**
   * Fallback extraction strategy with more aggressive patterns
   */
  private static extractParametersFromRequestFallback(
    userRequest: string,
    handler: HandlerMetadata,
  ): { extractionErrors: string[]; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {};
    const extractionErrors: string[] = [];

    if (!handler.parameters) {
      return { extractionErrors, parameters };
    }

    // Try to extract any numbers for numeric parameters
    const numbers = userRequest.match(/([0-9.-]+)/g) || [];
    const words = userRequest.match(/\b([a-zA-Z0-9_-]+)\b/g) || [];

    let numberIndex = 0;
    let wordIndex = 0;

    for (const param of handler.parameters) {
      let value = null;

      if (param.type === "number" && numberIndex < numbers.length) {
        const num = parseFloat(numbers[numberIndex]);
        if (!isNaN(num)) {
          value = num;
          numberIndex++;
        }
      } else if (param.type === "string" || param.type === "address") {
        if (wordIndex < words.length) {
          value = words[wordIndex];
          wordIndex++;
        }
      }

      if (value !== null) {
        const validation = this.validateParameterValue(value, param);
        if (validation.isValid) {
          parameters[param.name] = value;
        } else {
          extractionErrors.push(
            validation.error || `Invalid value for ${param.name}`,
          );
        }
      } else if (param.required) {
        extractionErrors.push(
          `Required parameter '${param.name}' could not be extracted using fallback strategy`,
        );
      }
    }

    return { extractionErrors, parameters };
  }

  /**
   * Fuzzy extraction strategy using loose matching
   */
  private static extractParametersFromRequestFuzzy(
    userRequest: string,
    handler: HandlerMetadata,
  ): { extractionErrors: string[]; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {};
    const extractionErrors: string[] = [];

    if (!handler.parameters) {
      return { extractionErrors, parameters };
    }

    // Try fuzzy matching based on parameter names and types
    for (const param of handler.parameters) {
      let value = null;

      // Fuzzy name matching
      const paramNameVariants = [
        param.name.toLowerCase(),
        param.name.charAt(0).toLowerCase(), // First letter
        param.name.replace(/[A-Z]/g, "").toLowerCase(), // Remove capitals
      ];

      for (const variant of paramNameVariants) {
        if (userRequest.toLowerCase().includes(variant)) {
          const regex = new RegExp(
            `${variant}\\D*([0-9.-]+|[a-zA-Z0-9_-]+)`,
            "i",
          );
          const match = userRequest.match(regex);
          if (match && match[1]) {
            const coercionResult = this.coerceParameterType(
              match[1],
              param.type,
            );
            if (coercionResult.success) {
              value = coercionResult.value;
              break;
            }
          }
        }
      }

      if (value !== null) {
        const validation = this.validateParameterValue(value, param);
        if (validation.isValid) {
          parameters[param.name] = value;
        } else {
          extractionErrors.push(
            validation.error || `Invalid fuzzy-matched value for ${param.name}`,
          );
        }
      } else if (param.required) {
        extractionErrors.push(
          `Required parameter '${param.name}' could not be fuzzy-matched from request`,
        );
      }
    }

    return { extractionErrors, parameters };
  }

  /**
   * Primary extraction strategy (existing logic)
   */
  private static extractParametersFromRequestPrimary(
    userRequest: string,
    handler: HandlerMetadata,
  ): { extractionErrors: string[]; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {};
    const requestLower = userRequest.toLowerCase();
    const extractionErrors: string[] = [];

    if (!handler.parameters) {
      return { extractionErrors, parameters };
    }

    for (const param of handler.parameters) {
      let value = this.extractParameterValue(requestLower, param);

      // If primary extraction failed, try fallback patterns
      if (value === null) {
        value = this.applyFallbackPatterns(requestLower, param);
      }

      // Validate the extracted value
      if (value !== null) {
        const validation = this.validateParameterValue(value, param);
        if (validation.isValid) {
          parameters[param.name] = value;
        } else {
          extractionErrors.push(
            validation.error || `Invalid value for ${param.name}`,
          );
        }
      } else if (param.required) {
        extractionErrors.push(
          `Required parameter '${param.name}' could not be extracted from request`,
        );
      }
    }

    return { extractionErrors, parameters };
  }

  /**
   * Coercion-based extraction strategy
   */
  private static extractParametersFromRequestWithCoercion(
    userRequest: string,
    handler: HandlerMetadata,
  ): { extractionErrors: string[]; parameters: Record<string, any> } {
    const primaryResult = this.extractParametersFromRequestPrimary(
      userRequest,
      handler,
    );
    const parameters = { ...primaryResult.parameters };
    const extractionErrors = [...primaryResult.extractionErrors];

    if (!handler.parameters) {
      return { extractionErrors, parameters };
    }

    // Try coercion for missing required parameters
    for (const param of handler.parameters) {
      if (
        param.required &&
        (parameters[param.name] === null ||
          parameters[param.name] === undefined)
      ) {
        // Extract any value and try coercion
        const allMatches = userRequest.match(/\S+/g) || [];

        for (const match of allMatches) {
          const coercionResult = this.coerceParameterType(match, param.type);
          if (coercionResult.success) {
            const validation = this.validateParameterValue(
              coercionResult.value,
              param,
            );
            if (validation.isValid) {
              parameters[param.name] = coercionResult.value;
              // Remove error for this parameter
              const errorIndex = extractionErrors.findIndex((err) =>
                err.includes(`parameter '${param.name}'`),
              );
              if (errorIndex >= 0) {
                extractionErrors.splice(errorIndex, 1);
              }
              break;
            }
          }
        }
      }
    }

    return { extractionErrors, parameters };
  }

  /**
   * Extract parameters with retry mechanisms and alternative strategies
   */
  private static async extractParametersWithRetry(
    sessionId: string,
    userRequest: string,
    handler: HandlerMetadata,
  ): Promise<{
    extractionErrors: string[];
    parameters: Record<string, any>;
    retryAttempts: number;
    strategiesUsed: string[];
  }> {
    const strategies = ["primary", "fallback", "coercion", "fuzzy"];

    let lastParameters: Record<string, any> = {};
    let lastErrors: string[] = [];
    const strategiesUsed: string[] = [];

    for (
      let attempt = 0;
      attempt < ADPProcessCommunicationService.MAX_RETRY_ATTEMPTS;
      attempt++
    ) {
      const strategy = strategies[Math.min(attempt, strategies.length - 1)];
      strategiesUsed.push(strategy);

      this.debugLog(
        `[${sessionId}] Extraction attempt ${attempt + 1}/${ADPProcessCommunicationService.MAX_RETRY_ATTEMPTS} using '${strategy}' strategy`,
      );

      const result = await this.extractParametersWithStrategy(
        userRequest,
        handler,
        strategy,
      );

      lastParameters = result.parameters;
      lastErrors = result.extractionErrors;

      // Check if extraction is successful enough to proceed
      if (
        this.isExtractionSuccessful(
          handler,
          result.parameters,
          result.extractionErrors,
        )
      ) {
        this.debugLog(
          `[${sessionId}] Extraction successful on attempt ${attempt + 1}`,
        );
        break;
      }

      // Add delay between retries
      if (attempt < ADPProcessCommunicationService.MAX_RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, ADPProcessCommunicationService.RETRY_DELAY_MS),
        );
      }
    }

    return {
      extractionErrors: lastErrors,
      parameters: lastParameters,
      retryAttempts: strategiesUsed.length,
      strategiesUsed,
    };
  }

  /**
   * Extract parameters using different strategies
   */
  private static async extractParametersWithStrategy(
    userRequest: string,
    handler: HandlerMetadata,
    strategy: string,
  ): Promise<{ extractionErrors: string[]; parameters: Record<string, any> }> {
    switch (strategy) {
      case "coercion":
        return this.extractParametersFromRequestWithCoercion(
          userRequest,
          handler,
        );
      case "fallback":
        return this.extractParametersFromRequestFallback(userRequest, handler);
      case "fuzzy":
        return this.extractParametersFromRequestFuzzy(userRequest, handler);
      case "primary":
        return this.extractParametersFromRequestPrimary(userRequest, handler);
      default:
        return this.extractParametersFromRequestPrimary(userRequest, handler);
    }
  }

  /**
   * Extract a specific parameter value from user request using enhanced patterns
   *
   * Supports comprehensive natural language patterns for mathematical operations:
   * - Addition: "add 5 and 3", "5 plus 3", "sum of 5 and 3", "what is 5 + 3"
   * - Subtraction: "subtract 5 from 10", "10 - 5", "take away 5 from 10"
   * - Multiplication: "multiply 6 by 7", "6 * 7", "6 times 7"
   * - Division: "divide 15 by 3", "15 / 3", "15 divided by 3"
   *
   * Parameter mapping for mathematical operations:
   * - A parameter: First operand, subtrahend, multiplicand, dividend
   * - B parameter: Second operand, minuend, multiplier, divisor
   *
   * Enhanced features:
   * - Case-insensitive matching
   * - Support for negative numbers (-5, -10.5)
   * - Support for decimal numbers (5.5, 3.14)
   * - Fallback patterns for ambiguous requests
   * - Input validation and error reporting
   *
   * @param request - User's natural language request
   * @param param - Parameter metadata including name, type, and constraints
   * @returns Extracted and validated parameter value, or null if extraction failed
   */
  private static extractParameterValue(
    request: string,
    param: { name: string; type: string },
  ): any {
    const paramName = param.name.toLowerCase();
    // Escape special regex characters to prevent "Nothing to repeat" errors
    const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    this.debugLog(
      `Extracting parameter '${param.name}' (type: ${param.type}) from: "${request}"`,
    );

    // Check mathematical patterns first for A and B parameters
    if (param.type === "number" && (paramName === "a" || paramName === "b")) {
      // Handle mathematical operation parameters (A, B for Add/Subtract)
      if (paramName === "a") {
        const aPatterns = [
          // Addition patterns - first operand
          /add\s+([0-9.-]+)\s+(?:and|to|\+)/i, // "add 15 and 7" -> 15
          /([0-9.-]+)\s*\+\s*[0-9.-]+/i, // "15 + 7" -> 15
          /([0-9.-]+)\s+plus\s+[0-9.-]+/i, // "15 plus 7" -> 15
          /([0-9.-]+)\s+added?\s+to\s+[0-9.-]+/i, // "15 added to 7" -> 15

          // Alternative addition phrasings
          /(?:calculate|compute|find)\s+([0-9.-]+)\s*\+\s*[0-9.-]+/i, // "calculate 15 + 7" -> 15
          /(?:what\s+is\s+)?([0-9.-]+)\s+plus\s+[0-9.-]+/i, // "what is 15 plus 7" -> 15
          /sum\s+of\s+([0-9.-]+)\s+and\s+[0-9.-]+/i, // "sum of 15 and 7" -> 15

          // Subtraction patterns - subtrahend (number being subtracted)
          /subtract\s+([0-9.-]+)\s+from/i, // "subtract 15 from 20" -> 15 (subtrahend)
          /take\s+(?:away\s+)?([0-9.-]+)\s+from/i, // "take away 15 from 20" -> 15
          /minus\s+([0-9.-]+)\s+from/i, // "minus 15 from 20" -> 15

          // Division patterns - dividend (first number)
          /divide\s+([0-9.-]+)\s+by\s+[0-9.-]+/i, // "divide 15 by 7" -> 15
          /([0-9.-]+)\s*\/\s*[0-9.-]+/i, // "15 / 7" -> 15
          /([0-9.-]+)\s+divided\s+by\s+[0-9.-]+/i, // "15 divided by 7" -> 15

          // Multiplication patterns - first multiplicand
          /multiply\s+([0-9.-]+)\s+(?:by|and|with)\s+[0-9.-]+/i, // "multiply 15 by 7" -> 15
          /([0-9.-]+)\s*\*\s*[0-9.-]+/i, // "15 * 7" -> 15
          /([0-9.-]+)\s+times\s+[0-9.-]+/i, // "15 times 7" -> 15

          // Subtraction pattern "X - Y" - A gets the minuend (first number)
          /([0-9.-]+)\s*-\s*[0-9.-]+/i, // "20 - 15" -> 20 (minuend for A)

          // Generic first number patterns (for addition, multiplication, division)
          /^([0-9.-]+)\s*[+*/]\s*[0-9.-]+$/, // "15 + 7" -> 15 (strict format, no subtraction)
          /(?:^|\s)([0-9.-]+)\s+(?:and|with)\s+[0-9.-]+(?:\s|$)/i, // "15 and 7" -> 15
        ];

        for (const pattern of aPatterns) {
          const match = request.match(pattern);
          if (match && match[1] && !isNaN(parseFloat(match[1]))) {
            return this.convertParameterValue(match[1], param.type);
          }
        }
      }

      if (paramName === "b") {
        const bPatterns = [
          // Addition patterns - second operand
          /add\s+[0-9.-]+\s+(?:and|to|\+)\s+([0-9.-]+)/i, // "add 15 and 7" -> 7
          /[0-9.-]+\s*\+\s*([0-9.-]+)/i, // "15 + 7" -> 7
          /[0-9.-]+\s+plus\s+([0-9.-]+)/i, // "15 plus 7" -> 7
          /[0-9.-]+\s+added?\s+to\s+([0-9.-]+)/i, // "15 added to 7" -> 7

          // Alternative addition phrasings
          /(?:calculate|compute|find)\s+[0-9.-]+\s*\+\s*([0-9.-]+)/i, // "calculate 15 + 7" -> 7
          /(?:what\s+is\s+)?[0-9.-]+\s+plus\s+([0-9.-]+)/i, // "what is 15 plus 7" -> 7
          /sum\s+of\s+[0-9.-]+\s+and\s+([0-9.-]+)/i, // "sum of 15 and 7" -> 7

          // Subtraction patterns - minuend (number being subtracted from)
          /subtract\s+[0-9.-]+\s+from\s+([0-9.-]+)/i, // "subtract 15 from 20" -> 20 (minuend)
          /take\s+(?:away\s+)?[0-9.-]+\s+from\s+([0-9.-]+)/i, // "take away 15 from 20" -> 20
          /minus\s+[0-9.-]+\s+from\s+([0-9.-]+)/i, // "minus 15 from 20" -> 20

          // Division patterns - divisor (second number)
          /divide\s+[0-9.-]+\s+by\s+([0-9.-]+)/i, // "divide 15 by 7" -> 7
          /[0-9.-]+\s*\/\s*([0-9.-]+)/i, // "15 / 7" -> 7
          /[0-9.-]+\s+divided\s+by\s+([0-9.-]+)/i, // "15 divided by 7" -> 7

          // Multiplication patterns - second multiplicand
          /multiply\s+[0-9.-]+\s+(?:by|and|with)\s+([0-9.-]+)/i, // "multiply 15 by 7" -> 7
          /[0-9.-]+\s*\*\s*([0-9.-]+)/i, // "15 * 7" -> 7
          /[0-9.-]+\s+times\s+([0-9.-]+)/i, // "15 times 7" -> 7

          // Subtraction pattern "X - Y" - B gets the subtrahend (second number)
          /[0-9.-]+\s*-\s*([0-9.-]+)/i, // "20 - 15" -> 15 (subtrahend for B)

          // Generic second number patterns (for addition, multiplication)
          /^[0-9.-]+\s*[+*/]\s*([0-9.-]+)$/, // "15 + 7" -> 7 (strict format, no subtraction)
          /(?:^|\s)[0-9.-]+\s+(?:and|with)\s+([0-9.-]+)(?:\s|$)/i, // "15 and 7" -> 7
        ];

        for (const pattern of bPatterns) {
          const match = request.match(pattern);
          if (match && match[1] && !isNaN(parseFloat(match[1]))) {
            return this.convertParameterValue(match[1], param.type);
          }
        }
      }
    }

    // Parameter-specific patterns - comprehensive
    const patterns = [
      new RegExp(`${escapedParamName}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
      new RegExp(`${escapedParamName}\\s+([^\\s]+)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return this.convertParameterValue(match[1], param.type);
      }
    }

    // Enhanced type and name-specific extraction
    if (param.type === "string" || param.type === "address") {
      if (paramName === "target" || paramName === "recipient") {
        const addressPatterns = [
          /to\s+([a-zA-Z0-9_-]+)/i,
          /send\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([a-zA-Z0-9_-]+)/i,
          /transfer\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([a-zA-Z0-9_-]+)/i,
          /recipient[:\s]+([a-zA-Z0-9_-]+)/i,
          /target[:\s]+([a-zA-Z0-9_-]+)/i,
        ];

        for (const pattern of addressPatterns) {
          const match = request.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }

    if (param.type === "number" || param.type === "string") {
      if (paramName === "quantity" || paramName === "amount") {
        const numberPatterns = [
          /send\s+([0-9.]+)/i,
          /transfer\s+([0-9.]+)/i,
          /amount\s*[=:]?\s*([0-9.]+)/i,
          /([0-9.]+)\s+tokens?/i,
          /quantity[:\s]+([0-9.]+)/i,
        ];

        for (const pattern of numberPatterns) {
          const match = request.match(pattern);
          if (match && match[1]) {
            return this.convertParameterValue(match[1], param.type);
          }
        }
      }
    }

    return null;
  }

  /**
   * Find the best matching handler for a user request
   */
  private static findBestHandlerMatch(
    userRequest: string,
    handlers: HandlerMetadata[],
  ): { confidence: number; handler: HandlerMetadata } | null {
    const requestLower = userRequest.toLowerCase();
    let bestMatch: { confidence: number; handler: HandlerMetadata } | null =
      null;
    let highestScore = 0;

    for (const handler of handlers) {
      let score = 0;

      // Direct action name match
      if (requestLower.includes(handler.action.toLowerCase())) {
        score += 0.6;
      }

      // Description word matching
      if (handler.description) {
        const descWords = handler.description.toLowerCase().split(/\s+/);
        const requestWords = requestLower.split(/\s+/);
        const matchingWords = descWords.filter((word) =>
          requestWords.includes(word),
        );
        score += (matchingWords.length / descWords.length) * 0.3;
      }

      // Parameter name matching
      if (handler.parameters) {
        for (const param of handler.parameters) {
          if (requestLower.includes(param.name.toLowerCase())) {
            score += 0.1;
          }
        }
      }

      // Action-specific scoring
      score += this.getActionSpecificScore(requestLower, handler.action);

      if (score > highestScore && score > 0.3) {
        bestMatch = { confidence: Math.min(score, 1.0), handler };
        highestScore = score;
      }
    }

    return bestMatch;
  }

  /**
   * Generate comprehensive alternative format suggestions for users
   */
  private static generateAlternativeFormats(
    handler: HandlerMetadata,
    userRequest: string,
  ): string[] {
    const alternatives: string[] = [];

    if (!handler.parameters) {
      alternatives.push(
        `Handler '${handler.action}' requires no parameters. Try: "${handler.action}"`,
      );
      return alternatives;
    }

    // Generate direct parameter format examples
    const directExample = handler.parameters
      .map((p) => {
        const exampleValue = this.getExampleValue(p.type, p.name);
        return `${p.name}=${exampleValue}`;
      })
      .join(" ");
    alternatives.push(`Direct format: "${directExample}"`);

    // Generate JSON format example
    const jsonExample = handler.parameters.reduce(
      (obj, p) => {
        obj[p.name] = this.getExampleValue(p.type, p.name);
        return obj;
      },
      {} as Record<string, any>,
    );
    alternatives.push(`JSON format: "${JSON.stringify(jsonExample)}"`);

    // Generate natural language suggestions based on handler action
    const naturalLanguageSuggestions = this.generateNaturalLanguageSuggestions(
      handler,
      userRequest,
    );
    alternatives.push(...naturalLanguageSuggestions);

    // Generate parameter-specific tips
    const parameterTips = this.generateParameterSpecificTips(
      handler.parameters,
    );
    alternatives.push(...parameterTips);

    return alternatives;
  }

  /**
   * Generate natural language suggestions based on handler action
   */
  private static generateNaturalLanguageSuggestions(
    handler: HandlerMetadata,
    userRequest: string,
  ): string[] {
    const suggestions: string[] = [];
    const action = handler.action.toLowerCase();

    // Mathematical operations
    if (["add", "addition"].includes(action)) {
      suggestions.push(
        'Natural language: "add 15 and 25" or "calculate 15 + 25"',
      );
      suggestions.push('Mathematical format: "15 + 25" or "sum of 15 and 25"');
    } else if (["subtract", "subtraction"].includes(action)) {
      suggestions.push('Natural language: "subtract 5 from 20" or "20 - 5"');
    } else if (["multiplication", "multiply"].includes(action)) {
      suggestions.push('Natural language: "multiply 6 by 7" or "6 * 7"');
    } else if (["divide", "division"].includes(action)) {
      suggestions.push('Natural language: "divide 15 by 3" or "15 / 3"');
    }

    // Token operations
    else if (["send", "transfer"].includes(action)) {
      suggestions.push('Natural language: "transfer 100 tokens to alice123"');
      suggestions.push('Format: "send [amount] to [recipient]"');
    } else if (["mint"].includes(action)) {
      suggestions.push('Natural language: "mint 500 tokens to bob456"');
    } else if (["burn"].includes(action)) {
      suggestions.push('Natural language: "burn 50 tokens"');
    } else if (["balance"].includes(action)) {
      suggestions.push(
        'Natural language: "check balance of alice123" or just "balance"',
      );
    }

    // Information operations
    else if (["info", "information"].includes(action)) {
      suggestions.push('Simple format: "info" or "get information"');
    } else if (["ping"].includes(action)) {
      suggestions.push('Simple format: "ping" or "ping process"');
    }

    // Generic suggestions
    else {
      suggestions.push(`Natural language: "${action} [parameters]"`);
      suggestions.push(`Try being more specific about the ${action} operation`);
    }

    return suggestions;
  }

  /**
   * Generate parameter-specific tips and validation guidance
   */
  private static generateParameterSpecificTips(
    parameters: Array<{ name: string; required?: boolean; type: string }>,
  ): string[] {
    const tips: string[] = [];

    const requiredParams = parameters.filter((p) => p.required);
    const optionalParams = parameters.filter((p) => !p.required);

    if (requiredParams.length > 0) {
      tips.push(
        `Required parameters: ${requiredParams.map((p) => `${p.name} (${p.type})`).join(", ")}`,
      );
    }

    if (optionalParams.length > 0) {
      tips.push(
        `Optional parameters: ${optionalParams.map((p) => `${p.name} (${p.type})`).join(", ")}`,
      );
    }

    // Type-specific tips
    const numberParams = parameters.filter((p) => p.type === "number");
    const addressParams = parameters.filter((p) => p.type === "address");
    const stringParams = parameters.filter((p) => p.type === "string");

    if (numberParams.length > 0) {
      tips.push(
        `Numbers: Use decimal numbers (e.g., 5, 3.14, -10) for ${numberParams.map((p) => p.name).join(", ")}`,
      );
    }

    if (addressParams.length > 0) {
      tips.push(
        `Addresses: Use alphanumeric strings (e.g., abc123def456) for ${addressParams.map((p) => p.name).join(", ")}`,
      );
    }

    if (stringParams.length > 0) {
      tips.push(
        `Strings: Use text values for ${stringParams.map((p) => p.name).join(", ")}`,
      );
    }

    return tips;
  }

  /**
   * Generate troubleshooting tips based on extraction and validation results
   */
  private static generateTroubleshootingTips(
    userRequest: string,
    handler: HandlerMetadata,
    strategyResults: any[],
    validationResult: ValidationResult,
  ): string[] {
    const tips: string[] = [];

    // Check if any strategy worked
    const successfulStrategy = strategyResults.find((r) => r.success);
    if (!successfulStrategy) {
      tips.push("No extraction strategy was completely successful");
      tips.push("Try being more explicit about parameter values");
      tips.push(
        `Expected parameters: ${handler.parameters?.map((p) => `${p.name} (${p.type})`).join(", ") || "none"}`,
      );
    }

    // Check for common patterns
    if (
      handler.action.toLowerCase().includes("add") &&
      !userRequest.toLowerCase().includes("add")
    ) {
      tips.push(
        'For addition operations, try using words like "add", "plus", or "+"',
      );
    }

    if (
      handler.parameters?.some((p) => p.type === "address") &&
      !/[a-zA-Z0-9_-]{10,}/.test(userRequest)
    ) {
      tips.push(
        "Address parameters should be alphanumeric strings, typically 10+ characters",
      );
    }

    // Validation-specific tips
    if (validationResult.errors.length > 0) {
      tips.push(
        "Validation errors occurred - check parameter types and formats",
      );
      if (validationResult.suggestedFixes) {
        tips.push(...validationResult.suggestedFixes);
      }
    }

    // Generic improvement tips
    tips.push('Try using explicit parameter syntax: "A=5 B=10"');
    tips.push("Use clear action words that match the handler name");

    return tips;
  }

  /**
   * Generate working examples based on handler and common patterns
   */
  private static generateWorkingExamples(
    handler: HandlerMetadata,
    userRequest: string,
  ): string[] {
    const examples: string[] = [];
    const action = handler.action.toLowerCase();

    if (["add"].includes(action) && handler.parameters?.length === 2) {
      examples.push("Working examples:");
      examples.push('  "add 15 and 25"');
      examples.push('  "A=15 B=25"');
      examples.push('  "15 + 25"');
      examples.push('  "{"A": 15, "B": 25}"');
    } else if (["transfer"].includes(action)) {
      examples.push("Working examples:");
      examples.push('  "transfer 100 tokens to alice123"');
      examples.push('  "quantity=100 recipient=alice123"');
      examples.push('  "{"quantity": "100", "recipient": "alice123"}"');
    } else if (handler.parameters && handler.parameters.length > 0) {
      examples.push("Working examples:");
      const exampleValues = handler.parameters.map((p) =>
        this.getExampleValue(p.type, p.name),
      );
      examples.push(
        `  "${handler.parameters.map((p, i) => `${p.name}=${exampleValues[i]}`).join(" ")}"`,
      );

      const jsonExample = handler.parameters.reduce(
        (obj, p, i) => {
          obj[p.name] = exampleValues[i];
          return obj;
        },
        {} as Record<string, any>,
      );
      examples.push(`  "${JSON.stringify(jsonExample)}"`);
    }

    return examples;
  }

  /**
   * Get action-specific matching score based on synonyms and patterns
   */
  private static getActionSpecificScore(
    request: string,
    action: string,
  ): number {
    const actionSynonyms: Record<string, string[]> = {
      add: ["plus", "sum", "total", "combine", "calculate", "+", "addition"],
      balance: ["check", "get", "show", "view"],
      burn: ["destroy", "remove", "delete"],
      divide: ["division", "/", "divided", "÷"],
      info: ["details", "information", "about"],
      mint: ["create", "generate", "issue"],
      multiply: ["times", "multiplication", "*", "×", "multiplied"],
      subtract: ["minus", "subtraction", "-", "take", "difference"],
      transfer: ["send", "give", "pay", "move"],
    };

    const synonyms = actionSynonyms[action.toLowerCase()] || [];
    for (const synonym of synonyms) {
      if (request.includes(synonym)) {
        return 0.4;
      }
    }

    return 0;
  }

  /**
   * Get example value for parameter type
   */
  private static getExampleValue(type: string, name: string): any {
    switch (type) {
      case "address":
        return "abc123def456";
      case "boolean":
        return true;
      case "number":
        return name.toLowerCase() === "a"
          ? 5
          : name.toLowerCase() === "b"
            ? 3
            : 10;
      case "string":
      default:
        return `example_${name}`;
    }
  }

  /**
   * Get process-specific optimizations based on known patterns
   */
  private static getProcessSpecificOptimizations(
    processId: string,
    adpMetadata?: ExtendedInfoResponse,
  ): "data" | "hybrid" | "tags" | null {
    // Cache process format preferences for performance
    const cacheKey = `format_pref_${processId}`;
    const cached = this.processFormatCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < this.PROCESS_FORMAT_CACHE_TTL
    ) {
      return cached.strategy;
    }

    // Analyze ADP metadata for optimization hints
    if (adpMetadata) {
      const optimization = this.analyzeADPForOptimization(adpMetadata);
      if (optimization) {
        // Cache the result
        this.processFormatCache.set(cacheKey, {
          strategy: optimization,
          timestamp: Date.now(),
        });
        return optimization;
      }
    }

    // Known process patterns (can be expanded)
    const knownPatterns: Record<string, "data" | "hybrid" | "tags"> = {
      // Calculator processes typically prefer tags
      calculator: "tags",
      coin: "data",
      // Generic processes use hybrid approach
      generic: "hybrid",
      math: "tags",
      // Token processes might prefer data for complex operations
      token: "data",
    };

    // Check if process name matches known patterns
    for (const [pattern, strategy] of Object.entries(knownPatterns)) {
      if (processId.toLowerCase().includes(pattern)) {
        this.processFormatCache.set(cacheKey, {
          strategy,
          timestamp: Date.now(),
        });
        return strategy;
      }
    }

    return null; // No specific optimization found
  }

  /**
   * Detect complex JSON structures in request
   */
  private static hasComplexJsonStructures(request: string): boolean {
    // Check for nested objects
    if (/\{[^{}]*\{[^}]*\}[^{}]*\}/.test(request)) {
      return true;
    }

    // Check for arrays
    if (/\[[^\]]*\]/.test(request)) {
      return true;
    }

    // Check for object assignments
    if (/[a-zA-Z_]\w*\s*=\s*\{[^}]*\}/.test(request)) {
      return true;
    }

    // Check for array assignments
    if (/[a-zA-Z_]\w*\s*=\s*\[[^\]]*\]/.test(request)) {
      return true;
    }

    return false;
  }

  /**
   * Check if parameters contain complex structures
   */
  private static hasComplexStructures(
    parameters: Record<string, any>,
  ): boolean {
    for (const value of Object.values(parameters)) {
      if (
        Array.isArray(value) ||
        (typeof value === "object" && value !== null)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Infer parameters from handler examples when parameters field is missing
   */
  private static inferParametersFromExamples(
    handler: HandlerMetadata,
  ): HandlerParameter[] {
    const inferredParams: HandlerParameter[] = [];

    if (!handler.examples || handler.examples.length === 0) {
      return inferredParams;
    }

    // Analyze examples to find parameter patterns
    for (const example of handler.examples) {
      // Look for patterns like "A=5 and B=3" or "A=5 B=3"
      const paramMatches = example.match(/(\w+)=([^=\s]+)/g);
      if (paramMatches) {
        for (const match of paramMatches) {
          const [, name, value] = match.match(/(\w+)=(.+)/) || [];
          if (name && value && !inferredParams.some((p) => p.name === name)) {
            // Infer parameter type from example value
            let type: "address" | "boolean" | "json" | "number" | "string" =
              "string";
            if (/^-?\d+(\.\d+)?$/.test(value)) {
              type = "number";
            } else if (/^(true|false)$/i.test(value)) {
              type = "boolean";
            } else if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) {
              type = "address";
            }

            inferredParams.push({
              description: `Inferred ${type} parameter from examples`,
              name,
              required: true, // Assume required if shown in examples
              type,
            });
          }
        }
      }
    }

    this.debugLog(
      `Inferred ${inferredParams.length} parameters from examples`,
      { handler: handler.action, inferredParams },
    );

    return inferredParams;
  }

  /**
   * Check if extraction is successful enough to proceed
   */
  private static isExtractionSuccessful(
    handler: HandlerMetadata,
    parameters: Record<string, any>,
    errors: string[],
  ): boolean {
    if (!handler.parameters) {
      return true; // No parameters required
    }

    const requiredParams = handler.parameters.filter((p) => p.required);
    const extractedRequiredParams = requiredParams.filter(
      (p) => parameters[p.name] !== null && parameters[p.name] !== undefined,
    );

    // Success if all required parameters are extracted
    return extractedRequiredParams.length === requiredParams.length;
  }

  /**
   * Determine if a handler performs write operations that require send() vs read()
   * Read operations: Info, Balance, Get, View, Check, Query, List
   * Write operations: Transfer, Send, Mint, Burn, Create, Update, Delete, Set, Add, Remove
   */
  private static isWriteHandler(handler: HandlerMetadata): boolean {
    const actionLower = handler.action.toLowerCase();

    // Read operations - use read() method
    const readActions = [
      "info",
      "balance",
      "get",
      "view",
      "check",
      "query",
      "list",
      "show",
      "ping",
      "pong",
      "status",
      "version",
      "details",
    ];

    // Write operations - use send() method
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
      "subtract",
      "multiply",
      "divide",
      "calculate",
      "remove",
      "approve",
      "vote",
      "stake",
      "unstake",
      "deposit",
      "withdraw",
      "swap",
      "execute",
    ];

    // First check if it's explicitly a read operation
    if (readActions.some((action) => actionLower.includes(action))) {
      return false;
    }

    // Then check if it's a write operation
    if (writeActions.some((action) => actionLower.includes(action))) {
      return true;
    }

    // Default to read for unknown actions to be safe
    return false;
  }

  /**
   * Parse direct parameter value with type coercion
   */
  private static parseDirectValue(value: string): any {
    // Handle quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Handle booleans
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Handle numbers
    const num = parseFloat(value);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }

    // Return as string
    return value;
  }

  /**
   * Parse simple direct parameter format
   */
  private static parseSimpleDirectFormat(
    request: string,
  ): null | Record<string, any> {
    const directParameters: Record<string, any> = {};

    // Pattern 1: "A=5 B=3" format (handle quoted values)
    const equalsPattern =
      /([a-zA-Z_]\w*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)/g;
    let match;
    let foundParams = 0;

    while ((match = equalsPattern.exec(request)) !== null) {
      const [, paramName, paramValue] = match;
      directParameters[paramName] = this.parseDirectValue(paramValue);
      foundParams++;
    }

    if (foundParams > 0) {
      return directParameters;
    }

    // Pattern 2: "A:5,B:3" format
    const colonPattern = /([a-zA-Z_]\w*)\s*:\s*([^,\s]+)/g;
    foundParams = 0;

    while ((match = colonPattern.exec(request)) !== null) {
      const [, paramName, paramValue] = match;
      directParameters[paramName] = this.parseDirectValue(paramValue);
      foundParams++;
    }

    if (foundParams > 0) {
      return directParameters;
    }

    // Pattern 3: JSON-like format
    try {
      const jsonPattern = /\{[^}]+\}/;
      const jsonMatch = request.match(jsonPattern);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed;
        }
      }
    } catch {
      // Not valid JSON, continue
    }

    return null;
  }

  /**
   * Parse simple object notation: {name:"john",age:30}
   */
  private static parseSimpleObject(objectString: string): Record<string, any> {
    const result: Record<string, any> = {};
    const content = objectString.slice(1, -1); // Remove braces

    // Split by comma, but be careful of nested structures
    const pairs = this.splitRespectingNesting(content, ",");

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(":");
      if (colonIndex > 0) {
        const key = pair.substring(0, colonIndex).trim().replace(/["']/g, "");
        const value = pair.substring(colonIndex + 1).trim();
        result[key] = this.parseDirectValue(value);
      }
    }

    return result;
  }

  /**
   * Serialize complex parameters with proper handling
   */
  private static serializeComplexParameters(
    parameters: Record<string, any>,
  ): string {
    const processValue = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map(processValue);
      }

      if (typeof value === "object" && value !== null) {
        const processed: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }

      // Handle primitive values
      return value;
    };

    const processedParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      processedParams[key] = processValue(value);
    }

    return JSON.stringify(processedParams, null, 0);
  }

  /**
   * Determine if debug context should be included in responses
   */
  private static shouldIncludeDebugContext(): boolean {
    return process.env.NODE_ENV === "development" || this.verboseLogging;
  }

  /**
   * Split string by delimiter while respecting nested structures
   */
  private static splitRespectingNesting(
    text: string,
    delimiter: string,
  ): string[] {
    const result: string[] = [];
    let current = "";
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        current += char;
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        current += char;
        continue;
      }

      if (!inString) {
        if (char === "{" || char === "[") {
          depth++;
        } else if (char === "}" || char === "]") {
          depth--;
        }

        if (char === delimiter && depth === 0) {
          result.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Try data field fallback mechanism with process-specific optimization
   */
  private static async tryDataFieldFallback(
    sessionId: string,
    userRequest: string,
    handler: HandlerMetadata,
    processId: string,
    signer: JWKInterface,
    startTime: number,
    adpMetadata?: ExtendedInfoResponse,
  ): Promise<ADPCommunicationResult> {
    this.debugLog(`[${sessionId}] Trying data field fallback`);

    // Get process-specific optimization strategy
    const optimizationStrategy = this.getFallbackStrategy(
      processId,
      handler,
      adpMetadata,
    );
    this.debugLog(
      `[${sessionId}] Using optimization strategy: ${optimizationStrategy}`,
    );

    // Extract parameters using existing logic but with more aggressive fallback
    const fallbackParams = this.extractParametersFromRequestFallback(
      userRequest,
      handler,
    );

    if (fallbackParams.extractionErrors.length > 0) {
      this.debugLog(`[${sessionId}] Data field parameter extraction failed`, {
        errors: fallbackParams.extractionErrors,
      });
    }

    // Apply optimization strategy
    const isWriteOperation = this.isWriteHandler(handler);
    let response;

    try {
      if (optimizationStrategy === "tags") {
        // Use traditional tag-based approach for optimized processes
        const tags = DocumentationProtocolService.generateMessageTags(
          handler,
          fallbackParams.parameters,
        );
        if (isWriteOperation) {
          response = await send(signer, processId, tags, null);
        } else {
          response = await read(processId, tags);
        }
      } else if (optimizationStrategy === "data") {
        // Use data field approach
        const dataFieldJson = this.generateDataFieldParameters(
          fallbackParams.parameters,
        );
        const basicTags = [{ name: "Action", value: handler.action }];
        if (isWriteOperation) {
          response = await send(signer, processId, basicTags, dataFieldJson);
        } else {
          response = await read(processId, basicTags);
        }
      } else {
        // Hybrid approach - try both if needed
        const dataFieldJson = this.generateDataFieldParameters(
          fallbackParams.parameters,
        );
        const basicTags = [{ name: "Action", value: handler.action }];
        if (isWriteOperation) {
          response = await send(signer, processId, basicTags, dataFieldJson);
        } else {
          response = await read(processId, basicTags);
        }
      }

      this.debugLog(
        `[${sessionId}] Data field fallback successful with ${optimizationStrategy} strategy`,
      );

      return {
        approach: "ADP",
        data: response?.Data || response,
        fallbackMethod: "processSpecific",
        fallbackUsed: true,
        handlerUsed: handler.action,
        methodUsed: isWriteOperation ? "send" : "read",
        parameterFormat: optimizationStrategy === "tags" ? "natural" : "json",
        parametersUsed: fallbackParams.parameters,
        success: true,
      };
    } catch (error) {
      this.debugLog(`[${sessionId}] Data field execution failed`, { error });
      return {
        approach: "ADP",
        error: `Data field execution failed: ${error}`,
        success: false,
      };
    }
  }

  /**
   * Try direct parameter format fallback (A=5 B=3)
   */
  private static async tryDirectParameterFallback(
    sessionId: string,
    userRequest: string,
    handler: HandlerMetadata,
    processId: string,
    signer: JWKInterface,
    startTime: number,
  ): Promise<ADPCommunicationResult> {
    this.debugLog(`[${sessionId}] Trying direct parameter format fallback`);

    const directParams = this.parseDirectParameterFormat(userRequest);
    if (!directParams) {
      return {
        approach: "ADP",
        error: "No direct parameters found",
        success: false,
      };
    }

    // Validate direct parameters
    const validation = await this.validateExtractedParameters(
      sessionId,
      handler,
      directParams,
    );

    if (!validation.valid) {
      this.debugLog(`[${sessionId}] Direct parameter validation failed`, {
        errors: validation.errors,
      });
      return {
        approach: "ADP",
        error: `Direct parameter validation failed: ${validation.errors.join(", ")}`,
        success: false,
      };
    }

    // Generate tags and execute
    const tags = DocumentationProtocolService.generateMessageTags(
      handler,
      directParams,
    );
    const isWriteOperation = this.isWriteHandler(handler);

    try {
      let response;
      if (isWriteOperation) {
        response = await send(signer, processId, tags, null);
      } else {
        response = await read(processId, tags);
      }

      this.debugLog(`[${sessionId}] Direct parameter fallback successful`);

      return {
        approach: "ADP",
        data: response?.Data || response,
        fallbackMethod: "directFormat",
        fallbackUsed: true,
        handlerUsed: handler.action,
        methodUsed: isWriteOperation ? "send" : "read",
        parameterFormat: "direct",
        parametersUsed: directParams,
        success: true,
      };
    } catch (error) {
      this.debugLog(`[${sessionId}] Direct parameter execution failed`, {
        error,
      });
      return {
        approach: "ADP",
        error: `Direct parameter execution failed: ${error}`,
        success: false,
      };
    }
  }

  /**
   * Validate complex structure for AO compatibility
   */
  private static validateComplexStructure(structure: any): Record<string, any> {
    // Ensure the structure is JSON serializable and AO-compatible
    try {
      const serialized = JSON.stringify(structure);
      const parsed = JSON.parse(serialized);
      return parsed;
    } catch (error) {
      throw new Error(`Complex structure validation failed: ${error}`);
    }
  }

  /**
   * Parameter validation middleware - validates extracted parameters before message creation
   * Provides comprehensive validation with actionable error messages and suggested fixes
   */
  private static async validateExtractedParameters(
    sessionId: string,
    handler: HandlerMetadata,
    parameters: Record<string, any>,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestedFixes: string[] = [];

    this.debugLog(`[${sessionId}] Running validation middleware`, {
      expectedParameters: handler.parameters?.length || 0,
      extractedParameters: Object.keys(parameters).length,
      handlerAction: handler.action,
    });

    // Check if handler requires parameters
    if (!handler.parameters || handler.parameters.length === 0) {
      if (Object.keys(parameters).length > 0) {
        warnings.push(
          `Handler '${handler.action}' expects no parameters but got ${Object.keys(parameters).length}`,
        );
      }
      return { errors, valid: true, warnings };
    }

    // Validate each expected parameter
    for (const expectedParam of handler.parameters) {
      const value = parameters[expectedParam.name];
      const paramValidation = this.validateParameterValue(value, expectedParam);

      if (!paramValidation.isValid) {
        errors.push(
          paramValidation.error ||
            `Parameter '${expectedParam.name}' validation failed`,
        );

        // Add specific suggested fixes
        if (expectedParam.required && (value === null || value === undefined)) {
          suggestedFixes.push(
            `Ensure your request clearly specifies a value for '${expectedParam.name}' (type: ${expectedParam.type})`,
          );
        } else if (
          expectedParam.type === "number" &&
          typeof value !== "number"
        ) {
          suggestedFixes.push(
            `Parameter '${expectedParam.name}' should be a numeric value`,
          );
        } else if (
          expectedParam.type === "address" &&
          typeof value === "string"
        ) {
          suggestedFixes.push(
            `Parameter '${expectedParam.name}' should be a valid address (alphanumeric, 1-43 characters)`,
          );
        }
      }
    }

    // Check for unexpected parameters
    const expectedParamNames = new Set(handler.parameters.map((p) => p.name));
    for (const paramName of Object.keys(parameters)) {
      if (!expectedParamNames.has(paramName)) {
        warnings.push(
          `Unexpected parameter '${paramName}' not defined in handler '${handler.action}'`,
        );
      }
    }

    // Contract validation - ensure parameter formats match handler expectations
    const contractValidation = this.validateParameterContracts(
      handler,
      parameters,
    );
    errors.push(...contractValidation.errors);
    warnings.push(...contractValidation.warnings);
    suggestedFixes.push(...contractValidation.suggestedFixes);

    const result = {
      errors,
      suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : undefined,
      valid: errors.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    this.debugLog(`[${sessionId}] Validation middleware completed`, {
      errorCount: errors.length,
      suggestedFixCount: suggestedFixes.length,
      valid: result.valid,
      warningCount: warnings.length,
    });

    return result;
  }

  /**
   * Contract validation between extracted parameters and handler expectations
   */
  private static validateParameterContracts(
    handler: HandlerMetadata,
    parameters: Record<string, any>,
  ): { errors: string[]; suggestedFixes: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestedFixes: string[] = [];

    if (!handler.parameters) {
      return { errors, suggestedFixes, warnings };
    }

    // Mathematical operation contract validation
    if (
      ["add", "divide", "multiply", "subtract"].includes(
        handler.action.toLowerCase(),
      )
    ) {
      const aParam = parameters.A || parameters.a;
      const bParam = parameters.B || parameters.b;

      if (typeof aParam === "number" && typeof bParam === "number") {
        // Check for mathematical edge cases
        if (handler.action.toLowerCase() === "divide" && bParam === 0) {
          errors.push("Division by zero is not allowed");
          suggestedFixes.push("Ensure the divisor (B parameter) is not zero");
        }

        if (Math.abs(aParam) > 1e10 || Math.abs(bParam) > 1e10) {
          warnings.push("Very large numbers may cause precision issues");
        }
      }
    }

    // Address format contract validation
    for (const param of handler.parameters) {
      if (param.type === "address" && parameters[param.name]) {
        const address = parameters[param.name];
        if (typeof address === "string") {
          if (address.length < 10) {
            warnings.push(
              `Address '${address}' seems unusually short for an Arweave address`,
            );
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(address)) {
            errors.push(`Address '${address}' contains invalid characters`);
            suggestedFixes.push(
              "Addresses should contain only alphanumeric characters, underscores, and dashes",
            );
          }
        }
      }
    }

    return { errors, suggestedFixes, warnings };
  }

  /**
   * Validate extracted parameter value against its type and constraints
   */
  private static validateParameterValue(
    value: any,
    param: { name: string; required?: boolean; type: string },
  ): { error?: string; isValid: boolean } {
    if (value === null || value === undefined) {
      if (param.required) {
        return {
          error: `Required parameter '${param.name}' is missing or could not be extracted`,
          isValid: false,
        };
      }
      return { isValid: true }; // Optional parameter, null is okay
    }

    // Attempt type coercion if needed
    const coercionResult = this.coerceParameterType(value, param.type);
    const validationValue = coercionResult.success
      ? coercionResult.value
      : value;

    switch (param.type) {
      case "address":
        if (typeof validationValue === "string") {
          // Enhanced address validation
          if (validationValue.length < 1 || validationValue.length > 43) {
            return {
              error: `Parameter '${param.name}' address length must be 1-43 characters, got ${validationValue.length}`,
              isValid: false,
            };
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(validationValue)) {
            return {
              error: `Parameter '${param.name}' contains invalid characters. Use only letters, numbers, underscores, and dashes`,
              isValid: false,
            };
          }
          return { isValid: true };
        }
        return {
          error: `Parameter '${param.name}' expected address string but got '${validationValue}' (${typeof validationValue})`,
          isValid: false,
        };

      case "boolean":
        if (typeof validationValue === "boolean") {
          return { isValid: true };
        }
        return {
          error: `Parameter '${param.name}' expected boolean but got '${validationValue}' (${typeof validationValue})`,
          isValid: false,
        };

      case "number":
        if (typeof validationValue === "number" && !isNaN(validationValue)) {
          // Enhanced range validation
          if (validationValue < -1e15 || validationValue > 1e15) {
            return {
              error: `Parameter '${param.name}' value ${validationValue} exceeds safe number range`,
              isValid: false,
            };
          }
          if (!Number.isFinite(validationValue)) {
            return {
              error: `Parameter '${param.name}' must be a finite number, got ${validationValue}`,
              isValid: false,
            };
          }
          return { isValid: true };
        }
        return {
          error: `Parameter '${param.name}' expected number but got '${validationValue}' (${typeof validationValue})`,
          isValid: false,
        };

      case "string":
        if (typeof validationValue === "string") {
          if (validationValue.trim().length === 0) {
            return {
              error: `Parameter '${param.name}' cannot be empty or whitespace-only`,
              isValid: false,
            };
          }
          if (validationValue.length > 10000) {
            return {
              error: `Parameter '${param.name}' exceeds maximum length of 10,000 characters`,
              isValid: false,
            };
          }
          return { isValid: true };
        }
        return {
          error: `Parameter '${param.name}' expected non-empty string but got '${validationValue}'`,
          isValid: false,
        };

      default:
        // Generic validation for unknown types
        return { isValid: true };
    }
  }
}
