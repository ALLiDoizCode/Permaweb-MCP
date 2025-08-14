import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  FeedbackAnalysis,
  ProcessCodeResult,
  RefinementResult,
  ValidationResult,
} from "../types/guided-process.js";
import { RequirementAnalysis } from "../types/lua-workflow.js";
import { GuidedProcessCreationService } from "./GuidedProcessCreationService.js";
import { LuaWorkflowOrchestrationService } from "./LuaWorkflowOrchestrationService.js";
import { ProcessValidationService } from "./ProcessValidationService.js";

/**
 * Service for iterative process refinement based on test results and feedback.
 *
 * This service analyzes test failures, queries additional documentation,
 * regenerates improved code, and re-tests the process until it meets
 * quality standards.
 */
export class ProcessRefinementService {
  private readonly guidedCreationService: GuidedProcessCreationService;
  private readonly luaWorkflowService: LuaWorkflowOrchestrationService;
  private readonly validationService: ProcessValidationService;

  constructor(
    guidedCreationService?: GuidedProcessCreationService,
    validationService?: ProcessValidationService,
    luaWorkflowService?: LuaWorkflowOrchestrationService,
  ) {
    this.guidedCreationService =
      guidedCreationService ?? new GuidedProcessCreationService();
    this.validationService =
      validationService ?? new ProcessValidationService();
    this.luaWorkflowService =
      luaWorkflowService ?? new LuaWorkflowOrchestrationService();
  }

  /**
   * Get refinement priority based on failure severity
   */
  getRefinementPriority(
    validationResults: ValidationResult[],
  ): "high" | "low" | "medium" {
    const criticalFailures = validationResults.filter(
      (result) =>
        !result.passed &&
        (result.testCase.includes("basic_responsiveness") ||
          result.testCase.includes("state_initialization")),
    );

    if (criticalFailures.length > 0) return "high";

    const handlerFailures = validationResults.filter(
      (result) => !result.passed && result.testCase.includes("handler"),
    );

    if (handlerFailures.length > 0) return "medium";

    return "low";
  }

  /**
   * Check if refinement is needed based on validation results
   */
  isRefinementNeeded(validationResults: ValidationResult[]): boolean {
    const failedTests = validationResults.filter((result) => !result.passed);
    return failedTests.length > 0;
  }

  /**
   * Refine process based on test results and feedback
   */
  async refineProcess(
    keyPair: JWKInterface,
    processId: string,
    testResults: ValidationResult[],
    originalRequirements?: RequirementAnalysis,
  ): Promise<RefinementResult> {
    try {
      // Step 1: Analyze feedback from test results
      const feedbackAnalysis = await this.analyzeFeedback(testResults);

      // Step 2: Query additional documentation if needed
      const additionalDocs = await this.queryAdditionalDocumentation(
        feedbackAnalysis,
        originalRequirements,
      );

      // Step 3: Generate improved code
      const improvedCode = await this.generateImprovedCode(
        feedbackAnalysis,
        additionalDocs,
        originalRequirements,
      );

      // Step 4: Re-deploy and validate
      const redeploymentResult = await this.redeployAndValidate(
        keyPair,
        processId,
        improvedCode,
      );

      return {
        improvedCode,
        refinementActions: this.generateRefinementActions(feedbackAnalysis),
        success: redeploymentResult.success,
        validationResults: redeploymentResult.validationResults,
      };
    } catch (error) {
      return {
        improvedCode: {} as ProcessCodeResult,
        refinementActions: ["Refinement failed due to error"],
        success: false,
        validationResults: [
          {
            error: error instanceof Error ? error.message : "Unknown error",
            passed: false,
            testCase: "refinement_error",
          },
        ],
      };
    }
  }

  /**
   * Analyze test failure patterns and identify improvement areas
   */
  private async analyzeFeedback(
    testResults: ValidationResult[],
  ): Promise<FeedbackAnalysis> {
    const failedTests = testResults.filter((result) => !result.passed);
    const identifiedIssues: string[] = [];
    const refinementSuggestions: string[] = [];
    const testFailurePatterns: string[] = [];
    const additionalDocsNeeded: string[] = [];

    for (const failedTest of failedTests) {
      const testCase = failedTest.testCase;
      const error = failedTest.error;

      // Analyze test case patterns
      if (testCase.includes("handler_registration")) {
        testFailurePatterns.push("handler-registration-failure");
        identifiedIssues.push("Handler registration failed");
        refinementSuggestions.push("Fix handler registration syntax");
        additionalDocsNeeded.push("handler registration patterns");
      }

      if (testCase.includes("handler_match")) {
        testFailurePatterns.push("handler-match-criteria-error");
        identifiedIssues.push("Handler match criteria syntax error");
        refinementSuggestions.push("Fix match function syntax");
        additionalDocsNeeded.push("message matching patterns");
      }

      if (testCase.includes("basic_responsiveness")) {
        testFailurePatterns.push("process-unresponsive");
        identifiedIssues.push("Process is not responding to basic commands");
        refinementSuggestions.push("Check process initialization");
        additionalDocsNeeded.push("process initialization");
      }

      if (testCase.includes("state_initialization")) {
        testFailurePatterns.push("state-initialization-failure");
        identifiedIssues.push("Process state not properly initialized");
        refinementSuggestions.push("Fix state initialization code");
        additionalDocsNeeded.push("state management");
      }

      if (testCase.includes("custom_test")) {
        testFailurePatterns.push("custom-logic-failure");
        identifiedIssues.push("Custom test logic failed");
        refinementSuggestions.push("Review and fix custom test implementation");

        // Try to infer documentation needs from error messages
        if (error && error.includes("balance")) {
          additionalDocsNeeded.push("token balance management");
        }
        if (error && error.includes("transfer")) {
          additionalDocsNeeded.push("token transfer operations");
        }
        if (error && error.includes("message")) {
          additionalDocsNeeded.push("message handling patterns");
        }
      }

      // Analyze specific error patterns
      if (error) {
        if (error.includes("syntax error")) {
          testFailurePatterns.push("syntax-error");
          refinementSuggestions.push("Fix Lua syntax errors");
        }
        if (error.includes("attempt to index")) {
          testFailurePatterns.push("indexing-error");
          refinementSuggestions.push("Fix variable access patterns");
        }
        if (error.includes("attempt to call")) {
          testFailurePatterns.push("function-call-error");
          refinementSuggestions.push("Fix function call patterns");
        }
      }
    }

    return {
      additionalDocsNeeded: [...new Set(additionalDocsNeeded)],
      identifiedIssues: [...new Set(identifiedIssues)],
      refinementSuggestions: [...new Set(refinementSuggestions)],
      testFailurePatterns: [...new Set(testFailurePatterns)],
    };
  }

  /**
   * Generate improved code based on feedback analysis
   */
  private async generateImprovedCode(
    analysis: FeedbackAnalysis,
    additionalDocs: any[],
    originalRequirements?: RequirementAnalysis,
  ): Promise<ProcessCodeResult> {
    if (!originalRequirements) {
      throw new Error("Original requirements needed for code regeneration");
    }

    // Create enhanced requirements with refinement context
    const enhancedRequest = `${originalRequirements.userRequest}

REFINEMENT CONTEXT:
- Issues identified: ${analysis.identifiedIssues.join(", ")}
- Suggested improvements: ${analysis.refinementSuggestions.join(", ")}
- Test failure patterns: ${analysis.testFailurePatterns.join(", ")}

Please generate improved code that addresses these specific issues.`;

    // Update requirements with refinement context
    const enhancedRequirements: RequirementAnalysis = {
      ...originalRequirements,
      userRequest: enhancedRequest,
    };

    // Use additional docs combined with original docs for better generation
    return await this.guidedCreationService.generateProcessCode(
      enhancedRequirements,
      additionalDocs,
    );
  }

  /**
   * Generate list of refinement actions taken
   */
  private generateRefinementActions(analysis: FeedbackAnalysis): string[] {
    const actions = ["Analyzed test failure patterns"];

    if (analysis.additionalDocsNeeded.length > 0) {
      actions.push(
        `Queried additional documentation: ${analysis.additionalDocsNeeded.join(", ")}`,
      );
    }

    if (analysis.refinementSuggestions.length > 0) {
      actions.push("Applied refinement suggestions:");
      actions.push(...analysis.refinementSuggestions.map((s) => `  - ${s}`));
    }

    actions.push("Regenerated code with improvements");
    actions.push("Re-deployed and validated improved code");

    return actions;
  }

  /**
   * Query additional documentation based on failure analysis
   */
  private async queryAdditionalDocumentation(
    analysis: FeedbackAnalysis,
    originalRequirements?: RequirementAnalysis,
  ) {
    if (analysis.additionalDocsNeeded.length === 0) {
      return [];
    }

    try {
      // Build query based on identified documentation needs
      const query = analysis.additionalDocsNeeded.join(" ");
      const domains = originalRequirements?.suggestedDomains;

      // Use the public queryRelevantDocs method instead
      const mockAnalysis = {
        complexity: "moderate" as const,
        detectedPatterns: [] as any[],
        extractedKeywords: query.split(" "),
        processType: "stateless" as const,
        suggestedDomains: domains || [],
        userRequest: query,
      };

      return await this.luaWorkflowService.queryRelevantDocs(mockAnalysis);
    } catch (error) {
      console.warn("Additional documentation query failed:", error);
      return [];
    }
  }

  /**
   * Re-deploy improved code and validate
   */
  private async redeployAndValidate(
    keyPair: JWKInterface,
    processId: string,
    improvedCode: ProcessCodeResult,
  ) {
    try {
      // Deploy improved code
      const deploymentResult =
        await this.guidedCreationService.deployCodeInternal(
          keyPair,
          processId,
          improvedCode,
        );

      if (!deploymentResult.success) {
        return {
          success: false,
          validationResults: [
            {
              error: `Deployment failed: ${deploymentResult.error}`,
              passed: false,
              testCase: "redeployment_failure",
            },
          ],
        };
      }

      // Validate improved deployment
      const validationResults = await this.validationService.validateProcess(
        keyPair,
        processId,
        improvedCode,
      );

      return {
        success: validationResults.every((r) => r.passed),
        validationResults,
      };
    } catch (error) {
      return {
        success: false,
        validationResults: [
          {
            error: error instanceof Error ? error.message : "Unknown error",
            passed: false,
            testCase: "redeployment_error",
          },
        ],
      };
    }
  }
}
