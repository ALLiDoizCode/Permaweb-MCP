export interface AODevelopmentPipeline {
  configuration: AOPipelineConfiguration;
  createdAt: Date;
  id: string;
  metadata: AOPipelineMetadata;
  name: string;
  stages: AODevelopmentStage[];
  status: "completed" | "draft" | "failed" | "running";
  updatedAt: Date;
}

export interface AODevelopmentStage {
  configuration: Record<string, unknown>;
  duration?: number;
  endTime?: Date;
  error?: string;
  id: string;
  name: "deploy" | "develop" | "docs" | "test";
  results?: unknown;
  service: string; // Service responsible for this stage
  startTime?: Date;
  status: "completed" | "failed" | "pending" | "running";
}

export interface AODevelopmentWorkflow {
  configuration: AOWorkflowConfiguration;
  description: string;
  id: string;
  name: string;
  stages: AOWorkflowStage[];
  triggers: AOWorkflowTrigger[];
}

export interface AOPipelineArtifact {
  checksum?: string;
  content: string;
  id: string;
  metadata?: Record<string, unknown>;
  name: string;
  size: number;
  type: "compiled" | "deployment" | "documentation" | "source" | "test";
}

export interface AOPipelineConfiguration {
  autoAdvance?: boolean;
  notifications?: AOPipelineNotification[];
  parallelExecution?: boolean;
  retries?: number;
  stopOnError?: boolean;
  timeout?: number;
}

export interface AOPipelineMetadata {
  aoVersion: string;
  author: string;
  description: string;
  processType: string;
  tags: string[];
  version: string;
}

export interface AOPipelineNotification {
  email?: string;
  message?: string;
  stage: string;
  type: "failure" | "success" | "warning";
  webhook?: string;
}

export interface AOPipelineResults {
  artifacts: AOPipelineArtifact[];
  completedStages: number;
  duration: number;
  failedStages: number;
  pipelineId: string;
  stageResults: AOStageResult[];
  status: "completed" | "failed" | "partial";
  totalStages: number;
}

export interface AOStageResult {
  artifacts?: AOPipelineArtifact[];
  duration: number;
  error?: string;
  name: string;
  output?: unknown;
  stageId: string;
  status: "completed" | "failed" | "skipped";
}

export interface AOWorkflowCondition {
  id: string;
  operator?: "and" | "or";
  target: string;
  type: "contains" | "equals" | "exists" | "matches";
  value: unknown;
}

export interface AOWorkflowConfiguration {
  concurrent?: boolean;
  environment?: Record<string, unknown>;
  maxConcurrency?: number;
  retries?: number;
  timeout?: number;
  workspace?: string;
}

export interface AOWorkflowStage {
  conditions?: AOWorkflowCondition[];
  configuration: Record<string, unknown>;
  dependencies: string[];
  id: string;
  name: string;
  type: "deploy" | "develop" | "docs" | "test" | "validate";
}

export interface AOWorkflowTrigger {
  conditions?: AOWorkflowCondition[];
  configuration: Record<string, unknown>;
  id: string;
  type: "file_change" | "manual" | "schedule" | "webhook";
}
