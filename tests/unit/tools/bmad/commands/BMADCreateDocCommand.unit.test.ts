import { beforeEach, describe, expect, it, vi } from "vitest";

import { BMADCreateDocCommand } from "../../../../../src/tools/bmad/commands/BMADCreateDocCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Mock the resource service
vi.mock("../../../../../src/services/BMADResourceService.js", () => ({
  bmadResourceService: {
    getConfig: vi.fn(),
    initialize: vi.fn(),
    loadResource: vi.fn(),
  },
}));

describe("BMADCreateDocCommand", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  const createDocCommand = new BMADCreateDocCommand(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct metadata", () => {
    const metadata = createDocCommand.getMetadata();
    expect(metadata.name).toBe("*create-doc");
    expect(metadata.title).toBe("BMAD Document Creation");
    expect(metadata.description).toBe(
      "Create documents from BMAD templates with variable substitution"
    );
    expect(metadata.readOnlyHint).toBe(false);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should return template not found for missing template", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });
    (bmadResourceService.loadResource as any).mockResolvedValue(null);

    const result = await createDocCommand.execute(
      { templateId: "nonexistent" },
      mockContext
    );

    expect(result).toContain("Template not found: nonexistent");
  });

  it("should generate document from template", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const mockTemplate = {
      id: "test-template",
      name: "Test Template",
      content: {
        template: "Hello {{name}}, welcome to {{project}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "project",
            type: "string",
            required: true,
            description: "Project name",
          },
        ],
      },
    };

    (bmadResourceService.loadResource as any).mockResolvedValue(mockTemplate);

    const result = await createDocCommand.execute(
      {
        templateId: "test-template",
        variables: { name: "John", project: "BMAD" },
        outputName: "Welcome Document",
      },
      mockContext
    );

    expect(result).toContain("# Document Generated from Template: test-template");
    expect(result).toContain("**Output Name:** Welcome Document");
    expect(result).toContain("Hello John, welcome to BMAD!");
  });

  it("should use default values for missing variables", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue({
      bmad: { version: "1.0.0" },
    });

    const mockTemplate = {
      id: "test-template",
      name: "Test Template",
      content: {
        template: "Hello {{name}}, version {{version}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "version",
            type: "string",
            required: false,
            description: "Version number",
            defaultValue: "1.0.0",
          },
        ],
      },
    };

    (bmadResourceService.loadResource as any).mockResolvedValue(mockTemplate);

    const result = await createDocCommand.execute(
      {
        templateId: "test-template",
        variables: { name: "John" },
      },
      mockContext
    );

    expect(result).toContain("Hello John, version 1.0.0");
  });

  it("should handle service errors gracefully", async () => {
    const { bmadResourceService } = await import(
      "../../../../../src/services/BMADResourceService.js"
    );
    (bmadResourceService.getConfig as any).mockReturnValue(null);
    (bmadResourceService.initialize as any).mockRejectedValue(
      new Error("Service error")
    );

    const result = await createDocCommand.execute(
      { templateId: "test-template" },
      mockContext
    );

    expect(result).toContain("Error creating document: Service error");
  });
});