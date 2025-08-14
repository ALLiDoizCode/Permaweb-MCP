import { JWKInterface } from "arweave/node/lib/wallet.js";

import { GuidedProcessResult } from "../types/guided-process.js";
import { LuaCodeResult, RequirementAnalysis } from "../types/lua-workflow.js";
import {
  CompleteWorkflowResult,
  StageExecutionResult,
  ToolChainResult,
  ToolSelection,
  WorkflowConfiguration,
  WorkflowContext,
  WorkflowExecutionReport,
  WorkflowResults,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowValidationResult,
} from "../types/workflow-orchestration.js";
import { ArchitectureDecisionService } from "./ArchitectureDecisionService.js";
import { GuidedProcessCreationService } from "./GuidedProcessCreationService.js";
import { LuaWorkflowOrchestrationService } from "./LuaWorkflowOrchestrationService.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";
import { ProcessArchitectureAnalysisService } from "./ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "./RequirementAnalysisService.js";

/**
 * Main service for seamless tool orchestration and workflow management.
 *
 * This service coordinates all available tools (documentation queries, process creation,
 * code evaluation) to create functional, tested, and deployed AO processes from natural
 * language requirements.
 *
 * The service provides:
 * - Automatic tool selection based on workflow stage analysis
 * - Tool result chaining with input/output transformation
 * - Error handling and recovery mechanisms
 * - Both guided and autonomous execution modes
 */
export class ToolOrchestrationService {
  private readonly architectureDecisionService: ArchitectureDecisionService;
  private readonly guidedProcessService: GuidedProcessCreationService;
  private readonly luaWorkflowService: LuaWorkflowOrchestrationService;
  private readonly permawebDocsService: PermawebDocs;

  constructor(
    luaWorkflowService?: LuaWorkflowOrchestrationService,
    guidedProcessService?: GuidedProcessCreationService,
    architectureDecisionService?: ArchitectureDecisionService,
    permawebDocsService?: PermawebDocs,
  ) {
    this.permawebDocsService = permawebDocsService ?? new PermawebDocs();
    this.luaWorkflowService =
      luaWorkflowService ?? new LuaWorkflowOrchestrationService();
    this.guidedProcessService =
      guidedProcessService ?? new GuidedProcessCreationService();
    this.architectureDecisionService =
      architectureDecisionService ??
      new ArchitectureDecisionService(
        new ProcessArchitectureAnalysisService(
          this.permawebDocsService,
          new RequirementAnalysisService(),
        ),
        new RequirementAnalysisService(),
      );
  }

  /**
   * Execute a specific workflow stage with error handling
   */
  async executeStage(
    stage: WorkflowStage,
    context: WorkflowContext,
    execution: () => Promise<unknown>,
  ): Promise<WorkflowStageResult> {
    const startTime = Date.now();

    try {
      const data = await execution();
      const executionTime = Date.now() - startTime;

      context.stageHistory.push(stage);

      return {
        data,
        executionTime,
        metadata: {
          context: context.sessionId,
          timestamp: new Date(),
        },
        stage,
        success: true,
        toolsUsed: this.getToolsForStage(stage),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        data: null,
        error: {
          code: `${stage.toUpperCase()}_FAILED`,
          details: error,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        executionTime,
        metadata: {
          context: context.sessionId,
          error: true,
          timestamp: new Date(),
        },
        stage,
        success: false,
        toolsUsed: this.getToolsForStage(stage),
      };
    }
  }

  /**
   * Execute tool chain with result chaining and error handling
   */
  async executeToolChain(
    tools: ToolSelection[],
    inputs: Record<string, unknown>,
  ): Promise<ToolChainResult> {
    const startTime = Date.now();
    const results: Record<string, unknown> = {};
    const errors: Array<{ error: string; tool: string }> = [];
    const executionOrder: string[] = [];

    // Sort tools by priority and dependencies
    const sortedTools = this.sortToolsByDependencies(tools);

    for (const tool of sortedTools) {
      try {
        executionOrder.push(tool.toolName);

        // Chain inputs from previous tool results
        const toolInputs = this.chainToolInputs(tool, inputs, results);

        // Execute tool (this would integrate with actual tool implementations)
        const toolResult = await this.executeToolWithChaining(tool, toolInputs);

        results[tool.toolName] = toolResult;
      } catch (error) {
        errors.push({
          error: error instanceof Error ? error.message : "Unknown error",
          tool: tool.toolName,
        });

        // Decide whether to continue or fail the chain
        if (tool.priority === 1) {
          // High priority tool failed, break the chain
          break;
        }
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      errors,
      executionOrder,
      metadata: {
        successfulTools: executionOrder.length - errors.length,
        toolCount: tools.length,
      },
      results,
      success: errors.length === 0,
      totalExecutionTime: executionTime,
    };
  }

  /**
   * Orchestrate complete workflow from user request to deployed process
   */
  async orchestrateCompleteWorkflow(
    userRequest: string,
    keyPair: JWKInterface,
    hubId: string,
    configuration: WorkflowConfiguration,
  ): Promise<CompleteWorkflowResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    const context: WorkflowContext = {
      configuration,
      currentStage: "initialization",
      hubId,
      keyPair,
      metadata: {},
      sessionId,
      stageHistory: [],
      timestamp: new Date(),
      userRequest,
    };

    const stages: WorkflowStageResult[] = [];
    let currentStage: WorkflowStage = "initialization";

    try {
      // Stage 1: Requirement Analysis
      currentStage = "requirement-analysis";
      context.currentStage = currentStage;
      const requirementResult = await this.executeStage(
        currentStage,
        context,
        async () => {
          return await this.luaWorkflowService.analyzeRequirements(userRequest);
        },
      );
      stages.push(requirementResult);

      if (!requirementResult.success || !requirementResult.data) {
        throw new Error(
          `Requirement analysis failed: ${requirementResult.error?.message}`,
        );
      }

      const requirements = requirementResult.data as RequirementAnalysis;

      // Stage 2: Documentation Query
      currentStage = "documentation-query";
      context.currentStage = currentStage;
      const docsResult = await this.executeStage(
        currentStage,
        context,
        async () => {
          return await this.luaWorkflowService.queryRelevantDocs(requirements);
        },
      );
      stages.push(docsResult);

      if (!docsResult.success || !docsResult.data) {
        throw new Error(
          `Documentation query failed: ${docsResult.error?.message}`,
        );
      }

      const documentation = docsResult.data as PermawebDocsResult[];

      // Stage 3: Architecture Analysis (if enabled)
      let architectureResult: undefined | WorkflowStageResult;
      if (configuration.includeArchitectureAnalysis) {
        currentStage = "architecture-analysis";
        context.currentStage = currentStage;
        architectureResult = await this.executeStage(
          currentStage,
          context,
          async () => {
            return await this.architectureDecisionService.generateArchitectureRecommendation(
              requirements,
              documentation,
            );
          },
        );
        stages.push(architectureResult);
      }

      // Stage 4: Code Generation
      currentStage = "code-generation";
      context.currentStage = currentStage;
      const codeResult = await this.executeStage(
        currentStage,
        context,
        async () => {
          return await this.luaWorkflowService.generateLuaCode(
            documentation,
            requirements,
          );
        },
      );
      stages.push(codeResult);

      if (!codeResult.success || !codeResult.data) {
        throw new Error(`Code generation failed: ${codeResult.error?.message}`);
      }

      const luaCode = codeResult.data as LuaCodeResult;

      // Stage 5: Process Creation and Evaluation
      currentStage = "process-creation";
      context.currentStage = currentStage;
      const processResult = await this.executeStage(
        currentStage,
        context,
        async () => {
          return await this.guidedProcessService.createGuidedProcess(
            keyPair,
            userRequest,
          );
        },
      );
      stages.push(processResult);

      if (!processResult.success || !processResult.data) {
        throw new Error(
          `Process creation failed: ${processResult.error?.message}`,
        );
      }

      const guidedResult = processResult.data as GuidedProcessResult;
      context.processId = guidedResult.processId;

      // Stage 6: Validation
      currentStage = "validation";
      context.currentStage = currentStage;
      const validationResult = await this.executeStage(
        currentStage,
        context,
        async () => {
          return await this.validateWorkflowResults({
            context,
            finalOutput: guidedResult,
            report: this.generateExecutionReport(stages, context),
            stages,
          });
        },
      );
      stages.push(validationResult);

      // Generate final result
      const executionTime = Date.now() - startTime;
      const report = this.generateExecutionReport(stages, context);

      return {
        executionTime,
        finalResult: {
          codeResult: luaCode,
          documentation,
          processResult: guidedResult,
          requirements,
          validationResult: validationResult.data as any,
        },
        metadata: {
          mode: configuration.mode,
          successfulStages: stages.filter((s) => s.success).length,
          totalStages: stages.length,
        },
        report,
        sessionId,
        stages,
        success: true,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const report = this.generateExecutionReport(stages, context);

      return {
        error: {
          code: "WORKFLOW_EXECUTION_FAILED",
          details: error,
          failedStage: currentStage,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        executionTime,
        metadata: {
          mode: configuration.mode,
          successfulStages: stages.filter((s) => s.success).length,
          totalStages: stages.length,
        },
        report,
        sessionId,
        stages,
        success: false,
      };
    }
  }

  /**
   * Select tools automatically based on workflow stage analysis
   */
  async selectToolsForStage(
    stage: WorkflowStage,
    context: WorkflowContext,
  ): Promise<ToolSelection[]> {
    const baseTools: Record<WorkflowStage, ToolSelection[]> = {
      "architecture-analysis": [
        {
          dependencies: ["requirement-analysis", "documentation-query"],
          expectedOutput: "ArchitectureAnalysisResult",
          parameters: { includeRecommendations: true },
          priority: 1,
          toolName: "analyzeArchitecture",
          toolType: "analysis",
        },
      ],
      "code-evaluation": [
        {
          dependencies: ["process-creation"],
          expectedOutput: "EvaluationResult",
          parameters: { includeTests: true },
          priority: 1,
          toolName: "evalProcess",
          toolType: "evaluation",
        },
      ],
      "code-generation": [
        {
          dependencies: ["requirement-analysis", "documentation-query"],
          expectedOutput: "LuaCodeResult",
          parameters: { includeExplanation: true },
          priority: 1,
          toolName: "generateLuaCode",
          toolType: "process",
        },
      ],
      completion: [],
      deployment: [
        {
          dependencies: ["testing"],
          expectedOutput: "DeploymentResult",
          parameters: { production: false },
          priority: 1,
          toolName: "deployProcess",
          toolType: "process",
        },
      ],
      "documentation-query": [
        {
          dependencies: ["requirement-analysis"],
          expectedOutput: "PermawebDocsResult[]",
          parameters: { domains: ["arweave", "ao", "ario"] },
          priority: 1,
          toolName: "queryPermawebDocs",
          toolType: "documentation",
        },
      ],
      initialization: [],
      "process-creation": [
        {
          dependencies: ["code-generation"],
          expectedOutput: "ProcessCreationResult",
          parameters: { validateCode: true },
          priority: 1,
          toolName: "createProcess",
          toolType: "process",
        },
      ],
      "requirement-analysis": [
        {
          dependencies: [],
          expectedOutput: "RequirementAnalysis",
          parameters: { userRequest: context.userRequest },
          priority: 1,
          toolName: "analyzeRequirements",
          toolType: "analysis",
        },
      ],
      testing: [
        {
          dependencies: ["code-evaluation"],
          expectedOutput: "TestResult",
          parameters: { comprehensive: true },
          priority: 1,
          toolName: "validateProcess",
          toolType: "evaluation",
        },
      ],
      validation: [
        {
          dependencies: ["deployment"],
          expectedOutput: "ValidationResult",
          parameters: { comprehensive: true },
          priority: 1,
          toolName: "validateWorkflow",
          toolType: "evaluation",
        },
      ],
    };

    return baseTools[stage] || [];
  }

  /**
   * Validate workflow results comprehensively
   */
  async validateWorkflowResults(
    results: WorkflowResults,
  ): Promise<WorkflowValidationResult> {
    const issues: Array<{
      message: string;
      recommendation?: string;
      severity: "error" | "info" | "warning";
      stage?: WorkflowStage;
    }> = [];

    let qualityScore = 1.0;
    let completionScore = 1.0;

    // Check stage completion
    const requiredStages: WorkflowStage[] = [
      "requirement-analysis",
      "documentation-query",
      "code-generation",
      "process-creation",
    ];

    const completedStages = results.stages
      .filter((s) => s.success)
      .map((s) => s.stage);
    const missingStages = requiredStages.filter(
      (s) => !completedStages.includes(s),
    );

    if (missingStages.length > 0) {
      completionScore -= missingStages.length * 0.25;
      issues.push({
        message: `Missing required stages: ${missingStages.join(", ")}`,
        recommendation: "Complete all required workflow stages",
        severity: "error",
      });
    }

    // Check for errors in stages
    const failedStages = results.stages.filter((s) => !s.success);
    if (failedStages.length > 0) {
      qualityScore -= failedStages.length * 0.2;
      for (const stage of failedStages) {
        issues.push({
          message: `Stage ${stage.stage} failed: ${stage.error?.message || "Unknown error"}`,
          recommendation: `Retry ${stage.stage} stage with corrected inputs`,
          severity: "error",
          stage: stage.stage,
        });
      }
    }

    // Performance checks
    const avgStageTime =
      results.stages.reduce((sum, s) => sum + s.executionTime, 0) /
      results.stages.length;
    if (avgStageTime > 30000) {
      // 30 seconds average
      issues.push({
        message: `Average stage execution time is high: ${avgStageTime}ms`,
        recommendation: "Consider optimizing workflow performance",
        severity: "warning",
      });
    }

    const canProceed = completionScore > 0.5 && qualityScore > 0.3;
    const isValid = issues.filter((i) => i.severity === "error").length === 0;

    return {
      canProceed,
      completionScore,
      issues,
      isValid,
      nextActions: isValid
        ? ["Workflow completed successfully"]
        : ["Address validation issues", "Retry failed stages"],
      qualityScore,
    };
  }

  /**
   * Chain tool inputs from previous results
   */
  private chainToolInputs(
    tool: ToolSelection,
    initialInputs: Record<string, unknown>,
    previousResults: Record<string, unknown>,
  ): Record<string, unknown> {
    const chainedInputs = { ...initialInputs, ...tool.parameters };

    // Add results from dependency tools
    for (const dependency of tool.dependencies) {
      if (previousResults[dependency]) {
        chainedInputs[dependency] = previousResults[dependency];
      }
    }

    return chainedInputs;
  }

  /**
   * Execute tool with chaining support
   */
  private async executeToolWithChaining(
    tool: ToolSelection,
    inputs: Record<string, unknown>,
  ): Promise<unknown> {
    // This would integrate with actual tool implementations
    // For now, return a mock result based on tool type
    switch (tool.toolType) {
      case "analysis":
        return { analysis: {}, confidence: 0.8, recommendations: [] };
      case "documentation":
        return { confidence: 0.9, docs: [], sources: [] };
      case "evaluation":
        return { issues: [], recommendations: [], score: 0.9 };
      case "process":
        return { processId: "mock-process", success: true };
      default:
        return { success: true };
    }
  }

  /**
   * Generate comprehensive execution report
   */
  private generateExecutionReport(
    stages: WorkflowStageResult[],
    context: WorkflowContext,
  ): WorkflowExecutionReport {
    const totalExecutionTime = stages.reduce(
      (sum, s) => sum + s.executionTime,
      0,
    );
    const averageStageTime = totalExecutionTime / (stages.length || 1);

    const stageExecutions = stages.map((stage) => ({
      dataSize: JSON.stringify(stage.data || {}).length,
      endTime: new Date(),
      errors: stage.error ? [stage.error.message] : [],
      stage: stage.stage,
      startTime: new Date(Date.now() - stage.executionTime),
      success: stage.success,
      toolsUsed: stage.toolsUsed,
    }));

    const resourceUsage = {
      codeEvaluations: stages.filter((s) => s.stage === "code-evaluation")
        .length,
      documentationQueries: stages.filter(
        (s) => s.stage === "documentation-query",
      ).length,
      processesCreated: stages.filter((s) => s.stage === "process-creation")
        .length,
      totalApiCalls: stages.reduce((sum, s) => sum + s.toolsUsed.length, 0),
    };

    const bottleneckStage = stages.reduce((slowest, current) =>
      current.executionTime > slowest.executionTime ? current : slowest,
    ).stage;

    const successfulStages = stages.filter((s) => s.success).length;
    const validationScore = successfulStages / (stages.length || 1);

    return {
      auditTrail: stages.map((stage, index) => ({
        action: stage.success ? "completed" : "failed",
        details: {
          executionTime: stage.executionTime,
          success: stage.success,
          toolsUsed: stage.toolsUsed,
        },
        stage: stage.stage,
        timestamp: new Date(Date.now() - totalExecutionTime + index * 1000),
      })),
      configuration: context.configuration,
      performance: {
        averageStageTime,
        bottleneckStage,
        totalExecutionTime,
      },
      qualityMetrics: {
        codeQuality: undefined, // Would be calculated based on code analysis
        documentationCoverage: undefined, // Would be calculated based on doc analysis
        testCoverage: undefined, // Would be calculated based on actual test results
        validationScore,
      },
      resourceUsage,
      sessionId: context.sessionId,
      stageExecutions,
      userRequest: context.userRequest,
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method to get tools used for a stage
   */
  private getToolsForStage(stage: WorkflowStage): string[] {
    const toolMap: Record<WorkflowStage, string[]> = {
      "architecture-analysis": ["ArchitectureDecisionService"],
      "code-evaluation": ["EvalProcessService"],
      "code-generation": ["LuaWorkflowOrchestrationService"],
      completion: [],
      deployment: ["DeploymentService"],
      "documentation-query": ["PermawebDocsService"],
      initialization: [],
      "process-creation": ["GuidedProcessCreationService"],
      "requirement-analysis": ["LuaWorkflowOrchestrationService"],
      testing: ["ValidationService"],
      validation: ["WorkflowValidationService"],
    };

    return toolMap[stage] || [];
  }

  /**
   * Sort tools by dependencies and priority
   */
  private sortToolsByDependencies(tools: ToolSelection[]): ToolSelection[] {
    const sorted: ToolSelection[] = [];
    const remaining = [...tools];

    while (remaining.length > 0) {
      const nextTool = remaining.find((tool) =>
        tool.dependencies.every((dep) =>
          sorted.some((s) => s.toolName === dep),
        ),
      );

      if (!nextTool) {
        // If no tool can be added due to dependencies, add highest priority
        remaining.sort((a, b) => b.priority - a.priority);
        sorted.push(remaining.shift()!);
      } else {
        sorted.push(nextTool);
        remaining.splice(remaining.indexOf(nextTool), 1);
      }
    }

    return sorted;
  }
}
