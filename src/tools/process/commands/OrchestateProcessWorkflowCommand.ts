import { z } from "zod";

import { ProcessCreationReportService } from "../../../services/ProcessCreationReportService.js";
import { ToolOrchestrationService } from "../../../services/ToolOrchestrationService.js";
import { WorkflowStateService } from "../../../services/WorkflowStateService.js";
import { WorkflowTemplateService } from "../../../services/WorkflowTemplateService.js";
import {
  WorkflowConfiguration,
  WorkflowMode,
  WorkflowProcessType,
} from "../../../types/workflow-orchestration.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface OrchestateProcessWorkflowArgs {
  enableIterativeMode?: boolean;
  enableTemplateMode?: boolean;
  includeArchitectureAnalysis?: boolean;
  processType?: WorkflowProcessType;
  timeoutMs?: number;
  userRequest: string;
  workflowMode?: WorkflowMode;
}

/**
 * MCP tool command for orchestrating complete AO process development workflows.
 *
 * This command seamlessly orchestrates all available tools to create, test, and deploy
 * functional AO processes from natural language requirements. It provides both guided
 * and autonomous execution modes with comprehensive reporting and state management.
 */
export class OrchestateProcessWorkflowCommand extends ToolCommand<
  OrchestateProcessWorkflowArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Seamlessly orchestrate all available tools (documentation queries, process creation, code evaluation) to create functional, tested, and deployed AO processes from natural language requirements. Supports both guided (step-by-step with user feedback) and autonomous (fully automated) execution modes with comprehensive reporting and state management.",
    name: "orchestrateProcessWorkflow",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Orchestrate Complete AO Process Development Workflow",
  };

  protected parametersSchema = z.object({
    enableIterativeMode: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Enable iterative improvement mode for workflow refinement. Allows for multiple rounds of improvement based on validation results.",
      ),
    enableTemplateMode: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Enable template-based workflow initialization using documented AO patterns. This accelerates development for common process types.",
      ),
    includeArchitectureAnalysis: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Include architectural analysis and recommendations in the workflow. This provides better process design decisions but may increase execution time.",
      ),
    processType: z
      .enum(["token", "chatroom", "bot", "game", "custom"])
      .optional()
      .describe(
        "Optional process type hint to guide template selection and workflow optimization. If not specified, the system will analyze the user request to determine the most appropriate process type.",
      ),
    timeoutMs: z
      .number()
      .min(30000)
      .max(600000)
      .optional()
      .default(300000)
      .describe(
        "Maximum execution time for the complete workflow in milliseconds. Default is 5 minutes (300000ms). Range: 30 seconds to 10 minutes.",
      ),
    userRequest: z
      .string()
      .min(10)
      .describe(
        "Natural language description of the desired AO process functionality. Be specific about what the process should do, its purpose, and any special requirements.",
      ),
    workflowMode: z
      .enum(["guided", "autonomous"])
      .optional()
      .default("guided")
      .describe(
        "Workflow execution mode: 'guided' for step-by-step execution with user feedback opportunities, or 'autonomous' for fully automated execution without user intervention.",
      ),
  });

  private readonly reportService: ProcessCreationReportService;
  private readonly templateService: WorkflowTemplateService;
  private readonly toolOrchestrationService: ToolOrchestrationService;
  private readonly workflowStateService: WorkflowStateService;

  constructor(private context: ToolContext) {
    super();
    this.toolOrchestrationService = new ToolOrchestrationService();
    this.workflowStateService = new WorkflowStateService();
    this.reportService = new ProcessCreationReportService();
    this.templateService = new WorkflowTemplateService();
  }

  async execute(args: OrchestateProcessWorkflowArgs): Promise<string> {
    try {
      // Validate context
      if (!this.context.keyPair) {
        return JSON.stringify({
          error: {
            code: "MISSING_KEYPAIR",
            message: "Wallet key pair is required for process creation",
          },
          message: "Cannot orchestrate workflow without valid key pair",
          success: false,
        });
      }

      if (!this.context.hubId) {
        return JSON.stringify({
          error: {
            code: "MISSING_HUB_ID",
            message: "Hub ID is required for workflow orchestration",
          },
          message: "Cannot orchestrate workflow without valid hub ID",
          success: false,
        });
      }

      // Create workflow configuration
      const configuration: WorkflowConfiguration = {
        enableIterativeMode: args.enableIterativeMode ?? false,
        enableTemplateMode: args.enableTemplateMode ?? true,
        includeArchitectureAnalysis: args.includeArchitectureAnalysis ?? true,
        maxRetries: 3,
        mode: args.workflowMode || "guided",
        processType: args.processType,
        timeoutMs: args.timeoutMs || 300000,
      };

      // Create workflow session for state management
      const session = await this.workflowStateService.createWorkflowSession(
        configuration,
        args.userRequest,
      );

      // Initialize reporting
      const report = await this.reportService.initializeReport(
        `workflow-${Date.now()}`,
        session.sessionId,
        configuration,
        args.userRequest,
      );

      // Execute complete workflow orchestration
      const workflowResult =
        await this.toolOrchestrationService.orchestrateCompleteWorkflow(
          args.userRequest,
          this.context.keyPair,
          this.context.hubId,
          configuration,
        );

      // Update session with workflow results
      if (workflowResult.stages.length > 0) {
        let currentSession = session;
        for (const stage of workflowResult.stages) {
          currentSession =
            await this.workflowStateService.maintainWorkflowContext(
              currentSession,
              stage,
            );

          // Record stage execution in report
          await this.reportService.recordStageExecution(
            report,
            stage.stage,
            stage,
          );
        }
      }

      // Generate comprehensive report
      const comprehensiveReport =
        await this.reportService.generateComprehensiveReport(report);

      // Prepare success response
      if (workflowResult.success) {
        return JSON.stringify({
          data: {
            executionTime: workflowResult.executionTime,
            finalResult: {
              codeGenerated:
                !!workflowResult.finalResult?.codeResult?.generatedCode,
              processCreated:
                !!workflowResult.finalResult?.processResult?.processId,
              requirements: workflowResult.finalResult?.requirements,
              validationScore: (
                workflowResult.finalResult?.validationResult as any
              )?.qualityScore,
            },
            processId: workflowResult.finalResult?.processResult?.processId,
            report: {
              criticalIssues: comprehensiveReport.summary.criticalIssues,
              overallScore: comprehensiveReport.summary.overallScore,
              recommendations: comprehensiveReport.recommendations,
              reportId: comprehensiveReport.report.reportId,
              summary: comprehensiveReport.summary,
            },
            sessionId: workflowResult.sessionId,
            stages: workflowResult.stages.length,
            successfulStages: workflowResult.stages.filter((s) => s.success)
              .length,
            workflow: {
              architectureAnalyzed: configuration.includeArchitectureAnalysis,
              iterativeMode: configuration.enableIterativeMode,
              mode: configuration.mode,
              templatesUsed: configuration.enableTemplateMode,
            },
          },
          message: "Workflow orchestration completed successfully",
          metadata: {
            documentationSources:
              comprehensiveReport.report.resourceUsage.documentationQueries
                .totalDocuments,
            executionMode: configuration.mode,
            performanceMetrics: {
              averageStageTime: (comprehensiveReport.report as any).performance
                ?.averageStageTime,
              bottleneckStage: (comprehensiveReport.report as any).performance
                ?.bottleneckStage,
              executionTime: workflowResult.executionTime,
            },
            timestamp: new Date().toISOString(),
            totalApiCalls:
              comprehensiveReport.report.resourceUsage.totalApiCalls,
            version: "1.0",
          },
          success: true,
        });
      } else {
        // Prepare error response with diagnostic information
        return JSON.stringify({
          diagnostics: {
            completedStages: workflowResult.stages.filter((s) => s.success)
              .length,
            errors: workflowResult.stages
              .filter((s) => !s.success)
              .map((s) => ({
                error: s.error?.message,
                stage: s.stage,
              })),
            executionTime: workflowResult.executionTime,
            lastSuccessfulStage: workflowResult.stages
              .filter((s) => s.success)
              .pop()?.stage,
            recovery: {
              canResume: session.canResume,
              recoverableStages: workflowResult.stages
                .filter((s) => !s.success && this.isRecoverableStage(s.stage))
                .map((s) => s.stage),
              sessionId: session.sessionId,
            },
            report: {
              insights: comprehensiveReport.insights,
              recommendations: comprehensiveReport.recommendations,
              reportId: comprehensiveReport.report.reportId,
              summary: comprehensiveReport.summary,
            },
            sessionId: workflowResult.sessionId,
            totalStages: workflowResult.stages.length,
          },
          error: {
            code: workflowResult.error?.code || "WORKFLOW_EXECUTION_FAILED",
            details: workflowResult.error?.details,
            failedStage: workflowResult.error?.failedStage,
            message: workflowResult.error?.message || "Unknown workflow error",
          },
          message: "Workflow orchestration failed",
          metadata: {
            executionMode: configuration.mode,
            timestamp: new Date().toISOString(),
            version: "1.0",
          },
          success: false,
        });
      }
    } catch (error) {
      // Handle unexpected errors
      return JSON.stringify({
        diagnostics: {
          configuration: {
            mode: args.workflowMode,
            processType: args.processType,
            timeoutMs: args.timeoutMs,
          },
          timestamp: new Date().toISOString(),
          userRequest: args.userRequest,
        },
        error: {
          code: "UNEXPECTED_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        message: "Workflow orchestration encountered an unexpected error",
        metadata: {
          error: true,
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
        recovery: {
          suggestions: [
            "Try simplifying the user request",
            "Check if all required services are available",
            "Verify network connectivity",
            "Consider using guided mode for better error handling",
          ],
        },
        success: false,
      });
    }
  }

  /**
   * Determine if a workflow stage is recoverable
   */
  private isRecoverableStage(stage: string): boolean {
    const recoverableStages = [
      "documentation-query",
      "architecture-analysis",
      "code-evaluation",
      "testing",
      "validation",
    ];
    return recoverableStages.includes(stage);
  }
}
