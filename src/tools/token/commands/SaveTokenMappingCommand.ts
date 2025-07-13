import { z } from "zod";

import { event } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/AIMemoryService.js";
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

export class SaveTokenMappingCommand extends ToolCommand<
  SaveTokenMappingArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Save a token name/ticker to processId mapping for future use",
    name: "saveTokenMapping",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Save Token Mapping",
  };

  protected parametersSchema = z.object({
    name: z.string().describe("Token name"),
    processId: CommonSchemas.processId.describe("AO process ID for the token"),
    ticker: z.string().describe("Token ticker/symbol"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SaveTokenMappingArgs): Promise<string> {
    try {
      // Use dedicated token mapping kind for better filtering
      const tags = [
        { name: "Kind", value: MEMORY_KINDS.TOKEN_MAPPING },
        {
          name: "Content",
          value: `Token mapping: name: ${args.name}, ticker: ${args.ticker}, processId: ${args.processId}`,
        },
        { name: "p", value: this.context.publicKey },
        { name: "token_name", value: args.name },
        { name: "token_ticker", value: args.ticker },
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
          ticker: args.ticker,
        },
        message: `Token mapping saved: ${args.ticker} (${args.name}) -> ${args.processId}`,
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
