import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAIMemoryService } from "../../../src/services/AIMemoryService.js";
import { createAODevelopmentDocsService } from "../../../src/services/AODevelopmentDocsService.js";
import { createAODevelopmentPipelineService } from "../../../src/services/AODevelopmentPipelineService.js";
import { createAOLiteTestService } from "../../../src/services/AOLiteTestService.js";
import { createPermawebDeployService } from "../../../src/services/PermawebDeployService.js";
import { createProcessCommunicationService } from "../../../src/services/ProcessCommunicationService.js";
import { createTealCompilerService } from "../../../src/services/TealCompilerService.js";
import { createTealWorkflowService } from "../../../src/services/TealWorkflowService.js";

// Mock external AO dependencies
vi.mock("@permaweb/aoconnect", () => ({
  createDataItemSigner: vi.fn().mockReturnValue({
    signDataItem: vi.fn(),
  }),
  message: vi.fn().mockResolvedValue("test-message-id-123"),
  spawn: vi.fn().mockResolvedValue("test-process-id-123"),
}));

vi.mock("../../../src/constants.js", () => ({
  AOS_MODULE: vi.fn(() => "test-aos-module"),
  SCHEDULER: vi.fn(() => "test-scheduler"),
}));

// Mock service dependencies
vi.mock("../../../src/services/AODevelopmentDocsService.js", () => ({
  createAODevelopmentDocsService: vi.fn(() => ({})),
}));

vi.mock("../../../src/services/TealCompilerService.js", () => ({
  createTealCompilerService: vi.fn(() => ({})),
}));

vi.mock("../../../src/services/AOLiteTestService.js", () => ({
  createAOLiteTestService: vi.fn(() => ({})),
}));

vi.mock("../../../src/services/PermawebDeployService.js", () => ({
  createPermawebDeployService: vi.fn(() => ({})),
}));

vi.mock("../../../src/services/TealWorkflowService.js", () => ({
  createTealWorkflowService: vi.fn(() => ({})),
}));

vi.mock("../../../src/services/ProcessCommunicationService.js", () => ({
  createProcessCommunicationService: vi.fn(() => ({
    getMessageResult: vi
      .fn()
      .mockResolvedValue({ data: "response", success: true }),
  })),
}));

vi.mock("../../../src/services/AIMemoryService.js", () => ({
  createAIMemoryService: vi.fn(() => ({
    addEnhanced: vi.fn().mockResolvedValue("memory-123"),
  })),
}));

describe("AODevelopmentPipelineService Deployment Integration", () => {
  let pipelineService: any;
  let mockKeyPair: JWKInterface;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockKeyPair = {
      d: "test-private-key",
      dp: "test-dp",
      dq: "test-dq",
      e: "AQAB",
      kty: "RSA",
      n: "test-key-data",
      p: "test-p",
      q: "test-q",
      qi: "test-qi",
    };

    // Create pipeline service with all dependencies
    const docsService = createAODevelopmentDocsService();
    const tealCompilerService = createTealCompilerService();
    const aoLiteTestService = createAOLiteTestService(
      {} as any,
      createProcessCommunicationService({} as any),
    );
    const deployService = createPermawebDeployService();
    const tealWorkflowService = createTealWorkflowService(
      {} as any,
      createProcessCommunicationService({} as any),
    );
    const processService = createProcessCommunicationService({} as any);
    const aiMemoryService = createAIMemoryService();

    pipelineService = createAODevelopmentPipelineService(
      docsService,
      tealCompilerService,
      aoLiteTestService,
      deployService,
      tealWorkflowService,
      processService,
      aiMemoryService,
    );
  });

  it("should execute complete deployment pipeline with valid AOLite results", async () => {
    const aoliteTestResults = {
      summary: {
        coveragePercentage: 95,
        failed: 0,
        passed: 5,
        total: 5,
      },
      testResults: [
        { id: "test1", status: "passed" },
        { id: "test2", status: "passed" },
        { id: "test3", status: "passed" },
        { id: "test4", status: "passed" },
        { id: "test5", status: "passed" },
      ],
    };

    const processSource = `
      Handlers.add('info', 
        Handlers.utils.hasMatchingTag('Action', 'Info'),
        function(msg)
          Send({Target = msg.From, Data = "Process Info"})
        end
      )
      
      Handlers.add('ping', 
        Handlers.utils.hasMatchingTag('Action', 'Ping'),
        function(msg)
          Send({Target = msg.From, Data = "Pong"})
        end
      )
    `;

    const deploymentConfiguration = {
      monitoring: true,
      network: "testnet" as const,
      qualityGates: {
        coverageThreshold: 80,
        requireAllTests: true,
        testPassRate: 100,
      },
      rollbackEnabled: true,
      validationSteps: ["Info", "Ping"],
    };

    const result = await pipelineService.executeDeploymentPipeline(
      aoliteTestResults,
      processSource,
      mockKeyPair,
      deploymentConfiguration,
    );

    expect(result).toMatchObject({
      deploymentRecords: {
        documentationGenerated: true,
        memoryStorageId: "memory-123",
      },
      deploymentValidation: {
        finalStatus: "validated",
        rollbackPerformed: false,
      },
      processId: "test-process-id-123",
      status: "completed",
    });

    expect(result.aoliteTestResults).toEqual(aoliteTestResults);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("should reject deployment with insufficient test coverage", async () => {
    const aoliteTestResults = {
      summary: {
        coveragePercentage: 60, // Below threshold
        failed: 2,
        passed: 3,
        total: 5,
      },
    };

    const processSource = "Handlers.add('test', function() end)";

    const deploymentConfiguration = {
      qualityGates: {
        coverageThreshold: 80,
        requireAllTests: true,
        testPassRate: 100,
      },
    };

    await expect(
      pipelineService.executeDeploymentPipeline(
        aoliteTestResults,
        processSource,
        mockKeyPair,
        deploymentConfiguration,
      ),
    ).rejects.toThrow(
      "AOLite test results do not meet deployment quality gates",
    );
  });

  it("should reject deployment with failing tests when requireAllTests is true", async () => {
    const aoliteTestResults = {
      summary: {
        coveragePercentage: 90,
        failed: 1, // Has failures
        passed: 4,
        total: 5,
      },
    };

    const processSource = "Handlers.add('test', function() end)";

    const deploymentConfiguration = {
      qualityGates: {
        coverageThreshold: 80,
        requireAllTests: true, // Requires all tests to pass
        testPassRate: 100,
      },
    };

    await expect(
      pipelineService.executeDeploymentPipeline(
        aoliteTestResults,
        processSource,
        mockKeyPair,
        deploymentConfiguration,
      ),
    ).rejects.toThrow(
      "AOLite test results do not meet deployment quality gates",
    );
  });

  it("should validate deployment with successful process responses", async () => {
    const processId = "test-process-123";
    const validationTests = ["Info", "Ping", "Balance"];
    const timeout = 30000;

    const result = await pipelineService.validateDeployment(
      processId,
      validationTests,
      mockKeyPair,
      timeout,
    );

    expect(result).toMatchObject({
      overallStatus: "passed",
      processId,
      validationResults: expect.arrayContaining([
        expect.objectContaining({
          result: expect.any(Object),
          status: "passed",
          test: "Info",
        }),
        expect.objectContaining({
          result: expect.any(Object),
          status: "passed",
          test: "Ping",
        }),
        expect.objectContaining({
          result: expect.any(Object),
          status: "passed",
          test: "Balance",
        }),
      ]),
    });

    expect(result.duration).toBeGreaterThan(0);
    expect(result.validationResults).toHaveLength(3);
  });

  it("should handle validation failure when process doesn't respond", async () => {
    // Mock process service to throw timeout error
    const mockProcessService = createProcessCommunicationService({} as any);
    vi.mocked(mockProcessService.getMessageResult).mockRejectedValue(
      new Error("Timeout after 30000ms"),
    );

    const pipelineServiceWithTimeout = createAODevelopmentPipelineService(
      createAODevelopmentDocsService(),
      createTealCompilerService(),
      createAOLiteTestService({} as any, mockProcessService),
      createPermawebDeployService(),
      createTealWorkflowService({} as any, mockProcessService),
      mockProcessService,
      createAIMemoryService(),
    );

    const processId = "unresponsive-process-123";
    const validationTests = ["Info"];
    const timeout = 5000;

    const result = await pipelineServiceWithTimeout.validateDeployment(
      processId,
      validationTests,
      mockKeyPair,
      timeout,
    );

    expect(result).toMatchObject({
      overallStatus: "failed",
      processId,
      validationResults: expect.arrayContaining([
        expect.objectContaining({
          error: expect.stringContaining("Timeout"),
          status: "failed",
          test: "Info",
        }),
      ]),
    });
  });

  it("should execute rollback successfully", async () => {
    const processId = "failed-deployment-123";
    const reason = "Validation timeout";
    const preserveData = false;

    const result = await pipelineService.rollbackDeployment(
      processId,
      reason,
      preserveData,
    );

    expect(result).toMatchObject({
      preservedData: preserveData,
      processId,
      reason,
      rollbackPerformed: true,
      status: "success",
    });

    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it("should create comprehensive deployment record in memory", async () => {
    const deploymentResults = {
      aoliteTestResults: {
        summary: { coveragePercentage: 95, passed: 5, total: 5 },
      },
      deploymentRecords: {
        documentationGenerated: false,
      },
      deploymentValidation: {
        finalStatus: "validated",
        rollbackPerformed: false,
        validationResults: [
          { result: { data: "success" }, status: "passed", test: "Info" },
        ],
      },
      duration: 5000,
      processId: "test-process-123",
      status: "completed",
    };

    const memoryId = await pipelineService.createDeploymentRecord(
      deploymentResults,
      mockKeyPair,
      "test-hub-123",
    );

    expect(memoryId).toBe("memory-123");

    // Verify AIMemoryService was called with correct parameters
    const mockAIMemoryService = createAIMemoryService();
    expect(vi.mocked(mockAIMemoryService.addEnhanced)).toHaveBeenCalledWith(
      mockKeyPair,
      "test-hub-123",
      expect.objectContaining({
        content: expect.stringContaining("# Deployment Record"),
        context: expect.objectContaining({
          deploymentStatus: "completed",
          processId: "test-process-123",
          source: "AODevelopmentPipelineService",
        }),
        importance: 0.9,
        memoryType: "workflow",
      }),
    );
  });

  it("should perform end-to-end deployment pipeline with rollback on validation failure", async () => {
    // Mock validation to fail
    const mockProcessService = createProcessCommunicationService({} as any);
    vi.mocked(mockProcessService.getMessageResult).mockRejectedValue(
      new Error("Validation failed"),
    );

    const pipelineServiceWithFailedValidation =
      createAODevelopmentPipelineService(
        createAODevelopmentDocsService(),
        createTealCompilerService(),
        createAOLiteTestService({} as any, mockProcessService),
        createPermawebDeployService(),
        createTealWorkflowService({} as any, mockProcessService),
        mockProcessService,
        createAIMemoryService(),
      );

    const aoliteTestResults = {
      summary: {
        coveragePercentage: 95,
        failed: 0,
        passed: 5,
        total: 5,
      },
    };

    const processSource = "Handlers.add('test', function() end)";

    const deploymentConfiguration = {
      network: "testnet" as const,
      qualityGates: {
        coverageThreshold: 80,
        requireAllTests: true,
        testPassRate: 100,
      },
      rollbackEnabled: true,
      validationSteps: ["Info"],
    };

    const result =
      await pipelineServiceWithFailedValidation.executeDeploymentPipeline(
        aoliteTestResults,
        processSource,
        mockKeyPair,
        deploymentConfiguration,
      );

    expect(result).toMatchObject({
      deploymentValidation: {
        finalStatus: "rolled-back",
        rollbackPerformed: true,
      },
      processId: "test-process-id-123",
      status: "failed",
    });

    expect(result.deploymentValidation.validationResults[0].status).toBe(
      "failed",
    );
  });
});
