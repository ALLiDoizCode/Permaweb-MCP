import { z } from "zod";

import { isMemoryEnabled } from "../../../constants.js";
import { hubService } from "../../../services/HubService.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { createMemoryTags } from "../utils.js";

const addMemorySchema = z
  .object({
    content: z.string().describe("The content of the memory"),
    forceStore: z
      .boolean()
      .optional()
      .describe(
        "Force storage even when MEMORY environment variable is disabled. Use true when user explicitly requests memory storage.",
      ),
    p: z.string().describe("The public key of the other party in the memory"),
    role: z.string().describe("The role of the author of the memory"),
  })
  .strict();

type AddMemoryArgs = z.infer<typeof addMemorySchema>;

export class AddMemoryCommand extends ToolCommand<AddMemoryArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Store a memory in the AI memory system for later retrieval. When MEMORY environment variable is disabled, automatic storage is blocked unless forceStore=true is used for explicit user requests.",
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
    // Check if memory storage should proceed
    const shouldStore = isMemoryEnabled() || args.forceStore === true;

    if (!shouldStore) {
      return JSON.stringify({
        message:
          "Memory storage is disabled. Set MEMORY=true environment variable to enable automatic memory storage, or use forceStore=true parameter for explicit storage requests.",
        stored: false,
        success: false,
      });
    }

    const tags = createMemoryTags(args.content, args.role, args.p);

    try {
      const autoContext = AutoSafeToolContext.from(context);
      const { generated, hubCreated, hubId, keyPair } =
        await autoContext.initializeAll();

      if (generated || hubCreated) {
        const status = [];
        if (generated) status.push("Generated new keypair");
        if (hubCreated) status.push("Created new hub");

        // Store initialization info in memory only if memory is enabled
        if (isMemoryEnabled()) {
          const initTags = createMemoryTags(
            `Auto-initialization completed: ${status.join(", ")}`,
            "system",
            args.p,
          );
          await hubService.createEvent(keyPair, hubId, initTags);
        }
      }

      const result = await hubService.createEvent(keyPair, hubId, tags);
      return JSON.stringify(result);
    } catch (error) {
      throw new Error(
        `Failed to store memory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
