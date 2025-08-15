import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { DeployProcessCommand } from "../../../../src/tools/process/commands/DeployProcessCommand.js";
import { RollbackDeploymentCommand } from "../../../../src/tools/process/commands/RollbackDeploymentCommand.js";
import { ValidateDeploymentCommand } from "../../../../src/tools/process/commands/ValidateDeploymentCommand.js";

// Mock all external dependencies
vi.mock("../../../../src/services/AODevelopmentPipelineService.js", () => ({
  createAODevelopmentPipelineService: vi.fn(() => ({
    executeDeploymentPipeline: vi.fn(),
    rollbackDeployment: vi.fn(),
    validateDeployment: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/AODevelopmentDocsService.js", () => ({
  createAODevelopmentDocsService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/TealCompilerService.js", () => ({
  createTealCompilerService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/AOLiteTestService.js", () => ({
  createAOLiteTestService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/PermawebDeployService.js", () => ({
  createPermawebDeployService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/TealWorkflowService.js", () => ({
  createTealWorkflowService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/ProcessCommunicationService.js", () => ({
  createProcessCommunicationService: vi.fn(() => ({})),
}));

vi.mock("../../../../src/services/AIMemoryService.js", () => ({
  createAIMemoryService: vi.fn(() => ({})),
}));

// Mock the AutoSafeToolContext
vi.mock("../../../../src/tools/core/index.js", async () => {
  const actual = (await vi.importActual(
    "../../../../src/tools/core/index.js",
  )) as any;
  return {
    ...actual,
    AutoSafeToolContext: {
      from: vi.fn(() => ({
        getHubId: vi.fn().mockResolvedValue("test-hub-id"),
        getKeyPair: vi.fn().mockResolvedValue({
          d: "test-private-key",
          dp: "test-dp",
          dq: "test-dq",
          e: "AQAB",
          kty: "RSA",
          n: "test-key-data",
          p: "test-p",
          q: "test-q",
          qi: "test-qi",
        }),
      })),
    },
  };
});

describe("DeployProcessCommand", () => {
  let command: DeployProcessCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
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

    mockContext = {
      aoMessageService: {
        getHubId: vi.fn().mockResolvedValue("test-hub-id"),
        getKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
        getUserPublicKey: vi.fn().mockResolvedValue("test-public-key"),
        initializeHub: vi.fn().mockResolvedValue(true),
      } as any,
      hubId: "test-hub-id",
      keyPair: mockKeyPair,
    };

    command = new DeployProcessCommand(mockContext);
  });

  it("should create deployment command with correct metadata", () => {
    expect(command["metadata"].name).toBe("deployProcess");
    expect(command["metadata"].description).toContain("deployment pipeline");
    expect(command["metadata"].readOnlyHint).toBe(false);
  });

  it("should execute successful deployment pipeline", async () => {
    const mockDeploymentResults = {
      deploymentRecords: {
        memoryStorageId: "memory-123",
      },
      deploymentValidation: {
        finalStatus: "validated",
        rollbackPerformed: false,
        validationResults: [{ status: "passed", test: "Info" }],
      },
      duration: 5000,
      processId: "test-process-id",
      status: "completed",
    };

    // Mock the pipeline service method
    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      executeDeploymentPipeline: vi
        .fn()
        .mockResolvedValue(mockDeploymentResults),
    } as any);

    const args = {
      aoliteTestResults: {
        summary: { coveragePercentage: 90, passed: 5, total: 5 },
      },
      deploymentConfiguration: {
        network: "testnet" as const,
        rollbackEnabled: true,
        validationSteps: ["Info"],
      },
      processSource: "Handlers.add('info', function() end)",
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.processId).toBe("test-process-id");
    expect(parsedResult.deploymentStatus).toBe("validated");
    expect(parsedResult.rollbackPerformed).toBe(false);
  });

  it("should handle deployment pipeline failure", async () => {
    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      executeDeploymentPipeline: vi
        .fn()
        .mockRejectedValue(new Error("Deployment failed")),
    } as any);

    const args = {
      aoliteTestResults: {},
      processSource: "invalid lua code",
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain("Deployment failed");
  });

  it("should validate deployment configuration parameters", () => {
    const schema = command["parametersSchema"];

    // Valid configuration should pass
    const validConfig = {
      aoliteTestResults: { summary: { passed: 5, total: 5 } },
      deploymentConfiguration: {
        network: "testnet",
        qualityGates: {
          coverageThreshold: 80,
          testPassRate: 100,
        },
        rollbackEnabled: true,
        validationSteps: ["Info", "Ping"],
      },
      processSource: "test lua code",
    };

    expect(() => schema.parse(validConfig)).not.toThrow();

    // Invalid network should fail
    const invalidConfig = {
      aoliteTestResults: {},
      deploymentConfiguration: {
        network: "invalid-network",
      },
      processSource: "test lua code",
    };

    expect(() => schema.parse(invalidConfig)).toThrow();
  });
});

describe("ValidateDeploymentCommand", () => {
  let command: ValidateDeploymentCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      aoMessageService: {
        getKeyPair: vi.fn().mockResolvedValue({}),
      } as any,
      hubId: "test-hub-id",
      keyPair: {} as JWKInterface,
    };

    command = new ValidateDeploymentCommand(mockContext);
  });

  it("should execute successful validation", async () => {
    const mockValidationResult = {
      duration: 3000,
      overallStatus: "passed",
      processId: "test-process-id",
      validationResults: [
        { result: { data: "success" }, status: "passed", test: "Info" },
        { result: { data: "pong" }, status: "passed", test: "Ping" },
      ],
    };

    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      validateDeployment: vi.fn().mockResolvedValue(mockValidationResult),
    } as any);

    const args = {
      processId: "test-process-id",
      timeout: 30000,
      validationTests: ["Info", "Ping"],
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.overallStatus).toBe("passed");
    expect(parsedResult.passedTests).toBe(2);
    expect(parsedResult.failedTests).toBe(0);
  });

  it("should handle validation failure", async () => {
    const mockValidationResult = {
      duration: 2000,
      overallStatus: "failed",
      processId: "test-process-id",
      validationResults: [
        { result: { data: "success" }, status: "passed", test: "Info" },
        { error: "Timeout", result: null, status: "failed", test: "Ping" },
      ],
    };

    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      validateDeployment: vi.fn().mockResolvedValue(mockValidationResult),
    } as any);

    const args = {
      processId: "test-process-id",
      validationTests: ["Info", "Ping"],
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.overallStatus).toBe("failed");
    expect(parsedResult.passedTests).toBe(1);
    expect(parsedResult.failedTests).toBe(1);
  });
});

describe("RollbackDeploymentCommand", () => {
  let command: RollbackDeploymentCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      aoMessageService: {} as any,
    };

    command = new RollbackDeploymentCommand(mockContext);
  });

  it("should execute successful rollback", async () => {
    const mockRollbackResult = {
      preservedData: false,
      processId: "test-process-id",
      reason: "Validation failed",
      rollbackPerformed: true,
      status: "success",
      timestamp: new Date(),
    };

    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      rollbackDeployment: vi.fn().mockResolvedValue(mockRollbackResult),
    } as any);

    const args = {
      preserveData: false,
      processId: "test-process-id",
      reason: "Validation failed",
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.rollbackPerformed).toBe(true);
    expect(parsedResult.reason).toBe("Validation failed");
    expect(parsedResult.status).toBe("success");
  });

  it("should handle rollback failure", async () => {
    const mockPipelineService = await import(
      "../../../../src/services/AODevelopmentPipelineService.js"
    );
    vi.mocked(
      mockPipelineService.createAODevelopmentPipelineService,
    ).mockReturnValue({
      rollbackDeployment: vi
        .fn()
        .mockRejectedValue(new Error("Rollback failed")),
    } as any);

    const args = {
      processId: "test-process-id",
      reason: "Test rollback",
    };

    const result = await command.execute(args);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain("Rollback failed");
  });

  it("should validate required parameters", () => {
    const schema = command["parametersSchema"];

    // Valid parameters should pass
    const validArgs = {
      preserveData: true,
      processId: "test-process-id",
      reason: "Test reason",
    };

    expect(() => schema.parse(validArgs)).not.toThrow();

    // Missing required fields should fail
    const invalidArgs = {
      processId: "test-process-id",
      // Missing reason
    };

    expect(() => schema.parse(invalidArgs)).toThrow();
  });
});
