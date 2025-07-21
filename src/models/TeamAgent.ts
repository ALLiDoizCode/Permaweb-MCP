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

export interface AgentDetectionPattern {
  agentRole: AgentRole;
  confidence: number;
  contextRequirements: string[];
  hookType: string;
  pattern: RegExp;
}

export interface AgentDetectionResult {
  confidence: number;
  context: Record<string, unknown>;
  detectedAgent?: AgentRole;
  error?: {
    code: string;
    details?: unknown;
    message: string;
  };
  success: boolean;
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

export interface BMadProjectConfig {
  agentPreferences: AgentPreferences;
  defaultAgent: AgentRole;
  gitIntegration: GitIntegrationConfig;
  memoryHubId: string;
  projectPath: string;
}

export interface ClaudeCodeAgentState extends AgentState {
  fileSystemState: FileSystemState;
  hookSubscriptions: string[];
  mcpConfiguration: MCPServerConfig;
}

// Claude Code specific interfaces
export interface ClaudeCodeHookContext {
  eventType: "PostToolUse" | "PreToolUse" | "Stop" | "UserPromptSubmit";
  sessionId: string;
  timestamp: string;
  toolName?: string;
  transcriptPath: string;
  workingDirectory: string;
}

export interface ConversationEntry {
  context?: Record<string, unknown>;
  id: string;
  message: string;
  messageType: "command" | "notification" | "question" | "response";
  speaker: string;
  timestamp: string;
}

export interface FileChanges {
  added: string[];
  deleted: string[];
  modified: string[];
  renamed: Array<{ from: string; to: string }>;
}

export interface FilePermissions {
  execute: boolean;
  read: boolean;
  write: boolean;
}

export interface FileSystemState {
  configPath: string;
  lastModified: Date;
  permissions: FilePermissions;
  statePath: string;
}

export interface GitCommit {
  author: string;
  hash: string;
  message: string;
  timestamp: string;
}

export interface GitContext {
  currentBranch: string;
  isRepository: boolean;
  modifiedFiles: string[];
  projectStage: "deployment" | "development" | "testing" | "unknown";
  recentCommits: GitCommit[];
}

export interface GitIntegrationConfig {
  enabled: boolean;
  excludePaths: string[];
  triggerPatterns: string[];
  watchPaths: string[];
}

export interface MCPAuthConfig {
  provider: string;
  scopes: string[];
  type: "oauth2";
}

export interface MCPServerConfig {
  authentication?: MCPAuthConfig;
  capabilities: string[];
  scope: "Local" | "Project" | "User";
  serverName: string;
  transport: "http" | "sse" | "stdio";
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
