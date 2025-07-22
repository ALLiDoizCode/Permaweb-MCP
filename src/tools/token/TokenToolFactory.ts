import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { CreateTokenCommand } from "./commands/CreateTokenCommand.js";
import { GetTokenBalanceCommand } from "./commands/GetTokenBalanceCommand.js";
import { GetTokenBalancesCommand } from "./commands/GetTokenBalancesCommand.js";
import { GetTokenInfoCommand } from "./commands/GetTokenInfoCommand.js";
import { ListTokensCommand } from "./commands/ListTokensCommand.js";
import { MintTokenCommand } from "./commands/MintTokenCommand.js";
import { SaveTokenMappingCommand } from "./commands/SaveTokenMappingCommand.js";
import { TransferTokensCommand } from "./commands/TransferTokensCommand.js";

export class TokenToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      CreateTokenCommand,
      GetTokenBalanceCommand,
      GetTokenBalancesCommand,
      GetTokenInfoCommand,
      ListTokensCommand,
      MintTokenCommand,
      SaveTokenMappingCommand,
      TransferTokensCommand,
    ];
  }
}
