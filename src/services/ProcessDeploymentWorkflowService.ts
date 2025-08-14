import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  DeploymentReport,
  ErrorRecovery,
  GuidedDeploymentResult,
  GuidedProcessResult,
  ProcessCodeResult,
  ProcessDeploymentWorkflow,
  RefinementResult,
  StepResult,
  ValidationResult,
  WorkflowContext,
  WorkflowError,
  WorkflowResult,
  WorkflowStep,
} from "../types/guided-process.js";
import { RequirementAnalysis } from "../types/lua-workflow.js";
import { GuidedProcessCreationService } from "./GuidedProcessCreationService.js";
import { LuaWorkflowOrchestrationService } from "./LuaWorkflowOrchestrationService.js";
import { ProcessRefinementService } from "./ProcessRefinementService.js";
import { ProcessValidationService } from "./ProcessValidationService.js";

/**
 * Service for orchestrating the complete process deployment workflow.
 *
 * This service coordinates the end-to-end workflow:
 * 1. Requirements analysis
 * 2. Code generation
 * 3. Process creation
 * 4. Code deployment
 * 5. Validation
 * 6. Refinement (if needed)
 * 7. Final verification
 */
export class ProcessDeploymentWorkflowService
  implements ProcessDeploymentWorkflow
{
  private readonly guidedCreationService: GuidedProcessCreationService;
  private readonly refinementService: ProcessRefinementService;
  private readonly validationService: ProcessValidationService;

  constructor(
    guidedCreationService?: GuidedProcessCreationService,
    validationService?: ProcessValidationService,
    refinementService?: ProcessRefinementService,
  ) {
    this.guidedCreationService =
      guidedCreationService ?? new GuidedProcessCreationService();
    this.validationService =
      validationService ?? new ProcessValidationService();
    this.refinementService =
      refinementService ?? new ProcessRefinementService();
  }

  /**
   * Execute complete workflow from user request to deployed process
   */
  async executeFullWorkflow(
    userRequest: string,
    keyPair: JWKInterface,
  ): Promise<GuidedDeploymentResult> {
    const startTime = Date.now();
    const context: WorkflowContext = {
      currentStep: "analyze",
      requirements: {} as any,
      stepHistory: [],
    };

    try {
      // Step 1: Analyze requirements
      let stepResult = await this.executeWorkflowStep("analyze", context, {
        keyPair,
        userRequest,
      });
      if (!stepResult.success) {
        throw new Error(`Analysis failed: ${stepResult.error}`);
      }
      context.requirements = stepResult.data as RequirementAnalysis;
      context.stepHistory.push("analyze");

      // Step 2: Generate code
      context.currentStep = "generate";
      stepResult = await this.executeWorkflowStep("generate", context, {
        keyPair,
        userRequest,
      });
      if (!stepResult.success) {
        throw new Error(`Generation failed: ${stepResult.error}`);
      }
      const processCode = stepResult.data as ProcessCodeResult;
      context.stepHistory.push("generate");

      // Step 3: Deploy process
      context.currentStep = "deploy";
      stepResult = await this.executeWorkflowStep("deploy", context, {
        keyPair,
        processCode,
      });
      if (!stepResult.success) {
        throw new Error(`Deployment failed: ${stepResult.error}`);
      }
      const guidedResult = stepResult.data as GuidedProcessResult;
      context.processId = guidedResult.processId;
      context.stepHistory.push("deploy");

      // Step 4: Validate deployment
      context.currentStep = "validate";
      stepResult = await this.executeWorkflowStep("validate", context, {
        guidedResult,
        keyPair,
      });
      if (!stepResult.success) {
        throw new Error(`Validation failed: ${stepResult.error}`);
      }
      const validationResults = stepResult.data as ValidationResult[];
      context.stepHistory.push("validate");

      // Step 5: Final verification
      context.currentStep = "verify";
      stepResult = await this.executeWorkflowStep("verify", context, {
        guidedResult,
        keyPair,
        validationResults,
      });
      context.stepHistory.push("verify");

      // Generate deployment report
      const workflowResult: WorkflowResult = {
        completedSteps: context.stepHistory,
        deploymentResult: guidedResult.deploymentResult,
        finalResult: guidedResult,
        processId: context.processId,
        success: stepResult.success,
        timestamp: new Date(),
      };

      const deploymentReport =
        await this.generateWorkflowReport(workflowResult);

      return {
        deploymentReport,
        processCode: guidedResult.processCode,
        processId: context.processId || "",
        success: stepResult.success,
        validationResults: guidedResult.validationResults || [],
      };
    } catch (error) {
      // Handle workflow error
      const workflowError: WorkflowError = {
        context,
        error: error instanceof Error ? error.message : "Unknown error",
        step: context.currentStep,
      };

      const recovery = await this.handleWorkflowError(workflowError, context);

      return {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: [],
            documentationCoverage: 0,
            testCoverage: 0,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: context.processId || "",
            status: "failed",
          },
          performance: {
            generationTimeMs: Date.now() - startTime,
            totalWorkflowTimeMs: Date.now() - startTime,
            validationTimeMs: 0,
          },
          summary: `Workflow failed at step ${context.currentStep}: ${workflowError.error}`,
          validation: {
            passedTests: 0,
            testResults: [],
            totalTests: 0,
          },
        },
        processCode: {} as any,
        processId: context.processId || "",
        success: false,
        validationResults: [],
      };
    }
  }

  /**
   * Execute a single workflow step
   */
  async executeWorkflowStep(
    step: WorkflowStep,
    context: WorkflowContext,
    data?: unknown,
  ): Promise<StepResult> {
    try {
      switch (step) {
        case "analyze": {
          const typedData = data as { userRequest: string };
          const requirements =
            await this.guidedCreationService.analyzeRequirements(
              typedData.userRequest,
            );
          return {
            data: requirements,
            nextStep: "generate",
            success: true,
          };
        }

        case "deploy": {
          const typedData = data as { keyPair: JWKInterface };
          const guidedResult =
            await this.guidedCreationService.createGuidedProcess(
              typedData.keyPair,
              context.requirements.userRequest,
            );
          return {
            data: guidedResult,
            nextStep: "validate",
            success: guidedResult.success,
          };
        }

        case "generate": {
          // Create a workflow service instance to query docs
          const workflowService = new LuaWorkflowOrchestrationService();
          const docs = await workflowService.queryRelevantDocs(
            context.requirements,
          );
          const processCode =
            await this.guidedCreationService.generateProcessCode(
              context.requirements,
              docs,
            );
          return {
            data: processCode,
            nextStep: "deploy",
            success: true,
          };
        }

        case "refine": {
          const typedData = data as {
            keyPair: JWKInterface;
            processId: string;
            testResults: ValidationResult[];
          };
          const refinementResult = await this.refinementService.refineProcess(
            typedData.keyPair,
            typedData.processId,
            typedData.testResults,
          );
          return {
            data: refinementResult,
            nextStep: "validate",
            success: refinementResult.success,
          };
        }

        case "validate": {
          const typedData = data as {
            guidedResult: GuidedProcessResult;
            keyPair: JWKInterface;
          };
          const validationResults =
            await this.validationService.validateProcess(
              typedData.keyPair,
              typedData.guidedResult.processId || "",
              typedData.guidedResult.processCode,
            );
          return {
            data: validationResults,
            nextStep: "verify",
            success: validationResults.every((r) => r.passed),
          };
        }

        case "verify": {
          // Final verification step
          const typedData = data as {
            validationResults: ValidationResult[];
          };
          const allPassed = typedData.validationResults.every((r) => r.passed);
          return {
            data: { verified: allPassed },
            success: allPassed,
          };
        }

        default:
          return {
            error: `Unknown workflow step: ${step}`,
            success: false,
          };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  /**
   * Generate comprehensive deployment report
   */
  async generateWorkflowReport(
    results: WorkflowResult,
  ): Promise<DeploymentReport> {
    const totalTests = results.finalResult.validationResults?.length || 0;
    const passedTests =
      results.finalResult.validationResults?.filter((r) => r.passed).length ||
      0;

    const codeQuality = {
      bestPracticesFollowed:
        results.finalResult.processCode?.bestPractices || [],
      documentationCoverage: this.calculateDocumentationCoverage(
        results.finalResult.processCode,
      ),
      testCoverage: totalTests > 0 ? passedTests / totalTests : 0,
    };

    const deployment = {
      deploymentTime: results.timestamp,
      processId: results.processId || "",
      status: results.success ? ("success" as const) : ("failed" as const),
    };

    const validation = {
      passedTests,
      testResults: results.finalResult.validationResults || [],
      totalTests,
    };

    const performance = {
      generationTimeMs: 0, // Would be calculated from timing data
      totalWorkflowTimeMs: 0, // Would be calculated from timing data
      validationTimeMs: 0, // Would be calculated from timing data
    };

    const summary = results.success
      ? `Successfully deployed process ${results.processId} with ${passedTests}/${totalTests} tests passing`
      : `Failed to deploy process: ${results.error || "Unknown error"}`;

    return {
      codeQuality,
      deployment,
      performance,
      summary,
      validation,
    };
  }

  /**
   * Handle workflow errors and determine recovery strategy
   */
  async handleWorkflowError(
    error: WorkflowError,
    context: WorkflowContext,
  ): Promise<ErrorRecovery> {
    // Determine recovery strategy based on error type and step
    switch (error.step) {
      case "analyze":
        // Analysis failures usually indicate bad input - stop workflow
        return { recoveryAction: "stop" };

      case "deploy":
        // Deployment failures might be recoverable with retry
        if (context.stepHistory.filter((s) => s === "deploy").length < 2) {
          return { recoveryAction: "retry", retryStep: "deploy" };
        }
        return { recoveryAction: "stop" };

      case "generate":
        // Generation failures might be recoverable with retry
        if (context.stepHistory.filter((s) => s === "generate").length < 2) {
          return { recoveryAction: "retry", retryStep: "generate" };
        }
        return { recoveryAction: "stop" };

      case "refine":
        // Refinement failures - try one more time
        if (context.stepHistory.filter((s) => s === "refine").length < 2) {
          return { recoveryAction: "retry", retryStep: "refine" };
        }
        return { recoveryAction: "stop" };

      case "validate":
        // Validation failures might trigger refinement
        return { recoveryAction: "retry", retryStep: "refine" };

      case "verify":
        // Verification failures - skip to completion with warnings
        return { recoveryAction: "skip" };

      default:
        return { recoveryAction: "stop" };
    }
  }

  /**
   * Validate and refine process iteratively
   */
  async validateAndRefine(
    keyPair: JWKInterface,
    processId: string,
    testResults: any[],
  ): Promise<RefinementResult> {
    return await this.refinementService.refineProcess(
      keyPair,
      processId,
      testResults,
    );
  }

  /**
   * Calculate documentation coverage score
   */
  private calculateDocumentationCoverage(
    processCode: ProcessCodeResult,
  ): number {
    if (!processCode?.documentationSources) return 0;

    // Simple heuristic: more documentation sources = better coverage
    const sourceCount = processCode.documentationSources.length;
    return Math.min(sourceCount * 0.2, 1.0); // Cap at 1.0
  }
}
