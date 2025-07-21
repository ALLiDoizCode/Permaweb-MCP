import { z } from "zod";

import { hubService } from "../../../services/HubService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { createMemoryTags } from "../utils.js";

const addMemorySchema = z
  .object({
    content: z.string().describe("The content of the memory"),
    p: z.string().describe("The public key of the other party in the memory"),
    role: z.string().describe("The role of the author of the memory"),
  })
  .strict();

type AddMemoryArgs = z.infer<typeof addMemorySchema>;

export class AddMemoryCommand extends ToolCommand<AddMemoryArgs, string> {
  protected metadata: ToolMetadata = {
    description: "Store a memory in the AI memory system for later retrieval",
    name: "storeMemory",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Store Memory",
  };

  protected parametersSchema = addMemorySchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(args: AddMemoryArgs, context: ToolContext): Promise<string> {
    const tags = createMemoryTags(args.content, args.role, args.p);

    try {
      const result = await hubService.createEvent(
        context.keyPair,
        context.hubId,
        tags,
      );
      return JSON.stringify(result);
    } catch (error) {
      throw new Error(
        `Failed to store memory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
