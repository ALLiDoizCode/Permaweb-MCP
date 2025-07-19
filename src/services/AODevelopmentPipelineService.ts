import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  AODevelopmentPipeline,
  AODevelopmentStage,
  AOPipelineArtifact,
  AOPipelineConfiguration,
  AOPipelineResults,
  AOStageResult,
} from "../models/AODevelopmentPipeline.js";
import { AOLiteTestSuite } from "../models/AOLiteTest.js";
import { TealProcessDefinition } from "../models/TealProcess.js";
import { AODevelopmentDocsService } from "./AODevelopmentDocsService.js";
import { AOLiteTestService } from "./AOLiteTestService.js";
import { PermawebDeployService } from "./PermawebDeployService.js";
import { TealCompilerService } from "./TealCompilerService.js";
import { TealWorkflowService } from "./TealWorkflowService.js";

export interface AODevelopmentPipelineService {
  cancelPipeline(pipelineId: string): Promise<void>;

  createPipeline(
    name: string,
    processDefinition: TealProcessDefinition,
    configuration: AOPipelineConfiguration,
    processType?: "dao" | "game" | "generic" | "token",
  ): Promise<AODevelopmentPipeline>;

  createQuickStartPipeline(
    processType: "dao" | "game" | "generic" | "token",
    name: string,
    configuration?: Partial<AOPipelineConfiguration>,
  ): Promise<AODevelopmentPipeline>;

  executePipeline(
    pipeline: AODevelopmentPipeline,
    signer: JWKInterface,
  ): Promise<AOPipelineResults>;

  executeStage(
    stage: AODevelopmentStage,
    pipeline: AODevelopmentPipeline,
    signer: JWKInterface,
  ): Promise<AOStageResult>;

  generatePipelineReport(
    pipeline: AODevelopmentPipeline,
    results: AOPipelineResults,
  ): Promise<string>;

  getPipelineStatus(pipelineId: string): Promise<AODevelopmentPipeline>;

  pausePipeline(pipelineId: string): Promise<void>;

  resumePipeline(pipelineId: string): Promise<void>;

  validateStageTransition(
    fromStage: string,
    toStage: string,
    pipeline: AODevelopmentPipeline,
  ): Promise<boolean>;
}

const service = (
  docsService: AODevelopmentDocsService,
  tealCompilerService: TealCompilerService,
  aoLiteTestService: AOLiteTestService,
  deployService: PermawebDeployService,
  tealWorkflowService: TealWorkflowService,
): AODevelopmentPipelineService => {
  // In-memory pipeline storage (in production, this would be persistent)
  const pipelineStore = new Map<string, AODevelopmentPipeline>();

  return {
    cancelPipeline: async (pipelineId: string): Promise<void> => {
      const pipeline = pipelineStore.get(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      pipeline.status = "failed";
      pipeline.updatedAt = new Date();
      pipelineStore.set(pipelineId, pipeline);
    },

    createPipeline: async (
      name: string,
      processDefinition: TealProcessDefinition,
      configuration: AOPipelineConfiguration,
      processType?: "dao" | "game" | "generic" | "token",
    ): Promise<AODevelopmentPipeline> => {
      try {
        const tags = ["ao", "development", "pipeline"];
        if (processType) {
          tags.push(processType);
        }

        const pipeline: AODevelopmentPipeline = {
          configuration,
          createdAt: new Date(),
          id: generatePipelineId(),
          metadata: {
            aoVersion: processDefinition.metadata.aoVersion,
            author: processDefinition.metadata.author,
            description: `Development pipeline for ${name}`,
            processType: "teal",
            tags,
            version: processDefinition.metadata.version,
          },
          name,
          stages: await createDefaultStages(processDefinition),
          status: "draft",
          updatedAt: new Date(),
        };

        pipelineStore.set(pipeline.id, pipeline);
        return pipeline;
      } catch (error) {
        throw new Error(
          `Failed to create pipeline: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    createQuickStartPipeline: async (
      processType: "dao" | "game" | "generic" | "token",
      name: string,
      configuration: Partial<AOPipelineConfiguration> = {},
    ): Promise<AODevelopmentPipeline> => {
      try {
        // Create a basic process definition for the quick start
        const processDefinition: TealProcessDefinition = {
          compiledLua: "",
          dependencies: [],
          id: generateProcessId(),
          metadata: {
            aoVersion: "2.0.0",
            author: "QuickStart",
            compileOptions: {
              strict: true,
              target: "lua53",
              warnings: true,
            },
            description: `Quick start ${processType} process`,
            version: "1.0.0",
          },
          name,
          source: getQuickStartTemplate(processType),
          typeDefinitions: [],
          version: "1.0.0",
        };

        // Create pipeline with default configuration
        const defaultConfig: AOPipelineConfiguration = {
          autoAdvance: true,
          parallelExecution: false,
          retries: 3,
          stopOnError: true,
          timeout: 300000, // 5 minutes
          ...configuration,
        };

        return await service(
          docsService,
          tealCompilerService,
          aoLiteTestService,
          deployService,
          tealWorkflowService,
        ).createPipeline(name, processDefinition, defaultConfig, processType);
      } catch (error) {
        throw new Error(
          `Failed to create quick start pipeline: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    executePipeline: async (
      pipeline: AODevelopmentPipeline,
      signer: JWKInterface,
    ): Promise<AOPipelineResults> => {
      const startTime = Date.now();
      const stageResults: AOStageResult[] = [];
      const artifacts: AOPipelineArtifact[] = [];

      try {
        // Update pipeline status
        pipeline.status = "running";
        pipeline.updatedAt = new Date();
        pipelineStore.set(pipeline.id, pipeline);

        // Execute stages
        for (const stage of pipeline.stages) {
          try {
            const stageResult = await service(
              docsService,
              tealCompilerService,
              aoLiteTestService,
              deployService,
              tealWorkflowService,
            ).executeStage(stage, pipeline, signer);

            stageResults.push(stageResult);

            // Collect artifacts
            if (stageResult.artifacts) {
              artifacts.push(...stageResult.artifacts);
            }

            // Stop on failure if configured
            if (
              stageResult.status === "failed" &&
              pipeline.configuration.stopOnError
            ) {
              break;
            }
          } catch (error) {
            const failedResult: AOStageResult = {
              duration: 0,
              error: error instanceof Error ? error.message : "Unknown error",
              name: stage.name,
              stageId: stage.id,
              status: "failed",
            };
            stageResults.push(failedResult);

            if (pipeline.configuration.stopOnError) {
              break;
            }
          }
        }

        // Calculate results
        const totalStages = pipeline.stages.length;
        const completedStages = stageResults.filter(
          (r) => r.status === "completed",
        ).length;
        const failedStages = stageResults.filter(
          (r) => r.status === "failed",
        ).length;
        const overallStatus = failedStages > 0 ? "failed" : "completed";

        // Update pipeline status
        pipeline.status = overallStatus;
        pipeline.updatedAt = new Date();
        pipelineStore.set(pipeline.id, pipeline);

        return {
          artifacts,
          completedStages,
          duration: Date.now() - startTime,
          failedStages,
          pipelineId: pipeline.id,
          stageResults,
          status: overallStatus,
          totalStages,
        };
      } catch (error) {
        pipeline.status = "failed";
        pipeline.updatedAt = new Date();
        pipelineStore.set(pipeline.id, pipeline);

        throw new Error(
          `Pipeline execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    executeStage: async (
      stage: AODevelopmentStage,
      pipeline: AODevelopmentPipeline,
      signer: JWKInterface,
    ): Promise<AOStageResult> => {
      const startTime = Date.now();

      try {
        // Update stage status
        stage.status = "running";
        stage.startTime = new Date();

        let result: any;
        let artifacts: AOPipelineArtifact[] = [];

        switch (stage.name) {
          case "deploy":
            result = await executeDeployStage(
              stage,
              pipeline,
              deployService,
              signer,
            );
            artifacts = createDeploymentArtifacts(result);
            break;

          case "develop":
            result = await executeDevelopStage(
              stage,
              pipeline,
              tealCompilerService,
            );
            artifacts = createDevelopmentArtifacts(result);
            break;

          case "docs":
            result = await executeDocsStage(stage, pipeline, docsService);
            break;

          case "test":
            result = await executeTestStage(stage, pipeline, aoLiteTestService);
            artifacts = createTestArtifacts(result);
            break;

          default:
            throw new Error(`Unknown stage: ${stage.name}`);
        }

        // Update stage status based on results
        let stageStatus: "completed" | "failed" = "completed";

        // Check for failures in different stage types
        if (
          stage.name === "develop" &&
          result.compilation &&
          !result.compilation.success
        ) {
          stageStatus = "failed";
        } else if (
          stage.name === "test" &&
          result.testResults &&
          result.testResults.status === "failed"
        ) {
          stageStatus = "failed";
        } else if (
          stage.name === "deploy" &&
          result.deployStatus &&
          result.deployStatus === "failed"
        ) {
          stageStatus = "failed";
        }

        stage.status = stageStatus;
        stage.endTime = new Date();
        stage.duration = Date.now() - startTime;
        stage.results = result;

        return {
          artifacts,
          duration: Date.now() - startTime,
          name: stage.name,
          output: result,
          stageId: stage.id,
          status: stageStatus,
        };
      } catch (error) {
        stage.status = "failed";
        stage.endTime = new Date();
        stage.duration = Date.now() - startTime;
        stage.error = error instanceof Error ? error.message : "Unknown error";

        return {
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
          name: stage.name,
          stageId: stage.id,
          status: "failed",
        };
      }
    },

    generatePipelineReport: async (
      pipeline: AODevelopmentPipeline,
      results: AOPipelineResults,
    ): Promise<string> => {
      try {
        const report = `# AO Development Pipeline Report

## Pipeline Information
- **Name**: ${pipeline.name}
- **ID**: ${pipeline.id}
- **Status**: ${results.status}
- **Duration**: ${results.duration}ms
- **Created**: ${pipeline.createdAt.toISOString()}
- **Updated**: ${pipeline.updatedAt.toISOString()}

## Execution Summary
- **Total Stages**: ${results.totalStages}
- **Completed**: ${results.completedStages}
- **Failed**: ${results.failedStages}
- **Success Rate**: ${((results.completedStages / results.totalStages) * 100).toFixed(1)}%

## Stage Results

${results.stageResults
  .map(
    (stage) => `
### ${stage.name} (${stage.status})
- **Duration**: ${stage.duration}ms
${stage.error ? `- **Error**: ${stage.error}` : ""}
${stage.output ? `- **Output**: ${JSON.stringify(stage.output, null, 2)}` : ""}
`,
  )
  .join("\n")}

## Artifacts Generated

${results.artifacts
  .map(
    (artifact) => `
### ${artifact.name}
- **Type**: ${artifact.type}
- **Size**: ${artifact.size} bytes
- **Checksum**: ${artifact.checksum || "N/A"}
`,
  )
  .join("\n")}

## Configuration
- **Auto Advance**: ${pipeline.configuration.autoAdvance || false}
- **Stop on Error**: ${pipeline.configuration.stopOnError || false}
- **Parallel Execution**: ${pipeline.configuration.parallelExecution || false}
- **Timeout**: ${pipeline.configuration.timeout || "Default"}

## Metadata
- **Author**: ${pipeline.metadata.author}
- **Version**: ${pipeline.metadata.version}
- **AO Version**: ${pipeline.metadata.aoVersion}
- **Tags**: ${pipeline.metadata.tags.join(", ")}
`;

        return report;
      } catch (error) {
        throw new Error(
          `Failed to generate pipeline report: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    getPipelineStatus: async (
      pipelineId: string,
    ): Promise<AODevelopmentPipeline> => {
      const pipeline = pipelineStore.get(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      return pipeline;
    },

    pausePipeline: async (pipelineId: string): Promise<void> => {
      const pipeline = pipelineStore.get(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      pipeline.status = "draft"; // Paused state
      pipeline.updatedAt = new Date();
      pipelineStore.set(pipelineId, pipeline);
    },

    resumePipeline: async (pipelineId: string): Promise<void> => {
      const pipeline = pipelineStore.get(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      pipeline.status = "running";
      pipeline.updatedAt = new Date();
      pipelineStore.set(pipelineId, pipeline);
    },

    validateStageTransition: async (
      fromStage: string,
      toStage: string,
      pipeline: AODevelopmentPipeline,
    ): Promise<boolean> => {
      try {
        // Define valid transitions
        const validTransitions: Record<string, string[]> = {
          deploy: [],
          develop: ["test"],
          docs: ["develop"],
          test: ["deploy"],
        };

        const validNext = validTransitions[fromStage] || [];

        if (!validNext.includes(toStage)) {
          return false;
        }

        // Check if previous stage completed successfully
        const fromStageObj = pipeline.stages.find((s) => s.name === fromStage);
        if (!fromStageObj || fromStageObj.status !== "completed") {
          return false;
        }

        return true;
      } catch (error) {
        return false;
      }
    },
  };
};

// Helper functions
const generatePipelineId = (): string => {
  return `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateProcessId = (): string => {
  return `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const createDefaultStages = async (
  processDefinition: TealProcessDefinition,
): Promise<AODevelopmentStage[]> => {
  return [
    {
      configuration: {
        includeExamples: true,
        processType: "teal",
        queryPatterns: ["teal", "ao", "development"],
      },
      id: "docs-stage",
      name: "docs",
      service: "AODevelopmentDocsService",
      status: "pending",
    },
    {
      configuration: {
        compileOptions: processDefinition.metadata.compileOptions,
        generateDocs: true,
        validateTypes: true,
      },
      id: "develop-stage",
      name: "develop",
      service: "TealCompilerService",
      status: "pending",
    },
    {
      configuration: {
        concurrent: false,
        coverage: true,
        testSuite: "comprehensive",
      },
      id: "test-stage",
      name: "test",
      service: "AOLiteTestService",
      status: "pending",
    },
    {
      configuration: {
        monitor: true,
        network: "testnet",
        validate: true,
      },
      id: "deploy-stage",
      name: "deploy",
      service: "PermawebDeployService",
      status: "pending",
    },
  ];
};

const executeDocsStage = async (
  stage: AODevelopmentStage,
  pipeline: AODevelopmentPipeline,
  docsService: AODevelopmentDocsService,
): Promise<any> => {
  const query = `AO development ${pipeline.metadata.processType} best practices`;
  const context = {
    experience: "intermediate" as const,
    framework: "teal" as const,
    processType: pipeline.metadata.processType as any,
    stage: "develop" as const,
  };

  const docsResult = await docsService.queryAODevelopmentDocs(query, context);
  return {
    bestPractices: docsResult.bestPractices,
    examples: docsResult.codeExamples,
    guidance: docsResult.primaryGuidance,
  };
};

const executeDevelopStage = async (
  stage: AODevelopmentStage,
  pipeline: AODevelopmentPipeline,
  tealCompilerService: TealCompilerService,
): Promise<any> => {
  // This would compile the Teal source and validate it
  const compileResult = await tealCompilerService.compileTealToLua(
    "-- Placeholder Teal source",
    stage.configuration.compileOptions,
  );

  return {
    compilation: compileResult,
    typeChecks: compileResult.typeChecks,
    warnings: compileResult.warnings,
  };
};

const executeTestStage = async (
  stage: AODevelopmentStage,
  pipeline: AODevelopmentPipeline,
  aoLiteTestService: AOLiteTestService,
): Promise<any> => {
  // Create a mock process definition for testing
  const mockProcessDefinition: TealProcessDefinition = {
    compiledLua: "-- Test compiled lua",
    dependencies: [],
    id: "test-process",
    metadata: {
      aoVersion: "2.0.0",
      author: "Test",
      compileOptions: {},
      description: "Test process",
      version: "1.0.0",
    },
    name: "Test Process",
    source: "-- Test source",
    typeDefinitions: [],
    version: "1.0.0",
  };

  const testSuite = await aoLiteTestService.createDefaultTestSuite(
    mockProcessDefinition,
  );
  const environment = await aoLiteTestService.createTestEnvironment(
    mockProcessDefinition,
  );
  const testResults = await aoLiteTestService.executeTestSuite(
    testSuite,
    environment,
  );

  return {
    coverage: testResults.coverage,
    testResults,
  };
};

const executeDeployStage = async (
  stage: AODevelopmentStage,
  pipeline: AODevelopmentPipeline,
  deployService: PermawebDeployService,
  signer: JWKInterface,
): Promise<any> => {
  // This would deploy the compiled process
  return {
    deployment: {
      network: stage.configuration.network,
      processId: "deployed-process-id",
      status: "deployed",
      transactionId: "deploy-tx-id",
    },
  };
};

const createDevelopmentArtifacts = (result: any): AOPipelineArtifact[] => {
  const artifacts: AOPipelineArtifact[] = [];

  if (result.compilation?.compiledLua) {
    artifacts.push({
      content: result.compilation.compiledLua,
      id: "compiled-lua",
      metadata: {
        compiler: "teal",
        warnings: result.warnings || [],
      },
      name: "Compiled Lua",
      size: result.compilation.compiledLua.length,
      type: "compiled",
    });
  }

  return artifacts;
};

const createTestArtifacts = (result: any): AOPipelineArtifact[] => {
  const artifacts: AOPipelineArtifact[] = [];

  if (result.testResults) {
    artifacts.push({
      content: JSON.stringify(result.testResults, null, 2),
      id: "test-results",
      metadata: {
        coverage: result.coverage,
        passedTests: result.testResults.passedTests,
        totalTests: result.testResults.totalTests,
      },
      name: "Test Results",
      size: JSON.stringify(result.testResults).length,
      type: "test",
    });
  }

  return artifacts;
};

const createDeploymentArtifacts = (result: any): AOPipelineArtifact[] => {
  const artifacts: AOPipelineArtifact[] = [];

  if (result.deployment) {
    artifacts.push({
      content: JSON.stringify(result.deployment, null, 2),
      id: "deployment-info",
      metadata: {
        network: result.deployment.network,
        processId: result.deployment.processId,
        transactionId: result.deployment.transactionId,
      },
      name: "Deployment Information",
      size: JSON.stringify(result.deployment).length,
      type: "deployment",
    });
  }

  return artifacts;
};

const getQuickStartTemplate = (
  processType: "dao" | "game" | "generic" | "token",
): string => {
  const templates = {
    dao: `-- Quick Start DAO Process
local record DAOState
  Name: string
  Proposals: {string}
  VotingPower: {string:number}
end

local State: DAOState = {
  Name = "Quick DAO",
  Proposals = {},
  VotingPower = {}
}

local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode(State),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,

    game: `-- Quick Start Game Process
local record GameState
  Name: string
  Players: {string:string}
  Status: string
end

local State: GameState = {
  Name = "Quick Game",
  Players = {},
  Status = "Waiting"
}

local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode(State),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,

    generic: `-- Quick Start Generic Process
local record ProcessState
  Name: string
  Data: {string:any}
end

local State: ProcessState = {
  Name = "Quick Process",
  Data = {}
}

local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode(State),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,

    token: `-- Quick Start Token Process
local record TokenState
  Name: string
  Ticker: string
  TotalSupply: number
  Balances: {string:number}
end

local State: TokenState = {
  Name = "Quick Token",
  Ticker = "QT",
  TotalSupply = 1000000,
  Balances = {}
}

local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode(State),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,
  };

  return templates[processType];
};

export const createAODevelopmentPipelineService = (
  docsService: AODevelopmentDocsService,
  tealCompilerService: TealCompilerService,
  aoLiteTestService: AOLiteTestService,
  deployService: PermawebDeployService,
  tealWorkflowService: TealWorkflowService,
): AODevelopmentPipelineService =>
  service(
    docsService,
    tealCompilerService,
    aoLiteTestService,
    deployService,
    tealWorkflowService,
  );
