import { describe, expect, it } from "vitest";

import { BMADHelpCommand } from "../../../../../src/tools/bmad/commands/BMADHelpCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

describe("BMADHelpCommand", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  const helpCommand = new BMADHelpCommand(mockContext);

  it("should have correct metadata", () => {
    const metadata = helpCommand.getMetadata();
    expect(metadata.name).toBe("*help");
    expect(metadata.title).toBe("BMAD Help");
    expect(metadata.description).toBe(
      "Display BMAD methodology help and available commands",
    );
    expect(metadata.readOnlyHint).toBe(true);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should return general help when no topic is provided", async () => {
    const result = await helpCommand.execute({}, mockContext);

    expect(result).toContain("# BMAD Methodology Help");
    expect(result).toContain("Available Commands");
    expect(result).toContain("*help");
    expect(result).toContain("*kb");
    expect(result).toContain("*task");
    expect(result).toContain("*create-doc");
    expect(result).toContain("*execute-checklist");
    expect(result).toContain("*yolo");
    expect(result).toContain("*doc-out");
    expect(result).toContain("*exit");
  });

  it("should return specific help for known topics", async () => {
    const result = await helpCommand.execute({ topic: "kb" }, mockContext);

    expect(result).toContain("# KB Help");
    expect(result).toContain("Knowledge Base");
  });

  it("should return specific help for task topic", async () => {
    const result = await helpCommand.execute({ topic: "task" }, mockContext);

    expect(result).toContain("# TASK Help");
    expect(result).toContain("Task Execution");
  });

  it("should return specific help for create-doc topic", async () => {
    const result = await helpCommand.execute(
      { topic: "create-doc" },
      mockContext,
    );

    expect(result).toContain("# CREATE-DOC Help");
    expect(result).toContain("Document Creation");
  });

  it("should return specific help for execute-checklist topic", async () => {
    const result = await helpCommand.execute(
      { topic: "execute-checklist" },
      mockContext,
    );

    expect(result).toContain("# EXECUTE-CHECKLIST Help");
    expect(result).toContain("Checklist Execution");
  });

  it("should return specific help for yolo topic", async () => {
    const result = await helpCommand.execute({ topic: "yolo" }, mockContext);

    expect(result).toContain("# YOLO Help");
    expect(result).toContain("Quick Execution");
  });

  it("should return specific help for doc-out topic", async () => {
    const result = await helpCommand.execute({ topic: "doc-out" }, mockContext);

    expect(result).toContain("# DOC-OUT Help");
    expect(result).toContain("Document Output");
  });

  it("should return specific help for exit topic", async () => {
    const result = await helpCommand.execute({ topic: "exit" }, mockContext);

    expect(result).toContain("# EXIT Help");
    expect(result).toContain("Exit Mode");
  });

  it("should return unknown topic message for invalid topics", async () => {
    const result = await helpCommand.execute(
      { topic: "invalid-topic" },
      mockContext,
    );

    expect(result).toContain("Unknown help topic: invalid-topic");
    expect(result).toContain("Use `*help` to see available topics");
  });
});
