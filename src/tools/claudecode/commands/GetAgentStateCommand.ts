import { z } from "zod";

import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";
import { processCommunicationService } from "../../../services/ProcessCommunicationService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const getAgentStateSchema = z
  .object({
    sessionId: z.string().describe("Session ID to retrieve agent state for"),
  })
  .strict();

type GetAgentStateArgs = z.infer<typeof getAgentStateSchema>;

export class GetAgentStateCommand extends ToolCommand<
  GetAgentStateArgs,
  object
> {
  protected metadata: ToolMetadata = {
    description: "Retrieve current agent state for a specific session",
    name: "getAgentState",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Agent State",
  };

  protected parametersSchema = getAgentStateSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: GetAgentStateArgs,
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

      // Retrieve agent state
      const stateResult = await agentService.getAgentState(args.sessionId);

      if (stateResult.success) {
        return {
          activeAgent: stateResult.detectedAgent,
          confidence: stateResult.confidence,
          context: stateResult.context,
          message: stateResult.detectedAgent
            ? `Active agent: ${stateResult.detectedAgent}`
            : "No active agent found for session",
          sessionId: args.sessionId,
          success: true,
        };
      } else {
        return {
          error: {
            code: stateResult.error?.code || "STATE_RETRIEVAL_FAILED",
            details: stateResult.error?.details,
            message:
              stateResult.error?.message || "Failed to retrieve agent state",
          },
          success: false,
        };
      }
    } catch (error) {
      return {
        error: {
          code: "GET_AGENT_STATE_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }
}
