/* eslint-disable no-useless-escape */
import { JWKInterface } from "arweave/node/lib/wallet.js";

import type { Tag } from "../models/Tag.js";

import {
  AOMessage,
  AOMessageResponse,
  aoMessageService,
} from "./AOMessageService.js";
import {
  defaultProcessService,
  type ProcessTypeDetection,
} from "./DefaultProcessService.js";

export interface HandlerInfo {
  action: string;
  description: string;
  examples?: string[];
  isWrite: boolean;
  parameters: ParameterInfo[];
}

export interface HandlerMatch {
  confidence: number;
  handler: HandlerInfo;
  parameters: Record<string, unknown>;
}

export interface ParameterInfo {
  description: string;
  name: string;
  required: boolean;
  type: "boolean" | "number" | "object" | "string";
  validation?: string;
}

export interface ProcessCommunicationService {
  buildAOMessage: (
    processId: string,
    handler: HandlerInfo,
    parameters: Record<string, unknown>,
  ) => AOMessage;
  detectProcessType: (
    processId: string,
    sampleRequests?: string[],
  ) => Promise<null | ProcessTypeDetection>;
  executeProcessRequest: (
    processMarkdown: string,
    processId: string,
    userRequest: string,
    signer: JWKInterface,
  ) => Promise<ProcessResponse>;
  executeSmartRequest: (
    processId: string,
    userRequest: string,
    signer: JWKInterface,
    processMarkdown?: string,
  ) => Promise<ProcessResponse>;
  interpretResponse: (
    response: AOMessageResponse,
    handler: HandlerInfo,
  ) => ProcessResponse;
  matchRequestToHandler: (
    request: string,
    handlers: HandlerInfo[],
  ) => HandlerMatch | null;
  parseMarkdown: (markdown: string) => ProcessDefinition;
}

export interface ProcessDefinition {
  handlers: HandlerInfo[];
  name: string;
  processId: string;
}

export interface ProcessResponse {
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

const WRITE_KEYWORDS = [
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

/* const READ_KEYWORDS = [
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
]; */

const service = (): ProcessCommunicationService => {
  return {
    buildAOMessage: (
      processId: string,
      handler: HandlerInfo,
      parameters: Record<string, unknown>,
    ): AOMessage => {
      const tags: Tag[] = [
        {
          name: "Action",
          value: handler.action,
        },
      ];

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
    },

    detectProcessType: async (
      processId: string,
      sampleRequests?: string[],
    ): Promise<null | ProcessTypeDetection> => {
      try {
        // For now, we'll implement basic detection logic
        // Future enhancement: could query the process to get handler list

        if (sampleRequests) {
          // Analyze sample requests to determine process type
          const tokenRequestCount = sampleRequests.filter((req) =>
            defaultProcessService.canHandleRequest(req),
          ).length;

          if (tokenRequestCount > 0) {
            const tokenTemplate = defaultProcessService.getDefaultProcess(
              "token",
              processId,
            );
            if (tokenTemplate) {
              return {
                confidence: Math.min(
                  tokenRequestCount / sampleRequests.length + 0.3,
                  1.0,
                ),
                suggestedHandlers: tokenTemplate.handlers.map((h) => h.action),
                template: tokenTemplate,
                type: "token",
              };
            }
          }
        }

        // Future: Could send a test message to the process to detect capabilities
        return null;
      } catch {
        // Process type detection failed silently for MCP compatibility
        return null;
      }
    },

    executeProcessRequest: async (
      processMarkdown: string,
      processId: string,
      userRequest: string,
      signer: JWKInterface,
    ): Promise<ProcessResponse> => {
      try {
        const processDefinition = service().parseMarkdown(processMarkdown);
        processDefinition.processId = processId;

        const handlerMatch = service().matchRequestToHandler(
          userRequest,
          processDefinition.handlers,
        );

        if (!handlerMatch) {
          return {
            error: "Could not match request to any available handler",
            success: false,
          };
        }

        const aoMessage = service().buildAOMessage(
          processId,
          handlerMatch.handler,
          handlerMatch.parameters,
        );

        const response = await aoMessageService.executeMessage(
          signer,
          aoMessage,
        );

        return service().interpretResponse(response, handlerMatch.handler);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    },

    executeSmartRequest: async (
      processId: string,
      userRequest: string,
      signer: JWKInterface,
      processMarkdown?: string,
    ): Promise<ProcessResponse> => {
      try {
        // If markdown is provided, use traditional approach
        if (processMarkdown) {
          return await service().executeProcessRequest(
            processMarkdown,
            processId,
            userRequest,
            signer,
          );
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
            const aoMessage = service().buildAOMessage(
              processId,
              handler,
              nlsResult.parameters,
            );

            const response = await aoMessageService.executeMessage(
              signer,
              aoMessage,
            );

            const result = service().interpretResponse(response, handler);
            return {
              ...result,
              confidence: nlsResult.confidence,
              processType: nlsResult.processType,
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
            error:
              "Request appears to be a token operation, but process type could not be confirmed. Please provide process documentation or use executeTokenRequest for token operations.",
            success: false,
            suggestions: defaultProcessService.getSuggestedOperations("token"),
          };
        }

        return {
          error:
            "Could not process request. Please provide process documentation using processMarkdown parameter.",
          success: false,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    },

    interpretResponse: (
      response: AOMessageResponse,
      handler: HandlerInfo,
    ): ProcessResponse => {
      if (!response.success) {
        return {
          error: response.error || "Process execution failed",
          handlerUsed: handler.action,
          success: false,
        };
      }

      let interpretedData = response.data;

      // Handle AO message structure with Data field
      if (
        response.data &&
        typeof response.data === "object" &&
        "Data" in response.data &&
        typeof response.data.Data === "string"
      ) {
        try {
          const jsonData = JSON.parse(response.data.Data);
          interpretedData = jsonData;

          // Token-specific response handling
          if (handler.action === "balance" && jsonData.Balance !== undefined) {
            // For balance queries, return structured balance information
            interpretedData = {
              account: jsonData.Account || "unknown",
              balance: jsonData.Balance,
              rawData: jsonData,
              ticker: jsonData.Ticker || "unknown",
            };
          } else if (handler.action === "info" && jsonData.Name !== undefined) {
            // For info queries, return structured token information
            interpretedData = {
              burnable: jsonData.Burnable,
              denomination: jsonData.Denomination,
              description: jsonData.Description,
              logo: jsonData.Logo,
              mintingStrategy: jsonData.MintingStrategy,
              name: jsonData.Name,
              owner: jsonData.Owner,
              processId: jsonData.ProcessId,
              rawData: jsonData,
              ticker: jsonData.Ticker,
              totalSupply: jsonData.TotalSupply,
              transferable: jsonData.Transferable,
            };
          }
        } catch {
          // Fall back to raw data if JSON parsing fails
          interpretedData = response.data.Data;
        }
      }

      return {
        data: interpretedData,
        handlerUsed: handler.action,
        success: true,
      };
    },

    matchRequestToHandler: (
      request: string,
      handlers: HandlerInfo[],
    ): HandlerMatch | null => {
      const requestLower = request.toLowerCase();
      let bestMatch: HandlerMatch | null = null;
      let highestScore = 0;

      for (const handler of handlers) {
        const score = calculateMatchScore(requestLower, handler);
        if (score > highestScore && score > 0.3) {
          const parameters = extractParameters(request, handler);
          bestMatch = {
            confidence: score,
            handler,
            parameters,
          };
          highestScore = score;
        }
      }

      return bestMatch;
    },

    parseMarkdown: (markdown: string): ProcessDefinition => {
      const lines = markdown.split("
");
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
            isWrite: isWriteAction(action),
            parameters: [],
          };
        } else if (currentHandler && line.startsWith("- ")) {
          const paramLine = line.substring(2).trim();
          const parameter = parseParameter(paramLine);
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

      return {
        handlers,
        name: processName,
        processId: "",
      };
    },
  };
};

const isWriteAction = (action: string): boolean => {
  const actionLower = action.toLowerCase();
  return WRITE_KEYWORDS.some((keyword) => actionLower.includes(keyword));
};

const parseParameter = (paramLine: string): null | ParameterInfo => {
  const colonIndex = paramLine.indexOf(":");
  if (colonIndex === -1) return null;

  const name = paramLine.substring(0, colonIndex).trim();
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

  return {
    description,
    name,
    required,
    type,
  };
};

const calculateMatchScore = (request: string, handler: HandlerInfo): number => {
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
      score += 0.4; // Slightly less than exact match
      break;
    }
  }

  const descriptionWords = handler.description.toLowerCase().split(" ");
  const requestWords = request.split(" ");

  for (const word of requestWords) {
    if (descriptionWords.includes(word)) {
      score += 0.1;
    }
  }

  for (const param of handler.parameters) {
    if (request.includes(param.name.toLowerCase())) {
      score += 0.2;
    }
  }

  return Math.min(score, 1.0);
};

const extractParameters = (
  request: string,
  handler: HandlerInfo,
): Record<string, unknown> => {
  const parameters: Record<string, unknown> = {};
  const requestLower = request.toLowerCase();

  for (const param of handler.parameters) {
    const value = extractParameterValue(
      requestLower,
      param.name.toLowerCase(),
      param.type,
    );
    if (value !== null) {
      parameters[param.name] = value;
    }
  }

  return parameters;
};

const extractParameterValue = (
  request: string,
  paramName: string,
  paramType: ParameterInfo["type"],
): unknown => {
  // Parameter-specific patterns first
  const specificPatterns = [
    new RegExp(`${paramName}\s*[=:]\s*["']?([^"'\s]+)["']?`, "i"),
    new RegExp(`${paramName}\s+([^\s]+)`, "i"),
  ];

  // Check parameter-specific patterns first
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

  // Type-specific fallback patterns based on parameter type and common patterns
  if (paramType === "number") {
    // Look for numbers in various contexts
    const numberPatterns = [
      new RegExp(`send\s+([0-9.]+)`, "i"),
      new RegExp(`transfer\s+([0-9.]+)`, "i"),
      new RegExp(`amount\s*[=:]?\s*([0-9.]+)`, "i"),
      new RegExp(`([0-9.]+)\s+tokens?`, "i"),
      new RegExp(`([0-9.]+)\s+to`, "i"), // amount before "to"
      new RegExp(`([0-9.]+)`), // Last resort: any number
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
    // Handle different string parameter types
    if (paramName === "recipient" || paramName === "to") {
      // Address/recipient patterns
      const addressPatterns = [
        /to\s+([^\s]+)/i,
        /recipient\s+([^\s]+)/i,
        /send\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i, // "send X tokens to alice"
        /transfer\s+[0-9.]+\s+(?:tokens?\s+)?to\s+([^\s]+)/i, // "transfer X tokens to alice"
      ];

      for (const pattern of addressPatterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    } else if (paramName === "account" || paramName === "address") {
      // Account/address patterns for balance checks etc.
      const accountPatterns = [
        new RegExp(`account\s+([^\s]+)`, "i"),
        new RegExp(`address\s+([^\s]+)`, "i"),
        new RegExp(`for\s+([^\s]+)`, "i"), // "balance for alice"
        new RegExp(`of\s+([^\s]+)`, "i"), // "balance of alice"
      ];

      for (const pattern of accountPatterns) {
        const match = request.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }

  return null;
};

export const processCommunicationService = service();
