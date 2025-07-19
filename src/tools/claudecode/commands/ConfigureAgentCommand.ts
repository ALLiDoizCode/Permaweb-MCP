import { z } from "zod";

import type {
  AgentRole,
  BMadProjectConfig,
} from "../../../models/TeamAgent.js";

import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ClaudeCodeAgentService } from "../../../services/ClaudeCodeAgentService.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";
import { processCommunicationService } from "../../../services/ProcessCommunicationService.js";
import { createTeamAgentService } from "../../../services/TeamAgentService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const configureAgentSchema = z
  .object({
    agentPreferences: z
      .object({
        communicationStyle: z
          .enum(["casual", "collaborative", "formal", "technical"])
          .optional(),
        gitIntegration: z
          .object({
            enabled: z.boolean(),
            excludePaths: z.array(z.string()),
            triggerPatterns: z.array(z.string()),
            watchPaths: z.array(z.string()),
          })
          .optional(),
        memoryHubId: z.string().optional(),
      })
      .optional(),
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
    projectPath: z.string().describe("Path to the project directory"),
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
        processCommunicationService,
        bmadResourceService,
      );
      const fileSystemService = new FileSystemAgentService();
      const agentService = new ClaudeCodeAgentService(
        memoryService,
        teamAgentService,
        fileSystemService,
      );

      // Configure the project agent with defaults
      const agentPreferences = args.agentPreferences
        ? {
            ...args.agentPreferences,
            gitIntegration: args.agentPreferences.gitIntegration
              ? {
                  enabled: args.agentPreferences.gitIntegration.enabled ?? true,
                  excludePaths: args.agentPreferences.gitIntegration
                    .excludePaths ?? ["node_modules/", ".git/", "dist/"],
                  triggerPatterns: args.agentPreferences.gitIntegration
                    .triggerPatterns ?? ["feat:", "fix:", "test:", "docs:"],
                  watchPaths: args.agentPreferences.gitIntegration
                    .watchPaths ?? ["src/", "docs/", "tests/"],
                }
              : undefined,
            memoryHubId: args.agentPreferences.memoryHubId || "default",
          }
        : undefined;

      await agentService.configureProjectAgent(
        args.projectPath,
        args.agentRole,
        agentPreferences,
      );

      return {
        configurationApplied: {
          communicationStyle:
            args.agentPreferences?.communicationStyle || "technical",
          gitIntegrationEnabled:
            args.agentPreferences?.gitIntegration?.enabled !== false,
          memoryHubId: args.agentPreferences?.memoryHubId || "default",
        },
        defaultAgent: args.agentRole,
        message: `Successfully configured ${args.agentRole} as default agent for project`,
        projectPath: args.projectPath,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: "CONFIGURE_AGENT_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }
}
