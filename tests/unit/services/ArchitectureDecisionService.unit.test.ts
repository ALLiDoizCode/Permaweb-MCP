import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

import { ArchitectureDecisionService } from "../../../src/services/ArchitectureDecisionService.js";
import { ProcessArchitectureAnalysisService } from "../../../src/services/ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

// Mock the services
vi.mock("../../../src/services/ProcessArchitectureAnalysisService.js", () => ({
  ProcessArchitectureAnalysisService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/services/RequirementAnalysisService.js", () => ({
  RequirementAnalysisService: vi.fn().mockImplementation(() => ({})),
}));

describe("ArchitectureDecisionService", () => {
  let service: ArchitectureDecisionService;
  let mockArchitectureAnalysisService: any;
  let mockRequirementAnalysisService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockArchitectureAnalysisService = new ProcessArchitectureAnalysisService(
      {} as any,
      {} as any,
    );
    mockRequirementAnalysisService = new RequirementAnalysisService();
    service = new ArchitectureDecisionService(
      mockArchitectureAnalysisService,
      mockRequirementAnalysisService,
    );
  });

  describe("generateArchitectureRecommendation", () => {
    it("should generate comprehensive architecture recommendation for token contract", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "transfer", "balance", "contract"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract with transfer capabilities",
      };

      const mockPatternResult = {
        patterns: [
          {
            complexity: "moderate",
            description: "Stateful token contract",
            examples: [
              {
                domain: "ao",
                excerpt: "Token contract implementation",
                relevance: 0.9,
                source: "test",
                title: "Token Contract Example",
              },
            ],
            handlerPatterns: ["request-response"],
            messageTypes: ["transfer", "balance"],
            name: "moderate-stateful-mutable",
            processType: "stateful",
            stateManagement: "mutable",
          },
        ],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: {
            patterns: [
              {
                examples: [
                  {
                    domain: "ao",
                    excerpt: "Example implementation",
                    relevance: 0.9,
                    source: "test",
                    title: "Token Example",
                  },
                ],
                name: "token-contract",
              },
            ],
          },
          stateless: { patterns: [] },
        },
      };

      const result = await service.generateArchitectureRecommendation(
        mockRequirements,
        mockPatternResult,
      );

      expect(result).toBeDefined();
      expect(result.recommendedApproach.processType).toBe("stateful");
      expect(result.recommendedApproach.complexity).toBe("moderate");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toHaveLength(3);
      expect(result.alternativeApproaches).toHaveLength(2);
      expect(result.stateManagementGuidance.recommended).toBe("mutable");
    });

    it("should recommend stateless architecture for simple requests", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculate", "simple", "function"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create a simple calculator service",
      };

      const mockPatternResult = {
        patterns: [
          {
            complexity: "simple",
            examples: [],
            name: "simple-stateless-none",
            processType: "stateless",
          },
        ],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [{ examples: [], name: "calculator" }] },
        },
      };

      const result = await service.generateArchitectureRecommendation(
        mockRequirements,
        mockPatternResult,
      );

      expect(result.recommendedApproach.processType).toBe("stateless");
      expect(result.recommendedApproach.complexity).toBe("simple");
      expect(result.stateManagementGuidance.recommended).toBe("none");
    });

    it("should recommend multi-process architecture for complex distributed systems", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication", "message-routing"],
        extractedKeywords: [
          "distributed",
          "processes",
          "communication",
          "scale",
        ],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest:
          "Create a distributed system with multiple communicating processes",
      };

      const mockPatternResult = {
        patterns: [
          {
            complexity: "complex",
            examples: [],
            name: "complex-multi-process-external",
            processType: "multi-process",
          },
        ],
        processTypes: {
          multiProcess: {
            patterns: [{ examples: [], name: "distributed-system" }],
          },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      };

      const result = await service.generateArchitectureRecommendation(
        mockRequirements,
        mockPatternResult,
      );

      expect(result.recommendedApproach.processType).toBe("multi-process");
      expect(result.recommendedApproach.complexity).toBe("complex");
      expect(result.stateManagementGuidance.recommended).toBe("external");
    });
  });

  describe("evaluateArchitecturalComplexity", () => {
    it("should evaluate simple complexity correctly", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["hello", "world", "simple"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create a simple hello world function",
      };

      const result =
        await service.evaluateArchitecturalComplexity(mockRequirements);

      expect(result.level).toBe("simple");
      expect(result.score).toBeLessThan(0.4);
      expect(result.factors).toHaveLength(4);
      expect(result.recommendations).toContain(
        "Consider stateless architecture for simplicity",
      );
    });

    it("should evaluate moderate complexity correctly", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "balance", "transfer", "ledger"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract with balance tracking",
      };

      const result =
        await service.evaluateArchitecturalComplexity(mockRequirements);

      expect(result.level).toBe("moderate");
      expect(result.score).toBeGreaterThanOrEqual(0.4);
      expect(result.score).toBeLessThan(0.7);
      expect(result.recommendations).toContain(
        "Balance simplicity with functionality",
      );
    });

    it("should evaluate complex complexity correctly", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: [
          "dao-governance",
          "process-communication",
          "message-routing",
        ],
        extractedKeywords: [
          "distributed",
          "dao",
          "governance",
          "voting",
          "proposals",
          "complex",
          "scale",
        ],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest:
          "Create a distributed DAO governance system with voting and proposals",
      };

      const result =
        await service.evaluateArchitecturalComplexity(mockRequirements);

      expect(result.level).toBe("complex");
      expect(result.score).toBeGreaterThanOrEqual(0.7);
      expect(result.recommendations).toContain(
        "Consider multi-process architecture for complex systems",
      );
    });

    it("should assess data complexity correctly", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["ledger", "balance", "mapping", "history"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a complex ledger system with balance tracking",
      };

      const result =
        await service.evaluateArchitecturalComplexity(mockRequirements);

      const dataComplexityFactor = result.factors.find(
        (f) => f.name === "Data Complexity",
      );
      expect(dataComplexityFactor).toBeDefined();
      expect(dataComplexityFactor!.score).toBeGreaterThan(0.5);
    });
  });

  describe("recommendProcessType", () => {
    it("should recommend stateless for simple performance-focused applications", async () => {
      const mockComplexity = {
        factors: [
          {
            description: "High performance needed",
            name: "Performance Requirements",
            score: 0.8,
            weight: 0.2,
          },
          {
            description: "Low data complexity",
            name: "Data Complexity",
            score: 0.1,
            weight: 0.3,
          },
          {
            description: "Simple interactions",
            name: "Interaction Complexity",
            score: 0.2,
            weight: 0.25,
          },
          {
            description: "Moderate scalability",
            name: "Scalability Requirements",
            score: 0.3,
            weight: 0.25,
          },
        ],
        level: "simple" as const,
        recommendations: [],
        score: 0.3,
      };

      const mockPatternResult = {
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [{ name: "calculator" }] },
        },
      };

      const result = await service.recommendProcessType(
        mockComplexity,
        mockPatternResult,
      );

      expect(result.recommended).toBe("stateless");
      expect(result.reasoning).toContain(
        "Complexity analysis indicates simple requirements",
      );
    });

    it("should recommend stateful for data-intensive applications", async () => {
      const mockComplexity = {
        factors: [
          {
            description: "High data complexity",
            name: "Data Complexity",
            score: 0.8,
            weight: 0.3,
          },
          {
            description: "Moderate performance needs",
            name: "Performance Requirements",
            score: 0.3,
            weight: 0.2,
          },
          {
            description: "Moderate interactions",
            name: "Interaction Complexity",
            score: 0.6,
            weight: 0.25,
          },
          {
            description: "Moderate scalability",
            name: "Scalability Requirements",
            score: 0.4,
            weight: 0.25,
          },
        ],
        level: "moderate" as const,
        recommendations: [],
        score: 0.5,
      };

      const mockPatternResult = {
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [{ name: "token-contract" }] },
          stateless: { patterns: [] },
        },
      };

      const result = await service.recommendProcessType(
        mockComplexity,
        mockPatternResult,
      );

      expect(result.recommended).toBe("stateful");
      expect(result.alternatives).toContain("stateless");
      expect(result.alternatives).toContain("multi-process");
    });

    it("should recommend multi-process for high scalability requirements", async () => {
      const mockComplexity = {
        factors: [
          {
            description: "High scalability needs",
            name: "Scalability Requirements",
            score: 0.9,
            weight: 0.25,
          },
          {
            description: "High data complexity",
            name: "Data Complexity",
            score: 0.7,
            weight: 0.3,
          },
          {
            description: "Complex interactions",
            name: "Interaction Complexity",
            score: 0.8,
            weight: 0.25,
          },
          {
            description: "High performance needs",
            name: "Performance Requirements",
            score: 0.6,
            weight: 0.2,
          },
        ],
        level: "complex" as const,
        recommendations: [],
        score: 0.8,
      };

      const mockPatternResult = {
        processTypes: {
          multiProcess: { patterns: [{ name: "distributed-system" }] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      };

      const result = await service.recommendProcessType(
        mockComplexity,
        mockPatternResult,
      );

      expect(result.recommended).toBe("multi-process");
      expect(result.tradeoffs).toHaveLength(3);
      expect(result.documentationEvidence).toBeDefined();
    });
  });

  describe("mapRequirementsToArchitecture", () => {
    it("should map requirements to appropriate architecture", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["voting", "governance", "dao"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a voting system",
      };

      const mockComplexity = {
        factors: [],
        level: "moderate" as const,
        recommendations: [],
        score: 0.5,
      };

      const result = await service.mapRequirementsToArchitecture(
        mockRequirements,
        mockComplexity,
      );

      expect(result.primary.name).toBe("Moderate Stateful Application");
      expect(result.primary.processType).toBe("stateful");
      expect(result.primary.complexity).toBe("moderate");
      expect(result.alternatives).toHaveLength(2);
      expect(result.mappingConfidence).toBeGreaterThan(0.5);
    });

    it("should generate appropriate suitable use cases", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "message-routing"],
        extractedKeywords: ["token", "transfer"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token transfer system",
      };

      const mockComplexity = {
        factors: [],
        level: "moderate" as const,
        recommendations: [],
        score: 0.5,
      };

      const result = await service.mapRequirementsToArchitecture(
        mockRequirements,
        mockComplexity,
      );

      expect(result.primary.suitableFor).toContain(
        "Token transfers and balance management",
      );
      expect(result.primary.suitableFor).toContain(
        "Communication and routing systems",
      );
    });

    it("should calculate mapping confidence correctly", async () => {
      const highConfidenceRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: [
          "dao-governance",
          "token-contract",
          "message-routing",
        ],
        extractedKeywords: [
          "complex",
          "distributed",
          "governance",
          "token",
          "routing",
          "scale",
          "performance",
        ],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Complex system with many patterns",
      };

      const complexityAssessment = {
        factors: [],
        level: "complex" as const,
        recommendations: [],
        score: 0.9, // Very high complexity
      };

      const result = await service.mapRequirementsToArchitecture(
        highConfidenceRequirements,
        complexityAssessment,
      );

      expect(result.mappingConfidence).toBeGreaterThan(0.8);
    });
  });

  describe("error handling", () => {
    it("should handle generateArchitectureRecommendation errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test request",
      };

      // Mock evaluateArchitecturalComplexity to throw error
      vi.spyOn(service, "evaluateArchitecturalComplexity").mockRejectedValue(
        new Error("Complexity evaluation failed"),
      );

      await expect(
        service.generateArchitectureRecommendation(mockRequirements, {
          patterns: [],
          processTypes: {},
        }),
      ).rejects.toThrow(
        "ArchitectureDecisionService.generateArchitectureRecommendation failed",
      );
    });

    it("should handle evaluateArchitecturalComplexity errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test request",
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "assessDataComplexity").mockImplementation(
        () => {
          throw new Error("Data complexity assessment failed");
        },
      );

      await expect(
        service.evaluateArchitecturalComplexity(mockRequirements),
      ).rejects.toThrow(
        "ArchitectureDecisionService.evaluateArchitecturalComplexity failed",
      );
    });

    it("should handle recommendProcessType errors", async () => {
      const mockComplexity = {
        factors: [],
        level: "simple" as const,
        recommendations: [],
        score: 0.3,
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "scoreProcessType").mockImplementation(() => {
        throw new Error("Process type scoring failed");
      });

      await expect(
        service.recommendProcessType(mockComplexity, { processTypes: {} }),
      ).rejects.toThrow(
        "ArchitectureDecisionService.recommendProcessType failed",
      );
    });

    it("should handle mapRequirementsToArchitecture errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test request",
      };

      const mockComplexity = {
        factors: [],
        level: "simple" as const,
        recommendations: [],
        score: 0.3,
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "generateArchitectureName").mockImplementation(
        () => {
          throw new Error("Architecture name generation failed");
        },
      );

      await expect(
        service.mapRequirementsToArchitecture(mockRequirements, mockComplexity),
      ).rejects.toThrow(
        "ArchitectureDecisionService.mapRequirementsToArchitecture failed",
      );
    });
  });
});
