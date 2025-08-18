import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { AnalyzeProcessArchitectureCommand } from "./commands/AnalyzeProcessArchitectureCommand.js";
import { EvalProcessCommand } from "./commands/EvalProcessCommand.js";
import { ExecuteActionCommand } from "./commands/ExecuteActionCommand.js";
import { GenerateLuaProcessCommand } from "./commands/GenerateLuaProcessCommand.js";
import { QueryAOProcessMessagesCommand } from "./commands/QueryAOProcessMessagesCommand.js";
import { RollbackDeploymentCommand } from "./commands/RollbackDeploymentCommand.js";
import { SendMessageCommand } from "./commands/SendMessageCommand.js";
import { SpawnProcessCommand } from "./commands/SpawnProcessCommand.js";
import { ValidateDeploymentCommand } from "./commands/ValidateDeploymentCommand.js";

/**
 * Factory for creating AO process management tools that provide comprehensive
 * process lifecycle management capabilities in the Permamind MCP server.
 *
 * The ProcessToolFactory integrates four complementary tools that enable
 * complete AO process workflows:
 *
 * **Process Lifecycle Management:**
 * - `SpawnProcessCommand` - Spawn new AO processes with optional template support
 * - `EvalProcessCommand` - Deploy Lua code to processes (handlers, modules) - NOT for messaging
 * - `SendMessageCommand` - Send direct messages to processes with specific actions - SIMPLE messaging
 * - `ExecuteActionCommand` - Send messages to processes using natural language - SMART messaging
 * - `QueryAOProcessMessagesCommand` - Query process message history and communication logs
 * - `ValidateDeploymentCommand` - Validate deployed process functionality
 * - `RollbackDeploymentCommand` - Rollback failed deployments
 *
 * **Integration Capabilities:**
 * - Seamless integration with BMAD workflow automation
 * - Compatible with existing Permamind memory and token tools
 * - Support for embedded process templates (token, DAO, etc.)
 * - Natural language interface for process communication
 *
 * **Workflow Examples:**
 * ```typescript
 * // Complete process lifecycle:
 * // 1. Create → 2. Evaluate → 3. Communicate → 4. Query
 *
 * // 1. Create a new AO process
 * await createProcessTool.execute({});
 *
 * // 2. Deploy handler code using evalProcess (for Lua code deployment)
 * await evalProcessTool.execute({
 *   processId: "new-process-id",
 *   code: "Handlers.add('ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), ...)"
 * });
 *
 * // 3. Send messages to the process using executeAction (for messaging)
 * await executeActionTool.execute({
 *   processId: "new-process-id",
 *   request: "Send a ping message",
 *   processMarkdown: "# Process Documentation..."
 * });
 *
 * // 4. Query message history
 * await queryMessagesTool.execute({
 *   processId: "new-process-id",
 *   first: 10
 * });
 * ```
 *
 * **BMAD Integration:**
 * Process tools work seamlessly within BMAD workflow contexts, enabling
 * automated process creation, testing, and deployment through BMAD templates
 * and task execution.
 *
 * @example
 * ```typescript
 * // Factory registration in server
 * const processFactory = new ProcessToolFactory({
 *   categoryName: "Process",
 *   categoryDescription: "AO process communication and blockchain query tools",
 *   context: toolContext
 * });
 *
 * processFactory.registerTools(toolRegistry);
 * ```
 *
 * @see {@link SpawnProcessCommand} For AO process creation
 * @see {@link EvalProcessCommand} For process code evaluation
 * @see {@link ExecuteActionCommand} For natural language process communication
 * @see {@link QueryAOProcessMessagesCommand} For process message querying
 *
 * @since 1.0.0
 * @author Permamind Development Team
 */
export class ProcessToolFactory extends BaseToolFactory {
  /**
   * Returns the array of tool command classes that this factory creates.
   *
   * The tools are returned in a logical workflow order:
   * 1. SpawnProcessCommand - Process creation
   * 2. EvalProcessCommand - Code evaluation and setup
   * 3. SendMessageCommand - Direct message sending
   * 4. ExecuteActionCommand - Smart natural language communication
   * 5. QueryAOProcessMessagesCommand - Message history and monitoring
   *
   * Each tool is instantiated with the factory's ToolContext, ensuring
   * consistent access to user credentials, embedded templates, and
   * hub configuration.
   *
   * @returns Array of tool command constructors for process management
   * @protected
   * @override
   */
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      AnalyzeProcessArchitectureCommand,
      SpawnProcessCommand,
      EvalProcessCommand,
      ExecuteActionCommand,
      GenerateLuaProcessCommand,
      QueryAOProcessMessagesCommand,
      SendMessageCommand,
      ValidateDeploymentCommand,
      RollbackDeploymentCommand,
    ];
  }
}
