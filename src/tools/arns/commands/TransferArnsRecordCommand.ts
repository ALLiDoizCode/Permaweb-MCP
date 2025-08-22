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
  transferRecord(args: {
    name: string;
    newOwner: string;
    signer?: unknown;
  }): Promise<{
    id: string;
    owner: string;
    processId: string;
    tags: Array<{ name: string; value: string }>;
    target?: string;
  }>;
}

interface TransferArnsRecordArgs {
  confirmed?: boolean;
  name: string;
  network?: "mainnet" | "testnet";
  newOwner: string;
}

interface TransferArnsRecordResponse {
  error?: {
    code: string;
    message: string;
    suggestions: string[];
  };
  instruction?: string;
  requiresConfirmation?: boolean;
  success: boolean;
  transactionId?: string;
  transfer?: {
    name: string;
    network: string;
    newOwner: string;
    previousOwner: string;
    timestamp: string;
  };
}

export class TransferArnsRecordCommand extends ToolCommand<
  TransferArnsRecordArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Transfer ArNS name ownership to another address with ownership verification and transaction signing",
    name: "transferArnsRecord",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Transfer ArNS Record",
  };

  protected parametersSchema = z.object({
    confirmed: z
      .boolean()
      .optional()
      .describe("Set to true to confirm transfer"),
    name: z
      .string()
      .min(1)
      .max(51)
      .regex(/^[a-zA-Z0-9-]+$/)
      .describe("ArNS name to transfer (without .ar suffix)"),
    network: z
      .enum(["mainnet", "testnet"])
      .optional()
      .describe("Network to use for transfer (defaults to environment)"),
    newOwner: z
      .string()
      .length(43)
      .regex(/^[a-zA-Z0-9_-]{43}$/)
      .describe("Arweave address of the new owner"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: TransferArnsRecordArgs): Promise<string> {
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
              "Verify name contains only alphanumeric characters and hyphens",
              "Ensure new owner address is 43 characters long",
              "Remove .ar suffix from name if present",
            ],
          },
          success: false,
        } as TransferArnsRecordResponse);
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
        } as TransferArnsRecordResponse);
      }

      const currentNetwork = clientManager.getCurrentNetwork();

      // Verify current ownership before allowing transfer
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
        } as TransferArnsRecordResponse);
      }

      // Check ownership authorization
      const recordOwner = record.contractTxId || record.processId;
      if (recordOwner !== publicKey) {
        return JSON.stringify({
          error: {
            code: "UNAUTHORIZED_TRANSFER",
            message: "Only the owner can transfer this ArNS record",
            suggestions: [
              "Verify you are using the correct wallet",
              "Check that you own this ArNS record",
              "Contact the current owner for transfer assistance",
            ],
          },
          success: false,
        } as TransferArnsRecordResponse);
      }

      // Require confirmation for transfer operations
      if (!args.confirmed) {
        return JSON.stringify({
          instruction: "Add confirmed: true to proceed with ownership transfer",
          requiresConfirmation: true,
          success: false,
          transfer: {
            name: args.name,
            network: currentNetwork,
            newOwner: args.newOwner,
            previousOwner: publicKey,
            timestamp: new Date().toISOString(),
          },
        } as TransferArnsRecordResponse);
      }

      // Perform the ownership transfer
      const transferResult = await (arnsClient as ExtendedARIO).transferRecord({
        name: args.name,
        newOwner: args.newOwner,
        signer: keyPair,
      });

      return JSON.stringify({
        success: true,
        transactionId: transferResult.id,
        transfer: {
          name: args.name,
          network: currentNetwork,
          newOwner: args.newOwner,
          previousOwner: publicKey,
          timestamp: new Date().toISOString(),
        },
      } as TransferArnsRecordResponse);
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
              message: "Network connectivity issue during transfer",
              suggestions: [
                "Check internet connection",
                "Verify ArNS network status",
                "Try again in a few moments",
              ],
            },
            success: false,
          } as TransferArnsRecordResponse);
        }

        if (
          error.message.includes("unauthorized") ||
          error.message.includes("permission")
        ) {
          return JSON.stringify({
            error: {
              code: "AUTHORIZATION_ERROR",
              message: "Insufficient permissions for transfer operation",
              suggestions: [
                "Verify ownership of the ArNS record",
                "Check wallet authorization",
                "Ensure correct network selection",
              ],
            },
            success: false,
          } as TransferArnsRecordResponse);
        }

        if (
          error.message.includes("transaction") ||
          error.message.includes("signing")
        ) {
          return JSON.stringify({
            error: {
              code: "TRANSACTION_ERROR",
              message: "Failed to create or sign transfer transaction",
              suggestions: [
                "Check wallet balance for transaction fees",
                "Verify wallet signing capability",
                "Retry the transfer operation",
              ],
            },
            success: false,
          } as TransferArnsRecordResponse);
        }
      }

      return JSON.stringify({
        error: {
          code: "TRANSFER_FAILED",
          message: `Transfer operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          suggestions: [
            "Verify all parameters are correct",
            "Check network connectivity",
            "Retry the operation",
            "Contact support if the issue persists",
          ],
        },
        success: false,
      } as TransferArnsRecordResponse);
    }
  }
}
