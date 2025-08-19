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

describe("Process Creation Tool Routing Integration", () => {
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

    // Create and register process tools
    processFactory = new ProcessToolFactory({
      categoryDescription:
        "AO process communication and blockchain query tools",
      categoryName: "Process",
      context: toolContext,
    });

    processFactory.registerTools(toolRegistry);
  });

  describe("Tool Registration", () => {
    it("should register GenerateLuaProcessCommand with correct metadata", () => {
      const generateTool = toolRegistry.getTool("generateLuaProcess");
      expect(generateTool).toBeDefined();

      const metadata = generateTool!.getMetadata();
      expect(metadata.name).toBe("generateLuaProcess");
      expect(metadata.title).toBe("Create/Generate AO Process Code");
      expect(metadata.description).toContain(
        "Create, build, generate, or make AO process",
      );
    });

    it("should register SpawnProcessCommand with correct metadata", () => {
      const spawnTool = toolRegistry.getTool("spawnProcess");
      expect(spawnTool).toBeDefined();

      const metadata = spawnTool!.getMetadata();
      expect(metadata.name).toBe("spawnProcess");
      expect(metadata.title).toBe("Spawn Empty AO Process");
      expect(metadata.description).toContain("empty AO process container");
    });
  });

  describe("Tool Execution with Logging", () => {
    it("should log tool selection when GenerateLuaProcessCommand is executed", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const generateTool = toolRegistry.getTool("generateLuaProcess");
      expect(generateTool).toBeDefined();

      try {
        await generateTool!.execute({
          userRequest: "create a token contract",
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[TOOL-ROUTING] GenerateLuaProcessCommand selected for request: "create a token contract"',
        );
      } catch (error) {
        // Expected - we have mocked services but not all dependencies
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[TOOL-ROUTING] GenerateLuaProcessCommand selected for request: "create a token contract"',
        );
      }

      consoleLogSpy.mockRestore();
    });

    it("should log tool selection when SpawnProcessCommand is executed", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const spawnTool = toolRegistry.getTool("spawnProcess");
      expect(spawnTool).toBeDefined();

      try {
        await spawnTool!.execute({});

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "[TOOL-ROUTING] SpawnProcessCommand selected for empty process creation",
        );
      } catch (error) {
        // Expected - we have mocked services but not all dependencies
        expect(consoleLogSpy).toHaveBeenCalledWith(
          "[TOOL-ROUTING] SpawnProcessCommand selected for empty process creation",
        );
      }

      consoleLogSpy.mockRestore();
    });
  });

  describe("Tool Definition Generation", () => {
    it("should generate tool definitions with updated metadata", () => {
      const toolDefinitions = toolRegistry.getToolDefinitions(toolContext);

      const generateToolDef = toolDefinitions.find(
        (def) => def.name === "generateLuaProcess",
      );
      const spawnToolDef = toolDefinitions.find(
        (def) => def.name === "spawnProcess",
      );

      expect(generateToolDef).toBeDefined();
      expect(spawnToolDef).toBeDefined();

      expect(generateToolDef!.description).toContain(
        "Create, build, generate, or make AO process",
      );
      expect(spawnToolDef!.description).toContain("empty AO process container");
    });
  });

  describe("Tool Factory Configuration", () => {
    it("should have correct category information", () => {
      const categories = toolRegistry.getCategories();
      const processCategory = categories.find((cat) => cat.name === "Process");

      expect(processCategory).toBeDefined();
      expect(processCategory!.description).toBe(
        "AO process communication and blockchain query tools",
      );
      expect(processCategory!.tools.length).toBeGreaterThan(0);
    });

    it("should register all expected process tools", () => {
      const expectedTools = [
        "analyzeProcessArchitecture",
        "spawnProcess",
        "evalProcess",
        "executeAction",
        "generateLuaProcess",
        "queryAOProcessMessages",
        "validateDeployment",
        "rollbackDeployment",
      ];

      for (const toolName of expectedTools) {
        const tool = toolRegistry.getTool(toolName);
        expect(tool).toBeDefined();
      }
    });
  });
});
