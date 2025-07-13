import { z } from "zod";

import { aiMemoryService } from "../../../services/AIMemoryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface AddMemoriesBatchArgs {
  memories: string;
  p: string;
}

export class AddMemoriesBatchCommand extends ToolCommand<
  AddMemoriesBatchArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Add multiple memories in a single operation for efficiency. Useful for bulk memory imports 
      or when processing large amounts of conversational data.`,
    name: "addMemoriesBatch",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Add Memories Batch",
  };

  protected parametersSchema = z.object({
    memories: z
      .string()
      .describe("JSON string containing array of memory objects"),
    p: z.string().describe("The public key of the participant"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: AddMemoriesBatchArgs): Promise<string> {
    try {
      const memories = JSON.parse(args.memories);
      const results = await aiMemoryService.addMemoriesBatch(
        this.context.keyPair,
        this.context.hubId,
        memories,
        args.p,
      );
      return JSON.stringify(results);
    } catch (error) {
      throw new Error(
        `Failed to add memories batch: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
