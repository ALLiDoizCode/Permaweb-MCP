import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolOrchestrationService } from "../../../src/services/ToolOrchestrationService.js";
import { GuidedProcessResult } from "../../../src/types/guided-process.js";
import {
  LuaCodeResult,
  RequirementAnalysis,
} from "../../../src/types/lua-workflow.js";
import {
  CompleteWorkflowResult,
  ToolSelection,
  WorkflowConfiguration,
  WorkflowContext,
  WorkflowResults,
  WorkflowStage,
  WorkflowStageResult,
} from "../../../src/types/workflow-orchestration.js";

// Mock dependencies
vi.mock("../../../src/services/LuaWorkflowOrchestrationService.js", () => ({
  LuaWorkflowOrchestrationService: vi.fn().mockImplementation(() => ({
    analyzeRequirements: vi.fn(),
    generateLuaCode: vi.fn(),
    queryRelevantDocs: vi.fn(),
  })),
}));

vi.mock("../../../src/services/GuidedProcessCreationService.js", () => ({
  GuidedProcessCreationService: vi.fn().mockImplementation(() => ({
    createGuidedProcess: vi.fn(),
  })),
}));

vi.mock("../../../src/services/ArchitectureDecisionService.js", () => ({
  ArchitectureDecisionService: vi.fn().mockImplementation(() => ({
    generateArchitectureRecommendation: vi.fn(),
  })),
}));

vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocs: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/services/ProcessArchitectureAnalysisService.js", () => ({
  ProcessArchitectureAnalysisService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/services/RequirementAnalysisService.js", () => ({
  RequirementAnalysisService: vi.fn().mockImplementation(() => ({})),
}));

describe("ToolOrchestrationService", () => {
  let service: ToolOrchestrationService;
  let mockKeyPair: JWKInterface;
  let mockHubId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ToolOrchestrationService();
    mockKeyPair = { e: "AQAB", kty: "RSA", n: "test" } as JWKInterface;
    mockHubId = "test-hub-id";
  });

  describe("selectToolsForStage", () => {
    it("should return correct tools for requirement-analysis stage", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "requirement-analysis",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: [],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const tools = await service.selectToolsForStage(
        "requirement-analysis",
        context,
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].toolName).toBe("analyzeRequirements");
      expect(tools[0].toolType).toBe("analysis");
      expect(tools[0].dependencies).toEqual([]);
      expect(tools[0].priority).toBe(1);
    });

    it("should return correct tools for documentation-query stage", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "documentation-query",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: ["requirement-analysis"],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const tools = await service.selectToolsForStage(
        "documentation-query",
        context,
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].toolName).toBe("queryPermawebDocs");
      expect(tools[0].toolType).toBe("documentation");
      expect(tools[0].dependencies).toEqual(["requirement-analysis"]);
      expect(tools[0].parameters).toEqual({
        domains: ["arweave", "ao", "ario"],
      });
    });

    it("should return correct tools for code-generation stage", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "code-generation",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: ["requirement-analysis", "documentation-query"],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const tools = await service.selectToolsForStage(
        "code-generation",
        context,
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].toolName).toBe("generateLuaCode");
      expect(tools[0].toolType).toBe("process");
      expect(tools[0].dependencies).toEqual([
        "requirement-analysis",
        "documentation-query",
      ]);
      expect(tools[0].parameters).toEqual({ includeExplanation: true });
    });

    it("should return empty array for initialization stage", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "initialization",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: [],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const tools = await service.selectToolsForStage(
        "initialization",
        context,
      );

      expect(tools).toHaveLength(0);
    });
  });

  describe("executeToolChain", () => {
    it("should execute tools in dependency order", async () => {
      const tools: ToolSelection[] = [
        {
          dependencies: ["tool1"],
          expectedOutput: "output2",
          parameters: {},
          priority: 1,
          toolName: "tool2",
          toolType: "process",
        },
        {
          dependencies: [],
          expectedOutput: "output1",
          parameters: {},
          priority: 1,
          toolName: "tool1",
          toolType: "analysis",
        },
      ];

      const result = await service.executeToolChain(tools, {});

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(["tool1", "tool2"]);
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveProperty("tool1");
      expect(result.results).toHaveProperty("tool2");
    });

    it("should handle tool execution errors gracefully", async () => {
      const tools: ToolSelection[] = [
        {
          dependencies: [],
          expectedOutput: "output1",
          parameters: {},
          priority: 1,
          toolName: "failing-tool",
          toolType: "analysis",
        },
      ];

      // Mock executeToolWithChaining to throw error for failing-tool
      vi.spyOn(service as any, "executeToolWithChaining").mockRejectedValueOnce(
        new Error("Tool execution failed"),
      );

      const result = await service.executeToolChain(tools, {});

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].tool).toBe("failing-tool");
      expect(result.errors[0].error).toBe("Tool execution failed");
    });

    it("should chain tool inputs correctly", async () => {
      const tools: ToolSelection[] = [
        {
          dependencies: [],
          expectedOutput: "requirements",
          parameters: { param1: "value1" },
          priority: 1,
          toolName: "analyze",
          toolType: "analysis",
        },
        {
          dependencies: ["analyze"],
          expectedOutput: "docs",
          parameters: { param2: "value2" },
          priority: 1,
          toolName: "query",
          toolType: "documentation",
        },
      ];

      const executeToolSpy = vi.spyOn(
        service as any,
        "executeToolWithChaining",
      );
      executeToolSpy.mockResolvedValue({ result: "mocked" });

      await service.executeToolChain(tools, { initialParam: "initial" });

      expect(executeToolSpy).toHaveBeenCalledTimes(2);

      // Check first tool call
      expect(executeToolSpy.mock.calls[0][1]).toEqual({
        initialParam: "initial",
        param1: "value1",
      });

      // Check second tool call (should include results from first tool)
      expect(executeToolSpy.mock.calls[1][1]).toEqual({
        analyze: { result: "mocked" },
        initialParam: "initial",
        param2: "value2",
      });
    });
  });

  describe("executeStage", () => {
    it("should execute stage successfully and return stage result", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "requirement-analysis",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: [],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const mockExecution = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
        return { data: "test-data", success: true };
      });

      const result = await service.executeStage(
        "requirement-analysis",
        context,
        mockExecution,
      );

      expect(result.success).toBe(true);
      expect(result.stage).toBe("requirement-analysis");
      expect(result.data).toEqual({ data: "test-data", success: true });
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(context.stageHistory).toContain("requirement-analysis");
    });

    it("should handle stage execution errors", async () => {
      const context: WorkflowContext = {
        configuration: { mode: "guided" },
        currentStage: "requirement-analysis",
        hubId: mockHubId,
        keyPair: mockKeyPair,
        metadata: {},
        sessionId: "test-session",
        stageHistory: [],
        timestamp: new Date(),
        userRequest: "Create a token process",
      };

      const mockExecution = vi
        .fn()
        .mockRejectedValue(new Error("Stage execution failed"));

      const result = await service.executeStage(
        "requirement-analysis",
        context,
        mockExecution,
      );

      expect(result.success).toBe(false);
      expect(result.stage).toBe("requirement-analysis");
      expect(result.error?.message).toBe("Stage execution failed");
      expect(result.error?.code).toBe("REQUIREMENT-ANALYSIS_FAILED");
      expect(result.data).toBeNull();
    });
  });

  describe("validateWorkflowResults", () => {
    it("should validate successful workflow results", async () => {
      const mockStages: WorkflowStageResult[] = [
        {
          data: { requirements: "test" },
          executionTime: 1000,
          metadata: { timestamp: new Date() },
          stage: "requirement-analysis",
          success: true,
          toolsUsed: ["RequirementAnalysisService"],
        },
        {
          data: { docs: [] },
          executionTime: 2000,
          metadata: { timestamp: new Date() },
          stage: "documentation-query",
          success: true,
          toolsUsed: ["PermawebDocsService"],
        },
        {
          data: { code: "test code" },
          executionTime: 3000,
          metadata: { timestamp: new Date() },
          stage: "code-generation",
          success: true,
          toolsUsed: ["LuaCodeGeneratorService"],
        },
        {
          data: { processId: "test-process" },
          executionTime: 4000,
          metadata: { timestamp: new Date() },
          stage: "process-creation",
          success: true,
          toolsUsed: ["GuidedProcessCreationService"],
        },
      ];

      const results: WorkflowResults = {
        context: {
          configuration: { mode: "guided" },
          currentStage: "process-creation",
          hubId: mockHubId,
          keyPair: mockKeyPair,
          metadata: {},
          sessionId: "test-session",
          stageHistory: [
            "requirement-analysis",
            "documentation-query",
            "code-generation",
            "process-creation",
          ],
          timestamp: new Date(),
          userRequest: "Create a token process",
        },
        finalOutput: { processId: "test-process" },
        report: {} as any,
        stages: mockStages,
      };

      const validation = await service.validateWorkflowResults(results);

      expect(validation.isValid).toBe(true);
      expect(validation.canProceed).toBe(true);
      expect(validation.completionScore).toBe(1.0);
      expect(validation.qualityScore).toBe(1.0);
      expect(validation.issues).toHaveLength(0);
    });

    it("should identify missing required stages", async () => {
      const mockStages: WorkflowStageResult[] = [
        {
          data: { requirements: "test" },
          executionTime: 1000,
          metadata: { timestamp: new Date() },
          stage: "requirement-analysis",
          success: true,
          toolsUsed: ["RequirementAnalysisService"],
        },
      ];

      const results: WorkflowResults = {
        context: {
          configuration: { mode: "guided" },
          currentStage: "requirement-analysis",
          hubId: mockHubId,
          keyPair: mockKeyPair,
          metadata: {},
          sessionId: "test-session",
          stageHistory: ["requirement-analysis"],
          timestamp: new Date(),
          userRequest: "Create a token process",
        },
        finalOutput: {},
        report: {} as any,
        stages: mockStages,
      };

      const validation = await service.validateWorkflowResults(results);

      expect(validation.isValid).toBe(false);
      expect(validation.completionScore).toBe(0.25); // 1 out of 4 required stages completed
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0].message).toContain("Missing required stages");
    });

    it("should handle failed stages", async () => {
      const mockStages: WorkflowStageResult[] = [
        {
          data: { requirements: "test" },
          executionTime: 1000,
          metadata: { timestamp: new Date() },
          stage: "requirement-analysis",
          success: true,
          toolsUsed: ["RequirementAnalysisService"],
        },
        {
          data: null,
          error: {
            code: "DOCUMENTATION_QUERY_FAILED",
            message: "Documentation query failed",
          },
          executionTime: 2000,
          metadata: { timestamp: new Date() },
          stage: "documentation-query",
          success: false,
          toolsUsed: ["PermawebDocsService"],
        },
      ];

      const results: WorkflowResults = {
        context: {
          configuration: { mode: "guided" },
          currentStage: "documentation-query",
          hubId: mockHubId,
          keyPair: mockKeyPair,
          metadata: {},
          sessionId: "test-session",
          stageHistory: ["requirement-analysis", "documentation-query"],
          timestamp: new Date(),
          userRequest: "Create a token process",
        },
        finalOutput: {},
        report: {} as any,
        stages: mockStages,
      };

      const validation = await service.validateWorkflowResults(results);

      expect(validation.isValid).toBe(false);
      expect(validation.qualityScore).toBe(0.8); // Reduced due to failed stage
      expect(
        validation.issues.some((issue) =>
          issue.message.includes("Stage documentation-query failed"),
        ),
      ).toBe(true);
    });

    it("should warn about performance issues", async () => {
      const mockStages: WorkflowStageResult[] = [
        {
          data: { requirements: "test" },
          executionTime: 45000, // 45 seconds - should trigger performance warning
          metadata: { timestamp: new Date() },
          stage: "requirement-analysis",
          success: true,
          toolsUsed: ["RequirementAnalysisService"],
        },
      ];

      const results: WorkflowResults = {
        context: {
          configuration: { mode: "guided" },
          currentStage: "requirement-analysis",
          hubId: mockHubId,
          keyPair: mockKeyPair,
          metadata: {},
          sessionId: "test-session",
          stageHistory: ["requirement-analysis"],
          timestamp: new Date(),
          userRequest: "Create a token process",
        },
        finalOutput: {},
        report: {} as any,
        stages: mockStages,
      };

      const validation = await service.validateWorkflowResults(results);

      expect(
        validation.issues.some(
          (issue) =>
            issue.message.includes("Average stage execution time is high") &&
            issue.severity === "warning",
        ),
      ).toBe(true);
    });
  });

  describe("orchestrateCompleteWorkflow", () => {
    beforeEach(() => {
      // Mock successful workflow execution
      const mockLuaWorkflowService = {
        analyzeRequirements: vi.fn().mockResolvedValue({
          complexity: "moderate",
          extractedKeywords: ["token"],
          processType: "token",
          userRequest: "Create a token process",
        } as RequirementAnalysis),
        generateLuaCode: vi.fn().mockResolvedValue({
          code: "-- Lua code",
          generatedCode: "-- Generated Lua code",
        } as LuaCodeResult),
        queryRelevantDocs: vi
          .fn()
          .mockResolvedValue([
            { content: "docs", source: "test", title: "Test Doc" },
          ]),
      };

      const mockGuidedProcessService = {
        createGuidedProcess: vi.fn().mockResolvedValue({
          processId: "test-process-id",
          success: true,
        } as GuidedProcessResult),
      };

      // Replace the services in the orchestration service
      (service as any).luaWorkflowService = mockLuaWorkflowService;
      (service as any).guidedProcessService = mockGuidedProcessService;
    });

    it("should orchestrate complete workflow successfully", async () => {
      const configuration: WorkflowConfiguration = {
        includeArchitectureAnalysis: false,
        mode: "autonomous",
      };

      const result = await service.orchestrateCompleteWorkflow(
        "Create a simple token process",
        mockKeyPair,
        mockHubId,
        configuration,
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.finalResult).toBeDefined();
      expect(result.finalResult?.processResult?.processId).toBe(
        "test-process-id",
      );
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle workflow failures gracefully", async () => {
      // Mock a failing requirement analysis
      (service as any).luaWorkflowService.analyzeRequirements = vi
        .fn()
        .mockRejectedValue(new Error("Analysis failed"));

      const configuration: WorkflowConfiguration = {
        mode: "autonomous",
      };

      const result = await service.orchestrateCompleteWorkflow(
        "Create a token process",
        mockKeyPair,
        mockHubId,
        configuration,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Analysis failed");
      expect(result.error?.failedStage).toBe("requirement-analysis");
    });

    it("should include architecture analysis when enabled", async () => {
      const mockArchitectureService = {
        generateArchitectureRecommendation: vi.fn().mockResolvedValue({
          recommendation: "Use token pattern",
        }),
      };

      (service as any).architectureDecisionService = mockArchitectureService;

      const configuration: WorkflowConfiguration = {
        includeArchitectureAnalysis: true,
        mode: "guided",
      };

      const result = await service.orchestrateCompleteWorkflow(
        "Create a token process",
        mockKeyPair,
        mockHubId,
        configuration,
      );

      expect(result.success).toBe(true);
      expect(
        mockArchitectureService.generateArchitectureRecommendation,
      ).toHaveBeenCalled();

      // Should have architecture analysis stage
      expect(
        result.stages.some((stage) => stage.stage === "architecture-analysis"),
      ).toBe(true);
    });

    it("should skip architecture analysis when disabled", async () => {
      const configuration: WorkflowConfiguration = {
        includeArchitectureAnalysis: false,
        mode: "guided",
      };

      const result = await service.orchestrateCompleteWorkflow(
        "Create a token process",
        mockKeyPair,
        mockHubId,
        configuration,
      );

      expect(result.success).toBe(true);

      // Should not have architecture analysis stage
      expect(
        result.stages.some((stage) => stage.stage === "architecture-analysis"),
      ).toBe(false);
    });

    it("should generate comprehensive execution report", async () => {
      const configuration: WorkflowConfiguration = {
        mode: "guided",
      };

      const result = await service.orchestrateCompleteWorkflow(
        "Create a token process",
        mockKeyPair,
        mockHubId,
        configuration,
      );

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report.sessionId).toBe(result.sessionId);
      expect(result.report.userRequest).toBe("Create a token process");
      expect(result.report.configuration).toEqual(configuration);
      expect(result.report.performance).toBeDefined();
      expect(result.report.resourceUsage).toBeDefined();
      expect(result.report.auditTrail).toBeDefined();
      expect(result.report.stageExecutions).toHaveLength(result.stages.length);
    });
  });
});
