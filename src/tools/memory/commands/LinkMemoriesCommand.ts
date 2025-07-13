import { z } from "zod";

import { aiMemoryService } from "../../../services/aiMemoryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface LinkMemoriesArgs {
  relationshipType:
    | "causes"
    | "contradicts"
    | "extends"
    | "references"
    | "supports";
  sourceMemoryId: string;
  strength: number;
  targetMemoryId: string;
}

export class LinkMemoriesCommand extends ToolCommand<LinkMemoriesArgs, string> {
  protected metadata: ToolMetadata = {
    description: `Create relationships between memories to build knowledge graphs and reasoning chains. 
      Useful for connecting related concepts, cause-effect relationships, and building contextual understanding.`,
    name: "linkMemories",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Link Memories",
  };

  protected parametersSchema = z.object({
    relationshipType: z
      .enum(["causes", "supports", "contradicts", "extends", "references"])
      .describe("Type of relationship"),
    sourceMemoryId: z.string().describe("ID of the source memory"),
    strength: z
      .number()
      .min(0)
      .max(1)
      .describe("Strength of the relationship (0-1)"),
    targetMemoryId: z.string().describe("ID of the target memory"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: LinkMemoriesArgs): Promise<string> {
    try {
      const relationship = {
        strength: args.strength,
        targetId: args.targetMemoryId,
        type: args.relationshipType,
      };

      const result = await aiMemoryService.linkMemories(
        this.context.keyPair,
        this.context.hubId,
        args.sourceMemoryId,
        args.targetMemoryId,
        relationship,
      );
      return result;
    } catch (error) {
      throw new Error(
        `Failed to link memories: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
