import { z } from "zod";

import { ADPProcessCommunicationService } from "../../../services/ADPProcessCommunicationService.js";
import { ArnsAddressResolver } from "../../arns/utils/ArnsAddressResolver.js";
import {
  AutoSafeToolContext,
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ExecuteActionArgs {
  processId: string;
  processMarkdown?: string;
  processType?: string;
  request: string;
}

export class ExecuteActionCommand extends ToolCommand<
  ExecuteActionArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Send messages to AO processes using natural language via AO Documentation Protocol (ADP). Supports process identification via direct process IDs or ArNS names (e.g., myprocess.ar). DEPLOYMENT WORKFLOW: Step 3 of 3: 1) spawnProcess → 2) evalProcess → 3) executeAction (this tool for testing). This tool automatically discovers ADP-compliant process handlers, understands your natural language requests, and executes them. Only works with processes that implement ADP - no legacy fallback.`,
    name: "executeAction",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Send Messages to ADP Process (Step 3/3 - Testing)",
  };

  protected parametersSchema = z.object({
    processId: CommonSchemas.addressOrArnsName.describe(
      "The AO process ID to communicate with (supports ArNS names like process.ar)",
    ),
    processMarkdown: z
      .string()
      .optional()
      .describe(
        "Deprecated: Not used in ADP-only mode. Process capabilities are auto-discovered.",
      ),
    processType: z
      .string()
      .optional()
      .describe(
        "Deprecated: Not used in ADP-only mode. Process type is auto-detected.",
      ),
    request: z
      .string()
      .describe("Natural language request describing what action to perform"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  /**
   * Clear ADP cache for a specific process or all processes
   */
  static clearADPCache(processId?: string): void {
    ADPProcessCommunicationService.clearCache(processId);
  }

  /**
   * Get ADP cache statistics
   */
  static getADPCacheStats(): { entries: string[]; size: number } {
    return ADPProcessCommunicationService.getCacheStats();
  }

  async execute(args: ExecuteActionArgs): Promise<string> {
    try {
      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Resolve ArNS name to process ID if needed
      let resolvedProcessId = args.processId;
      if (ArnsAddressResolver.isArnsName(args.processId)) {
        const arnsResolution = await ArnsAddressResolver.resolveArnsToAddress(
          args.processId,
        );

        if (!arnsResolution.resolved) {
          return JSON.stringify({
            approach: "ADP",
            error: "ARNS_RESOLUTION_FAILED",
            message: arnsResolution.verificationMessage,
            success: false,
          });
        }

        resolvedProcessId = arnsResolution.value!;
      }

      // ADP-only execution with resolved process ID
      const adpResult = await ADPProcessCommunicationService.executeRequest(
        resolvedProcessId,
        args.request,
        keyPair,
      );

      // Include resolution information in successful response
      if (resolvedProcessId !== args.processId) {
        return JSON.stringify({
          ...adpResult,
          originalProcessId: args.processId,
          resolvedProcessId,
        });
      }

      return JSON.stringify(adpResult);
    } catch (error) {
      return JSON.stringify({
        approach: "ADP",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  }
}
