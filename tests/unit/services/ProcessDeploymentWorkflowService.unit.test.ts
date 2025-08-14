import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuidedProcessCreationService } from "../../../src/services/GuidedProcessCreationService.js";
import { ProcessDeploymentWorkflowService } from "../../../src/services/ProcessDeploymentWorkflowService.js";
import { ProcessRefinementService } from "../../../src/services/ProcessRefinementService.js";
import { ProcessValidationService } from "../../../src/services/ProcessValidationService.js";

// Mock the services
vi.mock("../../../src/services/GuidedProcessCreationService.js");
vi.mock("../../../src/services/ProcessValidationService.js");
vi.mock("../../../src/services/ProcessRefinementService.js");

describe("ProcessDeploymentWorkflowService", () => {
  let service: ProcessDeploymentWorkflowService;
  let mockGuidedCreationService: any;
  let mockValidationService: any;
  let mockRefinementService: any;
  let mockKeyPair: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGuidedCreationService = {
      analyzeRequirements: vi.fn(),
      createGuidedProcess: vi.fn(),
      generateProcessCode: vi.fn(),
      luaWorkflowService: {
        queryRelevantDocs: vi.fn(),
      },
    };

    mockValidationService = {
      validateProcess: vi.fn(),
    };

    mockRefinementService = {
      refineProcess: vi.fn(),
    };

    mockKeyPair = {
      /* mock keyPair object */
    };

    service = new ProcessDeploymentWorkflowService(
      mockGuidedCreationService,
      mockValidationService,
      mockRefinementService,
    );
  });

  describe("executeFullWorkflow", () => {
    it("should execute complete workflow successfully", async () => {
      const userRequest = "Create a token process";

      const mockRequirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract" as const],
        extractedKeywords: ["create", "token", "process"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest,
      };

      const mockProcessCode = {
        bestPractices: [],
        deploymentInstructions: [],
        documentationSources: [],
        explanation: "Test explanation",
        generatedCode: "test code",
        handlerPatterns: [],
        processStructure: {
          handlers: [
            {
              handleFunction: "function(msg) return '0' end",
              matchCriteria:
                'Handlers.utils.hasMatchingTag("Action", "Balance")',
              name: "balance",
            },
          ],
          initializationCode: "",
          stateDefinition: "local State = {}",
          utilityFunctions: [],
        },
        templateUsed: "token" as const,
        testCases: [],
        usedTemplates: [],
      };

      const mockGuidedResult = {
        deploymentResult: {
          deployedHandlers: mockProcessCode.processStructure.handlers,
          processId: "test-process-id",
          success: true,
          timestamp: new Date(),
        },
        processCode: mockProcessCode,
        processId: "test-process-id",
        success: true,
        validationResults: [
          {
            passed: true,
            testCase: "basic_responsiveness",
            testResult: "Process is responsive",
          },
        ],
      };

      const mockValidationResults = [
        {
          passed: true,
          testCase: "handler_registration",
          testResult: "Handler registered successfully",
        },
      ];

      // Setup mocks
      mockGuidedCreationService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );
      mockGuidedCreationService.createGuidedProcess.mockResolvedValue(
        mockGuidedResult,
      );
      mockValidationService.validateProcess.mockResolvedValue(
        mockValidationResults,
      );

      const result = await service.executeFullWorkflow(
        userRequest,
        mockKeyPair,
      );

      expect(result.success).toBe(true);
      expect(result.processId).toBe("test-process-id");
      expect(result.deploymentReport).toBeDefined();
      expect(result.deploymentReport.summary).toContain(
        "Successfully deployed process",
      );
      expect(result.validationResults).toEqual(
        mockGuidedResult.validationResults,
      );
    });

    it("should handle workflow failures gracefully", async () => {
      const userRequest = "Create a broken process";

      mockGuidedCreationService.analyzeRequirements.mockRejectedValue(
        new Error("Analysis failed"),
      );

      const result = await service.executeFullWorkflow(
        userRequest,
        mockKeyPair,
      );

      expect(result.success).toBe(false);
      expect(result.deploymentReport.deployment.status).toBe("failed");
      expect(result.deploymentReport.summary).toContain("Workflow failed");
    });
  });

  describe("executeWorkflowStep", () => {
    it("should execute analyze step successfully", async () => {
      const mockRequirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["test"],
        processType: "stateless" as const,
        suggestedDomains: [],
        userRequest: "test request",
      };

      mockGuidedCreationService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );

      const context = {
        currentStep: "analyze" as const,
        requirements: {} as any,
        stepHistory: [],
      };

      const result = await service.executeWorkflowStep("analyze", context, {
        userRequest: "test request",
      });

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe("generate");
      expect(result.data).toEqual(mockRequirements);
    });

    it("should execute generate step successfully", async () => {
      const mockProcessCode = {
        bestPractices: [],
        deploymentInstructions: [],
        documentationSources: [],
        explanation: "",
        generatedCode: "test code",
        handlerPatterns: [],
        processStructure: {
          handlers: [],
          initializationCode: "",
          stateDefinition: "",
          utilityFunctions: [],
        },
        templateUsed: "custom" as const,
        testCases: [],
        usedTemplates: [],
      };

      const mockDocs = [
        {
          content: "test content",
          domain: "arweave",
          lastUpdated: new Date(),
          title: "Test Doc",
          url: "https://example.com",
        },
      ];

      const mockRequirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["test"],
        processType: "stateless" as const,
        suggestedDomains: [],
        userRequest: "test request",
      };

      // Access the workflow service through any to avoid private property access
      (
        mockGuidedCreationService as any
      ).luaWorkflowService.queryRelevantDocs.mockResolvedValue(mockDocs);
      mockGuidedCreationService.generateProcessCode.mockResolvedValue(
        mockProcessCode,
      );

      const context = {
        currentStep: "generate" as const,
        requirements: mockRequirements,
        stepHistory: ["analyze"],
      };

      const result = await service.executeWorkflowStep("generate", context);

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe("deploy");
      expect(result.data).toEqual(mockProcessCode);
    });

    it("should execute deploy step successfully", async () => {
      const mockGuidedResult = {
        deploymentResult: {
          deployedHandlers: [],
          processId: "test-process-id",
          success: true,
          timestamp: new Date(),
        },
        processCode: {} as any,
        processId: "test-process-id",
        success: true,
        validationResults: [],
      };

      mockGuidedCreationService.createGuidedProcess.mockResolvedValue(
        mockGuidedResult,
      );

      const context = {
        currentStep: "deploy" as const,
        requirements: { userRequest: "test" } as any,
        stepHistory: ["analyze", "generate"],
      };

      const result = await service.executeWorkflowStep("deploy", context, {
        keyPair: mockKeyPair,
      });

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe("validate");
      expect(result.data).toEqual(mockGuidedResult);
    });

    it("should execute validate step successfully", async () => {
      const mockValidationResults = [
        {
          passed: true,
          testCase: "test_case",
          testResult: "Test passed",
        },
      ];

      mockValidationService.validateProcess.mockResolvedValue(
        mockValidationResults,
      );

      const context = {
        currentStep: "validate" as const,
        requirements: {} as any,
        stepHistory: ["analyze", "generate", "deploy"],
      };

      const mockGuidedResult = {
        processCode: {
          processStructure: { handlers: [] },
        },
        processId: "test-process-id",
      };

      const result = await service.executeWorkflowStep("validate", context, {
        guidedResult: mockGuidedResult,
        keyPair: mockKeyPair,
      });

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe("verify");
      expect(result.data).toEqual(mockValidationResults);
    });

    it("should execute verify step successfully", async () => {
      const mockValidationResults = [
        { passed: true, testCase: "test1", testResult: "Passed" },
        { passed: true, testCase: "test2", testResult: "Passed" },
      ];

      const context = {
        currentStep: "verify" as const,
        requirements: {} as any,
        stepHistory: ["analyze", "generate", "deploy", "validate"],
      };

      const result = await service.executeWorkflowStep("verify", context, {
        validationResults: mockValidationResults,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ verified: true });
    });

    it("should handle unknown workflow step", async () => {
      const context = {
        currentStep: "unknown" as any,
        requirements: {} as any,
        stepHistory: [],
      };

      const result = await service.executeWorkflowStep(
        "unknown" as any,
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown workflow step: unknown");
    });
  });

  describe("generateWorkflowReport", () => {
    it("should generate comprehensive deployment report", async () => {
      const workflowResult = {
        completedSteps: [
          "analyze",
          "generate",
          "deploy",
          "validate",
          "verify",
        ] as any[],
        finalResult: {
          processCode: {
            bestPractices: ["Practice 1", "Practice 2"],
            documentationSources: ["source1", "source2"],
          },
          validationResults: [
            { passed: true, testCase: "test1", testResult: "Passed" },
            { passed: false, testCase: "test2", testResult: "Failed" },
          ],
        },
        processId: "test-process-id",
        success: true,
        timestamp: new Date(),
      };

      const report = await service.generateWorkflowReport(workflowResult);

      expect(report.deployment.processId).toBe("test-process-id");
      expect(report.deployment.status).toBe("success");
      expect(report.validation.totalTests).toBe(2);
      expect(report.validation.passedTests).toBe(1);
      expect(report.codeQuality.bestPracticesFollowed).toEqual([
        "Practice 1",
        "Practice 2",
      ]);
      expect(report.summary).toContain("Successfully deployed process");
    });

    it("should handle failed workflow in report", async () => {
      const workflowResult = {
        completedSteps: ["analyze"] as any[],
        error: "Deployment failed",
        finalResult: {
          processCode: { bestPractices: [], documentationSources: [] },
          validationResults: [],
        },
        processId: "",
        success: false,
        timestamp: new Date(),
      };

      const report = await service.generateWorkflowReport(workflowResult);

      expect(report.deployment.status).toBe("failed");
      expect(report.summary).toContain("Failed to deploy process");
    });
  });

  describe("handleWorkflowError", () => {
    it("should recommend stop for analysis errors", async () => {
      const workflowError = {
        context: {
          currentStep: "analyze" as const,
          requirements: {} as any,
          stepHistory: [],
        },
        error: "Analysis failed",
        step: "analyze" as const,
      };

      const recovery = await service.handleWorkflowError(
        workflowError,
        workflowError.context,
      );

      expect(recovery.recoveryAction).toBe("stop");
    });

    it("should recommend retry for generation errors", async () => {
      const workflowError = {
        context: {
          currentStep: "generate" as const,
          requirements: {} as any,
          stepHistory: [],
        },
        error: "Generation failed",
        step: "generate" as const,
      };

      const recovery = await service.handleWorkflowError(
        workflowError,
        workflowError.context,
      );

      expect(recovery.recoveryAction).toBe("retry");
      expect(recovery.retryStep).toBe("generate");
    });

    it("should recommend refinement for validation errors", async () => {
      const workflowError = {
        context: {
          currentStep: "validate" as const,
          requirements: {} as any,
          stepHistory: [],
        },
        error: "Validation failed",
        step: "validate" as const,
      };

      const recovery = await service.handleWorkflowError(
        workflowError,
        workflowError.context,
      );

      expect(recovery.recoveryAction).toBe("retry");
      expect(recovery.retryStep).toBe("refine");
    });

    it("should recommend skip for verification errors", async () => {
      const workflowError = {
        context: {
          currentStep: "verify" as const,
          requirements: {} as any,
          stepHistory: [],
        },
        error: "Verification failed",
        step: "verify" as const,
      };

      const recovery = await service.handleWorkflowError(
        workflowError,
        workflowError.context,
      );

      expect(recovery.recoveryAction).toBe("skip");
    });
  });

  describe("validateAndRefine", () => {
    it("should delegate to refinement service", async () => {
      const mockRefinementResult = {
        improvedCode: {} as any,
        refinementActions: ["Action 1"],
        success: true,
        validationResults: [],
      };

      mockRefinementService.refineProcess.mockResolvedValue(
        mockRefinementResult,
      );

      const result = await service.validateAndRefine(
        mockKeyPair,
        "test-process-id",
        [],
      );

      expect(mockRefinementService.refineProcess).toHaveBeenCalledWith(
        mockKeyPair,
        "test-process-id",
        [],
      );
      expect(result).toEqual(mockRefinementResult);
    });
  });
});
