import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet.js";
import { z } from "zod";

import { HUB_REGISTRY_ID } from "../../../constants.js";
import { getKeyFromMnemonic } from "../../../mnemonic.js";
import { ProfileCreateData } from "../../../models/Profile.js";
import { hubRegistryService } from "../../../services/RegistryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const initializeHubParametersSchema = z.object({
  // No parameters needed - hub creation only depends on existing keypair in context
});

type InitializeHubParameters = z.infer<typeof initializeHubParametersSchema>;

export class InitializeHubCommand extends ToolCommand<
  InitializeHubParameters,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Initialize hub for current user. PREREQUISITES: Requires wallet keypair - run 'generateKeypair' first if not already done.",
    name: "initializeHub",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Initialize Hub",
  };

  protected parametersSchema = initializeHubParametersSchema;

  constructor(private context: ToolContext) {
    super();
  }

  async execute(params: InitializeHubParameters): Promise<string> {
    try {
      // Validate that keypair exists in context
      if (!this.context.keyPair) {
        return JSON.stringify({
          error:
            "Wallet keypair not found. Please run 'generateKeypair' first.",
          message: "Missing prerequisites for hub initialization",
          success: false,
        });
      }

      const arweave = Arweave.init({});
      const keyPair = this.context.keyPair;
      const publicKey = await arweave.wallets.jwkToAddress(keyPair);

      // Try to get existing hub first
      let hubId: string;
      try {
        const zone = await hubRegistryService.getZoneById(
          HUB_REGISTRY_ID(),
          publicKey,
        );
        hubId = (zone.spec as { processId: string }).processId;
      } catch (e) {
        // No hub exists, create one
        if (
          e ==
          "TypeError: Cannot read properties of undefined (reading 'processId')"
        ) {
          const profile: ProfileCreateData = {
            bot: true,
            coverImage: "",
            description: "",
            displayName: "",
            thumbnail: "",
            userName: "",
            website: "",
          };
          hubId = await hubRegistryService.create(keyPair, profile);
        } else {
          throw e;
        }
      }

      // Update server state
      const { setUserState } = await import("../../../server.js");
      setUserState({ hubId, keyPair, publicKey });

      return JSON.stringify({
        hubId,
        publicKey,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to initialize hub: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }

  protected requiresSequentialExecution(): boolean {
    return true;
  }

  protected shouldWaitForInitialization(): boolean {
    return false; // This is an initialization tool itself
  }
}
