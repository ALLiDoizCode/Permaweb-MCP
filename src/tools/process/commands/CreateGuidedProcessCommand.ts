import { z } from "zod";

import { GuidedProcessCreationService } from "../../../services/GuidedProcessCreationService.js";
import { ProcessDeploymentWorkflowService } from "../../../services/ProcessDeploymentWorkflowService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface CreateGuidedProcessArgs {
  allowRefinement?: boolean;
  includeTesting?: boolean;
  processType?: "bot" | "chatroom" | "custom" | "game" | "token";
  userRequest: string;
}

export class CreateGuidedProcessCommand extends ToolCommand<
  CreateGuidedProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Create, deploy, and test AO process from natural language requirements with automatic documentation reference and validation. This is the complete guided process creation tool that orchestrates requirements analysis, documentation-informed code generation, process deployment, and comprehensive testing.",
    name: "createGuidedProcess",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Create Guided AO Process with Documentation",
  };

  protected parametersSchema = z.object({
    allowRefinement: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable iterative refinement based on test results"),
    includeTesting: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include automatic validation and testing"),
    processType: z
      .enum(["token", "chatroom", "bot", "game", "custom"])
      .optional()
      .describe("Specific process type hint for template selection"),
    userRequest: z
      .string()
      .min(1, "User request cannot be empty")
      .describe(
        "Natural language description of the desired AO process functionality",
      ),
  });

  private readonly guidedCreationService: GuidedProcessCreationService;
  private readonly workflowService: ProcessDeploymentWorkflowService;

  constructor(private context: ToolContext) {
    super();
    this.guidedCreationService = new GuidedProcessCreationService();
    this.workflowService = new ProcessDeploymentWorkflowService(
      this.guidedCreationService,
    );
  }

  async execute(args: CreateGuidedProcessArgs): Promise<string> {
    try {
      // Execute the complete guided deployment workflow
      const deploymentResult = await this.workflowService.executeFullWorkflow(
        args.userRequest,
        this.context.keyPair,
      );

      if (!deploymentResult.success) {
        return JSON.stringify({
          deploymentReport: deploymentResult.deploymentReport,
          error: "Process creation and deployment failed",
          message: "Failed to create guided AO process",
          processId: deploymentResult.processId,
          success: false,
          validationResults: deploymentResult.validationResults,
        });
      }

      // Format successful response
      const response = {
        deploymentReport: {
          codeQuality: deploymentResult.deploymentReport.codeQuality,
          deployment: deploymentResult.deploymentReport.deployment,
          performance: deploymentResult.deploymentReport.performance,
          summary: deploymentResult.deploymentReport.summary,
          validation: deploymentResult.deploymentReport.validation,
        },
        message: `AO process created and deployed successfully: ${deploymentResult.processId}`,
        processCode: {
          bestPractices: deploymentResult.processCode.bestPractices,
          deploymentInstructions:
            deploymentResult.processCode.deploymentInstructions,
          explanation: deploymentResult.processCode.explanation,
          generatedCode: deploymentResult.processCode.generatedCode,
          templateUsed: deploymentResult.processCode.templateUsed,
          testCases: deploymentResult.processCode.testCases,
        },
        processId: deploymentResult.processId,
        success: true,
        validationResults: deploymentResult.validationResults,
      };

      // Add refinement information if enabled and refinement was performed
      if (
        args.allowRefinement &&
        deploymentResult.deploymentReport.validation.totalTests > 0
      ) {
        const passedTests =
          deploymentResult.deploymentReport.validation.passedTests;
        const totalTests =
          deploymentResult.deploymentReport.validation.totalTests;

        response.message += ` (${passedTests}/${totalTests} tests passing)`;

        if (passedTests < totalTests) {
          response.message +=
            ". Some tests failed - process may benefit from refinement.";
        }
      }

      return JSON.stringify(response, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to create guided AO process",
        success: false,
      });
    }
  }

  /**
   * Enhanced workflow execution with refinement options
   */
  private async executeWithRefinement(
    args: CreateGuidedProcessArgs,
  ): Promise<any> {
    const result = await this.workflowService.executeFullWorkflow(
      args.userRequest,
      this.context.keyPair,
    );

    // If refinement is enabled and there are test failures, attempt refinement
    if (args.allowRefinement && !result.success) {
      const failedTests = result.validationResults.filter((r) => !r.passed);

      if (failedTests.length > 0 && failedTests.length <= 3) {
        // Attempt refinement for manageable number of failures
        try {
          const refinementResult = await this.workflowService.validateAndRefine(
            this.context.keyPair,
            result.processId,
            result.validationResults,
          );

          if (refinementResult.success) {
            // Update result with refined process
            result.processCode = refinementResult.improvedCode;
            result.validationResults = refinementResult.validationResults;
            result.success = refinementResult.success;
          }
        } catch (refinementError) {
          // Continue with original result if refinement fails
          console.warn("Refinement failed:", refinementError);
        }
      }
    }

    return result;
  }

  /**
   * Generate deployment instructions for the user
   */
  private generateUserInstructions(deploymentResult: any): string[] {
    const instructions = [
      `Process successfully deployed with ID: ${deploymentResult.processId}`,
      "Process includes the following capabilities:",
    ];

    // Add template-specific instructions
    const template = deploymentResult.processCode?.templateUsed;
    switch (template) {
      case "bot":
        instructions.push("- Interactive command processing");
        instructions.push("- Use 'Command' action with Command tag");
        instructions.push("- Auto-reply to messages");
        break;
      case "chatroom":
        instructions.push("- Join chatroom with 'Join' action");
        instructions.push("- Send messages with 'Message' action");
        instructions.push("- Real-time member notifications");
        break;
      case "game":
        instructions.push("- Join game with 'Join-Game' action");
        instructions.push("- Make moves with 'Move' action");
        instructions.push("- Multi-player game support");
        break;
      case "token":
        instructions.push("- Token balance queries and transfers");
        instructions.push("- Use 'Balance' action to check balances");
        instructions.push("- Use 'Transfer' action to send tokens");
        break;
      default:
        instructions.push("- Basic message handling with 'Ping' action");
        instructions.push("- Process info available with 'Info' action");
    }

    instructions.push("Process is ready for interaction!");

    return instructions;
  }

  /**
   * Validation summary for the response
   */
  private generateValidationSummary(validationResults: any[]): string {
    const totalTests = validationResults.length;
    const passedTests = validationResults.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    if (totalTests === 0) {
      return "No validation tests were performed.";
    }

    let summary = `Validation: ${passedTests}/${totalTests} tests passed`;

    if (failedTests > 0) {
      summary += ` (${failedTests} failed)`;

      // Add brief failure summary
      const failureTypes = validationResults
        .filter((r) => !r.passed)
        .map((r) => r.testCase)
        .slice(0, 3); // Show first 3 failure types

      summary += `. Failed tests: ${failureTypes.join(", ")}`;
    }

    return summary;
  }
}
