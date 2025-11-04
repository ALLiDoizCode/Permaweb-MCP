import { z } from "zod";

import { send } from "../../../process.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface SendAOMessageArgs {
  data?: string;
  processId: string;
  tags: { name: string; value: string }[];
}

export class SendAOMessageCommand extends ToolCommand<
  SendAOMessageArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Send an AO message with custom tags and data to any AO process. This tool provides a flexible interface for sending write operations to AO processes with arbitrary tags and data payloads. Use this tool when you need to send messages to AO processes with custom actions or data. For deploying Lua code, use this tool with tags: [{ name: 'Action', value: 'Eval' }] and your Lua code as data. The message result is returned after the process handles it.",
    name: "sendAOMessage",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Send AO Message (Write Operation)",
  };

  protected parametersSchema = z.object({
    data: z
      .string()
      .max(100000, "Data payload too large (max 100000 characters)")
      .optional()
      .describe("Optional string data payload to send with the message"),
    processId: CommonSchemas.processId.describe(
      "Target AO process ID to send the message to",
    ),
    tags: z
      .array(
        z.object({
          name: z.string().min(1, "Tag name cannot be empty"),
          value: z.string(),
        }),
      )
      .min(1, "At least one tag is required")
      .describe("Array of name-value tag pairs for message metadata"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SendAOMessageArgs): Promise<string> {
    try {
      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Send message - send() already handles JSON parsing via readMessage()
      const result = await send(
        keyPair,
        args.processId,
        args.tags,
        args.data || null,
      );

      // Handle null/undefined responses (normal for some operations)
      if (result === null || result === undefined) {
        return JSON.stringify({
          message: "Message sent successfully",
          result: "No response data",
          success: true,
        });
      }

      // Result is already parsed by readMessage() in send() function
      return JSON.stringify({
        message: "Message sent successfully",
        result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to send AO message",
        processId: args.processId,
        success: false,
        tags: args.tags,
      });
    }
  }
}
