import { z } from "zod";

import { createAODevelopmentPipelineService } from "../../../services/AODevelopmentPipelineService.js";
import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface DeployProcessArgs {
  aoliteTestResults?: unknown;
  deploymentConfiguration?: {
    monitoring?: boolean;
    network?: "mainnet" | "testnet";
    qualityGates?: {
      coverageThreshold?: number;
      requireAllTests?: boolean;
      testPassRate?: number;
    };
    rollbackEnabled?: boolean;
    validationSteps?: string[];
  };
  processSource: string;
}

export class DeployProcessCommand extends ToolCommand<
  DeployProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Deploy an AO process using the deployment pipeline with AOLite test validation. This tool coordinates the complete deployment workflow: validates AOLite test results against quality gates, spawns a new AO process, deploys the process source code, validates the deployment, and creates deployment records. Supports rollback capabilities and comprehensive monitoring.",
    name: "deployProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Deploy AO Process via Pipeline",
  };

  protected parametersSchema = z.object({
    aoliteTestResults: z
      .unknown()
      .optional()
      .describe("AOLite test results from previous testing phase"),
    deploymentConfiguration: z
      .object({
        monitoring: z
          .boolean()
          .optional()
          .describe("Enable deployment monitoring (default: true)"),
        network: z
          .enum(["mainnet", "testnet"])
          .optional()
          .describe("Target network for deployment (default: testnet)"),
        qualityGates: z
          .object({
            coverageThreshold: z
              .number()
              .optional()
              .describe(
                "Minimum test coverage percentage required (default: 80)",
              ),
            requireAllTests: z
              .boolean()
              .optional()
              .describe("Require all tests to pass (default: true)"),
            testPassRate: z
              .number()
              .optional()
              .describe(
                "Minimum test pass rate percentage required (default: 100)",
              ),
          })
          .optional()
          .describe("Quality gate requirements for deployment approval"),
        rollbackEnabled: z
          .boolean()
          .optional()
          .describe(
            "Enable automatic rollback on validation failure (default: true)",
          ),
        validationSteps: z
          .array(z.string())
          .optional()
          .describe(
            "Array of validation tests to run post-deployment (default: ['Info', 'Ping'])",
          ),
      })
      .optional()
      .describe("Optional deployment configuration settings"),
    processSource: z
      .string()
      .describe("Lua source code to deploy to the new AO process"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: DeployProcessArgs): Promise<string> {
    try {
      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const keyPair = await safeContext.getKeyPair();

      // Create deployment pipeline service with minimal dependencies
      // Only the services needed for deployment pipeline are provided
      const pipelineService = createAODevelopmentPipelineService(
        {} as any, // docsService - not required for deployment-only workflow
        {} as any, // tealCompilerService - not required for Lua deployment
        {} as any, // aoLiteTestService - test results provided as parameter
        {} as any, // deployService - not required for AO process deployment
        {} as any, // tealWorkflowService - not required for deployment pipeline
        undefined, // processService - optional for deployment validation
        undefined, // aiMemoryService - optional for deployment record creation
      );

      // Execute deployment pipeline
      const deploymentResults = await pipelineService.executeDeploymentPipeline(
        args.aoliteTestResults || {},
        args.processSource,
        keyPair,
        {
          monitoring: args.deploymentConfiguration?.monitoring ?? true,
          network: args.deploymentConfiguration?.network || "testnet",
          qualityGates: {
            coverageThreshold:
              args.deploymentConfiguration?.qualityGates?.coverageThreshold ||
              80,
            requireAllTests:
              args.deploymentConfiguration?.qualityGates?.requireAllTests ??
              true,
            testPassRate:
              args.deploymentConfiguration?.qualityGates?.testPassRate || 100,
          },
          rollbackEnabled:
            args.deploymentConfiguration?.rollbackEnabled ?? true,
          validationSteps: args.deploymentConfiguration?.validationSteps || [
            "Info",
            "Ping",
          ],
        },
      );

      return JSON.stringify({
        deploymentStatus: deploymentResults.deploymentValidation.finalStatus,
        duration: deploymentResults.duration,
        memoryRecordId: deploymentResults.deploymentRecords.memoryStorageId,
        message: `Deployment pipeline completed with status: ${deploymentResults.status}`,
        processId: deploymentResults.processId,
        rollbackPerformed:
          deploymentResults.deploymentValidation.rollbackPerformed,
        success: deploymentResults.status === "completed",
        validationResults:
          deploymentResults.deploymentValidation.validationResults.length,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to execute deployment pipeline",
        success: false,
      });
    }
  }
}
