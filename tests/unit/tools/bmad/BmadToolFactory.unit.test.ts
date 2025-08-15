import { beforeEach, describe, expect, it, vi } from "vitest";

import { BmadToolFactory } from "../../../../src/tools/bmad/BmadToolFactory.js";
import { ExecuteBmadWorkflowCommand } from "../../../../src/tools/bmad/commands/ExecuteBmadWorkflowCommand.js";
import { ExecuteTaskCommand } from "../../../../src/tools/bmad/commands/ExecuteTaskCommand.js";
import { InvokeAgentCommand } from "../../../../src/tools/bmad/commands/InvokeAgentCommand.js";
import { ToolContext } from "../../../../src/tools/index.js";

// Mock file system operations
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock path module
vi.mock("path", () => ({
  dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  join: vi.fn((...args) => args.join("/")),
}));

describe("BmadToolFactory", () => {
  let factory: BmadToolFactory;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    factory = new BmadToolFactory({
      categoryDescription:
        "BMad methodology tools for development workflow automation",
      categoryName: "BMad",
      context: mockContext,
    });
  });

  describe("factory configuration", () => {
    it("should have correct category name", () => {
      expect(factory.getCategoryName()).toBe("BMad");
    });

    it("should have correct category description", () => {
      expect(factory.getCategoryDescription()).toBe(
        "BMad methodology tools for development workflow automation",
      );
    });

    it("should return the provided context", () => {
      expect(factory.getContext()).toBe(mockContext);
    });
  });

  describe("tool creation", () => {
    it("should create all BMad tools", () => {
      const tools = factory.getTools();

      expect(tools).toHaveLength(3);
      expect(tools[0]).toBeInstanceOf(ExecuteBmadWorkflowCommand);
      expect(tools[1]).toBeInstanceOf(InvokeAgentCommand);
      expect(tools[2]).toBeInstanceOf(ExecuteTaskCommand);
    });

    it("should create tools with correct context", () => {
      const tools = factory.getTools();

      // Verify each tool has access to the context (private property, check metadata instead)
      expect(tools[0].getMetadata().name).toBe("executeBmadWorkflow");
      expect(tools[1].getMetadata().name).toBe("invokeAgent");
      expect(tools[2].getMetadata().name).toBe("executeTask");
    });

    it("should return the same tools on subsequent calls", () => {
      const tools1 = factory.getTools();
      const tools2 = factory.getTools();

      expect(tools1).toBe(tools2);
      expect(tools1).toHaveLength(3);
    });
  });

  describe("tool retrieval", () => {
    it("should find tools by name", () => {
      const workflowTool = factory.getToolByName("executeBmadWorkflow");
      const agentTool = factory.getToolByName("invokeAgent");
      const taskTool = factory.getToolByName("executeTask");

      expect(workflowTool).toBeInstanceOf(ExecuteBmadWorkflowCommand);
      expect(agentTool).toBeInstanceOf(InvokeAgentCommand);
      expect(taskTool).toBeInstanceOf(ExecuteTaskCommand);
    });

    it("should return undefined for non-existent tools", () => {
      const tool = factory.getToolByName("nonExistentTool");
      expect(tool).toBeUndefined();
    });

    it("should return correct tool count", () => {
      expect(factory.getToolCount()).toBe(3);
    });
  });

  describe("tool registration", () => {
    it("should register tools with registry", () => {
      const mockRegistry = {
        registerCategory: vi.fn(),
      };

      factory.registerTools(mockRegistry as any);

      expect(mockRegistry.registerCategory).toHaveBeenCalledWith(
        "BMad",
        "BMad methodology tools for development workflow automation",
        expect.arrayContaining([
          expect.any(ExecuteBmadWorkflowCommand),
          expect.any(InvokeAgentCommand),
          expect.any(ExecuteTaskCommand),
        ]),
      );
    });
  });
});
