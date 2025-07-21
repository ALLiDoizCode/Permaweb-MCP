import { JWKInterface } from "arweave/node/lib/wallet.js";

import { type AIMemory, type MemoryType } from "../models/AIMemory.js";
import {
  type AgentAction,
  type AgentActionResult,
  type AgentConfig,
  type AgentContext,
  type AgentMemory,
  type AgentRole,
  type AgentState,
  type ConversationEntry,
  type MemoryEntry,
  type TeamAgent,
} from "../models/TeamAgent.js";
import { type aiMemoryService } from "./aiMemoryService.js";
import { type ProcessCommunicationService } from "./ProcessCommunicationService.js";

export interface AgentBehavior {
  action: string;
  condition: string;
  priority: number;
  trigger: string;
}

export interface AgentCustomization {
  additionalCapabilities?: string[];
  behaviorModifications?: AgentBehavior[];
  contextOverrides?: Record<string, unknown>;
  description?: string;
  name?: string;
  preferenceOverrides?: Record<string, unknown>;
}

export interface AgentTemplate {
  behaviors: AgentBehavior[];
  defaultCapabilities: string[];
  defaultPreferences: Record<string, unknown>;
  description: string;
  name: string;
  optionalContext: string[];
  requiredContext: string[];
  role: AgentRole;
}

export interface BroadcastFailure {
  agentId: string;
  reason: string;
  retryable: boolean;
}

export interface BroadcastResult {
  delivered: string[];
  failed: BroadcastFailure[];
  messageId: string;
  success: boolean;
}

export interface CoordinationError {
  affectedAgentId?: string;
  affectedTaskId?: string;
  message: string;
  type:
    | "agent_unavailable"
    | "conflict"
    | "dependency_missing"
    | "invalid_task";
}

export interface MemoryContext {
  metadata?: Record<string, unknown>;
  projectId?: string;
  sessionId?: string;
  taskId?: string;
  workflowId?: string;
}

export interface MemoryFilters {
  importance?: {
    max: number;
    min: number;
  };
  limit?: number;
  memoryType?: "experience" | "knowledge" | "preference" | "skill";
  tags?: string[];
  timeRange?: {
    end: string;
    start: string;
  };
}

export interface TaskAssignment {
  assignedAgentId: string;
  context: Record<string, unknown>;
  deadline?: string;
  dependencies: string[];
  priority: "critical" | "high" | "low" | "medium";
  taskId: string;
}

export interface TaskAssignmentResult {
  agentId: string;
  assigned: boolean;
  error?: string;
  estimatedCompletionTime?: number;
  taskId: string;
}

export interface TaskCoordinationResult {
  assignments: TaskAssignmentResult[];
  coordinationId: string;
  errors?: CoordinationError[];
  success: boolean;
}

export interface TeamAgentService {
  addConversationEntry: (
    agentId: string,
    entry: ConversationEntry,
    hubId: string,
  ) => Promise<boolean>;
  broadcastToAgents: (
    senderAgentId: string,
    targetAgentIds: string[],
    message: string,
    messageType: string,
    hubId: string,
  ) => Promise<BroadcastResult>;
  coordinateAgentTasks: (
    coordinatorId: string,
    taskAssignments: TaskAssignment[],
    hubId: string,
  ) => Promise<TaskCoordinationResult>;
  // Core agent management
  createAgent: (
    agentConfig: AgentConfig,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<TeamAgent>;
  customizeAgentFromTemplate: (
    template: AgentTemplate,
    customizations: AgentCustomization,
  ) => AgentConfig;

  deleteAgent: (agentId: string, hubId: string) => Promise<boolean>;
  // Agent actions and behavior
  executeAgentAction: (
    agentId: string,
    action: AgentAction,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<AgentActionResult>;
  getAgent: (agentId: string, hubId: string) => Promise<null | TeamAgent>;

  // Agent templates and presets
  getAgentTemplate: (role: AgentRole) => AgentTemplate;
  // Agent coordination and collaboration
  initiateAgentConversation: (
    agentIds: string[],
    topic: string,
    initiatorId: string,
    hubId: string,
  ) => Promise<string>; // Returns conversation ID
  // Memory integration
  integrateWithMemoryService: (
    agentId: string,
    memoryContext: MemoryContext,
    hubId: string,
  ) => Promise<boolean>;

  listAgents: (hubId: string, role?: AgentRole) => Promise<TeamAgent[]>;
  loadAgentPreset: (
    presetId: string,
    hubId: string,
  ) => Promise<AgentConfig | null>;
  retrieveAgentMemories: (
    agentId: string,
    filters: MemoryFilters,
    hubId: string,
  ) => Promise<MemoryEntry[]>;

  saveAgentPreset: (
    agentId: string,
    presetName: string,
    hubId: string,
  ) => Promise<string>;
  storeAgentMemory: (
    agentId: string,
    memoryEntry: MemoryEntry,
    signer: JWKInterface,
    hubId: string,
  ) => Promise<string>;
  updateAgentContext: (
    agentId: string,
    context: Partial<AgentContext>,
    hubId: string,
  ) => Promise<boolean>;
  updateAgentState: (
    agentId: string,
    state: Partial<AgentState>,
    hubId: string,
  ) => Promise<boolean>;
}

// Agent templates for different roles
const AGENT_TEMPLATES: Record<AgentRole, AgentTemplate> = {
  analyst: {
    behaviors: [],
    defaultCapabilities: [
      "requirements_analysis",
      "process_modeling",
      "stakeholder_analysis",
      "gap_analysis",
      "solution_design",
    ],
    defaultPreferences: {
      communicationStyle: "formal",
      notifications: { enabled: true, frequency: "daily" },
      workingHours: { end: "18:00", start: "08:00", timezone: "UTC" },
    },
    description: "Requirements analysis and business process optimization",
    name: "Business Analyst",
    optionalContext: ["currentProcesses", "stakeholderMap"],
    requiredContext: ["projectId", "businessRequirements"],
    role: "analyst",
  },
  architect: {
    behaviors: [],
    defaultCapabilities: [
      "architecture_design",
      "technical_guidance",
      "system_analysis",
      "technology_selection",
      "design_review",
    ],
    defaultPreferences: {
      communicationStyle: "technical",
      notifications: { enabled: true, frequency: "hourly" },
      workingHours: { end: "18:00", start: "08:00", timezone: "UTC" },
    },
    description: "Technical architecture design and guidance",
    name: "Solution Architect",
    optionalContext: ["constraints", "existingArchitecture"],
    requiredContext: ["projectId", "technicalRequirements"],
    role: "architect",
  },
  "bmad-master": {
    behaviors: [
      {
        action: "initialize_coordination",
        condition: "all_agents_ready",
        priority: 1,
        trigger: "workflow_start",
      },
    ],
    defaultCapabilities: [
      "methodology_guidance",
      "workflow_orchestration",
      "quality_assurance",
      "team_coordination",
      "progress_tracking",
    ],
    defaultPreferences: {
      communicationStyle: "formal",
      notifications: { enabled: true, frequency: "immediate" },
      workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
    },
    description: "Master coordinator for BMAD methodology implementation",
    name: "BMAD Master",
    optionalContext: ["teamMembers", "timeline"],
    requiredContext: ["projectId", "methodology"],
    role: "bmad-master",
  },
  developer: {
    behaviors: [],
    defaultCapabilities: [
      "code_implementation",
      "testing",
      "debugging",
      "code_review",
      "documentation",
    ],
    defaultPreferences: {
      communicationStyle: "casual",
      notifications: { enabled: true, frequency: "immediate" },
      workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
    },
    description: "Code implementation and development tasks",
    name: "Full Stack Developer",
    optionalContext: ["testingStrategy", "deploymentInfo"],
    requiredContext: ["projectId", "codebase"],
    role: "developer",
  },
  pm: {
    behaviors: [],
    defaultCapabilities: [
      "project_planning",
      "resource_management",
      "risk_management",
      "stakeholder_communication",
      "progress_tracking",
    ],
    defaultPreferences: {
      communicationStyle: "collaborative",
      notifications: { enabled: true, frequency: "daily" },
      workingHours: { end: "18:00", start: "08:00", timezone: "UTC" },
    },
    description: "Project coordination and management",
    name: "Project Manager",
    optionalContext: ["budget", "timeline"],
    requiredContext: ["projectId", "stakeholders"],
    role: "pm",
  },
  qa: {
    behaviors: [],
    defaultCapabilities: [
      "test_planning",
      "quality_review",
      "defect_tracking",
      "compliance_verification",
      "process_improvement",
    ],
    defaultPreferences: {
      communicationStyle: "formal",
      notifications: { enabled: true, frequency: "immediate" },
      workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
    },
    description: "Quality assurance and testing coordination",
    name: "Quality Assurance",
    optionalContext: ["testingTools", "complianceFramework"],
    requiredContext: ["projectId", "qualityStandards"],
    role: "qa",
  },
  sm: {
    behaviors: [],
    defaultCapabilities: [
      "agile_facilitation",
      "impediment_removal",
      "team_coaching",
      "ceremony_facilitation",
      "continuous_improvement",
    ],
    defaultPreferences: {
      communicationStyle: "collaborative",
      notifications: { enabled: true, frequency: "immediate" },
      workingHours: { end: "18:00", start: "08:00", timezone: "UTC" },
    },
    description: "Agile facilitation and process coaching",
    name: "Scrum Master",
    optionalContext: ["sprintGoals", "retrospectiveInsights"],
    requiredContext: ["projectId", "teamDynamics"],
    role: "sm",
  },
  "ux-expert": {
    behaviors: [],
    defaultCapabilities: [
      "user_research",
      "design_thinking",
      "prototyping",
      "usability_testing",
      "interaction_design",
    ],
    defaultPreferences: {
      communicationStyle: "collaborative",
      notifications: { enabled: true, frequency: "daily" },
      workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
    },
    description: "User experience design and research",
    name: "UX Expert",
    optionalContext: ["designSystem", "accessibilityRequirements"],
    requiredContext: ["projectId", "userPersonas"],
    role: "ux-expert",
  },
};

export class TeamAgentServiceImpl implements TeamAgentService {
  constructor(
    private memoryService: typeof aiMemoryService,
    private processService: ProcessCommunicationService,
  ) {}

  async addConversationEntry(
    agentId: string,
    entry: ConversationEntry,
    hubId: string,
  ): Promise<boolean> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        return false;
      }

      const updatedHistory = [...agent.state.conversationHistory, entry];
      return await this.updateAgentState(
        agentId,
        { conversationHistory: updatedHistory },
        hubId,
      );
    } catch (error) {
      return false;
    }
  }

  async broadcastToAgents(
    senderAgentId: string,
    targetAgentIds: string[],
    message: string,
    messageType: string,
    hubId: string,
  ): Promise<BroadcastResult> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const delivered: string[] = [];
    const failed: BroadcastFailure[] = [];

    try {
      const broadcastEntry: ConversationEntry = {
        context: { broadcast: true, recipients: targetAgentIds },
        id: messageId,
        message,
        messageType: messageType as ConversationEntry["messageType"],
        speaker: senderAgentId,
        timestamp: new Date().toISOString(),
      };

      for (const agentId of targetAgentIds) {
        try {
          const success = await this.addConversationEntry(
            agentId,
            broadcastEntry,
            hubId,
          );
          if (success) {
            delivered.push(agentId);
          } else {
            failed.push({
              agentId,
              reason: "Failed to add conversation entry",
              retryable: true,
            });
          }
        } catch (error) {
          failed.push({
            agentId,
            reason: error instanceof Error ? error.message : "Unknown error",
            retryable: true,
          });
        }
      }

      return {
        delivered,
        failed,
        messageId,
        success: failed.length === 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to broadcast message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async coordinateAgentTasks(
    coordinatorId: string,
    taskAssignments: TaskAssignment[],
    hubId: string,
  ): Promise<TaskCoordinationResult> {
    const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const assignments: TaskAssignmentResult[] = [];
    const errors: CoordinationError[] = [];

    try {
      for (const assignment of taskAssignments) {
        try {
          const agent = await this.getAgent(assignment.assignedAgentId, hubId);
          if (!agent) {
            errors.push({
              affectedAgentId: assignment.assignedAgentId,
              affectedTaskId: assignment.taskId,
              message: `Agent ${assignment.assignedAgentId} not found`,
              type: "agent_unavailable",
            });
            assignments.push({
              agentId: assignment.assignedAgentId,
              assigned: false,
              error: "Agent not found",
              taskId: assignment.taskId,
            });
            continue;
          }

          // Add task to agent's queue
          const taskItem = {
            assignedAt: new Date().toISOString(),
            dependencies: assignment.dependencies,
            description: `Assigned task from coordination ${coordinationId}`,
            dueDate: assignment.deadline,
            id: assignment.taskId,
            priority: assignment.priority,
            status: "pending" as const,
            title: `Task ${assignment.taskId}`,
          };

          const updatedQueue = [...agent.context.taskQueue, taskItem];
          await this.updateAgentContext(
            assignment.assignedAgentId,
            { taskQueue: updatedQueue },
            hubId,
          );

          assignments.push({
            agentId: assignment.assignedAgentId,
            assigned: true,
            taskId: assignment.taskId,
          });
        } catch (error) {
          errors.push({
            affectedAgentId: assignment.assignedAgentId,
            affectedTaskId: assignment.taskId,
            message: error instanceof Error ? error.message : "Unknown error",
            type: "invalid_task",
          });
          assignments.push({
            agentId: assignment.assignedAgentId,
            assigned: false,
            error: error instanceof Error ? error.message : "Unknown error",
            taskId: assignment.taskId,
          });
        }
      }

      return {
        assignments,
        coordinationId,
        errors: errors.length > 0 ? errors : undefined,
        success: errors.length === 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to coordinate tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createAgent(
    agentConfig: AgentConfig,
    signer: JWKInterface,
    hubId: string,
  ): Promise<TeamAgent> {
    // Validate agent configuration
    if (!agentConfig.name || !agentConfig.role) {
      throw new Error("Agent name and role are required");
    }

    // Generate unique agent ID
    const agentId = `agent_${agentConfig.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create initial agent state
    const initialState: AgentState = {
      conversationHistory: [],
      lastActivity: new Date().toISOString(),
      projectContext: {
        constraints: [],
        objectives: [],
        phase: "initialization",
        projectId: agentConfig.initialContext?.projectId || "",
        projectName: "",
        resources: [],
        stakeholders: [],
      },
      status: "active",
    };

    // Create initial agent context
    const initialContext: AgentContext = {
      collaborators: [],
      environment: "development",
      projectId: agentConfig.initialContext?.projectId || "",
      sessionId: `session_${Date.now()}`,
      taskQueue: [],
      workflowState: {
        blockers: [],
        dependencies: [],
        nextActions: [],
        progress: 0,
      },
      ...agentConfig.initialContext,
    };

    // Create initial agent memory
    const initialMemory: AgentMemory = {
      longTerm: [],
      preferences: {
        collaboration: {
          feedbackStyle: "constructive",
          meetingPreference: "hybrid",
          preferredTools: [],
        },
        communicationStyle: "formal",
        notifications: { enabled: true, frequency: "immediate", types: [] },
        workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
        ...agentConfig.preferences,
      },
      shortTerm: [],
      working: [],
    };

    // Create the team agent
    const teamAgent: TeamAgent = {
      capabilities: agentConfig.capabilities,
      context: initialContext,
      description: agentConfig.description,
      id: agentId,
      memory: initialMemory,
      name: agentConfig.name,
      role: agentConfig.role,
      state: initialState,
    };

    // Store agent in memory service
    const agentMemory: Partial<AIMemory> = {
      content: JSON.stringify(teamAgent),
      context: {
        domain: "team_agent",
        sessionId: initialContext.sessionId,
        topic: `agent_${agentConfig.role}`,
      },
      importance: 0.9,
      memoryType: "workflow" as MemoryType,
    };

    try {
      await this.memoryService.addEnhanced(signer, hubId, agentMemory);
      return teamAgent;
    } catch (error) {
      throw new Error(
        `Failed to create agent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  customizeAgentFromTemplate(
    template: AgentTemplate,
    customizations: AgentCustomization,
  ): AgentConfig {
    return {
      capabilities: [
        ...template.defaultCapabilities,
        ...(customizations.additionalCapabilities || []),
      ],
      description: customizations.description || template.description,
      initialContext: {
        ...customizations.contextOverrides,
      },
      name: customizations.name || template.name,
      preferences: {
        ...template.defaultPreferences,
        ...customizations.preferenceOverrides,
      },
      role: template.role,
    };
  }

  async deleteAgent(agentId: string, hubId: string): Promise<boolean> {
    // Note: This would require memory deletion capability
    // For now, we'll mark the agent as deleted in its state
    try {
      return await this.updateAgentState(agentId, { status: "offline" }, hubId);
    } catch (error) {
      return false;
    }
  }

  async executeAgentAction(
    agentId: string,
    action: AgentAction,
    signer: JWKInterface,
    hubId: string,
  ): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        const endTime = Date.now();
        return {
          duration: Math.max(1, endTime - startTime), // Ensure minimum 1ms duration
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent ${agentId} not found`,
          },
          success: false,
          timestamp: new Date().toISOString(),
        };
      }

      // Execute action based on type
      let result: unknown;
      switch (action.type) {
        case "analyze":
          result = await this.analyze(agent, action.parameters);
          break;
        case "collaborate":
          result = await this.collaborate(agent, action.parameters, hubId);
          break;
        case "create_workflow":
          result = await this.createWorkflow(agent, action.parameters);
          break;
        case "execute_task":
          result = await this.executeTask(agent, action.parameters);
          break;
        case "report":
          result = await this.generateReport(agent, action.parameters);
          break;
        case "send_message":
          result = await this.sendMessage(agent, action.parameters, hubId);
          break;
        case "update_status":
          result = await this.updateStatus(agent, action.parameters, hubId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Update agent's last activity
      await this.updateAgentState(
        agentId,
        {
          conversationHistory: [
            ...agent.state.conversationHistory,
            {
              id: `action_${action.id}`,
              message: `Executed action: ${action.type}`,
              messageType: "command",
              speaker: agentId,
              timestamp: new Date().toISOString(),
            },
          ],
          lastActivity: new Date().toISOString(),
        },
        hubId,
      );

      const endTime = Date.now();
      return {
        duration: Math.max(1, endTime - startTime), // Ensure minimum 1ms duration
        result,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        duration: Math.max(1, endTime - startTime), // Ensure minimum 1ms duration
        error: {
          code: "ACTION_EXECUTION_FAILED",
          details: error,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        success: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAgent(agentId: string, hubId: string): Promise<null | TeamAgent> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `agent_id:${agentId}`,
        { memoryType: "workflow" },
      );

      if (memories.length === 0) {
        return null;
      }

      try {
        const agentData = JSON.parse(memories[0].content);
        return agentData as TeamAgent;
      } catch (parseError) {
        // Return null for invalid JSON instead of throwing
        return null;
      }
    } catch (error) {
      throw new Error(
        `Failed to get agent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  getAgentTemplate(role: AgentRole): AgentTemplate {
    return AGENT_TEMPLATES[role];
  }

  async initiateAgentConversation(
    agentIds: string[],
    topic: string,
    initiatorId: string,
    hubId: string,
  ): Promise<string> {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create conversation entry for each agent
      const conversationEntry: ConversationEntry = {
        context: { participants: agentIds, topic },
        id: conversationId,
        message: `Initiated conversation about: ${topic}`,
        messageType: "command",
        speaker: initiatorId,
        timestamp: new Date().toISOString(),
      };

      // Add conversation entry to all participating agents
      const promises = agentIds.map((agentId) =>
        this.addConversationEntry(agentId, conversationEntry, hubId),
      );

      await Promise.all(promises);
      return conversationId;
    } catch (error) {
      throw new Error(
        `Failed to initiate conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async integrateWithMemoryService(
    agentId: string,
    memoryContext: MemoryContext,
    hubId: string,
  ): Promise<boolean> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        return false;
      }

      // Update agent context with memory integration
      const updatedContext = {
        ...agent.context,
        ...memoryContext,
      };

      return await this.updateAgentContext(agentId, updatedContext, hubId);
    } catch (error) {
      return false;
    }
  }

  async listAgents(hubId: string, role?: AgentRole): Promise<TeamAgent[]> {
    try {
      const searchQuery = role ? `agent_${role}` : "team_agent";
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        searchQuery,
        { memoryType: "workflow" },
      );

      const agents: TeamAgent[] = [];
      for (const memory of memories) {
        try {
          const agentData = JSON.parse(memory.content);
          if (agentData.id && (!role || agentData.role === role)) {
            agents.push(agentData as TeamAgent);
          }
        } catch (parseError) {
          // Skip invalid agent data
          continue;
        }
      }

      return agents;
    } catch (error) {
      throw new Error(
        `Failed to list agents: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadAgentPreset(
    presetId: string,
    hubId: string,
  ): Promise<AgentConfig | null> {
    try {
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `preset_${presetId}`,
        { memoryType: "workflow" },
      );

      if (memories.length === 0) {
        return null;
      }

      return JSON.parse(memories[0].content) as AgentConfig;
    } catch (error) {
      return null;
    }
  }

  async retrieveAgentMemories(
    agentId: string,
    filters: MemoryFilters,
    hubId: string,
  ): Promise<MemoryEntry[]> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        return [];
      }

      // Filter agent's memories based on criteria
      let memories = [
        ...agent.memory.longTerm,
        ...agent.memory.shortTerm,
        ...agent.memory.working,
      ];

      if (filters.memoryType) {
        memories = memories.filter(
          (memory) => memory.memoryType === filters.memoryType,
        );
      }

      if (filters.importance) {
        memories = memories.filter(
          (memory) =>
            memory.importance >= filters.importance!.min &&
            memory.importance <= filters.importance!.max,
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        memories = memories.filter((memory) =>
          filters.tags!.some((tag) => memory.tags.includes(tag)),
        );
      }

      if (filters.timeRange) {
        const start = new Date(filters.timeRange.start);
        const end = new Date(filters.timeRange.end);
        memories = memories.filter((memory) => {
          const memoryTime = new Date(memory.timestamp);
          return memoryTime >= start && memoryTime <= end;
        });
      }

      if (filters.limit) {
        memories = memories.slice(0, filters.limit);
      }

      return memories;
    } catch (error) {
      throw new Error(
        `Failed to retrieve agent memories: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async saveAgentPreset(
    agentId: string,
    presetName: string,
    hubId: string,
  ): Promise<string> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Create preset from current agent configuration
      const preset: AgentConfig = {
        capabilities: agent.capabilities,
        description: agent.description,
        initialContext: {},
        name: agent.name,
        preferences: agent.memory.preferences,
        role: agent.role,
      };

      const presetId = `preset_${presetName}_${Date.now()}`;
      const presetMemory: Partial<AIMemory> = {
        content: JSON.stringify(preset),
        context: {
          domain: "agent_preset",
          topic: presetName,
        },
        importance: 0.8,
        memoryType: "workflow" as MemoryType,
      };

      await this.memoryService.addEnhanced(
        {} as JWKInterface,
        hubId,
        presetMemory,
      );
      return presetId;
    } catch (error) {
      throw new Error(
        `Failed to save agent preset: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async storeAgentMemory(
    agentId: string,
    memoryEntry: MemoryEntry,
    signer: JWKInterface,
    hubId: string,
  ): Promise<string> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Store in AI memory service
      const aiMemory: Partial<AIMemory> = {
        content: memoryEntry.content,
        context: {
          domain: "agent_memory",
          sessionId: agent.context.sessionId,
          topic: `agent_${agentId}_${memoryEntry.memoryType}`,
          ...memoryEntry.context,
        },
        importance: memoryEntry.importance,
        memoryType: "knowledge" as MemoryType,
      };

      const memoryId = await this.memoryService.addEnhanced(
        signer,
        hubId,
        aiMemory,
      );

      // Add to agent's memory
      const updatedMemory = { ...agent.memory };
      updatedMemory.longTerm.push({ ...memoryEntry, id: memoryId });

      await this.updateAgentState(agentId, { ...agent.state }, hubId);

      return memoryId;
    } catch (error) {
      throw new Error(
        `Failed to store agent memory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateAgentContext(
    agentId: string,
    context: Partial<AgentContext>,
    hubId: string,
  ): Promise<boolean> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        return false;
      }

      agent.context = { ...agent.context, ...context };
      return await this.updateAgentState(agentId, agent.state, hubId);
    } catch (error) {
      return false;
    }
  }

  async updateAgentState(
    agentId: string,
    state: Partial<AgentState>,
    hubId: string,
  ): Promise<boolean> {
    try {
      const agent = await this.getAgent(agentId, hubId);
      if (!agent) {
        return false;
      }

      // Update the agent state
      agent.state = { ...agent.state, ...state };
      agent.state.lastActivity = new Date().toISOString();

      // Store updated agent
      const agentMemory: Partial<AIMemory> = {
        content: JSON.stringify(agent),
        context: {
          domain: "team_agent",
          sessionId: agent.context.sessionId,
          topic: `agent_${agent.role}`,
        },
        importance: 0.9,
        memoryType: "workflow" as MemoryType,
      };

      // Note: In a real implementation, we would update the existing memory
      // For now, we create a new memory entry
      await this.memoryService.addEnhanced(
        {} as JWKInterface, // This would need proper signer
        hubId,
        agentMemory,
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  private async analyze(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    // Implementation would perform analysis based on agent capabilities
    return { analysisCompleted: true, insights: [] };
  }

  private async collaborate(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
    hubId: string,
  ): Promise<unknown> {
    // Implementation would facilitate collaboration between agents
    return { collaborationInitiated: true };
  }

  private async createWorkflow(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    // Implementation would create a new workflow
    return { workflowCreated: true, workflowId: `workflow_${Date.now()}` };
  }

  // Private helper methods for action execution
  private async executeTask(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    // Implementation would depend on task type and parameters
    return { result: "Task completed successfully", taskExecuted: true };
  }

  private async generateReport(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    // Implementation would generate reports based on agent data
    return { reportGenerated: true, reportId: `report_${Date.now()}` };
  }

  private async sendMessage(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
    hubId: string,
  ): Promise<unknown> {
    const { message, messageType, targetAgentId } = parameters;
    if (typeof targetAgentId !== "string" || typeof message !== "string") {
      throw new Error("Invalid message parameters");
    }

    const conversationEntry: ConversationEntry = {
      id: `msg_${Date.now()}`,
      message: message as string,
      messageType:
        (messageType as ConversationEntry["messageType"]) || "response",
      speaker: agent.id,
      timestamp: new Date().toISOString(),
    };

    await this.addConversationEntry(
      targetAgentId as string,
      conversationEntry,
      hubId,
    );
    return { messageId: conversationEntry.id, messageSent: true };
  }

  private async updateStatus(
    agent: TeamAgent,
    parameters: Record<string, unknown>,
    hubId: string,
  ): Promise<unknown> {
    const { status } = parameters;
    if (typeof status !== "string") {
      throw new Error("Invalid status parameter");
    }

    await this.updateAgentState(agent.id, { status: status as any }, hubId);
    return { newStatus: status, statusUpdated: true };
  }
}

// Export singleton service factory
export const createTeamAgentService = (
  memoryService: typeof aiMemoryService,
  processService: ProcessCommunicationService,
): TeamAgentService => {
  return new TeamAgentServiceImpl(memoryService, processService);
};
