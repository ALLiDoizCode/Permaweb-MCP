import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodeExplanationService } from "../../../src/services/CodeExplanationService.js";
import { LuaCodeGeneratorService } from "../../../src/services/LuaCodeGeneratorService.js";
import { LuaWorkflowOrchestrationService } from "../../../src/services/LuaWorkflowOrchestrationService.js";
import {
  PermawebDocs,
  PermawebDocsResult,
} from "../../../src/services/PermawebDocsService.js";
import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";
import {
  CodeExplanation,
  LuaCodeResult,
  RequirementAnalysis,
} from "../../../src/types/lua-workflow.js";

// Mock all dependencies
vi.mock("../../../src/services/PermawebDocsService.js");
vi.mock("../../../src/services/RequirementAnalysisService.js");
vi.mock("../../../src/services/LuaCodeGeneratorService.js");
vi.mock("../../../src/services/CodeExplanationService.js");

describe("LuaWorkflowOrchestrationService", () => {
  let service: LuaWorkflowOrchestrationService;
  let mockPermawebDocs: vi.Mocked<PermawebDocs>;
  let mockRequirementAnalysisService: vi.Mocked<RequirementAnalysisService>;
  let mockLuaCodeGeneratorService: vi.Mocked<LuaCodeGeneratorService>;
  let mockCodeExplanationService: vi.Mocked<CodeExplanationService>;

  const mockRequirementAnalysis: RequirementAnalysis = {
    complexity: "moderate",
    detectedPatterns: ["token-contract", "handler"],
    extractedKeywords: ["token", "contract"],
    processType: "stateful",
    suggestedDomains: ["ao"],
    userRequest: "Create a token contract",
  };

  const mockDocsResults: PermawebDocsResult[] = [
    {
      content: "Token contract documentation",
      domain: "ao",
      isFullDocument: false,
      relevanceScore: 8.5,
      url: "https://example.com/token-docs",
    },
  ];

  const mockLuaCodeResult: LuaCodeResult = {
    bestPractices: ["Validate inputs", "Use proper error handling"],
    documentationSources: ["https://example.com/token-docs"],
    explanation: "This generates a token balance handler",
    generatedCode: "Handlers.add('balance', function(msg) end)",
    handlerPatterns: [
      {
        description: "Balance query handler",
        name: "balance-handler",
        template: "template",
        usedPatterns: ["token-contract"],
      },
    ],
    usedTemplates: ["balance-handler"],
  };

  const mockCodeExplanation: CodeExplanation = {
    bestPractices: ["Validate inputs", "Use proper error handling"],
    codeBreakdown: [
      {
        documentationReference: "https://example.com/token-docs",
        explanation: "Handles balance queries",
        section: "Balance Handler",
      },
    ],
    overview: "This code implements a token contract",
    relatedSources: ["AO: Token documentation..."],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPermawebDocs = {
      query: vi.fn(),
    } as any;

    mockRequirementAnalysisService = {
      analyzeRequirements: vi.fn(),
    } as any;

    mockLuaCodeGeneratorService = {
      generateLuaCode: vi.fn(),
    } as any;

    mockCodeExplanationService = {
      explainCode: vi.fn(),
    } as any;

    service = new LuaWorkflowOrchestrationService(
      mockPermawebDocs,
      mockRequirementAnalysisService,
      mockLuaCodeGeneratorService,
      mockCodeExplanationService,
    );

    // Setup default mock responses
    mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
      mockRequirementAnalysis,
    );
    mockPermawebDocs.query.mockResolvedValue(mockDocsResults);
    mockLuaCodeGeneratorService.generateLuaCode.mockResolvedValue(
      mockLuaCodeResult,
    );
    mockCodeExplanationService.explainCode.mockResolvedValue(
      mockCodeExplanation,
    );
  });

  describe("constructor", () => {
    it("should create with default dependencies when none provided", () => {
      const defaultService = new LuaWorkflowOrchestrationService();
      expect(defaultService).toBeInstanceOf(LuaWorkflowOrchestrationService);
    });

    it("should use provided dependencies", () => {
      expect(service).toBeInstanceOf(LuaWorkflowOrchestrationService);
    });
  });

  describe("orchestrateWorkflow", () => {
    it("should execute complete end-to-end workflow", async () => {
      const userRequest = "Create a token contract";
      const result = await service.orchestrateWorkflow(userRequest);

      expect(result.requirements.analysis).toEqual(mockRequirementAnalysis);
      expect(result.requirements.relevantDocs).toEqual(mockDocsResults);
      expect(result.requirements.confidence).toBeGreaterThan(0);
      expect(result.codeResult).toEqual(mockLuaCodeResult);
      expect(result.explanation).toEqual(mockCodeExplanation);
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify all services were called in correct order
      expect(
        mockRequirementAnalysisService.analyzeRequirements,
      ).toHaveBeenCalledWith(userRequest);
      expect(mockPermawebDocs.query).toHaveBeenCalled();
      expect(mockLuaCodeGeneratorService.generateLuaCode).toHaveBeenCalledWith(
        mockDocsResults,
        mockRequirementAnalysis,
      );
      expect(mockCodeExplanationService.explainCode).toHaveBeenCalledWith(
        mockLuaCodeResult,
        mockDocsResults,
      );
    });

    it("should handle workflow with no documentation results", async () => {
      mockPermawebDocs.query.mockResolvedValue([]);

      const userRequest = "Create a simple handler";
      const result = await service.orchestrateWorkflow(userRequest);

      expect(result.requirements.relevantDocs).toEqual([]);
      expect(result.codeResult).toEqual(mockLuaCodeResult);
      expect(mockLuaCodeGeneratorService.generateLuaCode).toHaveBeenCalledWith(
        [],
        mockRequirementAnalysis,
      );
    });

    it("should calculate confidence based on analysis and docs", async () => {
      const userRequest = "Create a complex DAO with multiple patterns";
      const complexAnalysis: RequirementAnalysis = {
        ...mockRequirementAnalysis,
        complexity: "complex",
        detectedPatterns: [
          "dao-governance",
          "handler",
          "state-management",
          "token-contract",
        ],
      };
      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        complexAnalysis,
      );

      const result = await service.orchestrateWorkflow(userRequest);

      expect(result.requirements.confidence).toBeGreaterThan(0.5);
      expect(result.requirements.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("analyzeAndQuery", () => {
    it("should analyze requirements and query documentation", async () => {
      const userRequest = "Create a token contract";
      const result = await service.analyzeAndQuery(userRequest);

      expect(result.analysis).toEqual(mockRequirementAnalysis);
      expect(result.relevantDocs).toEqual(mockDocsResults);
      expect(result.confidence).toBeGreaterThan(0);

      expect(
        mockRequirementAnalysisService.analyzeRequirements,
      ).toHaveBeenCalledWith(userRequest);
      expect(mockPermawebDocs.query).toHaveBeenCalled();
    });

    it("should handle documentation query failures gracefully", async () => {
      mockPermawebDocs.query.mockRejectedValue(new Error("Network error"));

      const userRequest = "Create a token contract";
      const result = await service.analyzeAndQuery(userRequest);

      expect(result.analysis).toEqual(mockRequirementAnalysis);
      expect(result.relevantDocs).toEqual([]);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should fallback to broader search when no results found", async () => {
      mockPermawebDocs.query
        .mockResolvedValueOnce([]) // First call returns empty
        .mockResolvedValueOnce(mockDocsResults); // Second call returns results

      const userRequest = "Create a token contract";
      const result = await service.analyzeAndQuery(userRequest);

      expect(mockPermawebDocs.query).toHaveBeenCalledTimes(2);
      expect(result.relevantDocs).toEqual(mockDocsResults);
    });
  });

  describe("generateWithExplanation", () => {
    it("should generate code and explanation", async () => {
      const documentedRequirements = {
        analysis: mockRequirementAnalysis,
        confidence: 0.8,
        relevantDocs: mockDocsResults,
      };

      const result = await service.generateWithExplanation(
        documentedRequirements,
      );

      expect(result.codeResult).toEqual(mockLuaCodeResult);
      expect(result.explanation).toEqual(mockCodeExplanation);

      expect(mockLuaCodeGeneratorService.generateLuaCode).toHaveBeenCalledWith(
        mockDocsResults,
        mockRequirementAnalysis,
      );
      expect(mockCodeExplanationService.explainCode).toHaveBeenCalledWith(
        mockLuaCodeResult,
        mockDocsResults,
      );
    });
  });

  describe("interface implementation", () => {
    it("should implement analyzeRequirements interface method", async () => {
      const userRequest = "Create a handler";
      const result = await service.analyzeRequirements(userRequest);

      expect(result).toEqual(mockRequirementAnalysis);
      expect(
        mockRequirementAnalysisService.analyzeRequirements,
      ).toHaveBeenCalledWith(userRequest);
    });

    it("should implement queryRelevantDocs interface method", async () => {
      const result = await service.queryRelevantDocs(mockRequirementAnalysis);

      expect(result).toEqual(mockDocsResults);
      expect(mockPermawebDocs.query).toHaveBeenCalled();
    });

    it("should implement generateLuaCode interface method", async () => {
      const result = await service.generateLuaCode(
        mockDocsResults,
        mockRequirementAnalysis,
      );

      expect(result).toEqual(mockLuaCodeResult);
      expect(mockLuaCodeGeneratorService.generateLuaCode).toHaveBeenCalledWith(
        mockDocsResults,
        mockRequirementAnalysis,
      );
    });

    it("should implement explainCode interface method", async () => {
      const result = await service.explainCode(
        mockLuaCodeResult,
        mockDocsResults,
      );

      expect(result).toEqual(mockCodeExplanation);
      expect(mockCodeExplanationService.explainCode).toHaveBeenCalledWith(
        mockLuaCodeResult,
        mockDocsResults,
      );
    });
  });

  describe("private methods functionality", () => {
    it("should build appropriate documentation query", async () => {
      await service.queryRelevantDocs(mockRequirementAnalysis);

      const callArgs = mockPermawebDocs.query.mock.calls[0];
      expect(callArgs[0]).toContain("Create a token contract");
      expect(callArgs[1]).toEqual(["ao"]); // suggestedDomains
      expect(callArgs[2]).toBe(15); // maxResults for moderate complexity
    });

    it("should adjust maxResults based on complexity", async () => {
      // Test simple complexity
      const simpleAnalysis: RequirementAnalysis = {
        ...mockRequirementAnalysis,
        complexity: "simple",
      };
      await service.queryRelevantDocs(simpleAnalysis);
      expect(mockPermawebDocs.query.mock.calls[0][2]).toBe(10);

      // Test complex complexity
      const complexAnalysis: RequirementAnalysis = {
        ...mockRequirementAnalysis,
        complexity: "complex",
      };
      await service.queryRelevantDocs(complexAnalysis);
      expect(mockPermawebDocs.query.mock.calls[1][2]).toBe(25);
    });

    it("should calculate confidence based on multiple factors", async () => {
      const highQualityAnalysis: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: [
          "token-contract",
          "dao-governance",
          "handler",
          "state-management",
        ],
        extractedKeywords: [
          "token",
          "dao",
          "system",
          "comprehensive",
          "governance",
          "voting",
        ],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a comprehensive token DAO system",
      };

      const manyDocsResults: PermawebDocsResult[] = [
        ...mockDocsResults,
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            ...mockDocsResults[0],
            url: `https://example.com/docs-${i}`,
          })),
      ];

      mockRequirementAnalysisService.analyzeRequirements.mockResolvedValue(
        highQualityAnalysis,
      );
      mockPermawebDocs.query.mockResolvedValue(manyDocsResults);

      const result = await service.analyzeAndQuery("test request");

      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("error handling", () => {
    it("should handle requirement analysis errors", async () => {
      mockRequirementAnalysisService.analyzeRequirements.mockRejectedValue(
        new Error("Analysis failed"),
      );

      await expect(service.orchestrateWorkflow("test")).rejects.toThrow(
        "Analysis failed",
      );
    });

    it("should handle code generation errors", async () => {
      mockLuaCodeGeneratorService.generateLuaCode.mockRejectedValue(
        new Error("Code generation failed"),
      );

      await expect(service.orchestrateWorkflow("test")).rejects.toThrow(
        "Code generation failed",
      );
    });

    it("should handle explanation generation errors", async () => {
      mockCodeExplanationService.explainCode.mockRejectedValue(
        new Error("Explanation failed"),
      );

      await expect(service.orchestrateWorkflow("test")).rejects.toThrow(
        "Explanation failed",
      );
    });
  });
});
