import { z } from "zod";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";

const transferAgentContextSchema = z
  .object({
    fromAgent: z.string().describe("Source agent identifier"),
    toAgent: z.string().describe("Target agent identifier"),
    sessionId: z.string().describe("Session ID for the context transfer"),
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
        {} as any,
        {} as any,
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
          success: true,
          fromAgent: args.fromAgent,
          toAgent: args.toAgent,
          sessionId: args.sessionId,
          transferredAt: transferResult.context?.transferredAt,
          contextCount: transferResult.context?.contextCount || 0,
          message: `Successfully transferred context from ${args.fromAgent} to ${args.toAgent}`,
        };
      } else {
        return {
          success: false,
          error: {
            code: transferResult.error?.code || "CONTEXT_TRANSFER_FAILED",
            message:
              transferResult.error?.message ||
              "Failed to transfer agent context",
            details: transferResult.error?.details,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TRANSFER_CONTEXT_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
      };
    }
  }
}
