import { z } from "zod";

import { fetchEvents } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/aiMemoryService.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

export class ListContactsCommand extends ToolCommand<
  Record<string, never>,
  string
> {
  protected metadata: ToolMetadata = {
    description: "List all saved contact mappings from the address book",
    name: "listContacts",
    openWorldHint: false,
    readOnlyHint: true,
    title: "List Saved Contacts",
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
        kinds: [MEMORY_KINDS.CONTACT_MAPPING],
        //limit: 100
      };
      const _filters = JSON.stringify([filter]);
      const events = await fetchEvents(hubId, _filters);
      return JSON.stringify(events);
    } catch (error) {
      return JSON.stringify({
        error: `Failed to list contacts: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
