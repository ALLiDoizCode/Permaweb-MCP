import { z } from "zod";

import { defaultProcessService } from "../../../services/DefaultProcessService.js";
import { ProcessCacheService } from "../../../services/ProcessCacheService.js";
import {
  processCommunicationService,
  ProcessDefinition,
} from "../../../services/ProcessCommunicationService.js";
import { ProcessDiscoveryService } from "../../../services/ProcessDiscoveryService.js";
import { TokenProcessTemplateService } from "../../../services/TokenProcessTemplateService.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ExecuteActionArgs {
  processId: string;
  processMarkdown?: string;
  processType?: string;
  request: string;
}

export class ExecuteActionCommand extends ToolCommand<
  ExecuteActionArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Send messages to AO processes using natural language. This is the correct tool for AO process communication - 
      provide process documentation in markdown format and make natural language requests. The service automatically parses 
      process handlers, understands your request, formats AO messages, and sends them. Use this for sending messages to processes, 
      NOT evalProcess which is only for deploying Lua code. Essential for interactive AO process communication.`,
    name: "executeAction",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Execute Action",
  };

  protected parametersSchema = z.object({
    processId: CommonSchemas.processId.describe(
      "The AO process ID to communicate with",
    ),
    processMarkdown: z
      .string()
      .optional()
      .describe(
        "Markdown documentation describing the process handlers and parameters",
      ),
    processType: z
      .string()
      .optional()
      .describe(
        "Optional process type hint (e.g., 'token') to use embedded templates",
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

      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // If processMarkdown not provided, try to get from cache or discover process capabilities
      if (!processMarkdown) {
        // First, try to get cached process info with automatic discovery
        const cachedInfo = await ProcessCacheService.getProcessInfo(
          args.processId,
          keyPair,
        );

        if (cachedInfo && cachedInfo.success) {
          // Use cached markdown
          processMarkdown = cachedInfo.processMarkdown;
        } else if (args.processType) {
          // Fallback to template-based approach
          if (TokenProcessTemplateService.isSupported(args.processType)) {
            processMarkdown =
              TokenProcessTemplateService.getTokenTemplateAsMarkdown(
                args.processId,
              );
          } else {
            const template = defaultProcessService.getDefaultProcess(
              args.processType,
              args.processId,
            );
            if (template) {
              processMarkdown = this.convertTemplateToMarkdown(template);
            }
          }
        }
      }

      // Use ProcessCommunicationService to execute the request
      const result = await processCommunicationService.executeSmartRequest(
        args.processId,
        args.request,
        keyPair,
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
    let markdown = `# ${template.name}

`;

    for (const handler of template.handlers) {
      markdown += `## ${handler.action}

`;
      markdown += `${handler.description}

`;

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
