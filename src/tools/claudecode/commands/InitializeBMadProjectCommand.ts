import { z } from "zod";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { FileSystemAgentService } from "../../../services/FileSystemAgentService.js";

const initializeBMadProjectSchema = z
  .object({
    projectPath: z.string().describe("Path to the project directory"),
  })
  .strict();

type InitializeBMadProjectArgs = z.infer<typeof initializeBMadProjectSchema>;

export class InitializeBMadProjectCommand extends ToolCommand<
  InitializeBMadProjectArgs,
  object
> {
  protected metadata: ToolMetadata = {
    description:
      "Initialize .bmad/ directory structure for agent state management",
    name: "initializeBMadProject",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Initialize BMAD Project",
  };

  protected parametersSchema = initializeBMadProjectSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: InitializeBMadProjectArgs,
    _context: ToolContext,
  ): Promise<object> {
    try {
      // Initialize file system service
      const fileSystemService = new FileSystemAgentService();

      // Initialize BMAD structure
      await fileSystemService.initializeBMadStructure(args.projectPath);

      return {
        success: true,
        projectPath: args.projectPath,
        structureCreated: [
          ".bmad/",
          ".bmad/agents/",
          ".bmad/sessions/",
          ".bmad/logs/",
          ".bmad/cache/",
          ".bmad/config.json",
          ".bmad/.gitignore",
        ],
        message: `Successfully initialized BMAD structure at ${args.projectPath}/.bmad/`,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "INITIALIZE_BMAD_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
      };
    }
  }
}
