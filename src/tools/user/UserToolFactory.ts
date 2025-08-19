import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import {
  GenerateKeypairCommand,
  GetUserPublicKeyCommand,
} from "./commands/index.js";

export class UserToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [GenerateKeypairCommand, GetUserPublicKeyCommand];
  }
}
