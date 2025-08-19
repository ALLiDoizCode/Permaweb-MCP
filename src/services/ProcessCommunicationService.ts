import { JWKInterface } from "arweave/node/lib/wallet.js";

import type { Tag } from "../models/Tag.js";

import { ADPProcessCommunicationService } from "./ADPProcessCommunicationService.js";
import { AOMessage, AOMessageResponse } from "./AOMessageService.js";
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
    embeddedTemplates?: Map<string, ProcessDefinition>,
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
  approach?: "ADP" | "legacy";
  availableHandlers?: string[];
  confidence?: number;
  data?: unknown;
  error?: string;
  handlerUsed?: string;
  parameters?: Record<string, unknown>;
  parametersUsed?: Record<string, unknown>;
  processType?: string;
  success: boolean;
  suggestions?: string[];
  templateUsed?: string;
}

/**
 * Refactored ProcessCommunicationService - Router/Orchestrator Pattern
 *
 * This service now acts as a simple router that:
 * 1. Tries ADP communication first for modern processes
 * 2. Falls back to legacy communication for older processes
 * 3. Maintains backward compatibility with existing APIs
 *
 * Complex logic has been moved to specialized services:
 * - ADPProcessCommunicationService: Handles ADP-compliant processes
 * - LegacyProcessCommunicationService: Handles legacy processes with simplified parsing
 */

const service = (): ProcessCommunicationService => {
  return {
    // Legacy API compatibility - delegates to appropriate service
    buildAOMessage: (
      processId: string,
      handler: HandlerInfo,
      parameters: Record<string, unknown>,
    ): AOMessage => {
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
    },

    // Simplified process type detection
    detectProcessType: async (
      processId: string,
      sampleRequests?: string[],
    ): Promise<null | ProcessTypeDetection> => {
      try {
        if (sampleRequests) {
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
        return null;
      } catch {
        return null;
      }
    },

    // Deprecated: Use ADP-only communication
    executeProcessRequest: async (
      processMarkdown: string,
      processId: string,
      userRequest: string,
      signer: JWKInterface,
    ): Promise<ProcessResponse> => {
      return {
        error:
          "Legacy markdown processing removed. Use ADP-only communication via ADPProcessCommunicationService.",
        success: false,
      };
    },

    // ADP-only routing logic - no legacy fallback
    executeSmartRequest: async (
      processId: string,
      userRequest: string,
      signer: JWKInterface,
      processMarkdown?: string,
      embeddedTemplates?: Map<string, ProcessDefinition>,
    ): Promise<ProcessResponse> => {
      // ADP-only communication
      const adpResult = await ADPProcessCommunicationService.executeRequest(
        processId,
        userRequest,
        signer,
      );

      // Convert ADP result to ProcessResponse format
      return {
        approach: adpResult.approach,
        availableHandlers: adpResult.availableHandlers,
        confidence: adpResult.confidence,
        data: adpResult.data,
        error: adpResult.error,
        handlerUsed: adpResult.handlerUsed,
        parameters: adpResult.parametersUsed,
        parametersUsed: adpResult.parametersUsed,
        success: adpResult.success,
      };
    },

    // Legacy response interpretation - kept for backward compatibility
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
            interpretedData = {
              account: jsonData.Account || "unknown",
              balance: jsonData.Balance,
              rawData: jsonData,
              ticker: jsonData.Ticker || "unknown",
            };
          } else if (handler.action === "info" && jsonData.Name !== undefined) {
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
          interpretedData = response.data.Data;
        }
      }

      return {
        data: interpretedData,
        handlerUsed: handler.action,
        success: true,
      };
    },

    // Deprecated: Use ADP auto-discovery instead
    matchRequestToHandler: (
      request: string,
      handlers: HandlerInfo[],
    ): HandlerMatch | null => {
      return null; // No longer supported - use ADP auto-discovery
    },

    // Deprecated: Use ADP auto-discovery instead
    parseMarkdown: (markdown: string): ProcessDefinition => {
      return {
        handlers: [],
        name: "Deprecated Process",
        processId: "",
      };
    },
  };
};

export const processCommunicationService = service();
