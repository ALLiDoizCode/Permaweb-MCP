import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { CheckPermawebDeployPrerequisitesCommand } from "./commands/CheckPermawebDeployPrerequisitesCommand.js";
import { DeployPermawebDirectoryCommand } from "./commands/DeployPermawebDirectoryCommand.js";
import { UploadFolderToArweaveCommand } from "./commands/UploadFolderToArweaveCommand.js";
import { UploadToArweaveCommand } from "./commands/UploadToArweaveCommand.js";

export class ArweaveToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      DeployPermawebDirectoryCommand,
      CheckPermawebDeployPrerequisitesCommand,
      UploadToArweaveCommand,
      UploadFolderToArweaveCommand,
    ];
  }
}
