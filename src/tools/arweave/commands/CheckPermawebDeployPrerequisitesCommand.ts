import { z } from "zod";

import { PermawebDeployService } from "../../../services/PermawebDeployService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface CheckPermawebDeployPrerequisitesArgs {
  arnsName: string;
  directoryPath: string;
  network?: "mainnet" | "testnet";
  undername?: string;
  useCurrentWallet?: boolean;
  walletPath?: string;
}

export class CheckPermawebDeployPrerequisitesCommand extends ToolCommand<
  CheckPermawebDeployPrerequisitesArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Check all prerequisites for permaweb deployment without attempting to deploy.
    This tool validates:
    - permaweb-deploy CLI installation
    - Directory existence and content
    - Wallet configuration and validation
    
    Returns detailed status of each check with helpful solutions for any issues found.
    Use this tool to verify your setup before attempting deployment.`,
    name: "checkPermawebDeployPrerequisites",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Check Permaweb Deploy Prerequisites",
  };

  protected parametersSchema = z.object({
    arnsName: z.string().describe("ArNS name (for validation context)"),
    directoryPath: z.string().describe("Path to the build directory to check"),
    network: z
      .enum(["mainnet", "testnet"])
      .optional()
      .default("mainnet")
      .describe("Network context (default: mainnet)"),
    undername: z.string().optional().describe("Optional undername/subdomain"),
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

  async execute(args: CheckPermawebDeployPrerequisitesArgs): Promise<string> {
    try {
      const permawebDeployService = new PermawebDeployService();
      const result = await permawebDeployService.checkPrerequisites({
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
        allPassed: false,
        checks: [],
        error: {
          code: "PREREQUISITE_CHECK_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          solutions: ["Check your parameters and try again"],
        },
      });
    }
  }
}
