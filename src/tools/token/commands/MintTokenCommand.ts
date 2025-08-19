import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { resolveAddress, resolveToken } from "../utils/TokenResolver.js";

interface MintTokenArgs {
  confirmed?: boolean;
  processId: string;
  quantity: string;
  recipient: string;
}

export class MintTokenCommand extends ToolCommand<MintTokenArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Mint new tokens to a specified recipient address. Only works if the current wallet is authorized to mint tokens on the process.",
    name: "mintToken",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Mint Token",
  };

  protected parametersSchema = z.object({
    confirmed: z
      .boolean()
      .optional()
      .describe("Set to true to confirm resolved token/address"),
    processId: z.string().describe("The AO token process ID, name, or ticker"),
    quantity: z.string().describe("Amount of tokens to mint"),
    recipient: z.string().describe("Address or contact name to mint tokens to"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: MintTokenArgs): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { hubId, keyPair } = await safeContext.initializeAll();

      // Dynamic import to avoid circular dependencies
      const { send } = await import("../../../process.js");

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

      // Resolve recipient address
      const addressResolution = await resolveAddress(args.recipient, hubId);
      if (!addressResolution.resolved) {
        return JSON.stringify({
          error: "Recipient address resolution failed",
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

      // Send mint message
      const tags = [
        { name: "Action", value: "Mint" },
        { name: "Recipient", value: recipient },
        { name: "Quantity", value: args.quantity },
      ];

      const result = await send(keyPair, processId, tags, null);

      return JSON.stringify({
        message: `Mint request sent: ${args.quantity} tokens to ${recipient}`,
        query: {
          processId,
          quantity: args.quantity,
          recipient,
        },
        result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Mint failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
