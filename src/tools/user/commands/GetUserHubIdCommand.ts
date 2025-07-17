import { z } from "zod";

import { getCurrentUserState } from "../../../server.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

export class GetUserHubIdCommand extends ToolCommand<
  Record<string, never>,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Get the current user's hub ID for AI memory storage",
    name: "getUserHubId",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get User Hub ID",
  };

  protected parametersSchema = z.object({});

  constructor(private context: ToolContext) {
    super();
  }

  async execute(): Promise<string> {
    try {
      const { hubId, initializationComplete } = getCurrentUserState();
      
      // Check if initialization is still in progress
      if (!initializationComplete || !hubId || hubId === "initializing") {
        return JSON.stringify({
          error: "Wallet is still initializing. Please wait a moment and try again.",
          success: false,
        });
      }
      
      return JSON.stringify({
        hubId,
        success: true,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to get user hub ID: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
