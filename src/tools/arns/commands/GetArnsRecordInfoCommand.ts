import { ARIO } from "@ar.io/sdk/node";
import { z } from "zod";

import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { ArnsClientManager } from "../utils/ArnsClientManager.js";
import {
  extractBaseName,
  isValidArnsName,
} from "../utils/ArnsNameValidation.js";

interface ArnsRecord {
  contractTxId?: string;
  endTimestamp?: number;
  processId?: string;
  purchasePrice?: string;
  startTimestamp?: number;
  type?: string;
  undernameCount?: number;
}

// Type extension for ARIO client methods that might not be in the type definitions
interface ExtendedARIO extends ARIO {
  getArNSRecord(args: { name: string }): Promise<ArnsRecord | null>;
}

interface GetArnsRecordInfoArgs {
  name: string;
  network?: "mainnet" | "testnet";
}

// Validation patterns and utilities are now imported from centralized module

export class GetArnsRecordInfoCommand extends ToolCommand<
  GetArnsRecordInfoArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Get detailed ArNS record information including ownership, expiration, type, and undername count. Supports both base names and undernames with comprehensive metadata retrieval.",
    name: "getArnsRecordInfo",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get ArNS Record Info",
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
        "Network to use for record lookup (defaults to environment configuration)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: GetArnsRecordInfoArgs): Promise<string> {
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

      const currentNetwork = clientManager.getCurrentNetwork();

      // Extract the base name for querying (removes .ar suffix and handles undernames)
      const nameToQuery = extractBaseName(args.name);

      // Get record information
      const record = await (arnsClient as ExtendedARIO).getArNSRecord({
        name: nameToQuery,
      });

      if (!record) {
        return JSON.stringify({
          error: "RECORD_NOT_FOUND",
          message: `ArNS record not found: ${args.name}`,
          query: {
            name: args.name,
            network: currentNetwork,
          },
          success: false,
          suggestion:
            "Verify the name exists and is properly registered on the specified network",
        });
      }

      // Build comprehensive record info
      const recordInfo: Record<string, unknown> = {
        name: args.name,
        owner: record.contractTxId || record.processId,
        processId: record.processId,
        startTimestamp: record.startTimestamp,
        type: record.type || "lease",
        undernames: record.undernameCount || 10,
      };

      // Add lease-specific information
      if (record.endTimestamp) {
        recordInfo.expiresAt = record.endTimestamp;
        recordInfo.expiresAtDate = new Date(record.endTimestamp).toISOString();
      }

      // Add purchase price if available
      if (record.purchasePrice) {
        recordInfo.purchasePrice = record.purchasePrice;
      }

      return JSON.stringify({
        network: currentNetwork,
        query: {
          name: args.name,
          network: currentNetwork,
        },
        recordInfo,
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
            message: "Network connectivity issue during record lookup",
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

        if (
          error.message.includes("not found") ||
          error.message.includes("404")
        ) {
          return JSON.stringify({
            error: "RECORD_NOT_FOUND",
            message: `ArNS record not found: ${args.name}`,
            success: false,
            suggestion:
              "Verify the name exists and is properly registered on the specified network",
          });
        }
      }

      return JSON.stringify({
        error: "RECORD_LOOKUP_ERROR",
        message: `Failed to get record info: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
        suggestion: "Verify name format and network connectivity, then retry",
      });
    }
  }
}
