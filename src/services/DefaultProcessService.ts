import type { ProcessDefinition } from "./ProcessCommunicationService.js";

import {
  DEFAULT_TOKEN_PROCESS,
  extractTokenOperation,
  getDefaultTokenProcess,
  isTokenProcess,
  TOKEN_DETECTION_PATTERNS,
} from "../templates/defaultTokenProcess.js";

/**
 * Default Process Service
 * Manages default process templates and auto-detection
 */
export interface DefaultProcessService {
  /**
   * Validate if a request can be handled by default templates
   */
  canHandleRequest(request: string): boolean;

  /**
   * Detect process type from handler names or process responses
   */
  detectProcessType(
    handlers: string[],
    processResponses?: Record<string, unknown>,
  ): null | ProcessTypeDetection;

  /**
   * Get a specific default process template by type
   */
  getDefaultProcess(type: string, processId?: string): null | ProcessDefinition;

  /**
   * Get all available default process templates
   */
  getDefaultProcesses(): DefaultProcessRegistry;

  /**
   * Get suggested operations for a detected process type
   */
  getSuggestedOperations(processType: string): string[];

  /**
   * Check if a process ID matches any known default patterns
   */
  isKnownProcessType(processId: string, handlers?: string[]): null | string;

  /**
   * Enhanced natural language service with auto-detection
   */
  processNaturalLanguage(
    request: string,
    processId?: string,
    knownHandlers?: string[],
  ): EnhancedNLSResult | null;
}

/**
 * Default Process Registry
 * Contains all built-in process templates
 */
interface DefaultProcessRegistry {
  token: ProcessDefinition;
  // Future: nft, dao, defi, etc.
}

/**
 * Enhanced Natural Language Service Result
 */
interface EnhancedNLSResult {
  confidence: number;
  operation: string;
  parameters: Record<string, unknown>;
  processType: string;
  template: ProcessDefinition;
}

/**
 * Process Type Detection Result
 */
interface ProcessTypeDetection {
  confidence: number;
  suggestedHandlers: string[];
  template: ProcessDefinition;
  type: string;
}

/**
 * Implementation of DefaultProcessService
 */
const createDefaultProcessService = (): DefaultProcessService => {
  // Registry of all default process templates
  const defaultProcesses: DefaultProcessRegistry = {
    token: DEFAULT_TOKEN_PROCESS,
  };

  // Cache for detected process types
  const processTypeCache = new Map<string, string>();

  return {
    canHandleRequest(request: string): boolean {
      // Check if any default template can handle this request
      const tokenResult = extractTokenOperation(request);
      if (tokenResult && tokenResult.confidence > 0.5) {
        return true;
      }

      // Future: Check other process types

      return false;
    },

    detectProcessType(handlers: string[]): null | ProcessTypeDetection {
      // Check for token patterns
      if (isTokenProcess(handlers)) {
        const tokenHandlers = handlers.filter((h) =>
          TOKEN_DETECTION_PATTERNS.handlers.includes(h.toLowerCase()),
        );

        const confidence = Math.min(
          (tokenHandlers.length / TOKEN_DETECTION_PATTERNS.handlers.length) *
            0.8 +
            0.2,
          1.0,
        );

        return {
          confidence,
          suggestedHandlers: TOKEN_DETECTION_PATTERNS.handlers,
          template: DEFAULT_TOKEN_PROCESS,
          type: "token",
        };
      }

      // Future: Add detection for other process types (NFT, DAO, DeFi, etc.)

      return null;
    },

    getDefaultProcess(
      type: string,
      processId?: string,
    ): null | ProcessDefinition {
      switch (type.toLowerCase()) {
        case "erc20":
        case "fungible":
        case "token":
          return processId
            ? getDefaultTokenProcess(processId)
            : DEFAULT_TOKEN_PROCESS;
        default:
          return null;
      }
    },

    getDefaultProcesses(): DefaultProcessRegistry {
      return { ...defaultProcesses };
    },

    getSuggestedOperations(processType: string): string[] {
      switch (processType.toLowerCase()) {
        case "token":
          return [
            "Check balance",
            "Transfer tokens",
            "Get token info (name, symbol, supply)",
            "Mint tokens (if owner)",
            "Burn tokens",
            "Approve spending",
            "Check allowances",
          ];
        default:
          return [];
      }
    },

    isKnownProcessType(processId: string, handlers?: string[]): null | string {
      // Check cache first
      if (processTypeCache.has(processId)) {
        return processTypeCache.get(processId)!;
      }

      // If handlers are provided, use them for detection
      if (handlers && handlers.length > 0) {
        const detection = this.detectProcessType(handlers);
        if (detection && detection.confidence > 0.6) {
          processTypeCache.set(processId, detection.type);
          return detection.type;
        }
      }

      // Future: Could add process ID pattern matching
      // e.g., known token contracts, official processes, etc.

      return null;
    },

    processNaturalLanguage(
      request: string,
      processId?: string,
      knownHandlers?: string[],
    ): EnhancedNLSResult | null {
      // First, try to detect process type
      let processType = "unknown";
      let template = DEFAULT_TOKEN_PROCESS; // Default fallback

      if (processId) {
        const detectedType = this.isKnownProcessType(processId, knownHandlers);
        if (detectedType) {
          processType = detectedType;
          const detectedTemplate = this.getDefaultProcess(
            detectedType,
            processId,
          );
          if (detectedTemplate) {
            template = detectedTemplate;
          }
        }
      }

      // If no specific detection, try to infer from request
      if (processType === "unknown") {
        // Check for token operation patterns
        const tokenOp = extractTokenOperation(request);
        if (tokenOp && tokenOp.confidence > 0.7) {
          processType = "token";
          template = processId
            ? getDefaultTokenProcess(processId)
            : DEFAULT_TOKEN_PROCESS;

          return {
            confidence: tokenOp.confidence,
            operation: tokenOp.operation,
            parameters: tokenOp.parameters,
            processType,
            template,
          };
        }
      }

      // If we have a known template, try standard processing
      if (processType !== "unknown") {
        // Use the template-specific processing
        if (processType === "token") {
          const tokenOp = extractTokenOperation(request);
          if (tokenOp) {
            return {
              confidence: tokenOp.confidence,
              operation: tokenOp.operation,
              parameters: tokenOp.parameters,
              processType,
              template,
            };
          }
        }
      }

      return null;
    },
  };
};

/**
 * Singleton instance of DefaultProcessService
 */
export const defaultProcessService = createDefaultProcessService();

/**
 * Utility functions for working with default processes
 */
export const DefaultProcessUtils = {
  /**
   * Format process detection results for display
   */
  formatDetectionResult(detection: ProcessTypeDetection): string {
    return (
      `Detected ${detection.type} process with ${(detection.confidence * 100).toFixed(0)}% confidence. ` +
      `Supports operations: ${detection.suggestedHandlers.slice(0, 5).join(", ")}` +
      (detection.suggestedHandlers.length > 5
        ? ` and ${detection.suggestedHandlers.length - 5} more.`
        : ".")
    );
  },

  /**
   * Get smart suggestions for a partial request
   */
  getSmartSuggestions(partialRequest: string, processType?: string): string[] {
    const suggestions: string[] = [];

    if (!processType || processType === "token") {
      if (
        partialRequest.toLowerCase().includes("send") ||
        partialRequest.toLowerCase().includes("transfer")
      ) {
        suggestions.push(
          "Send 100 tokens to alice",
          "Transfer 50 tokens to bob with memo 'payment'",
        );
      }

      if (
        partialRequest.toLowerCase().includes("balance") ||
        partialRequest.toLowerCase().includes("check")
      ) {
        suggestions.push(
          "Check my balance",
          "Get balance for alice",
          "What's my token balance?",
        );
      }

      if (partialRequest.toLowerCase().includes("mint")) {
        suggestions.push(
          "Mint 1000 tokens for alice",
          "Create 500 new tokens for bob",
        );
      }
    }

    return suggestions;
  },

  /**
   * Get all supported process types
   */
  getSupportedProcessTypes(): string[] {
    return Object.keys(defaultProcessService.getDefaultProcesses());
  },

  /**
   * Check if a request looks like a token operation
   */
  isTokenRequest(request: string): boolean {
    const result = extractTokenOperation(request);
    return result !== null && result.confidence > 0.6;
  },
};

/**
 * Export types for external use
 */
export type { DefaultProcessRegistry, EnhancedNLSResult, ProcessTypeDetection };
