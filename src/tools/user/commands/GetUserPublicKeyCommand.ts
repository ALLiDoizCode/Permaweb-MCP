import { z } from "zod";

import { getCurrentUserState } from "../../../server.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

export class GetUserPublicKeyCommand extends ToolCommand<
  Record<string, never>,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Get the current user's public key (wallet address)",
    name: "getUserPublicKey",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get User Public Key",
  };

  protected parametersSchema = z.object({});

  constructor(private context: ToolContext) {
    super();
  }

  async execute(): Promise<string> {
    try {
      const { initializationComplete, publicKey } = getCurrentUserState();

      // Check if initialization is still in progress
      if (
        !initializationComplete ||
        !publicKey ||
        publicKey === "initializing"
      ) {
        return JSON.stringify({
          error:
            "Wallet is still initializing. Please wait a moment and try again.",
          success: false,
        });
      }

      return JSON.stringify({
        publicKey,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to get user public key: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
