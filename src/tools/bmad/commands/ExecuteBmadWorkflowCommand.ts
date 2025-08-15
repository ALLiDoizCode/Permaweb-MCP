import { z } from "zod";

import {
  BmadWorkflowArgs,
  BmadWorkflowResult,
} from "../../../types/bmad-workflow.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

export class ExecuteBmadWorkflowCommand extends ToolCommand<
  BmadWorkflowArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Execute complete BMad development workflows for Permaweb projects. Supports permaweb-fullstack, greenfield-fullstack, and brownfield-fullstack workflows with file-based document generation and minimal context usage. Use natural language requirements to guide workflow execution.",
    name: "executeBmadWorkflow",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Execute BMad Development Workflow",
  };

  protected parametersSchema = z.object({
    configuration: z
      .object({
        contextWindow: z
          .number()
          .positive()
          .optional()
          .describe("Context window optimization setting"),
        guided: z
          .boolean()
          .optional()
          .describe("Enable guided vs autonomous execution (default: false)"),
        outputFormats: z
          .array(z.string())
          .optional()
          .describe(
            "File formats for document generation (e.g., ['md', 'ts', 'json'])",
          ),
      })
      .optional()
      .describe("Optional workflow configuration"),
    projectPath: z
      .string()
      .min(1)
      .describe("Base path for project files and document generation"),
    userRequest: z
      .string()
      .min(1)
      .describe("Natural language workflow requirements and specifications"),
    workflowName: z
      .enum([
        "permaweb-fullstack",
        "greenfield-fullstack",
        "brownfield-fullstack",
      ])
      .describe("The BMad workflow type to execute"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: BmadWorkflowArgs): Promise<string> {
    try {
      // Validate project path exists and is accessible
      const fs = await import("fs/promises");

      try {
        await fs.access(args.projectPath);
      } catch {
        // Create project directory if it doesn't exist
        await fs.mkdir(args.projectPath, { recursive: true });
      }

      // Initialize workflow execution based on workflow type
      const result = await this.executeWorkflow(args);

      return JSON.stringify(result);
    } catch (error) {
      const errorResult: BmadWorkflowResult = {
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to execute BMad workflow",
        success: false,
      };

      return JSON.stringify(errorResult);
    }
  }

  private async executeWorkflow(
    args: BmadWorkflowArgs,
  ): Promise<BmadWorkflowResult> {
    const fs = await import("fs/promises");
    const path = await import("path");

    // Create workflow-specific directory structure
    const workflowDir = path.join(args.projectPath, ".bmad", args.workflowName);
    await fs.mkdir(workflowDir, { recursive: true });

    // Generate workflow configuration file
    const configPath = path.join(workflowDir, "workflow-config.json");
    const config = {
      configuration: args.configuration || {},
      status: "initialized",
      timestamp: new Date().toISOString(),
      userRequest: args.userRequest,
      workflowName: args.workflowName,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Generate workflow execution plan based on workflow type
    const planPath = await this.generateWorkflowPlan(args, workflowDir);

    // Create workflow status file
    const statusPath = path.join(workflowDir, "workflow-status.md");
    const statusContent = this.generateWorkflowStatus(args, planPath);
    await fs.writeFile(statusPath, statusContent);

    const generatedFiles = [configPath, planPath, statusPath];

    return {
      generatedFiles,
      message: `BMad ${args.workflowName} workflow initialized successfully. Workflow plan and configuration generated in ${workflowDir}`,
      success: true,
    };
  }

  private generateBrownfieldFullstackPlan(args: BmadWorkflowArgs): string {
    return `# Brownfield Fullstack Development Workflow

## User Request
${args.userRequest}

## Workflow Overview
This workflow enhances and modernizes an existing fullstack application with improved architecture and features.

## Phase 1: Assessment
- [ ] Analyze existing codebase and architecture
- [ ] Identify technical debt and improvement opportunities
- [ ] Plan migration strategy and timeline
- [ ] Define new feature requirements

## Phase 2: Foundation Improvements
- [ ] Refactor core components and architecture
- [ ] Update dependencies and frameworks
- [ ] Improve code quality and testing
- [ ] Enhance security and performance

## Phase 3: Feature Enhancement
- [ ] Implement new features and functionality
- [ ] Modernize user interface and experience
- [ ] Add new integrations and APIs
- [ ] Optimize database and data handling

## Phase 4: Migration & Deployment
- [ ] Execute migration strategy
- [ ] Deploy updated application
- [ ] Monitor performance and stability
- [ ] Update documentation and training

## Configuration
- Mode: ${args.configuration?.guided ? "Guided" : "Autonomous"}
- Output Formats: ${args.configuration?.outputFormats?.join(", ") || "markdown, typescript"}
- Context Window: ${args.configuration?.contextWindow || 2000}

## Next Steps
Use \`invokeAgent\` to execute specific phases or \`executeTask\` for individual tasks.
`;
  }

  private generateGreenfieldFullstackPlan(args: BmadWorkflowArgs): string {
    return `# Greenfield Fullstack Development Workflow

## User Request
${args.userRequest}

## Workflow Overview
This workflow creates a new fullstack application from scratch with modern architecture and best practices.

## Phase 1: Foundation
- [ ] Initialize project structure and tooling
- [ ] Set up development environment
- [ ] Configure CI/CD pipeline
- [ ] Establish code quality standards

## Phase 2: Backend Development
- [ ] Design API architecture
- [ ] Implement core business logic
- [ ] Set up database and data models
- [ ] Create authentication and authorization

## Phase 3: Frontend Development
- [ ] Design user interface and experience
- [ ] Implement frontend components
- [ ] Connect to backend APIs
- [ ] Add state management and routing

## Phase 4: Integration & Deployment
- [ ] Integrate frontend and backend
- [ ] Set up testing framework
- [ ] Deploy to production environment
- [ ] Configure monitoring and logging

## Configuration
- Mode: ${args.configuration?.guided ? "Guided" : "Autonomous"}
- Output Formats: ${args.configuration?.outputFormats?.join(", ") || "markdown, typescript"}
- Context Window: ${args.configuration?.contextWindow || 2000}

## Next Steps
Use \`invokeAgent\` to execute specific phases or \`executeTask\` for individual tasks.
`;
  }

  private generatePermawebFullstackPlan(args: BmadWorkflowArgs): string {
    return `# Permaweb Fullstack Development Workflow

## User Request
${args.userRequest}

## Workflow Overview
This workflow implements a complete Permaweb application with decentralized storage and AO process integration.

## Phase 1: Analysis & Planning
- [ ] Analyze requirements and create technical specification
- [ ] Design Permaweb architecture with AO integration
- [ ] Plan token economics and smart contract structure
- [ ] Define frontend and backend components

## Phase 2: Core Development
- [ ] Set up project structure with Arweave and AO tooling
- [ ] Implement AO processes for business logic
- [ ] Create smart contracts for token functionality
- [ ] Develop frontend with Permaweb integration

## Phase 3: Integration & Testing
- [ ] Integrate frontend with AO processes
- [ ] Test token functionality and process communication
- [ ] Validate Permaweb deployment and permanence
- [ ] Conduct end-to-end testing

## Phase 4: Deployment & Documentation
- [ ] Deploy to Arweave network
- [ ] Create user documentation
- [ ] Generate technical documentation
- [ ] Implement monitoring and maintenance

## Configuration
- Mode: ${args.configuration?.guided ? "Guided" : "Autonomous"}
- Output Formats: ${args.configuration?.outputFormats?.join(", ") || "markdown, typescript"}
- Context Window: ${args.configuration?.contextWindow || 2000}

## Next Steps
Use \`invokeAgent\` to execute specific phases or \`executeTask\` for individual tasks.
`;
  }

  private async generateWorkflowPlan(
    args: BmadWorkflowArgs,
    workflowDir: string,
  ): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const planPath = path.join(workflowDir, "workflow-plan.md");

    let planContent = "";

    switch (args.workflowName) {
      case "brownfield-fullstack":
        planContent = this.generateBrownfieldFullstackPlan(args);
        break;
      case "greenfield-fullstack":
        planContent = this.generateGreenfieldFullstackPlan(args);
        break;
      case "permaweb-fullstack":
        planContent = this.generatePermawebFullstackPlan(args);
        break;
    }

    await fs.writeFile(planPath, planContent);
    return planPath;
  }

  private generateWorkflowStatus(
    args: BmadWorkflowArgs,
    planPath: string,
  ): string {
    return `# BMad Workflow Status

## Workflow Information
- **Type**: ${args.workflowName}
- **Project Path**: ${args.projectPath}
- **Status**: Initialized
- **Created**: ${new Date().toISOString()}

## User Request
${args.userRequest}

## Configuration
- **Mode**: ${args.configuration?.guided ? "Guided" : "Autonomous"}
- **Output Formats**: ${args.configuration?.outputFormats?.join(", ") || "markdown, typescript"}
- **Context Window**: ${args.configuration?.contextWindow || 2000}

## Generated Files
- Workflow Plan: ${planPath}
- Configuration: workflow-config.json
- Status: workflow-status.md

## Next Actions
1. Review the generated workflow plan
2. Use \`invokeAgent\` to execute specific workflow phases
3. Use \`executeTask\` for individual task execution
4. Monitor progress through this status file

## Execution Log
- ${new Date().toISOString()}: Workflow initialized
`;
  }
}
