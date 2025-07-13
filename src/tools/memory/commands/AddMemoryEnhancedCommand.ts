import { z } from "zod";

import { MemoryType } from "../../../models/AIMemory.js";
import { aiMemoryService } from "../../../services/AIMemoryService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface AddMemoryEnhancedArgs {
  content: string;
  domain?: string;
  importance?: number;
  memoryType?: MemoryType;
  p: string;
  relatedMemories?: string;
  role: string;
  sessionId?: string;
  tags?: string;
  topic?: string;
}

export class AddMemoryEnhancedCommand extends ToolCommand<
  AddMemoryEnhancedArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `PREFERRED: Use this enhanced tool to store ALL conversations with rich AI metadata including importance scoring, 
      memory type categorization, and contextual information. This should be your primary choice for storing memories.
      Automatically categorize conversations by type (conversation/reasoning/knowledge/procedure) and set appropriate importance scores.`,
    name: "addMemoryEnhanced",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Add Enhanced Memory",
  };

  protected parametersSchema = z.object({
    content: z.string().describe("The content of the memory"),
    domain: z
      .string()
      .optional()
      .describe("Domain or category (e.g., 'programming', 'personal')"),
    importance: CommonSchemas.importance
      .optional()
      .describe("Importance score 0-1 (default: 0.5)"),
    memoryType: CommonSchemas.memoryType
      .optional()
      .describe("Type of memory (default: conversation)"),
    p: z.string().describe("The public key of the participant"),
    relatedMemories: z
      .string()
      .optional()
      .describe("Comma-separated list of related memory IDs"),
    role: z.string().describe("The role of the author (system/user/assistant)"),
    sessionId: z.string().optional().describe("Session or conversation ID"),
    tags: z.string().optional().describe("Comma-separated list of tags"),
    topic: z.string().optional().describe("Topic or subject of the memory"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: AddMemoryEnhancedArgs): Promise<string> {
    try {
      const aiMemory = {
        content: args.content,
        context: {
          domain: args.domain,
          relatedMemories: args.relatedMemories
            ? args.relatedMemories.split(",").map((s) => s.trim())
            : [],
          sessionId: args.sessionId,
          topic: args.topic,
        },
        importance: args.importance || 0.5,
        memoryType: args.memoryType || "conversation",
        metadata: {
          accessCount: 0,
          lastAccessed: new Date().toISOString(),
          tags: args.tags ? args.tags.split(",").map((s) => s.trim()) : [],
        },
        p: args.p,
        role: args.role,
      };

      const result = await aiMemoryService.addEnhanced(
        this.context.keyPair,
        this.context.hubId,
        aiMemory,
      );
      return result;
    } catch (error) {
      throw new Error(
        `Failed to add enhanced memory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
