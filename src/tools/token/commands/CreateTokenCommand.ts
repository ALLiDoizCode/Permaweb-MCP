import { z } from "zod";

import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface CreateTokenArgs {
  adminAddress?: string;
  burnable?: boolean;
  denomination?: number;
  description?: string;
  initialSupply?: string;
  logo?: string;
  maxMint?: string;
  mintingStrategy?: "basic" | "cascade" | "double_mint" | "none";
  name: string;
  ticker: string;
}

export class CreateTokenCommand extends ToolCommand<CreateTokenArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Create a new AO token process using the token blueprint. This deploys the actual token contract code via evalProcess, not just sending messages.",
    name: "createToken",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Create Token",
  };

  protected parametersSchema = z.object({
    adminAddress: z
      .string()
      .optional()
      .describe("Admin address for token management (optional)"),
    burnable: z
      .boolean()
      .optional()
      .describe("Whether tokens can be burned (default: false)"),
    denomination: z
      .number()
      .optional()
      .describe("Number of decimal places (default: 12)"),
    description: z.string().optional().describe("Token description"),
    initialSupply: z
      .string()
      .optional()
      .describe("Initial token supply to mint"),
    logo: z.string().optional().describe("Token logo URL or Arweave TX ID"),
    maxMint: z.string().optional().describe("Maximum mintable supply"),
    mintingStrategy: z
      .enum(["basic", "cascade", "double_mint", "none"])
      .optional()
      .describe("Minting strategy (default: none)"),
    name: z.string().describe("Token name"),
    ticker: z.string().describe("Token ticker symbol"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: CreateTokenArgs): Promise<string> {
    try {
      // Dynamic import to avoid circular dependencies
      const { generateTokenLua } = await import(
        "../../../services/TokenLuaService.js"
      );
      const { tokenService } = await import("../../../services/tokenservice.js");

      // Build token configuration
      const tokenConfig = {
        adminAddress: args.adminAddress || this.context.publicKey,
        burnable: args.burnable || false,
        denomination: args.denomination || 12,
        description: args.description,
        initialSupply: args.initialSupply,
        logo: args.logo,
        maxMint: args.maxMint,
        mintingStrategy: args.mintingStrategy || "none",
        name: args.name,
        ticker: args.ticker,
      };

      // Generate the token Lua code using generateTokenLua
      const tokenLuaCode = generateTokenLua(tokenConfig);

      // Create the token process using evalProcess (via tokenService)
      const processId = await tokenService.create(
        this.context.keyPair,
        tokenLuaCode,
      );

      // If initial supply specified, mint to creator
      if (args.initialSupply) {
        // Wait a moment for the process to be ready
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Import send function to mint initial supply
        const { send } = await import("../../../process.js");

        const mintTags = [
          { name: "Action", value: "Mint" },
          { name: "Recipient", value: this.context.publicKey },
          { name: "Quantity", value: args.initialSupply },
        ];

        await send(this.context.keyPair, processId, mintTags, null);
      }

      return JSON.stringify({
        config: tokenConfig,
        message: `Token "${args.name}" (${args.ticker}) created successfully${
          args.initialSupply ? ` with ${args.initialSupply} tokens minted` : ""
        }`,
        processId,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Token creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}