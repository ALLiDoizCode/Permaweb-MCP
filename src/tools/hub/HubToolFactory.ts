import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import {
  CreateHubCommand,
  GetHubCommand,
  InitializeHubCommand,
} from "./commands/index.js";

export class HubToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [CreateHubCommand, GetHubCommand, InitializeHubCommand];
  }
}
