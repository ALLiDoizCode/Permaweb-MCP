import { z } from "zod";

import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { resolveAddress, resolveToken } from "../utils/TokenResolver.js";

interface TransferTokensArgs {
  confirmed?: boolean;
  processId: string;
  quantity: string;
  rawAmount?: boolean;
  recipient: string;
}

export class TransferTokensCommand extends ToolCommand<
  TransferTokensArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Core MVP functionality: Transfer tokens from your account to another address. Supports token names/tickers and contact names from registry.",
    name: "transferTokens",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Transfer Tokens",
  };

  protected parametersSchema = z.object({
    confirmed: z
      .boolean()
      .optional()
      .describe("Set to true to confirm resolved tokens/addresses"),
    processId: z.string().describe("The AO token process ID, name, or ticker"),
    quantity: CommonSchemas.quantity.describe(
      "Amount of tokens to transfer (will be converted based on token denomination unless rawAmount is true)",
    ),
    rawAmount: z
      .boolean()
      .optional()
      .describe(
        "Set to true to send exact amount without denomination conversion",
      ),
    recipient: z.string().describe("Address or contact name to send tokens to"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: TransferTokensArgs): Promise<string> {
    try {
      // Auto-initialize context if needed
      const autoContext = AutoSafeToolContext.from(this.context);
      const { hubId, keyPair, publicKey } = await autoContext.initializeAll();

      // Dynamic import to avoid circular dependencies
      const { read, send } = await import("../../../process.js");

      // Resolve token processId if needed
      const tokenResolution = await resolveToken(args.processId, hubId);
      if (!tokenResolution.resolved) {
        return JSON.stringify({
          error: "Token resolution failed",
          message: tokenResolution.verificationMessage,
          success: false,
          suggestion:
            "Use saveTokenMapping to register this token or provide a valid processId",
        });
      }

      if (tokenResolution.requiresVerification && !args.confirmed) {
        return JSON.stringify({
          instruction:
            "Add 'confirmed: true' to your request to proceed with this token",
          message: tokenResolution.verificationMessage,
          requiresConfirmation: true,
          resolvedToken: tokenResolution.value,
          success: false,
        });
      }

      const processId = tokenResolution.value!;

      // Resolve recipient address if needed
      const addressResolution = await resolveAddress(args.recipient, hubId);
      if (!addressResolution.resolved) {
        return JSON.stringify({
          error: "Recipient resolution failed",
          message: addressResolution.verificationMessage,
          success: false,
          suggestion:
            "Use saveAddressMapping to register this contact or provide a valid address",
        });
      }

      if (addressResolution.requiresVerification && !args.confirmed) {
        return JSON.stringify({
          instruction:
            "Add 'confirmed: true' to your request to proceed with this recipient",
          message: addressResolution.verificationMessage,
          requiresConfirmation: true,
          resolvedRecipient: addressResolution.value,
          success: false,
        });
      }

      const recipient = addressResolution.value!;

      // Get token info to check denomination
      const tokenInfo = await read(processId, [
        { name: "Action", value: "Info" },
      ]);
      let denomination = 12; // Default denomination
      let actualQuantity = args.quantity;

      if (tokenInfo && tokenInfo.Data) {
        try {
          const info = JSON.parse(tokenInfo.Data);
          if (info.Denomination) {
            denomination = parseInt(info.Denomination);
          }
        } catch {
          // Use default denomination if parsing fails
        }
      }

      // Convert human-readable amount to token units based on denomination
      if (!args.quantity.includes(".") && !args.rawAmount) {
        // If it's a whole number and not marked as raw, apply denomination
        const numericQuantity = parseFloat(args.quantity);
        actualQuantity = (
          numericQuantity * Math.pow(10, denomination)
        ).toString();
      }

      // First check current balance
      const balanceResult = await read(processId, [
        { name: "Action", value: "Balance" },
        { name: "Target", value: publicKey },
      ]);

      // Then attempt transfer
      const tags = [
        { name: "Action", value: "Transfer" },
        { name: "Recipient", value: recipient },
        { name: "Quantity", value: actualQuantity },
      ];

      const result = await send(keyPair, processId, tags, null);

      return JSON.stringify({
        balance: balanceResult?.Data ? JSON.parse(balanceResult.Data) : null,
        message: `Transfer initiated: ${args.quantity} tokens to ${args.recipient}`,
        result,
        success: true,
        transfer: {
          actualQuantity,
          processId,
          quantity: args.quantity,
          recipient,
        },
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to transfer tokens: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
