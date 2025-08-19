import { z } from "zod";

import { LuaWorkflowOrchestrationService } from "../../../services/LuaWorkflowOrchestrationService.js";
import { ParameterExtractionService } from "../../../services/ParameterExtractionService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface GenerateLuaProcessArgs {
  domains?: string;
  includeExplanation?: boolean;
  userRequest: string;
}

/**
 * MCP tool command for generating AO Lua process code with automatic documentation integration.
 *
 * This command orchestrates the complete workflow:
 * 1. Analyzes user requirements to detect AO patterns and complexity
 * 2. Queries relevant Permaweb documentation automatically
 * 3. Generates appropriate Lua code using documentation-informed templates
 * 4. Provides comprehensive code explanations with source citations
 *
 * The generated code follows AO best practices and includes proper handler patterns,
 * message routing, state management, and error handling based on detected requirements.
 */
export class GenerateLuaProcessCommand extends ToolCommand<
  GenerateLuaProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Generate Lua code for AO processes with documentation-informed best practices. This tool ONLY generates code - it does NOT deploy processes. Use this tool for: 'create AO process code', 'generate AO process code', 'build process handlers'. After code generation, use spawnProcess + evalProcess tools for deployment (NOT aos CLI). Returns structured JSON with generated Lua code, explanations, and ADP compliance validation. For deployment workflow: 1) generateLuaProcess → 2) spawnProcess → 3) evalProcess.",
    name: "generateLuaProcess",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Generate AO Process Code (Code Only - No Deployment)",
  };

  protected parametersSchema = z.object({
    domains: z
      .string()
      .optional()
      .describe(
        "Optional comma-separated list of specific documentation domains to query (ao, arweave, ario, hyperbeam, permaweb-glossary, wao). If not specified, domains will be automatically detected from the request.",
      ),
    includeExplanation: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether to include detailed code explanation with documentation sources and best practices (default: true)",
      ),
    userRequest: z
      .string()
      .min(1)
      .describe(
        "Natural language description of the desired AO process functionality. Examples: 'Create a token contract', 'Build a DAO voting system', 'Make a simple ping-pong handler'",
      ),
  });

  private readonly orchestrationService: LuaWorkflowOrchestrationService;
  private readonly parameterExtractionService: ParameterExtractionService;

  constructor(private context: ToolContext) {
    super();
    this.orchestrationService = new LuaWorkflowOrchestrationService();
    this.parameterExtractionService = new ParameterExtractionService();
  }

  /**
   * Generate parameter validation suggestions based on parameter type and name
   */
  static generateParameterValidationSuggestion(
    parameterName: string,
    parameterType: string,
  ): string {
    const templates = this.getValidationRuleTemplates();
    const lowerName = parameterName.toLowerCase();

    // Address-related parameters
    if (
      lowerName.includes("address") ||
      lowerName.includes("recipient") ||
      lowerName.includes("sender") ||
      lowerName.includes("owner")
    ) {
      if (parameterType === "address") {
        return `validation = { pattern = "${templates.address.pattern}" } -- ${templates.address.description}`;
      }
    }

    // Process ID parameters
    if (lowerName.includes("process") && lowerName.includes("id")) {
      return `validation = { pattern = "${templates.processId.pattern}" } -- ${templates.processId.description}`;
    }

    // Amount/quantity parameters
    if (
      lowerName.includes("amount") ||
      lowerName.includes("quantity") ||
      lowerName.includes("value") ||
      lowerName.includes("balance")
    ) {
      if (parameterType === "number") {
        return `validation = { min = ${templates.amount.min} } -- ${templates.amount.description}`;
      }
    }

    // Token ticker parameters
    if (lowerName.includes("ticker") || lowerName.includes("symbol")) {
      return `validation = { pattern = "${templates.tokenTicker.pattern}" } -- ${templates.tokenTicker.description}`;
    }

    // Percentage parameters
    if (
      lowerName.includes("percent") ||
      lowerName.includes("rate") ||
      lowerName.includes("fee")
    ) {
      if (parameterType === "number") {
        return `validation = { min = ${templates.percentage.min}, max = ${templates.percentage.max} } -- ${templates.percentage.description}`;
      }
    }

    // String parameters
    if (parameterType === "string") {
      return `validation = { minLength = ${templates.stringLength.minLength}, maxLength = ${templates.stringLength.maxLength} } -- ${templates.stringLength.description}`;
    }

    // Number parameters (default positive)
    if (parameterType === "number") {
      return `validation = { min = ${templates.positiveNumber.min} } -- ${templates.positiveNumber.description}`;
    }

    return "validation = {} -- Add appropriate validation rules for this parameter";
  }

  /**
   * Get standard validation rule templates for common parameter types
   */
  static getValidationRuleTemplates(): {
    address: { description: string; pattern: string };
    addressOptional: { description: string; pattern: string };
    amount: { description: string; min: number };
    commonEnums: {
      actions: string[];
      permissions: string[];
      statuses: string[];
    };
    percentage: { description: string; max: number; min: number };
    positiveNumber: { description: string; min: number };
    processId: { description: string; pattern: string };
    stringLength: { description: string; maxLength: number; minLength: number };
    tokenTicker: { description: string; pattern: string };
    walletAddress: { description: string; pattern: string };
  } {
    return {
      address: {
        description: "Standard Arweave address format validation",
        pattern: "^[a-zA-Z0-9_-]{43}$",
      },
      addressOptional: {
        description: "Optional Arweave address format validation",
        pattern: "^([a-zA-Z0-9_-]{43})?$",
      },
      amount: {
        description: "Non-negative amount validation for tokens/values",
        min: 0,
      },
      commonEnums: {
        actions: ["Transfer", "Mint", "Burn", "Approve", "Info", "Ping"],
        permissions: ["read", "write", "admin", "owner"],
        statuses: ["active", "inactive", "pending", "completed", "failed"],
      },
      percentage: {
        description: "Percentage value validation (0-100)",
        max: 100,
        min: 0,
      },
      positiveNumber: {
        description: "Positive number validation (greater than 0)",
        min: 1,
      },
      processId: {
        description: "AO process ID format validation",
        pattern: "^[a-zA-Z0-9_-]{43}$",
      },
      stringLength: {
        description: "Standard string length validation",
        maxLength: 256,
        minLength: 1,
      },
      tokenTicker: {
        description: "Token ticker format validation (2-10 uppercase letters)",
        pattern: "^[A-Z]{2,10}$",
      },
      walletAddress: {
        description: "Wallet address format validation",
        pattern: "^[a-zA-Z0-9_-]{43}$",
      },
    };
  }

  async execute(args: GenerateLuaProcessArgs): Promise<string> {
    try {
      // Parse domains if provided
      const requestedDomains = args.domains
        ? args.domains.split(",").map((d) => d.trim())
        : undefined;

      // Execute the complete workflow
      const workflowResult =
        await this.orchestrationService.orchestrateWorkflow(args.userRequest);

      // Validate ADP compliance of generated code
      const adpValidation = this.validateADPCompliance(
        workflowResult.codeResult.generatedCode,
      );

      // Build response based on includeExplanation flag
      const response = {
        success: true,
        timestamp: workflowResult.timestamp.toISOString(),
        workflow: {
          adpCompliance: adpValidation,
          analysis: {
            complexity: workflowResult.requirements.analysis.complexity,
            confidence: workflowResult.requirements.confidence,
            detectedPatterns:
              workflowResult.requirements.analysis.detectedPatterns,
            processType: workflowResult.requirements.analysis.processType,
            suggestedDomains:
              workflowResult.requirements.analysis.suggestedDomains,
          },
          code: {
            bestPractices: workflowResult.codeResult.bestPractices,
            generatedCode: workflowResult.codeResult.generatedCode,
            handlerPatterns: workflowResult.codeResult.handlerPatterns.map(
              (p) => ({
                description: p.description,
                name: p.name,
              }),
            ),
            usedTemplates: workflowResult.codeResult.usedTemplates,
          },
          documentation: {
            domains: Array.from(
              new Set(
                workflowResult.requirements.relevantDocs.map(
                  (doc) => doc.domain,
                ),
              ),
            ),
            sourcesFound: workflowResult.requirements.relevantDocs.length,
          },
          userRequest: args.userRequest,
        },
      };

      // Add explanation if requested
      if (args.includeExplanation) {
        (response.workflow as any).explanation = {
          codeBreakdown: workflowResult.explanation.codeBreakdown,
          overview: workflowResult.explanation.overview,
          relatedSources: workflowResult.explanation.relatedSources,
        };
      }

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return JSON.stringify(
        {
          error: {
            code: "WORKFLOW_GENERATION_FAILED",
            details: {
              timestamp: new Date().toISOString(),
              userRequest: args.userRequest,
            },
            message: `Failed to generate Lua process code: ${errorMessage}`,
          },
          success: false,
        },
        null,
        2,
      );
    }
  }

  /**
   * Extract validation blocks from handlers text, handling nested braces properly
   */
  private extractValidationBlocks(text: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    const regex = /validation\s*=\s*\{/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const startIndex = match.index;
      const openBraceIndex = startIndex + match[0].length - 1;

      // Find the matching closing brace
      let braceCount = 1;
      let currentIndex = openBraceIndex + 1;

      while (currentIndex < text.length && braceCount > 0) {
        if (text[currentIndex] === "{") {
          braceCount++;
        } else if (text[currentIndex] === "}") {
          braceCount--;
        }
        currentIndex++;
      }

      if (braceCount === 0) {
        const fullMatch = text.substring(startIndex, currentIndex);
        // Create a RegExpMatchArray-like object
        const matchArray = [fullMatch] as RegExpMatchArray;
        matchArray.index = startIndex;
        matchArray.input = text;
        matches.push(matchArray);
      }
    }

    return matches;
  }

  /**
   * Validate ADP compliance of generated Lua code with enhanced parameter checking
   */
  private validateADPCompliance(generatedCode: string): {
    checks: {
      hasCapabilities: boolean;
      hasHandlerRegistry: boolean;
      hasInfoHandler: boolean;
      hasParameterCrossReference: boolean;
      hasParameterDefinitions: boolean;
      hasParameterTypeValidation: boolean;
      hasPingHandler: boolean;
      hasProtocolVersion: boolean;
      hasValidationRules: boolean;
    };
    isCompliant: boolean;
    parameterCoverage: {
      handlersWithParameters: number;
      totalHandlers: number;
    };
    parameterValidation: {
      crossReferenceScore: number;
      typeValidationScore: number;
      validationRuleScore: number;
    };
    suggestions: string[];
    warnings: string[];
  } {
    const checks = {
      hasCapabilities: false,
      hasHandlerRegistry: false,
      hasInfoHandler: false,
      hasParameterCrossReference: false,
      hasParameterDefinitions: false,
      hasParameterTypeValidation: false,
      hasPingHandler: false,
      hasProtocolVersion: false,
      hasValidationRules: false,
    };
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for Info handler
    if (
      generatedCode.includes("Handlers.add('Info'") ||
      generatedCode.includes('Handlers.add("Info"')
    ) {
      checks.hasInfoHandler = true;
    } else {
      warnings.push("Missing Info handler for ADP compliance");
    }

    // Check for protocol version
    if (generatedCode.includes('protocolVersion = "1.0"')) {
      checks.hasProtocolVersion = true;
    } else {
      warnings.push("Missing protocolVersion field for ADP compliance");
    }

    // Check for handler registry
    if (generatedCode.includes("handlers =") && generatedCode.includes("{")) {
      checks.hasHandlerRegistry = true;
    } else {
      warnings.push("Missing handlers registry for ADP compliance");
    }

    // Check for capabilities
    if (
      generatedCode.includes("capabilities =") &&
      generatedCode.includes("supportsHandlerRegistry")
    ) {
      checks.hasCapabilities = true;
    } else {
      warnings.push("Missing capabilities object for ADP compliance");
    }

    // Check for Ping handler (useful for testing)
    if (
      generatedCode.includes("Handlers.add('Ping'") ||
      generatedCode.includes('Handlers.add("Ping"')
    ) {
      checks.hasPingHandler = true;
    } else {
      warnings.push("Missing Ping handler - recommended for ADP testing");
    }

    // Enhanced parameter validation
    const parameterCoverage = this.validateParameterDefinitions(
      generatedCode,
      warnings,
      suggestions,
    );
    checks.hasParameterDefinitions = parameterCoverage.coverage > 0.5; // At least 50% handlers have parameters

    // Add new parameter-specific validation
    const parameterTypeValidation = this.validateParameterTypes(
      generatedCode,
      warnings,
      suggestions,
    );
    checks.hasParameterTypeValidation =
      parameterTypeValidation.typeValidationScore > 0.7;

    const crossReferenceValidation = this.validateParameterCrossReference(
      generatedCode,
      warnings,
      suggestions,
    );
    checks.hasParameterCrossReference =
      crossReferenceValidation.crossReferenceScore > 0.8;

    const validationRuleCheck = this.validateValidationRules(
      generatedCode,
      warnings,
      suggestions,
    );
    checks.hasValidationRules = validationRuleCheck.validationRuleScore > 0.6;

    const parameterValidation = {
      crossReferenceScore: crossReferenceValidation.crossReferenceScore,
      typeValidationScore: parameterTypeValidation.typeValidationScore,
      validationRuleScore: validationRuleCheck.validationRuleScore,
    };

    const isCompliant =
      checks.hasInfoHandler &&
      checks.hasProtocolVersion &&
      checks.hasHandlerRegistry &&
      checks.hasCapabilities &&
      checks.hasParameterDefinitions &&
      checks.hasParameterTypeValidation &&
      checks.hasParameterCrossReference;

    return {
      checks,
      isCompliant,
      parameterCoverage,
      parameterValidation,
      suggestions,
      warnings,
    };
  }

  /**
   * Validate cross-reference between code usage and ADP parameter declarations
   */
  private validateParameterCrossReference(
    generatedCode: string,
    warnings: string[],
    suggestions: string[],
  ): {
    crossReferenceScore: number;
  } {
    // Extract actual parameter usage from Lua code
    const extractedParameters =
      this.parameterExtractionService.extractParametersFromCode(generatedCode);

    // Extract declared parameters from ADP metadata
    const declaredParameters = new Map<string, Set<string>>();

    // Extract the complete handlers section by counting braces to ensure we get the full array
    const handlersStart = generatedCode.indexOf("handlers = {");
    let handlersJsonMatch: null | RegExpMatchArray = null;

    if (handlersStart !== -1) {
      let braceCount = 0;
      let i = handlersStart + "handlers = ".length;
      let foundStart = false;
      let endPosition = -1;

      while (i < generatedCode.length) {
        const char = generatedCode[i];
        if (char === "{") {
          braceCount++;
          foundStart = true;
        } else if (char === "}") {
          braceCount--;
          if (foundStart && braceCount === 0) {
            endPosition = i + 1;
            break;
          }
        }
        i++;
      }

      if (endPosition !== -1) {
        const handlersText = generatedCode.substring(
          handlersStart,
          endPosition,
        );
        handlersJsonMatch = [handlersText];
      }
    }

    if (handlersJsonMatch) {
      const handlersText = handlersJsonMatch[0];

      // Parse individual handlers using a simpler approach that splits on handler boundaries
      // First, remove the outer handlers = { ... } wrapper
      const innerHandlersContent = handlersText
        .replace(/^handlers\s*=\s*\{\s*/, "")
        .replace(/\s*\}\s*$/, "");

      // Now split handlers by looking for complete { ... } blocks that contain "action ="
      const handlerObjects: Array<{ action: string; text: string }> = [];

      // Split the content and find each handler block
      let currentPos = 0;
      while (currentPos < innerHandlersContent.length) {
        // Find the next opening brace that starts a handler
        const openBracePos = innerHandlersContent.indexOf("{", currentPos);
        if (openBracePos === -1) break;

        // Count braces to find the matching closing brace
        let braceCount = 1;
        let closeBracePos = openBracePos + 1;

        while (closeBracePos < innerHandlersContent.length && braceCount > 0) {
          if (innerHandlersContent[closeBracePos] === "{") {
            braceCount++;
          } else if (innerHandlersContent[closeBracePos] === "}") {
            braceCount--;
          }
          closeBracePos++;
        }

        if (braceCount === 0) {
          const handlerText = innerHandlersContent.substring(
            openBracePos,
            closeBracePos,
          );

          // Check if this block contains an action (i.e., it's a handler object)
          const actionMatch = handlerText.match(
            /action\s*=\s*["']([^"']+)["']/,
          );
          if (actionMatch) {
            handlerObjects.push({
              action: actionMatch[1],
              text: handlerText,
            });
          }

          currentPos = closeBracePos;
        } else {
          // If we can't find matching braces, move past this position
          currentPos = openBracePos + 1;
        }
      }

      // Now extract parameters from each complete handler object
      for (const handler of handlerObjects) {
        const paramNames = new Set<string>();

        // Look for parameters block within this specific handler
        // Use improved regex that properly handles nested braces in parameters array
        let parameterBlockMatch = null;
        const paramStart = handler.text.indexOf("parameters = {");

        if (paramStart !== -1) {
          // Find the complete parameters block by counting braces
          let braceCount = 0;
          let i = paramStart + "parameters = ".length;
          let foundStart = false;
          let endPosition = -1;

          while (i < handler.text.length) {
            const char = handler.text[i];
            if (char === "{") {
              braceCount++;
              foundStart = true;
            } else if (char === "}") {
              braceCount--;
              if (foundStart && braceCount === 0) {
                endPosition = i + 1;
                break;
              }
            }
            i++;
          }

          if (endPosition !== -1) {
            const parameterBlock = handler.text.substring(
              paramStart + "parameters = {".length,
              endPosition - 1,
            );
            parameterBlockMatch = [null, parameterBlock]; // Match format for compatibility
          }
        }

        if (parameterBlockMatch && parameterBlockMatch[1]) {
          const parameterBlock = parameterBlockMatch[1];
          // Extract all parameter names from this block
          const paramMatches = [
            ...parameterBlock.matchAll(/name\s*=\s*["']([^"']+)["']/g),
          ];
          for (const paramMatch of paramMatches) {
            paramNames.add(paramMatch[1]);
          }
        }

        declaredParameters.set(handler.action, paramNames);
      }
    }

    let totalChecks = 0;
    let passedChecks = 0;

    // Check for unused declared parameters
    for (const [actionName, declaredParams] of declaredParameters.entries()) {
      const usedParams = extractedParameters.get(actionName);
      const usedParamNames = new Set(usedParams?.map((p) => p.name) || []);

      for (const declaredParam of declaredParams) {
        totalChecks++;
        if (usedParamNames.has(declaredParam)) {
          passedChecks++;
        } else {
          warnings.push(
            `Parameter '${declaredParam}' declared in '${actionName}' handler metadata but not used in code`,
          );
          suggestions.push(
            `Remove unused parameter '${declaredParam}' from '${actionName}' handler metadata or implement its usage in the handler code`,
          );
        }
      }
    }

    // Check for undeclared used parameters
    for (const [actionName, usedParams] of extractedParameters.entries()) {
      const declaredParams = declaredParameters.get(actionName) || new Set();

      for (const usedParam of usedParams) {
        totalChecks++;
        if (declaredParams.has(usedParam.name)) {
          passedChecks++;
        } else {
          warnings.push(
            `Parameter '${usedParam.name}' used in '${actionName}' handler but not declared in ADP metadata`,
          );
          suggestions.push(
            `Add parameter definition for '${usedParam.name}' in '${actionName}' handler metadata with type, required, and description fields`,
          );
        }
      }
    }

    const crossReferenceScore =
      totalChecks > 0 ? passedChecks / totalChecks : 1;

    if (crossReferenceScore < 0.8 && totalChecks > 0) {
      suggestions.push(
        "Improve parameter cross-reference consistency by ensuring all used parameters are declared in ADP metadata and removing unused declarations",
      );
    }

    return { crossReferenceScore };
  }

  /**
   * Validate parameter definitions in ADP handler metadata
   */
  private validateParameterDefinitions(
    generatedCode: string,
    warnings: string[],
    suggestions: string[],
  ): {
    coverage: number;
    handlersWithParameters: number;
    totalHandlers: number;
  } {
    // Extract parameters from the generated code
    const extractedParameters =
      this.parameterExtractionService.extractParametersFromCode(generatedCode);

    // Count total handlers and handlers with parameters
    let totalHandlers = 0;
    let handlersWithParameters = 0;
    let handlersWithDefinedParams = 0;

    // Count handlers from code
    const handlerMatches = generatedCode.matchAll(
      /Handlers\.add\(\s*['"](.*?)['"].*?hasMatchingTag\(\s*['"]Action['"],\s*['"](.*?)['"]\)/gs,
    );

    const detectedHandlers = new Set<string>();
    for (const match of handlerMatches) {
      const actionValue = match[2];
      if (actionValue && actionValue !== "Info" && actionValue !== "Ping") {
        detectedHandlers.add(actionValue);
        totalHandlers++;

        // Check if this handler has extracted parameters
        const params = extractedParameters.get(actionValue);
        if (params && params.length > 0) {
          handlersWithParameters++;
        }
      }
    }

    // Check for parameter definitions in the Lua metadata (handlers table)
    // Extract the complete handlers section by counting braces to ensure we get the full array
    const handlersStart = generatedCode.indexOf("handlers = {");
    let handlersJsonMatch: null | RegExpMatchArray = null;

    if (handlersStart !== -1) {
      let braceCount = 0;
      let i = handlersStart + "handlers = ".length;
      let foundStart = false;
      let endPosition = -1;

      while (i < generatedCode.length) {
        const char = generatedCode[i];
        if (char === "{") {
          braceCount++;
          foundStart = true;
        } else if (char === "}") {
          braceCount--;
          if (foundStart && braceCount === 0) {
            endPosition = i + 1;
            break;
          }
        }
        i++;
      }

      if (endPosition !== -1) {
        const handlersText = generatedCode.substring(
          handlersStart,
          endPosition,
        );
        handlersJsonMatch = [handlersText];
      }
    }
    if (handlersJsonMatch) {
      const handlersText = handlersJsonMatch[0];

      for (const handlerName of detectedHandlers) {
        // Check if this handler has parameters defined in the metadata
        const handlerPattern = new RegExp(
          `action\\s*=\\s*["']${handlerName}["'][\\s\\S]*?parameters\\s*=`,
          "i",
        );
        if (handlerPattern.test(handlersText)) {
          handlersWithDefinedParams++;
        } else {
          warnings.push(
            `Handler '${handlerName}' missing parameter definitions in ADP metadata`,
          );
          suggestions.push(
            `Add parameters array to handler '${handlerName}' with proper name, type, required, and description fields`,
          );
        }
      }
    }

    // Calculate coverage based on both extracted parameters and defined parameters
    const coverage =
      totalHandlers > 0 ? handlersWithDefinedParams / totalHandlers : 1;

    if (coverage < 0.5) {
      warnings.push(
        `Low parameter definition coverage: ${(coverage * 100).toFixed(1)}% of handlers have parameter definitions`,
      );
      suggestions.push(
        "Improve parameter definition coverage by adding parameters arrays to handlers that use message tags or data fields",
      );
    }

    if (handlersWithParameters > handlersWithDefinedParams) {
      warnings.push(
        `${handlersWithParameters - handlersWithDefinedParams} handlers use parameters but lack ADP parameter definitions`,
      );
      suggestions.push(
        "Add parameter definitions to handlers that extract data from msg.Tags or msg.Data for full ADP compliance",
      );
    }

    return {
      coverage,
      handlersWithParameters: handlersWithDefinedParams,
      totalHandlers,
    };
  }

  /**
   * Validate parameter types against ADP specification
   */
  private validateParameterTypes(
    generatedCode: string,
    warnings: string[],
    suggestions: string[],
  ): {
    typeValidationScore: number;
  } {
    const validADPTypes = ["string", "number", "boolean", "address", "json"];
    let validTypeCount = 0;
    let totalParameterCount = 0;

    // Extract parameter definitions from handlers metadata
    // Use a more robust approach for nested structures
    let handlersJsonMatch = generatedCode.match(
      /handlers\s*=\s*\{[\s\S]*?\n\s*\}(?=\s*[,\n]|$)/,
    );

    // Fallback to broader match if the first one is incomplete
    if (!handlersJsonMatch || !handlersJsonMatch[0].includes("}")) {
      handlersJsonMatch = generatedCode.match(
        /handlers\s*=\s*\{[\s\S]*\}[\s\S]*?\}/,
      );
    }

    if (handlersJsonMatch) {
      const handlersText = handlersJsonMatch[0];

      // Find all parameter type declarations
      const typeMatches = [
        ...handlersText.matchAll(/type\s*=\s*["']([^"']+)["']/g),
      ];

      for (const match of typeMatches) {
        totalParameterCount++;
        const paramType = match[1];

        if (validADPTypes.includes(paramType)) {
          validTypeCount++;
        } else {
          warnings.push(
            `Invalid parameter type "${paramType}" - must be one of: ${validADPTypes.join(", ")}`,
          );
          suggestions.push(
            `Replace parameter type "${paramType}" with a valid ADP type: ${validADPTypes.join(", ")}`,
          );
        }
      }
    }

    const typeValidationScore =
      totalParameterCount > 0 ? validTypeCount / totalParameterCount : 1;

    if (typeValidationScore < 1 && totalParameterCount > 0) {
      suggestions.push(
        "Ensure all parameter types conform to ADP specification: string, number, boolean, address, json",
      );
    }

    return { typeValidationScore };
  }

  /**
   * Validate parameter validation rules format and consistency
   */
  private validateValidationRules(
    generatedCode: string,
    warnings: string[],
    suggestions: string[],
  ): {
    validationRuleScore: number;
  } {
    let totalValidationRules = 0;
    let validRules = 0;

    const handlersJsonMatch = generatedCode.match(
      /handlers\s*=\s*\{[\s\S]*?\}(?=\s*[,\n]|$)/,
    );

    if (handlersJsonMatch) {
      const handlersText = handlersJsonMatch[0];

      // Find parameters with validation rules
      // Use a more robust approach that handles nested braces properly
      const validationMatches = this.extractValidationBlocks(handlersText);

      for (const validationMatch of validationMatches) {
        totalValidationRules++;
        const validationBlock = validationMatch[0];

        // Check for valid validation rule patterns
        const hasPattern = /pattern\s*=/.test(validationBlock);
        const hasMin = /min\s*=/.test(validationBlock);
        const hasMax = /max\s*=/.test(validationBlock);
        const hasEnum = /enum\s*=/.test(validationBlock);

        // Validate address patterns if present
        if (hasPattern) {
          const patternMatch = validationBlock.match(
            /pattern\s*=\s*["']([^"']+)["']/,
          );
          if (patternMatch) {
            const pattern = patternMatch[1];
            // Check for common address pattern format
            if (
              pattern.includes("^[a-zA-Z0-9_-]{43}$") ||
              pattern.includes("address")
            ) {
              validRules++;
            } else {
              warnings.push(
                `Validation pattern "${pattern}" may not be appropriate for address validation`,
              );
              suggestions.push(
                `Use standard address validation pattern: "^[a-zA-Z0-9_-]{43}$" for Arweave addresses`,
              );
            }
          }
        } else if (hasMin || hasMax || hasEnum) {
          validRules++; // Other validation types are acceptable
        }
      }

      // Check for address parameters without validation and provide specific suggestions
      const paramBlocks = [
        ...handlersText.matchAll(
          /\{\s*[\s\S]*?name\s*=\s*["']([^"']+)["'][\s\S]*?type\s*=\s*["']([^"']+)["'][\s\S]*?\}/g,
        ),
      ];
      for (const paramMatch of paramBlocks) {
        const [fullMatch, paramName, paramType] = paramMatch;

        if (paramType === "address" && !/validation\s*=/.test(fullMatch)) {
          warnings.push(
            `Address parameter '${paramName}' missing validation pattern`,
          );
          const suggestion =
            GenerateLuaProcessCommand.generateParameterValidationSuggestion(
              paramName,
              paramType,
            );
          suggestions.push(
            `Add validation for parameter '${paramName}': ${suggestion}`,
          );
        }

        // Check other parameter types that commonly need validation
        if (
          (paramType === "number" || paramType === "string") &&
          !/validation\s*=/.test(fullMatch)
        ) {
          const suggestion =
            GenerateLuaProcessCommand.generateParameterValidationSuggestion(
              paramName,
              paramType,
            );
          suggestions.push(
            `Consider adding validation for parameter '${paramName}': ${suggestion}`,
          );
        }
      }
    }

    const validationRuleScore =
      totalValidationRules > 0 ? validRules / totalValidationRules : 0.8; // Default good score if no rules

    if (validationRuleScore < 0.6 && totalValidationRules > 0) {
      suggestions.push(
        "Improve validation rules by adding appropriate patterns for address types and min/max constraints for numbers",
      );
    }

    return { validationRuleScore };
  }
}
