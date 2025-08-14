import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { resolveToken } from "../utils/TokenResolver.js";

interface GetTokenBalancesArgs {
  confirmed?: boolean;
  processId: string;
}

export class GetTokenBalancesCommand extends ToolCommand<
  GetTokenBalancesArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Get all token balances for all holders of a token. Returns a list of all addresses that hold the token and their respective balances.",
    name: "getTokenBalances",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Token Balances",
  };

  protected parametersSchema = z.object({
    confirmed: z
      .boolean()
      .optional()
      .describe("Set to true to confirm resolved token"),
    processId: z.string().describe("The AO token process ID, name, or ticker"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: GetTokenBalancesArgs): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { hubId } = await safeContext.initializeAll();

      // Dynamic import to avoid circular dependencies
      const { read } = await import("../../../process.js");

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

      // Get all balances
      const tags = [{ name: "Action", value: "Balances" }];

      const result = await read(processId, tags);

      return JSON.stringify({
        balances: result?.Data ? JSON.parse(result.Data) : null,
        message: `All token holder balances retrieved`,
        query: {
          processId,
        },
        result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Balances query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
