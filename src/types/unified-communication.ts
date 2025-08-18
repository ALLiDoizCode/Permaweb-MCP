import type { HandlerMetadata } from "../services/DocumentationProtocolService.js";

export interface AOProcessCommunicateArgs {
  // New batch operation support
  batchRequests?: BatchRequest[];
  formatting?: "compact" | "detailed" | "json";
  mode?: "auto" | "read" | "validate" | "write";
  parameters?: Record<string, unknown>;
  processId: string;
  processMarkdown?: string;
  processType?: string;
  request: string;
  requireConfirmation?: boolean;
  timeout?: number;
  validateOnly?: boolean;
  workflowTemplate?: string;
}

export interface BatchExecutionContext {
  batchId: string;
  rollbackOnError?: boolean;
  sequenceNumber: number;
  totalOperations: number;
}

export interface BatchOperationItemResult {
  error?: string;
  request: string;
  result?: UnifiedProcessResponse;
  sequenceNumber: number;
  skipped?: boolean;
  skipReason?: string;
  success: boolean;
}

export interface BatchOperationResult {
  batchId: string;
  completedOperations: number;
  executionTime: number;
  failedOperations: number;
  results: BatchOperationItemResult[];
  success: boolean;
  totalOperations: number;
}

export interface BatchRequest {
  mode?: "auto" | "read" | "validate" | "write";
  parameters?: Record<string, unknown>;
  request: string;
  requireConfirmation?: boolean;
}

export interface EnhancedHandlerMatch {
  confidence: number;
  handler: HandlerMetadata;
  operationType: "read" | "unknown" | "write";
  parameters: Record<string, unknown>;
  source: "adp" | "analysis" | "pattern";
}

export interface ExecutionRequest {
  batchContext?: BatchExecutionContext;
  handler: string;
  operationType: "read" | "write";
  parameters: Record<string, unknown>;
  processId: string;
  requireConfirmation?: boolean;
  validateOnly?: boolean;
}

export interface OperationDetectionResult {
  confidence: number; // 0-1 confidence score
  detectionMethod: "adp" | "fallback" | "nlp" | "pattern";
  operationType: "read" | "unknown" | "write";
  reasoning: string; // Explanation of detection logic
  riskLevel: "high" | "low" | "medium";
  suggestedParameters?: Record<string, unknown>;
}

export interface ParameterSuggestion {
  description: string;
  examples?: string[];
  name: string;
  required: boolean;
  type: string;
  validationRules?: string[];
}

export interface RiskAssessment {
  confirmationRequired: boolean;
  factors: string[];
  level: "high" | "low" | "medium";
  warnings: string[];
}

export interface SimulationResult {
  estimatedOutcome: Record<string, unknown>;
  potentialErrors: ValidationError[];
  resourceRequirements: {
    gasEstimate?: number;
    permissionRequirements: string[];
    tokenRequirement?: string;
  };
  riskAssessment: RiskAssessment;
  valid: boolean;
}

export interface UnifiedProcessResponse {
  executionTime: number;
  handlerUsed: string;
  operation: "read" | "unknown" | "validate" | "write";
  parameters: Record<string, unknown>;
  processingMode: string;
  result: {
    details: Record<string, unknown>;
    rawResponse: unknown;
    summary: string;
  };
  success: boolean;
  transaction?: {
    hash: string;
    status: "confirmed" | "failed" | "pending";
  };
}

export interface UnifiedRequestOptions {
  formatting?: "compact" | "detailed" | "json";
  mode?: "auto" | "read" | "validate" | "write";
  processMarkdown?: string;
  processType?: string;
  requireConfirmation?: boolean;
  timeout?: number;
  validateOnly?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
  suggestion?: string;
}
