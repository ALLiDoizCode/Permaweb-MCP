export interface AgentAssignment {
  agentId: string;
  availability: AvailabilityWindow[];
  permissions: AgentPermission[];
  responsibilities: string[];
  role: string;
}

export interface AgentPermission {
  actions: string[];
  conditions?: string[];
  resource: string;
}

export type AutomationLevel = "fully_automated" | "manual" | "semi_automated";

export interface AvailabilityWindow {
  end: string; // ISO datetime
  recurring?: RecurrencePattern;
  start: string; // ISO datetime
  timezone: string;
}

export interface DependencyCondition {
  operator?: "eq" | "gt" | "gte" | "lt" | "lte";
  type: "approval" | "completion" | "custom" | "threshold";
  value?: number | string;
}

export type DependencyType =
  | "finish_to_finish"
  | "finish_to_start"
  | "start_to_finish"
  | "start_to_start";

export interface ExecutionContext {
  constraints: string[];
  environment: string;
  parameters: Record<string, unknown>;
  resources: string[];
  triggeredBy: string;
}

export interface ExecutionParticipant {
  agentId: string;
  contribution: ParticipantContribution[];
  currentTask?: string;
  joinedAt: string;
  role: string;
}

export interface ExecutionProgress {
  completedStages: number;
  completedTasks: number;
  estimatedTimeRemaining: number; // minutes
  overallPercent: number;
  totalStages: number;
  totalTasks: number;
}
export interface ExecutionResult {
  approved: boolean;
  approvedBy?: string;
  notes?: string;
  output: unknown;
  quality: number; // 0-1
  stageId: string;
  taskId?: string;
  timestamp: string;
}

export type ExecutionStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "paused"
  | "pending"
  | "running";

export type InputType =
  | "boolean"
  | "data"
  | "file"
  | "number"
  | "selection"
  | "text";

export type OutputType =
  | "data"
  | "document"
  | "file"
  | "notification"
  | "report";

export interface ParticipantContribution {
  completedAt: string;
  notes?: string;
  quality: number; // 0-1
  taskId: string;
}

export interface RecurrencePattern {
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  endDate?: string;
  interval: number;
  type: "daily" | "monthly" | "weekly";
}

export interface TaskDefinition {
  assignedAgent: string;
  automationLevel: AutomationLevel;
  dependencies: string[];
  description: string;
  estimatedTime: number; // minutes
  id: string;
  inputs: TaskInput[];
  name: string;
  outputs: TaskOutput[];
  priority: TaskPriority;
  type: TaskType;
  validationCriteria: string[];
}

export interface TaskInput {
  id: string;
  name: string;
  required: boolean;
  source: string;
  type: InputType;
  validation?: ValidationRule[];
}

export interface TaskOutput {
  destination: string;
  format: string;
  id: string;
  name: string;
  template?: string;
  type: OutputType;
}

export type TaskPriority = "critical" | "high" | "low" | "medium";

export type TaskType =
  | "analysis"
  | "checklist"
  | "communication"
  | "development"
  | "review"
  | "template";

export interface TriggerAction {
  parameters: Record<string, unknown>;
  target: string;
  type: "execute_task" | "send_notification" | "start_workflow" | "update_data";
}

export interface TriggerCondition {
  expression: string;
  parameters: Record<string, unknown>;
  type: "agent_action" | "data" | "event" | "external" | "time";
}

export type TriggerType =
  | "condition"
  | "event"
  | "manual"
  | "scheduled"
  | "webhook";

export interface ValidationRule {
  message: string;
  type: "custom" | "format" | "range" | "required";
  value: number | RegExp | string;
}
export type WorkflowComplexity =
  | "complex"
  | "enterprise"
  | "moderate"
  | "simple";

export interface WorkflowDefinition {
  agentAssignments: AgentAssignment[];
  dependencies: WorkflowDependency[];
  description: string;
  id: string;
  metadata: WorkflowMetadata;
  name: string;
  stages: WorkflowStage[];
  triggers: WorkflowTrigger[];
  version: string;
}

export interface WorkflowDependency {
  condition: DependencyCondition;
  id: string;
  sourceStageId?: string;
  sourceTaskId?: string;
  sourceWorkflowId?: string;
  targetStageId?: string;
  targetTaskId?: string;
  type: DependencyType;
}

// Execution-related interfaces
export interface WorkflowExecution {
  completedAt?: string;
  context: ExecutionContext;
  currentStage?: string;
  id: string;
  participants: ExecutionParticipant[];
  progress: ExecutionProgress;
  results: ExecutionResult[];
  startedAt: string;
  status: ExecutionStatus;
  workflowId: string;
}

export interface WorkflowMetadata {
  author: string;
  category: string;
  complexity: WorkflowComplexity;
  createdAt: string;
  estimatedDuration: number; // minutes
  status: WorkflowStatus;
  tags: string[];
  updatedAt: string;
  version: string;
}

export interface WorkflowPreset {
  description: string;
  name: string;
  tags: string[];
  variables: Record<string, unknown>;
}

export interface WorkflowStage {
  assignedAgents: string[];
  deliverables: string[];
  description: string;
  estimatedDuration: number; // minutes
  exitCriteria: string[];
  id: string;
  name: string;
  order: number;
  parallelExecution: boolean;
  prerequisites: string[];
  tasks: TaskDefinition[];
}

export type WorkflowStatus =
  | "active"
  | "archived"
  | "completed"
  | "draft"
  | "paused";

// Template and configuration interfaces
export interface WorkflowTemplate {
  category: string;
  description: string;
  id: string;
  name: string;
  presets: WorkflowPreset[];
  template: WorkflowDefinition;
  variables: WorkflowVariable[];
}

export interface WorkflowTrigger {
  actions: TriggerAction[];
  condition: TriggerCondition;
  enabled: boolean;
  id: string;
  name: string;
  type: TriggerType;
}

export interface WorkflowVariable {
  defaultValue?: unknown;
  description: string;
  name: string;
  required: boolean;
  type: "array" | "boolean" | "number" | "object" | "string";
  validation?: ValidationRule[];
}
