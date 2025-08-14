import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { OrchestateProcessWorkflowCommand } from "../../../../src/tools/process/commands/OrchestateProcessWorkflowCommand.js";

// Mock services
vi.mock("../../../../src/services/ToolOrchestrationService.js", () => ({
  ToolOrchestrationService: vi.fn().mockImplementation(() => ({
    orchestrateCompleteWorkflow: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/WorkflowStateService.js", () => ({
  WorkflowStateService: vi.fn().mockImplementation(() => ({
    createWorkflowSession: vi.fn(),
    maintainWorkflowContext: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/ProcessCreationReportService.js", () => ({
  ProcessCreationReportService: vi.fn().mockImplementation(() => ({
    generateComprehensiveReport: vi.fn(),
    initializeReport: vi.fn(),
    recordStageExecution: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/WorkflowTemplateService.js", () => ({
  WorkflowTemplateService: vi.fn().mockImplementation(() => ({})),
}));

describe("OrchestateProcessWorkflowCommand", () => {
  let command: OrchestateProcessWorkflowCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = { e: "AQAB", kty: "RSA", n: "test" } as JWKInterface;
    mockContext = {
      hubId: "test-hub-id",
      keyPair: mockKeyPair,
    };

    command = new OrchestateProcessWorkflowCommand(mockContext);
  });

  describe("parameter validation", () => {
    it("should validate required userRequest parameter", async () => {
      const args = {
        // Missing userRequest
      };

      const result = await command.execute(args as any);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      // The Zod validation should handle this
    });

    it("should validate userRequest minimum length", async () => {
      const args = {
        userRequest: "short", // Less than 10 characters
      };

      const result = await command.execute(args as any);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      // The Zod validation should handle this
    });

    it("should validate timeout range", async () => {
      const args = {
        timeoutMs: 20000, // Below minimum of 30000
        userRequest: "Create a token process",
      };

      const result = await command.execute(args as any);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      // The Zod validation should handle this
    });
  });

  describe("context validation", () => {
    it("should return error when keyPair is missing", async () => {
      const commandWithoutKeyPair = new OrchestateProcessWorkflowCommand({
        hubId: "test-hub-id",
        keyPair: null as any,
      });

      const args = {
        userRequest: "Create a token process",
      };

      const result = await commandWithoutKeyPair.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.code).toBe("MISSING_KEYPAIR");
      expect(parsedResult.error.message).toBe(
        "Wallet key pair is required for process creation",
      );
    });

    it("should return error when hubId is missing", async () => {
      const commandWithoutHubId = new OrchestateProcessWorkflowCommand({
        hubId: null as any,
        keyPair: mockKeyPair,
      });

      const args = {
        userRequest: "Create a token process",
      };

      const result = await commandWithoutHubId.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.code).toBe("MISSING_HUB_ID");
      expect(parsedResult.error.message).toBe(
        "Hub ID is required for workflow orchestration",
      );
    });
  });

  describe("successful workflow execution", () => {
    beforeEach(() => {
      // Mock successful workflow orchestration
      const mockOrchestrationService = {
        orchestrateCompleteWorkflow: vi.fn().mockResolvedValue({
          executionTime: 120000,
          finalResult: {
            codeResult: { generatedCode: "-- Lua code" },
            processResult: { processId: "test-process-id" },
            requirements: { processType: "token" },
            validationResult: { qualityScore: 0.9 },
          },
          sessionId: "test-session-id",
          stages: [
            {
              data: { requirements: "test" },
              executionTime: 1000,
              metadata: { timestamp: new Date() },
              stage: "requirement-analysis",
              success: true,
              toolsUsed: ["RequirementAnalysisService"],
            },
            {
              data: { processId: "test-process-id" },
              executionTime: 2000,
              metadata: { timestamp: new Date() },
              stage: "process-creation",
              success: true,
              toolsUsed: ["GuidedProcessCreationService"],
            },
          ],
          success: true,
        }),
      };

      const mockStateService = {
        createWorkflowSession: vi.fn().mockResolvedValue({
          canResume: true,
          isActive: true,
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
        maintainWorkflowContext: vi.fn().mockResolvedValue({
          canResume: true,
          isActive: true,
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
      };

      const mockReportService = {
        generateComprehensiveReport: vi.fn().mockResolvedValue({
          insights: [],
          recommendations: [],
          report: {
            performance: {
              averageStageTime: 1500,
              bottleneckStage: "process-creation",
            },
            reportId: "test-report-id",
            resourceUsage: {
              documentationQueries: { totalDocuments: 5 },
              totalApiCalls: 10,
            },
          },
          summary: {
            criticalIssues: [],
            overallScore: 0.9,
          },
        }),
        initializeReport: vi.fn().mockResolvedValue({
          reportId: "test-report-id",
        }),
        recordStageExecution: vi.fn().mockResolvedValue({}),
      };

      (command as any).toolOrchestrationService = mockOrchestrationService;
      (command as any).workflowStateService = mockStateService;
      (command as any).reportService = mockReportService;
    });

    it("should execute workflow successfully with default parameters", async () => {
      const args = {
        userRequest: "Create a token process with 1000 initial supply",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe(
        "Workflow orchestration completed successfully",
      );
      expect(parsedResult.data.processId).toBe("test-process-id");
      expect(parsedResult.data.sessionId).toBe("test-session-id");
      expect(parsedResult.data.stages).toBe(2);
      expect(parsedResult.data.successfulStages).toBe(2);
      expect(parsedResult.data.workflow.mode).toBe("guided"); // Default mode
      expect(parsedResult.data.workflow.templatesUsed).toBe(true); // Default enableTemplateMode
      expect(parsedResult.data.workflow.architectureAnalyzed).toBe(true); // Default includeArchitectureAnalysis
    });

    it("should execute workflow with custom parameters", async () => {
      const args = {
        enableIterativeMode: true,
        enableTemplateMode: false,
        includeArchitectureAnalysis: false,
        processType: "token" as const,
        timeoutMs: 180000,
        userRequest: "Create a token process",
        workflowMode: "autonomous" as const,
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data.workflow.mode).toBe("autonomous");
      expect(parsedResult.data.workflow.templatesUsed).toBe(false);
      expect(parsedResult.data.workflow.architectureAnalyzed).toBe(false);
      expect(parsedResult.data.workflow.iterativeMode).toBe(true);
    });

    it("should return comprehensive workflow results", async () => {
      const args = {
        userRequest: "Create a comprehensive token process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toHaveProperty("finalResult");
      expect(parsedResult.data.finalResult).toHaveProperty(
        "codeGenerated",
        true,
      );
      expect(parsedResult.data.finalResult).toHaveProperty(
        "processCreated",
        true,
      );
      expect(parsedResult.data.finalResult).toHaveProperty("requirements");
      expect(parsedResult.data.finalResult).toHaveProperty(
        "validationScore",
        0.9,
      );
      expect(parsedResult.data).toHaveProperty("report");
      expect(parsedResult.data.report).toHaveProperty("overallScore", 0.9);
      expect(parsedResult.data.report).toHaveProperty("reportId");
      expect(parsedResult.metadata).toHaveProperty("performanceMetrics");
      expect(parsedResult.metadata).toHaveProperty("documentationSources", 5);
      expect(parsedResult.metadata).toHaveProperty("totalApiCalls", 10);
    });

    it("should track workflow execution properly", async () => {
      const args = {
        userRequest: "Create a token process",
      };

      await command.execute(args);

      // Verify that all services were called correctly
      expect(
        (command as any).workflowStateService.createWorkflowSession,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          enableTemplateMode: true,
          includeArchitectureAnalysis: true,
          mode: "guided",
        }),
        "Create a token process",
      );

      expect(
        (command as any).toolOrchestrationService.orchestrateCompleteWorkflow,
      ).toHaveBeenCalledWith(
        "Create a token process",
        mockKeyPair,
        "test-hub-id",
        expect.objectContaining({
          mode: "guided",
        }),
      );

      expect(
        (command as any).reportService.recordStageExecution,
      ).toHaveBeenCalledTimes(2);
      expect(
        (command as any).reportService.generateComprehensiveReport,
      ).toHaveBeenCalled();
    });
  });

  describe("workflow execution failures", () => {
    beforeEach(() => {
      const mockStateService = {
        createWorkflowSession: vi.fn().mockResolvedValue({
          canResume: true,
          isActive: true,
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
        maintainWorkflowContext: vi.fn().mockResolvedValue({
          canResume: true,
          isActive: true,
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
      };

      const mockReportService = {
        generateComprehensiveReport: vi.fn().mockResolvedValue({
          insights: ["Workflow failed at requirement analysis"],
          recommendations: [
            "Simplify user request",
            "Check documentation availability",
          ],
          report: {
            reportId: "test-report-id",
          },
          summary: {
            criticalIssues: ["Requirement analysis failed"],
            overallScore: 0.2,
          },
        }),
        initializeReport: vi.fn().mockResolvedValue({
          reportId: "test-report-id",
        }),
        recordStageExecution: vi.fn().mockResolvedValue({}),
      };

      (command as any).workflowStateService = mockStateService;
      (command as any).reportService = mockReportService;
    });

    it("should handle workflow execution failures gracefully", async () => {
      const mockOrchestrationService = {
        orchestrateCompleteWorkflow: vi.fn().mockResolvedValue({
          error: {
            code: "REQUIREMENT_ANALYSIS_FAILED",
            failedStage: "requirement-analysis",
            message: "Failed to analyze requirements",
          },
          executionTime: 5000,
          sessionId: "test-session-id",
          stages: [
            {
              data: null,
              error: { code: "ANALYSIS_ERROR", message: "Analysis failed" },
              executionTime: 5000,
              metadata: { error: true, timestamp: new Date() },
              stage: "requirement-analysis",
              success: false,
              toolsUsed: ["RequirementAnalysisService"],
            },
          ],
          success: false,
        }),
      };

      (command as any).toolOrchestrationService = mockOrchestrationService;

      const args = {
        userRequest: "Create an invalid process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe("Workflow orchestration failed");
      expect(parsedResult.error.code).toBe("REQUIREMENT_ANALYSIS_FAILED");
      expect(parsedResult.error.failedStage).toBe("requirement-analysis");
      expect(parsedResult.diagnostics).toBeDefined();
      expect(parsedResult.diagnostics.completedStages).toBe(0);
      expect(parsedResult.diagnostics.totalStages).toBe(1);
      expect(parsedResult.diagnostics.errors).toHaveLength(1);
      expect(parsedResult.diagnostics.recovery).toBeDefined();
      expect(parsedResult.diagnostics.recovery.sessionId).toBe(
        "test-session-id",
      );
    });

    it("should identify recoverable stages in failed workflow", async () => {
      const mockOrchestrationService = {
        orchestrateCompleteWorkflow: vi.fn().mockResolvedValue({
          error: {
            code: "DOCUMENTATION_QUERY_FAILED",
            failedStage: "documentation-query",
            message: "Documentation query failed",
          },
          executionTime: 10000,
          sessionId: "test-session-id",
          stages: [
            {
              data: { requirements: "test" },
              executionTime: 2000,
              metadata: { timestamp: new Date() },
              stage: "requirement-analysis",
              success: true,
              toolsUsed: ["RequirementAnalysisService"],
            },
            {
              data: null,
              error: { code: "DOCS_ERROR", message: "Docs failed" },
              executionTime: 8000,
              metadata: { error: true, timestamp: new Date() },
              stage: "documentation-query",
              success: false,
              toolsUsed: ["PermawebDocsService"],
            },
          ],
          success: false,
        }),
      };

      (command as any).toolOrchestrationService = mockOrchestrationService;

      const args = {
        userRequest: "Create a token process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.diagnostics.completedStages).toBe(1);
      expect(parsedResult.diagnostics.lastSuccessfulStage).toBe(
        "requirement-analysis",
      );
      expect(parsedResult.diagnostics.recovery.recoverableStages).toContain(
        "documentation-query",
      );
    });
  });

  describe("unexpected error handling", () => {
    it("should handle unexpected errors during execution", async () => {
      const mockOrchestrationService = {
        orchestrateCompleteWorkflow: vi
          .fn()
          .mockRejectedValue(new Error("Unexpected service error")),
      };

      const mockStateService = {
        createWorkflowSession: vi.fn().mockResolvedValue({
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
      };

      const mockReportService = {
        initializeReport: vi.fn().mockResolvedValue({
          reportId: "test-report-id",
        }),
      };

      (command as any).toolOrchestrationService = mockOrchestrationService;
      (command as any).workflowStateService = mockStateService;
      (command as any).reportService = mockReportService;

      const args = {
        userRequest: "Create a token process",
        workflowMode: "autonomous" as const,
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe(
        "Workflow orchestration encountered an unexpected error",
      );
      expect(parsedResult.error.code).toBe("UNEXPECTED_ERROR");
      expect(parsedResult.error.message).toBe("Unexpected service error");
      expect(parsedResult.diagnostics).toBeDefined();
      expect(parsedResult.diagnostics.userRequest).toBe(
        "Create a token process",
      );
      expect(parsedResult.diagnostics.configuration.mode).toBe("autonomous");
      expect(parsedResult.recovery.suggestions).toHaveLength(4);
      expect(parsedResult.recovery.suggestions).toContain(
        "Try simplifying the user request",
      );
    });

    it("should handle session creation failures", async () => {
      const mockStateService = {
        createWorkflowSession: vi
          .fn()
          .mockRejectedValue(new Error("Session creation failed")),
      };

      (command as any).workflowStateService = mockStateService;

      const args = {
        userRequest: "Create a token process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.code).toBe("UNEXPECTED_ERROR");
      expect(parsedResult.error.message).toBe("Session creation failed");
    });

    it("should handle report initialization failures", async () => {
      const mockStateService = {
        createWorkflowSession: vi.fn().mockResolvedValue({
          sessionId: "test-session-id",
          state: { sessionId: "test-session-id" },
        }),
      };

      const mockReportService = {
        initializeReport: vi
          .fn()
          .mockRejectedValue(new Error("Report initialization failed")),
      };

      (command as any).workflowStateService = mockStateService;
      (command as any).reportService = mockReportService;

      const args = {
        userRequest: "Create a token process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.message).toBe("Report initialization failed");
    });
  });

  describe("recoverable stage identification", () => {
    it("should correctly identify recoverable stages", () => {
      const recoverableStages = [
        "documentation-query",
        "architecture-analysis",
        "code-evaluation",
        "testing",
        "validation",
      ];

      const nonRecoverableStages = [
        "requirement-analysis",
        "code-generation",
        "process-creation",
        "initialization",
      ];

      for (const stage of recoverableStages) {
        expect((command as any).isRecoverableStage(stage)).toBe(true);
      }

      for (const stage of nonRecoverableStages) {
        expect((command as any).isRecoverableStage(stage)).toBe(false);
      }
    });
  });
});
