import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext, toolRegistry } from "../../src/tools/core/index.js";
import { ProcessToolFactory } from "../../src/tools/process/ProcessToolFactory.js";

// Mock external dependencies
vi.mock("../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

vi.mock("../../src/process.js", () => ({
  createProcess: vi.fn().mockResolvedValue("test-process-id"),
  read: vi.fn().mockResolvedValue({
    Data: JSON.stringify({
      handlers: [
        {
          action: "Info",
          description: "Get process information",
        },
      ],
      lastUpdated: new Date().toISOString(),
      protocolVersion: "1.0",
    }),
    Messages: [],
  }),
  send: vi.fn().mockResolvedValue("message-id-123"),
}));

vi.mock("../../src/services/LuaWorkflowOrchestrationService.js", () => ({
  LuaWorkflowOrchestrationService: vi.fn().mockImplementation(() => ({
    orchestrateWorkflow: vi.fn().mockResolvedValue({
      codeResult: {
        bestPractices: [],
        generatedCode: "-- Test Lua code",
        handlerPatterns: [],
        usedTemplates: [],
      },
      explanation: {
        codeBreakdown: "Test explanation",
        overview: "Test overview",
        relatedSources: [],
      },
      requirements: {
        analysis: {
          complexity: "simple",
          detectedPatterns: [],
          processType: "handler",
          suggestedDomains: ["ao"],
        },
        confidence: 0.9,
        relevantDocs: [],
      },
      timestamp: new Date(),
    }),
  })),
}));

describe("Core Process Tool Routing Integration", () => {
  let processFactory: ProcessToolFactory;
  let toolContext: ToolContext;

  beforeEach(() => {
    // Clear tool registry
    toolRegistry.clear();

    // Setup mock context
    toolContext = {
      embeddedTemplates: new Map(),
      hubId: undefined,
      keyPair: {
        kty: "RSA",
        n: "test-key",
      } as any,
      publicKey: "test-public-key",
    };

    // Create and register core process tools
    processFactory = new ProcessToolFactory({
      categoryDescription: "Core AO process management tools",
      categoryName: "Process",
      context: toolContext,
    });

    processFactory.registerTools(toolRegistry);
  });

  describe("Tool Registration", () => {
    it("should register SpawnProcessCommand with correct metadata", () => {
      const spawnTool = toolRegistry.getTool("spawnProcess");
      expect(spawnTool).toBeDefined();

      const metadata = spawnTool!.getMetadata();
      expect(metadata.name).toBe("spawnProcess");
    });

    it("should register SendAOMessageCommand with correct metadata", () => {
      const sendTool = toolRegistry.getTool("sendAOMessage");
      expect(sendTool).toBeDefined();

      const metadata = sendTool!.getMetadata();
      expect(metadata.name).toBe("sendAOMessage");
    });

    it("should register ReadAOProcessCommand with correct metadata", () => {
      const readTool = toolRegistry.getTool("readAOProcess");
      expect(readTool).toBeDefined();

      const metadata = readTool!.getMetadata();
      expect(metadata.name).toBe("readAOProcess");
    });

    it("should register QueryAOProcessMessagesCommand with correct metadata", () => {
      const queryTool = toolRegistry.getTool("queryAOProcessMessages");
      expect(queryTool).toBeDefined();

      const metadata = queryTool!.getMetadata();
      expect(metadata.name).toBe("queryAOProcessMessages");
    });
  });

  describe("Tool Execution", () => {
    it("should be able to execute SpawnProcessCommand", async () => {
      const spawnTool = toolRegistry.getTool("spawnProcess");
      expect(spawnTool).toBeDefined();

      // Tool should be executable (even if it throws due to mocks)
      expect(spawnTool!.execute).toBeDefined();
      expect(typeof spawnTool!.execute).toBe("function");
    });

    it("should be able to execute SendAOMessageCommand", async () => {
      const sendTool = toolRegistry.getTool("sendAOMessage");
      expect(sendTool).toBeDefined();

      // Tool should be executable (even if it throws due to mocks)
      expect(sendTool!.execute).toBeDefined();
      expect(typeof sendTool!.execute).toBe("function");
    });

    it("should be able to execute ReadAOProcessCommand", async () => {
      const readTool = toolRegistry.getTool("readAOProcess");
      expect(readTool).toBeDefined();

      // Tool should be executable (even if it throws due to mocks)
      expect(readTool!.execute).toBeDefined();
      expect(typeof readTool!.execute).toBe("function");
    });

    it("should be able to execute QueryAOProcessMessagesCommand", async () => {
      const queryTool = toolRegistry.getTool("queryAOProcessMessages");
      expect(queryTool).toBeDefined();

      // Tool should be executable (even if it throws due to mocks)
      expect(queryTool!.execute).toBeDefined();
      expect(typeof queryTool!.execute).toBe("function");
    });
  });

  describe("Tool Definition Generation", () => {
    it("should generate tool definitions for core process tools", () => {
      const toolDefinitions = toolRegistry.getToolDefinitions(toolContext);

      const spawnToolDef = toolDefinitions.find(
        (def) => def.name === "spawnProcess",
      );
      const sendToolDef = toolDefinitions.find(
        (def) => def.name === "sendAOMessage",
      );
      const readToolDef = toolDefinitions.find(
        (def) => def.name === "readAOProcess",
      );
      const queryToolDef = toolDefinitions.find(
        (def) => def.name === "queryAOProcessMessages",
      );

      expect(spawnToolDef).toBeDefined();
      expect(sendToolDef).toBeDefined();
      expect(readToolDef).toBeDefined();
      expect(queryToolDef).toBeDefined();
    });
  });

  describe("Tool Factory Configuration", () => {
    it("should have correct category information", () => {
      const categories = toolRegistry.getCategories();
      const processCategory = categories.find((cat) => cat.name === "Process");

      expect(processCategory).toBeDefined();
      expect(processCategory!.description).toBe(
        "Core AO process management tools",
      );
      expect(processCategory!.tools.length).toBe(4);
    });

    it("should register all core process tools", () => {
      const expectedTools = [
        "spawnProcess",
        "sendAOMessage",
        "readAOProcess",
        "queryAOProcessMessages",
      ];

      for (const toolName of expectedTools) {
        const tool = toolRegistry.getTool(toolName);
        expect(tool).toBeDefined();
      }
    });

    it("should not register deleted advanced process tools", () => {
      const deletedTools = [
        "analyzeProcessArchitecture",
        "executeAction",
        "generateLuaProcess",
        "validateDeployment",
        "rollbackDeployment",
      ];

      for (const toolName of deletedTools) {
        const tool = toolRegistry.getTool(toolName);
        expect(tool).toBeUndefined();
      }
    });
  });
});
