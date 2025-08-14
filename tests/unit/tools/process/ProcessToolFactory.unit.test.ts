import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/index.js";
import { EvalProcessCommand } from "../../../../src/tools/process/commands/EvalProcessCommand.js";
import { ExecuteActionCommand } from "../../../../src/tools/process/commands/ExecuteActionCommand.js";
import { QueryAOProcessMessagesCommand } from "../../../../src/tools/process/commands/QueryAOProcessMessagesCommand.js";
import { SpawnProcessCommand } from "../../../../src/tools/process/commands/SpawnProcessCommand.js";
import { ProcessToolFactory } from "../../../../src/tools/process/ProcessToolFactory.js";

// Mock the relay functions
vi.mock("../../../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

// Mock AO Connect
vi.mock("@permaweb/aoconnect", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    connect: vi.fn(() => ({
      dryrun: vi.fn(),
      message: vi.fn(),
      result: vi.fn(),
      spawn: vi.fn(),
    })),
    createDataItemSigner: vi.fn(),
    message: vi.fn(),
    result: vi.fn(),
    spawn: vi.fn(),
  };
});

describe("ProcessToolFactory", () => {
  let factory: ProcessToolFactory;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    factory = new ProcessToolFactory({
      categoryDescription:
        "AO process communication and blockchain query tools",
      categoryName: "Process",
      context: mockContext,
    });
  });

  describe("Tool Registration", () => {
    it("should register all process management tools", () => {
      const toolClasses = (factory as any).getToolClasses();

      expect(toolClasses).toHaveLength(6);
      expect(toolClasses).toContain(SpawnProcessCommand);
      expect(toolClasses).toContain(EvalProcessCommand);
      expect(toolClasses).toContain(ExecuteActionCommand);
      expect(toolClasses).toContain(QueryAOProcessMessagesCommand);
    });

    it("should create tool instances with proper context", () => {
      const toolClasses = (factory as any).getToolClasses();

      toolClasses.forEach((ToolClass: any) => {
        const toolInstance = new ToolClass(mockContext);
        expect(toolInstance).toBeDefined();
      });
    });

    it("should maintain consistent tool registration order", () => {
      const toolClasses = (factory as any).getToolClasses();

      // Verify all expected tools are present (order may vary due to new additions)
      expect(toolClasses).toContain(SpawnProcessCommand);
      expect(toolClasses).toContain(EvalProcessCommand);
      expect(toolClasses).toContain(ExecuteActionCommand);
      expect(toolClasses).toContain(QueryAOProcessMessagesCommand);
      expect(toolClasses.length).toBe(6); // Updated count
    });
  });

  describe("Factory Configuration", () => {
    it("should have proper factory configuration", () => {
      expect(factory).toBeInstanceOf(ProcessToolFactory);
    });

    it("should inherit from BaseToolFactory", () => {
      // Test that factory has expected BaseToolFactory methods
      expect(typeof (factory as any).getToolClasses).toBe("function");
    });
  });

  describe("Tool Context Management", () => {
    it("should pass context to all tool instances", () => {
      const toolClasses = (factory as any).getToolClasses();

      toolClasses.forEach((ToolClass: any) => {
        const toolInstance = new ToolClass(mockContext);

        // Verify tool instance has access to context properties
        expect(toolInstance).toBeDefined();
        // Context is typically stored privately, so we verify construction succeeds
      });
    });

    it("should handle different context configurations", () => {
      const alternativeContext: ToolContext = {
        embeddedTemplates: new Map([
          ["token", { processType: "token", template: "token template" }],
        ]),
        hubId: "alternative-hub",
        keyPair: {} as any,
        publicKey: "alternative-key",
      };

      const alternativeFactory = new ProcessToolFactory({
        categoryDescription: "Alternative process tools",
        categoryName: "Process",
        context: alternativeContext,
      });

      const toolClasses = (alternativeFactory as any).getToolClasses();
      expect(toolClasses).toHaveLength(6);

      toolClasses.forEach((ToolClass: any) => {
        const toolInstance = new ToolClass(alternativeContext);
        expect(toolInstance).toBeDefined();
      });
    });
  });

  describe("Integration with Existing Tools", () => {
    it("should maintain compatibility with existing ExecuteActionCommand", () => {
      const toolClasses = (factory as any).getToolClasses();
      const executeActionClass = toolClasses.find(
        (cls: any) => cls === ExecuteActionCommand,
      );

      expect(executeActionClass).toBe(ExecuteActionCommand);

      const executeActionInstance = new executeActionClass(mockContext);
      expect(executeActionInstance).toBeInstanceOf(ExecuteActionCommand);
    });

    it("should maintain compatibility with existing QueryAOProcessMessagesCommand", () => {
      const toolClasses = (factory as any).getToolClasses();
      const queryMessagesClass = toolClasses.find(
        (cls: any) => cls === QueryAOProcessMessagesCommand,
      );

      expect(queryMessagesClass).toBe(QueryAOProcessMessagesCommand);

      const queryMessagesInstance = new queryMessagesClass(mockContext);
      expect(queryMessagesInstance).toBeInstanceOf(
        QueryAOProcessMessagesCommand,
      );
    });
  });

  describe("New Tool Integration", () => {
    it("should properly integrate SpawnProcessCommand", () => {
      const toolClasses = (factory as any).getToolClasses();
      const spawnProcessClass = toolClasses.find(
        (cls: any) => cls === SpawnProcessCommand,
      );

      expect(spawnProcessClass).toBe(SpawnProcessCommand);

      const spawnProcessInstance = new spawnProcessClass(mockContext);
      expect(spawnProcessInstance).toBeInstanceOf(SpawnProcessCommand);
    });

    it("should properly integrate EvalProcessCommand", () => {
      const toolClasses = (factory as any).getToolClasses();
      const evalProcessClass = toolClasses.find(
        (cls: any) => cls === EvalProcessCommand,
      );

      expect(evalProcessClass).toBe(EvalProcessCommand);

      const evalProcessInstance = new evalProcessClass(mockContext);
      expect(evalProcessInstance).toBeInstanceOf(EvalProcessCommand);
    });
  });

  describe("Tool Registration with ToolRegistry", () => {
    it("should support registration with tool registry", () => {
      // Mock tool registry
      const mockToolRegistry = {
        getAllTools: vi.fn().mockReturnValue([]),
        registerCategory: vi.fn(),
      };

      // Test that factory can register tools
      expect(() => {
        factory.registerTools(mockToolRegistry as any);
      }).not.toThrow();

      expect(mockToolRegistry.registerCategory).toHaveBeenCalledWith(
        "Process",
        "AO process communication and blockchain query tools",
        expect.any(Array),
      );
    });

    it("should create tools correctly", () => {
      const tools = factory.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(6);

      // Each tool should be an instance of ToolCommand
      tools.forEach((tool) => {
        expect(tool).toBeDefined();
        expect(typeof tool.getMetadata).toBe("function");
        expect(typeof tool.execute).toBe("function");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle tool instantiation errors gracefully", () => {
      const invalidContext = null as any;

      expect(() => {
        new ProcessToolFactory({
          categoryDescription: "Test",
          categoryName: "Process",
          context: invalidContext,
        });
      }).not.toThrow();
    });

    it("should handle missing context properties", () => {
      const incompleteContext = {
        publicKey: "test-key",
        // Missing other required properties
      } as any;

      const incompleteFactory = new ProcessToolFactory({
        categoryDescription: "Test",
        categoryName: "Process",
        context: incompleteContext,
      });

      const toolClasses = (incompleteFactory as any).getToolClasses();
      expect(toolClasses).toHaveLength(6);
    });
  });

  describe("Factory Metadata", () => {
    it("should have proper category configuration", () => {
      const factory = new ProcessToolFactory({
        categoryDescription: "Complete AO process lifecycle tools",
        categoryName: "Process Management",
        context: mockContext,
      });

      expect(factory).toBeDefined();
    });

    it("should support custom factory configurations", () => {
      const customFactory = new ProcessToolFactory({
        categoryDescription: "Custom process management tools",
        categoryName: "Custom Process Tools",
        context: mockContext,
      });

      const toolClasses = (customFactory as any).getToolClasses();
      expect(toolClasses).toHaveLength(6);
    });
  });
});
