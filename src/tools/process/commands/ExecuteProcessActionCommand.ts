import { z } from "zod";

import { processCommunicationService } from "../../../services/ProcessCommunicationService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ExecuteProcessActionArgs {
  processId: string;
  processMarkdown: string;
  request: string;
}

/**
 * @deprecated ExecuteProcessActionCommand has been consolidated into ExecuteActionCommand.
 * Use ExecuteActionCommand with the processMarkdown parameter instead.
 * This provides unified functionality for both embedded templates and custom process documentation.
 */
export class ExecuteProcessActionCommand extends ToolCommand<
  ExecuteProcessActionArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Execute actions on AO processes using natural language. This is the core tool for AO process communication - 
      provide process documentation in markdown format and make natural language requests. The service automatically parses 
      process handlers, understands your request, formats AO messages, and executes them. Essential for interactive AO process 
      communication in the decentralized computing environment.`,
    name: "executeProcessAction",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Execute Process Action",
  };

  protected parametersSchema = z.object({
    processId: CommonSchemas.processId.describe(
      "The AO process ID to communicate with",
    ),
    processMarkdown: z
      .string()
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

  async execute(args: ExecuteProcessActionArgs): Promise<string> {
    try {
      const result = await processCommunicationService.executeProcessRequest(
        args.processMarkdown,
        args.processId,
        args.request,
        this.context.keyPair,
      );
      return JSON.stringify(result);
    } catch (error) {
      return `Error: ${error}`;
    }
  }
}
