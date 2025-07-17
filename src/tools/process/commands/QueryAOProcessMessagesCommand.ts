import { z } from "zod";

import { AOProcessQuery, SortOrder } from "../../../models/ArweaveGraphQL.js";
import { arweaveGraphQLService } from "../../../services/ArweaveGraphQLService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface QueryAOProcessMessagesArgs {
  action?: string;
  after?: string;
  before?: string;
  first?: number;
  fromProcessId?: string;
  last?: number;
  msgRefs?: string[];
  processId?: string;
  reference?: string;
  sort?: SortOrder;
  sortOrder?: SortOrder;
  toProcessId?: string;
}

export class QueryAOProcessMessagesCommand extends ToolCommand<
  QueryAOProcessMessagesArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Query AO process messages and communication history. Essential tool for monitoring AO process interactions, 
    tracking message flows, and analyzing process state changes. Filter by process IDs, message references, actions, and 
    other AO-specific parameters. Core functionality for AO process communication analysis and debugging.
    
    DISPLAY FORMAT: When presenting AO process messages, use this consistent format:
    
    For individual messages:
    Message: abc123...def789
    Time: 2024-01-01 12:00:00 UTC (Block #1234567)
    From: ProcessA...123 → To: ProcessB...456
    Size: 1.2 MB (application/json)
    App: AO-Process (ALWAYS include if found in tags)
    Action: Transfer (ALWAYS include if found in tags)
    Reference: msg_ref_123
    
    For message lists:
    Found X AO messages:
    1. abc123...def789 | 2024-01-01 12:00 UTC | ProcessA...123 → ProcessB...456 | Action: Transfer
    2. def456...ghi012 | 2024-01-01 11:30 UTC | ProcessA...123 → ProcessC...789 | Action: Mint
    
    REQUIREMENTS:
    - Truncate transaction and process IDs to first 6 + last 6 characters
    - Use timestampFormatted field for human-readable time
    - ALWAYS show App and Action if found in transaction tags
    - Show process communication flow (From → To)
    - Include message references when available`,
    name: "queryAOProcessMessages",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Query AO Process Messages",
  };

  protected parametersSchema = z.object({
    action: z
      .string()
      .optional()
      .describe("Filter by action type (e.g., 'Transfer', 'Mint')"),
    after: z.string().optional().describe("Cursor for pagination"),
    before: z.string().optional().describe("Cursor for pagination"),
    first: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of results to return (max 100, default 10)"),
    fromProcessId: z
      .string()
      .optional()
      .describe("Filter by sender process ID"),
    last: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of results to return from the end"),
    msgRefs: z
      .array(z.string())
      .optional()
      .describe("Array of message reference IDs"),
    processId: z.string().optional().describe("Filter by process ID"),
    reference: z.string().optional().describe("Filter by message reference"),
    sort: z
      .nativeEnum(SortOrder)
      .optional()
      .describe("Sort order (default: INGESTED_AT_DESC)"),
    sortOrder: z
      .nativeEnum(SortOrder)
      .optional()
      .describe("Sort order (default: INGESTED_AT_DESC)"),
    toProcessId: z
      .string()
      .optional()
      .describe("Filter by recipient process ID"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: QueryAOProcessMessagesArgs): Promise<string> {
    try {
      const query: AOProcessQuery = {
        first: args.first || 10,
        sort: (args.sort as SortOrder) || "INGESTED_AT_DESC",
      };

      if (args.fromProcessId) {
        query.fromProcessId = args.fromProcessId;
      }

      if (args.toProcessId) {
        query.toProcessId = args.toProcessId;
      }

      if (args.msgRefs) {
        query.msgRefs = args.msgRefs;
      }

      if (args.action) {
        query.action = args.action;
      }

      if (args.after) {
        query.after = args.after;
      }

      const result = await arweaveGraphQLService.queryAOProcessMessages(query);

      return JSON.stringify({
        query: args,
        result: {
          count: result.transactions.length,
          pageInfo: result.pageInfo,
          transactions: result.transactions,
        },
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to query AO process messages: ${error instanceof Error ? error.message : "Unknown error"}`,
        query: args,
        success: false,
      });
    }
  }
}
