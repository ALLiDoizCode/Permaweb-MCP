import { z } from "zod";

import {
  bmadResourceService,
  type BMADResourceType,
} from "../../../services/BMADResourceService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadKnowledgeBaseSchema = z
  .object({
    action: z
      .enum(["list", "search", "get"])
      .describe("Action to perform on knowledge base"),
    query: z.string().optional().describe("Search query for finding resources"),
    resourceId: z
      .string()
      .optional()
      .describe("ID of specific resource to retrieve"),
    resourceType: z
      .enum(["tasks", "templates", "checklists", "workflows", "data"])
      .optional()
      .describe("Type of resource to work with"),
  })
  .strict();

type BMADKnowledgeBaseArgs = z.infer<typeof bmadKnowledgeBaseSchema>;

export class BMADKnowledgeBaseCommand extends ToolCommand<
  BMADKnowledgeBaseArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Access BMAD knowledge base for tasks, templates, checklists, and workflows",
    name: "bmad_kb",
    openWorldHint: false,
    readOnlyHint: true,
    title: "BMAD Knowledge Base",
  };

  protected parametersSchema = bmadKnowledgeBaseSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: BMADKnowledgeBaseArgs,
    _context: ToolContext,
  ): Promise<string> {
    const { action, query, resourceId, resourceType } = args;

    try {
      // Initialize service if not already done
      if (!bmadResourceService.getConfig()) {
        await bmadResourceService.initialize();
      }

      switch (action) {
        case "get":
          return await this.getResource(resourceType, resourceId);
        case "list":
          return await this.listResources(resourceType);
        case "search":
          return await this.searchResources(query);
        default:
          return "Invalid action. Use 'list', 'get', or 'search'.";
      }
    } catch (error) {
      return `Error accessing knowledge base: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  private async getResource(
    resourceType?: string,
    resourceId?: string,
  ): Promise<string> {
    if (!resourceType || !resourceId) {
      return "Both resourceType and resourceId are required for 'get' action.";
    }

    const resource = await bmadResourceService.loadResource(
      resourceType as BMADResourceType,
      resourceId,
    );

    if (!resource) {
      return `Resource not found: ${resourceType}:${resourceId}`;
    }

    return `
# ${resource.name}

**Type:** ${resource.type}
**ID:** ${resource.id}
**Description:** ${resource.description}
**Last Modified:** ${resource.lastModified.toISOString()}

## Content

${JSON.stringify(resource.content, null, 2)}
    `.trim();
  }

  private async listResources(resourceType?: string): Promise<string> {
    if (!resourceType) {
      return `
# BMAD Knowledge Base

## Available Resource Types

- **tasks** - Development tasks and procedures
- **templates** - Document and code templates
- **checklists** - Quality assurance checklists
- **workflows** - Process workflows and automation
- **data** - Reference data and configurations

Use \`bmad_kb list <resourceType>\` to see available resources of a specific type.
      `.trim();
    }

    const resources = await bmadResourceService.listResources(
      resourceType as BMADResourceType,
    );

    if (resources.length === 0) {
      return `No resources found for type: ${resourceType}`;
    }

    return `
# ${resourceType.toUpperCase()} Resources

${resources.map((resource) => `- ${resource}`).join("
")}

Use \`bmad_kb get ${resourceType} <resourceId>\` to retrieve a specific resource.
    `.trim();
  }

  private async searchResources(query?: string): Promise<string> {
    if (!query) {
      return "Query parameter is required for 'search' action.";
    }

    // Simple search implementation - real implementation would be more sophisticated
    const allResourceTypes = [
      "tasks",
      "templates",
      "checklists",
      "workflows",
      "data",
    ];
    const results: string[] = [];

    for (const resourceType of allResourceTypes) {
      const resources = await bmadResourceService.listResources(
        resourceType as BMADResourceType,
      );
      const matchingResources = resources.filter((resource) =>
        resource.toLowerCase().includes(query.toLowerCase()),
      );

      if (matchingResources.length > 0) {
        results.push(`**${resourceType}:**`);
        results.push(...matchingResources.map((resource) => `  - ${resource}`));
      }
    }

    if (results.length === 0) {
      return `No resources found matching query: "${query}"`;
    }

    return `
# Search Results for "${query}"

${results.join("
")}
    `.trim();
  }
}
