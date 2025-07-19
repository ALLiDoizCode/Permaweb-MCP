import { z } from "zod";

import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadHelpSchema = z
  .object({
    topic: z
      .string()
      .optional()
      .describe("Optional help topic to get specific help for"),
  })
  .strict();

type BMADHelpArgs = z.infer<typeof bmadHelpSchema>;

export class BMADHelpCommand extends ToolCommand<BMADHelpArgs, string> {
  protected metadata: ToolMetadata = {
    description: "Display BMAD methodology help and available commands",
    name: "bmad_help",
    openWorldHint: false,
    readOnlyHint: true,
    title: "BMAD Help",
  };

  protected parametersSchema = bmadHelpSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(args: BMADHelpArgs, _context: ToolContext): Promise<string> {
    const { topic } = args;

    if (topic) {
      return this.getTopicHelp(topic);
    }

    return this.getGeneralHelp();
  }

  private getGeneralHelp(): string {
    return `
# BMAD Methodology Help

BMAD (Build, Manage, and Deploy) is a comprehensive methodology for structured development workflows.

## Available Commands

- **\`bmad_help\`** - Display this help information
- **\`bmad_kb\`** - Access BMAD knowledge base
- **\`bmad_task\`** - Execute BMAD tasks
- **\`bmad_create-doc\`** - Create documents from templates
- **\`bmad_execute-checklist\`** - Run checklists
- **\`bmad_yolo\`** - Quick execution mode
- **\`bmad_doc-out\`** - Document output/export
- **\`bmad_exit\`** - Exit BMAD mode

## Getting Started

1. Use \`bmad_kb\` to explore available knowledge base resources
2. Use \`bmad_task\` to list and execute development tasks
3. Use \`bmad_create-doc\` to generate documents from templates
4. Use \`bmad_execute-checklist\` to run quality assurance checklists

## Need More Help?

Use \`bmad_help <command>\` to get specific help for any command.
    `.trim();
  }

  private getTopicHelp(topic: string): string {
    const helpTopics: Record<string, string> = {
      "create-doc":
        "Document Creation: Generate documents from predefined templates",
      "doc-out":
        "Document Output: Export and format documentation for various outputs",
      "execute-checklist":
        "Checklist Execution: Run quality assurance and validation checklists",
      exit: "Exit Mode: Leave BMAD methodology mode and return to normal operation",
      kb: "Knowledge Base: Access BMAD methodology documentation and resources",
      task: "Task Execution: Run structured development tasks with step-by-step guidance",
      yolo: "Quick Execution: Fast-track common development operations",
    };

    const help = helpTopics[topic.toLowerCase()];
    if (help) {
      return `# ${topic.toUpperCase()} Help

${help}`;
    }

    return `Unknown help topic: ${topic}. Use \`bmad_help\` to see available topics.`;
  }
}
