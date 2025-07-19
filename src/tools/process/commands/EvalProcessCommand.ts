import { z } from "zod";

import { evalProcess } from "../../../relay.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface EvalProcessArgs {
  code: string;
  processId: string;
}

export class EvalProcessCommand extends ToolCommand<EvalProcessArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Evaluate Lua code within an existing AO process. This allows testing functionality, debugging issues, and executing operations programmatically within the AO compute environment.",
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
    processId: z
      .string()
      .regex(
        /^[a-zA-Z0-9_-]{43}$/,
        "Process ID must be a 43-character base64-like string"
      )
      .describe("The AO process ID to evaluate code within"),
  });

  async execute(args: EvalProcessArgs, context: ToolContext): Promise<string> {
    try {
      const result = await evalProcess(
        context.keyPair,
        args.code,
        args.processId,
      );

      if (result === null || result === undefined) {
        return JSON.stringify({
          error: "Evaluation returned null result",
          message: "Code evaluation failed or timed out",
          success: false,
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
