import Arweave from "arweave";
import { z } from "zod";

import { getKeyFromMnemonic, validateMnemonic } from "../../../mnemonic.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface GenerateKeypairParams {
  seedPhrase?: string;
}

export class GenerateKeypairCommand extends ToolCommand<
  GenerateKeypairParams,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Generate a new Arweave keypair from a seed phrase or randomly",
    name: "generateKeypair",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Generate Keypair",
  };

  protected parametersSchema = z.object({
    seedPhrase: z
      .string()
      .optional()
      .describe(
        "Optional 12-word mnemonic seed phrase for deterministic key generation",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(params: GenerateKeypairParams): Promise<string> {
    try {
      const arweave = Arweave.init({});
      let keyPair;

      if (params.seedPhrase) {
        // Validate the seed phrase first
        const isValidMnemonic = await validateMnemonic(params.seedPhrase);
        if (!isValidMnemonic) {
          return JSON.stringify({
            error: "Invalid seed phrase. Must be a valid 12-word mnemonic.",
            success: false,
          });
        }

        // Generate keypair from seed phrase
        keyPair = await getKeyFromMnemonic(params.seedPhrase);
      } else {
        // Generate random keypair
        keyPair = await arweave.wallets.generate();
      }

      // Get public key (address)
      const publicKey = await arweave.wallets.jwkToAddress(keyPair);

      return JSON.stringify({
        publicKey,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to generate keypair: ${error instanceof Error ? error.message : "Unknown error"}`,
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
