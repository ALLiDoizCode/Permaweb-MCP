import { z } from "zod";

import { hubService } from "../../../services/HubService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";
import { MEMORY_KIND } from "../constants.js";

const searchMemoriesSchema = z
  .object({
    search: z.string().describe("keyword or content"),
  })
  .strict();

type SearchMemoriesArgs = z.infer<typeof searchMemoriesSchema>;

export class SearchMemoriesCommand extends ToolCommand<
  SearchMemoriesArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Search stored memories by keywords or content",
    name: "searchMemory",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Search Memory",
  };

  protected parametersSchema = searchMemoriesSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: SearchMemoriesArgs,
    context: ToolContext,
  ): Promise<string> {
    try {
      const memories = await hubService.search(
        context.hubId!,
        args.search,
        MEMORY_KIND,
      );
      return JSON.stringify(memories);
    } catch (error) {
      throw new Error(
        `Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
