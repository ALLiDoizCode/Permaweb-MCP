import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";
import type {
  ArchitectureRecommendation,
  ValidationReport,
} from "../../../src/types/process-architecture.js";

import { ArchitectureExplanationService } from "../../../src/services/ArchitectureExplanationService.js";
import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";

// Mock the service
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({})),
}));

describe("ArchitectureExplanationService", () => {
  let service: ArchitectureExplanationService;
  let mockPermawebDocsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    service = new ArchitectureExplanationService(mockPermawebDocsService);
  });

  describe("generateArchitectureExplanation", () => {
    it("should generate comprehensive explanation for token contract architecture", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.85,
        documentationSupport: [
          {
            domain: "ao",
            excerpt: "Complete token implementation guide",
            relevance: 0.9,
            source: "https://example.com/token-guide",
            title: "Token Contract Guide",
          },
        ],
        errorHandlingPatterns: [
          {
            complexity: "simple",
            description: "Input validation pattern",
            documentation: [],
            implementation: "validation code",
            name: "Basic Validation",
            pattern: "if not msg.Data then return error end",
            useCases: ["Input validation"],
          },
        ],
        handlerRecommendations: [
          {
            complexity: "moderate",
            documentation: [],
            messageTypes: ["transfer"],
            name: "Transfer Handler",
            purpose: "Handle token transfers",
            template: "Handlers.add('transfer', function(msg) ... end)",
          },
          {
            complexity: "simple",
            documentation: [],
            messageTypes: ["balance"],
            name: "Balance Handler",
            purpose: "Query account balances",
            template: "Handlers.add('balance', function(msg) ... end)",
          },
        ],
        reasoning: ["Good match for token requirements"],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token contract with balance management",
          documentation: [],
          name: "Moderate Stateful Application",
          processType: "stateful",
          suitableFor: ["Token operations", "Balance tracking"],
        },
        stateManagementGuidance: {
          alternatives: ["immutable"],
          bestPractices: ["Validate state changes", "Use atomic operations"],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "transfer", "balance"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract with transfer capabilities",
      };

      const result = await service.generateArchitectureExplanation(
        mockRecommendation,
        mockRequirements,
      );

      expect(result.overview).toContain("stateful");
      expect(result.overview).toContain("moderate");
      expect(result.overview).toContain("85%");
      expect(result.detailedExplanation).toContain("## Architecture Overview");
      expect(result.detailedExplanation).toContain("Process Type: stateful");
      expect(result.detailedExplanation).toContain("State Management: mutable");
      expect(result.detailedExplanation).toContain("Transfer Handler");
      expect(result.reasoning.processTypeReasoning).toContain(
        "token balance management",
      );
      expect(result.reasoning.stateManagementReasoning).toContain(
        "Mutable state selected",
      );
      expect(result.implementationGuidance).toContain(
        "Implementation Guidance",
      );
      expect(result.bestPractices).toContain(
        "Follow AO ecosystem conventions for handler naming",
      );
      expect(result.documentationCitations).toHaveLength(1);
      expect(result.relatedPatterns).toContain("stateful-process-patterns");
    });

    it("should generate explanation for stateless simple architecture", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.9,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [
          {
            complexity: "simple",
            documentation: [],
            messageTypes: ["calculate"],
            name: "Calculate Handler",
            purpose: "Perform calculations",
            template: "Handlers.add('calculate', function(msg) ... end)",
          },
        ],
        reasoning: ["Perfect for computational tasks"],
        recommendedApproach: {
          complexity: "simple",
          description: "Calculator service with no state",
          documentation: [],
          name: "Simple Stateless Service",
          processType: "stateless",
          suitableFor: ["Mathematical operations"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: ["Keep handlers pure", "No side effects"],
          documentation: [],
          patterns: [],
          recommended: "none",
        },
      };

      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculate", "math"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create a simple calculator",
      };

      const result = await service.generateArchitectureExplanation(
        mockRecommendation,
        mockRequirements,
      );

      expect(result.overview).toContain("stateless");
      expect(result.overview).toContain("simple");
      expect(result.reasoning.processTypeReasoning).toContain(
        "simple message processing",
      );
      expect(result.reasoning.stateManagementReasoning).toContain(
        "No state management needed",
      );
      expect(result.bestPractices).toContain(
        "Keep handlers pure and avoid side effects",
      );
      expect(result.relatedPatterns).toContain("stateless-process-patterns");
    });

    it("should generate explanation for complex multi-process architecture", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.75,
        documentationSupport: [],
        errorHandlingPatterns: [
          {
            complexity: "complex",
            description: "Prevent cascading failures",
            documentation: [],
            implementation: "circuit breaker code",
            name: "Circuit Breaker",
            pattern: "circuit breaker pattern",
            useCases: ["External service calls"],
          },
        ],
        handlerRecommendations: [
          {
            complexity: "complex",
            documentation: [],
            messageTypes: ["coordinate"],
            name: "Coordinator Handler",
            purpose: "Coordinate between processes",
            template: "Handlers.add('coordinate', function(msg) ... end)",
          },
        ],
        reasoning: ["Required for scalability"],
        recommendedApproach: {
          complexity: "complex",
          description: "Multi-process distributed architecture",
          documentation: [],
          name: "Complex Distributed System",
          processType: "multi-process",
          suitableFor: ["Enterprise systems", "High availability"],
        },
        stateManagementGuidance: {
          alternatives: ["hybrid"],
          bestPractices: ["Implement proper communication protocols"],
          documentation: [],
          patterns: [],
          recommended: "external",
        },
      };

      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication", "distributed"],
        extractedKeywords: ["distributed", "processes", "scalable"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Create a distributed system with multiple processes",
      };

      const result = await service.generateArchitectureExplanation(
        mockRecommendation,
        mockRequirements,
      );

      expect(result.overview).toContain("multi-process");
      expect(result.overview).toContain("complex");
      expect(result.reasoning.processTypeReasoning).toContain(
        "distributed processing needs",
      );
      expect(result.reasoning.stateManagementReasoning).toContain(
        "External state management recommended",
      );
      expect(result.bestPractices).toContain(
        "Design robust inter-process communication",
      );
      expect(result.implementationGuidance).toContain(
        "multi-process Implementation",
      );
      expect(result.relatedPatterns).toContain(
        "multi-process-process-patterns",
      );
    });

    it("should include validation report information when provided", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Test system",
          documentation: [],
          name: "Test Architecture",
          processType: "stateful",
          suitableFor: ["Testing"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "mutable",
        },
      };

      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["test"],
        extractedKeywords: ["test"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Test request",
      };

      const mockValidationReport: ValidationReport = {
        documentation: [
          {
            domain: "ao",
            excerpt: "Validation best practices",
            relevance: 0.8,
            source: "validation.com",
            title: "Validation Guide",
          },
        ],
        recommendations: [],
        score: {
          breakdown: {
            bestPracticeAlignment: 0.8,
            complexity: 1.0,
            documentationSupport: 0.9,
            patternMatch: 0.8,
          },
          overall: 0.85,
          reasoning: ["Good architecture"],
        },
        summary: "Good architecture validation",
        validation: {
          errors: [],
          passed: [],
          warnings: [],
        },
      };

      const result = await service.generateArchitectureExplanation(
        mockRecommendation,
        mockRequirements,
        mockValidationReport,
      );

      expect(result.documentationCitations.map((d) => d.title)).toContain(
        "Validation Guide",
      );
    });
  });

  describe("createDocumentationCitationSystem", () => {
    it("should create comprehensive citation system", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [
          {
            domain: "ao",
            excerpt: "Main architecture documentation",
            relevance: 0.9,
            source: "primary.com",
            title: "Primary Architecture Guide",
          },
          {
            domain: "ao",
            excerpt: "Additional examples",
            relevance: 0.6,
            source: "support.com",
            title: "Supporting Examples",
          },
        ],
        errorHandlingPatterns: [],
        handlerRecommendations: [
          {
            complexity: "simple",
            documentation: [
              {
                domain: "ao",
                excerpt: "Handler documentation",
                relevance: 0.8,
                source: "handler.com",
                title: "Handler Guide",
              },
            ],
            messageTypes: ["test"],
            name: "Handler",
            purpose: "Test handler",
            template: "template",
          },
        ],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Test system",
          documentation: [],
          name: "Test Architecture",
          processType: "stateful",
          suitableFor: ["Testing"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [
            {
              domain: "ao",
              excerpt: "State management docs",
              relevance: 0.7,
              source: "state.com",
              title: "State Management Guide",
            },
          ],
          patterns: [],
          recommended: "mutable",
        },
      };

      const result =
        await service.createDocumentationCitationSystem(mockRecommendation);

      expect(result.primarySources).toHaveLength(1);
      expect(result.primarySources[0].title).toBe("Primary Architecture Guide");
      expect(result.supportingSources).toHaveLength(3); // Supporting Examples + Handler + State docs
      expect(result.citationMap.handlers).toHaveLength(1);
      expect(result.citationMap.state).toHaveLength(1);
    });

    it("should handle empty documentation", async () => {
      const mockRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.7,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "simple",
          description: "Minimal system",
          documentation: [],
          name: "Minimal Architecture",
          processType: "stateless",
          suitableFor: ["Simple tasks"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "none",
        },
      };

      const result =
        await service.createDocumentationCitationSystem(mockRecommendation);

      expect(result.primarySources).toHaveLength(0);
      expect(result.supportingSources).toHaveLength(0);
      expect(
        Object.values(result.citationMap).every((docs) => docs.length === 0),
      ).toBe(true);
    });
  });

  describe("generateExplanationTemplates", () => {
    it("should generate templates with citations", async () => {
      const mockCitations = [
        {
          domain: "ao",
          excerpt: "Best practices documentation",
          relevance: 0.9,
          source: "best-practices.com",
          title: "Architecture Best Practices",
        },
        {
          domain: "ao",
          excerpt: "Example implementations",
          relevance: 0.8,
          source: "examples.com",
          title: "Implementation Examples",
        },
      ];

      const result = await service.generateExplanationTemplates(
        "stateful",
        "moderate",
        mockCitations,
      );

      expect(result.architectureTemplate).toContain("stateful Architecture");
      expect(result.architectureTemplate).toContain(
        "Architecture Best Practices",
      );
      expect(result.implementationTemplate).toContain(
        "Implementation Template",
      );
      expect(result.implementationTemplate).toContain("moderate complexity");
      expect(result.validationTemplate).toContain("Validation Checklist");
      expect(result.validationTemplate).toContain(
        "Input validation implemented",
      );
    });

    it("should handle different process types and complexities", async () => {
      const mockCitations = [
        {
          domain: "ao",
          excerpt: "Simple implementation guide",
          relevance: 0.7,
          source: "simple.com",
          title: "Simple Guide",
        },
      ];

      const statelessResult = await service.generateExplanationTemplates(
        "stateless",
        "simple",
        mockCitations,
      );

      expect(statelessResult.architectureTemplate).toContain(
        "stateless Architecture",
      );
      expect(statelessResult.validationTemplate).toContain(
        "stateless Architecture",
      );

      const multiProcessResult = await service.generateExplanationTemplates(
        "multi-process",
        "complex",
        mockCitations,
      );

      expect(multiProcessResult.architectureTemplate).toContain(
        "multi-process Architecture",
      );
      expect(multiProcessResult.implementationTemplate).toContain(
        "complex complexity",
      );
    });
  });

  describe("private method functionality", () => {
    it("should generate appropriate reasoning for different patterns", async () => {
      const tokenRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Token contract",
      };

      const daoRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "DAO governance",
      };

      // Test via generateArchitectureExplanation which uses these private methods
      const tokenRecommendation: ArchitectureRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token contract",
          documentation: [],
          name: "Token System",
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

      const tokenResult = await service.generateArchitectureExplanation(
        tokenRecommendation,
        tokenRequirements,
      );

      expect(tokenResult.reasoning.processTypeReasoning).toContain(
        "token balance management",
      );
      expect(tokenResult.reasoning.stateManagementReasoning).toContain(
        "token balance updates",
      );

      const daoRecommendation: ArchitectureRecommendation = {
        ...tokenRecommendation,
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "hybrid",
        },
      };

      const daoResult = await service.generateArchitectureExplanation(
        daoRecommendation,
        daoRequirements,
      );

      expect(daoResult.reasoning.processTypeReasoning).toContain(
        "governance state",
      );
      expect(daoResult.reasoning.stateManagementReasoning).toContain(
        "immutable governance rules with mutable voting data",
      );
    });
  });

  describe("error handling", () => {
    it("should handle generateArchitectureExplanation errors", async () => {
      const mockRecommendation: any = {};
      const mockRequirements: any = {};

      // Mock internal method to throw error
      vi.spyOn(service as any, "generateOverview").mockImplementation(() => {
        throw new Error("Overview generation failed");
      });

      await expect(
        service.generateArchitectureExplanation(
          mockRecommendation,
          mockRequirements,
        ),
      ).rejects.toThrow(
        "ArchitectureExplanationService.generateArchitectureExplanation failed",
      );
    });

    it("should handle createDocumentationCitationSystem errors", async () => {
      const mockRecommendation: any = {};

      // Mock internal method to throw error
      vi.spyOn(
        service as any,
        "consolidateDocumentationCitations",
      ).mockImplementation(() => {
        throw new Error("Citation consolidation failed");
      });

      await expect(
        service.createDocumentationCitationSystem(mockRecommendation),
      ).rejects.toThrow(
        "ArchitectureExplanationService.createDocumentationCitationSystem failed",
      );
    });

    it("should handle generateExplanationTemplates errors", async () => {
      const mockCitations: any[] = [];

      // Mock internal method to throw error
      vi.spyOn(service as any, "createArchitectureTemplate").mockImplementation(
        () => {
          throw new Error("Template creation failed");
        },
      );

      await expect(
        service.generateExplanationTemplates(
          "stateless",
          "simple",
          mockCitations,
        ),
      ).rejects.toThrow(
        "ArchitectureExplanationService.generateExplanationTemplates failed",
      );
    });
  });
});
