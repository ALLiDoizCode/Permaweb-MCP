import { z } from "zod";

import { defaultProcessService } from "../../../services/DefaultProcessService.js";
import {
  processCommunicationService,
  ProcessDefinition,
} from "../../../services/ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "../../../services/TokenProcessTemplateService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ExecuteActionArgs {
  processId: string;
  processType?: string;
  processMarkdown?: string;
  request: string;
}

export class ExecuteActionCommand extends ToolCommand<
  ExecuteActionArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Execute actions on AO processes using natural language. This is the core tool for AO process communication - 
      provide process documentation in markdown format and make natural language requests. The service automatically parses 
      process handlers, understands your request, formats AO messages, and executes them. Essential for interactive AO process 
      communication in the decentralized computing environment.`,
    name: "executeAction",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Execute Action",
  };

  protected parametersSchema = z.object({
    processId: CommonSchemas.processId.describe(
      "The AO process ID to communicate with",
    ),
    processType: z
      .string()
      .optional()
      .describe(
        "Optional process type hint (e.g., 'token') to use embedded templates",
      ),
    processMarkdown: z
      .string()
      .optional()
      .describe(
        "Markdown documentation describing the process handlers and parameters",
      ),
    request: z
      .string()
      .describe("Natural language request describing what action to perform"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: ExecuteActionArgs): Promise<string> {
    try {
      let processMarkdown: string | undefined = args.processMarkdown;

      // If processMarkdown not provided but processType is, use embedded template
      if (!processMarkdown && args.processType) {
        // Check if it's a token process type
        if (TokenProcessTemplateService.isSupported(args.processType)) {
          processMarkdown =
            TokenProcessTemplateService.getTokenTemplateAsMarkdown(
              args.processId,
            );
        } else {
          // Fallback to default process service for other types
          const template = defaultProcessService.getDefaultProcess(
            args.processType,
            args.processId,
          );
          if (template) {
            // Convert template to markdown format
            processMarkdown = this.convertTemplateToMarkdown(template);
          }
        }
      }

      // Use ProcessCommunicationService to execute the request
      const result = await processCommunicationService.executeSmartRequest(
        args.processId,
        args.request,
        this.context.keyPair,
        processMarkdown,
        this.context.embeddedTemplates,
      );

      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  }

  private convertTemplateToMarkdown(template: ProcessDefinition): string {
    // Use the same markdown generation logic as TokenProcessTemplateService
    // to maintain consistency across template conversions
    let markdown = `# ${template.name}\n\n`;

    for (const handler of template.handlers) {
      markdown += `## ${handler.action}\n\n`;
      markdown += `${handler.description}\n\n`;

      if (handler.parameters && handler.parameters.length > 0) {
        for (const param of handler.parameters) {
          const required = param.required ? "required" : "optional";
          markdown += `- ${param.name}: ${param.description} (${required})\n`;
        }
        markdown += "\n";
      }

      if (handler.examples && handler.examples.length > 0) {
        markdown += "Examples:\n";
        for (const example of handler.examples) {
          markdown += `- ${example}\n`;
        }
        markdown += "\n";
      }
    }

    return markdown;
  }
}
