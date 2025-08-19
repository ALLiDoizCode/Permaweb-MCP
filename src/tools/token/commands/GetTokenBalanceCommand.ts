import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { resolveAddress, resolveToken } from "../utils/TokenResolver.js";

interface GetTokenBalanceArgs {
  confirmed?: boolean;
  processId: string;
  target?: string;
}

export class GetTokenBalanceCommand extends ToolCommand<
  GetTokenBalanceArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Core MVP functionality: Get token balance for a specific address. Supports token names/tickers and contact names from registry.",
    name: "getTokenBalance",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Token Balance",
  };

  protected parametersSchema = z.object({
    confirmed: z
      .boolean()
      .optional()
      .describe("Set to true to confirm resolved token/address"),
    processId: z.string().describe("The AO token process ID, name, or ticker"),
    target: z
      .string()
      .optional()
      .describe(
        "Address or contact name to check balance for (optional, defaults to your wallet address)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: GetTokenBalanceArgs): Promise<string> {
    try {
      // Dynamic import to avoid circular dependencies
      const { read } = await import("../../../process.js");

      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { hubId, publicKey } = await safeContext.initializeAll();

      // Resolve token processId if needed
      const tokenResolution = await resolveToken(args.processId, hubId);
      if (!tokenResolution.resolved) {
        return JSON.stringify({
          error: "Token resolution failed",
          message: tokenResolution.verificationMessage,
          success: false,
          suggestion:
            "Use saveTokenMapping to register this token or provide a valid processId",
        });
      }

      if (tokenResolution.requiresVerification && !args.confirmed) {
        return JSON.stringify({
          instruction:
            "Add 'confirmed: true' to your request to proceed with this token",
          message: tokenResolution.verificationMessage,
          requiresConfirmation: true,
          resolvedToken: tokenResolution.value,
          success: false,
        });
      }

      const processId = tokenResolution.value!;

      // Determine target address
      let target = publicKey; // Default to current user

      if (args.target) {
        // Resolve target address if provided
        const addressResolution = await resolveAddress(args.target, hubId);
        if (!addressResolution.resolved) {
          return JSON.stringify({
            error: "Target address resolution failed",
            message: addressResolution.verificationMessage,
            success: false,
            suggestion:
              "Use saveAddressMapping to register this contact or provide a valid address",
          });
        }

        if (addressResolution.requiresVerification && !args.confirmed) {
          return JSON.stringify({
            instruction:
              "Add 'confirmed: true' to your request to proceed with this target",
            message: addressResolution.verificationMessage,
            requiresConfirmation: true,
            resolvedTarget: addressResolution.value,
            success: false,
          });
        }

        target = addressResolution.value!;
      }

      // Get balance
      const tags = [
        { name: "Action", value: "Balance" },
        { name: "Target", value: target },
      ];

      const result = await read(processId, tags);

      return JSON.stringify({
        balance: result?.Data ? JSON.parse(result.Data) : null,
        message: `Balance retrieved for ${target}`,
        query: {
          processId,
          target,
        },
        result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Balance query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
