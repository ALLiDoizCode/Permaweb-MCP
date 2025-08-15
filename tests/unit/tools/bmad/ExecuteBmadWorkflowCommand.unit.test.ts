import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExecuteBmadWorkflowCommand } from "../../../../src/tools/bmad/commands/ExecuteBmadWorkflowCommand.js";
import { ToolContext } from "../../../../src/tools/index.js";
import { BmadWorkflowArgs } from "../../../../src/types/bmad-workflow.js";

// Mock file system operations
const mockFs = {
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
};

const mockPath = {
  dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  join: vi.fn((...args) => args.join("/")),
};

vi.mock("fs/promises", () => mockFs);
vi.mock("path", () => mockPath);

describe("ExecuteBmadWorkflowCommand", () => {
  let command: ExecuteBmadWorkflowCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    command = new ExecuteBmadWorkflowCommand(mockContext);

    // Setup default mock implementations
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("executeBmadWorkflow");
      expect(metadata.title).toBe("Execute BMad Development Workflow");
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.description).toContain(
        "Execute complete BMad development workflows",
      );
    });
  });

  describe("parameter validation", () => {
    it("should validate valid workflow parameters", () => {
      const validArgs: BmadWorkflowArgs = {
        projectPath: "/test/project",
        userRequest: "Create a new Permaweb dApp",
        workflowName: "permaweb-fullstack",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });

    it("should reject invalid workflow names", () => {
      const invalidArgs = {
        projectPath: "/test/project",
        userRequest: "Create a new app",
        workflowName: "invalid-workflow",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require project path", () => {
      const invalidArgs = {
        userRequest: "Create a new app",
        workflowName: "permaweb-fullstack",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require user request", () => {
      const invalidArgs = {
        projectPath: "/test/project",
        workflowName: "permaweb-fullstack",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should accept optional configuration", () => {
      const validArgs: BmadWorkflowArgs = {
        configuration: {
          contextWindow: 3000,
          guided: true,
          outputFormats: ["md", "ts"],
        },
        projectPath: "/test/project",
        userRequest: "Create a new app",
        workflowName: "greenfield-fullstack",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });
  });

  describe("workflow execution", () => {
    const baseArgs: BmadWorkflowArgs = {
      projectPath: "/test/project",
      userRequest: "Create a Permaweb dApp with token functionality",
      workflowName: "permaweb-fullstack",
    };

    it("should create project directory if it doesn't exist", async () => {
      mockFs.access.mockRejectedValue(new Error("Directory not found"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/project", {
        recursive: true,
      });
      expect(parsedResult.success).toBe(true);
    });

    it("should create workflow directory structure", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        "/test/project/.bmad/permaweb-fullstack",
        { recursive: true },
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should generate workflow configuration file", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/project/.bmad/permaweb-fullstack/workflow-config.json",
        expect.stringContaining('"workflowName": "permaweb-fullstack"'),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should generate workflow plan file", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/project/.bmad/permaweb-fullstack/workflow-plan.md",
        expect.stringContaining("# Permaweb Fullstack Development Workflow"),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should generate workflow status file", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/project/.bmad/permaweb-fullstack/workflow-status.md",
        expect.stringContaining("# BMad Workflow Status"),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should return success result with generated files", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        "workflow initialized successfully",
      );
      expect(parsedResult.generatedFiles).toHaveLength(3);
      expect(parsedResult.generatedFiles).toContain(
        "/test/project/.bmad/permaweb-fullstack/workflow-config.json",
      );
    });

    it("should handle different workflow types", async () => {
      const greenfieldArgs: BmadWorkflowArgs = {
        ...baseArgs,
        workflowName: "greenfield-fullstack",
      };

      const result = await command.execute(greenfieldArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/project/.bmad/greenfield-fullstack/workflow-plan.md",
        expect.stringContaining("# Greenfield Fullstack Development Workflow"),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should include configuration in workflow files", async () => {
      const configuredArgs: BmadWorkflowArgs = {
        ...baseArgs,
        configuration: {
          contextWindow: 3000,
          guided: true,
          outputFormats: ["md", "ts"],
        },
      };

      const result = await command.execute(configuredArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("workflow-plan.md"),
        expect.stringContaining("Mode: Guided"),
      );
      expect(parsedResult.success).toBe(true);
    });
  });

  describe("error handling", () => {
    const baseArgs: BmadWorkflowArgs = {
      projectPath: "/test/project",
      userRequest: "Create a Permaweb dApp",
      workflowName: "permaweb-fullstack",
    };

    it("should handle file system errors", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Permission denied");
    });

    it("should handle write errors", async () => {
      mockFs.writeFile.mockRejectedValue(new Error("Disk full"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Disk full");
    });
  });
});
