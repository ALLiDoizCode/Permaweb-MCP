import type { OperationDetectionResult } from "../types/unified-communication.js";
import type { HandlerMetadata } from "./DocumentationProtocolService.js";

export class OperationDetectionService {
  /**
   * Performs multi-layer operation detection using ADP metadata, NLP analysis, and pattern matching
   */
  public static detectOperationType(
    request: string,
    handlers?: HandlerMetadata[],
    explicitMode?: string,
  ): OperationDetectionResult {
    // Input validation
    if (
      !request ||
      typeof request !== "string" ||
      request.trim().length === 0
    ) {
      return {
        confidence: 0,
        detectionMethod: "fallback",
        operationType: "unknown",
        reasoning: "Invalid or empty request provided",
        riskLevel: "low",
      };
    }

    // Validate explicit mode if provided
    if (explicitMode && explicitMode !== "auto") {
      const validModes = ["read", "write", "validate"];
      if (!validModes.includes(explicitMode)) {
        return {
          confidence: 0.5,
          detectionMethod: "fallback",
          operationType: "unknown",
          reasoning: `Invalid explicit mode '${explicitMode}', expected: ${validModes.join(", ")}`,
          riskLevel: "low",
        };
      }

      return {
        confidence: 1.0,
        detectionMethod: "adp",
        operationType: explicitMode as "read" | "unknown" | "write",
        reasoning: `Explicit mode specified: ${explicitMode}`,
        riskLevel: explicitMode === "write" ? "medium" : "low",
      };
    }

    try {
      // Layer 1: ADP Handler Metadata Detection (Primary)
      if (handlers && handlers.length > 0) {
        const adpResult = this.detectFromADPMetadata(request, handlers);
        if (adpResult.confidence > 0.7) {
          return adpResult;
        }
      }

      // Layer 2: NLP Intent Detection (Secondary)
      const nlpResult = this.detectFromNLPAnalysis(request);
      if (nlpResult.confidence > 0.6) {
        return nlpResult;
      }

      // Layer 3: Pattern Matching (Fallback)
      const patternResult = this.detectFromPatternMatching(request);
      return patternResult;
    } catch (error) {
      return {
        confidence: 0,
        detectionMethod: "fallback",
        operationType: "unknown",
        reasoning: `Operation detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        riskLevel: "high", // High risk due to detection failure
      };
    }
  }

  /**
   * Assess risk level from handler and request
   */
  private static assessRiskFromHandler(
    handler: HandlerMetadata,
    request: string,
  ): "high" | "low" | "medium" {
    const requestLower = request.toLowerCase();
    const actionLower = handler.action.toLowerCase();

    // High risk operations
    const highRiskActions = ["delete", "burn", "remove"];
    if (highRiskActions.some((action) => actionLower.includes(action))) {
      return "high";
    }

    // Medium risk for write operations with value transfers
    if (
      handler.isWrite &&
      (requestLower.includes("transfer") ||
        requestLower.includes("send") ||
        /\d+/.test(requestLower)) // Contains numbers (amounts)
    ) {
      return "medium";
    }

    // Read operations are generally low risk
    return handler.isWrite ? "medium" : "low";
  }

  /**
   * Calculate match score between request and handler
   */
  private static calculateHandlerMatchScore(
    requestLower: string,
    handler: HandlerMetadata,
  ): number {
    let score = 0;

    // Action name matching (highest weight)
    if (requestLower.includes(handler.action.toLowerCase())) {
      score += 0.6;
    }

    // Description keyword matching
    if (handler.description) {
      const descWords = handler.description.toLowerCase().split(/\s+/);
      const requestWords = requestLower.split(/\s+/);
      const commonWords = descWords.filter(
        (word) => requestWords.includes(word) && word.length > 2,
      );
      score += commonWords.length * 0.1;
    }

    // Parameter name matching
    if (handler.parameters) {
      for (const param of handler.parameters) {
        if (requestLower.includes(param.name.toLowerCase())) {
          score += param.required ? 0.2 : 0.1;
        }
      }
    }

    // Example matching
    if (handler.examples) {
      for (const example of handler.examples) {
        const exampleWords = example.toLowerCase().split(/\s+/);
        const requestWords = requestLower.split(/\s+/);
        const commonWords = exampleWords.filter(
          (word) => requestWords.includes(word) && word.length > 2,
        );
        score += commonWords.length * 0.05;
      }
    }

    return Math.min(score, 1.0);
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
      case "address":
      case "string":
      default:
        return value;
    }
  }

  /**
   * Primary detection using ADP handler metadata with isWrite field
   */
  private static detectFromADPMetadata(
    request: string,
    handlers: HandlerMetadata[],
  ): OperationDetectionResult {
    const requestLower = request.toLowerCase();
    let bestMatch: HandlerMetadata | null = null;
    let highestScore = 0;

    // Find best matching handler
    for (const handler of handlers) {
      const score = this.calculateHandlerMatchScore(requestLower, handler);
      if (score > highestScore && score > 0.3) {
        bestMatch = handler;
        highestScore = score;
      }
    }

    if (bestMatch && highestScore > 0.5) {
      const operationType = this.determineOperationFromHandler(bestMatch);
      const riskLevel = this.assessRiskFromHandler(bestMatch, request);

      return {
        confidence: Math.min(highestScore + 0.2, 1.0), // Boost ADP confidence
        detectionMethod: "adp",
        operationType,
        reasoning: `Matched handler '${bestMatch.action}' with ${bestMatch.isWrite !== undefined ? "explicit isWrite flag" : "action analysis"}`,
        riskLevel,
        suggestedParameters: this.extractParametersFromRequest(
          request,
          bestMatch,
        ),
      };
    }

    return {
      confidence: 0,
      detectionMethod: "adp",
      operationType: "unknown",
      reasoning: "No suitable ADP handler match found",
      riskLevel: "low",
    };
  }

  /**
   * Secondary detection using NLP intent analysis
   */
  private static detectFromNLPAnalysis(
    request: string,
  ): OperationDetectionResult {
    const requestLower = request.toLowerCase();
    const words = requestLower.split(/\s+/);

    // Intent classification weights
    const writeIntents = new Map([
      ["add", 0.7],
      ["approve", 0.7],
      ["burn", 0.9],
      ["confirm", 0.6],
      ["create", 0.8],
      ["delete", 0.9],
      ["deposit", 0.8],
      ["execute", 0.7],
      ["mint", 0.9],
      ["register", 0.7],
      ["reject", 0.7],
      ["remove", 0.8],
      ["send", 0.9],
      ["set", 0.7],
      ["stake", 0.8],
      ["submit", 0.7],
      ["transfer", 0.9],
      ["update", 0.8],
      ["vote", 0.8],
      ["withdraw", 0.8],
    ]);

    const readIntents = new Map([
      ["balance", 0.9],
      ["check", 0.8],
      ["display", 0.7],
      ["examine", 0.7],
      ["fetch", 0.8],
      ["find", 0.8],
      ["get", 0.8],
      ["info", 0.8],
      ["list", 0.8],
      ["lookup", 0.7],
      ["query", 0.8],
      ["read", 0.9],
      ["search", 0.7],
      ["show", 0.8],
      ["status", 0.8],
      ["view", 0.8],
    ]);

    let writeScore = 0;
    let readScore = 0;
    const matchedTerms: string[] = [];

    // Calculate intent scores
    for (const word of words) {
      if (writeIntents.has(word)) {
        writeScore = Math.max(writeScore, writeIntents.get(word)!);
        matchedTerms.push(`write:${word}`);
      }
      if (readIntents.has(word)) {
        readScore = Math.max(readScore, readIntents.get(word)!);
        matchedTerms.push(`read:${word}`);
      }
    }

    // Determine operation type and confidence
    if (writeScore > readScore && writeScore > 0.6) {
      return {
        confidence: writeScore,
        detectionMethod: "nlp",
        operationType: "write",
        reasoning: `NLP analysis detected write intent from terms: ${matchedTerms.filter((t) => t.startsWith("write:")).join(", ")}`,
        riskLevel: writeScore > 0.8 ? "medium" : "low",
      };
    } else if (readScore > writeScore && readScore > 0.6) {
      return {
        confidence: readScore,
        detectionMethod: "nlp",
        operationType: "read",
        reasoning: `NLP analysis detected read intent from terms: ${matchedTerms.filter((t) => t.startsWith("read:")).join(", ")}`,
        riskLevel: "low",
      };
    }

    return {
      confidence: Math.max(writeScore, readScore),
      detectionMethod: "nlp",
      operationType: "unknown",
      reasoning: `Ambiguous NLP analysis - write:${writeScore.toFixed(2)}, read:${readScore.toFixed(2)}`,
      riskLevel: "low",
    };
  }

  /**
   * Fallback detection using pattern matching
   */
  private static detectFromPatternMatching(
    request: string,
  ): OperationDetectionResult {
    const requestLower = request.toLowerCase();

    // Pattern-based detection with specific regex patterns
    const writePatterns = [
      /send\s+\d+/i,
      /transfer\s+\d+/i,
      /create\s+\w+/i,
      /delete\s+\w+/i,
      /update\s+\w+/i,
      /set\s+\w+\s+to\s+\w+/i,
      /mint\s+\d+/i,
      /burn\s+\d+/i,
      /\d+\s+tokens?\s+to\s+\w+/i,
    ];

    const readPatterns = [
      /get\s+\w+/i,
      /check\s+balance/i,
      /show\s+\w+/i,
      /what\s+is\s+my\s+balance/i,
      /balance\s+of\s+\w+/i,
      /info\s+about\s+\w+/i,
      /status\s+of\s+\w+/i,
    ];

    // Check write patterns
    for (const pattern of writePatterns) {
      if (pattern.test(requestLower)) {
        return {
          confidence: 0.7,
          detectionMethod: "pattern",
          operationType: "write",
          reasoning: `Matched write pattern: ${pattern.source}`,
          riskLevel: "medium",
        };
      }
    }

    // Check read patterns
    for (const pattern of readPatterns) {
      if (pattern.test(requestLower)) {
        return {
          confidence: 0.7,
          detectionMethod: "pattern",
          operationType: "read",
          reasoning: `Matched read pattern: ${pattern.source}`,
          riskLevel: "low",
        };
      }
    }

    // Final fallback - default to read for safety
    return {
      confidence: 0.3,
      detectionMethod: "fallback",
      operationType: "read",
      reasoning: "No patterns matched, defaulting to read operation for safety",
      riskLevel: "low",
    };
  }

  /**
   * Determine operation type from handler metadata
   */
  private static determineOperationFromHandler(
    handler: HandlerMetadata,
  ): "read" | "unknown" | "write" {
    // Primary: Use ADP isWrite field if available
    if (handler.isWrite !== undefined) {
      return handler.isWrite ? "write" : "read";
    }

    // Fallback: Action name analysis
    const actionLower = handler.action.toLowerCase();

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

    if (writeActions.some((action) => actionLower.includes(action))) {
      return "write";
    }

    if (readActions.some((action) => actionLower.includes(action))) {
      return "read";
    }

    return "unknown";
  }

  /**
   * Extract parameters from request based on handler metadata
   */
  private static extractParametersFromRequest(
    request: string,
    handler: HandlerMetadata,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const requestLower = request.toLowerCase();

    if (!handler.parameters) {
      return parameters;
    }

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

    return parameters;
  }

  /**
   * Extract parameter value using various extraction strategies
   */
  private static extractParameterValue(
    request: string,
    paramName: string,
    paramType: string,
  ): unknown {
    // Direct parameter patterns
    const directPatterns = [
      new RegExp(`${paramName}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
      new RegExp(`${paramName}\\s+([^\\s]+)`, "i"),
    ];

    for (const pattern of directPatterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return this.convertValueByType(match[1], paramType);
      }
    }

    // Context-based extraction for common parameters
    if (paramName === "target" || paramName === "recipient") {
      const patterns = [
        /to\s+([^\s]+)/i,
        /recipient\s+([^\s]+)/i,
        /for\s+([^\s]+)/i,
      ];
      for (const pattern of patterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    if (paramName === "amount" || paramName === "quantity") {
      const patterns = [/(\d+(?:\.\d+)?)/, /amount\s*[=:]?\s*(\d+(?:\.\d+)?)/i];
      for (const pattern of patterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          return this.convertValueByType(match[1], paramType);
        }
      }
    }

    return null;
  }
}
