import { z } from "zod";

import { createAODevelopmentPipelineService } from "../../../services/AODevelopmentPipelineService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface RollbackDeploymentArgs {
  preserveData?: boolean;
  processId: string;
  reason: string;
}

export class RollbackDeploymentCommand extends ToolCommand<
  RollbackDeploymentArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Rollback a failed AO process deployment. This tool marks a deployment as failed and performs rollback operations. For AO processes, this typically involves marking the process as failed and optionally preserving any data that was created during the deployment attempt.",
    name: "rollbackDeployment",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Rollback AO Process Deployment",
  };

  protected parametersSchema = z.object({
    preserveData: z
      .boolean()
      .optional()
      .describe(
        "Whether to preserve any data created during deployment (default: false)",
      ),
    processId: z.string().describe("The AO process ID to rollback"),
    reason: z
      .string()
      .describe(
        "Reason for the rollback (e.g., 'Validation failed', 'Performance issues')",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: RollbackDeploymentArgs): Promise<string> {
    try {
      // Create deployment pipeline service for rollback workflow
      const pipelineService = createAODevelopmentPipelineService(
        {} as any, // docsService - not required for rollback-only workflow
        {} as any, // tealCompilerService - not required for rollback
        {} as any, // aoLiteTestService - not required for rollback
        {} as any, // deployService - not required for rollback
        {} as any, // tealWorkflowService - not required for rollback
        undefined, // processService - not required for rollback operations
        undefined, // aiMemoryService - optional for rollback logging
      );

      // Execute rollback
      const rollbackResult = await pipelineService.rollbackDeployment(
        args.processId,
        args.reason,
        args.preserveData,
      );

      return JSON.stringify({
        error: rollbackResult.error,
        message: `Rollback ${rollbackResult.status}: ${rollbackResult.rollbackPerformed ? "completed" : "failed"}`,
        preservedData: rollbackResult.preservedData,
        processId: rollbackResult.processId,
        reason: rollbackResult.reason,
        rollbackPerformed: rollbackResult.rollbackPerformed,
        status: rollbackResult.status,
        success: rollbackResult.status === "success",
        timestamp: rollbackResult.timestamp,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to execute rollback",
        success: false,
      });
    }
  }
}
