import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PermawebDocsResponse,
  PermawebDocsResult,
} from "../../../src/services/PermawebDocsService.js";
import type { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

import { HandlerPatternRecommendationService } from "../../../src/services/HandlerPatternRecommendationService.js";
import { PermawebDocsService } from "../../../src/services/PermawebDocsService.js";
import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

// Mock the services
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocsService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/services/RequirementAnalysisService.js", () => ({
  RequirementAnalysisService: vi.fn().mockImplementation(() => ({})),
}));

describe("HandlerPatternRecommendationService", () => {
  let service: HandlerPatternRecommendationService;
  let mockPermawebDocsService: any;
  let mockRequirementAnalysisService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocsService = new PermawebDocsService();
    mockRequirementAnalysisService = new RequirementAnalysisService();
    service = new HandlerPatternRecommendationService(
      mockPermawebDocsService,
      mockRequirementAnalysisService,
    );
  });

  describe("analyzeMessagePatterns", () => {
    it("should analyze message patterns from documentation", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Token Contract
          Handlers.add("transfer", function(msg)
            -- Handle token transfer
            local amount = tonumber(msg.Tags.Amount)
            balances[msg.Tags.Recipient] = amount
          end)
          
          Handlers.add("balance", function(msg)
            -- Return balance
            return balances[msg.From] or 0
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/token",
        },
        {
          content: `# Event System
          Handlers.add("notify", function(msg)
            -- Emit event
            ao.send({
              Target = ao.id,
              Action = "notification-sent"
            })
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/events",
        },
      ];

      const result = await service.analyzeMessagePatterns(mockDocs);

      expect(result).toBeDefined();
      expect(result.commonPatterns.length).toBeGreaterThanOrEqual(2);
      expect(result.messageTypes).toHaveLength(3);
      expect(result.routingStrategies).toHaveLength(3);

      // Check for standard handler pattern
      const standardPattern = result.commonPatterns.find(
        (p) => p.pattern === "standard-handler",
      );
      expect(standardPattern).toBeDefined();
      expect(standardPattern!.frequency).toBe(3); // transfer, balance, notify

      // Check message types
      const messageTypes = result.messageTypes.map((mt) => mt.type);
      expect(messageTypes).toContain("transfer");
      expect(messageTypes).toContain("balance");
      expect(messageTypes).toContain("notify");
    });

    it("should detect stateful patterns in documentation", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Stateful Process
          local state = { count = 0, users = {} }
          
          Handlers.add("increment", function(msg)
            state.count = state.count + 1
            return state.count
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/stateful",
        },
      ];

      const result = await service.analyzeMessagePatterns(mockDocs);

      const statefulPattern = result.commonPatterns.find(
        (p) => p.pattern === "stateful",
      );
      expect(statefulPattern).toBeDefined();
      expect(statefulPattern!.frequency).toBe(1);
    });

    it("should detect event-driven patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Event-Driven System
          Handlers.add("process", function(msg)
            -- Process data
            local result = processData(msg.Data)
            
            -- Emit event
            ao.send({
              Target = ao.id,
              Action = "data-processed",
              Data = result
            })
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.9,
          url: "https://example.com/events",
        },
      ];

      const result = await service.analyzeMessagePatterns(mockDocs);

      const eventPattern = result.commonPatterns.find(
        (p) => p.pattern === "event-driven",
      );
      expect(eventPattern).toBeDefined();
    });

    it("should detect batch processing patterns", async () => {
      const mockDocs: PermawebDocsResult[] = [
        {
          content: `# Batch Processing
          Handlers.add("batch-process", function(msg)
            local batch = json.decode(msg.Data)
            for i, item in ipairs(batch.items) do
              processSingleItem(item)
            end
          end)`,
          domain: "ao",
          isFullDocument: true,
          relevanceScore: 0.8,
          url: "https://example.com/batch",
        },
      ];

      const result = await service.analyzeMessagePatterns(mockDocs);

      const batchPattern = result.commonPatterns.find(
        (p) => p.pattern === "batch-processing",
      );
      expect(batchPattern).toBeDefined();
    });
  });

  describe("recommendHandlerStructure", () => {
    it("should recommend handler structure for token contract", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "transfer", "balance"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract",
      };

      const mockMessagePatterns = {
        commonPatterns: [
          {
            examples: [],
            frequency: 3,
            pattern: "stateful",
            useCases: ["Token operations"],
          },
        ],
        messageTypes: [
          {
            description: "Handle token transfers",
            documentation: [],
            handlerPattern: "stateful-handler",
            type: "transfer",
          },
        ],
        routingStrategies: [],
      };

      const result = await service.recommendHandlerStructure(
        mockMessagePatterns,
        mockRequirements,
      );

      expect(result).toBeDefined();
      expect(result.structure.primary).toHaveLength(3); // transfer, balance, info
      expect(result.structure.secondary).toHaveLength(2); // status, config
      expect(result.structure.utility).toHaveLength(2); // health, version

      // Check primary handlers
      const handlerNames = result.structure.primary.map((h) => h.name);
      expect(handlerNames).toContain("Transfer Handler");
      expect(handlerNames).toContain("Balance Handler");
      expect(handlerNames).toContain("Info Handler");

      // Check message flow
      expect(result.messageFlow.inbound).toContain("transfer");
      expect(result.messageFlow.internal).toContain("health");
    });

    it("should recommend handler structure for DAO governance", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao", "vote", "proposal", "governance"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a DAO governance system",
      };

      const mockMessagePatterns = {
        commonPatterns: [
          {
            examples: [],
            frequency: 2,
            pattern: "event-driven",
            useCases: ["Governance operations"],
          },
        ],
        messageTypes: [
          {
            description: "Handle voting",
            documentation: [],
            handlerPattern: "event-driven",
            type: "vote",
          },
        ],
        routingStrategies: [],
      };

      const result = await service.recommendHandlerStructure(
        mockMessagePatterns,
        mockRequirements,
      );

      expect(result.structure.primary).toHaveLength(3); // vote, proposal, register
      expect(result.structure.secondary).toHaveLength(4); // status, config, monitor, admin
      expect(result.structure.utility).toHaveLength(3); // health, version, error

      const primaryHandlers = result.structure.primary.map((h) => h.name);
      expect(primaryHandlers).toContain("Vote Handler");
      expect(primaryHandlers).toContain("Proposal Handler");
      expect(primaryHandlers).toContain("Register Handler");
    });

    it("should recommend simple handler structure for basic requests", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["handler"],
        extractedKeywords: ["process", "message"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create a simple message processor",
      };

      const mockMessagePatterns = {
        commonPatterns: [
          {
            examples: [],
            frequency: 1,
            pattern: "standard-handler",
            useCases: ["Message processing"],
          },
        ],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.recommendHandlerStructure(
        mockMessagePatterns,
        mockRequirements,
      );

      expect(result.structure.primary).toHaveLength(1); // process
      expect(result.structure.secondary).toHaveLength(0); // none for simple
      expect(result.structure.utility).toHaveLength(2); // health, version

      expect(result.structure.primary[0].name).toBe("Process Handler");
    });

    it("should generate default handler when no patterns detected", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create something",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.recommendHandlerStructure(
        mockMessagePatterns,
        mockRequirements,
      );

      expect(result.structure.primary).toHaveLength(1);
      expect(result.structure.primary[0].name).toBe("Info Handler");
    });
  });

  describe("generateHandlerTemplates", () => {
    it("should generate templates for token contract patterns", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "transfer"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.generateHandlerTemplates(
        mockRequirements,
        mockMessagePatterns,
      );

      expect(result).toHaveLength(2); // token pattern + health utility
      expect(result[0].name).toBe("Token Contract Handler Pattern");
      expect(result[0].complexity).toBe("moderate");
      expect(result[0].template).toContain("Handlers.add");
    });

    it("should generate templates for DAO governance patterns", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao", "vote"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a DAO system",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.generateHandlerTemplates(
        mockRequirements,
        mockMessagePatterns,
      );

      expect(result[0].name).toBe("DAO Governance Handler Pattern");
      expect(result[0].useCases).toContain("Voting");
      expect(result[0].template).toContain("ao.send");
    });

    it("should generate default templates when no patterns detected", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create something",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.generateHandlerTemplates(
        mockRequirements,
        mockMessagePatterns,
      );

      expect(result).toHaveLength(2); // default + health utility
      expect(result[0].name).toBe("Standard Handler");
      expect(result[0].complexity).toBe("simple");
    });

    it("should generate appropriate templates for different complexity levels", async () => {
      const complexRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["handler"],
        extractedKeywords: ["complex"],
        processType: "multi-process",
        suggestedDomains: ["ao"],
        userRequest: "Create complex system",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      const result = await service.generateHandlerTemplates(
        complexRequirements,
        mockMessagePatterns,
      );

      const handlerTemplate = result.find(
        (t) => t.name === "Generic Handler Pattern",
      );
      expect(handlerTemplate).toBeDefined();
      expect(handlerTemplate!.complexity).toBe("complex");
    });
  });

  describe("validateHandlerPatterns", () => {
    it("should validate correct handler patterns", async () => {
      const validTemplates = [
        {
          complexity: "simple" as const,
          description: "A valid handler",
          documentation: [],
          name: "Valid Handler",
          template: `Handlers.add("test", function(msg)
            local result = msg.Data
            return result
          end)`,
          useCases: ["Testing"],
        },
      ];

      const result = await service.validateHandlerPatterns(validTemplates);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing function signature", async () => {
      const invalidTemplates = [
        {
          complexity: "simple" as const,
          description: "Missing function signature",
          documentation: [],
          name: "Invalid Handler",
          template: `Handlers.add("test", {
            -- Not a proper function
          })`,
          useCases: ["Testing"],
        },
      ];

      const result = await service.validateHandlerPatterns(invalidTemplates);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Handler Invalid Handler does not follow standard function signature",
      );
    });

    it("should warn about missing validation in complex handlers", async () => {
      const complexTemplates = [
        {
          complexity: "complex" as const,
          description: "Complex handler missing validation",
          documentation: [],
          name: "Complex Handler Without Validation",
          template: `Handlers.add("test", function(msg)
            -- No validation logic
            return "result"
          end)`,
          useCases: ["Testing"],
        },
      ];

      const result = await service.validateHandlerPatterns(complexTemplates);

      expect(result.warnings).toContain(
        "Complex handler Complex Handler Without Validation should include validation logic",
      );
    });

    it("should warn about missing return statements", async () => {
      const templatesWithoutReturn = [
        {
          complexity: "simple" as const,
          description: "Handler without return statement",
          documentation: [],
          name: "Handler Without Return",
          template: `Handlers.add("test", function(msg)
            local result = msg.Data
            -- No return statement
          end)`,
          useCases: ["Testing"],
        },
      ];

      const result = await service.validateHandlerPatterns(
        templatesWithoutReturn,
      );

      expect(result.warnings).toContain(
        "Handler Handler Without Return should return a value",
      );
    });

    it("should warn about missing state management in stateful handlers", async () => {
      const statefulTemplates = [
        {
          complexity: "moderate" as const,
          description: "Stateful handler without state management",
          documentation: [],
          name: "Stateful Handler Without State",
          template: `Handlers.add("test", function(msg)
            return "result"
          end)`,
          useCases: ["Testing"],
        },
      ];

      const result = await service.validateHandlerPatterns(statefulTemplates);

      expect(result.warnings).toContain(
        "Stateful handler Stateful Handler Without State should manage state explicitly",
      );
    });
  });

  describe("error handling", () => {
    it("should handle analyzeMessagePatterns errors", async () => {
      const mockDocs: PermawebDocsResult[] = [];

      // Mock internal method to throw error
      vi.spyOn(service as any, "extractCommonPatterns").mockRejectedValue(
        new Error("Pattern extraction failed"),
      );

      await expect(service.analyzeMessagePatterns(mockDocs)).rejects.toThrow(
        "HandlerPatternRecommendationService.analyzeMessagePatterns failed",
      );
    });

    it("should handle recommendHandlerStructure errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "generatePrimaryHandlers").mockRejectedValue(
        new Error("Handler generation failed"),
      );

      await expect(
        service.recommendHandlerStructure(
          mockMessagePatterns,
          mockRequirements,
        ),
      ).rejects.toThrow(
        "HandlerPatternRecommendationService.recommendHandlerStructure failed",
      );
    });

    it("should handle generateHandlerTemplates errors", async () => {
      const mockRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: [],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Test",
      };

      const mockMessagePatterns = {
        commonPatterns: [],
        messageTypes: [],
        routingStrategies: [],
      };

      // Mock internal method to throw error
      vi.spyOn(service as any, "createDefaultTemplate").mockImplementation(
        () => {
          throw new Error("Template creation failed");
        },
      );

      await expect(
        service.generateHandlerTemplates(mockRequirements, mockMessagePatterns),
      ).rejects.toThrow(
        "HandlerPatternRecommendationService.generateHandlerTemplates failed",
      );
    });

    it("should handle validateHandlerPatterns errors", async () => {
      const mockTemplates: any[] = [];

      // Mock to throw error during validation
      vi.spyOn(Array.prototype, "forEach").mockImplementation(() => {
        throw new Error("Validation failed");
      });

      await expect(
        service.validateHandlerPatterns(mockTemplates),
      ).rejects.toThrow(
        "HandlerPatternRecommendationService.validateHandlerPatterns failed",
      );

      // Restore the mock
      vi.restoreAllMocks();
    });
  });
});
