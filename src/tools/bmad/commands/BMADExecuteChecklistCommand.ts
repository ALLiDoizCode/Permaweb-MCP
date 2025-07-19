import { z } from "zod";

import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadExecuteChecklistSchema = z
  .object({
    action: z
      .enum(["list", "run", "validate"])
      .describe("Action to perform with checklists"),
    checklistId: z
      .string()
      .optional()
      .describe("ID of specific checklist to run"),
    responses: z
      .record(z.string())
      .optional()
      .describe("Responses to checklist items"),
  })
  .strict();

type BMADExecuteChecklistArgs = z.infer<typeof bmadExecuteChecklistSchema>;

export class BMADExecuteChecklistCommand extends ToolCommand<
  BMADExecuteChecklistArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Execute BMAD checklists for quality assurance and validation",
    name: "bmad_execute-checklist",
    openWorldHint: false,
    readOnlyHint: false,
    title: "BMAD Checklist Execution",
  };

  protected parametersSchema = bmadExecuteChecklistSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(
    args: BMADExecuteChecklistArgs,
    _context: ToolContext,
  ): Promise<string> {
    const { action, checklistId, responses } = args;

    try {
      // Initialize service if not already done
      if (!bmadResourceService.getConfig()) {
        await bmadResourceService.initialize();
      }

      switch (action) {
        case "list":
          return await this.listChecklists();
        case "run":
          return await this.runChecklist(checklistId, responses);
        case "validate":
          return await this.validateChecklist(checklistId, responses);
        default:
          return "Invalid action. Use 'list', 'run', or 'validate'.";
      }
    } catch (error) {
      return `Error executing checklist: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  private formatChecklistItems(items: any[]): string {
    if (!items || items.length === 0) {
      return "No items defined for this checklist.";
    }

    return items
      .map((item, index) => {
        const itemNumber = index + 1;
        const required = item.required ? "(Required)" : "(Optional)";
        const type = item.type || "check";
        return `${itemNumber}. **${item.title || "Untitled Item"}** ${required} [${type}]
   ${item.description || "No description available"}`;
      })
      .join("\n\n");
  }

  private async listChecklists(): Promise<string> {
    const checklists = await bmadResourceService.listResources("checklists");

    if (checklists.length === 0) {
      return "No checklists found in the knowledge base.";
    }

    return `
# Available BMAD Checklists

${checklists.map((checklist) => `- **${checklist}** - Use \`bmad_execute-checklist run ${checklist}\` to run this checklist`).join("\n")}

Use \`bmad_execute-checklist run <checklistId>\` to execute a specific checklist.
    `.trim();
  }

  private async runChecklist(
    checklistId?: string,
    responses?: Record<string, string>,
  ): Promise<string> {
    if (!checklistId) {
      return "Checklist ID is required for 'run' action.";
    }

    const checklistResource = await bmadResourceService.loadResource(
      "checklists",
      checklistId,
    );

    if (!checklistResource) {
      return `Checklist not found: ${checklistId}`;
    }

    const checklist = checklistResource.content as any;

    return `
# Running Checklist: ${checklist.name || checklistId}

**Description:** ${checklist.description || "No description available"}
**Purpose:** ${checklist.metadata?.purpose || "General quality assurance"}

## Checklist Items

${this.formatChecklistItems(checklist.items || [])}

## Responses

${
  responses
    ? Object.entries(responses)
        .map(([key, value]) => `- **${key}:** ${value}`)
        .join("\n")
    : "No responses provided"
}

## Next Steps

1. Complete all checklist items
2. Use \`bmad_execute-checklist validate ${checklistId}\` with your responses to validate completion
3. Review any failed items and address them

Use \`bmad_execute-checklist validate ${checklistId}\` to validate your responses.
    `.trim();
  }

  private async validateChecklist(
    checklistId?: string,
    responses?: Record<string, string>,
  ): Promise<string> {
    if (!checklistId) {
      return "Checklist ID is required for 'validate' action.";
    }

    const checklistResource = await bmadResourceService.loadResource(
      "checklists",
      checklistId,
    );

    if (!checklistResource) {
      return `Checklist not found: ${checklistId}`;
    }

    const checklist = checklistResource.content as any;
    const items = checklist.items || [];
    const validation = this.validateChecklistResponses(items, responses || {});

    return `
# Checklist Validation: ${checklist.name || checklistId}

**Overall Status:** ${validation.isValid ? "✅ PASSED" : "❌ FAILED"}
**Completed Items:** ${validation.completedItems}/${validation.totalItems}
**Success Rate:** ${Math.round((validation.completedItems / validation.totalItems) * 100)}%

## Validation Results

${validation.results
  .map((result) => {
    const status = result.passed ? "✅" : "❌";
    return `${status} **${result.itemId}** - ${result.message}`;
  })
  .join("\n")}

## Summary

${
  validation.isValid
    ? "All checklist items have been completed successfully!"
    : "Some checklist items require attention. Please review the failed items above."
}
    `.trim();
  }

  private validateChecklistResponses(
    items: any[],
    responses: Record<string, string>,
  ): {
    completedItems: number;
    isValid: boolean;
    results: Array<{
      itemId: string;
      message: string;
      passed: boolean;
    }>;
    totalItems: number;
  } {
    const results: Array<{
      itemId: string;
      message: string;
      passed: boolean;
    }> = [];

    let completedItems = 0;
    const totalItems = items.length;

    for (const item of items) {
      const itemId = item.id || item.title || `item-${results.length + 1}`;
      const response = responses[itemId];
      const isRequired = item.required !== false; // Default to required

      if (response) {
        completedItems++;
        results.push({
          itemId,
          message: `Completed with response: ${response}`,
          passed: true,
        });
      } else if (isRequired) {
        results.push({
          itemId,
          message: "Required item not completed",
          passed: false,
        });
      } else {
        results.push({
          itemId,
          message: "Optional item skipped",
          passed: true,
        });
      }
    }

    const isValid = results.every((result) => result.passed);

    return {
      completedItems,
      isValid,
      results,
      totalItems,
    };
  }
}
