import { BaseToolFactory, ToolCommand, ToolContext } from "../core/index.js";
import { CheckPermawebDeployPrerequisitesCommand } from "./commands/CheckPermawebDeployPrerequisitesCommand.js";
import { DeployPermawebDirectoryCommand } from "./commands/DeployPermawebDirectoryCommand.js";
import { ManagePermawebDocsCacheCommand } from "./commands/ManagePermawebDocsCacheCommand.js";
import { QueryPermawebDocsCommand } from "./commands/QueryPermawebDocsCommand.js";
import { UploadFolderToArweaveCommand } from "./commands/UploadFolderToArweaveCommand.js";
import { UploadToArweaveCommand } from "./commands/UploadToArweaveCommand.js";

export class DocumentationToolFactory extends BaseToolFactory {
  protected getToolClasses(): Array<new (context: ToolContext) => ToolCommand> {
    return [
      QueryPermawebDocsCommand,
      ManagePermawebDocsCacheCommand,
      DeployPermawebDirectoryCommand,
      CheckPermawebDeployPrerequisitesCommand,
      UploadToArweaveCommand,
      UploadFolderToArweaveCommand,
    ];
  }
}
