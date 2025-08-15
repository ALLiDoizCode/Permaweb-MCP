import { z } from "zod";

import { evalProcess } from "../../../relay.js";
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
      "Deploy and evaluate Lua code within an existing AO process. This is specifically for deploying Lua code (like handlers, modules) to processes - NOT for sending messages to processes. Use executeAction for sending messages to processes. Note: Handler registration returns null (success) as there's no immediate return value.",
    name: "evalProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Evaluate Process Code",
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
