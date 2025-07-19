export interface ActionContext {
  metadata?: Record<string, unknown>;
  sessionId: string;
  taskId?: string;
  triggeredBy: string;
  workflowId?: string;
}

export interface AgentAction {
  context: ActionContext;
  id: string;
  parameters: Record<string, unknown>;
  priority: TaskPriority;
  timestamp: string;
  type: AgentActionType;
}

export interface AgentActionResult {
  duration: number; // milliseconds
  error?: {
    code: string;
    details?: unknown;
    message: string;
  };
  result?: unknown;
  success: boolean;
  timestamp: string;
}

export type AgentActionType =
  | "analyze"
  | "collaborate"
  | "create_workflow"
  | "execute_task"
  | "report"
  | "send_message"
  | "update_status";

export interface AgentConfig {
  capabilities: string[];
  description: string;
  initialContext: Partial<AgentContext>;
  name: string;
  preferences: Partial<AgentPreferences>;
  role: AgentRole;
}

export interface AgentContext {
  collaborators: string[];
  environment: string;
  projectId: string;
  sessionId: string;
  taskQueue: TaskItem[];
  workflowState: WorkflowState;
}

export interface AgentMemory {
  longTerm: MemoryEntry[];
  preferences: AgentPreferences;
  shortTerm: MemoryEntry[];
  working: MemoryEntry[];
}

export interface AgentPreferences {
  collaboration: {
    feedbackStyle: "constructive" | "direct" | "supportive";
    meetingPreference: "async" | "hybrid" | "sync";
    preferredTools: string[];
  };
  communicationStyle: "casual" | "collaborative" | "formal" | "technical";
  notifications: {
    enabled: boolean;
    frequency: "daily" | "hourly" | "immediate";
    types: string[];
  };
  workingHours: {
    end: string;
    start: string;
    timezone: string;
  };
}

export type AgentRole =
  | "analyst"
  | "architect"
  | "bmad-master"
  | "developer"
  | "pm"
  | "qa"
  | "sm"
  | "ux-expert";

export interface AgentState {
  activeWorkflow?: string;
  conversationHistory: ConversationEntry[];
  currentTask?: string;
  lastActivity: string;
  projectContext: ProjectContext;
  status: AgentStatus;
}

export type AgentStatus = "active" | "busy" | "idle" | "offline";
export interface ConversationEntry {
  context?: Record<string, unknown>;
  id: string;
  message: string;
  messageType: "command" | "notification" | "question" | "response";
  speaker: string;
  timestamp: string;
}

export interface MemoryEntry {
  content: string;
  context?: Record<string, unknown>;
  id: string;
  importance: number; // 0-1
  memoryType: "experience" | "knowledge" | "preference" | "skill";
  tags: string[];
  timestamp: string;
}

export interface ProjectContext {
  constraints: string[];
  objectives: string[];
  phase: string;
  projectId: string;
  projectName: string;
  resources: string[];
  stakeholders: string[];
}

export interface TaskItem {
  assignedAt: string;
  dependencies: string[];
  description: string;
  dueDate?: string;
  estimatedTime?: number;
  id: string;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
}

export type TaskPriority = "critical" | "high" | "low" | "medium";

export type TaskStatus =
  | "blocked"
  | "cancelled"
  | "completed"
  | "in_progress"
  | "pending";

export interface TeamAgent {
  capabilities: string[];
  context: AgentContext;
  description: string;
  id: string;
  memory: AgentMemory;
  name: string;
  role: AgentRole;
  state: AgentState;
}

export interface WorkflowState {
  blockers: string[];
  currentStage?: string;
  dependencies: string[];
  nextActions: string[];
  progress: number; // 0-100
  workflowId?: string;
}

// Claude Code specific interfaces
export interface ClaudeCodeHookContext {
  sessionId: string;
  transcriptPath: string;
  workingDirectory: string;
  toolName?: string;
  eventType: "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop";
  timestamp: string;
}

export interface AgentDetectionPattern {
  hookType: string;
  pattern: RegExp;
  agentRole: AgentRole;
  confidence: number;
  contextRequirements: string[];
}

export interface ClaudeCodeAgentState extends AgentState {
  mcpConfiguration: MCPServerConfig;
  hookSubscriptions: string[];
  fileSystemState: FileSystemState;
}

export interface BMadProjectConfig {
  projectPath: string;
  agentPreferences: AgentPreferences;
  defaultAgent: AgentRole;
  gitIntegration: GitIntegrationConfig;
  memoryHubId: string;
}

export interface GitIntegrationConfig {
  enabled: boolean;
  watchPaths: string[];
  triggerPatterns: string[];
  excludePaths: string[];
}

export interface FileSystemState {
  configPath: string;
  statePath: string;
  lastModified: Date;
  permissions: FilePermissions;
}

export interface FilePermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface MCPServerConfig {
  scope: "Local" | "Project" | "User";
  transport: "stdio" | "sse" | "http";
  serverName: string;
  capabilities: string[];
  authentication?: MCPAuthConfig;
}

export interface MCPAuthConfig {
  type: "oauth2";
  provider: string;
  scopes: string[];
}

export interface AgentDetectionResult {
  success: boolean;
  detectedAgent?: AgentRole;
  confidence: number;
  context: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface GitContext {
  isRepository: boolean;
  currentBranch: string;
  recentCommits: GitCommit[];
  modifiedFiles: string[];
  projectStage: "development" | "testing" | "deployment" | "unknown";
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface FileChanges {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
}
