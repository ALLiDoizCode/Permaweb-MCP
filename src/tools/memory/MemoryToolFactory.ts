import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { AddMemoryCommand } from "./commands/AddMemoryCommand.js";
import { SearchMemoriesCommand } from "./commands/SearchMemoriesCommand.js";

export class MemoryToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [AddMemoryCommand, SearchMemoriesCommand];
  }
}
