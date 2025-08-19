import { z } from "zod";

import { fetchEvents } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/aiMemoryService.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

export class ListTokensCommand extends ToolCommand<
  Record<string, never>,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Core MVP functionality: List all saved token mappings from the registry",
    name: "listTokens",
    openWorldHint: false,
    readOnlyHint: true,
    title: "List Saved Tokens",
  };

  protected parametersSchema = z.object({});

  constructor(private context: ToolContext) {
    super();
  }

  async execute(): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { hubId } = await safeContext.initializeAll();

      // Use dedicated kind for efficient filtering
      const filter = {
        kinds: [MEMORY_KINDS.TOKEN_MAPPING],
        //limit: 100
      };
      const _filters = JSON.stringify([filter]);
      const events = await fetchEvents(hubId, _filters);
      return JSON.stringify(events);
    } catch (error) {
      return JSON.stringify({
        error: `Failed to list tokens: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
