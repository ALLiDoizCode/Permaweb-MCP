import { JWKInterface } from "arweave/node/lib/wallet.js";

import { Tag } from "../models/Tag.js";
import { read, send } from "../process.js";
import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
  HandlerMetadata,
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
  error?: string;
  handlerUsed?: string;
  methodUsed?: "read" | "send";
  parametersUsed?: Record<string, unknown>;
  success: boolean;
}

export class ADPProcessCommunicationService {
  private static readonly ADP_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private static adpCache: ADPCache = {};

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
    try {
      // Ensure we have ADP metadata
      const metadata =
        adpResponse || (await this.discoverADPSupport(processId, signer));

      // If we just performed discovery, add delay before execution
      if (!adpResponse) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!metadata) {
        return {
          approach: "ADP",
          error: "Process does not support ADP or discovery failed",
          success: false,
        };
      }

      // Find matching handler using natural language matching
      const matchedHandler = this.findBestHandlerMatch(
        userRequest,
        metadata.handlers || [],
      );

      if (!matchedHandler) {
        return {
          approach: "ADP",
          availableHandlers: metadata.handlers?.map((h) => h.action) || [],
          error: "Could not match request to any available ADP handler",
          success: false,
        };
      }

      // Extract parameters from user request
      const parameters = this.extractParametersFromRequest(
        userRequest,
        matchedHandler.handler,
      );

      // Validate parameters using ADP metadata
      const validation = DocumentationProtocolService.validateParameters(
        matchedHandler.handler,
        parameters,
      );

      if (!validation.valid) {
        return {
          approach: "ADP",
          error: `Parameter validation failed: ${validation.errors.join(", ")}`,
          success: false,
        };
      }

      // Generate message tags using ADP
      const tags = DocumentationProtocolService.generateMessageTags(
        matchedHandler.handler,
        parameters,
      );

      // Add delay to avoid rate limiting issues with rapid successive calls
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Determine if this is a write operation or read operation
      const isWriteOperation = this.isWriteHandler(matchedHandler.handler);

      // Execute the message using appropriate method from process.ts
      let response;
      if (isWriteOperation) {
        // Use send() for write operations (state-changing)
        response = await send(signer, processId, tags, null);
      } else {
        // Use read() for read-only operations
        response = await read(processId, tags);
      }

      return {
        approach: "ADP",
        confidence: matchedHandler.confidence,
        data: response?.Data || response,
        handlerUsed: matchedHandler.handler.action,
        methodUsed: isWriteOperation ? "send" : "read",
        parametersUsed: parameters,
        success: !!response,
      };
    } catch (error) {
      return {
        approach: "ADP",
        error:
          error instanceof Error
            ? `ADP execution failed: ${error.message}`
            : "ADP execution failed",
        success: false,
      };
    }
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
   * Extract parameters from user request based on handler metadata
   */
  private static extractParametersFromRequest(
    userRequest: string,
    handler: HandlerMetadata,
  ): Record<string, any> {
    const parameters: Record<string, any> = {};
    const requestLower = userRequest.toLowerCase();

    if (!handler.parameters) {
      return parameters;
    }

    for (const param of handler.parameters) {
      const value = this.extractParameterValue(requestLower, param);
      if (value !== null) {
        parameters[param.name] = value;
      }
    }

    return parameters;
  }

  /**
   * Extract a specific parameter value from user request
   */
  private static extractParameterValue(
    request: string,
    param: { name: string; type: string },
  ): any {
    const paramName = param.name.toLowerCase();
    // Escape special regex characters to prevent "Nothing to repeat" errors
    const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Check mathematical patterns first for A and B parameters
    if (param.type === "number" && (paramName === "a" || paramName === "b")) {
      // Handle mathematical operation parameters (A, B for Add/Subtract)
      if (paramName === "a") {
        const aPatterns = [
          /add\s+([0-9.]+)\s+(?:and|to|\+)/i, // "add 15 and 7" -> 15
          /([0-9.]+)\s*\+\s*[0-9.]+/i, // "15 + 7" -> 15
          /subtract\s+([0-9.]+)\s+from/i, // "subtract 15 from 20" -> 15 (subtrahend)
          /([0-9.]+)\s*-\s*[0-9.]+/i, // "20 - 15" -> 20
        ];

        for (const pattern of aPatterns) {
          const match = request.match(pattern);
          if (match && match[1]) {
            return this.convertParameterValue(match[1], param.type);
          }
        }
      }

      if (paramName === "b") {
        const bPatterns = [
          /add\s+[0-9.]+\s+(?:and|to|\+)\s+([0-9.]+)/i, // "add 15 and 7" -> 7
          /[0-9.]+\s*\+\s*([0-9.]+)/i, // "15 + 7" -> 7
          /subtract\s+[0-9.]+\s+from\s+([0-9.]+)/i, // "subtract 15 from 20" -> 20 (minuend)
        ];

        for (const pattern of bPatterns) {
          const match = request.match(pattern);
          if (match && match[1]) {
            return this.convertParameterValue(match[1], param.type);
          }
        }

        // Special handling for subtraction pattern "X - Y" where we want Y for parameter B
        const subtractionMatch = request.match(/[0-9.]+\s*-\s*([0-9.]+)/i);
        if (subtractionMatch && subtractionMatch[1]) {
          return this.convertParameterValue(subtractionMatch[1], param.type);
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
   * Get action-specific matching score based on synonyms and patterns
   */
  private static getActionSpecificScore(
    request: string,
    action: string,
  ): number {
    const actionSynonyms: Record<string, string[]> = {
      balance: ["check", "get", "show", "view"],
      burn: ["destroy", "remove", "delete"],
      info: ["details", "information", "about"],
      mint: ["create", "generate", "issue"],
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
}
