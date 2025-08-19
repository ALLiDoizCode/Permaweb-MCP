import { JWKInterface } from "arweave/node/lib/wallet.js";

import { Tag } from "../models/Tag.js";
import { AOMessage, aoMessageService } from "./AOMessageService.js";
import { defaultProcessService } from "./DefaultProcessService.js";
import { TokenProcessTemplateService } from "./TokenProcessTemplateService.js";

/**
 * Legacy Process Communication Service
 *
 * Simplified service for communicating with processes that don't implement ADP.
 * Focuses on template-based matching and simplified markdown parsing.
 */

export interface HandlerInfo {
  action: string;
  description: string;
  examples?: string[];
  isWrite: boolean;
  parameters: ParameterInfo[];
}

export interface LegacyCommunicationResult {
  approach: "legacy";
  confidence?: number;
  data?: unknown;
  error?: string;
  handlerUsed?: string;
  parameters?: Record<string, unknown>;
  processType?: string;
  success: boolean;
  suggestions?: string[];
  templateUsed?: string;
}

export interface ParameterInfo {
  description: string;
  name: string;
  required: boolean;
  type: "boolean" | "number" | "object" | "string";
  validation?: string;
}

export interface ProcessDefinition {
  handlers: HandlerInfo[];
  name: string;
  processId: string;
}

export class LegacyProcessCommunicationService {
  private static readonly WRITE_KEYWORDS = [
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

  /**
   * Execute smart request with template fallback and natural language processing
   */
  static async executeSmartRequest(
    processId: string,
    userRequest: string,
    signer: JWKInterface,
    embeddedTemplates?: Map<string, ProcessDefinition>,
  ): Promise<LegacyCommunicationResult> {
    try {
      // Try embedded templates first if available
      if (embeddedTemplates && embeddedTemplates.has("token")) {
        const tokenTemplate = embeddedTemplates.get("token");
        if (tokenTemplate) {
          // First try enhanced NLS patterns for token operations
          const tokenNLSResult =
            TokenProcessTemplateService.processTokenRequest(
              userRequest,
              processId,
            );

          if (tokenNLSResult && tokenNLSResult.confidence > 0.7) {
            // Find the handler in the template
            const handler = tokenNLSResult.template.handlers.find(
              (h) =>
                h.action.toLowerCase() ===
                tokenNLSResult.operation.toLowerCase(),
            );

            if (handler) {
              // Map NLS parameters to handler parameter names
              const mappedParameters = this.mapNLSParametersToHandler(
                tokenNLSResult.parameters,
                tokenNLSResult.operation,
              );

              const aoMessage = this.buildAOMessage(
                processId,
                handler,
                mappedParameters,
              );
              const response = await aoMessageService.executeMessage(
                signer,
                aoMessage,
              );

              return {
                approach: "legacy",
                confidence: tokenNLSResult.confidence,
                data: response.data,
                error: response.error,
                handlerUsed: handler.action,
                parameters: mappedParameters,
                processType: "token",
                success: response.success,
                suggestions:
                  defaultProcessService.getSuggestedOperations("token"),
                templateUsed: "embedded-nls",
              };
            }
          }

          // Fallback to standard handler matching
          const processTemplate = { ...tokenTemplate, processId };
          const handlerMatch = this.matchRequestToHandler(
            userRequest,
            processTemplate.handlers,
          );

          if (handlerMatch && handlerMatch.confidence > 0.6) {
            const aoMessage = this.buildAOMessage(
              processId,
              handlerMatch.handler,
              handlerMatch.parameters,
            );
            const response = await aoMessageService.executeMessage(
              signer,
              aoMessage,
            );

            return {
              approach: "legacy",
              confidence: handlerMatch.confidence,
              data: response.data,
              error: response.error,
              handlerUsed: handlerMatch.handler.action,
              parameters: handlerMatch.parameters,
              processType: "token",
              success: response.success,
              suggestions:
                defaultProcessService.getSuggestedOperations("token"),
              templateUsed: "embedded",
            };
          }
        }
      }

      // Try enhanced natural language service with auto-detection
      const nlsResult = defaultProcessService.processNaturalLanguage(
        userRequest,
        processId,
      );

      if (nlsResult && nlsResult.confidence > 0.6) {
        // Find the handler in the template
        const handler = nlsResult.template.handlers.find(
          (h) => h.action === nlsResult.operation,
        );

        if (handler) {
          const aoMessage = this.buildAOMessage(
            processId,
            handler,
            nlsResult.parameters,
          );
          const response = await aoMessageService.executeMessage(
            signer,
            aoMessage,
          );

          return {
            approach: "legacy",
            confidence: nlsResult.confidence,
            data: response.data,
            error: response.error,
            handlerUsed: handler.action,
            parameters: nlsResult.parameters,
            processType: nlsResult.processType,
            success: response.success,
            suggestions: defaultProcessService.getSuggestedOperations(
              nlsResult.processType,
            ),
            templateUsed: "default",
          };
        }
      }

      // Fallback: try to detect process type and suggest operations
      const canHandle = defaultProcessService.canHandleRequest(userRequest);
      if (canHandle) {
        return {
          approach: "legacy",
          error:
            "Request appears to be a token operation, but process type could not be confirmed. Please provide process documentation or use executeTokenRequest for token operations.",
          success: false,
          suggestions: defaultProcessService.getSuggestedOperations("token"),
        };
      }

      return {
        approach: "legacy",
        error:
          "Could not process request. Please provide process documentation using processMarkdown parameter.",
        success: false,
      };
    } catch (error) {
      return {
        approach: "legacy",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  /**
   * Execute a request using process markdown documentation
   */
  static async executeWithMarkdown(
    processMarkdown: string,
    processId: string,
    userRequest: string,
    signer: JWKInterface,
  ): Promise<LegacyCommunicationResult> {
    try {
      const processDefinition = this.parseMarkdown(processMarkdown);
      processDefinition.processId = processId;

      const handlerMatch = this.matchRequestToHandler(
        userRequest,
        processDefinition.handlers,
      );

      if (!handlerMatch) {
        return {
          approach: "legacy",
          error: "Could not match request to any available handler",
          success: false,
        };
      }

      const aoMessage = this.buildAOMessage(
        processId,
        handlerMatch.handler,
        handlerMatch.parameters,
      );
      const response = await aoMessageService.executeMessage(signer, aoMessage);

      return {
        approach: "legacy",
        confidence: handlerMatch.confidence,
        data: response.data,
        error: response.error,
        handlerUsed: handlerMatch.handler.action,
        parameters: handlerMatch.parameters,
        success: response.success,
      };
    } catch (error) {
      return {
        approach: "legacy",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  /**
   * Build AO message from handler and parameters
   */
  private static buildAOMessage(
    processId: string,
    handler: HandlerInfo,
    parameters: Record<string, unknown>,
  ): AOMessage {
    const tags: Tag[] = [{ name: "Action", value: handler.action }];

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        tags.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: String(value),
        });
      }
    }

    return {
      data: typeof parameters.data === "string" ? parameters.data : undefined,
      isWrite: handler.isWrite,
      processId,
      tags,
    };
  }

  /**
   * Simplified match scoring algorithm
   */
  private static calculateMatchScore(
    request: string,
    handler: HandlerInfo,
  ): number {
    let score = 0;

    // Check if action name is in request
    if (request.includes(handler.action.toLowerCase())) {
      score += 0.5;
    }

    // Check for action synonyms
    const actionSynonyms: Record<string, string[]> = {
      balance: ["check", "get", "show"],
      transfer: ["send", "give", "pay"],
    };

    const synonyms = actionSynonyms[handler.action.toLowerCase()] || [];
    for (const synonym of synonyms) {
      if (request.includes(synonym)) {
        score += 0.4;
        break;
      }
    }

    // Word matching in description
    const descriptionWords = handler.description.toLowerCase().split(" ");
    const requestWords = request.split(" ");

    for (const word of requestWords) {
      if (descriptionWords.includes(word)) {
        score += 0.1;
      }
    }

    // Parameter matching
    for (const param of handler.parameters) {
      if (request.includes(param.name.toLowerCase())) {
        score += 0.2;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract parameters from request text
   */
  private static extractParameters(
    request: string,
    handler: HandlerInfo,
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    const requestLower = request.toLowerCase();

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
   * Extract parameter value using simplified patterns
   */
  private static extractParameterValue(
    request: string,
    paramName: string,
    paramType: ParameterInfo["type"],
  ): unknown {
    // Escape special regex characters to prevent "Nothing to repeat" errors
    const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Parameter-specific patterns first
    const specificPatterns = [
      new RegExp(`${escapedParamName}\\s*[=:]\\s*["']?([^"'\\s]+)["']?`, "i"),
      new RegExp(`${escapedParamName}\\s+([^\\s]+)`, "i"),
    ];

    for (const pattern of specificPatterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        const value = match[1];
        if (paramType === "number") {
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        }
        return value;
      }
    }

    // Type-specific patterns
    if (paramType === "number") {
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
          const num = parseFloat(match[1]);
          if (!isNaN(num)) {
            return num;
          }
        }
      }
    } else if (paramType === "string") {
      if (paramName === "recipient" || paramName === "to") {
        const addressPatterns = [
          /to\s+([^\s]+)/i,
          /recipient\s+([^\s]+)/i,
          /send\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i,
          /transfer\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i,
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

  /**
   * Determine if action is a write operation
   */
  private static isWriteAction(action: string): boolean {
    const actionLower = action.toLowerCase();
    return this.WRITE_KEYWORDS.some((keyword) => actionLower.includes(keyword));
  }

  /**
   * Map NLS parameters to handler parameter names
   */
  private static mapNLSParametersToHandler(
    nlsParameters: Record<string, unknown>,
    operation: string,
  ): Record<string, unknown> {
    const mappedParameters: Record<string, unknown> = {};

    switch (operation.toLowerCase()) {
      case "balance":
        if (nlsParameters.account) {
          mappedParameters.Target = nlsParameters.account;
        }
        break;
      case "burn":
        if (nlsParameters.amount) {
          mappedParameters.Quantity = String(nlsParameters.amount);
        }
        break;
      case "mint":
        if (nlsParameters.recipient) {
          mappedParameters.Recipient = nlsParameters.recipient;
        }
        if (nlsParameters.amount) {
          mappedParameters.Quantity = String(nlsParameters.amount);
        }
        break;
      case "transfer":
        if (nlsParameters.recipient) {
          mappedParameters.Recipient = nlsParameters.recipient;
        }
        if (nlsParameters.amount) {
          mappedParameters.Quantity = String(nlsParameters.amount);
        }
        break;
      default:
        return nlsParameters;
    }

    return mappedParameters;
  }

  /**
   * Match user request to best handler with simplified scoring
   */
  private static matchRequestToHandler(
    request: string,
    handlers: HandlerInfo[],
  ): {
    confidence: number;
    handler: HandlerInfo;
    parameters: Record<string, unknown>;
  } | null {
    const requestLower = request.toLowerCase();
    let bestMatch: {
      confidence: number;
      handler: HandlerInfo;
      parameters: Record<string, unknown>;
    } | null = null;
    let highestScore = 0;

    for (const handler of handlers) {
      const score = this.calculateMatchScore(requestLower, handler);
      if (score > highestScore && score > 0.3) {
        const parameters = this.extractParameters(request, handler);
        bestMatch = { confidence: score, handler, parameters };
        highestScore = score;
      }
    }

    return bestMatch;
  }

  /**
   * Simplified markdown parsing - reduced complexity
   */
  private static parseMarkdown(markdown: string): ProcessDefinition {
    const lines = markdown.split("\n");
    const handlers: HandlerInfo[] = [];
    let currentHandler: null | Partial<HandlerInfo> = null;
    let processName = "Unknown Process";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("# ")) {
        processName = line.substring(2).trim();
      } else if (line.startsWith("## ")) {
        if (currentHandler && currentHandler.action) {
          handlers.push(currentHandler as HandlerInfo);
        }

        const action = line.substring(3).trim();
        currentHandler = {
          action,
          description: "",
          examples: [],
          isWrite: this.isWriteAction(action),
          parameters: [],
        };
      } else if (currentHandler && line.startsWith("- ")) {
        const paramLine = line.substring(2).trim();
        const parameter = this.parseParameter(paramLine);
        if (parameter) {
          currentHandler.parameters = currentHandler.parameters || [];
          currentHandler.parameters.push(parameter);
        }
      } else if (currentHandler && line && !line.startsWith("#")) {
        currentHandler.description = currentHandler.description
          ? currentHandler.description + " " + line
          : line;
      }
    }

    if (currentHandler && currentHandler.action) {
      handlers.push(currentHandler as HandlerInfo);
    }

    return { handlers, name: processName, processId: "" };
  }

  /**
   * Parse parameter line from markdown
   */
  private static parseParameter(paramLine: string): null | ParameterInfo {
    const colonIndex = paramLine.indexOf(":");
    if (colonIndex === -1) return null;

    // Clean up markdown formatting from parameter names (remove **bold**, *italic*, etc.)
    const rawName = paramLine.substring(0, colonIndex).trim();
    const name = rawName
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .trim();
    const description = paramLine.substring(colonIndex + 1).trim();

    const required = !description.toLowerCase().includes("optional");
    let type: ParameterInfo["type"] = "string";

    if (description.toLowerCase().includes("number")) {
      type = "number";
    } else if (description.toLowerCase().includes("boolean")) {
      type = "boolean";
    } else if (description.toLowerCase().includes("object")) {
      type = "object";
    }

    return { description, name, required, type };
  }
}
