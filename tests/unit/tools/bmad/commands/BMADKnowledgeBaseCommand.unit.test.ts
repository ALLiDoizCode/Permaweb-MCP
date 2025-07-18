import { beforeEach, describe, expect, it, vi } from "vitest";

import { BMADKnowledgeBaseCommand } from "../../../../../src/tools/bmad/commands/BMADKnowledgeBaseCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Mock the resource service
vi.mock("../../../../../src/services/BMADResourceService.js", () => ({
  bmadResourceService: {
    getConfig: vi.fn(),
    initialize: vi.fn(),
    listResources: vi.fn(),
    loadResource: vi.fn(),
  },
}));

describe("BMADKnowledgeBaseCommand", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  const kbCommand = new BMADKnowledgeBaseCommand(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct metadata", () => {
    const metadata = kbCommand.getMetadata();
    expect(metadata.name).toBe("*kb");
    expect(metadata.title).toBe("BMAD Knowledge Base");
    expect(metadata.description).toBe(
      "Access BMAD knowledge base for tasks, templates, checklists, and workflows",
    );
    expect(metadata.readOnlyHint).toBe(true);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should return general resource types when listing without specific type", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const result = await kbCommand.execute({ action: "list" }, mockContext);

    expect(result).toContain("# BMAD Knowledge Base");
    expect(result).toContain("Available Resource Types");
    expect(result).toContain("tasks");
    expect(result).toContain("templates");
    expect(result).toContain("checklists");
    expect(result).toContain("workflows");
    expect(result).toContain("data");
  });

  it("should list specific resource type when provided", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });
    (bmadResourceService.listResources as any).mockResolvedValue([
      "task1",
      "task2",
      "task3",
    ]);

    const result = await kbCommand.execute(
      { action: "list", resourceType: "tasks" },
      mockContext,
    );

    expect(result).toContain("# TASKS Resources");
    expect(result).toContain("- task1");
    expect(result).toContain("- task2");
    expect(result).toContain("- task3");
    expect(bmadResourceService.listResources).toHaveBeenCalledWith("tasks");
  });

  it("should return no resources message when resource type is empty", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });
    (bmadResourceService.listResources as any).mockResolvedValue([]);

    const result = await kbCommand.execute(
      { action: "list", resourceType: "tasks" },
      mockContext,
    );

    expect(result).toContain("No resources found for type: tasks");
  });

  it("should get specific resource when both type and id are provided", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const mockResource = {
      content: { description: "Test description", title: "Test Task" },
      description: "A test task",
      id: "test-task",
      lastModified: new Date("2023-01-01"),
      name: "Test Task",
      type: "tasks",
    };

    (bmadResourceService.loadResource as any).mockResolvedValue(mockResource);

    const result = await kbCommand.execute(
      {
        action: "get",
        resourceId: "test-task",
        resourceType: "tasks",
      },
      mockContext,
    );

    expect(result).toContain("# Test Task");
    expect(result).toContain("**Type:** tasks");
    expect(result).toContain("**ID:** test-task");
    expect(result).toContain("**Description:** A test task");
    expect(bmadResourceService.loadResource).toHaveBeenCalledWith(
      "tasks",
      "test-task",
    );
  });

  it("should return not found message when resource doesn't exist", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });
    (bmadResourceService.loadResource as any).mockResolvedValue(null);

    const result = await kbCommand.execute(
      {
        action: "get",
        resourceId: "nonexistent",
        resourceType: "tasks",
      },
      mockContext,
    );

    expect(result).toContain("Resource not found: tasks:nonexistent");
  });

  it("should return error message for get action without required parameters", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const result = await kbCommand.execute({ action: "get" }, mockContext);

    expect(result).toContain(
      "Both resourceType and resourceId are required for 'get' action",
    );
  });

  it("should search across all resource types", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    (bmadResourceService.listResources as any)
      .mockResolvedValueOnce(["search-task", "other-task"])
      .mockResolvedValueOnce(["search-template"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await kbCommand.execute(
      { action: "search", query: "search" },
      mockContext,
    );

    expect(result).toContain('# Search Results for "search"');
    expect(result).toContain("**tasks:**");
    expect(result).toContain("- search-task");
    expect(result).toContain("**templates:**");
    expect(result).toContain("- search-template");
  });

  it("should return no results message when search finds nothing", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });
    (bmadResourceService.listResources as any).mockResolvedValue([]);

    const result = await kbCommand.execute(
      { action: "search", query: "nonexistent" },
      mockContext,
    );

    expect(result).toContain(
      'No resources found matching query: "nonexistent"',
    );
  });

  it("should return error message for search action without query", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const result = await kbCommand.execute({ action: "search" }, mockContext);

    expect(result).toContain("Query parameter is required for 'search' action");
  });

  it("should return error message for invalid action", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const result = await kbCommand.execute(
      { action: "invalid" as any },
      mockContext,
    );

    expect(result).toContain("Invalid action. Use 'list', 'get', or 'search'");
  });

  it("should handle service errors gracefully", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue(null);
    (bmadResourceService.initialize as any).mockRejectedValue(
      new Error("Service error"),
    );

    const result = await kbCommand.execute({ action: "list" }, mockContext);

    expect(result).toContain("Error accessing knowledge base: Service error");
  });
});
