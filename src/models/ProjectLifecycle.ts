export interface ActionItem {
  assignee: string;
  dependencies?: string[];
  description: string;
  dueDate: string;
  id: string;
  priority: "high" | "low" | "medium";
  status: "cancelled" | "completed" | "in_progress" | "open";
}

export type ArtifactType =
  | "api"
  | "database"
  | "file"
  | "repository"
  | "service"
  | "url";

export interface BudgetCategory {
  allocated: number;
  category: string;
  forecast: number;
  spent: number;
}

export interface CommunicationPreference {
  frequency: "daily" | "milestone" | "monthly" | "on_demand" | "weekly";
  level: "detailed" | "summary" | "technical";
  methods: ("chat" | "dashboard" | "email" | "meeting" | "report")[];
}

export interface CompletionCriterion {
  actual?: string;
  description: string;
  id: string;
  target: string;
  type: "approval" | "deliverable" | "event" | "metric" | "test";
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export type ConstraintType =
  | "budget"
  | "dependency"
  | "regulatory"
  | "resource"
  | "technology"
  | "time";
export interface DeliverableArtifact {
  checksum?: string;
  id: string;
  location: string;
  metadata?: Record<string, unknown>;
  name: string;
  size?: number;
  type: ArtifactType;
  version: string;
}

export type DeliverableStatus =
  | "approved"
  | "completed"
  | "in_progress"
  | "pending"
  | "rejected"
  | "review";

export type DeliverableType =
  | "approval"
  | "code"
  | "data"
  | "design"
  | "document"
  | "prototype"
  | "report";

export interface ExitCriterion {
  condition: string;
  description: string;
  id: string;
  name: string;
  required: boolean;
  status: "met" | "not_met" | "pending";
  type: "approval" | "deliverable" | "metric" | "quality" | "test";
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface GateReview {
  actualDate?: string;
  agenda: ReviewAgendaItem[];
  decisions: ReviewDecision[];
  id: string;
  name: string;
  outcomes: ReviewOutcome[];
  participants: ReviewParticipant[];
  scheduledDate: string;
  status: ReviewStatus;
  type: "approval" | "audit" | "checkpoint" | "milestone";
}

export interface GovernanceSettings {
  approvalRequired: boolean;
  auditTrail: boolean;
  complianceFramework?: string;
  escalationPath: string[];
  reviewCycle: "milestone" | "monthly" | "weekly";
}

export interface IntegrationSettings {
  bidirectional: boolean;
  configuration: Record<string, unknown>;
  events: string[];
  name: string;
  type: "api" | "service" | "tool" | "webhook";
}

// Lifecycle Management interfaces
export interface LifecycleConfiguration {
  customizations: LifecycleCustomization[];
  governance: GovernanceSettings;
  integrations: IntegrationSettings[];
  notifications: NotificationSettings;
  templateId: string;
}

export interface LifecycleCustomization {
  modifications: Record<string, unknown>;
  reason: string;
  targetId: string;
  type: "deliverable" | "milestone" | "phase" | "workflow";
}

export interface LifecyclePhase {
  actualDuration?: number; // days
  deliverables: PhaseDeliverable[];
  dependencies: string[];
  description: string;
  endDate?: string;
  estimatedDuration: number; // days
  exitCriteria: ExitCriterion[];
  gateReviews: GateReview[];
  id: string;
  name: string;
  order: number;
  startDate?: string;
  status: PhaseStatus;
  workflows: string[]; // WorkflowDefinition IDs
}

export interface MilestoneRisk {
  description: string;
  id: string;
  impact: "high" | "low" | "medium";
  mitigation: string;
  owner: string;
  probability: "high" | "low" | "medium";
  status: "identified" | "mitigated" | "monitored" | "realized";
}

export type MilestoneStatus =
  | "at_risk"
  | "cancelled"
  | "completed"
  | "missed"
  | "on_track"
  | "upcoming";

export type MilestoneType =
  | "approval"
  | "delivery"
  | "phase_completion"
  | "project_end"
  | "project_start"
  | "review";

export interface NotificationRecipient {
  events: string[];
  identifier: string;
  type: "group" | "individual" | "role";
}

export interface NotificationSettings {
  channels: ("chat" | "dashboard" | "email" | "mobile")[];
  enabled: boolean;
  recipients: NotificationRecipient[];
  triggers: NotificationTrigger[];
}
export interface NotificationTrigger {
  condition?: string;
  delay?: number; // minutes
  event: string;
  repeat?: boolean;
}

export type ObjectiveStatus =
  | "achieved"
  | "at_risk"
  | "in_progress"
  | "not_achieved"
  | "not_started";

export interface PhaseDeliverable {
  artifacts: DeliverableArtifact[];
  completedDate?: string;
  dependencies: string[];
  description: string;
  dueDate: string;
  id: string;
  name: string;
  owner: string;
  qualityGate: QualityGate;
  status: DeliverableStatus;
  type: DeliverableType;
}

export type PhaseStatus =
  | "blocked"
  | "completed"
  | "in_progress"
  | "not_started"
  | "review";

export interface ProjectBudget {
  breakdown: BudgetCategory[];
  currency: string;
  remainingBudget: number;
  spentBudget: number;
  totalBudget: number;
  trackingPeriod: "annually" | "monthly" | "quarterly";
}

export interface ProjectConstraint {
  description: string;
  id: string;
  impact: "budget" | "quality" | "schedule" | "scope";
  mitigation?: string;
  severity: "high" | "low" | "medium";
  type: ConstraintType;
}

export interface ProjectLifecycle {
  currentPhase: string;
  description: string;
  id: string;
  metadata: ProjectMetadata;
  milestones: ProjectMilestone[];
  name: string;
  phases: LifecyclePhase[];
  status: ProjectStatus;
}

export interface ProjectMetadata {
  budget?: ProjectBudget;
  category: string;
  constraints: ProjectConstraint[];
  createdAt: string;
  createdBy: string;
  objectives: ProjectObjective[];
  resources: ProjectResource[];
  stakeholders: ProjectStakeholder[];
  tags: string[];
  updatedAt: string;
  version: string;
}

export interface ProjectMilestone {
  actualDate?: string;
  completionCriteria: CompletionCriterion[];
  deliverables: string[];
  dependencies: string[];
  description: string;
  id: string;
  name: string;
  risks: MilestoneRisk[];
  stakeholders: string[];
  status: MilestoneStatus;
  targetDate: string;
  type: MilestoneType;
}

export interface ProjectObjective {
  description: string;
  id: string;
  priority: "could_have" | "must_have" | "should_have" | "won't_have";
  status: ObjectiveStatus;
  success: SuccessMetric[];
  type: "business" | "operational" | "quality" | "technical";
}

export interface ProjectResource {
  allocation: ResourceAllocation[];
  availability: number; // 0-1 (percentage)
  cost: number;
  costUnit: "day" | "hour" | "month" | "project";
  id: string;
  name: string;
  skills: string[];
  type: ResourceType;
}

export interface ProjectStakeholder {
  communication: CommunicationPreference;
  id: string;
  influence: "high" | "low" | "medium";
  interest: "high" | "low" | "medium";
  name: string;
  responsibilities: string[];
  role: StakeholderRole;
}

export type ProjectStatus =
  | "active"
  | "cancelled"
  | "completed"
  | "on_hold"
  | "paused"
  | "planning";

export interface QualityCriterion {
  actual?: number | string;
  description: string;
  id: string;
  name: string;
  status: "failed" | "passed" | "pending";
  target: number | string;
  type: "checklist" | "review" | "test" | "threshold";
  weight: number; // 0-1
}

export interface QualityGate {
  approvalRequired: boolean;
  automated: boolean;
  criteria: QualityCriterion[];
  reviewers: string[];
}

export interface ResourceAllocation {
  allocation: number; // 0-1 (percentage)
  endDate: string;
  phaseId: string;
  role: string;
  startDate: string;
}

export type ResourceType =
  | "equipment"
  | "external"
  | "human"
  | "infrastructure"
  | "software";

export interface ReviewAgendaItem {
  duration: number; // minutes
  id: string;
  materials: string[];
  objectives: string[];
  presenter: string;
  topic: string;
}

export interface ReviewDecision {
  decidedAt: string;
  decidedBy: string;
  decision: string;
  followUp: ActionItem[];
  id: string;
  impact: "high" | "low" | "medium";
  rationale: string;
}

export interface ReviewOutcome {
  actionItems: ActionItem[];
  conditions?: string[];
  description: string;
  id: string;
  rationale: string;
  type: "approval" | "conditional" | "recommendation" | "rejection";
}

export interface ReviewParticipant {
  attended?: boolean;
  id: string;
  preparation?: string[];
  required: boolean;
  role: "decision_maker" | "observer" | "presenter" | "reviewer";
}

export type ReviewStatus =
  | "cancelled"
  | "completed"
  | "in_progress"
  | "rescheduled"
  | "scheduled";

export type StakeholderRole =
  | "manager"
  | "owner"
  | "regulator"
  | "sponsor"
  | "team_member"
  | "user"
  | "vendor";

export interface SuccessMetric {
  actual?: number | string;
  frequency: "continuous" | "daily" | "milestone" | "monthly" | "weekly";
  measurement: string;
  name: string;
  target: number | string;
  unit: string;
}
