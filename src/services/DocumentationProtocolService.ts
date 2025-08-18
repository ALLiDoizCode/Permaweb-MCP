import { z } from "zod";

/**
 * AO Documentation Protocol (ADP) - Version 1.0
 *
 * This service implements a standardized protocol for AO processes to automatically
 * document their capabilities through an enhanced Info handler.
 *
 * The protocol extends existing Info handlers to include comprehensive metadata,
 * making processes self-documenting and enabling tools like Permamind's
 * executeAction to automatically discover process capabilities.
 */

export interface ExtendedInfoResponse {
  capabilities?: {
    supportsExamples: boolean;
    supportsHandlerRegistry: boolean;
    supportsParameterValidation?: boolean; // Optional for backward compatibility
  };
  Denomination?: string;
  Description?: string;
  // ADP fields
  handlers?: HandlerMetadata[];
  lastUpdated: string;
  Logo?: string;
  // Standard AO process info fields
  Name?: string;
  Owner?: string;

  ProcessId?: string;
  protocolVersion: "1.0";
  Ticker?: string;
  TotalSupply?: string;
}

export interface HandlerMetadata {
  action: string;
  category?: "core" | "custom" | "utility";
  description?: string;
  examples?: string[];
  parameters?: HandlerParameter[];
  pattern?: string[]; // Optional tags (e.g., ["Action"] or ["Action", "Target"])
  version?: string;
}

export interface HandlerParameter {
  description?: string;
  examples?: string[];
  name: string;
  required: boolean;
  type: "address" | "boolean" | "json" | "number" | "string";
  validation?: {
    enum?: string[]; // allowed values
    max?: number; // maximum value for numbers
    min?: number; // minimum value for numbers
    pattern?: string; // regex pattern for string validation
  };
}

// Zod schemas for validation
export const HandlerParameterSchema = z.object({
  description: z.string().optional(),
  examples: z.array(z.string()).optional(),
  name: z.string(),
  required: z.boolean(),
  type: z.enum(["string", "number", "boolean", "address", "json"]),
  validation: z
    .object({
      enum: z.array(z.string()).optional(),
      max: z.number().optional(),
      min: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const HandlerMetadataSchema = z.object({
  action: z.string(),
  category: z.string()
    .optional()
    .transform((val) => {
      // Transform any unknown category to "custom" for backward compatibility
      if (!val || !["core", "utility", "custom"].includes(val)) {
        return "custom";
      }
      return val as "core" | "utility" | "custom";
    }),
  description: z.string().optional(),
  examples: z.array(z.string()).optional(),
  parameters: z.array(HandlerParameterSchema).optional(),
  pattern: z.array(z.string()).optional(), // Made optional since many handlers don't include it
  version: z.string().optional(),
});

export const ExtendedInfoResponseSchema = z.object({
  capabilities: z
    .object({
      supportsExamples: z.boolean(),
      supportsHandlerRegistry: z.boolean(),
      supportsParameterValidation: z.boolean().optional(),
    })
    .optional(),
  Denomination: z.string().optional(),
  Description: z.string().optional(),
  // ADP fields
  handlers: z.array(HandlerMetadataSchema).optional(),
  lastUpdated: z.string(),
  Logo: z.string().optional(),
  // Standard fields
  Name: z.string().optional(),
  Owner: z.string().optional(),

  ProcessId: z.string().optional(),
  protocolVersion: z.literal("1.0"),
  Ticker: z.string().optional(),
  TotalSupply: z.string().optional(),
});

export class DocumentationProtocolService {
  /**
   * Extract handler by action name
   */
  static findHandler(
    infoResponse: ExtendedInfoResponse,
    action: string,
  ): HandlerMetadata | null {
    return infoResponse.handlers?.find((h) => h.action === action) || null;
  }

  /**
   * Generate an enhanced Info handler that includes handler metadata
   */
  static generateEnhancedInfoHandler(
    standardInfo: Partial<ExtendedInfoResponse>,
    handlers: HandlerMetadata[],
  ): string {
    const infoResponse: ExtendedInfoResponse = {
      ...standardInfo,
      capabilities: {
        supportsExamples: true,
        supportsHandlerRegistry: true,
        supportsParameterValidation: true,
      },
      handlers,
      lastUpdated: new Date().toISOString(),
      protocolVersion: "1.0",
    };

    return `
-- Enhanced Info Handler with AO Documentation Protocol (ADP) v1.0
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    local infoResponse = ${JSON.stringify(infoResponse, null, 2)}
    
    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
end)`;
  }

  /**
   * Generate message tags from handler metadata and parameters
   */
  static generateMessageTags(
    handler: HandlerMetadata,
    parameters: Record<string, any>,
  ): Array<{ name: string; value: string }> {
    const tags: Array<{ name: string; value: string }> = [];

    // Add required pattern tags (if pattern is defined)
    if (handler.pattern) {
      handler.pattern.forEach((tagName) => {
        if (tagName === "Action") {
          tags.push({ name: "Action", value: handler.action });
        } else if (parameters[tagName] !== undefined) {
          tags.push({ name: tagName, value: String(parameters[tagName]) });
        }
      });
    } else {
      // Default to Action tag if no pattern is defined
      tags.push({ name: "Action", value: handler.action });
    }

    // Add parameter tags
    handler.parameters?.forEach((param) => {
      const value = parameters[param.name];
      if (value !== undefined) {
        tags.push({ name: param.name, value: String(value) });
      }
    });

    return tags;
  }

  /**
   * Generate common handler metadata for basic processes
   */
  static getBasicProcessHandlerMetadata(): HandlerMetadata[] {
    return [
      {
        action: "Info",
        category: "core",
        description: "Get process information and handler metadata",
        examples: ["Send Info message to get process details"],
        pattern: ["Action"],
      },
      {
        action: "Ping",
        category: "utility",
        description: "Test if process is responding",
        examples: ["Send Ping to test connectivity"],
        pattern: ["Action"],
      },
    ];
  }

  /**
   * Generate common handler metadata for token processes
   */
  static getTokenHandlerMetadata(): HandlerMetadata[] {
    return [
      {
        action: "Info",
        category: "core",
        description: "Get comprehensive token information and handler metadata",
        examples: ["Send Info message to get token details"],
        pattern: ["Action"],
      },
      {
        action: "Balance",
        category: "core",
        description: "Get token balance for a specific address",
        examples: ["Check your own balance", "Check another address balance"],
        parameters: [
          {
            description: "Address to check balance for (defaults to sender)",
            examples: ["vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"],
            name: "Target",
            required: false,
            type: "address",
          },
        ],
        pattern: ["Action"],
      },
      {
        action: "Transfer",
        category: "core",
        description: "Transfer tokens to another address",
        examples: ["Transfer 100 tokens to address"],
        parameters: [
          {
            description: "Recipient address",
            examples: ["vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"],
            name: "Target",
            required: true,
            type: "address",
          },
          {
            description: "Amount to transfer (in token units)",
            examples: ["100", "1000000000000"],
            name: "Quantity",
            required: true,
            type: "string",
            validation: {
              pattern: "^[0-9]+$",
            },
          },
        ],
        pattern: ["Action"],
      },
      {
        action: "Balances",
        category: "utility",
        description: "Get all token balances",
        examples: ["Get all holder balances"],
        pattern: ["Action"],
      },
    ];
  }

  /**
   * Parse an Info response to extract ADP handler metadata
   */
  static parseInfoResponse(responseData: string): ExtendedInfoResponse | null {
    try {
      const parsed = JSON.parse(responseData);

      // Check if this response includes ADP data
      if (parsed.protocolVersion === "1.0" && parsed.handlers) {
        return ExtendedInfoResponseSchema.parse(parsed);
      }

      // Return legacy format as-is
      return null;
    } catch (error) {
      console.warn("Failed to parse Info response as ADP format:", error);
      return null;
    }
  }

  /**
   * Validate parameters against handler metadata
   */
  static validateParameters(
    handler: HandlerMetadata,
    parameters: Record<string, any>,
  ): { errors: string[]; valid: boolean } {
    const errors: string[] = [];

    // Check required parameters
    handler.parameters?.forEach((param) => {
      if (param.required && parameters[param.name] === undefined) {
        errors.push(`Required parameter '${param.name}' is missing`);
      }

      const value = parameters[param.name];
      if (value !== undefined) {
        // Type validation
        if (param.type === "number" && isNaN(Number(value))) {
          errors.push(`Parameter '${param.name}' must be a number`);
        }

        if (param.type === "boolean" && typeof value !== "boolean") {
          errors.push(`Parameter '${param.name}' must be a boolean`);
        }

        // Pattern validation
        if (param.validation?.pattern && typeof value === "string") {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(value)) {
            errors.push(
              `Parameter '${param.name}' does not match required pattern`,
            );
          }
        }

        // Enum validation
        if (
          param.validation?.enum &&
          !param.validation.enum.includes(String(value))
        ) {
          errors.push(
            `Parameter '${param.name}' must be one of: ${param.validation.enum.join(", ")}`,
          );
        }
      }
    });

    return { errors, valid: errors.length === 0 };
  }
}
