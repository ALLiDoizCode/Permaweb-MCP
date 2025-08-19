import { z } from "zod";

import { createAODevelopmentPipelineService } from "../../../services/AODevelopmentPipelineService.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface ValidateDeploymentArgs {
  processId: string;
  timeout?: number;
  validationTests: string[];
}

export class ValidateDeploymentCommand extends ToolCommand<
  ValidateDeploymentArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Validate a deployed AO process by running a series of test messages and verifying responses. This tool sends validation messages to the deployed process and checks that it responds correctly, ensuring the deployment was successful and the process is functioning as expected.",
    name: "validateDeployment",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Validate AO Process Deployment",
  };

  protected parametersSchema = z.object({
    processId: z.string().describe("The AO process ID to validate"),
    timeout: z
      .number()
      .optional()
      .describe(
        "Timeout in milliseconds for each validation test (default: 30000)",
      ),
    validationTests: z
      .array(z.string())
      .describe(
        "Array of action names to test (e.g., ['Info', 'Ping', 'Balance'])",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: ValidateDeploymentArgs): Promise<string> {
    try {
      // Auto-initialize keypair if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Create deployment pipeline service for validation workflow
      const pipelineService = createAODevelopmentPipelineService(
        {} as any, // docsService - not required for validation-only workflow
        {} as any, // tealCompilerService - not required for validation
        {} as any, // aoLiteTestService - not required for validation
        {} as any, // deployService - not required for validation
        {} as any, // tealWorkflowService - not required for validation
        undefined, // processService - optional for advanced validation scenarios
        undefined, // aiMemoryService - not required for validation
      );

      // Execute validation
      const validationResult = await pipelineService.validateDeployment(
        args.processId,
        args.validationTests,
        keyPair,
        args.timeout,
      );

      const passedTests = validationResult.validationResults.filter(
        (r) => r.status === "passed",
      ).length;
      const failedTests = validationResult.validationResults.filter(
        (r) => r.status === "failed",
      ).length;

      return JSON.stringify({
        duration: validationResult.duration,
        failedTests,
        message: `Deployment validation completed: ${validationResult.overallStatus}`,
        overallStatus: validationResult.overallStatus,
        passedTests,
        processId: validationResult.processId,
        success: validationResult.overallStatus === "passed",
        totalTests: validationResult.validationResults.length,
        validationResults: validationResult.validationResults,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to validate deployment",
        success: false,
      });
    }
  }
}
