import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { BuyArnsRecordCommand } from "./commands/BuyArnsRecordCommand.js";
import { GetArnsRecordInfoCommand } from "./commands/GetArnsRecordInfoCommand.js";
import { GetArnsTokenCostCommand } from "./commands/GetArnsTokenCostCommand.js";
import { ResolveArnsNameCommand } from "./commands/ResolveArnsNameCommand.js";
import { TransferArnsRecordCommand } from "./commands/TransferArnsRecordCommand.js";
import { UpdateArnsRecordCommand } from "./commands/UpdateArnsRecordCommand.js";

/**
 * ArNS Tool Factory
 * Manages registration and initialization of ArNS-related MCP tools
 */
export class ArnsToolFactory extends BaseToolFactory {
  /**
   * Get array of ArNS tool command classes
   */
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      BuyArnsRecordCommand,
      GetArnsRecordInfoCommand,
      GetArnsTokenCostCommand,
      ResolveArnsNameCommand,
      TransferArnsRecordCommand,
      UpdateArnsRecordCommand,
    ];
  }
}
