import type { ProcessDefinition } from "./ProcessCommunicationService.js";

import {
  extractTokenOperation,
  TOKEN_NLS_PATTERNS,
} from "../templates/defaultTokenProcess.js";

/**
 * Token Process Template Service
 * Provides embedded token process templates for natural language processing
 */
export class TokenProcessTemplateService {
  private static readonly DEFAULT_TOKEN_PROCESS_TEMPLATE: ProcessDefinition = {
    handlers: [
      {
        action: "Balance",
        description: "Check token balance for an account",
        examples: [
          "Check my balance",
          "Get balance for alice",
          "What's my token balance?",
        ],
        isWrite: false,
        parameters: [
          {
            description:
              "Account address to check balance for (optional, defaults to sender)",
            name: "Target",
            required: false,
            type: "string",
          },
        ],
      },
      {
        action: "Info",
        description: "Get token information including name, ticker, and supply",
        examples: [
          "Get token info",
          "Show token details",
          "What's this token?",
        ],
        isWrite: false,
        parameters: [],
      },
      {
        action: "Transfer",
        description: "Send tokens to another account",
        examples: [
          "Send 100 tokens to alice",
          "Transfer 50 tokens to bob",
          "Pay alice 25 tokens",
        ],
        isWrite: true,
        parameters: [
          {
            description: "Address to send tokens to (required)",
            name: "Recipient",
            required: true,
            type: "string",
          },
          {
            description: "Amount of tokens to send (required)",
            name: "Quantity",
            required: true,
            type: "string",
          },
        ],
      },
      {
        action: "Balances",
        description: "List all token balances",
        examples: [
          "List all balances",
          "Show all token holders",
          "Get balances",
        ],
        isWrite: false,
        parameters: [],
      },
      {
        action: "SaveMapping",
        description:
          "Save a token name/ticker to process ID mapping for future use",
        examples: [
          "Save token mapping for Arweave with ticker AR and process xyz123",
          "Register new token called MyToken with ticker MTK at process abc456",
          "Save mapping for TestToken ticker TEST process def789",
        ],
        isWrite: true,
        parameters: [
          {
            description: "Full token name (required)",
            name: "Name",
            required: true,
            type: "string",
          },
          {
            description: "Token symbol/ticker (required)",
            name: "Ticker",
            required: true,
            type: "string",
          },
          {
            description: "AO process ID for the token (required)",
            name: "ProcessId",
            required: true,
            type: "string",
          },
        ],
      },
    ],
    name: "AO Token Process",
    processId: "",
  };

  /**
   * Extract token operation from natural language request
   * @param request - Natural language request
   * @returns Operation result with confidence, operation, and parameters
   */
  static extractTokenOperation(request: string): {
    confidence: number;
    operation: string;
    parameters: Record<string, unknown>;
  } | null {
    return extractTokenOperation(request);
  }

  /**
   * Get the token NLS patterns for natural language processing
   * @returns Token NLS patterns object
   */
  static getTokenNLSPatterns(): typeof TOKEN_NLS_PATTERNS {
    return TOKEN_NLS_PATTERNS;
  }

  /**
   * Get the default token process template
   * @param processId - Process ID to populate in template
   * @returns ProcessDefinition for token operations
   */
  static getTokenTemplate(processId: string): ProcessDefinition {
    return {
      ...TokenProcessTemplateService.DEFAULT_TOKEN_PROCESS_TEMPLATE,
      processId,
    };
  }

  /**
   * Get the embedded token process template as markdown
   * @param processId - Process ID to populate in template
   * @returns Markdown string representation of the template
   */
  static getTokenTemplateAsMarkdown(processId: string): string {
    const template = TokenProcessTemplateService.getTokenTemplate(processId);
    let markdown = `# ${template.name}

`;

    for (const handler of template.handlers) {
      markdown += `## ${handler.action}

`;
      markdown += `${handler.description}

`;

      if (handler.parameters && handler.parameters.length > 0) {
        for (const param of handler.parameters) {
          const required = param.required ? "required" : "optional";
          markdown += `- ${param.name}: ${param.description} (${required})
`;
        }
        markdown += "
";
      }

      if (handler.examples && handler.examples.length > 0) {
        markdown += "Examples:
";
        for (const example of handler.examples) {
          markdown += `- ${example}
`;
        }
        markdown += "
";
      }
    }

    return markdown;
  }

  /**
   * Check if a process type is supported by this template service
   * @param processType - Process type to check
   * @returns True if supported, false otherwise
   */
  static isSupported(processType: string): boolean {
    return processType.toLowerCase() === "token";
  }

  /**
   * Process a natural language request using embedded token patterns
   * @param request - Natural language request
   * @param processId - Process ID for the token
   * @returns Enhanced result with template integration
   */
  static processTokenRequest(
    request: string,
    processId: string,
  ): {
    confidence: number;
    operation: string;
    parameters: Record<string, unknown>;
    processType: string;
    template: ProcessDefinition;
  } | null {
    const result = extractTokenOperation(request);
    if (!result) {
      return null;
    }

    return {
      ...result,
      processType: "token",
      template: TokenProcessTemplateService.getTokenTemplate(processId),
    };
  }
}
