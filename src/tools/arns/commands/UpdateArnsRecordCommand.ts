import { ARIO } from "@ar.io/sdk/node";
import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { ArnsClientManager } from "../utils/ArnsClientManager.js";

// Type extension for ARIO client methods that might not be in the type definitions
interface ExtendedARIO extends ARIO {
  getArNSRecord(args: { name: string }): Promise<{
    contractTxId?: string;
    endTimestamp?: number;
    processId?: string;
    purchasePrice?: string;
    startTimestamp?: number;
    type?: string;
    undernameCount?: number;
  } | null>;
  updateRecord(args: {
    name: string;
    signer?: unknown;
    transactionId?: string;
    ttlSeconds?: number;
  }): Promise<{
    id: string;
    owner: string;
    processId: string;
    tags: Array<{ name: string; value: string }>;
    target?: string;
  }>;
}

interface UpdateArnsRecordArgs {
  confirmed?: boolean;
  name: string;
  network?: "mainnet" | "testnet";
  transactionId?: string;
  ttlSeconds?: number;
}

interface UpdateArnsRecordResponse {
  error?: {
    code: string;
    message: string;
    suggestions: string[];
  };
  instruction?: string;
  requiresConfirmation?: boolean;
  success: boolean;
  transactionId?: string;
  update?: {
    name: string;
    network: string;
    timestamp: string;
    updatedFields: string[];
  };
}

export class UpdateArnsRecordCommand extends ToolCommand<
  UpdateArnsRecordArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Update existing ArNS record properties including target transaction ID and TTL settings with ownership verification",
    name: "updateArnsRecord",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Update ArNS Record",
  };

  protected parametersSchema = z
    .object({
      confirmed: z
        .boolean()
        .optional()
        .describe("Set to true to confirm update"),
      name: z
        .string()
        .min(1)
        .max(51)
        .regex(/^[a-zA-Z0-9-]+$/)
        .describe("ArNS name to update (without .ar suffix)"),
      network: z
        .enum(["mainnet", "testnet"])
        .optional()
        .describe("Network to use (defaults to ARNS_NETWORK env var)"),
      transactionId: z
        .string()
        .length(43)
        .regex(/^[a-zA-Z0-9_-]{43}$/)
        .optional()
        .describe("New target Arweave transaction ID for name resolution"),
      ttlSeconds: z
        .number()
        .int()
        .min(300)
        .max(86400)
        .optional()
        .describe("TTL in seconds for DNS resolution (300-86400)"),
    })
    .refine(
      (data) =>
        data.transactionId !== undefined || data.ttlSeconds !== undefined,
      {
        message:
          "At least one update parameter (transactionId or ttlSeconds) is required",
        path: ["transactionId", "ttlSeconds"],
      },
    );

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: UpdateArnsRecordArgs): Promise<string> {
    try {
      // Validate parameters first
      const validation = this.parametersSchema.safeParse(args);
      if (!validation.success) {
        return JSON.stringify({
          error: {
            code: "INVALID_PARAMETERS",
            message: `Parameter validation failed: ${validation.error.issues[0].message}`,
            suggestions: [
              "Check parameter format and requirements",
              "Ensure at least one update parameter is provided",
              "Verify transaction ID format (43 characters)",
              "Check TTL range (300-86400 seconds)",
            ],
          },
          success: false,
        } as UpdateArnsRecordResponse);
      }

      // Initialize auto-safe context for keyPair management
      const autoContext = AutoSafeToolContext.from(this.context);
      const { keyPair, publicKey } = await autoContext.initializeAll();

      // Get ArNS client manager instance with signer for write operations
      const clientManager = ArnsClientManager.getInstance();
      await clientManager.initializeFromEnvironment(keyPair);

      // Switch network if specified
      if (args.network) {
        await clientManager.switchNetwork(args.network, keyPair);
      }

      const arnsClient = clientManager.getClient();
      if (!arnsClient) {
        return JSON.stringify({
          error: {
            code: "CLIENT_NOT_INITIALIZED",
            message:
              "ArNS client not initialized. Please check network configuration.",
            suggestions: [
              "Verify ARNS_NETWORK environment variable",
              "Check network connectivity",
              "Retry the operation",
            ],
          },
          success: false,
        } as UpdateArnsRecordResponse);
      }

      const currentNetwork = clientManager.getCurrentNetwork();

      // Verify current ownership before allowing update
      const record = await (arnsClient as ExtendedARIO).getArNSRecord({
        name: args.name,
      });

      if (!record) {
        return JSON.stringify({
          error: {
            code: "RECORD_NOT_FOUND",
            message: `ArNS record not found: ${args.name}`,
            suggestions: [
              "Verify the name exists and is properly registered",
              "Check the network setting",
              "Ensure correct name format (without .ar suffix)",
            ],
          },
          success: false,
        } as UpdateArnsRecordResponse);
      }

      // Check ownership authorization
      const recordOwner = record.contractTxId || record.processId;
      if (recordOwner !== publicKey) {
        return JSON.stringify({
          error: {
            code: "UNAUTHORIZED_UPDATE",
            message: "Only the owner can update this ArNS record",
            suggestions: [
              "Verify you are using the correct wallet",
              "Check that you own this ArNS record",
              "Contact the current owner for update assistance",
            ],
          },
          success: false,
        } as UpdateArnsRecordResponse);
      }

      // Determine which fields will be updated
      const updatedFields: string[] = [];
      if (args.transactionId !== undefined) {
        updatedFields.push("transactionId");
      }
      if (args.ttlSeconds !== undefined) {
        updatedFields.push("ttlSeconds");
      }

      // Require confirmation for update operations
      if (!args.confirmed) {
        return JSON.stringify({
          instruction: "Add confirmed: true to proceed with record update",
          requiresConfirmation: true,
          success: false,
          update: {
            name: args.name,
            network: currentNetwork,
            timestamp: new Date().toISOString(),
            updatedFields,
          },
        } as UpdateArnsRecordResponse);
      }

      // Perform the record update
      const updateResult = await (arnsClient as ExtendedARIO).updateRecord({
        name: args.name,
        signer: keyPair,
        transactionId: args.transactionId,
        ttlSeconds: args.ttlSeconds,
      });

      return JSON.stringify({
        success: true,
        transactionId: updateResult.id,
        update: {
          name: args.name,
          network: currentNetwork,
          timestamp: new Date().toISOString(),
          updatedFields,
        },
      } as UpdateArnsRecordResponse);
    } catch (error) {
      // Handle various error scenarios
      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("connect")
        ) {
          return JSON.stringify({
            error: {
              code: "NETWORK_ERROR",
              message: "Network connectivity issue during update",
              suggestions: [
                "Check internet connection",
                "Verify ArNS network status",
                "Try again in a few moments",
              ],
            },
            success: false,
          } as UpdateArnsRecordResponse);
        }

        if (
          error.message.includes("unauthorized") ||
          error.message.includes("permission")
        ) {
          return JSON.stringify({
            error: {
              code: "AUTHORIZATION_ERROR",
              message: "Insufficient permissions for update operation",
              suggestions: [
                "Verify ownership of the ArNS record",
                "Check wallet authorization",
                "Ensure correct network selection",
              ],
            },
            success: false,
          } as UpdateArnsRecordResponse);
        }

        if (
          error.message.includes("transaction") ||
          error.message.includes("signing")
        ) {
          return JSON.stringify({
            error: {
              code: "TRANSACTION_ERROR",
              message: "Failed to create or sign update transaction",
              suggestions: [
                "Check wallet balance for transaction fees",
                "Verify wallet signing capability",
                "Retry the update operation",
              ],
            },
            success: false,
          } as UpdateArnsRecordResponse);
        }

        if (
          error.message.includes("invalid") &&
          error.message.includes("transaction")
        ) {
          return JSON.stringify({
            error: {
              code: "INVALID_TRANSACTION_ID",
              message: "The provided transaction ID is invalid or not found",
              suggestions: [
                "Verify the transaction ID exists on Arweave",
                "Check transaction ID format (43 characters)",
                "Ensure the transaction contains valid content",
              ],
            },
            success: false,
          } as UpdateArnsRecordResponse);
        }
      }

      return JSON.stringify({
        error: {
          code: "UPDATE_FAILED",
          message: `Update operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          suggestions: [
            "Verify all parameters are correct",
            "Check network connectivity",
            "Retry the operation",
            "Contact support if the issue persists",
          ],
        },
        success: false,
      } as UpdateArnsRecordResponse);
    }
  }
}
