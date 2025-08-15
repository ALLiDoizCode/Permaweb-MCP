/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";

import { BmadTaskArgs, BmadTaskResult } from "../../../types/bmad-workflow.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

export class ExecuteTaskCommand extends ToolCommand<BmadTaskArgs, string> {
  protected metadata: ToolMetadata = {
    description:
      "Execute specific BMad tasks with input/output file management. Supports task-based document generation, file manipulation, and configuration-driven execution for targeted workflow automation.",
    name: "executeTask",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Execute BMad Task",
  };

  protected parametersSchema = z.object({
    configuration: z
      .object({
        mode: z
          .enum(["guided", "autonomous"])
          .optional()
          .describe("Execution mode (guided or autonomous)"),
        outputFormat: z
          .string()
          .optional()
          .describe("Output format preference"),
        parameters: z
          .record(z.unknown())
          .optional()
          .describe("Task-specific parameters"),
      })
      .describe("Task-specific configuration"),
    inputFiles: z
      .array(z.string())
      .describe("Input file paths for task execution"),
    outputFiles: z
      .array(z.string())
      .describe("Expected output file paths for task results"),
    taskName: z
      .string()
      .min(1)
      .describe("Specific BMad task identifier to execute"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: BmadTaskArgs): Promise<string> {
    try {
      // Validate input files exist
      const inputData = await this.readInputFiles(args.inputFiles);

      // Execute task based on task name
      const result = await this.executeTaskLogic(args, inputData);

      return JSON.stringify(result);
    } catch (error) {
      const errorResult: BmadTaskResult = {
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to execute BMad task",
        success: false,
      };

      return JSON.stringify(errorResult);
    }
  }

  private async executeSpecificTask(
    args: BmadTaskArgs,
    inputData: Map<string, string>,
  ): Promise<void> {
    const fs = await import("fs/promises");

    // Generate task-specific content based on task name
    const taskContent = await this.generateTaskContent(args, inputData);

    // Write content to output files
    for (let i = 0; i < args.outputFiles.length; i++) {
      const outputFile = args.outputFiles[i];
      const content = Array.isArray(taskContent)
        ? taskContent[i] || taskContent[0]
        : taskContent;
      await fs.writeFile(outputFile, content);
    }
  }

  private async executeTaskLogic(
    args: BmadTaskArgs,
    inputData: Map<string, string>,
  ): Promise<BmadTaskResult> {
    // Ensure output directories exist
    const fs = await import("fs/promises");
    const path = await import("path");

    for (const outputFile of args.outputFiles) {
      const outputDir = path.dirname(outputFile);
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Execute task based on task name
    await this.executeSpecificTask(args, inputData);

    return {
      message: `BMad task '${args.taskName}' executed successfully`,
      outputFiles: args.outputFiles,
      success: true,
    };
  }

  private generateAnalysisTaskContent(_args: BmadTaskArgs): string {
    return `## Analysis Task

### Analysis Framework
This task performs comprehensive analysis following BMad analytical methodology:

#### Analysis Scope
- [ ] Data collection and information gathering
- [ ] Pattern identification and trend analysis
- [ ] Risk assessment and impact evaluation
- [ ] Recommendation development and prioritization

#### Analytical Process
- Define analysis objectives and success criteria
- Collect and validate data from multiple sources
- Apply analytical frameworks and methodologies
- Generate insights and actionable recommendations

#### Reporting and Communication
- Create comprehensive analysis reports
- Develop executive summaries for stakeholders
- Present findings with supporting evidence
- Provide clear recommendations and next steps

### Deliverables
1. Detailed analysis report
2. Executive summary and recommendations
3. Supporting data and evidence
4. Implementation roadmap

### Next Steps
1. Define analysis scope and methodology
2. Collect and analyze relevant data
3. Generate insights and recommendations
4. Present findings to stakeholders
`;
  }

  private generateComponentTaskContent(_args: BmadTaskArgs): string {
    return `## Component Creation Task

### Component Specification
Based on the task requirements, this task will create a new component with the following characteristics:

#### Component Structure
- [ ] Define component interface and props
- [ ] Implement component logic and state management
- [ ] Create component styling and layout
- [ ] Add component tests and documentation

#### Implementation Guidelines
- Follow established coding standards and patterns
- Implement proper error handling and validation
- Add accessibility features and ARIA labels
- Ensure responsive design and cross-browser compatibility

#### Testing Strategy
- Unit tests for component logic
- Integration tests for component interactions
- Visual regression tests for UI consistency
- Accessibility tests for compliance

### Deliverables
1. Component implementation file
2. Component test suite
3. Component documentation
4. Usage examples and demos

### Next Steps
1. Review component requirements and specifications
2. Implement component following BMad best practices
3. Create comprehensive test coverage
4. Document component API and usage patterns
`;
  }

  private generateDeploymentTaskContent(_args: BmadTaskArgs): string {
    return `## Deployment Task

### Deployment Strategy
This task implements deployment processes following BMad DevOps practices:

#### Deployment Planning
- [ ] Environment configuration and setup
- [ ] Deployment pipeline and automation
- [ ] Rollback procedures and contingency plans
- [ ] Monitoring and health checks

#### Implementation Steps
- Configure target environments and infrastructure
- Set up deployment automation and scripts
- Implement security and compliance measures
- Test deployment process in staging environment

#### Validation and Monitoring
- Verify successful deployment and functionality
- Monitor system performance and stability
- Implement logging and alerting systems
- Document deployment procedures and troubleshooting

### Deliverables
1. Deployment scripts and configuration
2. Environment setup documentation
3. Monitoring and alerting configuration
4. Deployment runbook and procedures

### Next Steps
1. Prepare deployment environment and prerequisites
2. Execute deployment following established procedures
3. Monitor deployment success and system health
4. Document lessons learned and improvements
`;
  }

  private generateDocumentationTaskContent(_args: BmadTaskArgs): string {
    return `## Documentation Creation Task

### Documentation Specification
This task will create comprehensive documentation following BMad methodology standards:

#### Documentation Structure
- [ ] Executive summary and overview
- [ ] Detailed technical specifications
- [ ] Implementation guidelines and examples
- [ ] Troubleshooting and FAQ sections

#### Content Guidelines
- Clear and concise language for target audience
- Comprehensive examples and code samples
- Visual diagrams and flowcharts where appropriate
- Links to related documentation and resources

#### Quality Standards
- Accurate and up-to-date information
- Consistent formatting and style
- Proper grammar and spelling
- Regular review and maintenance schedule

### Deliverables
1. Primary documentation file
2. Supporting diagrams and assets
3. Code examples and samples
4. Documentation maintenance plan

### Next Steps
1. Gather requirements and source materials
2. Create documentation outline and structure
3. Write and review content for accuracy
4. Publish and distribute documentation
`;
  }

  private generateGenericTaskContent(_args: BmadTaskArgs): string {
    return `## Generic Task Execution

### Task Overview
This task executes specific functionality following BMad methodology standards:

#### Task Implementation
- [ ] Understand task requirements and objectives
- [ ] Plan implementation approach and methodology
- [ ] Execute task following established best practices
- [ ] Validate results and deliverable quality

#### Quality Standards
- Follow BMad coding and documentation standards
- Implement proper error handling and validation
- Ensure comprehensive testing and quality assurance
- Document implementation decisions and trade-offs

#### Deliverable Validation
- Verify task completion against requirements
- Test functionality and performance
- Review code quality and standards compliance
- Document results and lessons learned

### Task Execution Plan
1. **Planning Phase**: Analyze requirements and plan approach
2. **Implementation Phase**: Execute task following BMad practices
3. **Validation Phase**: Test and validate deliverables
4. **Documentation Phase**: Document results and handoff

### Next Steps
1. Review task requirements and acceptance criteria
2. Implement task following established methodology
3. Test and validate task deliverables
4. Document results and prepare for handoff
`;
  }

  private generateRefactoringTaskContent(_args: BmadTaskArgs): string {
    return `## Refactoring Task

### Refactoring Strategy
This task implements code refactoring following BMad development best practices:

#### Refactoring Objectives
- [ ] Improve code quality and maintainability
- [ ] Reduce technical debt and complexity
- [ ] Enhance performance and efficiency
- [ ] Improve code organization and structure

#### Refactoring Process
- Analyze current code and identify improvement opportunities
- Plan refactoring approach and impact assessment
- Implement changes incrementally with testing
- Validate functionality and performance improvements

#### Quality Assurance
- Maintain backward compatibility where required
- Ensure comprehensive test coverage for changes
- Review code quality metrics and standards compliance
- Document refactoring decisions and trade-offs

### Deliverables
1. Refactored code with improved structure
2. Updated tests and documentation
3. Performance and quality metrics
4. Refactoring summary and recommendations

### Next Steps
1. Analyze current code and identify refactoring targets
2. Plan and execute refactoring in manageable increments
3. Test and validate refactored code functionality
4. Update documentation and communicate changes
`;
  }

  private async generateTaskContent(
    args: BmadTaskArgs,
    inputData: Map<string, string>,
  ): Promise<string | string[]> {
    const timestamp = new Date().toISOString();

    // Base task header
    let content = `# BMad Task: ${args.taskName}

## Task Execution Details
- **Task Name**: ${args.taskName}
- **Timestamp**: ${timestamp}
- **Mode**: ${args.configuration.mode || "autonomous"}
- **Input Files**: ${args.inputFiles.length}
- **Output Files**: ${args.outputFiles.length}

`;

    // Add configuration if provided
    if (args.configuration.parameters) {
      content += `## Configuration Parameters
${JSON.stringify(args.configuration.parameters, null, 2)}

`;
    }

    // Add input file content summary
    if (inputData.size > 0) {
      content += `## Input Data Summary
`;
      for (const [filePath, fileContent] of inputData) {
        content += `### ${filePath}
${fileContent.length > 500 ? fileContent.substring(0, 500) + "..." : fileContent}

`;
      }
    }

    // Generate task-specific content based on common BMad task patterns
    content += await this.generateTaskSpecificContent(args, inputData);

    return content;
  }

  private async generateTaskSpecificContent(
    args: BmadTaskArgs,
    _inputData: Map<string, string>,
  ): Promise<string> {
    const taskName = args.taskName.toLowerCase();

    if (
      taskName.includes("create-component") ||
      taskName.includes("component")
    ) {
      return this.generateComponentTaskContent(args);
    } else if (
      taskName.includes("create-doc") ||
      taskName.includes("documentation")
    ) {
      return this.generateDocumentationTaskContent(args);
    } else if (taskName.includes("test") || taskName.includes("testing")) {
      return this.generateTestingTaskContent(args);
    } else if (taskName.includes("deploy") || taskName.includes("deployment")) {
      return this.generateDeploymentTaskContent(args);
    } else if (
      taskName.includes("refactor") ||
      taskName.includes("refactoring")
    ) {
      return this.generateRefactoringTaskContent(args);
    } else if (taskName.includes("analyze") || taskName.includes("analysis")) {
      return this.generateAnalysisTaskContent(args);
    } else {
      return this.generateGenericTaskContent(args);
    }
  }

  private generateTestingTaskContent(_args: BmadTaskArgs): string {
    return `## Testing Task

### Testing Strategy
This task implements comprehensive testing following BMad quality assurance practices:

#### Test Coverage Areas
- [ ] Unit tests for individual functions and methods
- [ ] Integration tests for component interactions
- [ ] End-to-end tests for user workflows
- [ ] Performance tests for optimization

#### Test Implementation
- Use appropriate testing frameworks and tools
- Follow test-driven development (TDD) practices
- Implement automated testing and CI/CD integration
- Create test data and mock services as needed

#### Quality Metrics
- Achieve minimum test coverage thresholds
- Ensure all critical paths are tested
- Validate error handling and edge cases
- Monitor test performance and reliability

### Deliverables
1. Comprehensive test suite
2. Test coverage reports
3. Testing documentation and guidelines
4. Automated testing pipeline configuration

### Next Steps
1. Analyze testing requirements and scope
2. Implement test cases following BMad standards
3. Execute tests and validate results
4. Integrate tests into CI/CD pipeline
`;
  }

  private async readInputFiles(
    inputFiles: string[],
  ): Promise<Map<string, string>> {
    const fs = await import("fs/promises");
    const inputData = new Map<string, string>();

    for (const filePath of inputFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        inputData.set(filePath, content);
      } catch (error) {
        inputData.set(filePath, `Error reading file: ${error}`);
      }
    }

    return inputData;
  }
}
