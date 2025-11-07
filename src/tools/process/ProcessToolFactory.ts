import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { QueryAOProcessMessagesCommand } from "./commands/QueryAOProcessMessagesCommand.js";
import { ReadAOProcessCommand } from "./commands/ReadAOProcessCommand.js";
import { SendAOMessageCommand } from "./commands/SendAOMessageCommand.js";
import { SpawnProcessCommand } from "./commands/SpawnProcessCommand.js";

/**
 * Factory for creating core AO process management tools that provide essential
 * process lifecycle management capabilities in the Permaweb MCP server.
 *
 * The ProcessToolFactory provides four core tools for fundamental AO process operations:
 *
 * **Core Process Operations:**
 * - `SpawnProcessCommand` - Create new AO processes with optional template support
 * - `SendAOMessageCommand` - Send messages with custom tags and data to processes
 * - `ReadAOProcessCommand` - Read process state via dryrun queries (read-only)
 * - `QueryAOProcessMessagesCommand` - Query process message history and communication logs
 *
 * **Workflow Examples:**
 * ```typescript
 * // Core process lifecycle: Spawn → Send → Query
 *
 * // 1. Spawn a new AO process
 * await spawnProcessTool.execute({
 *   templateName: "basic-process"
 * });
 *
 * // 2. Deploy Lua handler code using sendAOMessage with Action: Eval
 * await sendAOMessageTool.execute({
 *   processId: "new-process-id",
 *   tags: [{ name: "Action", value: "Eval" }],
 *   data: "Handlers.add('ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), ...)"
 * });
 *
 * // 3. Query message history
 * await queryMessagesTool.execute({
 *   processId: "new-process-id",
 *   first: 10
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Factory registration in server
 * const processFactory = new ProcessToolFactory({
 *   categoryName: "Process",
 *   categoryDescription: "Core AO process management tools",
 *   context: toolContext
 * });
 *
 * processFactory.registerTools(toolRegistry);
 * ```
 *
 * @see {@link SpawnProcessCommand} For AO process creation
 * @see {@link SendAOMessageCommand} For sending messages to processes (including code deployment)
 * @see {@link ReadAOProcessCommand} For reading process state via dryrun
 * @see {@link QueryAOProcessMessagesCommand} For process message querying
 *
 * @since 1.0.0
 * @author Permaweb MCP Development Team
 */
export class ProcessToolFactory extends BaseToolFactory {
  /**
   * Returns the array of core tool command classes that this factory creates.
   *
   * The tools are returned in a logical workflow order:
   * 1. SpawnProcessCommand - Process creation
   * 2. SendAOMessageCommand - Message sending (write operations, including code deployment)
   * 3. ReadAOProcessCommand - Dryrun queries (read operations)
   * 4. QueryAOProcessMessagesCommand - Message history querying
   *
   * Each tool is instantiated with the factory's ToolContext, ensuring
   * consistent access to user credentials, embedded templates, and
   * hub configuration.
   *
   * @returns Array of 4 core tool command constructors for process management
   * @protected
   * @override
   */
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      SpawnProcessCommand,
      SendAOMessageCommand,
      ReadAOProcessCommand,
      QueryAOProcessMessagesCommand,
    ];
  }
}
