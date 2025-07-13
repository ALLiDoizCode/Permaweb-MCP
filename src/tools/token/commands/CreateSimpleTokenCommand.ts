import { z } from "zod";

import { event } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/aiMemoryService.js";
import {
  generateSimpleTokenLua,
  type SimpleTokenConfig,
} from "../../../services/SimpleTokenService.js";
import { tokenService } from "../../../services/tokenservice.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface CreateSimpleTokenArgs {
  denomination?: number;
  name: string;
  ticker: string;
  totalSupply: string;
}

export class CreateSimpleTokenCommand extends ToolCommand<
  CreateSimpleTokenArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Create a simple token with basic transfer functionality. No minting, burning, or advanced features.",
    name: "createSimpleToken",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Create Simple Token",
  };

  protected parametersSchema = z.object({
    denomination: z
      .number()
      .optional()
      .describe("Token decimals (default: 12)"),
    name: z.string().describe("Token name"),
    ticker: z.string().describe("Token ticker/symbol"),
    totalSupply: z.string().describe("Total supply of tokens"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: CreateSimpleTokenArgs): Promise<string> {
    try {
      const config: SimpleTokenConfig = {
        denomination: args.denomination || 12,
        name: args.name,
        ticker: args.ticker,
        totalSupply: args.totalSupply,
      };

      // Generate the token Lua code
      const tokenLua = generateSimpleTokenLua(config);

      // Create the process
      const processId = await tokenService.create(
        this.context.keyPair,
        tokenLua,
      );

      // Save token mapping for future reference
      const tags = [
        { name: "Kind", value: MEMORY_KINDS.TOKEN_MAPPING },
        {
          name: "Content",
          value: `Token mapping: name: ${args.name}, ticker: ${args.ticker}, processId: ${processId}`,
        },
        { name: "p", value: this.context.publicKey },
        { name: "token_name", value: args.name },
        { name: "token_ticker", value: args.ticker },
        { name: "token_processId", value: processId },
        { name: "domain", value: "token-registry" },
      ];

      await event(this.context.keyPair, this.context.hubId, tags);

      return JSON.stringify({
        config,
        mapping: {
          name: args.name,
          processId,
          ticker: args.ticker,
        },
        message: `Simple token created: ${args.ticker} (${args.name}) -> ${processId}`,
        processId,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to create simple token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
