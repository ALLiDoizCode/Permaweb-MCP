import { z } from "zod";

import { evalProcess } from "../../../relay.js";
import { ProcessCacheService } from "../../../services/ProcessCacheService.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface EvalProcessArgs {
  code: string;
  processId: string;
}

export class EvalProcessCommand extends ToolCommand<EvalProcessArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Deploy and evaluate Lua code within an existing AO process. DEPLOYMENT WORKFLOW: Step 2 of 3: 1) spawnProcess → 2) evalProcess (this tool) → 3) test with executeAction. This is the CORRECT tool for deploying Lua code to AO processes - DO NOT use aos CLI or aos send-file. Use this tool specifically for deploying Lua code (handlers, modules) to processes - NOT for sending messages. Use executeAction for sending messages to processes. Handler registration returns null (success) indicating successful deployment.",
    name: "evalProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Deploy Lua Code to Process (Step 2/3 - Deployment Workflow)",
  };

  protected parametersSchema = z.object({
    code: z
      .string()
      .min(1, "Lua code cannot be empty")
      .max(10000, "Lua code too long (max 10000 characters)")
      .describe("Lua code to evaluate in the AO process"),
    processId: CommonSchemas.processId.describe(
      "The AO process ID to evaluate code within",
    ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: EvalProcessArgs): Promise<string> {
    try {
      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      const result = await evalProcess(keyPair, args.code, args.processId);

      // Clear cached process info since handlers may have changed
      ProcessCacheService.clearProcessCache(args.processId);

      // Null result is normal for handler registration - indicates success
      if (result === null || result === undefined) {
        return JSON.stringify({
          message:
            "Code evaluated successfully (handler registration completed)",
          result: "No return value - handlers registered successfully",
          success: true,
        });
      }

      return JSON.stringify({
        message: "Code evaluated successfully",
        result,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to evaluate code in AO process",
        success: false,
      });
    }
  }
}
