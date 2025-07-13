import { z } from "zod";

import type { PermawebDocsResult } from "../../../services/PermawebDocsService.js";

import { aiMemoryService } from "../../../services/AIMemoryService.js";
import { PermawebDocs } from "../../../services/PermawebDocsService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface SearchMemoriesAdvancedArgs {
  domain?: string;
  endDate?: string;
  importanceThreshold?: number;
  includePermawebDocs?: boolean;
  memoryType?: string;
  query: string;
  sessionId?: string;
  startDate?: string;
}

export class SearchMemoriesAdvancedCommand extends ToolCommand<
  SearchMemoriesAdvancedArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Search memories with advanced filtering options including memory type, importance threshold, 
      time range, and contextual filters. Returns results ranked by relevance and importance. Can also include 
      live Permaweb documentation results for comprehensive answers.`,
    name: "searchMemoriesAdvanced",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Advanced Memory Search",
  };

  protected parametersSchema = z.object({
    domain: z.string().optional().describe("Filter by domain/category"),
    endDate: z
      .string()
      .optional()
      .describe("End date for time range filter (ISO string)"),
    importanceThreshold: CommonSchemas.importance
      .optional()
      .describe("Minimum importance score"),
    includePermawebDocs: z
      .boolean()
      .optional()
      .describe("Include live Permaweb documentation results (default: true)"),
    memoryType: CommonSchemas.memoryType
      .optional()
      .describe("Filter by memory type"),
    query: z.string().describe("Search query or keywords"),
    sessionId: z.string().optional().describe("Filter by session ID"),
    startDate: z
      .string()
      .optional()
      .describe("Start date for time range filter (ISO string)"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SearchMemoriesAdvancedArgs): Promise<string> {
    try {
      let permawebResults: PermawebDocsResult[] = [];

      // Check if we should include Permaweb documentation
      if (args.includePermawebDocs !== false) {
        try {
          const permawebDocsService = new PermawebDocs();
          const docsResult: PermawebDocsResult[] =
            await permawebDocsService.query(args.query, undefined, 10);
          permawebResults = docsResult || [];
        } catch {
          // Continue without Permaweb docs if there's an error
        }
      }

      // Build filters for AI memory search
      const filters: Record<string, unknown> = {};

      if (args.memoryType) filters.memoryType = args.memoryType;
      if (args.domain) filters.domain = args.domain;
      if (args.sessionId) filters.sessionId = args.sessionId;
      if (args.importanceThreshold)
        filters.importanceThreshold = args.importanceThreshold;
      if (args.startDate) filters.startDate = args.startDate;
      if (args.endDate) filters.endDate = args.endDate;

      const memories = await aiMemoryService.searchAdvanced(
        this.context.hubId,
        args.query,
        filters,
      );

      const response = {
        memories: memories || [],
        permawebDocs: permawebResults,
        query: args.query,
        totalResults: {
          memories: memories?.length || 0,
          permawebDocs: permawebResults.length,
        },
      };

      return JSON.stringify(response);
    } catch (error) {
      throw new Error(
        `Failed to perform advanced memory search: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
