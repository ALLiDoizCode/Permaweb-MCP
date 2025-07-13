import { z } from "zod";

import { aiMemoryService } from "../../../services/AIMemoryService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface AddReasoningChainArgs {
  chainId: string;
  outcome: string;
  p: string;
  steps: string;
}

export class AddReasoningChainCommand extends ToolCommand<
  AddReasoningChainArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Store AI reasoning steps and decision pathways. Useful for tracking chain-of-thought processes, 
      debugging AI decisions, and building reasoning history.`,
    name: "addReasoningChain",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Add Reasoning Chain",
  };

  protected parametersSchema = z.object({
    chainId: z.string().describe("Unique identifier for the reasoning chain"),
    outcome: z.string().describe("The final outcome or conclusion"),
    p: z.string().describe("The public key of the participant"),
    steps: z
      .string()
      .describe("JSON string containing array of reasoning steps"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: AddReasoningChainArgs): Promise<string> {
    try {
      const reasoning = {
        chainId: args.chainId,
        outcome: args.outcome,
        steps: JSON.parse(args.steps),
      };

      const result = await aiMemoryService.addReasoningChain(
        this.context.keyPair,
        this.context.hubId,
        reasoning,
        args.p,
      );
      return result;
    } catch (error) {
      throw new Error(
        `Failed to add reasoning chain: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
