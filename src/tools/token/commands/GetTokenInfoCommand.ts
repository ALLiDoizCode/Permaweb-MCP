import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { resolveToken } from "../utils/TokenResolver.js";

interface GetTokenInfoArgs {
  confirmed?: boolean;
  processId: string;
}

export class GetTokenInfoCommand extends ToolCommand<GetTokenInfoArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Core MVP functionality: Get comprehensive token information including supply, denomination, and metadata. Supports token names/tickers from registry.",
    name: "getTokenInfo",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Token Info",
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

  async execute(args: GetTokenInfoArgs): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { hubId } = await safeContext.initializeAll();

      const { read } = await import("../../../process.js");

      const tokenResolution = await resolveToken(args.processId, hubId);
      if (!tokenResolution.resolved) {
        return JSON.stringify({
          error: "Token resolution failed",
          message: tokenResolution.verificationMessage,
          success: false,
        });
      }

      if (tokenResolution.requiresVerification && !args.confirmed) {
        return JSON.stringify({
          instruction: "Add 'confirmed: true' to your request to proceed",
          message: tokenResolution.verificationMessage,
          requiresConfirmation: true,
          success: false,
        });
      }

      const processId = tokenResolution.value!;
      const tags = [{ name: "Action", value: "Info" }];
      const result = await read(processId, tags);

      let info = null;
      if (result?.Data) {
        try {
          info = JSON.parse(result.Data);
        } catch {
          // If parsing fails, leave info as null
        }
      }

      return JSON.stringify({
        info,
        processId,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to get token info: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
