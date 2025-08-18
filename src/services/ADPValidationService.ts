import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
  HandlerMetadata,
  HandlerParameter,
} from "./DocumentationProtocolService.js";

/**
 * Performance benchmarks for ADP compliance
 */
export interface ADPPerformanceBenchmark {
  codeGenerationTime: number;
  codeSize: number;
  handlerCount: number;
  templateLoadTime: number;
  totalTime: number;
  validationTime: number;
}

/**
 * Validation result for ADP compliance
 */
export interface ADPValidationResult {
  checks: {
    hasCapabilities: boolean;
    hasCompleteMetadata: boolean;
    hasHandlers: boolean;
    hasProtocolVersion: boolean;
    hasRequiredHandlers: boolean;
    hasValidHandlerStructure: boolean;
    hasValidVersion: boolean;
  };
  errors: string[];
  isValid: boolean;
  score: number; // 0-100 compliance score
  warnings: string[];
}

/**
 * ADP Validation Service
 *
 * Provides comprehensive validation and quality assurance for AO Documentation Protocol
 * compliance. This service validates templates, generated code, and process metadata
 * against the ADP v1.0 specification.
 */
export class ADPValidationService {
  private static readonly RECOMMENDED_HANDLERS = ["Ping"];
  private static readonly REQUIRED_ADP_VERSION = "1.0";
  private static readonly REQUIRED_HANDLERS = ["Info"];

  /**
   * Benchmark ADP template performance
   */
  static async benchmarkADPTemplate(
    templateCode: string,
  ): Promise<ADPPerformanceBenchmark> {
    const startTime = performance.now();

    // Benchmark template loading
    const loadStart = performance.now();
    // Simulate template processing
    const codeSize = templateCode.length;
    const loadEnd = performance.now();

    // Benchmark validation
    const validationStart = performance.now();
    const validation = this.validateADPTemplate(templateCode);
    const validationEnd = performance.now();

    // Benchmark code generation (simulated)
    const generationStart = performance.now();
    const handlerMatches = templateCode.match(/Handlers\.add/g);
    const handlerCount = handlerMatches ? handlerMatches.length : 0;
    const generationEnd = performance.now();

    const totalTime = performance.now() - startTime;

    return {
      codeGenerationTime: generationEnd - generationStart,
      codeSize,
      handlerCount,
      templateLoadTime: loadEnd - loadStart,
      totalTime,
      validationTime: validationEnd - validationStart,
    };
  }

  /**
   * Get ADP compliance report for a process
   */
  static generateComplianceReport(response: ExtendedInfoResponse): {
    recommendations: string[];
    summary: string;
    validation: ADPValidationResult;
  } {
    const validation = this.validateADPResponse(response);
    const recommendations: string[] = [];

    // Generate recommendations based on validation results
    if (!validation.checks.hasValidVersion) {
      recommendations.push("Update to ADP v1.0 protocol specification");
    }

    if (!validation.checks.hasRequiredHandlers) {
      recommendations.push("Implement required Info handler");
    }

    if (!validation.checks.hasCompleteMetadata) {
      recommendations.push(
        "Complete capabilities metadata with all required fields",
      );
    }

    if (validation.warnings.some((w) => w.includes("Ping"))) {
      recommendations.push(
        "Add Ping handler for testing and connectivity verification",
      );
    }

    if (validation.warnings.some((w) => w.includes("description"))) {
      recommendations.push(
        "Add descriptions to all handlers for better documentation",
      );
    }

    // Generate summary
    let summary: string;
    if (validation.score >= 90) {
      summary = `Excellent ADP compliance (${validation.score}%). Process is fully compatible with ADP v1.0.`;
    } else if (validation.score >= 70) {
      summary = `Good ADP compliance (${validation.score}%). Minor improvements recommended.`;
    } else if (validation.score >= 50) {
      summary = `Partial ADP compliance (${validation.score}%). Several issues need attention.`;
    } else {
      summary = `Poor ADP compliance (${validation.score}%). Major improvements required.`;
    }

    return {
      recommendations,
      summary,
      validation,
    };
  }

  /**
   * Utility to fix common ADP compliance issues in code
   */
  static suggestADPFixes(
    validation: ADPValidationResult,
    code: string,
  ): string[] {
    const suggestions: string[] = [];

    if (!validation.checks.hasProtocolVersion) {
      suggestions.push('Add protocolVersion = "1.0" to your Info response');
    }

    if (!validation.checks.hasRequiredHandlers) {
      suggestions.push(
        "Implement an Info handler with Handlers.add('Info', ...)",
      );
    }

    if (!validation.checks.hasHandlers) {
      suggestions.push(
        "Add handlers array to your Info response with handler metadata",
      );
    }

    if (!validation.checks.hasCapabilities) {
      suggestions.push(
        "Add capabilities object with supportsHandlerRegistry, supportsParameterValidation, and supportsExamples",
      );
    }

    if (!code.includes("json.encode")) {
      suggestions.push("Use json.encode() to serialize your Info response");
    }

    return suggestions;
  }

  /**
   * Validate ADP compliance of a process Info response
   */
  static validateADPResponse(
    response: ExtendedInfoResponse,
  ): ADPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks = {
      hasCapabilities: false,
      hasCompleteMetadata: false,
      hasHandlers: false,
      hasProtocolVersion: false,
      hasRequiredHandlers: false,
      hasValidHandlerStructure: false,
      hasValidVersion: false,
    };

    // Check protocol version
    if (response.protocolVersion) {
      checks.hasProtocolVersion = true;
      if (response.protocolVersion === this.REQUIRED_ADP_VERSION) {
        checks.hasValidVersion = true;
      } else {
        errors.push(
          `Invalid protocol version: expected "${this.REQUIRED_ADP_VERSION}", got "${response.protocolVersion}"`,
        );
      }
    } else {
      errors.push("Missing protocolVersion field");
    }

    // Check handlers array
    if (response.handlers && Array.isArray(response.handlers)) {
      checks.hasHandlers = true;

      // Check required handlers
      const handlerActions = response.handlers.map((h) => h.action);
      const missingRequired = this.REQUIRED_HANDLERS.filter(
        (required) => !handlerActions.includes(required),
      );
      if (missingRequired.length === 0) {
        checks.hasRequiredHandlers = true;
      } else {
        errors.push(`Missing required handlers: ${missingRequired.join(", ")}`);
      }

      // Check recommended handlers
      const missingRecommended = this.RECOMMENDED_HANDLERS.filter(
        (recommended) => !handlerActions.includes(recommended),
      );
      if (missingRecommended.length > 0) {
        warnings.push(
          `Missing recommended handlers: ${missingRecommended.join(", ")}`,
        );
      }

      // Validate handler structure
      const handlerValidation = this.validateHandlerStructure(
        response.handlers,
      );
      if (handlerValidation.isValid) {
        checks.hasValidHandlerStructure = true;
      } else {
        errors.push(...handlerValidation.errors);
        warnings.push(...handlerValidation.warnings);
      }
    } else {
      errors.push("Missing or invalid handlers array");
    }

    // Check capabilities
    if (response.capabilities) {
      checks.hasCapabilities = true;
      if (
        response.capabilities.supportsHandlerRegistry &&
        response.capabilities.supportsParameterValidation &&
        response.capabilities.supportsExamples
      ) {
        checks.hasCompleteMetadata = true;
      } else {
        warnings.push("Incomplete capabilities metadata");
      }
    } else {
      warnings.push("Missing capabilities object");
    }

    // Calculate compliance score
    const checksPassed = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = Math.round((checksPassed / totalChecks) * 100);

    return {
      checks,
      errors,
      isValid: errors.length === 0,
      score,
      warnings,
    };
  }

  /**
   * Validate an ADP template for correctness and completeness
   */
  static validateADPTemplate(templateCode: string): ADPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks = {
      hasCapabilities: false,
      hasCompleteMetadata: false,
      hasHandlers: false,
      hasProtocolVersion: false,
      hasRequiredHandlers: false,
      hasValidHandlerStructure: false,
      hasValidVersion: false,
    };

    // Check for template structure
    if (!templateCode.includes("PROCESS_NAME")) {
      warnings.push("Template missing PROCESS_NAME customization variable");
    }

    if (!templateCode.includes("PROCESS_DESCRIPTION")) {
      warnings.push(
        "Template missing PROCESS_DESCRIPTION customization variable",
      );
    }

    if (!templateCode.includes("PROCESS_HANDLERS")) {
      errors.push("Template missing PROCESS_HANDLERS array");
    } else {
      checks.hasHandlers = true;
      checks.hasValidHandlerStructure = true;
    }

    // Check for validation function
    if (templateCode.includes("validateADPCompliance")) {
      checks.hasCompleteMetadata = true;
    } else {
      warnings.push("Template missing ADP compliance validation function");
    }

    // Validate as regular Lua code
    const luaValidation = this.validateLuaCode(templateCode);
    errors.push(
      ...luaValidation.errors.filter((e) => !e.includes("PROCESS_NAME")),
    );
    warnings.push(...luaValidation.warnings);

    // Merge checks
    Object.keys(luaValidation.checks).forEach((key) => {
      if (luaValidation.checks[key as keyof typeof luaValidation.checks]) {
        checks[key as keyof typeof checks] = true;
      }
    });

    // Calculate score
    const checksPassed = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = Math.round((checksPassed / totalChecks) * 100);

    return {
      checks,
      errors,
      isValid: errors.length === 0,
      score,
      warnings,
    };
  }

  /**
   * Validate Lua code for ADP compliance
   */
  static validateLuaCode(code: string): ADPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks = {
      hasCapabilities: false,
      hasCompleteMetadata: false,
      hasHandlers: false,
      hasProtocolVersion: false,
      hasRequiredHandlers: false,
      hasValidHandlerStructure: false,
      hasValidVersion: false,
    };

    // Check for Info handler
    if (
      code.includes("Handlers.add('Info'") ||
      code.includes('Handlers.add("Info"')
    ) {
      checks.hasRequiredHandlers = true;
    } else {
      errors.push("Missing Info handler implementation");
    }

    // Check for protocol version
    if (code.includes('protocolVersion = "1.0"')) {
      checks.hasProtocolVersion = true;
      checks.hasValidVersion = true;
    } else {
      errors.push('Missing or invalid protocolVersion = "1.0"');
    }

    // Check for handlers metadata
    if (code.includes("handlers =") && code.includes("[")) {
      checks.hasHandlers = true;
      checks.hasValidHandlerStructure = true;
    } else {
      errors.push("Missing handlers metadata array");
    }

    // Check for capabilities
    if (code.includes("capabilities =")) {
      checks.hasCapabilities = true;
      if (
        code.includes("supportsHandlerRegistry") &&
        code.includes("supportsParameterValidation") &&
        code.includes("supportsExamples")
      ) {
        checks.hasCompleteMetadata = true;
      } else {
        warnings.push("Incomplete capabilities metadata");
      }
    } else {
      warnings.push("Missing capabilities object");
    }

    // Check for JSON encoding
    if (!code.includes("json.encode")) {
      errors.push("Missing json.encode for Info response");
    }

    // Check for recommended patterns
    if (
      !(
        code.includes("Handlers.add('Ping'") ||
        code.includes('Handlers.add("Ping"')
      )
    ) {
      warnings.push("Missing recommended Ping handler for testing");
    }

    // Calculate score
    const checksPassed = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = Math.round((checksPassed / totalChecks) * 100);

    return {
      checks,
      errors,
      isValid: errors.length === 0,
      score,
      warnings,
    };
  }

  /**
   * Validate handler parameters for completeness
   */
  private static validateHandlerParameters(
    parameters: HandlerParameter[],
    handlerPrefix: string,
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const prefix = `${handlerPrefix} parameter ${i + 1} (${param.name || "unnamed"})`;

      // Check required fields
      if (!param.name) {
        errors.push(`${prefix}: Missing name field`);
      }

      if (!param.type) {
        errors.push(`${prefix}: Missing type field`);
      } else if (
        !["address", "boolean", "json", "number", "string"].includes(param.type)
      ) {
        errors.push(`${prefix}: Invalid type "${param.type}"`);
      }

      if (typeof param.required !== "boolean") {
        errors.push(`${prefix}: Missing or invalid required field`);
      }

      // Check optional but recommended fields
      if (!param.description) {
        warnings.push(`${prefix}: Missing description`);
      }

      // Validate validation rules if present
      if (param.validation) {
        if (param.validation.pattern && param.type !== "string") {
          warnings.push(
            `${prefix}: Pattern validation only valid for string types`,
          );
        }

        if (
          (param.validation.min !== undefined ||
            param.validation.max !== undefined) &&
          param.type !== "number"
        ) {
          warnings.push(
            `${prefix}: Min/max validation only valid for number types`,
          );
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate handler structure for completeness and correctness
   */
  private static validateHandlerStructure(handlers: HandlerMetadata[]): {
    errors: string[];
    isValid: boolean;
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i];
      const prefix = `Handler ${i + 1} (${handler.action || "unnamed"})`;

      // Check required fields
      if (!handler.action) {
        errors.push(`${prefix}: Missing action field`);
      }

      if (
        !handler.pattern ||
        !Array.isArray(handler.pattern) ||
        handler.pattern.length === 0
      ) {
        errors.push(`${prefix}: Missing or invalid pattern array`);
      }

      // Check optional but recommended fields
      if (!handler.description) {
        warnings.push(`${prefix}: Missing description`);
      }

      if (!handler.category) {
        warnings.push(`${prefix}: Missing category`);
      } else if (!["core", "custom", "utility"].includes(handler.category)) {
        warnings.push(`${prefix}: Invalid category "${handler.category}"`);
      }

      // Validate parameters if present
      if (handler.parameters) {
        const paramValidation = this.validateHandlerParameters(
          handler.parameters,
          prefix,
        );
        errors.push(...paramValidation.errors);
        warnings.push(...paramValidation.warnings);
      }
    }

    return {
      errors,
      isValid: errors.length === 0,
      warnings,
    };
  }
}
