import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PermawebDocsResponse,
  PermawebDocsResult,
} from "../../../src/services/PermawebDocsService.js";
import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";
import { ProcessArchitectureAnalysisService } from "../../../src/services/ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

// Mock the services
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({
    queryPermawebDocs: vi.fn(),
  })),
}));

vi.mock("../../../src/services/RequirementAnalysisService.js", () => ({
  RequirementAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeRequirements: vi.fn(),
  })),
}));

describe("ProcessArchitectureAnalysisService", () => {
  let service: ProcessArchitectureAnalysisService;
  let mockPermawebDocsService: any;
  let mockRequirementAnalysisService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    mockRequirementAnalysisService = new RequirementAnalysisService();
    service = new ProcessArchitectureAnalysisService(
      mockPermawebDocsService,
      mockRequirementAnalysisService,
    );
  });

  describe("analyzeArchitecturalPatterns", () => {
    it("should analyze architectural patterns from user request", async () => {
      const userRequest = "Create a token contract with transfer capabilities";
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "transfer", "contract"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest,
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract
          This is a stateful token contract with handlers for transfer, balance, and mint operations.
          Handlers.add("transfer", function(msg) {
            -- Transfer logic with state management
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token-contract",
        },
      ];

      const mockDocsResponse: PermawebDocsResponse = {
        results: mockDocs,
        sources: ["ao"],
        totalResults: 1,
      };

      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );
      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue(
        mockDocsResponse,
      );

      const result = await service.analyzeArchitecturalPatterns(userRequest);

      expect(result).toBeDefined();
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].processType).toBe("stateful");
      expect(result.patterns[0].complexity).toBe("moderate");
      expect(result.patterns[0].stateManagement).toBe("mutable");
      expect(result.totalPatternsAnalyzed).toBe(1);
      expect(result.documentationCoverage).toHaveLength(1);
      expect(result.documentationCoverage[0].domain).toBe("ao");
      expect(result.processTypes).toBeDefined();
      expect(result.processTypes.stateful.patterns).toHaveLength(1);
    });

    it("should handle stateless process patterns", async () => {
      const userRequest = "Create a simple request-response handler";
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["request", "response", "handler"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest,
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Simple Handler
          This is a stateless handler with no state management.
          Handlers.add("info", function(msg) {
            -- Pure function returning info
            return "Hello World"
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/simple-handler",
        },
      ];

      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );
      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: mockDocs,
        sources: ["ao"],
        totalResults: 1,
      });

      const result = await service.analyzeArchitecturalPatterns(userRequest);

      expect(result.patterns[0].processType).toBe("stateless");
      expect(result.patterns[0].complexity).toBe("simple");
      expect(result.patterns[0].stateManagement).toBe("none");
      expect(result.processTypes.stateless.patterns).toHaveLength(1);
    });

    it("should handle multi-process patterns", async () => {
      const userRequest =
        "Create a distributed system with multiple communicating processes";
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["process-communication"],
        extractedKeywords: ["distributed", "processes", "communication"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest,
      };

      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Multi-Process System
          This is a complex multi-process distributed system with inter-process communication.
          -- Spawn multiple processes and coordinate between them
          local processId = ao.spawn()
          ao.send({Target = processId, Action = "Initialize"})`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.95,
          url: "https://example.com/multi-process",
        },
      ];

      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );
      mockPermawebDocsService.queryPermawebDocs.mockResolvedValue({
        results: mockDocs,
        sources: ["ao"],
        totalResults: 1,
      });

      const result = await service.analyzeArchitecturalPatterns(userRequest);

      expect(result.patterns[0].processType).toBe("multi-process");
      expect(result.patterns[0].complexity).toBe("complex");
      expect(result.processTypes.multiProcess.patterns).toHaveLength(1);
    });

    it("should handle error when requirement analysis fails", async () => {
      const userRequest = "Invalid request";
      mockRequirementAnalysisService.analyzeRequirements.mockRejectedValue(
        new Error("Analysis failed"),
      );

      await expect(
        service.analyzeArchitecturalPatterns(userRequest),
      ).rejects.toThrow(
        "ProcessArchitectureAnalysisService.analyzeArchitecturalPatterns failed",
      );
    });

    it("should handle error when documentation query fails", async () => {
      const userRequest = "Create a token contract";
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "contract"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest,
      };

      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        mockRequirements,
      );
      mockPermawebDocsService.queryPermawebDocs.mockRejectedValue(
        new Error("Query failed"),
      );

      await expect(
        service.analyzeArchitecturalPatterns(userRequest),
      ).rejects.toThrow(
        "ProcessArchitectureAnalysisService.analyzeArchitecturalPatterns failed",
      );
    });
  });

  describe("extractProcessArchitectures", () => {
    it("should extract multiple patterns from documentation", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract
          Stateful token with balance tracking.
          Handlers.add("transfer", function(msg) {
            -- Transfer with state modification
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token",
        },
        {
          content: `# Simple Calculator
          Stateless calculator service.
          Handlers.add("calculate", function(msg) {
            return msg.a + msg.b
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/calculator",
        },
      ];

      const result = await service.extractProcessArchitectures(mockDocs);

      expect(result).toHaveLength(2);
      expect(result[0].processType).toBe("stateful");
      expect(result[1].processType).toBe("stateless");
    });

    it("should handle documents with no clear patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: "Generic documentation without specific patterns",
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.5,
          url: "https://example.com/generic",
        },
      ];

      const result = await service.extractProcessArchitectures(mockDocs);

      expect(result).toHaveLength(1);
      expect(result[0].processType).toBe("stateless"); // Default
      expect(result[0].complexity).toBe("simple"); // Default
    });

    it("should deduplicate similar patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract 1
          Stateful token with handlers.
          Handlers.add("transfer", function(msg) {
            -- Transfer logic
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token1",
        },
        {
          content: `# Token Contract 2
          Another stateful token implementation.
          Handlers.add("balance", function(msg) {
            -- Balance logic
          })`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.85,
          url: "https://example.com/token2",
        },
      ];

      const result = await service.extractProcessArchitectures(mockDocs);

      // Should merge similar patterns
      expect(result).toHaveLength(1);
      expect(result[0].examples).toHaveLength(2);
    });
  });

  describe("categorizeArchitecturalApproaches", () => {
    it("should categorize patterns by process type", async () => {
      const mockPatterns = [
        {
          complexity: "simple" as const,
          description: "Simple stateless process",
          examples: [],
          handlerPatterns: ["standard-handler"],
          messageTypes: ["info"],
          name: "simple-stateless-none",
          processType: "stateless" as const,
          stateManagement: "none" as const,
        },
        {
          complexity: "moderate" as const,
          description: "Moderate stateful process",
          examples: [],
          handlerPatterns: ["request-response"],
          messageTypes: ["transfer"],
          name: "moderate-stateful-mutable",
          processType: "stateful" as const,
          stateManagement: "mutable" as const,
        },
        {
          complexity: "complex" as const,
          description: "Complex multi-process system",
          examples: [],
          handlerPatterns: ["event-driven"],
          messageTypes: ["coordinate"],
          name: "complex-multi-process-external",
          processType: "multi-process" as const,
          stateManagement: "external" as const,
        },
      ];

      const result =
        await service.categorizeArchitecturalApproaches(mockPatterns);

      expect(result.stateless.patterns).toHaveLength(1);
      expect(result.stateful.patterns).toHaveLength(1);
      expect(result.multiProcess.patterns).toHaveLength(1);

      expect(result.stateless.advantages).toContain(
        "Simple to reason about and test",
      );
      expect(result.stateful.advantages).toContain(
        "Persistent data across interactions",
      );
      expect(result.multiProcess.advantages).toContain(
        "Distributed processing capabilities",
      );
    });

    it("should extract use cases from patterns", async () => {
      const mockPatterns = [
        {
          complexity: "moderate" as const,
          description: "Token contract pattern",
          examples: [
            {
              domain: "ao" as const,
              excerpt: "Token transfer example",
              relevance: 0.9,
              source: "test",
              title: "Token Transfer System",
            },
          ],
          handlerPatterns: ["standard-handler"],
          messageTypes: ["transfer"],
          name: "token-pattern",
          processType: "stateful" as const,
          stateManagement: "mutable" as const,
        },
      ];

      const result =
        await service.categorizeArchitecturalApproaches(mockPatterns);

      expect(result.stateful.useCases).toContain(
        "Token contracts and currency systems",
      );
    });
  });

  describe("createPatternCategorization", () => {
    it("should create comprehensive pattern categorization", async () => {
      const mockPatterns = [
        {
          complexity: "simple" as const,
          description: "Simple token contract",
          examples: [],
          handlerPatterns: ["standard-handler"],
          messageTypes: ["info"],
          name: "simple-stateless-none",
          processType: "stateless" as const,
          stateManagement: "none" as const,
        },
        {
          complexity: "moderate" as const,
          description: "DAO governance system",
          examples: [],
          handlerPatterns: ["request-response"],
          messageTypes: ["vote"],
          name: "moderate-stateful-mutable",
          processType: "stateful" as const,
          stateManagement: "mutable" as const,
        },
      ];

      const result = await service.createPatternCategorization(mockPatterns);

      expect(result.byComplexity.simple).toHaveLength(1);
      expect(result.byComplexity.moderate).toHaveLength(1);
      expect(result.byProcessType.stateless).toHaveLength(1);
      expect(result.byProcessType.stateful).toHaveLength(1);
      expect(result.byStateManagement.none).toHaveLength(1);
      expect(result.byStateManagement.mutable).toHaveLength(1);
      expect(result.byUseCaseCategory["token-contracts"]).toHaveLength(1);
      expect(result.byUseCaseCategory["dao-governance"]).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("should handle extractProcessArchitectures error", async () => {
      const mockDocs: PermawebDocsResult[] = [];

      // Mock internal method to throw error
      vi.spyOn(
        service as any,
        "extractPatternsFromDocument",
      ).mockImplementation(() => {
        throw new Error("Pattern extraction failed");
      });

      await expect(
        service.extractProcessArchitectures(mockDocs),
      ).rejects.toThrow(
        "ProcessArchitectureAnalysisService.extractProcessArchitectures failed",
      );
    });

    it("should handle categorizeArchitecturalApproaches error", async () => {
      const mockPatterns: any[] = [];

      // Mock internal method to throw error
      vi.spyOn(service as any, "extractUseCases").mockImplementation(() => {
        throw new Error("Use case extraction failed");
      });

      await expect(
        service.categorizeArchitecturalApproaches(mockPatterns),
      ).rejects.toThrow(
        "ProcessArchitectureAnalysisService.categorizeArchitecturalApproaches failed",
      );
    });

    it("should handle createPatternCategorization error", async () => {
      const mockPatterns: any[] = [];

      // Mock internal method to throw error
      vi.spyOn(service as any, "groupPatternsByComplexity").mockImplementation(
        () => {
          throw new Error("Grouping failed");
        },
      );

      await expect(
        service.createPatternCategorization(mockPatterns),
      ).rejects.toThrow(
        "ProcessArchitectureAnalysisService.createPatternCategorization failed",
      );
    });
  });
});
