import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PermawebDocsResponse,
  PermawebDocsResult,
} from "../../../src/services/PermawebDocsService.js";
import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

import { ErrorHandlingPatternService } from "../../../src/services/ErrorHandlingPatternService.js";
import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";

// Mock the service
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({})),
}));

describe("ErrorHandlingPatternService", () => {
  let service: ErrorHandlingPatternService;
  let mockPermawebDocsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    service = new ErrorHandlingPatternService(mockPermawebDocsService);
  });

  describe("generateErrorHandlingPatterns", () => {
    it("should generate basic validation for simple processes", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculate"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Simple calculator",
      };

      const result = await service.generateErrorHandlingPatterns(
        mockRequirements,
        "stateless",
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Basic Input Validation");
      expect(result[0].complexity).toBe("simple");
      expect(result[0].implementation).toContain("if not msg.Data");
    });

    it("should generate additional patterns for moderate complexity", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "transfer"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract",
      };

      const result = await service.generateErrorHandlingPatterns(
        mockRequirements,
        "stateful",
      );

      expect(result.length).toBeGreaterThan(1);
      expect(result.map((p) => p.name)).toContain("Basic Input Validation");
      expect(result.map((p) => p.name)).toContain("State Validation Pattern");
    });

    it("should generate complex patterns for complex multi-process systems", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication", "message-routing"],
        extractedKeywords: ["distributed", "processes"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Distributed system",
      };

      const result = await service.generateErrorHandlingPatterns(
        mockRequirements,
        "multi-process",
      );

      expect(result.length).toBeGreaterThan(3);
      expect(result.map((p) => p.name)).toContain("Circuit Breaker Pattern");
      expect(result.map((p) => p.name)).toContain(
        "Retry with Exponential Backoff",
      );
      expect(result.map((p) => p.name)).toContain(
        "Comprehensive Error Logging",
      );
    });

    it("should customize implementations based on detected patterns", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token transfer system",
      };

      const result = await service.generateErrorHandlingPatterns(
        mockRequirements,
        "stateful",
      );

      const basicValidation = result.find(
        (p) => p.name === "Basic Input Validation",
      );
      expect(basicValidation?.implementation).toContain("token-contract");
      expect(basicValidation?.implementation).toContain(
        "executeTokenOperation",
      );
    });
  });

  describe("analyzeErrorPatternsFromDocs", () => {
    it("should detect validation patterns in documentation", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract
          Handlers.add("transfer", function(msg)
            if not msg.Data or msg.Data == "" then
              return { error = "Invalid data" }
            end
            
            if not msg.Tags.Amount then
              return { error = "Amount required" }
            end
            
            -- Process transfer
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns.validation).toBe(1);
      expect(result.examples.validation).toHaveLength(1);
      expect(result.examples.validation[0].title).toBe("Token Contract");
    });

    it("should detect try-catch patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Safe Operation
          Handlers.add("process", function(msg)
            local success, result = pcall(function()
              return riskyOperation(msg.Data)
            end)
            
            if not success then
              return { error = "Operation failed" }
            end
            
            return result
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/safe",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns["try-catch"]).toBe(1);
      expect(result.examples["try-catch"]).toHaveLength(1);
    });

    it("should detect logging patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Error Logging System
          local errorLogs = {}
          
          local function logError(context, error)
            table.insert(errorLogs, {
              context = context,
              error = tostring(error),
              timestamp = os.time()
            })
          end
          
          Handlers.add("process", function(msg)
            local success, result = pcall(process)
            if not success then
              logError("Handler:process", result)
            end
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/logging",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns.logging).toBe(1);
      expect(result.examples.logging[0].title).toBe("Error Logging System");
    });

    it("should detect retry patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Retry Mechanism
          local function retryOperation(operation, maxAttempts)
            local attempts = 0
            while attempts < maxAttempts do
              local success, result = pcall(operation)
              if success then
                return result
              end
              attempts = attempts + 1
            end
            error("Max retry attempts exceeded")
          end`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/retry",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns.retry).toBe(1);
      expect(result.examples.retry[0].title).toBe("Retry Mechanism");
    });

    it("should detect circuit breaker patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Circuit Breaker Implementation
          local circuitBreaker = {
            state = "CLOSED",
            failureCount = 0,
            threshold = 5
          }
          
          local function executeWithBreaker(operation)
            if circuitBreaker.state == "OPEN" then
              return { error = "Circuit breaker is open" }
            end
            -- Execute operation
          end`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/circuit",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns["circuit-breaker"]).toBe(1);
      expect(result.examples["circuit-breaker"][0].title).toBe(
        "Circuit Breaker Implementation",
      );
    });

    it("should detect state validation patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# State Validation
          local function validateState(state)
            if not state then
              error("State not initialized")
            end
            if state.balance < 0 then
              error("Invalid negative balance")
            end
          end
          
          Handlers.add("transfer", function(msg)
            validateState(currentState)
            -- Process transfer
            validateState(newState)
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/state-validation",
        },
      ];

      const result = await service.analyzeErrorPatternsFromDocs(mockDocs);

      expect(result.patterns["state-validation"]).toBe(1);
      expect(result.examples["state-validation"][0].title).toBe(
        "State Validation",
      );
    });
  });

  describe("recommendErrorHandlingStrategy", () => {
    it("should recommend appropriate patterns for stateless simple processes", async () => {
      const result = await service.recommendErrorHandlingStrategy(
        "stateless",
        "simple",
        ["handler"],
      );

      expect(result.primary).toHaveLength(1);
      expect(result.primary[0].name).toBe("Basic Input Validation");
      expect(result.secondary).toHaveLength(0);
      expect(result.monitoring).toHaveLength(0);
    });

    it("should recommend patterns for stateful moderate processes", async () => {
      const result = await service.recommendErrorHandlingStrategy(
        "stateful",
        "moderate",
        ["token-contract", "state-management"],
      );

      expect(result.primary).toHaveLength(2);
      expect(result.primary.map((p) => p.name)).toContain(
        "Basic Input Validation",
      );
      expect(result.secondary).toHaveLength(1);
      expect(result.secondary[0].name).toBe("State Validation Pattern");
    });

    it("should recommend comprehensive patterns for complex multi-process systems", async () => {
      const result = await service.recommendErrorHandlingStrategy(
        "multi-process",
        "complex",
        ["process-communication", "distributed"],
      );

      expect(result.primary).toHaveLength(2);
      expect(result.secondary).toHaveLength(2);
      expect(result.secondary.map((p) => p.name)).toContain(
        "Circuit Breaker Pattern",
      );
      expect(result.secondary.map((p) => p.name)).toContain(
        "Retry with Exponential Backoff",
      );
      expect(result.monitoring).toHaveLength(1);
      expect(result.monitoring[0].name).toBe("Comprehensive Error Logging");
    });

    it("should include try-catch for non-simple processes", async () => {
      const moderateResult = await service.recommendErrorHandlingStrategy(
        "stateful",
        "moderate",
        ["token-contract"],
      );

      expect(moderateResult.primary.map((p) => p.name)).toContain(
        "Try-Catch Error Handling",
      );

      const complexResult = await service.recommendErrorHandlingStrategy(
        "multi-process",
        "complex",
        ["distributed"],
      );

      expect(complexResult.primary.map((p) => p.name)).toContain(
        "Try-Catch Error Handling",
      );
    });
  });

  describe("validateErrorHandling", () => {
    it("should validate code with proper error handling", () => {
      const goodCode = `
        Handlers.add("transfer", function(msg)
          if not msg.Data then
            return { success = false, error = "Data required" }
          end
          
          local success, result = pcall(function()
            return processTransfer(msg)
          end)
          
          if not success then
            return { success = false, error = "Transfer failed" }
          end
          
          return { success = true, data = result }
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token transfer",
      };

      const result = service.validateErrorHandling(goodCode, mockRequirements);

      expect(result.score).toBeGreaterThan(80);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect missing input validation", () => {
      const badCode = `
        Handlers.add("transfer", function(msg)
          -- No input validation
          return processTransfer(msg.Data)
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["transfer"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Token transfer",
      };

      const result = service.validateErrorHandling(badCode, mockRequirements);

      expect(result.score).toBeLessThan(80);
      expect(result.issues).toContain("Missing input validation");
      expect(result.suggestions).toContain(
        "Add input validation to prevent invalid operations",
      );
    });

    it("should detect missing error returns", () => {
      const badCode = `
        Handlers.add("process", function(msg)
          if not msg.Data then
            -- Missing return statement
          end
          return processData(msg.Data)
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["process"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Process data",
      };

      const result = service.validateErrorHandling(badCode, mockRequirements);

      expect(result.issues).toContain("Missing error return statements");
      expect(result.suggestions).toContain(
        "Add proper error return statements",
      );
    });

    it("should detect missing protected calls for complex systems", () => {
      const badCode = `
        Handlers.add("complex", function(msg)
          if not msg.Data then
            return { error = "No data" }
          end
          -- No pcall for complex operation
          return complexOperation(msg.Data)
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["complex-operation"],
        extractedKeywords: ["complex"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Complex system",
      };

      const result = service.validateErrorHandling(badCode, mockRequirements);

      expect(result.issues).toContain(
        "Missing protected calls for complex operations",
      );
      expect(result.suggestions).toContain(
        "Use pcall for protected execution of risky operations",
      );
    });

    it("should detect missing state validation for stateful systems", () => {
      const badCode = `
        local state = { balance = 100 }
        
        Handlers.add("update", function(msg)
          state.balance = state.balance + msg.Amount
          return "Updated"
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["state-management"],
        extractedKeywords: ["state", "balance"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Stateful system",
      };

      const result = service.validateErrorHandling(badCode, mockRequirements);

      expect(result.issues).toContain("Missing state validation");
      expect(result.suggestions).toContain(
        "Add state validation before and after operations",
      );
    });

    it("should calculate score correctly", () => {
      const badCode = `
        Handlers.add("bad", function(msg)
          -- No validation, no error handling, no returns
          someOperation()
        end)
      `;

      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["state-management"],
        extractedKeywords: ["bad"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Bad example",
      };

      const result = service.validateErrorHandling(badCode, mockRequirements);

      // Should lose points for multiple issues
      expect(result.score).toBeLessThan(50);
      expect(result.issues.length).toBeGreaterThan(2);
    });
  });

  describe("getErrorHandlingBestPractices", () => {
    it("should return appropriate practices for stateless simple processes", () => {
      const practices = service.getErrorHandlingBestPractices(
        "stateless",
        "simple",
      );

      expect(practices).toContain("Always validate input parameters");
      expect(practices).toContain("Keep error handling simple");
      expect(practices).toContain("Use basic validation patterns");
    });

    it("should return appropriate practices for stateful moderate processes", () => {
      const practices = service.getErrorHandlingBestPractices(
        "stateful",
        "moderate",
      );

      expect(practices).toContain("Validate state before and after operations");
      expect(practices).toContain(
        "Implement rollback mechanisms for failed state changes",
      );
      expect(practices).toContain("Implement try-catch error handling");
    });

    it("should return appropriate practices for multi-process complex systems", () => {
      const practices = service.getErrorHandlingBestPractices(
        "multi-process",
        "complex",
      );

      expect(practices).toContain(
        "Handle inter-process communication failures",
      );
      expect(practices).toContain("Implement timeout and retry mechanisms");
      expect(practices).toContain(
        "Use advanced patterns like circuit breakers",
      );
      expect(practices).toContain("Design error recovery strategies");
    });
  });

  describe("error handling", () => {
    it("should handle generateErrorHandlingPatterns errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test",
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "createPattern").mockImplementation(() => {
        throw new Error("Pattern creation failed");
      });

      await expect(
        service.generateErrorHandlingPatterns(mockRequirements, "stateless"),
      ).rejects.toThrow(
        "ErrorHandlingPatternService.generateErrorHandlingPatterns failed",
      );
    });

    it("should handle analyzeErrorPatternsFromDocs errors", async () => {
      const mockDocs: PermawebDocsResult[] = [];

      // Mock internal method to throw error
      vi.spyOn(service as any, "detectErrorPatterns").mockImplementation(() => {
        throw new Error("Pattern detection failed");
      });

      await expect(
        service.analyzeErrorPatternsFromDocs(mockDocs),
      ).rejects.toThrow(
        "ErrorHandlingPatternService.analyzeErrorPatternsFromDocs failed",
      );
    });

    it("should handle recommendErrorHandlingStrategy errors", async () => {
      // Mock internal method to throw error
      vi.spyOn(service as any, "createPatternForType").mockImplementation(
        () => {
          throw new Error("Pattern creation failed");
        },
      );

      await expect(
        service.recommendErrorHandlingStrategy("stateless", "simple", []),
      ).rejects.toThrow(
        "ErrorHandlingPatternService.recommendErrorHandlingStrategy failed",
      );
    });
  });
});
