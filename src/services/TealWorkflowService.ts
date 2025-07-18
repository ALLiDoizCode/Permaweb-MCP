import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  AODevelopmentPipeline,
  AODevelopmentStage,
  AOPipelineConfiguration,
} from "../models/AODevelopmentPipeline.js";
import {
  TealCompileOptions,
  TealProcessDefinition,
  TealProcessMetadata,
  TealTemplate,
} from "../models/TealProcess.js";
import { AOMessageService } from "./AOMessageService.js";
import { ProcessCommunicationService } from "./ProcessCommunicationService.js";
import { TealCompilerService } from "./TealCompilerService.js";

export interface TealDeploymentResult {
  deploymentInfo?: {
    module: string;
    owner: string;
    processId: string;
    scheduler: string;
    timestamp: number;
  };
  error?: string;
  processId?: string;
  success: boolean;
  transactionId?: string;
}

export interface TealExecutionResult {
  confidence?: number;
  error?: string;
  handlerUsed?: string;
  output?: any;
  success: boolean;
}

export interface TealValidationResult {
  errors?: string[];
  isValid: boolean;
  success: boolean;
  typeChecks?: {
    column: number;
    file: string;
    line: number;
    message: string;
    severity: "error" | "warning";
  }[];
  warnings?: string[];
}

export interface TealWorkflowResult {
  error?: string;
  processDefinition?: TealProcessDefinition;
  success: boolean;
  template?: TealTemplate;
  warnings?: string[];
}

export interface TealWorkflowService {
  compileTealWorkflow(
    source: string,
    options?: TealCompileOptions,
  ): Promise<TealWorkflowResult>;

  createDevelopmentPipeline(
    processDefinition: TealProcessDefinition,
    configuration: AOPipelineConfiguration,
  ): Promise<AODevelopmentPipeline>;

  createTealWorkflow(
    templateType: "dao" | "game" | "generic" | "token",
    name: string,
    metadata: Partial<TealProcessMetadata>,
  ): Promise<TealWorkflowResult>;

  deployTealProcess(
    processDefinition: TealProcessDefinition,
    signer: JWKInterface,
  ): Promise<TealDeploymentResult>;

  executeTealWorkflowRequest(
    processDefinition: TealProcessDefinition,
    userRequest: string,
    signer: JWKInterface,
  ): Promise<TealExecutionResult>;

  generateProcessDocumentation(
    processDefinition: TealProcessDefinition,
  ): Promise<string>;

  validateTealWorkflow(
    source: string,
    options?: TealCompileOptions,
  ): Promise<TealValidationResult>;
}

const service = (
  tealCompilerService: TealCompilerService,
  processService: ProcessCommunicationService,
  aoMessageService: AOMessageService,
): TealWorkflowService => {
  return {
    compileTealWorkflow: async (
      source: string,
      options: TealCompileOptions = {},
    ): Promise<TealWorkflowResult> => {
      try {
        // Compile Teal source
        const compileResult = await tealCompilerService.compileTealToLua(
          source,
          options,
        );

        if (!compileResult.success || !compileResult.compiledLua) {
          return {
            error: compileResult.errors?.join(", ") || "Compilation failed",
            success: false,
          };
        }

        // Create process definition from compiled result
        const processMetadata: TealProcessMetadata = {
          aoVersion: "2.0.0",
          author: "Unknown",
          compileOptions: options,
          description: "Compiled Teal Process",
          version: "1.0.0",
        };

        const processDefinition =
          await tealCompilerService.createProcessDefinition(
            source,
            processMetadata,
          );

        return {
          processDefinition,
          success: true,
          warnings: compileResult.warnings,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Compilation failed",
          success: false,
        };
      }
    },

    createDevelopmentPipeline: async (
      processDefinition: TealProcessDefinition,
      configuration: AOPipelineConfiguration,
    ): Promise<AODevelopmentPipeline> => {
      const stages: AODevelopmentStage[] = [
        {
          configuration: {
            includeExamples: true,
            queryPatterns: ["teal", "ao", "development"],
          },
          id: "docs-stage",
          name: "docs",
          service: "PermawebDocsService",
          status: "pending",
        },
        {
          configuration: {
            compileOptions: processDefinition.metadata.compileOptions,
            validateTypes: true,
          },
          id: "develop-stage",
          name: "develop",
          service: "TealCompilerService",
          status: "pending",
        },
        {
          configuration: {
            coverage: true,
            testSuite: "default",
          },
          id: "test-stage",
          name: "test",
          service: "AOLiteTestService",
          status: "pending",
        },
        {
          configuration: {
            processId: processDefinition.id,
            validate: true,
          },
          id: "deploy-stage",
          name: "deploy",
          service: "PermawebDeployService",
          status: "pending",
        },
      ];

      return {
        configuration,
        createdAt: new Date(),
        id: generatePipelineId(),
        metadata: {
          aoVersion: processDefinition.metadata.aoVersion,
          author: processDefinition.metadata.author,
          description: `Development pipeline for ${processDefinition.name}`,
          processType: "teal",
          tags: ["teal", "ao", "development"],
          version: processDefinition.metadata.version,
        },
        name: `${processDefinition.name} Development Pipeline`,
        stages,
        status: "draft",
        updatedAt: new Date(),
      };
    },

    createTealWorkflow: async (
      templateType: "dao" | "game" | "generic" | "token",
      name: string,
      metadata: Partial<TealProcessMetadata>,
    ): Promise<TealWorkflowResult> => {
      try {
        // Create Teal template
        const template = await tealCompilerService.createTealTemplate(
          templateType,
          name,
          metadata,
        );

        // Create process metadata
        const processMetadata: TealProcessMetadata = {
          aoVersion: metadata.aoVersion || "2.0.0",
          author: metadata.author || "Unknown",
          compileOptions: metadata.compileOptions || {
            strict: true,
            target: "lua53",
            warnings: true,
          },
          description:
            metadata.description || `${name} ${templateType} process`,
          version: metadata.version || "1.0.0",
        };

        // Create process definition
        const processDefinition =
          await tealCompilerService.createProcessDefinition(
            template.source,
            processMetadata,
          );

        return {
          processDefinition,
          success: true,
          template,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "Workflow creation failed",
          success: false,
        };
      }
    },

    deployTealProcess: async (
      processDefinition: TealProcessDefinition,
      signer: JWKInterface,
    ): Promise<TealDeploymentResult> => {
      try {
        // Validate the process definition
        const validationResult = await service(
          tealCompilerService,
          processService,
          aoMessageService,
        ).validateTealWorkflow(
          processDefinition.source,
          processDefinition.metadata.compileOptions,
        );

        if (!validationResult.success || !validationResult.isValid) {
          return {
            error: `Validation failed: ${validationResult.errors?.join(", ")}`,
            success: false,
          };
        }

        // Integrate with AO services
        const integratedLua = await tealCompilerService.integrateWithAOServices(
          processDefinition.compiledLua,
          processDefinition.id,
        );

        // Deploy the process (this would integrate with actual AO deployment)
        const deploymentResult = await deployToAO(integratedLua, signer);

        return {
          deploymentInfo: deploymentResult.deploymentInfo,
          processId: deploymentResult.processId,
          success: true,
          transactionId: deploymentResult.transactionId,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Deployment failed",
          success: false,
        };
      }
    },

    executeTealWorkflowRequest: async (
      processDefinition: TealProcessDefinition,
      userRequest: string,
      signer: JWKInterface,
    ): Promise<TealExecutionResult> => {
      try {
        // Generate process documentation for execution
        const processMarkdown = await service(
          tealCompilerService,
          processService,
          aoMessageService,
        ).generateProcessDocumentation(processDefinition);

        // Execute the request using ProcessCommunicationService
        const executionResult = await processService.executeProcessRequest(
          processMarkdown,
          processDefinition.id,
          userRequest,
          signer,
        );

        return {
          confidence: executionResult.confidence,
          error: executionResult.error,
          handlerUsed: executionResult.handlerUsed,
          output: executionResult.data,
          success: executionResult.success,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Execution failed",
          success: false,
        };
      }
    },

    generateProcessDocumentation: async (
      processDefinition: TealProcessDefinition,
    ): Promise<string> => {
      try {
        // Extract handlers from compiled Lua
        const handlers = extractHandlersFromLua(processDefinition.compiledLua);

        // Generate markdown documentation
        const documentation = `# ${processDefinition.name}

${processDefinition.metadata.description}

**Version:** ${processDefinition.metadata.version}  
**Author:** ${processDefinition.metadata.author}  
**AO Version:** ${processDefinition.metadata.aoVersion}

## Handlers

${handlers
  .map(
    (handler) => `
### ${handler.name}

${handler.description}

${handler.parameters.map((param: any) => `- ${param.name}: ${param.description}`).join("\n")}
`,
  )
  .join("\n")}

## Type Definitions

${processDefinition.typeDefinitions
  .map(
    (typedef) => `
### ${typedef.name}

${typedef.documentation || ""}

\`\`\`teal
${typedef.definition}
\`\`\`
`,
  )
  .join("\n")}

## Dependencies

${processDefinition.dependencies.map((dep) => `- ${dep}`).join("\n")}

## Usage Examples

\`\`\`teal
${generateUsageExamples(processDefinition)}
\`\`\`
`;

        return documentation;
      } catch (error) {
        return `# ${processDefinition.name}

Documentation generation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },

    validateTealWorkflow: async (
      source: string,
      options: TealCompileOptions = {},
    ): Promise<TealValidationResult> => {
      try {
        // Validate Teal types
        const typeValidation =
          await tealCompilerService.validateTealTypes(source);

        // Compile to check for syntax errors
        const compileResult = await tealCompilerService.compileTealToLua(
          source,
          options,
        );

        const errors: string[] = [];
        const warnings: string[] = [];

        // Collect errors and warnings
        if (typeValidation.errors) {
          errors.push(...typeValidation.errors);
        }
        if (typeValidation.warnings) {
          warnings.push(...typeValidation.warnings);
        }
        if (compileResult.errors) {
          errors.push(...compileResult.errors);
        }
        if (compileResult.warnings) {
          warnings.push(...compileResult.warnings);
        }

        // Validate AO compatibility
        if (compileResult.compiledLua) {
          const aoValidation = validateAOCompatibility(
            compileResult.compiledLua,
          );
          if (!aoValidation.isValid) {
            errors.push(`AO compatibility: ${aoValidation.error}`);
          }
        }

        return {
          errors: errors.length > 0 ? errors : undefined,
          isValid: errors.length === 0,
          success: true,
          typeChecks: compileResult.typeChecks,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch (error) {
        return {
          errors: [
            error instanceof Error ? error.message : "Validation failed",
          ],
          isValid: false,
          success: false,
        };
      }
    },
  };
};

// Helper functions
const deployToAO = async (
  lua: string,
  signer: JWKInterface,
): Promise<{
  deploymentInfo: {
    module: string;
    owner: string;
    processId: string;
    scheduler: string;
    timestamp: number;
  };
  processId: string;
  transactionId: string;
}> => {
  // This would integrate with actual AO deployment
  // For now, we'll simulate the deployment
  const processId = `teal-process-${Date.now()}`;
  const transactionId = `tx-${Date.now()}`;

  return {
    deploymentInfo: {
      module: "AOS_MODULE",
      owner: signer.kty || "unknown",
      processId,
      scheduler: "AOS_SCHEDULER",
      timestamp: Date.now(),
    },
    processId,
    transactionId,
  };
};

const validateAOCompatibility = (
  lua: string,
): { error?: string; isValid: boolean } => {
  // Check for AO-specific patterns
  if (!lua.includes("Handlers") && !lua.includes("ao.")) {
    return { error: "No AO handler patterns found", isValid: false };
  }

  // Check for proper message handling
  if (lua.includes("Handlers.add") && !lua.includes("msg.")) {
    return {
      error: "Handler functions must accept message parameter",
      isValid: false,
    };
  }

  return { isValid: true };
};

const extractHandlersFromLua = (lua: string): any[] => {
  const handlers: any[] = [];

  // Extract handler definitions using regex
  const handlerMatches = lua.match(/Handlers\.add\([^)]+\)/g);
  if (handlerMatches) {
    for (const match of handlerMatches) {
      const parts = match.match(
        /Handlers\.add\("([^"]+)",\s*([^,]+),\s*([^)]+)\)/,
      );
      if (parts) {
        handlers.push({
          description: `Handler for ${parts[1]} operations`,
          name: parts[1],
          parameters: [{ description: "AO message object", name: "msg" }],
        });
      }
    }
  }

  return handlers;
};

const generateUsageExamples = (
  processDefinition: TealProcessDefinition,
): string => {
  return `
-- Example usage for ${processDefinition.name}
local msg = {
  Id = "example-message-id",
  From = "sender-address",
  Tags = {
    Action = "Info"
  },
  Data = "",
  Timestamp = os.time()
}

-- Process the message
local result = process(msg)
print(result.Output)
`;
};

const generatePipelineId = (): string => {
  return `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createTealWorkflowService = (
  tealCompilerService: TealCompilerService,
  processService: ProcessCommunicationService,
  aoMessageService: AOMessageService,
): TealWorkflowService =>
  service(tealCompilerService, processService, aoMessageService);
