import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import {
  ConfigureAgentCommand,
  DetectAgentCommand,
  GetAgentStateCommand,
  InitializeBMadProjectCommand,
  TransferAgentContextCommand,
} from "./commands/index.js";

export class ClaudeCodeToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      DetectAgentCommand,
      ConfigureAgentCommand,
      GetAgentStateCommand,
      TransferAgentContextCommand,
      InitializeBMadProjectCommand,
    ];
  }
}
