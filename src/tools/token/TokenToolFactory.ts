import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { GetTokenBalanceCommand } from "./commands/GetTokenBalanceCommand.js";
import { GetTokenInfoCommand } from "./commands/GetTokenInfoCommand.js";
import { ListTokensCommand } from "./commands/ListTokensCommand.js";
import { TransferTokensCommand } from "./commands/TransferTokensCommand.js";

export class TokenToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      GetTokenBalanceCommand,
      TransferTokensCommand,
      ListTokensCommand,
      GetTokenInfoCommand,
    ];
  }
}
