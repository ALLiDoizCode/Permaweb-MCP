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
      "Spawn an empty AO process container (no code) and return its process ID. This creates a fresh AO process using the default AOS module configuration, ready for code deployment via evalProcess. DEPLOYMENT WORKFLOW: Step 1 of 3: 1) spawnProcess (this tool) → 2) evalProcess → 3) test with executeAction. DO NOT use aos CLI - use Permamind tools only. Use 'spawn empty process' or 'spawn process' to trigger this tool. Automatically initializes wallet and hub if needed.",
    name: "spawnProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Spawn Empty AO Process (Step 1/3 - Deployment Workflow)",
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
