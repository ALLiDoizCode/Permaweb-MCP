import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/models/ToolContext.js";
import { AnalyzeProcessArchitectureCommand } from "../../../../src/tools/process/commands/AnalyzeProcessArchitectureCommand.js";

// Mock all the service dependencies
vi.mock(
  "../../../../src/services/ProcessArchitectureAnalysisService.js",
  () => ({
    ProcessArchitectureAnalysisService: vi.fn().mockImplementation(() => ({
      analyzeArchitecturalPatterns: vi.fn(),
    })),
  }),
);

vi.mock("../../../../src/services/ArchitectureDecisionService.js", () => ({
  ArchitectureDecisionService: vi.fn().mockImplementation(() => ({
    generateArchitectureRecommendation: vi.fn(),
  })),
}));

vi.mock(
  "../../../../src/services/HandlerPatternRecommendationService.js",
  () => ({
    HandlerPatternRecommendationService: vi.fn().mockImplementation(() => ({
      analyzeMessagePatterns: vi.fn(),
      recommendHandlerStructure: vi.fn(),
    })),
  }),
);

vi.mock("../../../../src/services/StateManagementGuidanceService.js", () => ({
  StateManagementGuidanceService: vi.fn().mockImplementation(() => ({
    generateStateManagementGuidance: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/ErrorHandlingPatternService.js", () => ({
  ErrorHandlingPatternService: vi.fn().mockImplementation(() => ({
    generateErrorHandlingPatterns: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/ArchitectureValidationService.js", () => ({
  ArchitectureValidationService: vi.fn().mockImplementation(() => ({
    findSimilarPatterns: vi.fn(),
    generateValidationReport: vi.fn(),
    scoreArchitectureMatch: vi.fn(),
    validateBestPractices: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/ArchitectureExplanationService.js", () => ({
  ArchitectureExplanationService: vi.fn().mockImplementation(() => ({
    generateArchitectureExplanation: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/RequirementAnalysisService.js", () => ({
  RequirementAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeRequirements: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocs: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../../src/services/LuaWorkflowOrchestrationService.js", () => ({
  LuaWorkflowOrchestrationService: vi.fn().mockImplementation(() => ({
    analyzeAndQuery: vi.fn(),
    analyzeRequirements: vi.fn(),
    generateLuaCode: vi.fn(),
  })),
}));

describe("AnalyzeProcessArchitectureCommand", () => {
  let command: AnalyzeProcessArchitectureCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      hubId: "test-hub",
      keyPair: {} as any,
    };
    command = new AnalyzeProcessArchitectureCommand(mockContext);
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validArgs = {
        complexityHint: "moderate" as const,
        detailedExplanation: true,
        focusAreas: ["handlers", "state"] as const,
        includeExamples: true,
        includeValidation: true,
        userRequest: "Create a token contract with transfer capabilities",
      };

      expect(() => {
        command["parametersSchema"].parse(validArgs);
      }).not.toThrow();
    });

    it("should require userRequest", () => {
      const invalidArgs = {
        complexityHint: "simple" as const,
      };

      expect(() => {
        command["parametersSchema"].parse(invalidArgs);
      }).toThrow();
    });

    it("should validate userRequest length", () => {
      const shortRequest = {
        userRequest: "short", // Too short (< 10 chars)
      };

      expect(() => {
        command["parametersSchema"].parse(shortRequest);
      }).toThrow();

      const longRequest = {
        userRequest: "a".repeat(1001), // Too long (> 1000 chars)
      };

      expect(() => {
        command["parametersSchema"].parse(longRequest);
      }).toThrow();
    });

    it("should validate complexityHint enum values", () => {
      const invalidComplexity = {
        complexityHint: "invalid" as any,
        userRequest: "Valid request text here",
      };

      expect(() => {
        command["parametersSchema"].parse(invalidComplexity);
      }).toThrow();
    });

    it("should validate focusAreas enum values", () => {
      const invalidFocusArea = {
        focusAreas: ["handlers", "invalid"] as any,
        userRequest: "Valid request text here",
      };

      expect(() => {
        command["parametersSchema"].parse(invalidFocusArea);
      }).toThrow();
    });

    it("should use default values", () => {
      const minimalArgs = {
        userRequest: "Create a simple process",
      };

      const parsed = command["parametersSchema"].parse(minimalArgs);

      expect(parsed.complexityHint).toBe("auto");
      expect(parsed.includeExamples).toBe(true);
      expect(parsed.includeValidation).toBe(true);
      expect(parsed.detailedExplanation).toBe(true);
    });
  });

  describe("execute", () => {
    it("should execute complete analysis for token contract", async () => {
      // Mock service responses
      const mockRequirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "contract"],
        processType: "stateful" as const,
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract",
      };

      const mockPatternAnalysis = {
        documentationCoverage: [{ domain: "ao", patternsFound: 1 }],
        patterns: [
          {
            complexity: "moderate",
            name: "token-pattern",
            processType: "stateful",
          },
        ],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      };

      const mockRecommendation = {
        alternativeApproaches: [],
        confidence: 0.8,
        documentationSupport: [],
        errorHandlingPatterns: [
          {
            complexity: "simple",
            description: "Input validation",
            documentation: [],
            implementation: "validation code",
            name: "Basic Validation",
            pattern: "validation pattern",
            useCases: ["Input validation"],
          },
        ],
        handlerRecommendations: [
          {
            complexity: "moderate",
            documentation: [],
            messageTypes: ["transfer"],
            name: "Transfer Handler",
            purpose: "Handle transfers",
            template: "Handlers.add('transfer', function(msg) ... end)",
          },
        ],
        reasoning: ["Good match"],
        recommendedApproach: {
          complexity: "moderate",
          description: "Token system",
          documentation: [],
          name: "Token Contract",
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

      const mockValidationReport = {
        documentation: [],
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
        validation: { errors: [], passed: [], warnings: [] },
      };

      const mockExplanation = {
        bestPractices: [
          "Follow AO conventions",
          "Validate inputs",
          "Handle errors properly",
        ],
        detailedExplanation: "Detailed explanation of the architecture",
        documentationCitations: [
          {
            domain: "ao",
            excerpt: "Token implementation guide",
            relevance: 0.9,
            source: "example.com",
            title: "Token Guide",
          },
        ],
        implementationGuidance: "Implementation guidance for token contract",
        overview: "Token contract architecture overview",
        reasoning: {
          complexityReasoning: "Moderate complexity appropriate for tokens",
          handlerPatternReasoning: "Standard handlers for token operations",
          processTypeReasoning: "Stateful for token balance management",
          stateManagementReasoning: "Mutable state for balance updates",
        },
        relatedPatterns: ["token-patterns", "state-management"],
      };

      // Initialize services before mocking
      command["initializeServices"]();

      // Mock service calls - now uses orchestration service for requirements
      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockResolvedValue(mockRequirements);

      vi.mocked(
        command["architectureAnalysisService"]["analyzeArchitecturalPatterns"],
      ).mockResolvedValue(mockPatternAnalysis);

      vi.mocked(
        command["architectureDecisionService"][
          "generateArchitectureRecommendation"
        ],
      ).mockResolvedValue(mockRecommendation);

      vi.mocked(
        command["handlerPatternService"]["analyzeMessagePatterns"],
      ).mockResolvedValue({
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      });

      vi.mocked(
        command["handlerPatternService"]["recommendHandlerStructure"],
      ).mockResolvedValue({
        messageFlow: { inbound: [], internal: [], outbound: [] },
        patterns: [],
        structure: {
          primary: [mockRecommendation.handlerRecommendations[0]],
          secondary: [],
          utility: [],
        },
      });

      vi.mocked(
        command["stateManagementService"]["generateStateManagementGuidance"],
      ).mockResolvedValue(mockRecommendation.stateManagementGuidance);

      vi.mocked(
        command["errorHandlingService"]["generateErrorHandlingPatterns"],
      ).mockResolvedValue(mockRecommendation.errorHandlingPatterns);

      vi.mocked(
        command["validationService"]["findSimilarPatterns"],
      ).mockResolvedValue({
        averageSimilarity: 0,
        matches: [],
        totalMatches: 0,
      });

      vi.mocked(
        command["validationService"]["scoreArchitectureMatch"],
      ).mockResolvedValue(mockValidationReport.score);

      vi.mocked(
        command["validationService"]["validateBestPractices"],
      ).mockResolvedValue(mockValidationReport.validation);

      vi.mocked(
        command["validationService"]["generateValidationReport"],
      ).mockResolvedValue(mockValidationReport);

      vi.mocked(
        command["explanationService"]["generateArchitectureExplanation"],
      ).mockResolvedValue(mockExplanation);

      const args = {
        complexityHint: "auto" as const,
        detailedExplanation: true,
        includeExamples: true,
        includeValidation: true,
        userRequest: "Create a token contract with transfer capabilities",
      };

      const result = await command.execute(args, mockContext);

      expect(result).toContain("# AO Process Architecture Analysis");
      expect(result).toContain("Token Contract");
      expect(result).toContain("stateful");
      expect(result).toContain("moderate");
      expect(result).toContain("80%"); // confidence
      expect(result).toContain("Transfer Handler");
      expect(result).toContain("Basic Validation");
      expect(result).toContain("85%"); // validation score
      expect(result).toContain("Follow AO conventions");
      expect(result).toContain("Token Guide");
    });

    it("should handle simple stateless process", async () => {
      const mockRequirements = {
        complexity: "simple" as const,
        detectedPatterns: ["handler"],
        extractedKeywords: ["calculator"],
        processType: "stateless" as const,
        suggestedDomains: ["ao"],
        userRequest: "Create a calculator",
      };

      const mockPatternAnalysis = {
        documentationCoverage: [],
        patterns: [],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      };

      const mockRecommendation = {
        alternativeApproaches: [],
        confidence: 0.9,
        documentationSupport: [],
        errorHandlingPatterns: [],
        handlerRecommendations: [],
        reasoning: ["Perfect for calculations"],
        recommendedApproach: {
          complexity: "simple",
          description: "Calculator service",
          documentation: [],
          name: "Simple Calculator",
          processType: "stateless",
          suitableFor: ["Math operations"],
        },
        stateManagementGuidance: {
          alternatives: [],
          bestPractices: [],
          documentation: [],
          patterns: [],
          recommended: "none",
        },
      };

      // Initialize services before mocking
      command["initializeServices"]();

      // Mock minimal service calls - now uses orchestration service
      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockResolvedValue(mockRequirements);

      vi.mocked(
        command["architectureAnalysisService"]["analyzeArchitecturalPatterns"],
      ).mockResolvedValue(mockPatternAnalysis);

      vi.mocked(
        command["architectureDecisionService"][
          "generateArchitectureRecommendation"
        ],
      ).mockResolvedValue(mockRecommendation);

      vi.mocked(
        command["handlerPatternService"]["recommendHandlerStructure"],
      ).mockResolvedValue({
        messageFlow: { inbound: [], internal: [], outbound: [] },
        patterns: [],
        structure: {
          primary: [],
          secondary: [],
          utility: [],
        },
      });

      const args = {
        detailedExplanation: false,
        includeValidation: false,
        userRequest: "Create a simple calculator service",
      };

      const result = await command.execute(args, mockContext);

      expect(result).toContain("Simple Calculator");
      expect(result).toContain("stateless");
      expect(result).toContain("simple");
      expect(result).toContain("90%");
    });

    it("should handle focus areas filtering", async () => {
      const mockRequirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["handler"],
        extractedKeywords: ["process"],
        processType: "stateful" as const,
        suggestedDomains: ["ao"],
        userRequest: "Create a process",
      };

      const mockRecommendation = {
        alternativeApproaches: [],
        confidence: 0.7,
        documentationSupport: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "moderate",
          description: "Test system",
          documentation: [],
          name: "Test Process",
          processType: "stateful",
          suitableFor: ["Testing"],
        },
      };

      // Initialize services before mocking
      command["initializeServices"]();

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockResolvedValue(mockRequirements);

      vi.mocked(
        command["architectureAnalysisService"]["analyzeArchitecturalPatterns"],
      ).mockResolvedValue({
        documentationCoverage: [],
        patterns: [],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      });

      vi.mocked(
        command["architectureDecisionService"][
          "generateArchitectureRecommendation"
        ],
      ).mockResolvedValue(mockRecommendation);

      vi.mocked(
        command["handlerPatternService"]["recommendHandlerStructure"],
      ).mockResolvedValue({
        messageFlow: { inbound: [], internal: [], outbound: [] },
        patterns: [],
        structure: {
          primary: [],
          secondary: [],
          utility: [],
        },
      });

      const args = {
        detailedExplanation: false,
        focusAreas: ["handlers"] as const,
        includeValidation: false,
        userRequest: "Create a process with focus on handlers only",
      };

      const result = await command.execute(args, mockContext);

      expect(result).toContain("Test Process");
      // Should have called handler service but not state management service
      expect(
        command["handlerPatternService"]["analyzeMessagePatterns"],
      ).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Initialize services before mocking
      command["initializeServices"]();

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockRejectedValue(new Error("Requirements analysis failed"));

      const args = {
        userRequest: "Create a problematic process",
      };

      const result = await command.execute(args, mockContext);

      expect(result).toContain("❌ Architecture Analysis Error");
      expect(result).toContain("Requirements analysis failed");
      expect(result).toContain("Create a problematic process");
      expect(result).toContain("Troubleshooting");
    });

    it("should handle unknown errors", async () => {
      // Initialize services before mocking
      command["initializeServices"]();

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockRejectedValue("Non-error object");

      const args = {
        userRequest: "Create a process with unknown error",
      };

      const result = await command.execute(args, mockContext);

      expect(result).toContain("❌ Architecture Analysis Error");
      expect(result).toContain("Unknown error occurred");
    });

    it("should generate code preview when includeExamples is true", async () => {
      const mockRequirements = {
        complexity: "simple" as const,
        detectedPatterns: ["calculator"],
        extractedKeywords: ["add", "subtract"],
        processType: "stateless" as const,
        suggestedDomains: ["ao"],
        userRequest: "Create a calculator",
      };

      const mockRecommendation = {
        alternativeApproaches: [],
        confidence: 0.9,
        documentationSupport: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "simple",
          description: "Calculator",
          documentation: [],
          name: "Simple Calculator",
          processType: "stateless",
          suitableFor: ["Math operations"],
        },
      };

      const mockDocumentedRequirements = {
        analysis: mockRequirements,
        confidence: 0.9,
        relevantDocs: [],
      };

      const mockCodeResult = {
        bestPractices: ["Input validation"],
        generatedCode: `-- AO Process: Simple Calculator
Handlers.add('Add', function(msg)
  local a = tonumber(msg.Tags.A)
  local b = tonumber(msg.Tags.B)
  if a and b then
    ao.send({Target = msg.From, Data = tostring(a + b)})
  else
    ao.send({Target = msg.From, Data = "Error: Invalid numbers"})
  end
end)

Handlers.add('Info', function(msg)
  ao.send({Target = msg.From, Data = json.encode({
    protocolVersion = "1.0",
    handlers = {{action = "Add", description = "Add two numbers"}}
  })})
end)`,
        handlerPatterns: [
          { description: "Add two numbers together", name: "Add" },
          { description: "Get process information", name: "Info" },
        ],
        usedTemplates: ["calculator-template"],
      };

      // Initialize services before mocking
      command["initializeServices"]();

      // Mock the orchestration service calls
      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockResolvedValue(mockRequirements);

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeAndQuery"],
      ).mockResolvedValue(mockDocumentedRequirements);

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["generateLuaCode"],
      ).mockResolvedValue(mockCodeResult);

      // Mock other services
      vi.mocked(
        command["architectureAnalysisService"]["analyzeArchitecturalPatterns"],
      ).mockResolvedValue({
        documentationCoverage: [],
        patterns: [],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      });

      vi.mocked(
        command["architectureDecisionService"][
          "generateArchitectureRecommendation"
        ],
      ).mockResolvedValue(mockRecommendation);

      vi.mocked(
        command["handlerPatternService"]["recommendHandlerStructure"],
      ).mockResolvedValue({
        messageFlow: { inbound: [], internal: [], outbound: [] },
        patterns: [],
        structure: {
          primary: [],
          secondary: [],
          utility: [],
        },
      });

      const args = {
        detailedExplanation: true,
        includeExamples: true, // Enable code preview
        includeValidation: false,
        userRequest: "Create a simple calculator",
      };

      const result = await command.execute(args, mockContext);

      // Verify code preview features
      expect(result).toContain("### 💻 Generated Code Preview");
      expect(result).toContain("Handlers.add('Add'");
      expect(result).toContain("**Handler Signatures:**");
      expect(result).toContain("**ADP Compliance Preview:**");
      expect(result).toContain("Info Handler:");
      expect(result).toContain("Handler Registry:");
      expect(result).toContain("Protocol Version:");
      expect(result).toContain("*Performance: Integration");

      // Verify orchestration service was called
      expect(
        command["luaWorkflowOrchestrationService"]["analyzeAndQuery"],
      ).toHaveBeenCalledWith("Create a simple calculator");
      expect(
        command["luaWorkflowOrchestrationService"]["generateLuaCode"],
      ).toHaveBeenCalled();
    });

    it("should not generate code preview when includeExamples is false", async () => {
      const mockRequirements = {
        complexity: "simple" as const,
        detectedPatterns: ["calculator"],
        extractedKeywords: ["add"],
        processType: "stateless" as const,
        suggestedDomains: ["ao"],
        userRequest: "Create a calculator",
      };

      const mockRecommendation = {
        alternativeApproaches: [],
        confidence: 0.9,
        documentationSupport: [],
        reasoning: [],
        recommendedApproach: {
          complexity: "simple",
          description: "Calculator",
          name: "Simple Calculator",
          processType: "stateless",
        },
      };

      // Initialize services before mocking
      command["initializeServices"]();

      vi.mocked(
        command["luaWorkflowOrchestrationService"]["analyzeRequirements"],
      ).mockResolvedValue(mockRequirements);

      vi.mocked(
        command["architectureAnalysisService"]["analyzeArchitecturalPatterns"],
      ).mockResolvedValue({
        documentationCoverage: [],
        patterns: [],
        processTypes: {
          multiProcess: { patterns: [] },
          stateful: { patterns: [] },
          stateless: { patterns: [] },
        },
      });

      vi.mocked(
        command["architectureDecisionService"][
          "generateArchitectureRecommendation"
        ],
      ).mockResolvedValue(mockRecommendation);

      const args = {
        includeExamples: false, // Disable code preview
        includeValidation: false,
        userRequest: "Create a simple calculator",
      };

      const result = await command.execute(args, mockContext);

      // Verify code preview features are NOT present
      expect(result).not.toContain("### 💻 Generated Code Preview");
      expect(result).not.toContain("**Handler Signatures:**");
      expect(result).not.toContain("**ADP Compliance Preview:**");

      // Verify orchestration service was NOT called for code generation
      expect(
        command["luaWorkflowOrchestrationService"]["analyzeAndQuery"],
      ).not.toHaveBeenCalled();
      expect(
        command["luaWorkflowOrchestrationService"]["generateLuaCode"],
      ).not.toHaveBeenCalled();
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(command["metadata"].name).toBe("analyzeProcessArchitecture");
      expect(command["metadata"].title).toContain(
        "Analyze AO Process Architecture",
      );
      expect(command["metadata"].description).toContain("documented patterns");
    });
  });

  describe("service initialization", () => {
    it("should initialize services only once", () => {
      // Access private method to test initialization
      command["initializeServices"]();
      const firstService = command["permawebDocsService"];

      command["initializeServices"]();
      const secondService = command["permawebDocsService"];

      expect(firstService).toBe(secondService);
    });
  });
});
