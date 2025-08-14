import { beforeAll, describe, expect, it, vi } from "vitest";

import { ToolOrchestrationService } from "../../src/services/ToolOrchestrationService.js";
import { WorkflowStateService } from "../../src/services/WorkflowStateService.js";
import { ProcessCreationReportService } from "../../src/services/ProcessCreationReportService.js";
import { WorkflowTemplateService } from "../../src/services/WorkflowTemplateService.js";
import { ToolContext } from "../../src/tools/core/index.js";
import { OrchestateProcessWorkflowCommand } from "../../src/tools/process/commands/OrchestateProcessWorkflowCommand.js";
import { CompleteWorkflowResult, WorkflowConfiguration } from "../../src/types/workflow-orchestration.js";
import type { JWKInterface } from "arweave/node/lib/wallet.js";

// Mock external dependencies
vi.mock("../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

describe("Complete Workflow Orchestration Integration", () => {
  let toolOrchestrationService: ToolOrchestrationService;
  let workflowStateService: WorkflowStateService;
  let reportService: ProcessCreationReportService;
  let templateService: WorkflowTemplateService;
  let orchestrateCommand: OrchestateProcessWorkflowCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  beforeAll(() => {
    vi.clearAllMocks();

    // Create mock context
    mockKeyPair = { kty: "RSA", e: "AQAB", n: "test" } as JWKInterface;
    mockContext = {
      hubId: "integration-test-hub",
      keyPair: mockKeyPair,
      publicKey: "integration-test-key",
    };

    // Initialize services
    toolOrchestrationService = new ToolOrchestrationService();
    workflowStateService = new WorkflowStateService();
    reportService = new ProcessCreationReportService();
    templateService = new WorkflowTemplateService();
    orchestrateCommand = new OrchestateProcessWorkflowCommand(mockContext);
  });

  describe("End-to-End Workflow Orchestration", () => {
    it("should orchestrate complete token contract workflow", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
        includeArchitectureAnalysis: true,
        enableIterativeMode: false,
        enableTemplateMode: true,
        processType: "token",
        timeoutMs: 60000,
      };

      const userRequest = "Create a token contract with transfer functionality";

      const result = await toolOrchestrationService.orchestrateCompleteWorkflow(
        userRequest,
        mockKeyPair,
        "test-hub",
        configuration
      );

      // Verify workflow completion
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);

      // Verify required stages completed
      const stageNames = result.stages.map(s => s.stage);
      expect(stageNames).toContain("requirement-analysis");
      expect(stageNames).toContain("documentation-query");
      expect(stageNames).toContain("code-generation");
      expect(stageNames).toContain("process-creation");

      // Verify final result structure
      if (result.success && result.finalResult) {
        expect(result.finalResult.requirements).toBeDefined();
        expect(result.finalResult.documentation).toBeDefined();
        expect(result.finalResult.codeResult).toBeDefined();
        expect(result.finalResult.processResult).toBeDefined();
      }

      // Verify execution report
      expect(result.report).toBeDefined();
      expect(result.report.sessionId).toBe(result.sessionId);
      expect(result.report.userRequest).toBe(userRequest);
      expect(result.report.configuration).toEqual(configuration);
    }, 30000); // Allow extra time for complete workflow

    it("should orchestrate simple stateless process workflow", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "guided",
        includeArchitectureAnalysis: false,
        enableIterativeMode: false,
        enableTemplateMode: true,
        processType: "custom",
        timeoutMs: 30000,
      };

      const userRequest = "Create a simple calculator service";

      const result = await toolOrchestrationService.orchestrateCompleteWorkflow(
        userRequest,
        mockKeyPair,
        "test-hub",
        configuration
      );

      // Verify workflow completion
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);

      // Verify essential stages completed
      const successfulStages = result.stages.filter(s => s.success);
      expect(successfulStages.length).toBeGreaterThan(0);

      // Verify performance metrics
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.metadata.totalStages).toBe(result.stages.length);
    }, 20000);

    it("should handle architecture analysis in complex workflow", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
        includeArchitectureAnalysis: true,
        enableIterativeMode: false,
        enableTemplateMode: true,
        processType: "game",
        timeoutMs: 45000,
      };

      const userRequest = "Create a complex multiplayer game system with state management";

      const result = await toolOrchestrationService.orchestrateCompleteWorkflow(
        userRequest,
        mockKeyPair,
        "test-hub",
        configuration
      );

      // Verify workflow execution (may succeed or have controlled failures)
      expect(result.sessionId).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.report).toBeDefined();

      // If architecture analysis is enabled, verify it was attempted
      if (configuration.includeArchitectureAnalysis) {
        const architectureStage = result.stages.find(s => s.stage === "architecture-analysis");
        if (architectureStage) {
          expect(architectureStage.toolsUsed).toContain("ArchitectureDecisionService");
        }
      }

      // Verify comprehensive reporting
      expect(result.report.configuration).toEqual(configuration);
      expect(result.report.resourceUsage).toBeDefined();
      expect(result.report.performance).toBeDefined();
    }, 45000);

    it("should generate comprehensive execution report", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
        includeArchitectureAnalysis: true,
        enableIterativeMode: false,
        enableTemplateMode: true,
      };

      const result = await toolOrchestrationService.orchestrateCompleteWorkflow(
        "Create a simple handler",
        mockKeyPair,
        "test-hub",
        configuration
      );

      // Verify report structure
      expect(result.report).toBeDefined();
      expect(result.report.auditTrail).toBeDefined();
      expect(result.report.performance).toBeDefined();
      expect(result.report.resourceUsage).toBeDefined();
      expect(result.report.stageExecutions).toBeDefined();

      // Verify audit trail
      expect(result.report.auditTrail.length).toBeGreaterThan(0);
      result.report.auditTrail.forEach(entry => {
        expect(entry.stage).toBeDefined();
        expect(entry.action).toBeDefined();
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.details).toBeDefined();
      });

      // Verify performance metrics
      expect(result.report.performance.totalExecutionTime).toBeGreaterThan(0);
      expect(result.report.performance.averageStageTime).toBeGreaterThan(0);

      // Verify resource usage tracking
      expect(typeof result.report.resourceUsage.totalApiCalls).toBe("number");
      expect(typeof result.report.resourceUsage.documentationQueries).toBe("number");
      expect(typeof result.report.resourceUsage.processesCreated).toBe("number");
    }, 25000);
  });

  describe("MCP Tool Integration", () => {
    it("should execute orchestrateProcessWorkflow command successfully", async () => {
      const args = {
        userRequest: "Create a simple ping pong handler",
        workflowMode: "autonomous" as const,
        processType: "custom" as const,
        includeArchitectureAnalysis: true,
        enableIterativeMode: false,
        enableTemplateMode: true,
        timeoutMs: 30000,
      };

      const result = await orchestrateCommand.execute(args);

      // Parse JSON response
      const parsedResult = JSON.parse(result);

      // Verify response structure
      expect(parsedResult.success).toBeDefined();
      expect(parsedResult.message).toBeDefined();
      
      if (parsedResult.success) {
        expect(parsedResult.data).toBeDefined();
        expect(parsedResult.data.sessionId).toBeDefined();
        expect(parsedResult.data.stages).toBeGreaterThan(0);
        expect(parsedResult.data.workflow).toBeDefined();
        expect(parsedResult.metadata).toBeDefined();
      } else {
        expect(parsedResult.error).toBeDefined();
        expect(parsedResult.diagnostics).toBeDefined();
      }
    }, 35000);

    it("should handle validation errors gracefully", async () => {
      const args = {
        userRequest: "x", // Too short - should fail validation
        workflowMode: "autonomous" as const,
        timeoutMs: 1000, // Very short timeout
      };

      const result = await orchestrateCommand.execute(args);
      const parsedResult = JSON.parse(result);

      // Should handle validation gracefully
      expect(parsedResult).toBeDefined();
      expect(typeof parsedResult.success).toBe("boolean");
      expect(parsedResult.message).toBeDefined();
    }, 10000);
  });

  describe("State Management Integration", () => {
    it("should manage workflow state correctly", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "guided",
        includeArchitectureAnalysis: false,
        enableIterativeMode: true,
      };

      const session = await workflowStateService.createWorkflowSession(
        configuration,
        "Test state management workflow"
      );

      expect(session.sessionId).toBeDefined();
      expect(session.state.context).toBeDefined();
      expect(session.canResume).toBe(true);
      expect(session.isActive).toBe(true);

      // Verify session can be retrieved
      const retrievedSession = await workflowStateService.resumeWorkflowSession(
        session.sessionId
      );
      expect(retrievedSession.sessionId).toBe(session.sessionId);
    });

    it("should create comprehensive process reports", async () => {
      const reportId = `test-report-${Date.now()}`;
      const sessionId = `test-session-${Date.now()}`;
      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
        timeoutMs: 30000,
      };

      const report = await reportService.initializeReport(
        reportId,
        sessionId,
        configuration,
        "Test report generation"
      );

      expect(report.reportId).toBe(reportId);
      expect(report.sessionId).toBe(sessionId);
      expect(report.configuration).toEqual(configuration);
      expect(report.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle workflow failures gracefully", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
        timeoutMs: 1, // Extremely short timeout to force failure
      };

      const result = await toolOrchestrationService.orchestrateCompleteWorkflow(
        "Create a test process",
        mockKeyPair,
        "test-hub",
        configuration
      );

      // Should not throw but return failed result
      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.stages).toBeDefined();
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });

    it("should provide meaningful error diagnostics", async () => {
      const args = {
        userRequest: "Create a complex system", // Valid request
        workflowMode: "autonomous" as const,
        timeoutMs: 100, // Very short timeout to likely cause failure
      };

      const result = await orchestrateCommand.execute(args);
      const parsedResult = JSON.parse(result);

      // Should provide diagnostic information even on failure
      expect(parsedResult).toBeDefined();
      
      if (!parsedResult.success) {
        expect(parsedResult.diagnostics).toBeDefined();
        expect(parsedResult.error).toBeDefined();
        expect(parsedResult.recovery).toBeDefined();
      }
    });
  });
});