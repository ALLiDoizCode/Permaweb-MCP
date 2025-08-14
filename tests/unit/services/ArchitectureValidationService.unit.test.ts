import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermawebDocsResult } from "../../../src/services/PermawebDocsService.js";
import type { ArchitectureRecommendation } from "../../../src/types/process-architecture.js";

import { ArchitectureValidationService } from "../../../src/services/ArchitectureValidationService.js";
import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";

// Mock the service
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({})),
}));

describe("ArchitectureValidationService", () => {
  let service: ArchitectureValidationService;
  let mockPermawebDocsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    service = new ArchitectureValidationService(mockPermawebDocsService);
  });

  describe("findSimilarPatterns", () => {
    it("should find similar patterns in documentation", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [
          {
            complexity: "moderate",
            documentation: [],
            messageTypes: ["transfer"],
            name: "Transfer Handler",
            purpose: "Handle transfers",
            template: "handler template",
          },
        ],
        reasoning: ["Good match for requirements"],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token contract architecture",
          documentation: [],
          name: "Moderate Stateful Application",
          processType: "stateful",
          suitableFor: ["Token operations"],
        },
        stateManagementGuidance: {
          alternatives: ["immutable"],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract Example
          local state = { balances = {} }
          
          Handlers.add("transfer", function(msg)
            -- Stateful transfer logic
            state.balances[msg.To] = amount
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token",
        },
        {
          content: `# Simple Calculator
          Handlers.add("calculate", function(msg)
            return msg.a + msg.b
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.7,
          url: "https://example.com/calc",
        },
      ];

      const result = await service.findSimilarPatterns(
        mockArchitecture,
        mockDocs,
      );

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(1); // Only token example should match well
      expect(result.totalMatches).toBe(1);
      expect(result.averageSimilarity).toBeGreaterThan(0.3);
      expect(result.matches[0].pattern.name).toBe("Token Contract Example");
      expect(result.matches[0].pattern.processType).toBe("stateful");
    });

    it("should return empty matches when no similar patterns found", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "complex",
          description: "Distributed system",
          documentation: [],
          name: "Complex Multi-Process System",
          processType: "multi-process",
          suitableFor: ["Enterprise systems"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "external",
        },
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Simple Calculator
          Handlers.add("add", function(msg)
            return msg.a + msg.b
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.5,
          url: "https://example.com/calc",
        },
      ];

      const result = await service.findSimilarPatterns(
        mockArchitecture,
        mockDocs,
      );

      expect(result.matches).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
      expect(result.averageSimilarity).toBe(0);
    });

    it("should sort matches by similarity score", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "State management system",
          documentation: [],
          name: "Stateful Application",
          processType: "stateful",
          suitableFor: ["Data management"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Basic State Example
          local state = {}
          Handlers.add("update", function(msg)
            state.data = msg.data
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.6,
          url: "https://example.com/basic-state",
        },
        {
          content: `# Advanced State Management
          local state = { users = {}, balances = {} }
          Handlers.add("transfer", function(msg)
            state.balances[msg.to] = amount
          end)
          Handlers.add("register", function(msg)
            state.users[msg.id] = msg.data
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/advanced-state",
        },
      ];

      const result = await service.findSimilarPatterns(
        mockArchitecture,
        mockDocs,
      );

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].similarity).toBeGreaterThan(
        result.matches[1].similarity,
      );
      expect(result.matches[0].pattern.name).toBe("Advanced State Management");
    });
  });

  describe("scoreArchitectureMatch", () => {
    it("should score architecture with good pattern matches", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.9,
        documentationSupport: [
          {
            domain: "ao",
            excerpt: "Token implementation",
            relevance: 0.9,
            source: "example.com",
            title: "Token Example",
          },
        ],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token system",
          documentation: [],
          name: "Token Contract",
          processType: "stateful",
          suitableFor: ["Tokens"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const mockSimilarPatterns = {
        averageSimilarity: 0.8,
        matches: [
          {
            documentation: [],
            pattern: {
              complexity: "moderate" as const,
              description: "Token example",
              examples: [],
              handlerPatterns: ["transfer"],
              messageTypes: ["transfer"],
              name: "Token Pattern",
              processType: "stateful" as const,
              stateManagement: "mutable" as const,
            },
            similarity: 0.8,
          },
        ],
        totalMatches: 1,
      };

      const result = await service.scoreArchitectureMatch(
        mockArchitecture,
        mockSimilarPatterns,
      );

      expect(result.overall).toBeGreaterThan(0.7);
      expect(result.breakdown.patternMatch).toBeGreaterThan(0.6);
      expect(result.breakdown.documentationSupport).toBeGreaterThan(0.3);
      expect(result.reasoning).toContain(
        "Strong match with documented patterns",
      );
    });

    it("should give lower scores for poor pattern matches", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.5,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "complex",
          description: "Custom implementation",
          documentation: [],
          name: "Custom System",
          processType: "multi-process",
          suitableFor: ["Special use case"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "external",
        },
      };

      const mockSimilarPatterns = {
        averageSimilarity: 0,
        matches: [],
        totalMatches: 0,
      };

      const result = await service.scoreArchitectureMatch(
        mockArchitecture,
        mockSimilarPatterns,
      );

      expect(result.overall).toBeLessThan(0.6);
      expect(result.breakdown.patternMatch).toBe(0.2); // Low score for no matches
      expect(result.reasoning).toContain("Limited matching patterns found");
    });
  });

  describe("validateBestPractices", () => {
    it("should validate code with proper patterns", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "State management",
          documentation: [],
          name: "Stateful System",
          processType: "stateful",
          suitableFor: ["Data systems"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const goodCode = `
        local state = { balances = {} }
        
        Handlers.add("transfer", function(msg)
          if not msg.Tags.Amount then
            return { error = "Amount required" }
          end
          
          local success, result = pcall(function()
            return processTransfer(msg, state)
          end)
          
          if not success then
            return { error = "Transfer failed" }
          end
          
          return { success = true, data = result }
        end)
      `;

      const result = await service.validateBestPractices(
        mockArchitecture,
        goodCode,
      );

      expect(result.passed.length).toBeGreaterThan(result.errors.length);
      expect(result.errors).toHaveLength(0);
      expect(result.passed.map((p) => p.practice)).toContain(
        "Input Validation",
      );
      expect(result.passed.map((p) => p.practice)).toContain("Error Handling");
      expect(result.passed.map((p) => p.practice)).toContain(
        "State Initialization",
      );
    });

    it("should detect violations in poor code", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "simple",
          description: "Simple processing",
          documentation: [],
          name: "Stateless System",
          processType: "stateless",
          suitableFor: ["Calculations"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "none",
        },
      };

      const badCode = `
        local state = { data: "bad" } -- Stateless should not have state
        
        Handlers.add("process", function(msg)
          -- No input validation
          -- No error handling
          return processData(msg.Data)
          -- No return guarantee
        end)
      `;

      const result = await service.validateBestPractices(
        mockArchitecture,
        badCode,
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.map((e) => e.practice)).toContain("Pure Functions");
    });

    it("should work without code (architecture-only validation)", async () => {
      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token management",
          documentation: [],
          name: "Token System",
          processType: "stateful",
          suitableFor: ["Token operations"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const result = await service.validateBestPractices(mockArchitecture);

      expect(result.passed.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      // Should return recommendations rather than violations
    });
  });

  describe("generateValidationReport", () => {
    it("should generate comprehensive validation report", async () => {
      const mockScore = {
        breakdown: {
          bestPracticeAlignment: 0.8,
          complexity: 1.0,
          documentationSupport: 0.9,
          patternMatch: 0.8,
        },
        overall: 0.85,
        reasoning: ["Strong architecture alignment"],
      };

      const mockValidation = {
        errors: [],
        passed: [
          {
            description: "Proper validation implemented",
            documentation: [],
            practice: "Input Validation",
          },
        ],
        warnings: [
          {
            documentation: [],
            issue: "Could improve error logging",
            practice: "Error Logging",
            suggestion: "Add comprehensive logging",
          },
        ],
      };

      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.85,
        documentationSupport: [
          {
            domain: "ao",
            excerpt: "Best practices guide",
            relevance: 0.9,
            source: "example.com",
            title: "Architecture Guide",
          },
        ],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Well-designed system",
          documentation: [],
          name: "Good Architecture",
          processType: "stateful",
          suitableFor: ["Production use"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const result = await service.generateValidationReport(
        mockScore,
        mockValidation,
        mockArchitecture,
      );

      expect(result.score).toBe(mockScore);
      expect(result.validation).toBe(mockValidation);
      expect(result.summary).toContain("85%");
      expect(result.summary).toContain("1 warnings");
      expect(result.recommendations).toHaveLength(1); // Should include warning-based recommendation
      expect(result.documentation).toHaveLength(1);
    });

    it("should handle reports with errors", async () => {
      const mockScore = {
        breakdown: {
          bestPracticeAlignment: 0.5,
          complexity: 0.6,
          documentationSupport: 0.2,
          patternMatch: 0.3,
        },
        overall: 0.4,
        reasoning: ["Poor pattern matching"],
      };

      const mockValidation = {
        errors: [
          {
            documentation: [],
            fix: "Add validation checks",
            practice: "Input Validation",
            violation: "Missing input validation",
          },
          {
            documentation: [],
            fix: "Add error handling",
            practice: "Error Handling",
            violation: "No error handling",
          },
        ],
        passed: [],
        warnings: [],
      };

      const mockArchitecture: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.4,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "complex",
          description: "Needs improvement",
          documentation: [],
          name: "Problematic Architecture",
          processType: "stateful",
          suitableFor: ["Development only"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const result = await service.generateValidationReport(
        mockScore,
        mockValidation,
        mockArchitecture,
      );

      expect(result.summary).toContain("40%");
      expect(result.summary).toContain("2 critical issues");
      expect(result.recommendations).toContain(
        "Address critical errors before implementation",
      );
      expect(result.recommendations.length).toBeGreaterThan(2); // Multiple improvement recommendations
    });
  });

  describe("error handling", () => {
    it("should handle findSimilarPatterns errors", async () => {
      const mockArchitecture: any = {};
      const mockDocs: PermawebDocsResult[] = [];

      // Mock internal method to throw error
      vi.spyOn(
        service as any,
        "createPatternFromArchitecture",
      ).mockImplementation(() => {
        throw new Error("Pattern creation failed");
      });

      await expect(
        service.findSimilarPatterns(mockArchitecture, mockDocs),
      ).rejects.toThrow(
        "ArchitectureValidationService.findSimilarPatterns failed",
      );
    });

    it("should handle scoreArchitectureMatch errors", async () => {
      const mockArchitecture: any = {};
      const mockSimilarPatterns: any = {};

      // Mock internal method to throw error
      vi.spyOn(service as any, "calculatePatternMatchScore").mockImplementation(
        () => {
          throw new Error("Scoring failed");
        },
      );

      await expect(
        service.scoreArchitectureMatch(mockArchitecture, mockSimilarPatterns),
      ).rejects.toThrow(
        "ArchitectureValidationService.scoreArchitectureMatch failed",
      );
    });

    it("should handle validateBestPractices errors", async () => {
      const mockArchitecture: any = {
        recommendedApproach: { processType: "invalid" },
      };

      await expect(
        service.validateBestPractices(mockArchitecture),
      ).rejects.toThrow(
        "ArchitectureValidationService.validateBestPractices failed",
      );
    });

    it("should handle generateValidationReport errors", async () => {
      const mockScore: any = {};
      const mockValidation: any = {};
      const mockArchitecture: any = {};

      // Mock internal method to throw error
      vi.spyOn(service as any, "generateValidationSummary").mockImplementation(
        () => {
          throw new Error("Summary generation failed");
        },
      );

      await expect(
        service.generateValidationReport(
          mockScore,
          mockValidation,
          mockArchitecture,
        ),
      ).rejects.toThrow(
        "ArchitectureValidationService.generateValidationReport failed",
      );
    });
  });
});
