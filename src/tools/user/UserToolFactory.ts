import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import {
  AnalyzePromptCommand,
  GetUserHubIdCommand,
  GetUserPublicKeyCommand,
} from "./commands/index.js";

export class UserToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [AnalyzePromptCommand, GetUserPublicKeyCommand, GetUserHubIdCommand];
  }
}
