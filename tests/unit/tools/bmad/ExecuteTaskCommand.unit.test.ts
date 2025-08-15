import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExecuteTaskCommand } from "../../../../src/tools/bmad/commands/ExecuteTaskCommand.js";
import { ToolContext } from "../../../../src/tools/index.js";
import { BmadTaskArgs } from "../../../../src/types/bmad-workflow.js";

// Mock file system operations
const mockFs = {
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

describe("ExecuteTaskCommand", () => {
  let command: ExecuteTaskCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    command = new ExecuteTaskCommand(mockContext);

    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue("test input file content");
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("executeTask");
      expect(metadata.title).toBe("Execute BMad Task");
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.description).toContain("Execute specific BMad tasks");
    });
  });

  describe("parameter validation", () => {
    it("should validate valid task parameters", () => {
      const validArgs: BmadTaskArgs = {
        configuration: {
          mode: "autonomous",
        },
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.ts"],
        taskName: "create-component",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });

    it("should require task name", () => {
      const invalidArgs = {
        configuration: {},
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.ts"],
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require input files", () => {
      const invalidArgs = {
        configuration: {},
        outputFiles: ["/test/output.ts"],
        taskName: "create-component",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require output files", () => {
      const invalidArgs = {
        configuration: {},
        inputFiles: ["/test/input.md"],
        taskName: "create-component",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require configuration", () => {
      const invalidArgs = {
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.ts"],
        taskName: "create-component",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should accept valid configuration modes", () => {
      const guidedArgs: BmadTaskArgs = {
        configuration: {
          mode: "guided",
        },
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.ts"],
        taskName: "create-test",
      };

      const autonomousArgs: BmadTaskArgs = {
        configuration: {
          mode: "autonomous",
        },
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.ts"],
        taskName: "create-test",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(guidedArgs)).not.toThrow();
      expect(() => schema.parse(autonomousArgs)).not.toThrow();
    });

    it("should accept additional configuration parameters", () => {
      const validArgs: BmadTaskArgs = {
        configuration: {
          mode: "autonomous",
          outputFormat: "md",
          parameters: { format: "markdown", style: "technical" },
        },
        inputFiles: ["/test/input.md"],
        outputFiles: ["/test/output.md"],
        taskName: "create-documentation",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });
  });

  describe("task execution", () => {
    const baseArgs: BmadTaskArgs = {
      configuration: {
        mode: "autonomous",
        parameters: { framework: "react" },
      },
      inputFiles: ["/test/input.md", "/test/spec.md"],
      outputFiles: ["/test/component.ts", "/test/component.test.ts"],
      taskName: "create-component",
    };

    it("should read input files", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.readFile).toHaveBeenCalledWith("/test/input.md", "utf-8");
      expect(mockFs.readFile).toHaveBeenCalledWith("/test/spec.md", "utf-8");
      expect(parsedResult.success).toBe(true);
    });

    it("should create output directories", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test", { recursive: true });
      expect(parsedResult.success).toBe(true);
    });

    it("should write to all output files", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/component.ts",
        expect.stringContaining("# BMad Task: create-component"),
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/component.test.ts",
        expect.stringContaining("# BMad Task: create-component"),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should include task configuration in output", async () => {
      const result = await command.execute(baseArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"framework": "react"'),
      );
    });

    it("should include input data summary in output", async () => {
      const result = await command.execute(baseArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("## Input Data Summary"),
      );
    });

    it("should return success result with output files", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        "BMad task 'create-component' executed successfully",
      );
      expect(parsedResult.outputFiles).toEqual([
        "/test/component.ts",
        "/test/component.test.ts",
      ]);
    });
  });

  describe("task-specific content generation", () => {
    it("should generate component-specific content", async () => {
      const componentArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/spec.md"],
        outputFiles: ["/test/component.ts"],
        taskName: "create-component",
      };

      const result = await command.execute(componentArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/component.ts",
        expect.stringContaining("## Component Creation Task"),
      );
    });

    it("should generate documentation-specific content", async () => {
      const docArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/requirements.md"],
        outputFiles: ["/test/documentation.md"],
        taskName: "create-doc",
      };

      const result = await command.execute(docArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/documentation.md",
        expect.stringContaining("## Documentation Creation Task"),
      );
    });

    it("should generate testing-specific content", async () => {
      const testArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/component.ts"],
        outputFiles: ["/test/test.ts"],
        taskName: "create-test",
      };

      const result = await command.execute(testArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/test.ts",
        expect.stringContaining("## Testing Task"),
      );
    });

    it("should generate deployment-specific content", async () => {
      const deployArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/config.yml"],
        outputFiles: ["/test/deploy.md"],
        taskName: "deploy-application",
      };

      const result = await command.execute(deployArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/deploy.md",
        expect.stringContaining("## Deployment Task"),
      );
    });

    it("should generate refactoring-specific content", async () => {
      const refactorArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/legacy.ts"],
        outputFiles: ["/test/refactored.ts"],
        taskName: "refactor-code",
      };

      const result = await command.execute(refactorArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/refactored.ts",
        expect.stringContaining("## Refactoring Task"),
      );
    });

    it("should generate analysis-specific content", async () => {
      const analysisArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/metrics.json"],
        outputFiles: ["/test/analysis.md"],
        taskName: "analyze-performance",
      };

      const result = await command.execute(analysisArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/analysis.md",
        expect.stringContaining("## Analysis Task"),
      );
    });

    it("should generate generic content for unknown tasks", async () => {
      const genericArgs: BmadTaskArgs = {
        configuration: { mode: "autonomous" },
        inputFiles: ["/test/input.txt"],
        outputFiles: ["/test/output.txt"],
        taskName: "custom-task",
      };

      const result = await command.execute(genericArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/output.txt",
        expect.stringContaining("## Generic Task Execution"),
      );
    });
  });

  describe("error handling", () => {
    const baseArgs: BmadTaskArgs = {
      configuration: { mode: "autonomous" },
      inputFiles: ["/test/input.md"],
      outputFiles: ["/test/output.md"],
      taskName: "test-task",
    };

    it("should handle input file read errors gracefully", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      // Should still succeed but include error in input data
      expect(parsedResult.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/output.md",
        expect.stringContaining("Error reading file"),
      );
    });

    it("should handle directory creation errors", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Permission denied");
    });

    it("should handle file write errors", async () => {
      mockFs.writeFile.mockRejectedValue(new Error("Disk full"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Disk full");
    });
  });
});
