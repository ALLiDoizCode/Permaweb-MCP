import { JWKInterface } from "arweave/node/lib/wallet.js";

import { TealProcessDefinition } from "../models/TealProcess.js";
import { AODevelopmentPipelineService } from "./AODevelopmentPipelineService.js";
import { AOLiteTestService } from "./AOLiteTestService.js";
import { AOMessageService } from "./AOMessageService.js";
import { ProcessCommunicationService } from "./ProcessCommunicationService.js";
import { TealCompilerService } from "./TealCompilerService.js";
import { TealWorkflowService } from "./TealWorkflowService.js";

export interface AODevToolsCompatibilityService {
  generateCompatibilityReport(
    results: CompatibilityTestResults,
  ): Promise<string>;

  runCompatibilityTestSuite(): Promise<CompatibilityTestResults>;

  validateAOLiteTestIntegration(
    processDefinition: TealProcessDefinition,
  ): Promise<CompatibilityResult>;

  validateAOMessageIntegration(
    processDefinition: TealProcessDefinition,
  ): Promise<CompatibilityResult>;

  validateEndToEndWorkflow(
    processDefinition: TealProcessDefinition,
    signer: JWKInterface,
  ): Promise<WorkflowCompatibilityResult>;

  validatePipelineIntegration(
    processDefinition: TealProcessDefinition,
  ): Promise<CompatibilityResult>;

  validateProcessCommunicationIntegration(
    processDefinition: TealProcessDefinition,
  ): Promise<CompatibilityResult>;

  validateTealCompilerIntegration(source: string): Promise<CompatibilityResult>;
}

export interface CompatibilityIssue {
  affectedComponents: string[];
  category: "functionality" | "integration" | "performance" | "security";
  description: string;
  severity: "critical" | "major" | "minor";
  solution: string;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  issues: CompatibilityIssue[];
  recommendations: string[];
  score: number; // 0-100
  warnings: string[];
}

export interface CompatibilityTestResults {
  aoLiteTest: CompatibilityResult;
  aoMessage: CompatibilityResult;
  endToEnd: WorkflowCompatibilityResult;
  overall: CompatibilityResult;
  pipeline: CompatibilityResult;
  processCommunication: CompatibilityResult;
  tealCompiler: CompatibilityResult;
  timestamp: Date;
}

export interface StageCompatibilityResult {
  duration: number;
  isCompatible: boolean;
  issues: CompatibilityIssue[];
  score: number;
  stage: "deploy" | "develop" | "test";
}

export interface WorkflowCompatibilityResult {
  criticalIssues: CompatibilityIssue[];
  isCompatible: boolean;
  overallScore: number;
  stageResults: StageCompatibilityResult[];
  workflowTime: number;
}

const service = (
  processService: ProcessCommunicationService,
  aoMessageService: AOMessageService,
  tealCompilerService: TealCompilerService,
  aoLiteTestService: AOLiteTestService,
  tealWorkflowService: TealWorkflowService,
  pipelineService: AODevelopmentPipelineService,
): AODevToolsCompatibilityService => {
  return {
    generateCompatibilityReport: async (
      results: CompatibilityTestResults,
    ): Promise<string> => {
      const report = `# AO Development Tools Compatibility Report\n\n## Overall Compatibility: ${results.overall.isCompatible ? "✅ COMPATIBLE" : "❌ NOT COMPATIBLE"}\n\n**Score**: ${results.overall.score.toFixed(1)}/100  \n**Generated**: ${results.timestamp.toISOString()}\n\n## Summary\n\n| Component | Score | Status | Critical Issues |\n|-----------|-------|--------|--------------------|\n| ProcessCommunicationService | ${results.processCommunication.score.toFixed(1)} | ${results.processCommunication.isCompatible ? "✅" : "❌"} | ${results.processCommunication.issues.filter((i) => i.severity === "critical").length} |\n| AOMessageService | ${results.aoMessage.score.toFixed(1)} | ${results.aoMessage.isCompatible ? "✅" : "❌"} | ${results.aoMessage.issues.filter((i) => i.severity === "critical").length} |\n| TealCompilerService | ${results.tealCompiler.score.toFixed(1)} | ${results.tealCompiler.isCompatible ? "✅" : "❌"} | ${results.tealCompiler.issues.filter((i) => i.severity === "critical").length} |\n| AOLiteTestService | ${results.aoLiteTest.score.toFixed(1)} | ${results.aoLiteTest.isCompatible ? "✅" : "❌"} | ${results.aoLiteTest.issues.filter((i) => i.severity === "critical").length} |\n| PipelineService | ${results.pipeline.score.toFixed(1)} | ${results.pipeline.isCompatible ? "✅" : "❌"} | ${results.pipeline.issues.filter((i) => i.severity === "critical").length} |\n\n## End-to-End Workflow\n\n**Status**: ${results.endToEnd.isCompatible ? "✅ COMPATIBLE" : "❌ NOT COMPATIBLE"}  \n**Overall Score**: ${results.endToEnd.overallScore.toFixed(1)}/100  \n**Execution Time**: ${results.endToEnd.workflowTime}ms\n\n### Stage Results\n\n${results.endToEnd.stageResults
        .map(
          (stage) =>
            `\n#### ${stage.stage.toUpperCase()} Stage\n- **Score**: ${stage.score.toFixed(1)}/100\n- **Status**: ${stage.isCompatible ? "✅ COMPATIBLE" : "❌ NOT COMPATIBLE"}\n- **Duration**: ${stage.duration}ms\n- **Issues**: ${stage.issues.length}\n`,
        )
        .join("\n")}\n\n## Critical Issues\n\n${results.overall.issues
        .filter((i) => i.severity === "critical")
        .map(
          (issue) =>
            `\n### ${issue.description}\n- **Severity**: ${issue.severity}\n- **Category**: ${issue.category}\n- **Solution**: ${issue.solution}\n- **Affected Components**: ${issue.affectedComponents.join(", ")}\n`,
        )
        .join(
          "\n",
        )}\n\n## Recommendations\n\n${results.overall.recommendations.map((rec) => `- ${rec}`).join("\n")}\n\n## Warnings\n\n${results.overall.warnings.map((warn) => `- ${warn}`).join("\n")}\n\n---\n\n*Report generated by AODevToolsCompatibilityService*\n`;

      return report;
    },

    runCompatibilityTestSuite: async (): Promise<CompatibilityTestResults> => {
      const testProcessDefinition = createTestProcessDefinition();
      const testSigner = createTestSigner();

      const results: CompatibilityTestResults = {
        aoLiteTest: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validateAOLiteTestIntegration(testProcessDefinition),
        aoMessage: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validateAOMessageIntegration(testProcessDefinition),
        endToEnd: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validateEndToEndWorkflow(testProcessDefinition, testSigner),
        overall: {
          isCompatible: true,
          issues: [],
          recommendations: [],
          score: 100,
          warnings: [],
        },
        pipeline: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validatePipelineIntegration(testProcessDefinition),
        processCommunication: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validateProcessCommunicationIntegration(testProcessDefinition),
        tealCompiler: await service(
          processService,
          aoMessageService,
          tealCompilerService,
          aoLiteTestService,
          tealWorkflowService,
          pipelineService,
        ).validateTealCompilerIntegration(testProcessDefinition.source),
        timestamp: new Date(),
      };

      // Calculate overall compatibility
      const allResults = [
        results.processCommunication,
        results.aoMessage,
        results.tealCompiler,
        results.aoLiteTest,
        results.pipeline,
      ];

      const overallScore =
        allResults.reduce((sum, result) => sum + result.score, 0) /
        allResults.length;
      const allIssues = allResults.flatMap((result) => result.issues);
      const allWarnings = allResults.flatMap((result) => result.warnings);
      const allRecommendations = allResults.flatMap(
        (result) => result.recommendations,
      );

      results.overall = {
        isCompatible:
          overallScore >= 70 &&
          !allIssues.some((i) => i.severity === "critical"),
        issues: allIssues,
        recommendations: allRecommendations,
        score: overallScore,
        warnings: allWarnings,
      };

      return results;
    },

    validateAOLiteTestIntegration: async (
      processDefinition: TealProcessDefinition,
    ): Promise<CompatibilityResult> => {
      const issues: CompatibilityIssue[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      try {
        // Test environment creation
        const environment =
          await aoLiteTestService.createTestEnvironment(processDefinition);

        if (!environment.isRunning) {
          issues.push({
            affectedComponents: ["AOLiteTestService"],
            category: "functionality",
            description: "Test environment failed to start",
            severity: "major",
            solution: "Check process definition and environment setup",
          });
          score -= 25;
        }

        // Test suite creation
        const testSuite =
          await aoLiteTestService.createDefaultTestSuite(processDefinition);

        if (testSuite.testCases.length === 0) {
          issues.push({
            affectedComponents: ["AOLiteTestService"],
            category: "functionality",
            description: "No test cases generated",
            severity: "major",
            solution: "Ensure process has handlers for test generation",
          });
          score -= 20;
        }

        // Test execution
        if (testSuite.testCases.length > 0) {
          const testCase = testSuite.testCases[0];
          const testResult = await aoLiteTestService.executeTestCase(
            testCase,
            environment,
          );

          if (testResult.status === "error") {
            issues.push({
              affectedComponents: ["AOLiteTestService"],
              category: "functionality",
              description: "Test execution failed",
              severity: "major",
              solution: "Check test case configuration and environment",
            });
            score -= 20;
          }
        }

        return {
          isCompatible: score >= 70,
          issues,
          recommendations,
          score,
          warnings,
        };
      } catch (error) {
        issues.push({
          affectedComponents: ["AOLiteTestService"],
          category: "integration",
          description: `AOLiteTestService integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check service integration and dependencies",
        });

        return {
          isCompatible: false,
          issues,
          recommendations,
          score: 0,
          warnings,
        };
      }
    },

    validateAOMessageIntegration: async (
      processDefinition: TealProcessDefinition,
    ): Promise<CompatibilityResult> => {
      const issues: CompatibilityIssue[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      try {
        // Test message creation
        const testMessage = {
          data: JSON.stringify({ test: true }),
          processId: processDefinition.id,
          tags: [{ name: "Action", value: "Test" }],
        };

        // Test write operation detection
        const isWrite = aoMessageService.isWriteOperation(testMessage.tags);

        if (typeof isWrite !== "boolean") {
          issues.push({
            affectedComponents: ["AOMessageService"],
            category: "functionality",
            description: "Write operation detection failed",
            severity: "major",
            solution: "Check tag processing logic",
          });
          score -= 15;
        }

        // Test message structure validation
        if (!testMessage.processId || !testMessage.tags) {
          issues.push({
            affectedComponents: ["AOMessageService"],
            category: "integration",
            description: "Invalid message structure",
            severity: "critical",
            solution: "Ensure message has required fields",
          });
          score -= 30;
        }

        return {
          isCompatible: score >= 70,
          issues,
          recommendations,
          score,
          warnings,
        };
      } catch (error) {
        issues.push({
          affectedComponents: ["AOMessageService"],
          category: "integration",
          description: `AOMessageService integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check service integration and dependencies",
        });

        return {
          isCompatible: false,
          issues,
          recommendations,
          score: 0,
          warnings,
        };
      }
    },

    validateEndToEndWorkflow: async (
      processDefinition: TealProcessDefinition,
      signer: JWKInterface,
    ): Promise<WorkflowCompatibilityResult> => {
      const startTime = Date.now();
      const stageResults: StageCompatibilityResult[] = [];
      const criticalIssues: CompatibilityIssue[] = [];

      try {
        // Test develop stage
        const developResult = await validateDevelopStage(
          processDefinition,
          tealCompilerService,
        );
        stageResults.push(developResult);

        // Test test stage
        const testResult = await validateTestStage(
          processDefinition,
          aoLiteTestService,
        );
        stageResults.push(testResult);

        // Test deploy stage (mock)
        const deployResult = await validateDeployStage(processDefinition);
        stageResults.push(deployResult);

        // Collect critical issues
        for (const stage of stageResults) {
          criticalIssues.push(
            ...stage.issues.filter((i) => i.severity === "critical"),
          );
        }

        // Calculate overall score
        const overallScore =
          stageResults.reduce((sum, stage) => sum + stage.score, 0) /
          stageResults.length;

        return {
          criticalIssues,
          isCompatible: overallScore >= 70 && criticalIssues.length === 0,
          overallScore,
          stageResults,
          workflowTime: Date.now() - startTime,
        };
      } catch (error) {
        criticalIssues.push({
          affectedComponents: ["All Services"],
          category: "integration",
          description: `End-to-end workflow failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check overall system integration",
        });

        return {
          criticalIssues,
          isCompatible: false,
          overallScore: 0,
          stageResults,
          workflowTime: Date.now() - startTime,
        };
      }
    },

    validatePipelineIntegration: async (
      processDefinition: TealProcessDefinition,
    ): Promise<CompatibilityResult> => {
      const issues: CompatibilityIssue[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      try {
        // Test pipeline creation
        const pipeline = await pipelineService.createPipeline(
          "Test Pipeline",
          processDefinition,
          {
            autoAdvance: false,
            parallelExecution: false,
            stopOnError: true,
            timeout: 30000,
          },
        );

        if (!pipeline.id) {
          issues.push({
            affectedComponents: ["AODevelopmentPipelineService"],
            category: "integration",
            description: "Pipeline creation failed",
            severity: "critical",
            solution: "Check pipeline service configuration",
          });
          score -= 40;
        }

        // Test stage validation
        if (pipeline.stages.length === 0) {
          issues.push({
            affectedComponents: ["AODevelopmentPipelineService"],
            category: "functionality",
            description: "No stages created in pipeline",
            severity: "major",
            solution: "Check stage generation logic",
          });
          score -= 30;
        }

        // Test stage transitions
        for (let i = 0; i < pipeline.stages.length - 1; i++) {
          const currentStage = pipeline.stages[i];
          const nextStage = pipeline.stages[i + 1];

          const canTransition = await pipelineService.validateStageTransition(
            currentStage.name,
            nextStage.name,
            pipeline,
          );

          if (!canTransition) {
            warnings.push(
              `Invalid stage transition: ${currentStage.name} -> ${nextStage.name}`,
            );
            score -= 5;
          }
        }

        return {
          isCompatible: score >= 70,
          issues,
          recommendations,
          score,
          warnings,
        };
      } catch (error) {
        issues.push({
          affectedComponents: ["AODevelopmentPipelineService"],
          category: "integration",
          description: `Pipeline integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check service integration and dependencies",
        });

        return {
          isCompatible: false,
          issues,
          recommendations,
          score: 0,
          warnings,
        };
      }
    },

    validateProcessCommunicationIntegration: async (
      processDefinition: TealProcessDefinition,
    ): Promise<CompatibilityResult> => {
      const issues: CompatibilityIssue[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      try {
        // Test process definition parsing
        const processMarkdown =
          await generateProcessMarkdown(processDefinition);
        const parsedProcess = processService.parseMarkdown(processMarkdown);

        // Validate handlers
        if (parsedProcess.handlers.length === 0) {
          issues.push({
            affectedComponents: ["ProcessCommunicationService"],
            category: "integration",
            description: "No handlers found in process definition",
            severity: "critical",
            solution: "Add at least one handler to the process",
          });
          score -= 30;
        }

        // Validate handler structure
        for (const handler of parsedProcess.handlers) {
          if (!handler.action || !handler.description) {
            issues.push({
              affectedComponents: ["ProcessCommunicationService"],
              category: "functionality",
              description: `Handler ${handler.action} missing required fields`,
              severity: "major",
              solution: "Ensure all handlers have action and description",
            });
            score -= 10;
          }
        }

        // Test message building
        if (parsedProcess.handlers.length > 0) {
          const testHandler = parsedProcess.handlers[0];
          const testMessage = processService.buildAOMessage(
            processDefinition.id,
            testHandler,
            {},
          );

          if (!testMessage.processId || !testMessage.tags) {
            issues.push({
              affectedComponents: [
                "ProcessCommunicationService",
                "AOMessageService",
              ],
              category: "integration",
              description: "Failed to build valid AO message",
              severity: "major",
              solution: "Check handler parameter mapping",
            });
            score -= 15;
          }
        }

        // Add recommendations
        if (score > 80) {
          recommendations.push(
            "Consider adding more comprehensive handler documentation",
          );
        }

        return {
          isCompatible: score >= 70,
          issues,
          recommendations,
          score,
          warnings,
        };
      } catch (error) {
        issues.push({
          affectedComponents: ["ProcessCommunicationService"],
          category: "integration",
          description: `ProcessCommunicationService integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check service integration and dependencies",
        });

        return {
          isCompatible: false,
          issues,
          recommendations,
          score: 0,
          warnings,
        };
      }
    },

    validateTealCompilerIntegration: async (
      source: string,
    ): Promise<CompatibilityResult> => {
      const issues: CompatibilityIssue[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      try {
        // Test Teal compilation
        const compileResult =
          await tealCompilerService.compileTealToLua(source);

        if (!compileResult.success) {
          issues.push({
            affectedComponents: ["TealCompilerService"],
            category: "functionality",
            description: "Teal compilation failed",
            severity: "critical",
            solution: "Check Teal source syntax and fix errors",
          });
          score -= 40;
        }

        // Test type validation
        const typeResult = await tealCompilerService.validateTealTypes(source);

        if (!typeResult.success) {
          issues.push({
            affectedComponents: ["TealCompilerService"],
            category: "functionality",
            description: "Type validation failed",
            severity: "major",
            solution: "Fix type errors in Teal source",
          });
          score -= 20;
        }

        // Test AO integration
        if (compileResult.compiledLua) {
          const aoIntegration =
            await tealCompilerService.integrateWithAOServices(
              compileResult.compiledLua,
              "test-process",
            );

          if (!aoIntegration) {
            issues.push({
              affectedComponents: ["TealCompilerService"],
              category: "integration",
              description: "AO integration failed",
              severity: "major",
              solution: "Check AO service integration",
            });
            score -= 25;
          }
        }

        return {
          isCompatible: score >= 70,
          issues,
          recommendations,
          score,
          warnings,
        };
      } catch (error) {
        issues.push({
          affectedComponents: ["TealCompilerService"],
          category: "integration",
          description: `TealCompilerService integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "critical",
          solution: "Check service integration and dependencies",
        });

        return {
          isCompatible: false,
          issues,
          recommendations,
          score: 0,
          warnings,
        };
      }
    },
  };
};

// Helper functions
const generateProcessMarkdown = async (
  processDefinition: TealProcessDefinition,
): Promise<string> => {
  return `# ${processDefinition.name}\n\n${processDefinition.metadata.description}\n\n## Info\n\nGet process information\n\n## Test\n\nTest handler for compatibility validation\n\n- action: Action name (required)\n- data: Test data (optional)\n`;
};

const validateDevelopStage = async (
  processDefinition: TealProcessDefinition,
  tealCompilerService: TealCompilerService,
): Promise<StageCompatibilityResult> => {
  const startTime = Date.now();
  const issues: CompatibilityIssue[] = [];
  let score = 100;

  try {
    const compileResult = await tealCompilerService.compileTealToLua(
      processDefinition.source,
    );

    if (!compileResult.success) {
      issues.push({
        affectedComponents: ["TealCompilerService"],
        category: "functionality",
        description: "Teal compilation failed in develop stage",
        severity: "major",
        solution: "Fix Teal source code issues",
      });
      score -= 30;
    }

    return {
      duration: Date.now() - startTime,
      isCompatible: score >= 70,
      issues,
      score,
      stage: "develop",
    };
  } catch (error) {
    issues.push({
      affectedComponents: ["TealCompilerService"],
      category: "integration",
      description: `Develop stage failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      severity: "critical",
      solution: "Check develop stage integration",
    });

    return {
      duration: Date.now() - startTime,
      isCompatible: false,
      issues,
      score: 0,
      stage: "develop",
    };
  }
};

const validateTestStage = async (
  processDefinition: TealProcessDefinition,
  aoLiteTestService: AOLiteTestService,
): Promise<StageCompatibilityResult> => {
  const startTime = Date.now();
  const issues: CompatibilityIssue[] = [];
  let score = 100;

  try {
    const environment =
      await aoLiteTestService.createTestEnvironment(processDefinition);
    const testSuite =
      await aoLiteTestService.createDefaultTestSuite(processDefinition);

    if (!environment.isRunning) {
      issues.push({
        affectedComponents: ["AOLiteTestService"],
        category: "functionality",
        description: "Test environment failed to start",
        severity: "major",
        solution: "Check test environment setup",
      });
      score -= 25;
    }

    if (testSuite.testCases.length === 0) {
      issues.push({
        affectedComponents: ["AOLiteTestService"],
        category: "functionality",
        description: "No test cases generated",
        severity: "major",
        solution: "Ensure process has testable handlers",
      });
      score -= 20;
    }

    return {
      duration: Date.now() - startTime,
      isCompatible: score >= 70,
      issues,
      score,
      stage: "test",
    };
  } catch (error) {
    issues.push({
      affectedComponents: ["AOLiteTestService"],
      category: "integration",
      description: `Test stage failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      severity: "critical",
      solution: "Check test stage integration",
    });

    return {
      duration: Date.now() - startTime,
      isCompatible: false,
      issues,
      score: 0,
      stage: "test",
    };
  }
};

const validateDeployStage = async (
  processDefinition: TealProcessDefinition,
): Promise<StageCompatibilityResult> => {
  const startTime = Date.now();
  const issues: CompatibilityIssue[] = [];
  let score = 100;

  // Mock deployment validation
  if (!processDefinition.compiledLua) {
    issues.push({
      affectedComponents: ["PermawebDeployService"],
      category: "functionality",
      description: "No compiled Lua available for deployment",
      severity: "major",
      solution: "Ensure compilation stage completes successfully",
    });
    score -= 30;
  }

  return {
    duration: Date.now() - startTime,
    isCompatible: score >= 70,
    issues,
    score,
    stage: "deploy",
  };
};

const createTestProcessDefinition = (): TealProcessDefinition => {
  return {
    compiledLua: `-- Compiled Test Lua
local function info(msg)
  return {
    Output = json.encode({ message = "Test Process" }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,
    dependencies: ["json"],
    id: "test-process",
    metadata: {
      aoVersion: "2.0.0",
      author: "Test",
      compileOptions: {
        strict: true,
        target: "lua53",
        warnings: true,
      },
      description: "Test process for compatibility validation",
      version: "1.0.0",
    },
    name: "Test Process",
    source: `-- Test Teal Process
local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode({ message = "Test Process" }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,
    typeDefinitions: [],
    version: "1.0.0",
  };
};

const createTestSigner = (): JWKInterface => {
  // Mock signer for testing
  return {
    d: "test-private",
    dp: "test-dp",
    dq: "test-dq",
    e: "AQAB",
    kty: "RSA",
    n: "test-key",
    p: "test-p",
    q: "test-q",
    qi: "test-qi",
  };
};

export const createAODevToolsCompatibilityService = (
  processService: ProcessCommunicationService,
  aoMessageService: AOMessageService,
  tealCompilerService: TealCompilerService,
  aoLiteTestService: AOLiteTestService,
  tealWorkflowService: TealWorkflowService,
  pipelineService: AODevelopmentPipelineService,
): AODevToolsCompatibilityService =>
  service(
    processService,
    aoMessageService,
    tealCompilerService,
    aoLiteTestService,
    tealWorkflowService,
    pipelineService,
  );
