import Arweave from "arweave";
import { z } from "zod";

import { getKeyFromMnemonic } from "../../../mnemonic.js";
import { ProfileCreateData } from "../../../models/Profile.js";
import { hubRegistryService } from "../../../services/RegistryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const createHubParametersSchema = z.object({
  coverImage: z.string().optional().describe("Profile cover image URL"),
  description: z.string().optional().describe("Hub description"),
  displayName: z.string().optional().describe("Display name for the hub"),
  seedPhrase: z
    .string()
    .optional()
    .describe("Optional seed phrase for deterministic wallet generation"),
  thumbnail: z.string().optional().describe("Profile thumbnail URL"),
  userName: z.string().optional().describe("Username for the hub"),
  website: z.string().optional().describe("Website URL"),
});

type CreateHubParameters = z.infer<typeof createHubParametersSchema>;

export class CreateHubCommand extends ToolCommand<CreateHubParameters, string> {
  protected metadata: ToolMetadata = {
    description:
      "Create a new hub in the Velocity protocol registry with wallet generation",
    name: "createHub",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Create Hub",
  };

  protected parametersSchema = createHubParametersSchema;

  constructor(private context: ToolContext) {
    super();
  }

  async execute(params: CreateHubParameters): Promise<string> {
    try {
      const arweave = Arweave.init({});

      // Generate or derive wallet
      let keyPair;
      if (params.seedPhrase) {
        keyPair = await getKeyFromMnemonic(params.seedPhrase);
      } else {
        keyPair = await arweave.wallets.generate();
      }

      const publicKey = await arweave.wallets.jwkToAddress(keyPair);

      // Create profile data
      const profileData: ProfileCreateData = {
        bot: false, // User-created hubs are not bots by default
        coverImage: params.coverImage || "",
        description: params.description || "",
        displayName: params.displayName || "",
        thumbnail: params.thumbnail || "",
        userName: params.userName || "",
        website: params.website || "",
      };

      // Create the hub
      const hubId = await hubRegistryService.create(keyPair, profileData);

      return JSON.stringify({
        hubId,
        publicKey,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to create hub: ${error instanceof Error ? error.message : "Unknown error"}`,
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
