import { createDataItemSigner, message, result } from "@permaweb/aoconnect";
import { JWKInterface } from "arweave/node/lib/wallet.js";
import { z } from "zod";

import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
  HandlerMetadata,
} from "./DocumentationProtocolService.js";

/**
 * Service for discovering AO process capabilities using the Handler Registry Protocol
 */
export class ProcessDiscoveryService {
  /**
   * Query a process for its handler metadata using the enhanced Info protocol
   */
  static async discoverProcessHandlers(
    processId: string,
    keyPair: JWKInterface,
    timeoutMs: number = 10000,
  ): Promise<{
    error?: string;
    handlers?: HandlerMetadata[];
    legacy?: boolean;
    rawResponse?: any;
    success: boolean;
  }> {
    try {
      const signer = createDataItemSigner(keyPair);

      // Send Info message to process
      const messageId = await message({
        process: processId,
        signer,
        tags: [{ name: "Action", value: "Info" }],
      });

      // Get the result with timeout
      const response = (await Promise.race([
        result({
          message: messageId,
          process: processId,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs),
        ),
      ])) as any;

      if (!response?.Messages || response.Messages.length === 0) {
        return {
          error: "No response received from process",
          success: false,
        };
      }

      const responseMessage = response.Messages[0];
      const responseData = responseMessage.Data;

      if (!responseData) {
        return {
          error: "Empty response data",
          success: false,
        };
      }

      // Try to parse as enhanced Info response
      const enhancedInfo =
        DocumentationProtocolService.parseInfoResponse(responseData);

      if (enhancedInfo && enhancedInfo.handlers) {
        return {
          handlers: enhancedInfo.handlers,
          legacy: false,
          rawResponse: enhancedInfo,
          success: true,
        };
      }

      // Fall back to legacy response
      try {
        const legacyInfo = JSON.parse(responseData);
        return {
          handlers: [],
          legacy: true,
          rawResponse: legacyInfo,
          success: true,
        };
      } catch (parseError) {
        return {
          error: `Failed to parse response: ${parseError}`,
          rawResponse: responseData,
          success: false,
        };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  /**
   * Generate process documentation markdown from discovered handlers
   */
  static generateProcessMarkdown(
    processInfo: ExtendedInfoResponse,
    processId: string,
  ): string {
    let markdown = `# ${processInfo.Name || "AO Process"}\n\n`;

    if (processInfo.Description) {
      markdown += `${processInfo.Description}\n\n`;
    }

    if (processInfo.Ticker) {
      markdown += `**Ticker:** ${processInfo.Ticker}\n`;
    }

    if (processInfo.TotalSupply) {
      markdown += `**Total Supply:** ${processInfo.TotalSupply}\n`;
    }

    if (processInfo.Owner) {
      markdown += `**Owner:** ${processInfo.Owner}\n`;
    }

    markdown += `**Process ID:** ${processId}\n\n`;

    if (processInfo.protocolVersion) {
      markdown += `**Protocol Version:** ${processInfo.protocolVersion} (Handler Registry Protocol)\n\n`;
    }

    if (processInfo.handlers && processInfo.handlers.length > 0) {
      markdown += "## Available Handlers\n\n";

      // Group handlers by category
      const categories: Record<string, HandlerMetadata[]> = {
        core: [],
        custom: [],
        utility: [],
      };

      processInfo.handlers.forEach((handler: HandlerMetadata) => {
        const category = handler.category || "custom";
        if (categories[category]) {
          categories[category].push(handler);
        }
      });

      // Render each category
      Object.entries(categories).forEach(([categoryName, handlers]) => {
        if (handlers.length === 0) return;

        markdown += `### ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Handlers\n\n`;

        handlers.forEach((handler) => {
          markdown += `#### ${handler.action}\n\n`;

          if (handler.description) {
            markdown += `${handler.description}\n\n`;
          }

          if (handler.parameters && handler.parameters.length > 0) {
            markdown += "**Parameters:**\n";
            handler.parameters.forEach((param: any) => {
              const required = param.required ? "required" : "optional";
              markdown += `- \`${param.name}\` (${param.type}, ${required}): ${param.description || "No description"}\n`;

              if (param.examples && param.examples.length > 0) {
                markdown += `  - Examples: ${param.examples.map((ex: string) => `\`${ex}\``).join(", ")}\n`;
              }
            });
            markdown += "\n";
          }

          if (handler.examples && handler.examples.length > 0) {
            markdown += "**Examples:**\n";
            handler.examples.forEach((example: string) => {
              markdown += `- ${example}\n`;
            });
            markdown += "\n";
          }
        });
      });
    }

    if (processInfo.capabilities) {
      markdown += "## Capabilities\n\n";
      markdown += `- Handler Registry: ${processInfo.capabilities.supportsHandlerRegistry ? "✅" : "❌"}\n`;
      markdown += `- Parameter Validation: ${processInfo.capabilities.supportsParameterValidation ? "✅" : "❌"}\n`;
      markdown += `- Examples: ${processInfo.capabilities.supportsExamples ? "✅" : "❌"}\n\n`;
    }

    return markdown;
  }

  /**
   * Auto-discover process type based on handlers and info
   */
  static inferProcessType(processInfo: ExtendedInfoResponse): string {
    if (!processInfo.handlers) {
      return "unknown";
    }

    const handlerActions = processInfo.handlers.map((h: HandlerMetadata) =>
      h.action.toLowerCase(),
    );

    // Check for token-like processes
    if (
      handlerActions.includes("balance") &&
      handlerActions.includes("transfer") &&
      processInfo.Ticker
    ) {
      return "token";
    }

    // Check for basic processes
    if (handlerActions.includes("ping")) {
      return "basic";
    }

    // Check for DAO-like processes
    if (handlerActions.includes("propose") || handlerActions.includes("vote")) {
      return "dao";
    }

    return "custom";
  }

  /**
   * Validate if a handler supports the requested action
   */
  static validateHandlerAction(
    handlers: HandlerMetadata[],
    action: string,
    parameters: Record<string, any>,
  ): { errors: string[]; handler?: HandlerMetadata; valid: boolean } {
    const handler = handlers.find(
      (h) => h.action.toLowerCase() === action.toLowerCase(),
    );

    if (!handler) {
      return {
        errors: [
          `Handler '${action}' not found. Available handlers: ${handlers.map((h) => h.action).join(", ")}`,
        ],
        valid: false,
      };
    }

    const validation = DocumentationProtocolService.validateParameters(
      handler,
      parameters,
    );

    return {
      errors: validation.errors,
      handler,
      valid: validation.valid,
    };
  }
}
