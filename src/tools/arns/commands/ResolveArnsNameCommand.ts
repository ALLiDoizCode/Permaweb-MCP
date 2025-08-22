import { ARIO } from "@ar.io/sdk/node";
import { z } from "zod";

import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { ArnsClientManager } from "../utils/ArnsClientManager.js";
import {
  getArnsNameType,
  isValidArnsName,
} from "../utils/ArnsNameValidation.js";

// Type extension for ARIO client methods that might not be in the type definitions
interface ExtendedARIO extends ARIO {
  resolveArNSName(args: { name: string }): Promise<null | string>;
}

interface ResolveArnsNameArgs {
  name: string;
  network?: "mainnet" | "testnet";
}

// Validation patterns are now imported from centralized utility

export class ResolveArnsNameCommand extends ToolCommand<
  ResolveArnsNameArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Resolve ArNS names and undernames to Arweave transaction IDs. Supports both .ar base names (e.g., example.ar) and undernames (e.g., sub.example.ar) with network switching capabilities.",
    name: "resolveArnsName",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Resolve ArNS Name",
  };

  protected parametersSchema = z.object({
    name: z
      .string()
      .min(1)
      .refine(
        isValidArnsName,
        "Invalid ArNS name format. Must be valid .ar name or undername (e.g., example.ar or sub.example.ar)",
      ),
    network: z
      .enum(["mainnet", "testnet"])
      .optional()
      .describe(
        "Network to use for resolution (defaults to environment configuration)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: ResolveArnsNameArgs): Promise<string> {
    try {
      // Get ArNS client manager instance
      const clientManager = ArnsClientManager.getInstance();
      await clientManager.initializeFromEnvironment();

      // Switch network if specified
      if (args.network) {
        await clientManager.switchNetwork(args.network);
      }

      const arnsClient = clientManager.getClient();
      if (!arnsClient) {
        return JSON.stringify({
          error: "CLIENT_NOT_INITIALIZED",
          message:
            "ArNS client not initialized. Please check network configuration.",
          success: false,
          suggestion:
            "Verify ARNS_NETWORK environment variable and network connectivity",
        });
      }

      // Determine name type
      const nameType = getArnsNameType(args.name);
      const currentNetwork = clientManager.getCurrentNetwork();

      // Resolve ArNS name - the method returns a transaction ID string directly
      const resolvedId = await (arnsClient as ExtendedARIO).resolveArNSName({
        name: args.name,
      });

      if (!resolvedId) {
        return JSON.stringify({
          error: "RESOLUTION_FAILED",
          message: `Failed to resolve ArNS name: ${args.name}`,
          query: {
            name: args.name,
            network: currentNetwork,
          },
          success: false,
          suggestion:
            "Verify the name exists and is properly registered on the specified network",
        });
      }

      return JSON.stringify({
        nameType,
        network: currentNetwork,
        query: {
          name: args.name,
          network: currentNetwork,
        },
        resolvedId,
        success: true,
      });
    } catch (error) {
      // Handle network errors and other issues
      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("connect")
        ) {
          return JSON.stringify({
            error: "NETWORK_ERROR",
            message: "Network connectivity issue during ArNS resolution",
            success: false,
            suggestion:
              "Check internet connection and try again. The ArNS network may be temporarily unavailable.",
          });
        }

        if (
          error.message.includes("invalid") ||
          error.message.includes("format")
        ) {
          return JSON.stringify({
            error: "INVALID_NAME_FORMAT",
            message: `Invalid ArNS name format: ${args.name}`,
            success: false,
            suggestion:
              "Ensure name follows .ar format (e.g., example.ar) or undername format (e.g., sub.example.ar)",
          });
        }
      }

      return JSON.stringify({
        error: "RESOLUTION_ERROR",
        message: `Failed to resolve ArNS name: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
        suggestion: "Verify name format and network connectivity, then retry",
      });
    }
  }
}
