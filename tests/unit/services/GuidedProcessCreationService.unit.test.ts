import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuidedProcessCreationService } from "../../../src/services/GuidedProcessCreationService.js";
import { LuaWorkflowOrchestrationService } from "../../../src/services/LuaWorkflowOrchestrationService.js";

// Mock the dependencies
vi.mock("../../../src/process.js", () => ({
  createProcess: vi.fn(),
}));

vi.mock("../../../src/relay.js", () => ({
  evalProcess: vi.fn(),
}));

vi.mock("../../../src/services/LuaWorkflowOrchestrationService.js");

describe("GuidedProcessCreationService", () => {
  let service: GuidedProcessCreationService;
  let mockLuaWorkflowService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLuaWorkflowService = {
      analyzeRequirements: vi.fn(),
      generateLuaCode: vi.fn(),
      queryRelevantDocs: vi.fn(),
    };

    service = new GuidedProcessCreationService(mockLuaWorkflowService);
  });

  describe("analyzeRequirements", () => {
    it("should delegate to LuaWorkflowOrchestrationService", async () => {
      const userRequest = "Create a token process";
      const expectedResult = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract" as const],
        extractedKeywords: ["create", "token", "process"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest,
      };

      mockLuaWorkflowService.analyzeRequirements.mockResolvedValue(
        expectedResult,
      );

      const result = await service.analyzeRequirements(userRequest);

      expect(mockLuaWorkflowService.analyzeRequirements).toHaveBeenCalledWith(
        userRequest,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("generateProcessCode", () => {
    it("should generate process code with structure and templates", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract" as const],
        extractedKeywords: ["create", "token", "process"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a token process",
      };

      const docs = [
        {
          content: "Token documentation content",
          domain: "arweave",
          lastUpdated: new Date(),
          title: "Token Guide",
          url: "https://example.com/token-docs",
        },
      ];

      const baseLuaCode = {
        bestPractices: ["Validate inputs"],
        documentationSources: ["https://example.com/token-docs"],
        explanation: "Token balance handler",
        generatedCode: `
Handlers.add(
  "balance",
  Handlers.utils.hasMatchingTag("Action", "Balance"),
  function(msg)
    local balance = Balances[msg.From] or "0"
    ao.send({
      Target = msg.From,
      Action = "Balance-Response",
      Balance = balance
    })
  end
)`,
        handlerPatterns: [],
        usedTemplates: ["balance-handler"],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(mockLuaWorkflowService.generateLuaCode).toHaveBeenCalledWith(
        docs,
        requirements,
      );
      expect(result.templateUsed).toBe("token");
      expect(result.processStructure).toBeDefined();
      expect(result.processStructure.handlers).toHaveLength(1);
      expect(result.processStructure.handlers[0].name).toBe("balance");
      expect(result.testCases).toBeDefined();
      expect(result.deploymentInstructions).toBeDefined();
    });

    it("should determine chatroom template for chat requests", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["create", "chat", "room", "users"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a chat room for users",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Chat room handler",
        generatedCode: "// Basic handler code",
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.templateUsed).toBe("chatroom");
    });

    it("should determine bot template for bot requests", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["create", "helpful", "bot", "agent"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a helpful bot agent",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Bot handler",
        generatedCode: "// Basic handler code",
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.templateUsed).toBe("bot");
    });

    it("should determine game template for game requests", async () => {
      const requirements = {
        complexity: "complex" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["create", "multiplayer", "game"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a multiplayer game",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Game handler",
        generatedCode: "// Basic handler code",
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.templateUsed).toBe("game");
    });

    it("should default to custom template for unrecognized requests", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["create", "something", "unique"],
        processType: "stateless" as const,
        suggestedDomains: [],
        userRequest: "Create something unique",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Custom handler",
        generatedCode: "// Basic handler code",
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.templateUsed).toBe("custom");
    });
  });

  describe("createProcess interface methods", () => {
    it("should throw error for createProcess without keyPair", async () => {
      await expect(service.createProcess()).rejects.toThrow(
        "createProcess requires keyPair - use through MCP tool command",
      );
    });

    it("should throw error for deployCode without keyPair", async () => {
      const processId = "test-process-id";
      const code = {} as any;

      await expect(service.deployCode(processId, code)).rejects.toThrow(
        "deployCode requires keyPair - use through MCP tool command",
      );
    });

    it("should throw error for validateDeployment without keyPair", async () => {
      const processId = "test-process-id";
      const handlers = [] as any;

      await expect(
        service.validateDeployment(processId, handlers),
      ).rejects.toThrow(
        "validateDeployment requires keyPair - use through MCP tool command",
      );
    });
  });

  describe("template determination", () => {
    it("should correctly identify token template from patterns", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract"] as const,
        extractedKeywords: ["create", "process"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a process",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Handler",
        generatedCode: "// Handler code",
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.templateUsed).toBe("token");
    });
  });

  describe("process structure extraction", () => {
    it("should extract handlers from generated code", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: [] as const,
        extractedKeywords: ["create", "process"],
        processType: "stateless" as const,
        suggestedDomains: [],
        userRequest: "Create a process",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Test handlers",
        generatedCode: `
Handlers.add(
  "test-handler",
  Handlers.utils.hasMatchingTag("Action", "Test"),
  function(msg)
    return "test response"
  end
)

Handlers.add(
  "info-handler", 
  Handlers.utils.hasMatchingTag("Action", "Info"),
  function(msg)
    return "info response"
  end
)`,
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.processStructure.handlers).toHaveLength(2);
      expect(result.processStructure.handlers[0].name).toBe("test-handler");
      expect(result.processStructure.handlers[1].name).toBe("info-handler");
    });

    it("should generate test cases for each handler", async () => {
      const requirements = {
        complexity: "moderate" as const,
        detectedPatterns: ["token-contract"] as const,
        extractedKeywords: ["create", "token"],
        processType: "stateful" as const,
        suggestedDomains: [],
        userRequest: "Create a token",
      };

      const docs: any[] = [];
      const baseLuaCode = {
        bestPractices: [],
        documentationSources: [],
        explanation: "Balance handler",
        generatedCode: `
Handlers.add(
  "balance",
  Handlers.utils.hasMatchingTag("Action", "Balance"),
  function(msg)
    return Balances[msg.From] or "0"
  end
)`,
        handlerPatterns: [],
        usedTemplates: [],
      };

      mockLuaWorkflowService.generateLuaCode.mockResolvedValue(baseLuaCode);

      const result = await service.generateProcessCode(requirements, docs);

      expect(result.testCases).toBeDefined();
      expect(result.testCases.length).toBeGreaterThan(0);

      // Should have handler registration test
      const handlerTest = result.testCases.find((t) =>
        t.description.includes("balance handler registration"),
      );
      expect(handlerTest).toBeDefined();

      // Should have template-specific test for token
      const tokenTest = result.testCases.find((t) =>
        t.description.includes("token state initialization"),
      );
      expect(tokenTest).toBeDefined();
    });
  });
});
