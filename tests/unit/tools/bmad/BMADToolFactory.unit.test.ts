import { describe, expect, it } from "vitest";

import { BMADToolFactory } from "../../../../src/tools/bmad/BMADToolFactory.js";
import { ToolContext } from "../../../../src/tools/core/index.js";

describe("BMADToolFactory", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  const factory = new BMADToolFactory({
    categoryDescription:
      "BMAD methodology tools for structured development workflows",
    categoryName: "BMAD",
    context: mockContext,
  });

  it("should create factory with correct configuration", () => {
    expect(factory.getCategoryName()).toBe("BMAD");
    expect(factory.getCategoryDescription()).toBe(
      "BMAD methodology tools for structured development workflows",
    );
    expect(factory.getContext()).toBe(mockContext);
  });

  it("should create all 8 BMAD tools", () => {
    const tools = factory.getTools();
    expect(tools).toHaveLength(8);

    const toolNames = tools.map((tool) => tool.getMetadata().name);
    expect(toolNames).toContain("*help");
    expect(toolNames).toContain("*kb");
    expect(toolNames).toContain("*task");
    expect(toolNames).toContain("*create-doc");
    expect(toolNames).toContain("*execute-checklist");
    expect(toolNames).toContain("*yolo");
    expect(toolNames).toContain("*doc-out");
    expect(toolNames).toContain("*exit");
  });

  it("should create tools with correct metadata", () => {
    const tools = factory.getTools();

    // Check that all tools have the BMAD prefix
    const toolNames = tools.map((tool) => tool.getMetadata().name);
    toolNames.forEach((name) => {
      expect(name).toMatch(/^\*/);
    });
  });

  it("should create tools with proper titles", () => {
    const tools = factory.getTools();
    const toolTitles = tools.map((tool) => tool.getMetadata().title);

    expect(toolTitles).toContain("BMAD Help");
    expect(toolTitles).toContain("BMAD Knowledge Base");
    expect(toolTitles).toContain("BMAD Task Execution");
    expect(toolTitles).toContain("BMAD Document Creation");
    expect(toolTitles).toContain("BMAD Checklist Execution");
    expect(toolTitles).toContain("BMAD Quick Execution");
    expect(toolTitles).toContain("BMAD Document Output");
    expect(toolTitles).toContain("BMAD Exit");
  });

  it("should find tools by name", () => {
    const helpTool = factory.getToolByName("*help");
    expect(helpTool).toBeDefined();
    expect(helpTool?.getMetadata().name).toBe("*help");

    const kbTool = factory.getToolByName("*kb");
    expect(kbTool).toBeDefined();
    expect(kbTool?.getMetadata().name).toBe("*kb");

    const nonexistentTool = factory.getToolByName("*nonexistent");
    expect(nonexistentTool).toBeUndefined();
  });

  it("should return correct tool count", () => {
    expect(factory.getToolCount()).toBe(8);
  });

  it("should create tools with proper descriptions", () => {
    const tools = factory.getTools();

    tools.forEach((tool) => {
      const metadata = tool.getMetadata();
      expect(metadata.description).toBeDefined();
      expect(metadata.description.length).toBeGreaterThan(0);
    });
  });

  it("should create tools that can be executed", async () => {
    const tools = factory.getTools();

    // Test that help command can be executed
    const helpTool = tools.find((tool) => tool.getMetadata().name === "*help");
    expect(helpTool).toBeDefined();

    if (helpTool) {
      const result = await helpTool.execute({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("should create tools with consistent metadata structure", () => {
    const tools = factory.getTools();

    tools.forEach((tool) => {
      const metadata = tool.getMetadata();
      expect(metadata.name).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(typeof metadata.readOnlyHint).toBe("boolean");
      expect(typeof metadata.openWorldHint).toBe("boolean");
    });
  });
});
