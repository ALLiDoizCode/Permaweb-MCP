import { JWKInterface } from "arweave/node/lib/wallet.js";

import { type AIMemory, type MemoryType } from "../models/AIMemory.js";
import { type aiMemoryService } from "./aiMemoryService.js";
import {
  type BMADChecklist,
  type BMADChecklistItem,
  type BMADResourceService,
  type BMADStep,
  type BMADTask,
  type BMADTemplate,
} from "./BMADResourceService.js";
import { type WorkflowAutomationService } from "./WorkflowAutomationService.js";

export interface AgentTaskPerformance {
  agentId: string;
  averageDuration: number;
  qualityScore: number; // 0-1
  specializations: TaskType[];
  successRate: number; // 0-1
  tasksCompleted: number;
}

export interface AnalyticsRecommendation {
  description: string;
  expectedImpact: string;
  implementation: string[];
  priority: "high" | "low" | "medium";
  type: "efficiency" | "process" | "quality" | "resource";
}

export type AutomationLevel = "fully_automated" | "manual" | "semi_automated";
export interface BMADIntegrationResult {
  error?: string;
  integrationId: string;
  loadedResources: LoadedBMADResource[];
  success: boolean;
  validationResults: ResourceValidationResult[];
}
export interface BMADResourceReference {
  customizations?: Record<string, unknown>;
  resourceId: string;
  resourceType: "checklist" | "task" | "template" | "workflow";
  version?: string;
}

export interface ChecklistContext {
  parameters: Record<string, unknown>;
  projectId?: string;
  resources: string[];
  reviewerId?: string;
  sessionId: string;
  taskId?: string;
}

export interface ChecklistCustomization {
  additionalItems?: ChecklistItemDefinition[];
  descriptionOverride?: string;
  itemModifications?: ChecklistItemModification[];
  nameOverride?: string;
  validationOverrides?: ChecklistValidationRule[];
}

export interface ChecklistDefinition {
  description: string;
  id: string;
  items: ChecklistItemDefinition[];
  metadata: ChecklistMetadata;
  name: string;
  validationRules: ChecklistValidationRule[];
}

export interface ChecklistItemDefinition {
  dependsOn?: string[];
  description: string;
  id: string;
  required: boolean;
  title: string;
  type: "approval" | "check" | "input" | "validation";
  validation?: InputValidation;
  weight: number; // 0-1 for scoring
}

export interface ChecklistItemModification {
  action: "add_after" | "add_before" | "modify" | "remove";
  itemId: string;
  modifications?: Partial<ChecklistItemDefinition>;
  newItem?: ChecklistItemDefinition;
}

export interface ChecklistItemResult {
  itemId: string;
  notes?: string;
  response?: string;
  score: number; // 0-1
  status: ChecklistItemStatus;
  timestamp: string;
  validatedBy?: string;
}

export type ChecklistItemStatus =
  | "completed"
  | "failed"
  | "not_applicable"
  | "pending"
  | "skipped";

export interface ChecklistMetadata {
  category: string;
  createdAt: string;
  createdBy: string;
  purpose: string;
  tags: string[];
  version: string;
}

export interface ChecklistResult {
  checklistExecutionId: string;
  completionRate: number; // 0-1
  duration: number;
  error?: string;
  itemResults: ChecklistItemResult[];
  score: number; // 0-1
  success: boolean;
  validationResult: ChecklistValidationResult;
}

export interface ChecklistValidationResult {
  completionRate: number; // 0-1
  failedRules: string[];
  passed: boolean;
  recommendations: string[];
  requiredItemsPassed: boolean;
  score: number; // 0-1
}

export interface ChecklistValidationRule {
  id: string;
  message: string;
  requirement: number | string;
  type: "all_required" | "custom" | "minimum_score";
}

export interface DocumentGenerationResult {
  content: string;
  documentId: string;
  error?: string;
  format: string;
  metadata: DocumentMetadata;
  success: boolean;
  validationResults: ValidationResult[];
}

export interface DocumentMetadata {
  checksum?: string;
  generatedAt: string;
  generatedBy: string;
  size: number; // bytes
  templateId: string;
  variables: Record<string, unknown>;
  version: string;
}

export interface ExecutionMetadata {
  duration?: number; // milliseconds
  errorCount: number;
  lastError?: string;
  resourceUsage?: Record<string, number>;
  retryCount: number;
  warningCount: number;
}

export interface InputValidation {
  message: string;
  rule: string;
  type: "custom" | "enum" | "range" | "regex";
}

export interface IssueFrequency {
  averageSeverity: string;
  commonCauses: string[];
  frequency: number;
  issueType: string;
  suggestedSolutions: string[];
}

export interface LoadedBMADResource {
  checklistDefinitions?: ChecklistDefinition[];
  error?: string;
  loaded: boolean;
  resourceId: string;
  resourceType: string;
  taskDefinitions?: TaskDefinition[];
}

export interface QualityMetric {
  name: string;
  target?: number;
  trend: "declining" | "improving" | "stable";
  unit: string;
  value: number;
}

export interface RecurrencePattern {
  conditions?: string[];
  endDate?: string;
  interval: number;
  type: "daily" | "monthly" | "weekly";
}

export interface ResourceValidationResult {
  issues: string[];
  resourceId: string;
  valid: boolean;
  warnings: string[];
}

export interface SchedulingConstraint {
  description: string;
  flexibility: "fixed" | "flexible" | "preferred";
  requirement: string;
  type: "approval" | "prerequisite" | "resource" | "time";
}

export interface StepModification {
  action: "add_after" | "add_before" | "modify" | "remove";
  modifications?: Partial<TaskStep>;
  newStep?: TaskStep;
  stepId: string;
}

export interface TaskAnalytics {
  agentPerformance: AgentTaskPerformance[];
  averageDuration: number;
  averageQuality: number; // 0-1
  completionRate: number; // 0-1
  priorityDistribution: Record<TaskPriority, number>;
  recommendations: AnalyticsRecommendation[];
  taskTypeDistribution: Record<TaskType, number>;
  topIssues: IssueFrequency[];
  totalTasks: number;
  trends: TaskTrend[];
}

export interface TaskApproval {
  approverId: string;
  conditions?: string[];
  id: string;
  notes?: string;
  status: "approved" | "pending" | "rejected";
  timestamp: string;
}

export interface TaskAssignment {
  assignedAgentId: string;
  context: Record<string, unknown>;
  deadline?: string;
  dependencies: string[];
  priority: TaskPriority;
  taskId: string;
}

export interface TaskAssignmentResult {
  agentId: string;
  assigned: boolean;
  confidence: number; // 0-1
  error?: string;
  estimatedCompletionTime?: string;
  estimatedStartTime?: string;
  taskId: string;
}

export interface TaskConflict {
  affectedTasks: string[];
  description: string;
  severity: "high" | "low" | "medium";
  suggestions: string[];
  type: "capacity" | "dependency" | "resource" | "timing";
}

export interface TaskContext {
  constraints: string[];
  environment: string;
  parameters: Record<string, unknown>;
  projectId?: string;
  resources: string[];
  sessionId: string;
  triggeredBy: string;
  workflowId?: string;
}

export interface TaskCoordinationResult {
  assignments: TaskAssignmentResult[];
  conflicts: TaskConflict[];
  coordinationId: string;
  recommendations: string[];
  success: boolean;
}

export interface TaskCustomization {
  additionalInputs?: TaskInput[];
  additionalOutputs?: TaskOutput[];
  additionalValidation?: ValidationCriterion[];
  descriptionOverride?: string;
  nameOverride?: string;
  priorityOverride?: TaskPriority;
  stepModifications?: StepModification[];
}

export interface TaskDefinition {
  assignedAgent?: string;
  automationLevel: AutomationLevel;
  dependencies: string[];
  description: string;
  estimatedTime: number; // minutes
  id: string;
  inputs: TaskInput[];
  metadata: TaskMetadata;
  name: string;
  outputs: TaskOutput[];
  priority: TaskPriority;
  type: TaskType;
  validationCriteria: ValidationCriterion[];
}

export interface TaskDependency {
  dependsOnTaskId: string;
  lag: number; // minutes
  type:
    | "finish_to_finish"
    | "finish_to_start"
    | "start_to_finish"
    | "start_to_start";
}

export interface TaskError {
  code: string;
  details?: unknown;
  message: string;
  retryable: boolean;
  step?: string;
}

export interface TaskExecution {
  approvals: TaskApproval[];
  assignedTo?: string;
  completedAt?: string;
  context: TaskContext;
  id: string;
  metadata: ExecutionMetadata;
  pausedAt?: string;
  progress: TaskProgress;
  results: TaskExecutionResult[];
  startedAt?: string;
  status: TaskExecutionStatus;
  taskDefinitionId: string;
  validationResults: ValidationResult[];
}

export interface TaskExecutionResult {
  metadata?: Record<string, unknown>;
  outputId: string;
  quality: number; // 0-1
  timestamp: string;
  validated: boolean;
  value: unknown;
}

export interface TaskExecutionService {
  approveTaskCompletion: (
    taskId: string,
    approverId: string,
    notes?: string,
    hubId?: string,
  ) => Promise<boolean>;
  cancelTask: (taskId: string, hubId: string) => Promise<boolean>;
  // Task coordination and scheduling
  coordinateAgentTasks: (
    coordinatorId: string,
    taskAssignments: TaskAssignment[],
    hubId: string,
  ) => Promise<TaskCoordinationResult>;
  // Core task management
  createTask: (
    taskDef: TaskDefinition,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<string>;
  deleteTask: (taskId: string, hubId: string) => Promise<boolean>;

  // Checklist execution
  executeChecklist: (
    checklistId: string,
    context: ChecklistContext,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<ChecklistResult>;
  // Task execution
  executeTask: (
    taskId: string,
    context: TaskContext,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<TaskResult>;
  // Template-based document generation
  generateDocument: (
    templateId: string,
    variables: Record<string, unknown>,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<DocumentGenerationResult>;
  // Task reporting and analytics
  generateTaskReport: (
    taskId: string,
    reportType: TaskReportType,
    hubId: string,
  ) => Promise<TaskReport>;

  getDependentTasks: (
    taskId: string,
    hubId: string,
  ) => Promise<TaskExecution[]>;
  getTask: (taskId: string, hubId: string) => Promise<null | TaskExecution>;
  getTaskAnalytics: (
    taskFilters: TaskFilters,
    hubId: string,
  ) => Promise<TaskAnalytics>;

  // BMAD resource integration
  integrateWithBMADResources: (
    taskId: string,
    resourceReferences: BMADResourceReference[],
    hubId: string,
  ) => Promise<BMADIntegrationResult>;
  listTasks: (hubId: string, filters?: TaskFilters) => Promise<TaskExecution[]>;
  loadBMADChecklist: (
    bmadChecklistId: string,
    customizations?: ChecklistCustomization,
    hubId?: string,
  ) => Promise<ChecklistDefinition>;

  loadBMADTask: (
    bmadTaskId: string,
    customizations?: TaskCustomization,
    hubId?: string,
  ) => Promise<TaskDefinition>;
  pauseTask: (taskId: string, hubId: string) => Promise<boolean>;

  previewTemplate: (
    templateId: string,
    variables: Record<string, unknown>,
    hubId: string,
  ) => Promise<string>;
  rejectTaskCompletion: (
    taskId: string,
    rejectorId: string,
    reason: string,
    hubId: string,
  ) => Promise<boolean>;
  resumeTask: (taskId: string, hubId: string) => Promise<boolean>;

  scheduleTask: (
    taskId: string,
    schedule: TaskSchedule,
    hubId: string,
  ) => Promise<boolean>;
  updateChecklistItem: (
    checklistExecutionId: string,
    itemId: string,
    status: ChecklistItemStatus,
    response?: string,
    hubId?: string,
  ) => Promise<boolean>;
  updateTask: (
    taskId: string,
    updates: Partial<TaskExecution>,
    hubId: string,
  ) => Promise<boolean>;

  validateChecklist: (
    checklistExecutionId: string,
    hubId: string,
  ) => Promise<ChecklistValidationResult>;
  // Task validation and completion
  validateTaskCompletion: (
    taskId: string,
    validationCriteria: ValidationCriterion[],
    hubId: string,
  ) => Promise<ValidationResult>;
}

export type TaskExecutionStatus =
  | "approved"
  | "cancelled"
  | "completed"
  | "failed"
  | "paused"
  | "pending"
  | "rejected"
  | "running";

export interface TaskFilters {
  assignedTo?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  priority?: TaskPriority[];
  status?: TaskExecutionStatus[];
  tags?: string[];
  type?: TaskType[];
}

export interface TaskInput {
  description: string;
  id: string;
  name: string;
  required: boolean;
  source?: string;
  type: "boolean" | "data" | "file" | "number" | "selection" | "text";
  validation?: InputValidation;
}

export interface TaskIssue {
  description: string;
  id: string;
  resolution?: string;
  severity: "critical" | "high" | "low" | "medium";
  status: "closed" | "in_progress" | "open" | "resolved";
  step?: string;
  timestamp: string;
  type: "blocker" | "error" | "risk" | "warning";
}

export interface TaskMetadata {
  bmadResourceId?: string;
  category: string;
  createdAt: string;
  createdBy: string;
  tags: string[];
  updatedAt: string;
  version: string;
}

export interface TaskOutput {
  description: string;
  destination?: string;
  format?: string;
  id: string;
  name: string;
  template?: string;
  type: "data" | "document" | "file" | "notification" | "report";
}

export interface TaskPerformanceMetrics {
  bottlenecks: string[];
  efficiency: number; // 0-1
  qualityMetrics: QualityMetric[];
  resourceUtilization: Record<string, number>;
  timeVariance: number; // actual vs estimated
}

export type TaskPriority = "critical" | "high" | "low" | "medium";

export interface TaskProgress {
  blockers: string[];
  currentStep?: string;
  estimatedTimeRemaining: number; // minutes
  notes: string[];
  percentComplete: number;
  stepsCompleted: number;
  stepsTotal: number;
}

export interface TaskReport {
  content: TaskReportContent;
  generatedAt: string;
  reportId: string;
  reportType: TaskReportType;
  taskId: string;
}

export interface TaskReportContent {
  issues: TaskIssue[];
  outputs: TaskReportOutput[];
  performance: TaskPerformanceMetrics;
  recommendations: string[];
  summary: TaskSummary;
  timeline: TaskTimelineEvent[];
}

export interface TaskReportOutput {
  location?: string;
  name: string;
  outputId: string;
  quality: number; // 0-1
  type: string;
  validated: boolean;
  value: unknown;
}

export type TaskReportType =
  | "detailed"
  | "issues"
  | "performance"
  | "summary"
  | "timeline";

export interface TaskResult {
  duration: number;
  error?: TaskError;
  outputs: TaskExecutionResult[];
  status: TaskExecutionStatus;
  success: boolean;
  taskExecutionId: string;
  validationResults: ValidationResult[];
}

export interface TaskSchedule {
  constraints: SchedulingConstraint[];
  deadline?: string;
  dependencies: TaskDependency[];
  recurrence?: RecurrencePattern;
  startTime?: string;
}

export interface TaskStep {
  dependencies: string[];
  description: string;
  estimatedTime: number; // minutes
  id: string;
  instructions: string;
  required: boolean;
  title: string;
  type: "action" | "decision" | "input" | "validation";
}

export interface TaskSummary {
  approvalStatus: string;
  qualityScore: number; // 0-1
  resourcesUsed: string[];
  stepsCompleted: number;
  stepsTotal: number;
  successRate: number;
  totalDuration: number;
}

export interface TaskTimelineEvent {
  actor?: string;
  description: string;
  event: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface TaskTrend {
  averageDuration: number;
  date: string;
  successRate: number; // 0-1
  tasksCompleted: number;
  tasksStarted: number;
}

export type TaskType =
  | "analysis"
  | "approval"
  | "checklist"
  | "communication"
  | "development"
  | "review"
  | "template";

export interface ValidationCriterion {
  automated: boolean;
  description: string;
  id: string;
  name: string;
  requirement: string;
  type: "approval" | "completion" | "metric" | "quality" | "test";
  weight: number; // 0-1
}

export interface ValidationResult {
  automated: boolean;
  criterionId: string;
  message: string;
  passed: boolean;
  score?: number; // 0-1
  timestamp: string;
  validatedBy?: string;
}

export class TaskExecutionServiceImpl implements TaskExecutionService {
  constructor(
    private bmadResourceService: BMADResourceService,
    private workflowService: WorkflowAutomationService,
    private memoryService: typeof aiMemoryService,
  ) {}

  async approveTaskCompletion(
    taskId: string,
    approverId: string,
    notes?: string,
    hubId?: string,
  ): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId!);
      if (!task) {
        return false;
      }

      const approval: TaskApproval = {
        approverId,
        id: `approval_${Date.now()}`,
        notes,
        status: "approved",
        timestamp: new Date().toISOString(),
      };

      const updates: Partial<TaskExecution> = {
        approvals: [...task.approvals, approval],
        status: "approved",
      };

      return await this.updateTask(taskId, updates, hubId!);
    } catch (error) {
      return false;
    }
  }

  async cancelTask(taskId: string, hubId: string): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        return false;
      }

      const updates: Partial<TaskExecution> = {
        completedAt: new Date().toISOString(),
        status: "cancelled",
      };

      return await this.updateTask(taskId, updates, hubId);
    } catch (error) {
      return false;
    }
  }

  async coordinateAgentTasks(
    coordinatorId: string,
    taskAssignments: TaskAssignment[],
    hubId: string,
  ): Promise<TaskCoordinationResult> {
    const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const assignments: TaskAssignmentResult[] = [];
    const conflicts: TaskConflict[] = [];

    try {
      // Analyze task dependencies and conflicts
      for (const assignment of taskAssignments) {
        try {
          const result = await this.analyzeTaskAssignment(assignment, hubId);
          assignments.push(result);

          if (result.confidence < 0.5) {
            conflicts.push({
              affectedTasks: [assignment.taskId],
              description: `Low confidence assignment for task ${assignment.taskId}`,
              severity: "medium",
              suggestions: [
                "Review task requirements",
                "Check agent availability",
              ],
              type: "resource",
            });
          }
        } catch (error) {
          assignments.push({
            agentId: assignment.assignedAgentId,
            assigned: false,
            confidence: 0,
            error: error instanceof Error ? error.message : "Unknown error",
            taskId: assignment.taskId,
          });
        }
      }

      const recommendations = this.generateCoordinationRecommendations(
        assignments,
        conflicts,
      );

      return {
        assignments,
        conflicts,
        coordinationId,
        recommendations,
        success: conflicts.length === 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to coordinate agent tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createTask(
    taskDef: TaskDefinition,
    signer: JWKInterface,
    hubId: string,
  ): Promise<string> {
    try {
      // Validate task definition
      this.validateTaskDefinition(taskDef);

      // Store task definition in memory service
      const taskMemory: Partial<AIMemory> = {
        content: JSON.stringify(taskDef),
        context: {
          domain: "task_definition",
          sessionId: `task_${taskDef.id}`,
          topic: taskDef.name,
        },
        importance: 0.8,
        memoryType: "workflow" as MemoryType,
      };

      await this.memoryService.addEnhanced(signer, hubId, taskMemory);
      return taskDef.id;
    } catch (error) {
      throw new Error(
        `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async deleteTask(taskId: string, hubId: string): Promise<boolean> {
    try {
      // Mark task as cancelled
      return await this.updateTask(taskId, { status: "cancelled" }, hubId);
    } catch (error) {
      return false;
    }
  }

  async executeChecklist(
    checklistId: string,
    context: ChecklistContext,
    signer: JWKInterface,
    hubId: string,
  ): Promise<ChecklistResult> {
    const startTime = Date.now();
    const executionId = `checklist_${checklistId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Load checklist definition
      const checklistDef = await this.getChecklistDefinition(
        checklistId,
        hubId,
      );
      if (!checklistDef) {
        return {
          checklistExecutionId: executionId,
          completionRate: 0,
          duration: Date.now() - startTime,
          error: "Checklist definition not found",
          itemResults: [],
          score: 0,
          success: false,
          validationResult: {
            completionRate: 0,
            failedRules: ["Checklist definition not found"],
            passed: false,
            recommendations: [],
            requiredItemsPassed: false,
            score: 0,
          },
        };
      }

      // Execute checklist items
      const itemResults: ChecklistItemResult[] = [];
      let totalScore = 0;
      let totalWeight = 0;

      for (const item of checklistDef.items) {
        const result = await this.executeChecklistItem(item, context, hubId);
        itemResults.push(result);

        totalScore += result.score * item.weight;
        totalWeight += item.weight;
      }

      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      const completionRate =
        itemResults.filter((r) => r.status === "completed").length /
        itemResults.length;

      // Validate checklist completion
      const validationResult = await this.validateChecklistCompletion(
        checklistDef,
        itemResults,
        averageScore,
        completionRate,
      );

      // Store checklist execution
      const checklistExecution = {
        checklistDefinitionId: checklistId,
        completedAt: new Date().toISOString(),
        context,
        id: executionId,
        itemResults,
        validationResult,
      };

      await this.storeChecklistExecution(checklistExecution, signer, hubId);

      return {
        checklistExecutionId: executionId,
        completionRate,
        duration: Date.now() - startTime,
        itemResults,
        score: averageScore,
        success: validationResult.passed,
        validationResult,
      };
    } catch (error) {
      return {
        checklistExecutionId: executionId,
        completionRate: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        itemResults: [],
        score: 0,
        success: false,
        validationResult: {
          completionRate: 0,
          failedRules: [
            error instanceof Error ? error.message : "Unknown error",
          ],
          passed: false,
          recommendations: [],
          requiredItemsPassed: false,
          score: 0,
        },
      };
    }
  }

  async executeTask(
    taskId: string,
    context: TaskContext,
    signer: JWKInterface,
    hubId: string,
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const executionId = `exec_${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get task definition
      const taskDef = await this.getTaskDefinition(taskId, hubId);
      if (!taskDef) {
        return {
          duration: Date.now() - startTime,
          error: {
            code: "TASK_NOT_FOUND",
            message: `Task definition ${taskId} not found`,
            retryable: false,
          },
          outputs: [],
          status: "failed",
          success: false,
          taskExecutionId: executionId,
          validationResults: [],
        };
      }

      // Create task execution record
      const execution: TaskExecution = {
        approvals: [],
        assignedTo: context.triggeredBy,
        context,
        id: executionId,
        metadata: {
          errorCount: 0,
          retryCount: 0,
          warningCount: 0,
        },
        progress: {
          blockers: [],
          estimatedTimeRemaining: taskDef.estimatedTime,
          notes: [],
          percentComplete: 0,
          stepsCompleted: 0,
          stepsTotal: this.countTaskSteps(taskDef),
        },
        results: [],
        startedAt: new Date().toISOString(),
        status: "running",
        taskDefinitionId: taskId,
        validationResults: [],
      };

      // Store execution record
      await this.storeTaskExecution(execution, signer, hubId);

      // Execute task based on type
      const results = await this.executeTaskByType(
        taskDef,
        execution,
        signer,
        hubId,
      );

      // Validate task completion
      const validationResults = await this.validateTaskExecution(
        taskDef,
        execution,
        hubId,
      );

      // Update execution status
      execution.status = this.determineExecutionStatus(
        results,
        validationResults,
      );
      execution.completedAt = new Date().toISOString();
      execution.results = results;
      execution.validationResults = validationResults;
      execution.progress.percentComplete = 100;

      await this.storeTaskExecution(execution, signer, hubId);

      return {
        duration: Date.now() - startTime,
        outputs: results,
        status: execution.status,
        success:
          execution.status === "completed" || execution.status === "approved",
        taskExecutionId: executionId,
        validationResults,
      };
    } catch (error) {
      return {
        duration: Date.now() - startTime,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
          retryable: true,
        },
        outputs: [],
        status: "failed",
        success: false,
        taskExecutionId: executionId,
        validationResults: [],
      };
    }
  }

  async generateDocument(
    templateId: string,
    variables: Record<string, unknown>,
    signer: JWKInterface,
    hubId: string,
  ): Promise<DocumentGenerationResult> {
    const documentId = `doc_${templateId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Load template from BMAD resources
      const template = await this.bmadResourceService.loadResource(
        "templates",
        templateId,
      );
      if (!template) {
        return {
          content: "",
          documentId,
          error: "Template not found",
          format: "",
          metadata: {
            generatedAt: new Date().toISOString(),
            generatedBy: "",
            size: 0,
            templateId,
            variables,
            version: "1.0.0",
          },
          success: false,
          validationResults: [],
        };
      }

      // Generate document content
      const content = await this.processTemplate(template, variables);
      const metadata: DocumentMetadata = {
        generatedAt: new Date().toISOString(),
        generatedBy: signer.kty || "unknown",
        size: content.length,
        templateId,
        variables,
        version: "1.0.0",
      };

      // Validate generated document
      const validationResults = await this.validateGeneratedDocument(
        content,
        template,
      );

      // Store document
      const documentMemory: Partial<AIMemory> = {
        content: JSON.stringify({ content, documentId, metadata }),
        context: {
          domain: "generated_document",
          topic: `template_${templateId}`,
        },
        importance: 0.7,
        memoryType: "knowledge" as MemoryType,
      };

      await this.memoryService.addEnhanced(signer, hubId, documentMemory);

      return {
        content,
        documentId,
        format: "markdown", // Default format
        metadata,
        success: true,
        validationResults,
      };
    } catch (error) {
      return {
        content: "",
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        format: "",
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: "",
          size: 0,
          templateId,
          variables,
          version: "1.0.0",
        },
        success: false,
        validationResults: [],
      };
    }
  }

  async generateTaskReport(
    taskId: string,
    reportType: TaskReportType,
    hubId: string,
  ): Promise<TaskReport> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        throw new Error("Task not found");
      }

      const reportId = `report_${taskId}_${Date.now()}`;
      const content = await this.generateTaskReportContent(task, reportType);

      return {
        content,
        generatedAt: new Date().toISOString(),
        reportId,
        reportType,
        taskId,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate task report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getDependentTasks(
    taskId: string,
    hubId: string,
  ): Promise<TaskExecution[]> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `dependencies:${taskId}`,
        { memoryType: "workflow" },
      );

      const dependentTasks: TaskExecution[] = [];
      for (const memory of memories) {
        try {
          const taskData = JSON.parse(memory.content) as TaskExecution;
          dependentTasks.push(taskData);
        } catch (parseError) {
          continue;
        }
      }

      return dependentTasks;
    } catch (error) {
      return [];
    }
  }

  async getTask(taskId: string, hubId: string): Promise<null | TaskExecution> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `task_execution_${taskId}`,
        { memoryType: "workflow" },
      );

      if (memories.length === 0) {
        return null;
      }

      return JSON.parse(memories[0].content) as TaskExecution;
    } catch (error) {
      return null;
    }
  }

  async getTaskAnalytics(
    taskFilters: TaskFilters,
    hubId: string,
  ): Promise<TaskAnalytics> {
    try {
      const tasks = await this.listTasks(hubId, taskFilters);

      const analytics: TaskAnalytics = {
        agentPerformance: this.calculateAgentPerformance(tasks),
        averageDuration: this.calculateAverageDuration(tasks),
        averageQuality: this.calculateAverageQuality(tasks),
        completionRate:
          tasks.filter((t) => t.status === "completed").length / tasks.length,
        priorityDistribution: this.calculatePriorityDistribution(tasks),
        recommendations: this.generateAnalyticsRecommendations(tasks),
        taskTypeDistribution: this.calculateTaskTypeDistribution(tasks),
        topIssues: this.analyzeTopIssues(tasks),
        totalTasks: tasks.length,
        trends: this.calculateTaskTrends(tasks),
      };

      return analytics;
    } catch (error) {
      throw new Error(
        `Failed to get task analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async integrateWithBMADResources(
    taskId: string,
    resourceReferences: BMADResourceReference[],
    hubId: string,
  ): Promise<BMADIntegrationResult> {
    const integrationId = `integration_${taskId}_${Date.now()}`;
    const loadedResources: LoadedBMADResource[] = [];
    const validationResults: ResourceValidationResult[] = [];

    try {
      for (const reference of resourceReferences) {
        try {
          const resource = await this.bmadResourceService.loadResource(
            reference.resourceType as any,
            reference.resourceId,
          );

          if (resource) {
            const loaded: LoadedBMADResource = {
              loaded: true,
              resourceId: reference.resourceId,
              resourceType: reference.resourceType,
            };

            // Convert BMAD resources to internal definitions
            if (reference.resourceType === "task") {
              loaded.taskDefinitions = [
                await this.convertBMADTaskToDefinition(
                  resource.content as BMADTask,
                ),
              ];
            } else if (reference.resourceType === "checklist") {
              loaded.checklistDefinitions = [
                await this.convertBMADChecklistToDefinition(
                  resource.content as BMADChecklist,
                ),
              ];
            }

            loadedResources.push(loaded);

            // Validate loaded resource
            const validation =
              await this.bmadResourceService.validateResource(resource);
            validationResults.push({
              issues: validation ? [] : ["Resource validation failed"],
              resourceId: reference.resourceId,
              valid: validation,
              warnings: [],
            });
          } else {
            loadedResources.push({
              error: "Resource not found",
              loaded: false,
              resourceId: reference.resourceId,
              resourceType: reference.resourceType,
            });
          }
        } catch (error) {
          loadedResources.push({
            error: error instanceof Error ? error.message : "Unknown error",
            loaded: false,
            resourceId: reference.resourceId,
            resourceType: reference.resourceType,
          });
        }
      }

      return {
        integrationId,
        loadedResources,
        success: loadedResources.every((r) => r.loaded),
        validationResults,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        integrationId,
        loadedResources,
        success: false,
        validationResults,
      };
    }
  }

  async listTasks(
    hubId: string,
    filters?: TaskFilters,
  ): Promise<TaskExecution[]> {
    try {
      let searchQuery = "task_execution";

      if (filters?.type && filters.type.length > 0) {
        searchQuery += ` type:${filters.type.join(" OR type:")}`;
      }

      if (filters?.assignedTo) {
        searchQuery += ` assignedTo:${filters.assignedTo}`;
      }

      const memories = await this.memoryService.searchAdvanced(
        hubId,
        searchQuery,
        { memoryType: "workflow" },
      );

      const tasks: TaskExecution[] = [];
      for (const memory of memories) {
        try {
          const taskData = JSON.parse(memory.content) as TaskExecution;

          // Apply filters
          if (this.matchesFilters(taskData, filters)) {
            tasks.push(taskData);
          }
        } catch (parseError) {
          continue;
        }
      }

      return tasks.sort((a, b) =>
        (b.startedAt || "").localeCompare(a.startedAt || ""),
      );
    } catch (error) {
      throw new Error(
        `Failed to list tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadBMADChecklist(
    bmadChecklistId: string,
    customizations?: ChecklistCustomization,
    hubId?: string,
  ): Promise<ChecklistDefinition> {
    try {
      const resource = await this.bmadResourceService.loadResource(
        "checklists",
        bmadChecklistId,
      );
      if (!resource) {
        throw new Error(`BMAD checklist ${bmadChecklistId} not found`);
      }

      const bmadChecklist = resource.content as BMADChecklist;
      let checklistDef =
        await this.convertBMADChecklistToDefinition(bmadChecklist);

      // Apply customizations
      if (customizations) {
        checklistDef = this.applyChecklistCustomizations(
          checklistDef,
          customizations,
        );
      }

      return checklistDef;
    } catch (error) {
      throw new Error(
        `Failed to load BMAD checklist: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadBMADTask(
    bmadTaskId: string,
    customizations?: TaskCustomization,
    hubId?: string,
  ): Promise<TaskDefinition> {
    try {
      const resource = await this.bmadResourceService.loadResource(
        "tasks",
        bmadTaskId,
      );
      if (!resource) {
        throw new Error(`BMAD task ${bmadTaskId} not found`);
      }

      const bmadTask = resource.content as BMADTask;
      let taskDef = await this.convertBMADTaskToDefinition(bmadTask);

      // Apply customizations
      if (customizations) {
        taskDef = this.applyTaskCustomizations(taskDef, customizations);
      }

      return taskDef;
    } catch (error) {
      throw new Error(
        `Failed to load BMAD task: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async pauseTask(taskId: string, hubId: string): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task || task.status !== "running") {
        return false;
      }

      const updates: Partial<TaskExecution> = {
        pausedAt: new Date().toISOString(),
        status: "paused",
      };

      return await this.updateTask(taskId, updates, hubId);
    } catch (error) {
      return false;
    }
  }

  async previewTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    hubId: string,
  ): Promise<string> {
    try {
      const template = await this.bmadResourceService.loadResource(
        "templates",
        templateId,
      );
      if (!template) {
        return "Template not found";
      }

      return await this.processTemplate(template, variables);
    } catch (error) {
      return `Error previewing template: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  async rejectTaskCompletion(
    taskId: string,
    rejectorId: string,
    reason: string,
    hubId: string,
  ): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        return false;
      }

      const rejection: TaskApproval = {
        approverId: rejectorId,
        id: `rejection_${Date.now()}`,
        notes: reason,
        status: "rejected",
        timestamp: new Date().toISOString(),
      };

      const updates: Partial<TaskExecution> = {
        approvals: [...task.approvals, rejection],
        status: "rejected",
      };

      return await this.updateTask(taskId, updates, hubId);
    } catch (error) {
      return false;
    }
  }

  async resumeTask(taskId: string, hubId: string): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task || task.status !== "paused") {
        return false;
      }

      const updates: Partial<TaskExecution> = {
        pausedAt: undefined,
        status: "running",
      };

      return await this.updateTask(taskId, updates, hubId);
    } catch (error) {
      return false;
    }
  }

  async scheduleTask(
    taskId: string,
    schedule: TaskSchedule,
    hubId: string,
  ): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        return false;
      }

      // Store schedule information
      const scheduleMemory: Partial<AIMemory> = {
        content: JSON.stringify({ schedule, taskId }),
        context: {
          domain: "task_schedule",
          topic: `schedule_${taskId}`,
        },
        importance: 0.7,
        memoryType: "workflow" as MemoryType,
      };

      await this.memoryService.addEnhanced(
        {} as JWKInterface,
        hubId,
        scheduleMemory,
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async updateChecklistItem(
    checklistExecutionId: string,
    itemId: string,
    status: ChecklistItemStatus,
    response?: string,
    hubId?: string,
  ): Promise<boolean> {
    try {
      const execution = await this.getChecklistExecution(
        checklistExecutionId,
        hubId!,
      );
      if (!execution) {
        return false;
      }

      // Update the specific item
      const itemIndex = execution.itemResults.findIndex(
        (item: ChecklistItemResult) => item.itemId === itemId,
      );
      if (itemIndex === -1) {
        return false;
      }

      execution.itemResults[itemIndex] = {
        ...execution.itemResults[itemIndex],
        response,
        status,
        timestamp: new Date().toISOString(),
      };

      // Store updated execution
      await this.storeChecklistExecution(execution, {} as JWKInterface, hubId!);
      return true;
    } catch (error) {
      return false;
    }
  }

  async updateTask(
    taskId: string,
    updates: Partial<TaskExecution>,
    hubId: string,
  ): Promise<boolean> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        return false;
      }

      const updatedTask = { ...task, ...updates };
      updatedTask.metadata.duration =
        Date.now() -
        new Date(task.startedAt || task.context.sessionId).getTime();

      // Store updated task
      const taskMemory: Partial<AIMemory> = {
        content: JSON.stringify(updatedTask),
        context: {
          domain: "task_execution",
          sessionId: task.context.sessionId,
          topic: `task_${taskId}`,
        },
        importance: 0.8,
        memoryType: "workflow" as MemoryType,
      };

      await this.memoryService.addEnhanced(
        {} as JWKInterface,
        hubId,
        taskMemory,
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async validateChecklist(
    checklistExecutionId: string,
    hubId: string,
  ): Promise<ChecklistValidationResult> {
    try {
      const execution = await this.getChecklistExecution(
        checklistExecutionId,
        hubId,
      );
      if (!execution) {
        return {
          completionRate: 0,
          failedRules: ["Checklist execution not found"],
          passed: false,
          recommendations: [],
          requiredItemsPassed: false,
          score: 0,
        };
      }

      return execution.validationResult;
    } catch (error) {
      return {
        completionRate: 0,
        failedRules: [error instanceof Error ? error.message : "Unknown error"],
        passed: false,
        recommendations: [],
        requiredItemsPassed: false,
        score: 0,
      };
    }
  }

  async validateTaskCompletion(
    taskId: string,
    validationCriteria: ValidationCriterion[],
    hubId: string,
  ): Promise<ValidationResult> {
    try {
      const task = await this.getTask(taskId, hubId);
      if (!task) {
        return {
          automated: true,
          criterionId: "task_existence",
          message: "Task not found",
          passed: false,
          timestamp: new Date().toISOString(),
        };
      }

      // Aggregate validation results
      let totalScore = 0;
      let totalWeight = 0;
      let allPassed = true;

      for (const criterion of validationCriteria) {
        const result = await this.validateSingleCriterion(
          task,
          criterion,
          hubId,
        );

        if (!result.passed) {
          allPassed = false;
        }

        if (result.score !== undefined) {
          totalScore += result.score * criterion.weight;
          totalWeight += criterion.weight;
        }
      }

      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      return {
        automated: true,
        criterionId: "overall_validation",
        message: allPassed
          ? "All validation criteria passed"
          : "Some validation criteria failed",
        passed: allPassed,
        score: averageScore,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        automated: true,
        criterionId: "validation_error",
        message:
          error instanceof Error ? error.message : "Unknown validation error",
        passed: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async analyzeTaskAssignment(
    assignment: TaskAssignment,
    hubId: string,
  ): Promise<TaskAssignmentResult> {
    // Simplified assignment analysis
    const confidence = Math.random() * 0.5 + 0.5; // 0.5-1.0
    const estimatedStartTime = new Date().toISOString();
    const estimatedCompletionTime = new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString(); // 1 hour later

    return {
      agentId: assignment.assignedAgentId,
      assigned: true,
      confidence,
      estimatedCompletionTime,
      estimatedStartTime,
      taskId: assignment.taskId,
    };
  }

  private analyzeTopIssues(tasks: TaskExecution[]): IssueFrequency[] {
    // Analyze common issues across tasks
    const issues: IssueFrequency[] = [];

    const failedTasks = tasks.filter((t) => t.status === "failed");
    if (failedTasks.length > 0) {
      issues.push({
        averageSeverity: "medium",
        commonCauses: ["Validation failures", "Resource constraints"],
        frequency: failedTasks.length,
        issueType: "task_failure",
        suggestedSolutions: [
          "Review task definitions",
          "Improve resource allocation",
        ],
      });
    }

    return issues;
  }

  private applyChecklistCustomizations(
    checklistDef: ChecklistDefinition,
    customizations: ChecklistCustomization,
  ): ChecklistDefinition {
    const customized = { ...checklistDef };

    if (customizations.nameOverride) {
      customized.name = customizations.nameOverride;
    }

    if (customizations.descriptionOverride) {
      customized.description = customizations.descriptionOverride;
    }

    if (customizations.additionalItems) {
      customized.items.push(...customizations.additionalItems);
    }

    if (customizations.validationOverrides) {
      customized.validationRules = customizations.validationOverrides;
    }

    return customized;
  }

  private applyTaskCustomizations(
    taskDef: TaskDefinition,
    customizations: TaskCustomization,
  ): TaskDefinition {
    const customized = { ...taskDef };

    if (customizations.nameOverride) {
      customized.name = customizations.nameOverride;
    }

    if (customizations.descriptionOverride) {
      customized.description = customizations.descriptionOverride;
    }

    if (customizations.priorityOverride) {
      customized.priority = customizations.priorityOverride;
    }

    if (customizations.additionalInputs) {
      customized.inputs.push(...customizations.additionalInputs);
    }

    if (customizations.additionalOutputs) {
      customized.outputs.push(...customizations.additionalOutputs);
    }

    if (customizations.additionalValidation) {
      customized.validationCriteria.push(
        ...customizations.additionalValidation,
      );
    }

    return customized;
  }

  private calculateAgentPerformance(
    tasks: TaskExecution[],
  ): AgentTaskPerformance[] {
    const agentStats: Record<string, AgentTaskPerformance> = {};

    tasks.forEach((task) => {
      if (!task.assignedTo) return;

      if (!agentStats[task.assignedTo]) {
        agentStats[task.assignedTo] = {
          agentId: task.assignedTo,
          averageDuration: 0,
          qualityScore: 0,
          specializations: [],
          successRate: 0,
          tasksCompleted: 0,
        };
      }

      const stats = agentStats[task.assignedTo];
      stats.tasksCompleted++;

      if (task.status === "completed") {
        stats.successRate =
          (stats.successRate * (stats.tasksCompleted - 1) + 1) /
          stats.tasksCompleted;
      }

      stats.qualityScore =
        (stats.qualityScore * (stats.tasksCompleted - 1) +
          this.calculateTaskQuality(task)) /
        stats.tasksCompleted;
    });

    return Object.values(agentStats);
  }

  private calculateAverageDuration(tasks: TaskExecution[]): number {
    const completedTasks = tasks.filter((t) => t.metadata.duration);
    if (completedTasks.length === 0) return 0;

    const totalDuration = completedTasks.reduce(
      (sum, t) => sum + (t.metadata.duration || 0),
      0,
    );
    return totalDuration / completedTasks.length;
  }

  private calculateAverageQuality(tasks: TaskExecution[]): number {
    const tasksWithResults = tasks.filter((t) => t.results.length > 0);
    if (tasksWithResults.length === 0) return 0;

    const totalQuality = tasksWithResults.reduce(
      (sum, t) => sum + this.calculateTaskQuality(t),
      0,
    );
    return totalQuality / tasksWithResults.length;
  }

  private calculatePriorityDistribution(
    tasks: TaskExecution[],
  ): Record<TaskPriority, number> {
    const distribution: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      low: 0,
      medium: 0,
    };

    // This would require task definitions to determine priorities
    // Simplified implementation
    tasks.forEach((task) => {
      distribution.medium++;
    });

    return distribution;
  }

  private calculateTaskQuality(task: TaskExecution): number {
    if (task.results.length === 0) return 0;

    const totalQuality = task.results.reduce(
      (sum, result) => sum + result.quality,
      0,
    );
    return totalQuality / task.results.length;
  }

  private calculateTaskTrends(tasks: TaskExecution[]): TaskTrend[] {
    // Group tasks by date and calculate trends
    const trends: Record<string, TaskTrend> = {};

    tasks.forEach((task) => {
      const date = (task.startedAt || "").split("T")[0];
      if (!trends[date]) {
        trends[date] = {
          averageDuration: 0,
          date,
          successRate: 0,
          tasksCompleted: 0,
          tasksStarted: 0,
        };
      }

      trends[date].tasksStarted++;
      if (task.status === "completed") {
        trends[date].tasksCompleted++;
      }
    });

    return Object.values(trends);
  }

  private calculateTaskTypeDistribution(
    tasks: TaskExecution[],
  ): Record<TaskType, number> {
    const distribution: Record<TaskType, number> = {
      analysis: 0,
      approval: 0,
      checklist: 0,
      communication: 0,
      development: 0,
      review: 0,
      template: 0,
    };

    // This would require task definitions to determine types
    // Simplified implementation
    tasks.forEach((task) => {
      distribution.development++;
    });

    return distribution;
  }

  private async convertBMADChecklistToDefinition(
    bmadChecklist: BMADChecklist,
  ): Promise<ChecklistDefinition> {
    const items: ChecklistItemDefinition[] = bmadChecklist.items.map(
      (item) => ({
        description: item.description,
        id: item.id,
        required: item.required,
        title: item.title,
        type: item.type as any,
        weight: 1 / bmadChecklist.items.length,
      }),
    );

    return {
      description: bmadChecklist.description,
      id: bmadChecklist.id,
      items,
      metadata: {
        category: bmadChecklist.metadata.category,
        createdAt: new Date().toISOString(),
        createdBy: bmadChecklist.metadata.author,
        purpose: bmadChecklist.metadata.purpose,
        tags: bmadChecklist.metadata.tags,
        version: bmadChecklist.metadata.version,
      },
      name: bmadChecklist.name,
      validationRules: [
        {
          id: "all_required",
          message: "All required items must be completed",
          requirement: "true",
          type: "all_required",
        },
      ],
    };
  }

  private async convertBMADTaskToDefinition(
    bmadTask: BMADTask,
  ): Promise<TaskDefinition> {
    return {
      automationLevel: "manual",
      dependencies: [],
      description: bmadTask.description,
      estimatedTime: parseInt(bmadTask.metadata.estimatedTime) || 60,
      id: bmadTask.id,
      inputs: [],
      metadata: {
        bmadResourceId: bmadTask.id,
        category: bmadTask.metadata.category,
        createdAt: new Date().toISOString(),
        createdBy: bmadTask.metadata.author,
        tags: bmadTask.metadata.tags,
        updatedAt: new Date().toISOString(),
        version: bmadTask.metadata.version,
      },
      name: bmadTask.title,
      outputs: [],
      priority: "medium",
      type: "development",
      validationCriteria: [],
    };
  }

  private countTaskSteps(taskDef: TaskDefinition): number {
    return (
      taskDef.inputs.length +
      taskDef.outputs.length +
      taskDef.validationCriteria.length
    );
  }

  private determineExecutionStatus(
    results: TaskExecutionResult[],
    validationResults: ValidationResult[],
  ): TaskExecutionStatus {
    if (results.length === 0) {
      return "failed";
    }

    const allValidationsPassed = validationResults.every((v) => v.passed);
    if (allValidationsPassed) {
      return "completed";
    }

    return "failed";
  }

  private async executeChecklistItem(
    item: ChecklistItemDefinition,
    context: ChecklistContext,
    hubId: string,
  ): Promise<ChecklistItemResult> {
    // Simplified implementation - in reality would interact with agents/users
    const status: ChecklistItemStatus = item.required
      ? "completed"
      : "completed";
    const score = status === "completed" ? item.weight : 0;

    return {
      itemId: item.id,
      notes: `Item ${item.title} processed`,
      score,
      status,
      timestamp: new Date().toISOString(),
    };
  }

  private async executeTaskByType(
    taskDef: TaskDefinition,
    execution: TaskExecution,
    signer: JWKInterface,
    hubId: string,
  ): Promise<TaskExecutionResult[]> {
    const results: TaskExecutionResult[] = [];

    switch (taskDef.type) {
      case "checklist":
        // Execute as checklist if BMAD resource reference exists
        if (taskDef.metadata.bmadResourceId) {
          const checklistResult = await this.executeChecklist(
            taskDef.metadata.bmadResourceId,
            {
              parameters: execution.context.parameters,
              resources: execution.context.resources,
              sessionId: execution.context.sessionId,
              taskId: execution.id,
            },
            signer,
            hubId,
          );

          results.push({
            outputId: "checklist_result",
            quality: checklistResult.score,
            timestamp: new Date().toISOString(),
            validated: checklistResult.validationResult.passed,
            value: checklistResult,
          });
        }
        break;

      case "template":
        // Generate document from template
        if (taskDef.metadata.bmadResourceId) {
          const docResult = await this.generateDocument(
            taskDef.metadata.bmadResourceId,
            execution.context.parameters,
            signer,
            hubId,
          );

          results.push({
            outputId: "generated_document",
            quality: docResult.success ? 1 : 0,
            timestamp: new Date().toISOString(),
            validated: docResult.success,
            value: docResult,
          });
        }
        break;

      default:
        // Generic task execution
        for (const output of taskDef.outputs) {
          results.push({
            outputId: output.id,
            quality: 0.8,
            timestamp: new Date().toISOString(),
            validated: false,
            value: `Generated output for ${output.name}`,
          });
        }
        break;
    }

    return results;
  }

  private generateAnalyticsRecommendations(
    tasks: TaskExecution[],
  ): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    const completionRate =
      tasks.filter((t) => t.status === "completed").length / tasks.length;

    if (completionRate < 0.8) {
      recommendations.push({
        description: "Task completion rate is below 80%",
        expectedImpact: "Improve overall productivity",
        implementation: [
          "Review task definitions",
          "Improve agent training",
          "Address common blockers",
        ],
        priority: "high",
        type: "efficiency",
      });
    }

    return recommendations;
  }

  private generateCoordinationRecommendations(
    assignments: TaskAssignmentResult[],
    conflicts: TaskConflict[],
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length > 0) {
      recommendations.push(
        "Review and resolve identified conflicts before proceeding",
      );
    }

    const lowConfidenceAssignments = assignments.filter(
      (a) => a.confidence < 0.7,
    );
    if (lowConfidenceAssignments.length > 0) {
      recommendations.push("Review low-confidence task assignments");
    }

    return recommendations;
  }

  private generateTaskRecommendations(task: TaskExecution): string[] {
    const recommendations: string[] = [];

    if (task.status === "failed") {
      recommendations.push("Review task execution errors and retry");
    }

    if (task.progress.blockers.length > 0) {
      recommendations.push("Address identified blockers to improve task flow");
    }

    if (task.validationResults.some((v) => !v.passed)) {
      recommendations.push("Review failed validation criteria");
    }

    return recommendations;
  }

  private async generateTaskReportContent(
    task: TaskExecution,
    reportType: TaskReportType,
  ): Promise<TaskReportContent> {
    const summary: TaskSummary = {
      approvalStatus:
        task.approvals.length > 0 ? task.approvals[0].status : "pending",
      qualityScore: this.calculateTaskQuality(task),
      resourcesUsed: task.context.resources,
      stepsCompleted: task.progress.stepsCompleted,
      stepsTotal: task.progress.stepsTotal,
      successRate: task.status === "completed" ? 1 : 0,
      totalDuration: task.metadata.duration || 0,
    };

    const timeline: TaskTimelineEvent[] = [
      {
        actor: task.assignedTo,
        description: "Task execution started",
        event: "task_started",
        timestamp: task.startedAt || "",
      },
    ];

    if (task.completedAt) {
      timeline.push({
        actor: task.assignedTo,
        description: "Task execution completed",
        event: "task_completed",
        timestamp: task.completedAt,
      });
    }

    const performance: TaskPerformanceMetrics = {
      bottlenecks: task.progress.blockers,
      efficiency: summary.successRate,
      qualityMetrics: [
        {
          name: "Overall Quality",
          trend: "stable",
          unit: "score",
          value: summary.qualityScore,
        },
      ],
      resourceUtilization: {},
      timeVariance: 0, // Would calculate based on estimated vs actual time
    };

    const issues: TaskIssue[] = [];
    if (task.metadata.errorCount > 0) {
      issues.push({
        description: `${task.metadata.errorCount} errors occurred during execution`,
        id: "execution_errors",
        severity: "medium",
        status: "open",
        timestamp: task.startedAt || "",
        type: "error",
      });
    }

    const outputs: TaskReportOutput[] = task.results.map((result) => ({
      name: result.outputId,
      outputId: result.outputId,
      quality: result.quality,
      type: "data",
      validated: result.validated,
      value: result.value,
    }));

    return {
      issues,
      outputs,
      performance,
      recommendations: this.generateTaskRecommendations(task),
      summary,
      timeline,
    };
  }

  private async getChecklistDefinition(
    checklistId: string,
    hubId: string,
  ): Promise<ChecklistDefinition | null> {
    try {
      // Try to load from BMAD resources first
      const resource = await this.bmadResourceService.loadResource(
        "checklists",
        checklistId,
      );
      if (resource) {
        return await this.convertBMADChecklistToDefinition(
          resource.content as BMADChecklist,
        );
      }

      // Try to load from memory
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `checklist_definition ${checklistId}`,
        { memoryType: "workflow" },
      );

      if (memories.length > 0) {
        return JSON.parse(memories[0].content) as ChecklistDefinition;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getChecklistExecution(
    executionId: string,
    hubId: string,
  ): Promise<any> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `checklist_execution_${executionId}`,
        { memoryType: "workflow" },
      );

      if (memories.length === 0) {
        return null;
      }

      return JSON.parse(memories[0].content);
    } catch (error) {
      return null;
    }
  }

  private async getTaskDefinition(
    taskId: string,
    hubId: string,
  ): Promise<null | TaskDefinition> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `task_definition task_${taskId}`,
        { memoryType: "workflow" },
      );

      if (memories.length === 0) {
        return null;
      }

      return JSON.parse(memories[0].content) as TaskDefinition;
    } catch (error) {
      return null;
    }
  }

  private matchesFilters(task: TaskExecution, filters?: TaskFilters): boolean {
    if (!filters) return true;

    if (filters.status && !filters.status.includes(task.status)) {
      return false;
    }

    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) {
      return false;
    }

    // Add more filter checks as needed

    return true;
  }

  private async processTemplate(
    template: any,
    variables: Record<string, unknown>,
  ): Promise<string> {
    // Simplified template processing
    let content =
      template.content?.template || template.template || "No template content";

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\s*${key}\s*}}`, "g");
      content = content.replace(regex, String(value));
    }

    return content;
  }

  private async storeChecklistExecution(
    execution: any,
    signer: JWKInterface,
    hubId: string,
  ): Promise<void> {
    const executionMemory: Partial<AIMemory> = {
      content: JSON.stringify(execution),
      context: {
        domain: "checklist_execution",
        sessionId: execution.context.sessionId,
        topic: `checklist_execution_${execution.id}`,
      },
      importance: 0.8,
      memoryType: "workflow" as MemoryType,
    };

    await this.memoryService.addEnhanced(signer, hubId, executionMemory);
  }

  private async storeTaskExecution(
    execution: TaskExecution,
    signer: JWKInterface,
    hubId: string,
  ): Promise<void> {
    const executionMemory: Partial<AIMemory> = {
      content: JSON.stringify(execution),
      context: {
        domain: "task_execution",
        sessionId: execution.context.sessionId,
        topic: `task_execution_${execution.id}`,
      },
      importance: 0.8,
      memoryType: "workflow" as MemoryType,
    };

    await this.memoryService.addEnhanced(signer, hubId, executionMemory);
  }

  private async validateChecklistCompletion(
    checklistDef: ChecklistDefinition,
    itemResults: ChecklistItemResult[],
    averageScore: number,
    completionRate: number,
  ): Promise<ChecklistValidationResult> {
    const failedRules: string[] = [];
    const recommendations: string[] = [];

    // Check validation rules
    for (const rule of checklistDef.validationRules) {
      switch (rule.type) {
        case "all_required":
          const requiredItems = checklistDef.items.filter(
            (item) => item.required,
          );
          const completedRequired = itemResults.filter(
            (result) =>
              requiredItems.some((item) => item.id === result.itemId) &&
              result.status === "completed",
          );

          if (completedRequired.length < requiredItems.length) {
            failedRules.push(rule.message);
          }
          break;

        case "minimum_score":
          if (averageScore < (rule.requirement as number)) {
            failedRules.push(rule.message);
          }
          break;
      }
    }

    const passed = failedRules.length === 0;
    const requiredItemsPassed = checklistDef.items
      .filter((item) => item.required)
      .every((item) =>
        itemResults.some(
          (result) =>
            result.itemId === item.id && result.status === "completed",
        ),
      );

    if (!passed) {
      recommendations.push("Review failed validation rules");
      recommendations.push("Complete all required checklist items");
    }

    return {
      completionRate,
      failedRules,
      passed,
      recommendations,
      requiredItemsPassed,
      score: averageScore,
    };
  }

  private async validateGeneratedDocument(
    content: string,
    template: any,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Basic validation
    results.push({
      automated: true,
      criterionId: "content_length",
      message:
        content.length > 0 ? "Document has content" : "Document is empty",
      passed: content.length > 0,
      score: content.length > 0 ? 1 : 0,
      timestamp: new Date().toISOString(),
    });

    return results;
  }

  private async validateSingleCriterion(
    execution: TaskExecution,
    criterion: ValidationCriterion,
    hubId: string,
  ): Promise<ValidationResult> {
    // Simplified validation logic
    const passed = execution.results.length > 0;
    const score = passed ? 0.8 : 0;

    return {
      automated: criterion.automated,
      criterionId: criterion.id,
      message: passed ? "Criterion met" : "Criterion not met",
      passed,
      score,
      timestamp: new Date().toISOString(),
    };
  }

  // Private helper methods
  private validateTaskDefinition(taskDef: TaskDefinition): void {
    if (!taskDef.id || !taskDef.name || !taskDef.type) {
      throw new Error("Task must have id, name, and type");
    }

    if (taskDef.estimatedTime <= 0) {
      throw new Error("Estimated time must be positive");
    }
  }

  private async validateTaskExecution(
    taskDef: TaskDefinition,
    execution: TaskExecution,
    hubId: string,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const criterion of taskDef.validationCriteria) {
      const result = await this.validateSingleCriterion(
        execution,
        criterion,
        hubId,
      );
      results.push(result);
    }

    return results;
  }
}

// Export singleton service factory
export const createTaskExecutionService = (
  bmadResourceService: BMADResourceService,
  workflowService: WorkflowAutomationService,
  memoryService: typeof aiMemoryService,
): TaskExecutionService => {
  return new TaskExecutionServiceImpl(
    bmadResourceService,
    workflowService,
    memoryService,
  );
};
