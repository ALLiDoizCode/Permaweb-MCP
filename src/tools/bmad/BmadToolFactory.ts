import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { ExecuteBmadWorkflowCommand } from "./commands/ExecuteBmadWorkflowCommand.js";
import { ExecuteTaskCommand } from "./commands/ExecuteTaskCommand.js";
import { InvokeAgentCommand } from "./commands/InvokeAgentCommand.js";

/**
 * Factory for creating BMad methodology tools that provide comprehensive
 * development workflow automation capabilities in the Permamind MCP server.
 *
 * The BmadToolFactory integrates three complementary tools that enable
 * complete BMad workflow execution:
 *
 * **BMad Workflow Management:**
 * - `ExecuteBmadWorkflowCommand` - Execute complete BMad workflows (permaweb-fullstack, greenfield-fullstack, brownfield-fullstack)
 * - `InvokeAgentCommand` - Invoke specific BMad agents with file I/O and minimal context handoffs
 * - `ExecuteTaskCommand` - Execute specific BMad tasks with input/output file management
 *
 * **Integration Capabilities:**
 * - File-based document generation for context efficiency
 * - Compatible with existing Permamind process and memory tools
 * - Support for natural language workflow requirements
 * - Minimal context window usage through file references
 *
 * **Workflow Examples:**
 * ```typescript
 * // Complete BMad workflow lifecycle:
 * // 1. Execute Workflow → 2. Invoke Agents → 3. Execute Tasks
 *
 * // 1. Execute a complete BMad workflow
 * await executeBmadWorkflowTool.execute({
 *   workflowName: "permaweb-fullstack",
 *   projectPath: "/path/to/project",
 *   userRequest: "Create a new Permaweb dApp with token functionality"
 * });
 *
 * // 2. Invoke specific agents for targeted tasks
 * await invokeAgentTool.execute({
 *   agentName: "architect",
 *   task: "Design the system architecture",
 *   outputPath: "/path/to/architecture.md"
 * });
 *
 * // 3. Execute specific tasks
 * await executeTaskTool.execute({
 *   taskName: "create-component",
 *   inputFiles: ["/path/to/spec.md"],
 *   outputFiles: ["/path/to/component.ts"],
 *   configuration: { mode: "autonomous" }
 * });
 * ```
 *
 * **File-Based Optimization:**
 * BMad tools prioritize file-based I/O to minimize context window usage,
 * generating documents in project directories rather than returning
 * content in tool responses.
 *
 * @example
 * ```typescript
 * // Factory registration in server
 * const bmadFactory = new BmadToolFactory({
 *   categoryName: "BMad",
 *   categoryDescription: "BMad methodology tools for development workflow automation",
 *   context: toolContext
 * });
 *
 * bmadFactory.registerTools(toolRegistry);
 * ```
 *
 * @see {@link ExecuteBmadWorkflowCommand} For complete workflow execution
 * @see {@link InvokeAgentCommand} For specific agent invocation
 * @see {@link ExecuteTaskCommand} For targeted task execution
 *
 * @since 1.0.0
 * @author Permamind Development Team
 */
export class BmadToolFactory extends BaseToolFactory {
  /**
   * Returns the array of tool command classes that this factory creates.
   *
   * The tools are returned in logical workflow order:
   * 1. ExecuteBmadWorkflowCommand - Complete workflow execution
   * 2. InvokeAgentCommand - Agent-specific task execution
   * 3. ExecuteTaskCommand - Individual task execution
   *
   * Each tool is instantiated with the factory's ToolContext, ensuring
   * consistent access to user credentials and configuration.
   *
   * @returns Array of tool command constructors for BMad workflow management
   * @protected
   * @override
   */
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [ExecuteBmadWorkflowCommand, InvokeAgentCommand, ExecuteTaskCommand];
  }
}
