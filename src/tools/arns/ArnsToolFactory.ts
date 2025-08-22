import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";

/**
 * ArNS Tool Factory
 * Manages registration and initialization of ArNS-related MCP tools
 * Initially empty - commands will be added in subsequent stories
 */
export class ArnsToolFactory extends BaseToolFactory {
  /**
   * Get array of ArNS tool command classes
   * Currently returns empty array - will be populated in future stories
   */
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      // ArNS command classes will be added here in subsequent stories
    ];
  }
}
