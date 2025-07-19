import { z } from "zod";

import { bmadResourceService } from "../../../services/BMADResourceService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

const bmadTaskSchema = z
  .object({
    action: z
      .enum(["list", "execute", "status"])
      .describe("Action to perform with tasks"),
    parameters: z
      .record(z.string())
      .optional()
      .describe("Parameters for task execution"),
    taskId: z
      .string()
      .optional()
      .describe("ID of specific task to execute or check status"),
  })
  .strict();

type BMADTaskArgs = z.infer<typeof bmadTaskSchema>;

export class BMADTaskCommand extends ToolCommand<BMADTaskArgs, string> {
  protected metadata: ToolMetadata = {
    description: "Execute BMAD tasks with step-by-step guidance",
    name: "bmad_task",
    openWorldHint: false,
    readOnlyHint: false,
    title: "BMAD Task Execution",
  };

  protected parametersSchema = bmadTaskSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: ToolContext) {
    super();
  }

  async execute(args: BMADTaskArgs, _context: ToolContext): Promise<string> {
    const { action, parameters, taskId } = args;

    try {
      // Initialize service if not already done
      if (!bmadResourceService.getConfig()) {
        await bmadResourceService.initialize();
      }

      switch (action) {
        case "execute":
          return await this.executeTask(taskId, parameters);
        case "list":
          return await this.listTasks();
        case "status":
          return await this.getTaskStatus(taskId);
        default:
          return "Invalid action. Use 'list', 'execute', or 'status'.";
      }
    } catch (error) {
      return `Error executing task: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  private async executeTask(
    taskId?: string,
    parameters?: Record<string, string>,
  ): Promise<string> {
    if (!taskId) {
      return "Task ID is required for 'execute' action.";
    }

    const taskResource = await bmadResourceService.loadResource(
      "tasks",
      taskId,
    );

    if (!taskResource) {
      return `Task not found: ${taskId}`;
    }

    const task = taskResource.content as any;

    return `
# Executing Task: ${task.title || taskId}

**Description:** ${task.description || "No description available"}

## Task Steps

${this.formatTaskSteps(task.steps || [])}

## Parameters

${
  parameters
    ? Object.entries(parameters)
        .map(([key, value]) => `- **${key}:** ${value}`)
        .join("\n")
    : "No parameters provided"
}

## Execution Status

Task execution initiated. Follow the steps above to complete the task.

Use \`bmad_task status ${taskId}\` to check execution status.
    `.trim();
  }

  private formatTaskSteps(steps: any[]): string {
    if (!steps || steps.length === 0) {
      return "No steps defined for this task.";
    }

    return steps
      .map((step, index) => {
        const stepNumber = index + 1;
        const required = step.required ? "(Required)" : "(Optional)";
        return `${stepNumber}. **${step.title || "Untitled Step"}** ${required}
   ${step.description || "No description available"}`;
      })
      .join("\n\n");
  }

  private async getTaskStatus(taskId?: string): Promise<string> {
    if (!taskId) {
      return "Task ID is required for 'status' action.";
    }

    // For now, return a placeholder status
    // Real implementation would track task execution state
    return `
# Task Status: ${taskId}

**Status:** Not implemented yet
**Progress:** 0%
**Next Step:** Implementation needed

This is a placeholder implementation. Task status tracking will be implemented in a future version.
    `.trim();
  }

  private async listTasks(): Promise<string> {
    const tasks = await bmadResourceService.listResources("tasks");

    if (tasks.length === 0) {
      return "No tasks found in the knowledge base.";
    }

    return `
# Available BMAD Tasks

${tasks.map((task) => `- **${task}** - Use \`bmad_task execute ${task}\` to run this task`).join("\n")}

Use \`bmad_task execute <taskId>\` to execute a specific task.
    `.trim();
  }
}
