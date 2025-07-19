import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { CreateProcessCommand } from "./commands/CreateProcessCommand.js";
import { ExecuteActionCommand } from "./commands/ExecuteActionCommand.js";
import { QueryAOProcessMessagesCommand } from "./commands/QueryAOProcessMessagesCommand.js";

export class ProcessToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      CreateProcessCommand,
      ExecuteActionCommand,
      QueryAOProcessMessagesCommand,
    ];
  }
}
