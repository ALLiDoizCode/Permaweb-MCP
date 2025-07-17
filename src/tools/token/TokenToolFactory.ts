import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { GetTokenBalanceCommand } from "./commands/GetTokenBalanceCommand.js";
import { GetTokenInfoCommand } from "./commands/GetTokenInfoCommand.js";
import { ListTokensCommand } from "./commands/ListTokensCommand.js";
import { SaveTokenMappingCommand } from "./commands/SaveTokenMappingCommand.js";
import { TransferTokensCommand } from "./commands/TransferTokensCommand.js";

/**
 * @deprecated TokenToolFactory has been replaced by the NLS (Natural Language Service) implementation.
 * Token operations are now performed through the executeAction tool with processType: "token".
 * Individual token tools are kept for reference and backwards compatibility but not registered in the server.
 */
export class TokenToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      GetTokenBalanceCommand,
      TransferTokensCommand,
      ListTokensCommand,
      GetTokenInfoCommand,
      SaveTokenMappingCommand,
    ];
  }
}
