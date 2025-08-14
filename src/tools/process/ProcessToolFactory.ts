import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { AnalyzeProcessArchitectureCommand } from "./commands/AnalyzeProcessArchitectureCommand.js";
import { CreateGuidedProcessCommand } from "./commands/CreateGuidedProcessCommand.js";
import { CreateProcessCommand } from "./commands/CreateProcessCommand.js";
import { EvalProcessCommand } from "./commands/EvalProcessCommand.js";
import { ExecuteActionCommand } from "./commands/ExecuteActionCommand.js";
import { GenerateLuaProcessCommand } from "./commands/GenerateLuaProcessCommand.js";
import { OrchestateProcessWorkflowCommand } from "./commands/OrchestateProcessWorkflowCommand.js";
import { QueryAOProcessMessagesCommand } from "./commands/QueryAOProcessMessagesCommand.js";

/**
 * Factory for creating AO process management tools that provide comprehensive
 * process lifecycle management capabilities in the Permamind MCP server.
 *
 * The ProcessToolFactory integrates four complementary tools that enable
 * complete AO process workflows:
 *
 * **Process Lifecycle Management:**
 * - `CreateProcessCommand` - Spawn new AO processes with optional template support
 * - `EvalProcessCommand` - Execute Lua code within existing processes for testing/setup
 * - `ExecuteActionCommand` - Send natural language requests to processes via markdown docs
 * - `QueryAOProcessMessagesCommand` - Query process message history and communication logs
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
 * // 2. Evaluate initial setup code
 * await evalProcessTool.execute({
 *   processId: "new-process-id",
 *   code: "Handlers.add('ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), ...)"
 * });
 *
 * // 3. Communicate with the process
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
 * @see {@link CreateProcessCommand} For AO process creation
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
   * 1. CreateProcessCommand - Process creation
   * 2. EvalProcessCommand - Code evaluation and setup
   * 3. ExecuteActionCommand - Process communication
   * 4. QueryAOProcessMessagesCommand - Message history and monitoring
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
      CreateGuidedProcessCommand,
      CreateProcessCommand,
      EvalProcessCommand,
      ExecuteActionCommand,
      GenerateLuaProcessCommand,
      OrchestateProcessWorkflowCommand,
      QueryAOProcessMessagesCommand,
    ];
  }
}
