import { PermawebDocsResult } from "../services/PermawebDocsService.js";
import { LuaCodeResult, RequirementAnalysis } from "./lua-workflow.js";

/**
 * Deployment report with comprehensive results
 */
export interface DeploymentReport {
  codeQuality: {
    bestPracticesFollowed: string[];
    documentationCoverage: number;
    testCoverage: number;
  };
  deployment: {
    deploymentTime: Date;
    processId: string;
    status: "failed" | "success";
  };
  performance: {
    generationTimeMs: number;
    totalWorkflowTimeMs: number;
    validationTimeMs: number;
  };
  summary: string;
  validation: {
    passedTests: number;
    testResults: ValidationResult[];
    totalTests: number;
  };
}

/**
 * Result of process deployment
 */
export interface DeploymentResult {
  deployedHandlers: HandlerDefinition[];
  error?: string;
  processId: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecovery {
  recoveryAction: "retry" | "skip" | "stop";
  retryStep?: WorkflowStep;
}

/**
 * Feedback analysis for process refinement
 */
export interface FeedbackAnalysis {
  additionalDocsNeeded: string[];
  identifiedIssues: string[];
  refinementSuggestions: string[];
  testFailurePatterns: string[];
}

/**
 * Complete guided deployment result
 */
export interface GuidedDeploymentResult {
  deploymentReport: DeploymentReport;
  processCode: ProcessCodeResult;
  processId: string;
  success: boolean;
  validationResults: ValidationResult[];
}

/**
 * Main guided process creation interface
 */
export interface GuidedProcessCreation {
  analyzeRequirements(userRequest: string): Promise<RequirementAnalysis>;
  createProcess(): Promise<ProcessCreationResult>;
  deployCode(
    processId: string,
    code: ProcessCodeResult,
  ): Promise<DeploymentResult>;
  generateProcessCode(
    requirements: RequirementAnalysis,
    docs: PermawebDocsResult[],
  ): Promise<ProcessCodeResult>;
  validateDeployment(
    processId: string,
    handlers: HandlerDefinition[],
  ): Promise<ValidationResult[]>;
}

/**
 * Result of guided process creation workflow
 */
export interface GuidedProcessResult {
  deploymentResult?: DeploymentResult;
  processCode: ProcessCodeResult;
  processId?: string;
  success: boolean;
  validationResults?: ValidationResult[];
}

/**
 * Handler definition with name, match criteria, and handle function
 */
export interface HandlerDefinition {
  handleFunction: string;
  matchCriteria: string;
  name: string;
}

/**
 * Process code result extending LuaCodeResult with process-specific data
 */
export interface ProcessCodeResult extends LuaCodeResult {
  deploymentInstructions: string[];
  processStructure: {
    handlers: HandlerDefinition[];
    initializationCode: string;
    stateDefinition: string;
    utilityFunctions: string[];
  };
  templateUsed: ProcessTemplate;
  testCases: ProcessTestCase[];
}

/**
 * Process creation result
 */
export interface ProcessCreationResult {
  error?: string;
  processId?: string;
  success: boolean;
}

/**
 * Process deployment workflow interface
 */
export interface ProcessDeploymentWorkflow {
  executeFullWorkflow(
    userRequest: string,
    keyPair: unknown,
  ): Promise<GuidedDeploymentResult>;
  executeWorkflowStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult>;
  generateWorkflowReport(results: WorkflowResult): Promise<DeploymentReport>;
  handleWorkflowError(
    error: WorkflowError,
    context: WorkflowContext,
  ): Promise<ErrorRecovery>;
}

/**
 * Process template categories based on AO ecosystem patterns
 */
export type ProcessTemplate = "bot" | "chatroom" | "custom" | "game" | "token";

/**
 * Test case for process validation
 */
export interface ProcessTestCase {
  description: string;
  expectedBehavior: string;
  testCode: string;
}

/**
 * Refinement result after iterative improvement
 */
export interface RefinementResult {
  improvedCode: ProcessCodeResult;
  refinementActions: string[];
  success: boolean;
  validationResults: ValidationResult[];
}

/**
 * Result of a workflow step
 */
export interface StepResult {
  data?: unknown;
  error?: string;
  nextStep?: WorkflowStep;
  success: boolean;
}

/**
 * Validation result for process testing
 */
export interface ValidationResult {
  error?: string;
  passed: boolean;
  testCase: string;
  testResult?: string;
}

/**
 * Context for workflow execution
 */
export interface WorkflowContext {
  currentStep: WorkflowStep;
  processId?: string;
  requirements: RequirementAnalysis;
  stepHistory: WorkflowStep[];
}

/**
 * Workflow error information
 */
export interface WorkflowError {
  context: WorkflowContext;
  error: string;
  step: WorkflowStep;
}

/**
 * Complete workflow execution result
 */
export interface WorkflowResult {
  completedSteps: WorkflowStep[];
  deploymentResult?: DeploymentResult;
  error?: string;
  finalResult: GuidedProcessResult;
  processId?: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Workflow step in the deployment process
 */
export type WorkflowStep =
  | "analyze"
  | "deploy"
  | "generate"
  | "refine"
  | "validate"
  | "verify";
