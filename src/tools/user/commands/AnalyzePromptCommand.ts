import { z } from "zod";

import {
  AgentDetectionRequest,
  PromptDetectionService,
} from "../../../services/PromptDetectionService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

export class AnalyzePromptCommand extends ToolCommand<
  AgentDetectionRequest,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Analyze prompts to detect agent invocation patterns and extract project context",
    name: "analyzePrompt",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Analyze Prompt for Agent Detection",
  };

  protected parametersSchema = z.object({
    projectContext: z.string().optional(),
    prompt: z.string().min(1, "Prompt cannot be empty"),
    userId: z.string().optional(),
  }) satisfies z.ZodType<AgentDetectionRequest>;

  private promptDetectionService: PromptDetectionService;

  constructor(private context: ToolContext) {
    super();
    this.promptDetectionService = new PromptDetectionService();
  }

  async execute(params: AgentDetectionRequest): Promise<string> {
    try {
      // Validate prompt
      if (!params.prompt || params.prompt.trim().length === 0) {
        return JSON.stringify({
          error: {
            code: "INVALID_PROMPT",
            details: "The prompt parameter is required and cannot be empty",
            message: "Prompt cannot be empty",
          },
          success: false,
        });
      }

      const result = this.promptDetectionService.detectAgents(params.prompt);

      // Add any provided project context if not detected
      if (params.projectContext && !result.projectContext) {
        result.projectContext = params.projectContext;
      }

      return JSON.stringify({
        data: result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: {
          code: "AGENT_DETECTION_FAILED",
          details: error,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        success: false,
      });
    }
  }
}
