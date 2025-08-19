import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { GetMediaFileCommand } from "./commands/GetMediaFileCommand.js";
import { ListMediaFilesCommand } from "./commands/ListMediaFilesCommand.js";
import { UploadMediaCommand } from "./commands/UploadMediaCommand.js";

export class MediaToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [UploadMediaCommand, ListMediaFilesCommand, GetMediaFileCommand];
  }
}
