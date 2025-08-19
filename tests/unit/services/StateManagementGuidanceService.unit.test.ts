import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PermawebDocsResponse,
  PermawebDocsResult,
} from "../../../src/services/PermawebDocsService.js";
import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";
import { StateManagementGuidanceService } from "../../../src/services/StateManagementGuidanceService.js";

// Mock the service
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({
    queryPermawebDocs: vi.fn(),
  })),
}));

describe("StateManagementGuidanceService", () => {
  let service: StateManagementGuidanceService;
  let mockPermawebDocsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    service = new StateManagementGuidanceService(mockPermawebDocsService);
  });

  describe("generateStateManagementGuidance", () => {
    it("should recommend 'none' for stateless processes", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculate", "simple"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Simple calculator",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateless",
      );

      expect(result.recommended).toBe("none");
      expect(result.patterns[0].type).toBe("none");
      expect(result.bestPractices).toContain("Keep handlers pure functions");
    });

    it("should recommend 'mutable' for token contracts", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "transfer", "balance"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract with transfers",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      expect(result.recommended).toBe("mutable");
      expect(result.patterns[0].type).toBe("mutable");
      expect(result.bestPractices).toContain(
        "Validate state changes before applying",
      );
    });

    it("should recommend 'hybrid' for DAO governance", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao", "vote", "proposal"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "DAO governance system",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      expect(result.recommended).toBe("hybrid");
      expect(result.patterns[0].type).toBe("hybrid");
      expect(result.bestPractices).toContain(
        "Clearly separate immutable and mutable parts",
      );
    });

    it("should recommend 'external' for multi-process systems", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication"],
        extractedKeywords: ["distributed", "processes"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Distributed multi-process system",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "multi-process",
      );

      expect(result.recommended).toBe("external");
      expect(result.patterns[0].type).toBe("external");
      expect(result.bestPractices).toContain(
        "Implement proper communication protocols",
      );
    });

    it("should recommend 'immutable' for simple stateful processes", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["config", "simple"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Simple configuration service",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      expect(result.recommended).toBe("immutable");
      expect(result.patterns[0].type).toBe("immutable");
      expect(result.bestPractices).toContain(
        "Initialize state at process creation",
      );
    });

    it("should include appropriate alternatives", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token system",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      expect(result.alternatives).toContain("none");
      expect(result.alternatives).toContain("immutable");
      expect(result.alternatives).toContain("hybrid");
      expect(result.alternatives.length).toBeLessThanOrEqual(3);
    });

    it("should include complexity-specific best practices", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["state-management"],
        extractedKeywords: ["complex"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Complex system",
      };

      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: [],
        sources: ["ao"],
        totalResults: 0,
      });

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      expect(result.bestPractices).toContain(
        "Design comprehensive state management strategy",
      );
      expect(result.bestPractices).toContain(
        "Add monitoring and debugging capabilities",
      );
    });
  });

  describe("analyzeStatePatterns", () => {
    it("should detect mutable state patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract
          local state = { balances = {}, totalSupply = 1000 }
          
          Handlers.add("transfer", function(msg)
            state.balances[msg.To] = amount
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token",
        },
      ];

      const result = await service.analyzeStatePatterns(mockDocs);

      expect(result.patterns.mutable).toBe(1);
      expect(result.examples.mutable).toHaveLength(1);
      expect(result.examples.mutable[0].title).toBe("Token Contract");
    });

    it("should detect immutable state patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Configuration Service
          local CONFIG = {
            name = "MyService",
            version = "1.0.0"
          }
          
          Handlers.add("info", function(msg)
            return CONFIG
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/config",
        },
      ];

      const result = await service.analyzeStatePatterns(mockDocs);

      expect(result.patterns.immutable).toBe(1);
      expect(result.examples.immutable[0].title).toBe("Configuration Service");
    });

    it("should detect external state patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Distributed System
          Handlers.add("getData", function(msg)
            ao.send({
              Target = "state-manager",
              Action = "Get",
              Key = msg.Key
            })
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/distributed",
        },
      ];

      const result = await service.analyzeStatePatterns(mockDocs);

      expect(result.patterns.external).toBe(1);
      expect(result.examples.external[0].title).toBe("Distributed System");
    });

    it("should detect hybrid state patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# DAO System
          local CONFIG = { name = "DAO", votingPeriod = 7 }
          local state = { proposals = {}, votes = {} }
          
          Handlers.add("vote", function(msg)
            state.votes[msg.ProposalId] = msg.Vote
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/dao",
        },
      ];

      const result = await service.analyzeStatePatterns(mockDocs);

      expect(result.patterns.hybrid).toBe(1);
      expect(result.examples.hybrid[0].title).toBe("DAO System");
    });

    it("should detect stateless patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Calculator Service
          Handlers.add("calculate", function(msg)
            local a = tonumber(msg.Tags.A)
            local b = tonumber(msg.Tags.B)
            return a + b
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.7,
          url: "https://example.com/calc",
        },
      ];

      const result = await service.analyzeStatePatterns(mockDocs);

      expect(result.patterns.none).toBe(1);
      expect(result.examples.none[0].title).toBe("Calculator Service");
    });
  });

  describe("getImplementationTemplate", () => {
    it("should customize template for token contracts", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract",
      };

      const template = service.getImplementationTemplate(
        "mutable",
        mockRequirements,
      );

      expect(template).toContain("TokenContract");
      expect(template).toContain("handleTokenOperation");
    });

    it("should customize template for DAO governance", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "DAO system",
      };

      const template = service.getImplementationTemplate(
        "hybrid",
        mockRequirements,
      );

      expect(template).toContain("DAOGovernance");
      expect(template).toContain("handleGovernanceAction");
    });
  });

  describe("validateStateManagementChoice", () => {
    it("should warn about stateless processes using state", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculate"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Calculator",
      };

      const result = service.validateStateManagementChoice(
        "mutable",
        mockRequirements,
        "stateless",
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain(
        "Stateless processes should not use persistent state management",
      );
      expect(result.suggestions).toContain(
        "Consider using 'none' state management type",
      );
    });

    it("should warn about token contracts without mutable state", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract",
      };

      const result = service.validateStateManagementChoice(
        "none",
        mockRequirements,
        "stateful",
      );

      expect(result.warnings).toContain(
        "Token contracts typically require mutable state for balances",
      );
      expect(result.suggestions).toContain(
        "Consider using 'mutable' state management",
      );
    });

    it("should warn about multi-process mutable state consistency", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication"],
        extractedKeywords: ["processes"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Multi-process system",
      };

      const result = service.validateStateManagementChoice(
        "mutable",
        mockRequirements,
        "multi-process",
      );

      expect(result.warnings).toContain(
        "Multi-process systems may have state consistency issues with local mutable state",
      );
      expect(result.suggestions).toContain(
        "Consider using 'external' or 'hybrid' state management",
      );
    });

    it("should suggest simpler alternatives for simple systems", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["simple"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Simple service",
      };

      const result = service.validateStateManagementChoice(
        "hybrid",
        mockRequirements,
        "stateful",
      );

      expect(result.suggestions).toContain(
        "Simple applications may not need hybrid state management complexity",
      );
    });

    it("should validate correct choices", () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract",
      };

      const result = service.validateStateManagementChoice(
        "mutable",
        mockRequirements,
        "stateful",
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle generateStateManagementGuidance errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test",
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "recommendStateManagement").mockImplementation(
        () => {
          throw new Error("Recommendation failed");
        },
      );

      await expect(
        service.generateStateManagementGuidance(mockRequirements, "stateless"),
      ).rejects.toThrow(
        "StateManagementGuidanceService.generateStateManagementGuidance failed",
      );
    });

    it("should handle analyzeStatePatterns errors", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: "Some test content",
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/test",
        },
      ];

      // Mock internal method to throw error
      vi.spyOn(service as any, "detectStateManagementType").mockImplementation(
        () => {
          throw new Error("Detection failed");
        },
      );

      await expect(service.analyzeStatePatterns(mockDocs)).rejects.toThrow(
        "StateManagementGuidanceService.analyzeStatePatterns failed",
      );
    });

    it("should handle documentation query failures gracefully", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Test",
      };

      mockPermawebDocsService.queryPermawebDocs.mockRejectedValue(
        new Error("Query failed"),
      );

      const result = await service.generateStateManagementGuidance(
        mockRequirements,
        "stateful",
      );

      // Should still return guidance even if documentation query fails
      expect(result).toBeDefined();
      expect(result.documentation).toEqual([]);
    });
  });
});
