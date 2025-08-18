import type {
  ParameterSuggestion,
  ValidationError,
} from "../types/unified-communication.js";
import type { HandlerMetadata } from "./DocumentationProtocolService.js";

export class ParameterSuggestionService {
  /**
   * Detect request structure type and classify processing strategy
   */
  public static classifyRequestType(request: string): {
    confidence: number;
    processingStrategy: "hybrid" | "nlp_processing" | "parameter_extraction";
    reasoning: string;
    type: "mixed" | "natural_language" | "structured";
  } {
    const structuredIndicators = [
      /\w+\s*[=:]\s*\w+/g, // key=value or key: value patterns
      /\{\s*"\w+"\s*:\s*"[^"]*"\s*\}/g, // JSON-like structures
      /--\w+/g, // CLI flag patterns
      /"[^"]*"\s*:\s*"[^"]*"/g, // Quoted key-value pairs
    ];

    const naturalLanguageIndicators = [
      /please\s+\w+/i,
      /can\s+you\s+\w+/i,
      /i\s+want\s+to\s+\w+/i,
      /help\s+me\s+\w+/i,
      /\b(send|transfer|get|check)\s+\d+\s+\w+\s+(to|from)\s+\w+/i,
      /what\s+is\s+my\s+\w+/i,
    ];

    let structuredScore = 0;
    let nlScore = 0;

    // Count structured indicators
    for (const pattern of structuredIndicators) {
      const matches = request.match(pattern);
      if (matches) {
        structuredScore += matches.length * 0.3;
      }
    }

    // Count natural language indicators
    for (const pattern of naturalLanguageIndicators) {
      const matches = request.match(pattern);
      if (matches) {
        nlScore += matches.length * 0.4;
      }
    }

    // Analyze word patterns
    const words = request.split(/\s+/);
    const hasCompleteVariableSentence =
      words.length > 5 && /^[A-Z]/.test(request);
    const hasKeyValuePairs = request.includes("=") || request.includes(":");

    if (hasCompleteVariableSentence) nlScore += 0.3;
    if (hasKeyValuePairs) structuredScore += 0.4;

    // Determine classification
    const totalScore = structuredScore + nlScore;
    const structuredRatio = totalScore > 0 ? structuredScore / totalScore : 0;
    const nlRatio = totalScore > 0 ? nlScore / totalScore : 0.5; // Default to NL

    let type: "mixed" | "natural_language" | "structured";
    let processingStrategy:
      | "hybrid"
      | "nlp_processing"
      | "parameter_extraction";
    let confidence: number;
    let reasoning: string;

    if (structuredRatio > 0.7) {
      type = "structured";
      processingStrategy = "parameter_extraction";
      confidence = structuredRatio;
      reasoning =
        "Request contains explicit parameter structures and key-value patterns";
    } else if (nlRatio > 0.7) {
      type = "natural_language";
      processingStrategy = "nlp_processing";
      confidence = nlRatio;
      reasoning =
        "Request uses conversational language and natural sentence structures";
    } else {
      type = "mixed";
      processingStrategy = "hybrid";
      confidence = Math.max(structuredRatio, nlRatio);
      reasoning =
        "Request contains both structured and natural language elements";
    }

    return {
      confidence,
      processingStrategy,
      reasoning,
      type,
    };
  }

  /**
   * Extract parameters using optimal strategy based on request classification
   */
  public static extractParametersIntelligently(
    request: string,
    handler: HandlerMetadata,
    requestClassification: ReturnType<
      typeof ParameterSuggestionService.classifyRequestType
    >,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    if (!handler.parameters) {
      return parameters;
    }

    switch (requestClassification.processingStrategy) {
      case "hybrid": {
        // Try both methods and merge results, prioritizing structured extraction
        const structured = this.extractStructuredParameters(request, handler);
        const nlp = this.extractNaturalLanguageParameters(request, handler);
        return { ...nlp, ...structured }; // Structured overwrites NLP
      }

      case "nlp_processing":
        return this.extractNaturalLanguageParameters(request, handler);

      case "parameter_extraction":
        return this.extractStructuredParameters(request, handler);

      default:
        return this.extractNaturalLanguageParameters(request, handler);
    }
  }

  /**
   * Generate contextual help using ADP documentation
   */
  public static generateParameterGuidance(
    handler: HandlerMetadata,
    missingParameters: string[],
  ): Array<{
    examples: string[];
    guidance: string;
    parameter: string;
    validationRules: string[];
  }> {
    if (!handler.parameters) {
      return [];
    }

    return handler.parameters
      .filter((param) => missingParameters.includes(param.name))
      .map((param) => ({
        examples: param.examples || [],
        guidance: param.description || "",
        parameter: param.name,
        validationRules: this.generateValidationRules({
          name: param.name,
          type: param.type,
          validation: param.validation
            ? JSON.stringify(param.validation)
            : undefined,
        }),
      }));
  }

  /**
   * Generate parameter suggestions using ADP metadata to guide users on required fields
   */
  public static generateParameterSuggestions(
    handler: HandlerMetadata,
    currentParameters: Record<string, unknown>,
  ): ParameterSuggestion[] {
    const suggestions: ParameterSuggestion[] = [];

    if (!handler.parameters) {
      return suggestions;
    }

    for (const param of handler.parameters) {
      // Check if parameter is missing or has invalid value
      const currentValue = currentParameters[param.name];
      const isMissing =
        currentValue === undefined ||
        currentValue === null ||
        currentValue === "";
      const isRequired = param.required;

      if (isMissing && isRequired) {
        suggestions.push({
          description: param.description || "",
          examples: param.examples || [],
          name: param.name,
          required: true,
          type: param.type,
          validationRules: this.generateValidationRules({
            name: param.name,
            type: param.type,
            validation: param.validation
              ? JSON.stringify(param.validation)
              : undefined,
          }),
        });
      } else if (isMissing && !isRequired) {
        suggestions.push({
          description: param.description || "",
          examples: param.examples || [],
          name: param.name,
          required: false,
          type: param.type,
          validationRules: this.generateValidationRules({
            name: param.name,
            type: param.type,
            validation: param.validation
              ? JSON.stringify(param.validation)
              : undefined,
          }),
        });
      }
    }

    return suggestions.sort((a, b) => {
      // Sort required parameters first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Validate parameters against ADP metadata and provide detailed feedback
   */
  public static validateParametersAgainstADP(
    handler: HandlerMetadata,
    parameters: Record<string, unknown>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!handler.parameters) {
      return errors;
    }

    // Check for missing required parameters
    for (const param of handler.parameters) {
      const value = parameters[param.name];
      const isEmpty = value === undefined || value === null || value === "";

      if (param.required && isEmpty) {
        errors.push({
          field: param.name,
          message: `Required parameter '${param.name}' is missing`,
          severity: "error",
          suggestion: `Please provide a value for '${param.name}': ${param.description}`,
        });
      }

      // Type validation
      if (!isEmpty && value !== undefined) {
        const typeError = this.validateParameterType(
          param.name,
          value,
          param.type,
        );
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    // Check for unexpected parameters
    for (const [key] of Object.entries(parameters)) {
      const isRecognized = handler.parameters.some(
        (param) => param.name.toLowerCase() === key.toLowerCase(),
      );

      if (!isRecognized) {
        errors.push({
          field: key,
          message: `Unexpected parameter '${key}'`,
          severity: "warning",
          suggestion: `Available parameters: ${handler.parameters.map((p) => p.name).join(", ")}`,
        });
      }
    }

    return errors;
  }

  /**
   * Convert extracted value to appropriate type
   */
  private static convertValueByType(value: string, type: string): unknown {
    switch (type.toLowerCase()) {
      case "boolean":
        return value.toLowerCase() === "true";
      case "number": {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      case "array":
        try {
          return JSON.parse(value);
        } catch {
          return value.split(",").map((item) => item.trim());
        }
      case "string":
      default:
        return value;
    }
  }

  /**
   * Generic parameter extraction for various parameter types
   */
  private static extractGenericParameter(
    request: string,
    paramName: string,
    paramType: string,
  ): unknown {
    const patterns = [
      new RegExp(`${paramName}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
      new RegExp(`${paramName}\\s+([^\\s]+)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return this.convertValueByType(match[1], paramType);
      }
    }

    return null;
  }

  /**
   * Extract parameters from natural language request
   */
  private static extractNaturalLanguageParameters(
    request: string,
    handler: HandlerMetadata,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const requestLower = request.toLowerCase();

    if (!handler.parameters) {
      return parameters;
    }

    for (const param of handler.parameters) {
      const paramName = param.name.toLowerCase();

      // Context-aware extraction based on parameter name and type
      if (paramName === "target" || paramName === "recipient") {
        const patterns = [
          /to\s+([^\s]+)/i,
          /recipient\s+([^\s]+)/i,
          /for\s+([^\s]+)/i,
          /send\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i,
        ];

        for (const pattern of patterns) {
          const match = requestLower.match(pattern);
          if (match && match[1]) {
            parameters[param.name] = match[1];
            break;
          }
        }
      } else if (paramName === "amount" || paramName === "quantity") {
        const patterns = [
          /(\d+(?:\.\d+)?)/,
          /amount\s*[=:]?\s*(\d+(?:\.\d+)?)/i,
          /quantity\s*[=:]?\s*(\d+(?:\.\d+)?)/i,
        ];

        for (const pattern of patterns) {
          const match = requestLower.match(pattern);
          if (match && match[1]) {
            parameters[param.name] = this.convertValueByType(
              match[1],
              param.type,
            );
            break;
          }
        }
      } else {
        // Generic parameter extraction
        const value = this.extractGenericParameter(
          requestLower,
          paramName,
          param.type,
        );
        if (value !== null) {
          parameters[param.name] = value;
        }
      }
    }

    return parameters;
  }

  /**
   * Extract parameters from structured request format
   */
  private static extractStructuredParameters(
    request: string,
    handler: HandlerMetadata,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    if (!handler.parameters) {
      return parameters;
    }

    for (const param of handler.parameters) {
      // Try various structured patterns
      const patterns = [
        new RegExp(`${param.name}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
        new RegExp(`"${param.name}"\\s*:\\s*"([^"]*)"`, "i"),
        new RegExp(`--${param.name}\\s+([^\\s]+)`, "i"),
        new RegExp(`${param.name}\\s+([^\\s]+)`, "i"),
      ];

      for (const pattern of patterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          parameters[param.name] = this.convertValueByType(
            match[1],
            param.type,
          );
          break;
        }
      }
    }

    return parameters;
  }

  /**
   * Generate validation rules for a parameter
   */
  private static generateValidationRules(param: {
    name: string;
    type: string;
    validation?: string;
  }): string[] {
    const rules: string[] = [];

    switch (param.type.toLowerCase()) {
      case "array":
        rules.push("Must be an array of values");
        break;

      case "boolean":
        rules.push("Must be true or false");
        break;

      case "number":
        rules.push("Must be a numeric value");
        if (
          param.name.toLowerCase().includes("amount") ||
          param.name.toLowerCase().includes("quantity")
        ) {
          rules.push("Should be a positive number");
        }
        break;

      case "string":
        rules.push("Must be a text value");
        if (param.name.toLowerCase().includes("address")) {
          rules.push("Should be a valid AO process address (43 characters)");
        }
        break;

      default:
        rules.push(`Must be a valid ${param.type} value`);
    }

    if (param.validation) {
      rules.push(`Custom validation: ${param.validation}`);
    }

    return rules;
  }

  /**
   * Validate parameter type
   */
  private static validateParameterType(
    name: string,
    value: unknown,
    expectedType: string,
  ): null | ValidationError {
    const actualType = typeof value;
    const expectedTypeLower = expectedType.toLowerCase();

    switch (expectedTypeLower) {
      case "array":
        if (!Array.isArray(value)) {
          return {
            field: name,
            message: `Parameter '${name}' should be an array, got ${actualType}`,
            severity: "error",
            suggestion: `Provide an array like: [item1, item2]`,
          };
        }
        break;

      case "boolean":
        if (actualType !== "boolean") {
          return {
            field: name,
            message: `Parameter '${name}' should be a boolean, got ${actualType}`,
            severity: "error",
            suggestion: `Use true or false`,
          };
        }
        break;

      case "number":
        if (actualType !== "number") {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            return {
              field: name,
              message: `Parameter '${name}' should be a number, got ${actualType}`,
              severity: "error",
              suggestion: `Provide a numeric value like: 123 or 45.67`,
            };
          }
        }
        break;

      case "string":
        if (actualType !== "string") {
          return {
            field: name,
            message: `Parameter '${name}' should be a string, got ${actualType}`,
            severity: "error",
            suggestion: `Convert the value to a string: "${value}"`,
          };
        }
        break;
    }

    return null;
  }
}
