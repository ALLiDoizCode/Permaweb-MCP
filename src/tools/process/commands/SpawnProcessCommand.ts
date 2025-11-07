import { z } from "zod";

import { createProcess } from "../../../process.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SpawnProcessArgs extends Record<string, never> {
  // No parameters required for basic process creation
}

export class SpawnProcessCommand extends ToolCommand<SpawnProcessArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "LOW-LEVEL INFRASTRUCTURE TOOL: Spawns an empty AO process container on the Arweave network and returns its process ID. This is for infrastructure operations like creating storage containers or registry processes - NOT for developing AO applications. FOR AO APPLICATION DEVELOPMENT: Use the 'ao' skill instead to write, test, and deploy complete AO processes with proper Lua code. This tool only creates empty process shells without code. Use cases: Creating dedicated storage processes, spawning process registries, or infrastructure components. Workflow: 1) spawnProcess (creates empty container) → 2) sendAOMessage with Action: Eval (deploys code). Automatically initializes wallet if needed.",
    name: "spawnProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Spawn Empty AO Process",
  };

  protected parametersSchema = z.object({
    // No parameters required for basic process creation
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SpawnProcessArgs): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      const processId = await createProcess(keyPair);

      return JSON.stringify({
        message: `AO process created successfully: ${processId}`,
        processId,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to create AO process",
        success: false,
      });
    }
  }
}
