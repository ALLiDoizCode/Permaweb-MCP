import { z } from "zod";

import { event } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/aiMemoryService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface SaveTokenMappingArgs {
  name: string;
  processId: string;
  ticker: string;
}

/**
 * Command to save a token name/ticker to process ID mapping for future use
 * Stores mappings in the token registry (Kind 30) for retrieval by TokenResolver
 */
export class SaveTokenMappingCommand extends ToolCommand<
  SaveTokenMappingArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Save a token name/ticker to process ID mapping for future use",
    name: "saveTokenMapping",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Save Token Mapping",
  };

  protected parametersSchema = z.object({
    name: z.string().min(1).max(50).describe("Full token name"),
    processId: CommonSchemas.processId.describe("The AO token process ID"),
    ticker: z
      .string()
      .min(1)
      .max(10)
      .transform((s) => s.toUpperCase())
      .describe("Token symbol/ticker"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SaveTokenMappingArgs): Promise<string> {
    try {
      // Transform ticker to uppercase
      const ticker = args.ticker.toUpperCase();

      // Use dedicated token mapping kind for better filtering
      const tags = [
        { name: "Kind", value: MEMORY_KINDS.TOKEN_MAPPING },
        {
          name: "Content",
          value: `Token mapping: ${args.name} (${ticker}) -> ${args.processId}`,
        },
        { name: "p", value: this.context.publicKey },
        { name: "token_name", value: args.name },
        { name: "token_ticker", value: ticker },
        { name: "token_processId", value: args.processId },
        { name: "domain", value: "token-registry" },
      ];

      const result = await event(
        this.context.keyPair,
        this.context.hubId,
        tags,
      );

      return JSON.stringify({
        mapping: {
          name: args.name,
          processId: args.processId,
          ticker: ticker,
        },
        message: `Token mapping saved: ${args.name} (${ticker}) -> ${args.processId}`,
        success: true,
        tags: result,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to save token mapping: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
