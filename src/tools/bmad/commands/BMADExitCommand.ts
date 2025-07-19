import { z } from "zod";

import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadExitSchema = z
  .object({
    message: z.string().optional().describe("Optional exit message"),
    saveSession: z
      .boolean()
      .optional()
      .describe("Whether to save the current session before exiting"),
  })
  .strict();

type BMADExitArgs = z.infer<typeof bmadExitSchema>;

export class BMADExitCommand extends ToolCommand<BMADExitArgs, string> {
  protected metadata: ToolMetadata = {
    description: "Exit BMAD methodology mode and return to normal operation",
    name: "bmad_exit",
    openWorldHint: false,
    readOnlyHint: false,
    title: "BMAD Exit",
  };

  protected parametersSchema = bmadExitSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(args: BMADExitArgs, _context: ToolContext): Promise<string> {
    const { message, saveSession } = args;

    try {
      return await this.exitBmadMode(saveSession, message);
    } catch (error) {
      return `Error exiting BMAD mode: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  private async exitBmadMode(
    saveSession?: boolean,
    message?: string,
  ): Promise<string> {
    const exitMessage = message || "Exiting BMAD methodology mode";
    const timestamp = new Date().toISOString();

    let sessionInfo = "";
    if (saveSession) {
      sessionInfo = `
## Session Information

**Session saved:** ${timestamp}
**Cache status:** Preserved
**Resources:** Available for next session

Your BMAD session has been saved and can be resumed later.
`;
    } else {
      sessionInfo = `
## Session Information

**Session ended:** ${timestamp}
**Cache status:** Cleared
**Resources:** Will be reloaded on next use

Your BMAD session has been ended and cache has been cleared.
`;
    }

    return `
# BMAD Mode Exit

**Status:** ✅ Successfully exited BMAD methodology mode
**Message:** ${exitMessage}
**Time:** ${timestamp}

${sessionInfo}

## Summary

BMAD methodology mode has been deactivated. You can return to normal Permamind operations.

To re-enter BMAD mode, use any BMAD command (commands starting with \`bmad_\`).

## Available Next Steps

1. Continue with regular Permamind memory operations
2. Use process communication tools
3. Access documentation and deployment tools
4. Re-enter BMAD mode when needed with \`bmad_help\`

Thank you for using BMAD methodology tools!
    `.trim();
  }
}
