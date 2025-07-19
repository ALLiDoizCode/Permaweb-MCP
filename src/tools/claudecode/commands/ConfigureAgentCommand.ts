import { z } from "zod";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import type {
  AgentRole,
  BMadProjectConfig,
} from "../../../models/TeamAgent.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";

const configureAgentSchema = z
  .object({
    projectPath: z.string().describe("Path to the project directory"),
    agentRole: z
      .enum([
        "analyst",
        "architect",
        "bmad-master",
        "developer",
        "pm",
        "qa",
        "sm",
        "ux-expert",
      ])
      .describe("Default agent role for the project"),
    agentPreferences: z
      .object({
        communicationStyle: z
          .enum(["casual", "collaborative", "formal", "technical"])
          .optional(),
        gitIntegration: z
          .object({
            enabled: z.boolean(),
            watchPaths: z.array(z.string()),
            triggerPatterns: z.array(z.string()),
            excludePaths: z.array(z.string()),
          })
          .optional(),
        memoryHubId: z.string().optional(),
      })
      .optional(),
  })
  .strict();

type ConfigureAgentArgs = z.infer<typeof configureAgentSchema>;

export class ConfigureAgentCommand extends ToolCommand<
  ConfigureAgentArgs,
  object
> {
  protected metadata: ToolMetadata = {
    description: "Configure agent settings for a specific project path",
    name: "configureAgent",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Configure Agent",
  };

  protected parametersSchema = configureAgentSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: ConfigureAgentArgs,
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

      // Configure the project agent with defaults
      const agentPreferences = args.agentPreferences ? {
        ...args.agentPreferences,
        memoryHubId: args.agentPreferences.memoryHubId || "default",
        gitIntegration: args.agentPreferences.gitIntegration ? {
          enabled: args.agentPreferences.gitIntegration.enabled ?? true,
          watchPaths: args.agentPreferences.gitIntegration.watchPaths ?? ["src/", "docs/", "tests/"],
          triggerPatterns: args.agentPreferences.gitIntegration.triggerPatterns ?? ["feat:", "fix:", "test:", "docs:"],
          excludePaths: args.agentPreferences.gitIntegration.excludePaths ?? ["node_modules/", ".git/", "dist/"],
        } : undefined,
      } : undefined;

      await agentService.configureProjectAgent(
        args.projectPath,
        args.agentRole,
        agentPreferences,
      );

      return {
        success: true,
        projectPath: args.projectPath,
        defaultAgent: args.agentRole,
        message: `Successfully configured ${args.agentRole} as default agent for project`,
        configurationApplied: {
          communicationStyle:
            args.agentPreferences?.communicationStyle || "technical",
          gitIntegrationEnabled:
            args.agentPreferences?.gitIntegration?.enabled !== false,
          memoryHubId: args.agentPreferences?.memoryHubId || "default",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "CONFIGURE_AGENT_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
      };
    }
  }
}
