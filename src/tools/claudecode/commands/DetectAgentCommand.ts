import { z } from "zod";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import type { ClaudeCodeHookContext } from "../../../models/TeamAgent.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";

const detectAgentSchema = z
  .object({
    hookContext: z.object({
      sessionId: z.string().describe("Current Claude Code session ID"),
      transcriptPath: z
        .string()
        .describe("Path to the conversation transcript"),
      workingDirectory: z.string().describe("Current working directory"),
      toolName: z.string().optional().describe("Name of the tool being used"),
      eventType: z
        .enum(["PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop"])
        .describe("Type of hook event that triggered agent detection"),
      timestamp: z.string().describe("ISO timestamp of the event"),
    }),
    userInput: z
      .string()
      .optional()
      .describe("User input to analyze for agent patterns"),
  })
  .strict();

type DetectAgentArgs = z.infer<typeof detectAgentSchema>;

export class DetectAgentCommand extends ToolCommand<DetectAgentArgs, object> {
  protected metadata: ToolMetadata = {
    description:
      "Detect appropriate agent based on Claude Code hook context and user input patterns",
    name: "detectAgent",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Detect Agent",
  };

  protected parametersSchema = detectAgentSchema;

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: DetectAgentArgs, _context: ToolContext): Promise<object> {
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

      // Enhance hook context with user input if provided
      const enhancedContext = {
        ...args.hookContext,
        userInput: args.userInput,
      };

      // Detect appropriate agent
      const detectionResult =
        await agentService.handleHookEvent(enhancedContext);

      if (detectionResult.success) {
        return {
          success: true,
          detectedAgent: detectionResult.detectedAgent,
          confidence: detectionResult.confidence,
          context: detectionResult.context,
          message: `Agent detected: ${detectionResult.detectedAgent} (confidence: ${Math.round(detectionResult.confidence * 100)}%)`,
        };
      } else {
        return {
          success: false,
          error: {
            code: detectionResult.error?.code || "DETECTION_FAILED",
            message:
              detectionResult.error?.message ||
              "Failed to detect suitable agent",
            details: detectionResult.error?.details,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "DETECT_AGENT_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
      };
    }
  }
}
