import { PermawebDocsResult } from "../services/PermawebDocsService.js";
import { GuidedProcessResult } from "./guided-process.js";
import { LuaCodeResult, RequirementAnalysis } from "./lua-workflow.js";

/**
 * Complete workflow orchestration result
 */
export interface CompleteWorkflowResult {
  error?: {
    code: string;
    details?: unknown;
    failedStage?: WorkflowStage;
    message: string;
  };
  executionTime: number;
  finalResult?: {
    codeResult: LuaCodeResult;
    documentation: PermawebDocsResult[];
    processResult: GuidedProcessResult;
    requirements: RequirementAnalysis;
    validationResult: ValidationResult;
  };
  metadata: Record<string, unknown>;
  report: WorkflowExecutionReport;
  sessionId: string;
  stages: WorkflowStageResult[];
  success: boolean;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  canContinue: boolean;
  issues: string[];
  isValid: boolean;
  recommendations: string[];
}

/**
 * Stage execution result
 */
export interface StageExecutionResult {
  context: WorkflowContext;
  error?: string;
  nextStage?: WorkflowStage;
  result: unknown;
  shouldPause?: boolean;
  stage: WorkflowStage;
  success: boolean;
}

/**
 * State persistence result
 */
export interface StatePersistenceResult {
  error?: string;
  sessionId: string;
  success: boolean;
  timestamp: Date;
  version: number;
}

/**
 * State validation result
 */
export interface StateValidationResult {
  canRecover: boolean;
  consistencyScore: number;
  issues: Array<{
    field?: string;
    message: string;
    severity: "error" | "warning";
    stage?: WorkflowStage;
  }>;
  isValid: boolean;
  recoveryActions: string[];
}

/**
 * Tool chain execution result
 */
export interface ToolChainResult {
  errors: Array<{
    error: string;
    tool: string;
  }>;
  executionOrder: string[];
  metadata: Record<string, unknown>;
  results: Record<string, unknown>;
  success: boolean;
  totalExecutionTime: number;
}

/**
 * Tool selection result for workflow stage execution
 */
export interface ToolSelection {
  dependencies: string[];
  expectedOutput: string;
  parameters: Record<string, unknown>;
  priority: number;
  toolName: string;
  toolType: "analysis" | "documentation" | "evaluation" | "process";
}

/**
 * Validation result for tool outputs
 */
export interface ValidationResult {
  issues: Array<{
    message: string;
    severity: "error" | "info" | "warning";
    stage?: WorkflowStage;
    tool?: string;
  }>;
  isValid: boolean;
  metadata: Record<string, unknown>;
  recommendations: string[];
  score: number;
}

/**
 * Configuration for workflow orchestration
 */
export interface WorkflowConfiguration {
  enableIterativeMode?: boolean;
  enableTemplateMode?: boolean;
  includeArchitectureAnalysis?: boolean;
  maxRetries?: number;
  mode: WorkflowMode;
  processType?: WorkflowProcessType;
  timeoutMs?: number;
}

/**
 * Context maintained throughout workflow execution
 */
export interface WorkflowContext {
  configuration: WorkflowConfiguration;
  currentStage: WorkflowStage;
  hubId?: string;
  keyPair?: unknown; // JWKInterface
  metadata: Record<string, unknown>;
  processId?: string;
  sessionId: string;
  stageHistory: WorkflowStage[];
  timestamp: Date;
  userRequest: string;
}

/**
 * Workflow execution report for comprehensive tracking
 */
export interface WorkflowExecutionReport {
  auditTrail: Array<{
    action: string;
    details: Record<string, unknown>;
    stage: WorkflowStage;
    timestamp: Date;
  }>;
  configuration: WorkflowConfiguration;
  performance: {
    averageStageTime: number;
    bottleneckStage?: WorkflowStage;
    totalExecutionTime: number;
  };
  qualityMetrics: {
    codeQuality?: number;
    documentationCoverage?: number;
    testCoverage?: number;
    validationScore: number;
  };
  resourceUsage: {
    codeEvaluations: number;
    documentationQueries: number;
    processesCreated: number;
    totalApiCalls: number;
  };
  sessionId: string;
  stageExecutions: Array<{
    dataSize: number;
    endTime: Date;
    errors: string[];
    stage: WorkflowStage;
    startTime: Date;
    success: boolean;
    toolsUsed: string[];
  }>;
  userRequest: string;
}

/**
 * Workflow execution mode determines interaction level
 */
export type WorkflowMode = "autonomous" | "guided";

/**
 * Process type hint for workflow optimization
 */
export type WorkflowProcessType =
  | "bot"
  | "chatroom"
  | "custom"
  | "game"
  | "token";

/**
 * Workflow results for validation
 */
export interface WorkflowResults {
  context: WorkflowContext;
  finalOutput?: unknown;
  report: WorkflowExecutionReport;
  stages: WorkflowStageResult[];
}

/**
 * Workflow session for state management
 */
export interface WorkflowSession {
  canResume: boolean;
  errors: Array<{
    error: string;
    stage: WorkflowStage;
    timestamp: Date;
  }>;
  isActive: boolean;
  isPaused: boolean;
  metadata: Record<string, unknown>;
  sessionId: string;
  state: WorkflowState;
}

/**
 * Represents different stages of the workflow orchestration process
 */
export type WorkflowStage =
  | "architecture-analysis"
  | "code-evaluation"
  | "code-generation"
  | "completion"
  | "deployment"
  | "documentation-query"
  | "initialization"
  | "process-creation"
  | "requirement-analysis"
  | "testing"
  | "validation";

/**
 * Result from workflow stage execution
 */
export interface WorkflowStageResult {
  data: unknown;
  error?: {
    code: string;
    details?: unknown;
    message: string;
  };
  executionTime: number;
  metadata: Record<string, unknown>;
  nextStage?: WorkflowStage;
  stage: WorkflowStage;
  success: boolean;
  toolsUsed: string[];
}

/**
 * Workflow state for persistence and resumption
 */
export interface WorkflowState {
  checkpoints: Array<{
    stage: WorkflowStage;
    state: Record<string, unknown>;
    timestamp: Date;
  }>;
  context: WorkflowContext;
  currentData: {
    codeResult?: LuaCodeResult;
    documentation?: PermawebDocsResult[];
    processResult?: GuidedProcessResult;
    requirements?: RequirementAnalysis;
  };
  lastUpdate: Date;
  sessionId: string;
  stageResults: Record<WorkflowStage, WorkflowStageResult>;
  version: number;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  canProceed: boolean;
  completionScore: number;
  issues: Array<{
    message: string;
    recommendation?: string;
    severity: "error" | "info" | "warning";
    stage?: WorkflowStage;
  }>;
  isValid: boolean;
  nextActions: string[];
  qualityScore: number;
}
