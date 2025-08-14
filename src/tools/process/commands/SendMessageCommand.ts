import { z } from "zod";

import { send } from "../../../process.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface SendMessageArgs {
  action: string;
  data?: string;
  processId: string;
  tags?: { name: string; value: string }[];
}

export class SendMessageCommand extends ToolCommand<SendMessageArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Send a message to an AO process with specific action and data. This sends direct AO messages with custom tags - use this for simple message sending when you know the exact action and parameters. For natural language requests, use executeAction instead.",
    name: "sendMessage",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Send Message to Process",
  };

  protected parametersSchema = z.object({
    action: z
      .string()
      .min(1)
      .describe("The action to send (e.g., 'Ping', 'Balance', 'Transfer')"),
    data: z
      .string()
      .optional()
      .describe("Optional data payload for the message"),
    processId: CommonSchemas.processId.describe(
      "The AO process ID to send the message to",
    ),
    tags: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .optional()
      .describe("Optional additional tags to include with the message"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SendMessageArgs): Promise<string> {
    try {
      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Build tags array
      const tags = [{ name: "Action", value: args.action }];

      // Add any additional tags
      if (args.tags && args.tags.length > 0) {
        tags.push(...args.tags);
      }

      // Send the message
      const result = await send(
        keyPair,
        args.processId,
        tags,
        args.data || null,
      );

      if (result === null || result === undefined) {
        return JSON.stringify({
          error: "Message sending returned null result",
          message: "Message failed to send or timed out",
          success: false,
        });
      }

      return JSON.stringify({
        action: args.action,
        data: args.data,
        message: "Message sent successfully",
        processId: args.processId,
        result,
        success: true,
        tags,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to send message to AO process",
        success: false,
      });
    }
  }
}
