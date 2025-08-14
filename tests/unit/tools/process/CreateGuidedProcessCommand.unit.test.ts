import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { CreateGuidedProcessCommand } from "../../../../src/tools/process/commands/CreateGuidedProcessCommand.js";

// Mock the services
vi.mock("../../../../src/services/GuidedProcessCreationService.js");
vi.mock("../../../../src/services/ProcessDeploymentWorkflowService.js");

describe("CreateGuidedProcessCommand", () => {
  let command: CreateGuidedProcessCommand;
  let mockContext: ToolContext;
  let mockWorkflowService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hub: {
        /* mock hub */
      },
      keyPair: {
        /* mock keyPair */
      },
    } as any;

    // Mock the workflow service that will be created in the command
    mockWorkflowService = {
      executeFullWorkflow: vi.fn(),
    };

    command = new CreateGuidedProcessCommand(mockContext);

    // Replace the workflow service with our mock
    (command as any).workflowService = mockWorkflowService;
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(command.metadata.name).toBe("createGuidedProcess");
      expect(command.metadata.title).toBe(
        "Create Guided AO Process with Documentation",
      );
      expect(command.metadata.description).toContain(
        "Create, deploy, and test AO process",
      );
    });
  });

  describe("parameter validation", () => {
    it("should validate required userRequest parameter", () => {
      const schema = command.parametersSchema;

      // Test valid parameters
      const validParams = {
        allowRefinement: true,
        includeTesting: true,
        processType: "token" as const,
        userRequest: "Create a token process",
      };

      expect(() => schema.parse(validParams)).not.toThrow();

      // Test missing userRequest
      const invalidParams = {
        processType: "token" as const,
      };

      expect(() => schema.parse(invalidParams)).toThrow();
    });

    it("should validate processType enum values", () => {
      const schema = command.parametersSchema;

      const validParams = {
        processType: "chatroom" as const,
        userRequest: "Create a process",
      };

      expect(() => schema.parse(validParams)).not.toThrow();

      // Test invalid process type
      const invalidParams = {
        processType: "invalid-type",
        userRequest: "Create a process",
      };

      expect(() => schema.parse(invalidParams)).toThrow();
    });

    it("should allow optional parameters with defaults", () => {
      const schema = command.parametersSchema;

      const minimalParams = {
        userRequest: "Create a simple process",
      };

      const parsed = schema.parse(minimalParams);

      expect(parsed.includeTesting).toBe(true); // default value
      expect(parsed.allowRefinement).toBe(true); // default value
      expect(parsed.processType).toBeUndefined();
    });
  });

  describe("execute", () => {
    it("should execute successful workflow and return formatted response", async () => {
      const mockDeploymentResult = {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: ["Practice 1"],
            documentationCoverage: 0.8,
            testCoverage: 1.0,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: "test-process-id",
            status: "success" as const,
          },
          performance: {
            generationTimeMs: 1000,
            totalWorkflowTimeMs: 2000,
            validationTimeMs: 500,
          },
          summary: "Process deployed successfully",
          validation: {
            passedTests: 2,
            testResults: [],
            totalTests: 2,
          },
        },
        processCode: {
          bestPractices: ["Practice 1", "Practice 2"],
          deploymentInstructions: ["Step 1", "Step 2"],
          explanation: "This is a test process",
          generatedCode: "test lua code",
          templateUsed: "token" as const,
          testCases: [
            {
              description: "Test balance handler",
              expectedBehavior: "Should return balance",
              testCode: "return '0'",
            },
          ],
        },
        processId: "test-process-id",
        success: true,
        validationResults: [
          {
            passed: true,
            testCase: "handler_registration",
            testResult: "Handler registered successfully",
          },
          {
            passed: true,
            testCase: "basic_responsiveness",
            testResult: "Process is responsive",
          },
        ],
      };

      mockWorkflowService.executeFullWorkflow.mockResolvedValue(
        mockDeploymentResult,
      );

      const args = {
        allowRefinement: true,
        includeTesting: true,
        processType: "token" as const,
        userRequest: "Create a token process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(mockWorkflowService.executeFullWorkflow).toHaveBeenCalledWith(
        args.userRequest,
        mockContext.keyPair,
      );

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.processId).toBe("test-process-id");
      expect(parsedResult.message).toContain(
        "AO process created and deployed successfully",
      );
      expect(parsedResult.message).toContain("(2/2 tests passing)");
      expect(parsedResult.processCode).toBeDefined();
      expect(parsedResult.deploymentReport).toBeDefined();
      expect(parsedResult.validationResults).toHaveLength(2);
    });

    it("should handle failed workflow gracefully", async () => {
      const mockDeploymentResult = {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: [],
            documentationCoverage: 0,
            testCoverage: 0,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: "",
            status: "failed" as const,
          },
          performance: {
            generationTimeMs: 0,
            totalWorkflowTimeMs: 0,
            validationTimeMs: 0,
          },
          summary: "Process deployment failed",
          validation: {
            passedTests: 0,
            testResults: [],
            totalTests: 0,
          },
        },
        processCode: {} as any,
        processId: "",
        success: false,
        validationResults: [],
      };

      mockWorkflowService.executeFullWorkflow.mockResolvedValue(
        mockDeploymentResult,
      );

      const args = {
        userRequest: "Create a broken process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Process creation and deployment failed");
    });

    it("should handle workflow exceptions", async () => {
      mockWorkflowService.executeFullWorkflow.mockRejectedValue(
        new Error("Workflow execution failed"),
      );

      const args = {
        userRequest: "Create a process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Workflow execution failed");
      expect(parsedResult.message).toBe("Failed to create guided AO process");
    });

    it("should include test failure information when allowRefinement is enabled", async () => {
      const mockDeploymentResult = {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: [],
            documentationCoverage: 0,
            testCoverage: 0.5,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: "test-process-id",
            status: "success" as const,
          },
          performance: {
            generationTimeMs: 1000,
            totalWorkflowTimeMs: 1500,
            validationTimeMs: 500,
          },
          summary: "Process deployed with some test failures",
          validation: {
            passedTests: 1,
            testResults: [],
            totalTests: 2,
          },
        },
        processCode: {
          bestPractices: [],
          deploymentInstructions: [],
          explanation: "Test process",
          generatedCode: "test code",
          templateUsed: "custom" as const,
          testCases: [],
        },
        processId: "test-process-id",
        success: true,
        validationResults: [
          {
            passed: true,
            testCase: "test1",
            testResult: "Passed",
          },
          {
            passed: false,
            testCase: "test2",
            testResult: "Failed",
          },
        ],
      };

      mockWorkflowService.executeFullWorkflow.mockResolvedValue(
        mockDeploymentResult,
      );

      const args = {
        allowRefinement: true,
        userRequest: "Create a process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("(1/2 tests passing)");
      expect(parsedResult.message).toContain(
        "Some tests failed - process may benefit from refinement",
      );
    });

    it("should work with minimal parameters", async () => {
      const mockDeploymentResult = {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: [],
            documentationCoverage: 0,
            testCoverage: 0,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: "simple-process-id",
            status: "success" as const,
          },
          performance: {
            generationTimeMs: 500,
            totalWorkflowTimeMs: 600,
            validationTimeMs: 100,
          },
          summary: "Simple process deployed",
          validation: {
            passedTests: 0,
            testResults: [],
            totalTests: 0,
          },
        },
        processCode: {
          bestPractices: [],
          deploymentInstructions: [],
          explanation: "Simple process",
          generatedCode: "simple code",
          templateUsed: "custom" as const,
          testCases: [],
        },
        processId: "simple-process-id",
        success: true,
        validationResults: [],
      };

      mockWorkflowService.executeFullWorkflow.mockResolvedValue(
        mockDeploymentResult,
      );

      const args = {
        userRequest: "Create a simple process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.processId).toBe("simple-process-id");
    });
  });

  describe("response formatting", () => {
    it("should properly format successful response with all fields", async () => {
      const mockDeploymentResult = {
        deploymentReport: {
          codeQuality: {
            bestPracticesFollowed: ["Use proper error handling"],
            documentationCoverage: 0.9,
            testCoverage: 1.0,
          },
          deployment: {
            deploymentTime: new Date(),
            processId: "format-test-id",
            status: "success" as const,
          },
          performance: {
            generationTimeMs: 800,
            totalWorkflowTimeMs: 1000,
            validationTimeMs: 200,
          },
          summary: "Bot process deployed successfully",
          validation: {
            passedTests: 1,
            testResults: [],
            totalTests: 1,
          },
        },
        processCode: {
          bestPractices: ["Use proper error handling"],
          deploymentInstructions: ["Deploy handlers first"],
          explanation: "Bot process explanation",
          generatedCode: "formatted code",
          templateUsed: "bot" as const,
          testCases: [
            {
              description: "Test command handler",
              expectedBehavior: "Should respond to commands",
              testCode: "test code",
            },
          ],
        },
        processId: "format-test-id",
        success: true,
        validationResults: [
          {
            passed: true,
            testCase: "command_test",
            testResult: "Command handler works",
          },
        ],
      };

      mockWorkflowService.executeFullWorkflow.mockResolvedValue(
        mockDeploymentResult,
      );

      const args = {
        includeTesting: true,
        processType: "bot" as const,
        userRequest: "Create a bot process",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      // Verify all expected fields are present and properly formatted
      expect(parsedResult).toHaveProperty("success", true);
      expect(parsedResult).toHaveProperty("processId", "format-test-id");
      expect(parsedResult).toHaveProperty("message");
      expect(parsedResult).toHaveProperty("processCode");
      expect(parsedResult).toHaveProperty("deploymentReport");
      expect(parsedResult).toHaveProperty("validationResults");

      // Verify processCode structure
      expect(parsedResult.processCode).toHaveProperty("bestPractices");
      expect(parsedResult.processCode).toHaveProperty("deploymentInstructions");
      expect(parsedResult.processCode).toHaveProperty("explanation");
      expect(parsedResult.processCode).toHaveProperty("generatedCode");
      expect(parsedResult.processCode).toHaveProperty("templateUsed", "bot");
      expect(parsedResult.processCode).toHaveProperty("testCases");

      // Verify deploymentReport structure
      expect(parsedResult.deploymentReport).toHaveProperty("codeQuality");
      expect(parsedResult.deploymentReport).toHaveProperty("deployment");
      expect(parsedResult.deploymentReport).toHaveProperty("performance");
      expect(parsedResult.deploymentReport).toHaveProperty("summary");
      expect(parsedResult.deploymentReport).toHaveProperty("validation");
    });
  });
});
