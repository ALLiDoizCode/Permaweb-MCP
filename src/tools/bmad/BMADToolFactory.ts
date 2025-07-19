import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import {
  BMADCreateDocCommand,
  BMADDocOutCommand,
  BMADExecuteChecklistCommand,
  BMADExitCommand,
  BMADHelpCommand,
  BMADKnowledgeBaseCommand,
  BMADTaskCommand,
  BMADYoloCommand,
} from "./commands/index.js";

export class BMADToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      BMADHelpCommand,
      BMADKnowledgeBaseCommand,
      BMADTaskCommand,
      BMADCreateDocCommand,
      BMADExecuteChecklistCommand,
      BMADYoloCommand,
      BMADDocOutCommand,
      BMADExitCommand,
    ];
  }
}
