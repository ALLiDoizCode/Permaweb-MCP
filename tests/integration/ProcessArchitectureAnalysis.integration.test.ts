import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermawebDocsResult } from "../../src/services/PermawebDocsService.js";

import { ArchitectureDecisionService } from "../../src/services/ArchitectureDecisionService.js";
import { ArchitectureExplanationService } from "../../src/services/ArchitectureExplanationService.js";
import { ArchitectureValidationService } from "../../src/services/ArchitectureValidationService.js";
import { ErrorHandlingPatternService } from "../../src/services/ErrorHandlingPatternService.js";
import { HandlerPatternRecommendationService } from "../../src/services/HandlerPatternRecommendationService.js";
import { PermawebDocs } from "../../src/services/PermawebDocsService.js";
import { ProcessArchitectureAnalysisService } from "../../src/services/ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "../../src/services/RequirementAnalysisService.js";
import { StateManagementGuidanceService } from "../../src/services/StateManagementGuidanceService.js";

// Mock external dependencies
vi.mock("../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

describe("Process Architecture Analysis Integration", () => {
  let permawebDocsService: PermawebDocs;
  let requirementAnalysisService: RequirementAnalysisService;
  let architectureAnalysisService: ProcessArchitectureAnalysisService;
  let architectureDecisionService: ArchitectureDecisionService;
  let handlerPatternService: HandlerPatternRecommendationService;
  let stateManagementService: StateManagementGuidanceService;
  let errorHandlingService: ErrorHandlingPatternService;
  let validationService: ArchitectureValidationService;
  let explanationService: ArchitectureExplanationService;

  beforeEach(() => {
    vi.clearAllMocks();

    permawebDocsService = new PermawebDocs();
    requirementAnalysisService = new RequirementAnalysisService();

    architectureAnalysisService = new ProcessArchitectureAnalysisService(
      permawebDocsService,
      requirementAnalysisService,
    );

    architectureDecisionService = new ArchitectureDecisionService(
      architectureAnalysisService,
      requirementAnalysisService,
    );

    handlerPatternService = new HandlerPatternRecommendationService(
      permawebDocsService,
      requirementAnalysisService,
    );

    stateManagementService = new StateManagementGuidanceService(
      permawebDocsService,
    );

    errorHandlingService = new ErrorHandlingPatternService(permawebDocsService);

    validationService = new ArchitectureValidationService(permawebDocsService);

    explanationService = new ArchitectureExplanationService(
      permawebDocsService,
    );
  });

  describe("End-to-end architecture analysis workflow", () => {
    it("should complete full analysis workflow for token contract", async () => {
      // Mock documentation results
      const mockTokenDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract Implementation Guide
          
          This guide shows how to implement a token contract in AO.
          
          ## State Management
          local state = {
            balances = {},
            totalSupply = 1000000,
            name = "MyToken",
            symbol = "MTK"
          }
          
          ## Transfer Handler
          Handlers.add("transfer", function(msg)
            local amount = tonumber(msg.Tags.Amount)
            local recipient = msg.Tags.Recipient
            
            if not amount or amount <= 0 then
              return { error = "Invalid amount" }
            end
            
            if state.balances[msg.From] < amount then
              return { error = "Insufficient balance" }
            end
            
            state.balances[msg.From] = state.balances[msg.From] - amount
            state.balances[recipient] = (state.balances[recipient] or 0) + amount
            
            return { success = true, message = "Transfer completed" }
          end)
          
          ## Balance Query Handler
          Handlers.add("balance", function(msg)
            local target = msg.Tags.Target or msg.From
            return { balance = state.balances[target] or 0 }
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.95,
          url: "https://ao-cookbook.com/token-contract",
        },
        {
          content: `# Error Handling Best Practices
          
          ## Input Validation
          Always validate inputs before processing:
          
          if not msg.Tags.Amount then
            return { error = "Amount is required" }
          end
          
          ## Protected Execution
          local success, result = pcall(function()
            return dangerousOperation(msg)
          end)
          
          if not success then
            return { error = "Operation failed: " .. tostring(result) }
          end`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://ao-cookbook.com/error-handling",
        },
      ];

      // Mock the query method
      vi.spyOn(permawebDocsService, "query").mockResolvedValue(mockTokenDocs);

      // Step 1: Analyze requirements
      const userRequest =
        "Create a token contract with transfer and balance query capabilities";
      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);

      expect(requirements.processType).toBe("stateful");
      expect(requirements.detectedPatterns).toContain("token-contract");
      expect(requirements.complexity).toBe("complex");

      // Step 2: Analyze architectural patterns
      const patternAnalysis =
        await architectureAnalysisService.analyzeArchitecturalPatterns(
          userRequest,
        );

      expect(patternAnalysis.patterns.length).toBeGreaterThan(0); // At least one pattern found
      expect(patternAnalysis.patterns[0].processType).toBe("stateful");
      expect(patternAnalysis.processTypes.stateful).toBeDefined();
      expect(patternAnalysis.documentationCoverage[0].domain).toBe("ao");

      // Step 3: Generate architecture recommendation
      const architectureRecommendation =
        await architectureDecisionService.generateArchitectureRecommendation(
          requirements,
          patternAnalysis,
        );

      expect(architectureRecommendation.recommendedApproach.processType).toBe(
        "stateful",
      );
      expect(architectureRecommendation.recommendedApproach.complexity).toBe(
        "complex",
      );
      expect(architectureRecommendation.confidence).toBeGreaterThan(0.5);

      // Step 4: Add handler recommendations
      const messagePatterns =
        await handlerPatternService.analyzeMessagePatterns(mockTokenDocs);

      expect(messagePatterns.messageTypes.length).toBeGreaterThan(0);
      expect(messagePatterns.messageTypes.map((mt) => mt.type)).toContain(
        "transfer",
      );
      expect(messagePatterns.messageTypes.map((mt) => mt.type)).toContain(
        "balance",
      );

      const handlerStructure =
        await handlerPatternService.recommendHandlerStructure(
          messagePatterns,
          requirements,
        );

      expect(handlerStructure.structure.primary.length).toBeGreaterThan(0);
      expect(handlerStructure.structure.primary[0].name).toContain("Handler");

      // Step 5: Add state management guidance
      const stateGuidance =
        await stateManagementService.generateStateManagementGuidance(
          requirements,
          "stateful",
        );

      expect(stateGuidance.recommended).toBe("mutable");
      expect(stateGuidance.bestPractices.length).toBeGreaterThan(0);

      // Step 6: Add error handling patterns
      const errorPatterns =
        await errorHandlingService.generateErrorHandlingPatterns(
          requirements,
          "stateful",
        );

      expect(errorPatterns.length).toBeGreaterThan(0);
      expect(errorPatterns[0].name).toBe("Basic Input Validation");

      // Step 7: Validate architecture
      const similarPatterns = await validationService.findSimilarPatterns(
        architectureRecommendation,
        mockTokenDocs,
      );

      expect(similarPatterns.matches.length).toBeGreaterThan(0);

      const architectureScore = await validationService.scoreArchitectureMatch(
        architectureRecommendation,
        similarPatterns,
      );

      expect(architectureScore.overall).toBeGreaterThan(0.5);

      const bestPracticeValidation =
        await validationService.validateBestPractices(
          architectureRecommendation,
        );

      expect(bestPracticeValidation.passed.length).toBeGreaterThan(0);

      const validationReport = await validationService.generateValidationReport(
        architectureScore,
        bestPracticeValidation,
        architectureRecommendation,
      );

      expect(validationReport.summary).toContain("%");

      // Step 8: Generate comprehensive explanation
      const explanation =
        await explanationService.generateArchitectureExplanation(
          architectureRecommendation,
          requirements,
          validationReport,
        );

      expect(explanation.overview).toContain("stateful");
      expect(explanation.reasoning.processTypeReasoning).toContain(
        "token balance management",
      );
      expect(explanation.bestPractices.length).toBeGreaterThan(0);
      expect(explanation.implementationGuidance).toContain(
        "Implementation Guidance",
      );

      // Verify end-to-end integration
      expect(explanation.documentationCitations.length).toBeGreaterThan(0);
      expect(explanation.relatedPatterns).toContain(
        "stateful-process-patterns",
      );
    });

    it("should handle simple stateless calculator workflow", async () => {
      const mockCalcDocs: PermawebDocsResult[] = [
        {
          content: `# Simple Calculator
          
          Handlers.add("calculate", function(msg)
            local operation = msg.Tags.Operation
            local a = tonumber(msg.Tags.A)
            local b = tonumber(msg.Tags.B)
            
            if not a or not b then
              return { error = "Invalid numbers" }
            end
            
            if operation == "add" then
              return { result = a + b }
            elseif operation == "subtract" then
              return { result = a - b }
            else
              return { error = "Unknown operation" }
            end
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://ao-cookbook.com/calculator",
        },
      ];

      vi.spyOn(permawebDocsService, "query").mockResolvedValue(mockCalcDocs);

      const userRequest =
        "Create a simple calculator service for basic math operations";

      // Run through the workflow
      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);
      const patternAnalysis =
        await architectureAnalysisService.analyzeArchitecturalPatterns(
          userRequest,
        );
      const recommendation =
        await architectureDecisionService.generateArchitectureRecommendation(
          requirements,
          patternAnalysis,
        );

      expect(requirements.processType).toBe("stateless");
      expect(requirements.complexity).toBe("simple");
      expect(recommendation.recommendedApproach.processType).toBe("stateless");

      const stateGuidance =
        await stateManagementService.generateStateManagementGuidance(
          requirements,
          "stateless",
        );

      expect(stateGuidance.recommended).toBe("none");

      const explanation =
        await explanationService.generateArchitectureExplanation(
          recommendation,
          requirements,
        );

      expect(explanation.reasoning.stateManagementReasoning).toContain(
        "No state management needed",
      );
    });

    it("should handle complex multi-process workflow", async () => {
      const mockDistributedDocs: PermawebDocsResult[] = [
        {
          content: `# Multi-Process System
          
          This example shows a distributed system with multiple processes.
          
          ## Process Coordinator
          local processes = {}
          
          Handlers.add("spawn-worker", function(msg)
            local workerId = ao.spawn({
              module = workerModule,
              scheduler = scheduler
            })
            
            processes[workerId] = {
              status = "active",
              created = os.time()
            }
            
            ao.send({
              Target = workerId,
              Action = "Initialize",
              Data = msg.Data
            })
          end)
          
          ## Inter-Process Communication
          Handlers.add("coordinate", function(msg)
            for processId, info in pairs(processes) do
              if info.status == "active" then
                ao.send({
                  Target = processId,
                  Action = "ProcessTask",
                  Data = msg.Data
                })
              end
            end
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://ao-cookbook.com/multi-process",
        },
      ];

      vi.spyOn(permawebDocsService, "query").mockResolvedValue(
        mockDistributedDocs,
      );

      const userRequest =
        "Create a distributed system with multiple communicating processes for parallel task processing";

      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);
      const patternAnalysis =
        await architectureAnalysisService.analyzeArchitecturalPatterns(
          userRequest,
        );
      const recommendation =
        await architectureDecisionService.generateArchitectureRecommendation(
          requirements,
          patternAnalysis,
        );

      expect(requirements.processType).toBe("multi-process");
      expect(requirements.complexity).toBe("complex");
      expect(recommendation.recommendedApproach.processType).toBe(
        "multi-process",
      );

      const errorPatterns =
        await errorHandlingService.generateErrorHandlingPatterns(
          requirements,
          "multi-process",
        );

      // Should include circuit breaker and retry patterns for complex multi-process
      expect(errorPatterns.map((p) => p.name)).toContain(
        "Circuit Breaker Pattern",
      );
      expect(errorPatterns.map((p) => p.name)).toContain(
        "Retry with Exponential Backoff",
      );

      const stateGuidance =
        await stateManagementService.generateStateManagementGuidance(
          requirements,
          "multi-process",
        );

      expect(stateGuidance.recommended).toBe("external");
    });
  });

  describe("Service integration and data flow", () => {
    it("should maintain data consistency across services", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content:
            "# Test Process\nlocal state = {}\nHandlers.add('test', function(msg) end)",
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.7,
          url: "test.com",
        },
      ];

      vi.spyOn(permawebDocsService, "query").mockResolvedValue(mockDocs);

      const userRequest = "Create a test process";
      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);

      // Ensure all services receive the same requirements
      const stateGuidance =
        await stateManagementService.generateStateManagementGuidance(
          requirements,
          requirements.processType,
        );

      const errorPatterns =
        await errorHandlingService.generateErrorHandlingPatterns(
          requirements,
          requirements.processType,
        );

      // Verify consistency
      expect(requirements.processType).toBeDefined();
      expect(requirements.complexity).toBeDefined();

      // State guidance should align with process type
      if (requirements.processType === "stateless") {
        expect(stateGuidance.recommended).toBe("none");
      } else {
        expect(stateGuidance.recommended).not.toBe("none");
      }

      // Error patterns should include basic validation
      expect(errorPatterns.map((p) => p.name)).toContain(
        "Basic Input Validation",
      );
    });

    it("should handle empty or minimal documentation gracefully", async () => {
      vi.spyOn(permawebDocsService, "query").mockResolvedValue([]);

      const userRequest = "Create a process with no documentation available";

      // All services should handle empty documentation gracefully
      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);
      const patternAnalysis =
        await architectureAnalysisService.analyzeArchitecturalPatterns(
          userRequest,
        );
      const recommendation =
        await architectureDecisionService.generateArchitectureRecommendation(
          requirements,
          patternAnalysis,
        );

      expect(requirements).toBeDefined();
      expect(patternAnalysis.patterns).toEqual([]);
      expect(recommendation).toBeDefined();
      expect(recommendation.confidence).toBeLessThan(1.0); // Should reflect uncertainty
    });

    it("should validate cross-service recommendations", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content:
            "# Stateful Process\nlocal state = {data = {}}\nHandlers.add('update', function(msg) state.data = msg.Data end)",
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "test.com",
        },
      ];

      vi.spyOn(permawebDocsService, "query").mockResolvedValue(mockDocs);

      const userRequest = "Create a stateful data management process";
      const requirements =
        await requirementAnalysisService.analyzeRequirements(userRequest);

      // Requirements should detect stateful nature
      expect(requirements.processType).toBe("stateful");

      const stateGuidance =
        await stateManagementService.generateStateManagementGuidance(
          requirements,
          requirements.processType,
        );

      // State guidance should recommend appropriate management for stateful process
      expect(stateGuidance.recommended).not.toBe("none");

      const validation = stateGuidance.alternatives.includes("none");
      expect(validation).toBe(true); // Should include stateless as alternative
    });
  });
});
