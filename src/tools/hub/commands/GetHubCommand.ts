import { z } from "zod";

import { HUB_REGISTRY_ID } from "../../../constants.js";
import { getCurrentUserState } from "../../../server.js";
import { hubRegistryService } from "../../../services/RegistryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const getHubParametersSchema = z.object({
  publicKey: z
    .string()
    .optional()
    .describe(
      "Public key/address to look up hub for. If not provided, uses current user's public key",
    ),
});

type GetHubParameters = z.infer<typeof getHubParametersSchema>;

export class GetHubCommand extends ToolCommand<GetHubParameters, string> {
  protected metadata: ToolMetadata = {
    description:
      "Get hub information from the registry. If no public key provided, gets current user's hub",
    name: "getHub",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Hub",
  };

  protected parametersSchema = getHubParametersSchema;

  constructor(private context: ToolContext) {
    super();
  }

  async execute(params: GetHubParameters): Promise<string> {
    try {
      let publicKey = params.publicKey;

      // If no public key provided, use current user's public key
      if (!publicKey) {
        const { initializationComplete, publicKey: currentUserPublicKey } =
          getCurrentUserState();

        if (!initializationComplete || !currentUserPublicKey) {
          return JSON.stringify({
            error:
              "No public key provided and user is not initialized. Please provide a public key or initialize the user first.",
            success: false,
          });
        }

        publicKey = currentUserPublicKey;
      }

      const zone = await hubRegistryService.getZoneById(
        HUB_REGISTRY_ID(),
        publicKey,
      );

      if (!zone || !zone.spec) {
        return JSON.stringify({
          error: "No hub found for this public key",
          success: false,
        });
      }

      return JSON.stringify({
        hub: {
          processId: (zone.spec as { processId: string }).processId,
          profile: (zone.spec as { profile: object }).profile,
          type: (zone.spec as { type: string }).type,
          version: (zone.spec as { version: string }).version,
        },
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to get hub: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
