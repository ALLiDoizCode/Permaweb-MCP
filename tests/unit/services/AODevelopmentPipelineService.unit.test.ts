import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AOPipelineConfiguration } from "../../../src/models/AODevelopmentPipeline.js";
import { TealProcessDefinition } from "../../../src/models/TealProcess.js";
import { AODevelopmentDocsService } from "../../../src/services/AODevelopmentDocsService.js";
import { createAODevelopmentPipelineService } from "../../../src/services/AODevelopmentPipelineService.js";
import { AOLiteTestService } from "../../../src/services/AOLiteTestService.js";
import { PermawebDeployService } from "../../../src/services/PermawebDeployService.js";
import { TealCompilerService } from "../../../src/services/TealCompilerService.js";
import { TealWorkflowService } from "../../../src/services/TealWorkflowService.js";

// Mock dependencies
vi.mock("../../../src/services/AODevelopmentDocsService.js", () => ({
  AODevelopmentDocsService: vi.fn(),
}));

vi.mock("../../../src/services/TealCompilerService.js", () => ({
  TealCompilerService: vi.fn(),
}));

vi.mock("../../../src/services/AOLiteTestService.js", () => ({
  AOLiteTestService: vi.fn(),
}));

vi.mock("../../../src/services/PermawebDeployService.js", () => ({
  PermawebDeployService: vi.fn(),
}));

vi.mock("../../../src/services/TealWorkflowService.js", () => ({
  TealWorkflowService: vi.fn(),
}));

describe("AODevelopmentPipelineService", () => {
  let pipelineService: ReturnType<typeof createAODevelopmentPipelineService>;
  let mockDocsService: AODevelopmentDocsService;
  let mockTealCompilerService: TealCompilerService;
  let mockAOLiteTestService: AOLiteTestService;
  let mockDeployService: PermawebDeployService;
  let mockTealWorkflowService: TealWorkflowService;
  let mockProcessDefinition: TealProcessDefinition;
  let mockSigner: JWKInterface;

  beforeEach(() => {
    mockDocsService = {
      queryAODevelopmentDocs: vi.fn().mockResolvedValue({
        bestPractices: [],
        codeExamples: [],
        commonPitfalls: [],
        nextSteps: [],
        primaryGuidance: "Test guidance",
        relatedTopics: [],
        sources: [],
      }),
    } as any;

    mockTealCompilerService = {
      compileTealToLua: vi.fn().mockResolvedValue({
        compiledLua: "compiled lua code",
        success: true,
        warnings: [],
      }),
    } as any;

    mockAOLiteTestService = {
      createDefaultTestSuite: vi.fn().mockResolvedValue({
        id: "test-suite",
        testCases: [],
      }),
      createTestEnvironment: vi.fn().mockResolvedValue({
        isRunning: true,
        state: {},
      }),
      executeTestSuite: vi.fn().mockResolvedValue({
        duration: 1000,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 1,
        results: [],
        status: "passed",
        testSuiteId: "test-suite",
        totalTests: 1,
      }),
    } as any;

    mockDeployService = {} as any;
    mockTealWorkflowService = {} as any;

    pipelineService = createAODevelopmentPipelineService(
      mockDocsService,
      mockTealCompilerService,
      mockAOLiteTestService,
      mockDeployService,
      mockTealWorkflowService,
    );

    mockProcessDefinition = {
      compiledLua: "-- Test compiled Lua",
      dependencies: [],
      id: "test-process",
      metadata: {
        aoVersion: "2.0.0",
        author: "Test Author",
        compileOptions: {},
        description: "Test process",
        version: "1.0.0",
      },
      name: "Test Process",
      source: "-- Test Teal source",
      typeDefinitions: [],
      version: "1.0.0",
    };

    mockSigner = {
      d: "test-private",
      dp: "test-dp",
      dq: "test-dq",
      e: "AQAB",
      kty: "RSA",
      n: "test-key",
      p: "test-p",
      q: "test-q",
      qi: "test-qi",
    };
  });

  describe("createPipeline", () => {
    it("should create a development pipeline", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe("Test Pipeline");
      expect(pipeline.status).toBe("draft");
      expect(pipeline.stages).toBeDefined();
      expect(pipeline.stages.length).toBe(4); // docs, develop, test, deploy
      expect(pipeline.configuration).toEqual(config);
    });

    it("should create stages with correct configuration", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: false,
        parallelExecution: true,
        stopOnError: false,
        timeout: 60000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      expect(pipeline.stages.some((s) => s.name === "docs")).toBe(true);
      expect(pipeline.stages.some((s) => s.name === "develop")).toBe(true);
      expect(pipeline.stages.some((s) => s.name === "test")).toBe(true);
      expect(pipeline.stages.some((s) => s.name === "deploy")).toBe(true);
    });
  });

  describe("executePipeline", () => {
    it("should execute all stages successfully", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: false,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const results = await pipelineService.executePipeline(
        pipeline,
        mockSigner,
      );

      expect(results.pipelineId).toBe(pipeline.id);
      expect(results.status).toBe("completed");
      expect(results.totalStages).toBe(4);
      expect(results.stageResults).toBeDefined();
      expect(results.stageResults.length).toBe(4);
    });

    it("should stop on error when configured", async () => {
      // Mock a failing compilation
      mockTealCompilerService.compileTealToLua = vi.fn().mockResolvedValue({
        errors: ["Compilation failed"],
        success: false,
      });

      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const results = await pipelineService.executePipeline(
        pipeline,
        mockSigner,
      );

      expect(results.status).toBe("failed");
      expect(results.failedStages).toBeGreaterThan(0);
    });

    it("should continue on error when configured", async () => {
      // Mock a failing compilation
      mockTealCompilerService.compileTealToLua = vi.fn().mockResolvedValue({
        errors: ["Compilation failed"],
        success: false,
      });

      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: false,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const results = await pipelineService.executePipeline(
        pipeline,
        mockSigner,
      );

      expect(results.totalStages).toBe(4);
      expect(results.stageResults.length).toBe(4);
    });
  });

  describe("executeStage", () => {
    it("should execute docs stage", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const docsStage = pipeline.stages.find((s) => s.name === "docs")!;
      const result = await pipelineService.executeStage(
        docsStage,
        pipeline,
        mockSigner,
      );

      expect(result.stageId).toBe(docsStage.id);
      expect(result.name).toBe("docs");
      expect(result.status).toBe("completed");
      expect(result.output).toBeDefined();
    });

    it("should execute develop stage", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const developStage = pipeline.stages.find((s) => s.name === "develop")!;
      const result = await pipelineService.executeStage(
        developStage,
        pipeline,
        mockSigner,
      );

      expect(result.stageId).toBe(developStage.id);
      expect(result.name).toBe("develop");
      expect(result.status).toBe("completed");
      expect(result.artifacts).toBeDefined();
    });

    it("should execute test stage", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const testStage = pipeline.stages.find((s) => s.name === "test")!;
      const result = await pipelineService.executeStage(
        testStage,
        pipeline,
        mockSigner,
      );

      expect(result.stageId).toBe(testStage.id);
      expect(result.name).toBe("test");
      expect(result.status).toBe("completed");
      expect(result.artifacts).toBeDefined();
    });

    it("should execute deploy stage", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const deployStage = pipeline.stages.find((s) => s.name === "deploy")!;
      const result = await pipelineService.executeStage(
        deployStage,
        pipeline,
        mockSigner,
      );

      expect(result.stageId).toBe(deployStage.id);
      expect(result.name).toBe("deploy");
      expect(result.status).toBe("completed");
      expect(result.artifacts).toBeDefined();
    });

    it("should handle stage failures", async () => {
      // Mock a failing docs query
      mockDocsService.queryAODevelopmentDocs = vi
        .fn()
        .mockRejectedValue(new Error("Docs query failed"));

      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const docsStage = pipeline.stages.find((s) => s.name === "docs")!;
      const result = await pipelineService.executeStage(
        docsStage,
        pipeline,
        mockSigner,
      );

      expect(result.stageId).toBe(docsStage.id);
      expect(result.name).toBe("docs");
      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
    });
  });

  describe("validateStageTransition", () => {
    it("should validate valid stage transitions", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      // Mark docs stage as completed
      const docsStage = pipeline.stages.find((s) => s.name === "docs")!;
      docsStage.status = "completed";

      const isValid = await pipelineService.validateStageTransition(
        "docs",
        "develop",
        pipeline,
      );

      expect(isValid).toBe(true);
    });

    it("should reject invalid stage transitions", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const isValid = await pipelineService.validateStageTransition(
        "docs",
        "deploy",
        pipeline,
      );

      expect(isValid).toBe(false);
    });

    it("should reject transitions from incomplete stages", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      // docs stage is still pending
      const isValid = await pipelineService.validateStageTransition(
        "docs",
        "develop",
        pipeline,
      );

      expect(isValid).toBe(false);
    });
  });

  describe("generatePipelineReport", () => {
    it("should generate a comprehensive pipeline report", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      const results = await pipelineService.executePipeline(
        pipeline,
        mockSigner,
      );
      const report = await pipelineService.generatePipelineReport(
        pipeline,
        results,
      );

      expect(report).toBeDefined();
      expect(report).toContain("# AO Development Pipeline Report");
      expect(report).toContain("Test Pipeline");
      expect(report).toContain("Execution Summary");
      expect(report).toContain("Stage Results");
      expect(report).toContain("Artifacts Generated");
    });
  });

  describe("pipeline control", () => {
    it("should pause pipeline", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      await pipelineService.pausePipeline(pipeline.id);
      const status = await pipelineService.getPipelineStatus(pipeline.id);

      expect(status.status).toBe("draft");
    });

    it("should resume pipeline", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      await pipelineService.pausePipeline(pipeline.id);
      await pipelineService.resumePipeline(pipeline.id);
      const status = await pipelineService.getPipelineStatus(pipeline.id);

      expect(status.status).toBe("running");
    });

    it("should cancel pipeline", async () => {
      const config: AOPipelineConfiguration = {
        autoAdvance: true,
        parallelExecution: false,
        stopOnError: true,
        timeout: 300000,
      };

      const pipeline = await pipelineService.createPipeline(
        "Test Pipeline",
        mockProcessDefinition,
        config,
      );

      await pipelineService.cancelPipeline(pipeline.id);
      const status = await pipelineService.getPipelineStatus(pipeline.id);

      expect(status.status).toBe("failed");
    });
  });

  describe("createQuickStartPipeline", () => {
    it("should create a token quick start pipeline", async () => {
      const pipeline = await pipelineService.createQuickStartPipeline(
        "token",
        "QuickToken",
        {
          autoAdvance: true,
          stopOnError: true,
        },
      );

      expect(pipeline.name).toBe("QuickToken");
      expect(pipeline.metadata.tags).toContain("token");
      expect(pipeline.configuration.autoAdvance).toBe(true);
      expect(pipeline.configuration.stopOnError).toBe(true);
    });

    it("should create a DAO quick start pipeline", async () => {
      const pipeline = await pipelineService.createQuickStartPipeline(
        "dao",
        "QuickDAO",
      );

      expect(pipeline.name).toBe("QuickDAO");
      expect(pipeline.metadata.tags).toContain("dao");
    });

    it("should create a game quick start pipeline", async () => {
      const pipeline = await pipelineService.createQuickStartPipeline(
        "game",
        "QuickGame",
      );

      expect(pipeline.name).toBe("QuickGame");
      expect(pipeline.metadata.tags).toContain("game");
    });

    it("should create a generic quick start pipeline", async () => {
      const pipeline = await pipelineService.createQuickStartPipeline(
        "generic",
        "QuickProcess",
      );

      expect(pipeline.name).toBe("QuickProcess");
      expect(pipeline.metadata.tags).toContain("generic");
    });
  });
});
