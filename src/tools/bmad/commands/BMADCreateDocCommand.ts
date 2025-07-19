import { z } from "zod";

import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadCreateDocSchema = z
  .object({
    outputName: z.string().optional().describe("Name for the output document"),
    templateId: z
      .string()
      .describe("ID of template to use for document creation"),
    variables: z
      .record(z.string())
      .optional()
      .describe("Variables to substitute in template"),
  })
  .strict();

type BMADCreateDocArgs = z.infer<typeof bmadCreateDocSchema>;

export class BMADCreateDocCommand extends ToolCommand<
  BMADCreateDocArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Create documents from BMAD templates with variable substitution",
    name: "bmad_create-doc",
    openWorldHint: false,
    readOnlyHint: false,
    title: "BMAD Document Creation",
  };

  protected parametersSchema = bmadCreateDocSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: BMADCreateDocArgs,
    _context: ToolContext,
  ): Promise<string> {
    const { outputName, templateId, variables } = args;

    try {
      // Initialize service if not already done
      if (!bmadResourceService.getConfig()) {
        await bmadResourceService.initialize();
      }

      const templateResource = await bmadResourceService.loadResource(
        "templates",
        templateId,
      );

      if (!templateResource) {
        return `Template not found: ${templateId}`;
      }

      const template = templateResource.content as any;
      const generatedDoc = this.generateDocument(template, variables || {});

      return `
# Document Generated from Template: ${template.name || templateId}

**Template:** ${templateId}
**Output Name:** ${outputName || "Untitled Document"}
**Generated:** ${new Date().toISOString()}

## Generated Document

${generatedDoc}

## Template Variables Used

${
  Object.entries(variables || {})
    .map(([key, value]) => `- **${key}:** ${value}`)
    .join("\n") || "No variables provided"
}

## Available Template Variables

${this.formatTemplateVariables(template.variables || [])}
      `.trim();
    } catch (error) {
      return `Error creating document: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  private formatTemplateVariables(variables: any[]): string {
    if (!variables || variables.length === 0) {
      return "No variables defined for this template.";
    }

    return variables
      .map((variable) => {
        const required = variable.required ? "(Required)" : "(Optional)";
        const defaultValue = variable.defaultValue
          ? ` - Default: ${variable.defaultValue}`
          : "";
        return `- **${variable.name}** (${variable.type}) ${required} - ${variable.description}${defaultValue}`;
      })
      .join("\n");
  }

  private generateDocument(
    template: any,
    variables: Record<string, string>,
  ): string {
    let content =
      template.template || template.content || "No template content available";

    // Simple variable substitution
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, "g"), value);
    }

    // Replace any remaining placeholders with default values or empty strings
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        const placeholder = `{{${variable.name}}}`;
        if (content.includes(placeholder)) {
          const defaultValue = variable.defaultValue || `[${variable.name}]`;
          content = content.replace(new RegExp(placeholder, "g"), defaultValue);
        }
      }
    }

    return content;
  }
}
