import { z } from "zod";

import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";
import { processCommunicationService } from "../../../services/ProcessCommunicationService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const transferAgentContextSchema = z
  .object({
    fromAgent: z.string().describe("Source agent identifier"),
    sessionId: z.string().describe("Session ID for the context transfer"),
    toAgent: z.string().describe("Target agent identifier"),
  })
  .strict();

type TransferAgentContextArgs = z.infer<typeof transferAgentContextSchema>;

export class TransferAgentContextCommand extends ToolCommand<
  TransferAgentContextArgs,
  object
> {
  protected metadata: ToolMetadata = {
    description: "Transfer context and memory from one agent to another",
    name: "transferAgentContext",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Transfer Agent Context",
  };

  protected parametersSchema = transferAgentContextSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: TransferAgentContextArgs,
    _context: ToolContext,
  ): Promise<object> {
    try {
      // Initialize required services
      const memoryService = aiMemoryService;
      const teamAgentService = createTeamAgentService(
        memoryService,
        processCommunicationService,
        bmadResourceService,
      );
      const fileSystemService = new FileSystemAgentService();
      const agentService = new ClaudeCodeAgentService(
        memoryService,
        teamAgentService,
        fileSystemService,
      );

      // Transfer agent context
      const transferResult = await agentService.transferAgentContext(
        args.fromAgent,
        args.toAgent,
        args.sessionId,
      );

      if (transferResult.success) {
        return {
          contextCount: transferResult.context?.contextCount || 0,
          fromAgent: args.fromAgent,
          message: `Successfully transferred context from ${args.fromAgent} to ${args.toAgent}`,
          sessionId: args.sessionId,
          success: true,
          toAgent: args.toAgent,
          transferredAt: transferResult.context?.transferredAt,
        };
      } else {
        return {
          error: {
            code: transferResult.error?.code || "CONTEXT_TRANSFER_FAILED",
            details: transferResult.error?.details,
            message:
              transferResult.error?.message ||
              "Failed to transfer agent context",
          },
          success: false,
        };
      }
    } catch (error) {
      return {
        error: {
          code: "TRANSFER_CONTEXT_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }
}
