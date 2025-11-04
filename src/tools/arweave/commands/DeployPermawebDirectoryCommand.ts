import { z } from "zod";

import { PermawebDeployService } from "../../../services/PermawebDeployService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface DeployPermawebDirectoryArgs {
  arnsName: string;
  directoryPath: string;
  network?: "mainnet" | "testnet";
  undername?: string;
  useCurrentWallet?: boolean;
  walletPath?: string;
}

export class DeployPermawebDirectoryCommand extends ToolCommand<
  DeployPermawebDirectoryArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Deploy a directory to the Permaweb using permaweb-deploy CLI with ArNS and undername support.
    This tool handles wallet management, directory validation, and deployment execution.
    
    Wallet options:
    - Use current wallet: Generated from SEED_PHRASE environment variable
    - Use custom wallet: Provide path to Arweave wallet JSON file
    
    The tool automatically handles base64 encoding of wallet JSON and sets DEPLOY_KEY environment variable.
    
    Prerequisites:
    - permaweb-deploy CLI tool must be installed
    - Wallet must have Turbo credits for deployment
    - Wallet must have ownership/controller privileges for the ArNS name`,
    name: "deployPermawebDirectory",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Deploy Directory to Permaweb",
  };

  protected parametersSchema = z.object({
    arnsName: z.string().describe("Top-level ArNS name for deployment"),
    directoryPath: z.string().describe("Path to the build directory to deploy"),
    network: z
      .enum(["mainnet", "testnet"])
      .optional()
      .default("mainnet")
      .describe("Network to deploy to (default: mainnet)"),
    undername: z
      .string()
      .optional()
      .describe("Optional undername/subdomain for deployment"),
    useCurrentWallet: z
      .boolean()
      .optional()
      .default(true)
      .describe("Use wallet generated from SEED_PHRASE (default: true)"),
    walletPath: z
      .string()
      .optional()
      .describe(
        "Path to custom Arweave wallet JSON file (if not using current wallet)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: DeployPermawebDirectoryArgs): Promise<string> {
    try {
      const permawebDeployService = new PermawebDeployService();
      const result = await permawebDeployService.deployDirectory({
        arnsName: args.arnsName,
        directoryPath: args.directoryPath,
        network: args.network,
        undername: args.undername,
        useCurrentWallet: args.useCurrentWallet ?? true,
        walletPath: args.walletPath,
      });

      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        error: {
          code: "DEPLOYMENT_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      });
    }
  }
}
