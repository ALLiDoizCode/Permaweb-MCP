import { z } from "zod";

import { read } from "../../../process.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ReadAOProcessArgs {
  processId: string;
  tags: { name: string; value: string }[];
}

export class ReadAOProcessCommand extends ToolCommand<
  ReadAOProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Read data from an AO process using dryrun query with custom tags. This tool provides a read-only interface for querying AO process state without sending write transactions. Dryruns do not require a wallet/signer and do not create on-chain transactions. Use this tool when you need to query process state or retrieve information without modifying the process. The response message data is returned after the dryrun executes.",
    name: "readAOProcess",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Read AO Process (Dryrun Query)",
  };

  protected parametersSchema = z.object({
    processId: CommonSchemas.processId.describe(
      "Target AO process ID to query via dryrun",
    ),
    tags: z
      .array(
        z.object({
          name: z.string().min(1, "Tag name cannot be empty"),
          value: z.string(),
        }),
      )
      .min(1, "At least one tag is required")
      .describe("Array of name-value tag pairs for query metadata"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: ReadAOProcessArgs): Promise<string> {
    try {
      // Execute dryrun query - no signer needed for read operations
      const message = await read(args.processId, args.tags);

      // Handle undefined/null responses
      if (!message) {
        return JSON.stringify({
          message: "No response from dryrun query",
          result: null,
          success: true,
        });
      }

      // Extract data from message
      let responseData = message.Data;

      // Try to parse as JSON if possible
      if (responseData && typeof responseData === "string") {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // If not valid JSON, keep as raw string
        }
      }

      return JSON.stringify({
        message: "Dryrun query completed successfully",
        result: responseData || message,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to execute dryrun query",
        processId: args.processId,
        success: false,
        tags: args.tags,
      });
    }
  }
}
