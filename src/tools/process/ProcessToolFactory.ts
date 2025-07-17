import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { ExecuteProcessActionCommand } from "./commands/ExecuteProcessActionCommand.js";
import { QueryAOProcessMessagesCommand } from "./commands/QueryAOProcessMessagesCommand.js";

export class ProcessToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [ExecuteProcessActionCommand, QueryAOProcessMessagesCommand];
  }
}
