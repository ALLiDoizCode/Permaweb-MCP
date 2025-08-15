import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvokeAgentCommand } from "../../../../src/tools/bmad/commands/InvokeAgentCommand.js";
import { ToolContext } from "../../../../src/tools/index.js";
import { BmadAgentArgs } from "../../../../src/types/bmad-workflow.js";

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

describe("InvokeAgentCommand", () => {
  let command: InvokeAgentCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    command = new InvokeAgentCommand(mockContext);

    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue("test file content");
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("invokeAgent");
      expect(metadata.title).toBe("Invoke BMad Agent");
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.description).toContain("Invoke specific BMad agents");
    });
  });

  describe("parameter validation", () => {
    it("should validate valid agent parameters", () => {
      const validArgs: BmadAgentArgs = {
        agentName: "dev",
        outputPath: "/test/output.md",
        task: "Implement user authentication",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });

    it("should accept all valid agent names", () => {
      const agentNames = [
        "analyst",
        "pm",
        "architect",
        "dev",
        "qa",
        "po",
        "sm",
      ];
      const schema = command.getParametersSchema();

      agentNames.forEach((agentName) => {
        const args = {
          agentName,
          outputPath: "/test/output.md",
          task: "Test task",
        };

        expect(() => schema.parse(args)).not.toThrow();
      });
    });

    it("should reject invalid agent names", () => {
      const invalidArgs = {
        agentName: "invalid-agent",
        outputPath: "/test/output.md",
        task: "Test task",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require task description", () => {
      const invalidArgs = {
        agentName: "dev",
        outputPath: "/test/output.md",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should require output path", () => {
      const invalidArgs = {
        agentName: "dev",
        task: "Test task",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it("should accept optional parameters", () => {
      const validArgs: BmadAgentArgs = {
        agentName: "architect",
        contextFiles: ["/path/to/context.md"],
        handoffSummary: "Previous work completed",
        outputPath: "/test/output.md",
        task: "Design system architecture",
      };

      const schema = command.getParametersSchema();
      expect(() => schema.parse(validArgs)).not.toThrow();
    });
  });

  describe("agent execution", () => {
    const baseArgs: BmadAgentArgs = {
      agentName: "dev",
      outputPath: "/test/dev-output.md",
      task: "Implement user authentication system",
    };

    it("should create output directory", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test", { recursive: true });
      expect(parsedResult.success).toBe(true);
    });

    it("should write agent output to specified path", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/dev-output.md",
        expect.stringContaining("# BMad DEV Agent Output"),
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should read context files when provided", async () => {
      const argsWithContext: BmadAgentArgs = {
        ...baseArgs,
        contextFiles: ["/path/to/context1.md", "/path/to/context2.md"],
      };

      const result = await command.execute(argsWithContext);
      const parsedResult = JSON.parse(result);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        "/path/to/context1.md",
        "utf-8",
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(
        "/path/to/context2.md",
        "utf-8",
      );
      expect(parsedResult.success).toBe(true);
    });

    it("should include context data in output", async () => {
      const argsWithContext: BmadAgentArgs = {
        ...baseArgs,
        contextFiles: ["/path/to/context.md"],
      };

      const result = await command.execute(argsWithContext);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/dev-output.md",
        expect.stringContaining("## Context Data"),
      );
    });

    it("should include handoff summary when provided", async () => {
      const argsWithHandoff: BmadAgentArgs = {
        ...baseArgs,
        handoffSummary: "Previous analysis completed successfully",
      };

      const result = await command.execute(argsWithHandoff);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/dev-output.md",
        expect.stringContaining("## Handoff Summary"),
      );
    });

    it("should generate agent-specific artifacts", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/implementation-notes.md",
        expect.stringContaining("# Development Notes"),
      );
      expect(parsedResult.generatedFiles).toContain(
        "/test/implementation-notes.md",
      );
    });

    it("should return success result with output path", async () => {
      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        "BMad dev agent executed successfully",
      );
      expect(parsedResult.outputPath).toBe("/test/dev-output.md");
      expect(parsedResult.generatedFiles).toContain("/test/dev-output.md");
    });
  });

  describe("agent-specific content", () => {
    it("should generate analyst-specific content", async () => {
      const analystArgs: BmadAgentArgs = {
        agentName: "analyst",
        outputPath: "/test/analyst-output.md",
        task: "Analyze business requirements",
      };

      const result = await command.execute(analystArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/analyst-output.md",
        expect.stringContaining("## Business Analysis"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/requirements-analysis.md",
        expect.stringContaining("# Requirements Analysis"),
      );
    });

    it("should generate PM-specific content", async () => {
      const pmArgs: BmadAgentArgs = {
        agentName: "pm",
        outputPath: "/test/pm-output.md",
        task: "Create project plan",
      };

      const result = await command.execute(pmArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/pm-output.md",
        expect.stringContaining("## Project Management Plan"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/project-plan.md",
        expect.stringContaining("# Project Management Plan"),
      );
    });

    it("should generate architect-specific content", async () => {
      const architectArgs: BmadAgentArgs = {
        agentName: "architect",
        outputPath: "/test/architect-output.md",
        task: "Design system architecture",
      };

      const result = await command.execute(architectArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/architect-output.md",
        expect.stringContaining("## System Architecture Design"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/architecture-design.md",
        expect.stringContaining("# System Architecture"),
      );
    });

    it("should generate QA-specific content", async () => {
      const qaArgs: BmadAgentArgs = {
        agentName: "qa",
        outputPath: "/test/qa-output.md",
        task: "Create test plan",
      };

      const result = await command.execute(qaArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/qa-output.md",
        expect.stringContaining("## Quality Assurance Plan"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/test-plan.md",
        expect.stringContaining("# Quality Assurance Plan"),
      );
    });

    it("should generate PO-specific content", async () => {
      const poArgs: BmadAgentArgs = {
        agentName: "po",
        outputPath: "/test/po-output.md",
        task: "Review product requirements",
      };

      const result = await command.execute(poArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/po-output.md",
        expect.stringContaining("## Product Owner Review"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/product-review.md",
        expect.stringContaining("# Product Owner Review"),
      );
    });

    it("should generate SM-specific content", async () => {
      const smArgs: BmadAgentArgs = {
        agentName: "sm",
        outputPath: "/test/sm-output.md",
        task: "Facilitate team processes",
      };

      const result = await command.execute(smArgs);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/sm-output.md",
        expect.stringContaining("## Scrum Master Facilitation"),
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/process-facilitation.md",
        expect.stringContaining("# Scrum Master Notes"),
      );
    });
  });

  describe("error handling", () => {
    const baseArgs: BmadAgentArgs = {
      agentName: "dev",
      outputPath: "/test/output.md",
      task: "Test task",
    };

    it("should handle file system errors", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"));

      const result = await command.execute(baseArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Permission denied");
    });

    it("should handle context file read errors gracefully", async () => {
      const argsWithContext: BmadAgentArgs = {
        ...baseArgs,
        contextFiles: ["/nonexistent/file.md"],
      };

      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      const result = await command.execute(argsWithContext);
      const parsedResult = JSON.parse(result);

      // Should still succeed but include error in context data
      expect(parsedResult.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/output.md",
        expect.stringContaining("Error reading file"),
      );
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
