import { z } from "zod";

import { createProcess } from "../../../process.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface CreateProcessArgs {
  // No parameters required for basic process creation
}

export class CreateProcessCommand extends ToolCommand<
  CreateProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Create a new AO process and return its process ID. This spawns a fresh AO process using the default AOS module configuration, ready for immediate use in decentralized computing workflows.",
    name: "createProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Create AO Process",
  };

  protected parametersSchema = z.object({
    // No parameters required for basic process creation
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: CreateProcessArgs): Promise<string> {
    try {
      const processId = await createProcess(this.context.keyPair);

      return JSON.stringify({
        message: `AO process created successfully: ${processId}`,
        processId,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to create AO process",
        success: false,
      });
    }
  }
}
