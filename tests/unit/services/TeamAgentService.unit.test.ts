import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AgentAction,
  type AgentConfig,
  type TeamAgent,
} from "../../../src/models/TeamAgent.js";
import {
  createTeamAgentService,
  type TeamAgentService,
} from "../../../src/services/TeamAgentService.js";

// Mock dependencies
const mockMemoryService = {
  addEnhanced: vi.fn(),
  addMemoriesBatch: vi.fn(),
  addReasoningChain: vi.fn(),
  createAIMemoryTags: vi.fn(),
  createMemoryContext: vi.fn(),
  detectCircularReferences: vi.fn(),
  eventToAIMemory: vi.fn(),
  findShortestPath: vi.fn(),
  getContextMemories: vi.fn(),
  getMemoryAnalytics: vi.fn(),
  getMemoryRelationships: vi.fn(),
  getReasoningChain: vi.fn(),
  getRelationshipAnalytics: vi.fn(),
  linkMemories: vi.fn(),
  searchAdvanced: vi.fn(),
};

const mockProcessService = {
  buildAOMessage: vi.fn(),
  detectProcessType: vi.fn(),
  executeProcessRequest: vi.fn(),
  executeSmartRequest: vi.fn(),
  interpretResponse: vi.fn(),
  matchRequestToHandler: vi.fn(),
  parseMarkdown: vi.fn(),
};

const mockBMADResourceService = {
  cacheResource: vi.fn(),
  clearCache: vi.fn(),
  getConfig: vi.fn(),
  initialize: vi.fn(),
  listResources: vi.fn(),
  loadResource: vi.fn(),
  validateResource: vi.fn(),
};

describe("TeamAgentService", () => {
  let teamAgentService: TeamAgentService;
  let mockSigner: JWKInterface;
  const hubId = "test-hub-id";

  beforeEach(() => {
    vi.clearAllMocks();

    teamAgentService = createTeamAgentService(
      mockMemoryService as any,
      mockProcessService as any,
      mockBMADResourceService as any,
    );

    mockSigner = {
      d: "test",
      dp: "test",
      dq: "test",
      e: "AQAB",
      kty: "RSA",
      n: "test",
      p: "test",
      q: "test",
      qi: "test",
    };

    // Setup default mock responses
    mockMemoryService.addEnhanced.mockResolvedValue("memory-id-123");
    mockMemoryService.searchAdvanced.mockResolvedValue([]);
  });

  describe("createAgent", () => {
    it("should create a new team agent successfully", async () => {
      const agentConfig: AgentConfig = {
        capabilities: ["code_implementation", "testing", "debugging"],
        description: "A test developer agent",
        initialContext: {
          projectId: "test-project",
        },
        name: "Test Developer",
        preferences: {
          communicationStyle: "casual",
        },
        role: "developer",
      };

      const result = await teamAgentService.createAgent(
        agentConfig,
        mockSigner,
        hubId,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Test Developer");
      expect(result.role).toBe("developer");
      expect(result.capabilities).toEqual([
        "code_implementation",
        "testing",
        "debugging",
      ]);
      expect(mockMemoryService.addEnhanced).toHaveBeenCalledOnce();
    });

    it("should throw error for invalid agent configuration", async () => {
      const invalidConfig = {
        name: "",
        role: "developer",
      } as AgentConfig;

      await expect(
        teamAgentService.createAgent(invalidConfig, mockSigner, hubId),
      ).rejects.toThrow("Agent name and role are required");
    });

    it("should apply default preferences when none provided", async () => {
      const agentConfig: AgentConfig = {
        capabilities: ["architecture_design"],
        description: "An agent with default preferences",
        initialContext: {},
        name: "Default Agent",
        preferences: {},
        role: "architect",
      };

      const result = await teamAgentService.createAgent(
        agentConfig,
        mockSigner,
        hubId,
      );

      expect(result.memory.preferences.communicationStyle).toBe("formal");
      expect(result.memory.preferences.workingHours.start).toBe("09:00");
      expect(result.memory.preferences.notifications.enabled).toBe(true);
    });
  });

  describe("getAgent", () => {
    it("should retrieve an existing agent", async () => {
      const mockAgent: TeamAgent = {
        capabilities: ["testing"],
        context: {
          collaborators: [],
          environment: "test",
          projectId: "test",
          sessionId: "session-123",
          taskQueue: [],
          workflowState: {
            blockers: [],
            dependencies: [],
            nextActions: [],
            progress: 0,
          },
        },
        description: "A test agent",
        id: "agent-123",
        memory: {
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
          },
          shortTerm: [],
          working: [],
        },
        name: "Test Agent",
        role: "developer",
        state: {
          conversationHistory: [],
          lastActivity: new Date().toISOString(),
          projectContext: {
            constraints: [],
            objectives: [],
            phase: "development",
            projectId: "test",
            projectName: "Test Project",
            resources: [],
            stakeholders: [],
          },
          status: "active",
        },
      };

      mockMemoryService.searchAdvanced.mockResolvedValue([
        { content: JSON.stringify(mockAgent) },
      ]);

      const result = await teamAgentService.getAgent("agent-123", hubId);

      expect(result).toBeDefined();
      expect(result?.id).toBe("agent-123");
      expect(result?.name).toBe("Test Agent");
      expect(mockMemoryService.searchAdvanced).toHaveBeenCalledWith(
        hubId,
        "agent_id:agent-123",
        { memoryType: "workflow" },
      );
    });

    it("should return null for non-existent agent", async () => {
      mockMemoryService.searchAdvanced.mockResolvedValue([]);

      const result = await teamAgentService.getAgent("non-existent", hubId);

      expect(result).toBeNull();
    });
  });

  describe("executeAgentAction", () => {
    it("should execute a send_message action successfully", async () => {
      const mockAgent: TeamAgent = {
        capabilities: ["testing"],
        context: {
          collaborators: [],
          environment: "test",
          projectId: "test",
          sessionId: "session-123",
          taskQueue: [],
          workflowState: {
            blockers: [],
            dependencies: [],
            nextActions: [],
            progress: 0,
          },
        },
        description: "A test agent",
        id: "agent-123",
        memory: {
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
          },
          shortTerm: [],
          working: [],
        },
        name: "Test Agent",
        role: "developer",
        state: {
          conversationHistory: [],
          lastActivity: new Date().toISOString(),
          projectContext: {
            constraints: [],
            objectives: [],
            phase: "development",
            projectId: "test",
            projectName: "Test Project",
            resources: [],
            stakeholders: [],
          },
          status: "active",
        },
      };

      // Mock getAgent to return the test agent
      mockMemoryService.searchAdvanced.mockResolvedValueOnce([
        { content: JSON.stringify(mockAgent) },
      ]);

      const action: AgentAction = {
        context: {
          sessionId: "session-123",
          triggeredBy: "user",
        },
        id: "action-123",
        parameters: {
          message: "Hello, this is a test message",
          messageType: "response",
          targetAgentId: "target-agent",
        },
        priority: "medium",
        timestamp: new Date().toISOString(),
        type: "send_message",
      };

      const result = await teamAgentService.executeAgentAction(
        "agent-123",
        action,
        mockSigner,
        hubId,
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should handle agent not found error", async () => {
      mockMemoryService.searchAdvanced.mockResolvedValue([]);

      const action: AgentAction = {
        context: {
          sessionId: "session-123",
          triggeredBy: "user",
        },
        id: "action-123",
        parameters: {},
        priority: "medium",
        timestamp: new Date().toISOString(),
        type: "send_message",
      };

      const result = await teamAgentService.executeAgentAction(
        "non-existent",
        action,
        mockSigner,
        hubId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("AGENT_NOT_FOUND");
      expect(result.error?.message).toContain("Agent non-existent not found");
    });
  });

  describe("getAgentTemplate", () => {
    it("should return correct template for developer role", () => {
      const template = teamAgentService.getAgentTemplate("developer");

      expect(template.role).toBe("developer");
      expect(template.name).toBe("Full Stack Developer");
      expect(template.defaultCapabilities).toContain("code_implementation");
      expect(template.defaultCapabilities).toContain("testing");
      expect(template.defaultCapabilities).toContain("debugging");
    });

    it("should return correct template for architect role", () => {
      const template = teamAgentService.getAgentTemplate("architect");

      expect(template.role).toBe("architect");
      expect(template.name).toBe("Solution Architect");
      expect(template.defaultCapabilities).toContain("architecture_design");
      expect(template.defaultCapabilities).toContain("technical_guidance");
    });

    it("should return correct template for bmad-master role", () => {
      const template = teamAgentService.getAgentTemplate("bmad-master");

      expect(template.role).toBe("bmad-master");
      expect(template.name).toBe("BMAD Master");
      expect(template.defaultCapabilities).toContain("methodology_guidance");
      expect(template.defaultCapabilities).toContain("workflow_orchestration");
    });
  });

  describe("customizeAgentFromTemplate", () => {
    it("should customize agent template with provided options", () => {
      const template = teamAgentService.getAgentTemplate("developer");
      const customizations = {
        additionalCapabilities: ["team_leadership", "mentoring"],
        description: "An experienced developer with team lead capabilities",
        name: "Senior Full Stack Developer",
        preferenceOverrides: {
          communicationStyle: "technical",
        },
      };

      const customizedConfig = teamAgentService.customizeAgentFromTemplate(
        template,
        customizations,
      );

      expect(customizedConfig.name).toBe("Senior Full Stack Developer");
      expect(customizedConfig.description).toBe(
        "An experienced developer with team lead capabilities",
      );
      expect(customizedConfig.capabilities).toContain("code_implementation");
      expect(customizedConfig.capabilities).toContain("team_leadership");
      expect(customizedConfig.capabilities).toContain("mentoring");
      expect(customizedConfig.preferences.communicationStyle).toBe("technical");
    });
  });

  describe("coordinateAgentTasks", () => {
    it("should coordinate task assignments successfully", async () => {
      const taskAssignments = [
        {
          assignedAgentId: "agent-1",
          context: {},
          dependencies: [],
          priority: "high" as const,
          taskId: "task-1",
        },
        {
          assignedAgentId: "agent-2",
          context: {},
          dependencies: ["task-1"],
          priority: "medium" as const,
          taskId: "task-2",
        },
      ];

      // Mock agents exist
      mockMemoryService.searchAdvanced.mockImplementation((hubId, query) => {
        if (query.includes("agent-1") || query.includes("agent-2")) {
          return Promise.resolve([
            {
              content: JSON.stringify({
                context: { taskQueue: [] },
                id: query.includes("agent-1") ? "agent-1" : "agent-2",
              }),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await teamAgentService.coordinateAgentTasks(
        "coordinator-agent",
        taskAssignments,
        hubId,
      );

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments[0].assigned).toBe(true);
      expect(result.assignments[1].assigned).toBe(true);
      expect(result.coordinationId).toBeDefined();
    });
  });

  describe("broadcastToAgents", () => {
    it("should broadcast message to multiple agents", async () => {
      const targetAgentIds = ["agent-1", "agent-2", "agent-3"];

      // Mock successful message delivery
      const mockAgent = {
        capabilities: ["testing"],
        context: {
          collaborators: [],
          environment: "test",
          projectId: "test-project",
          sessionId: "test-session",
          taskQueue: [],
          workflowState: {
            blockers: [],
            dependencies: [],
            nextActions: [],
            progress: 0,
          },
        },
        description: "Mock agent for testing",
        id: "mock-agent",
        memory: {
          longTerm: [],
          preferences: {
            collaboration: {
              feedbackStyle: "constructive" as const,
              meetingPreference: "hybrid" as const,
              preferredTools: [],
            },
            communicationStyle: "formal" as const,
            notifications: {
              enabled: true,
              frequency: "immediate" as const,
              types: [],
            },
            workingHours: { end: "17:00", start: "09:00", timezone: "UTC" },
          },
          shortTerm: [],
          working: [],
        },
        name: "Mock Agent",
        role: "developer",
        state: {
          conversationHistory: [],
          lastActivity: new Date().toISOString(),
          projectContext: {
            constraints: [],
            objectives: [],
            phase: "testing",
            projectId: "test-project",
            projectName: "Test Project",
            resources: [],
            stakeholders: [],
          },
          status: "active" as const,
        },
      };

      mockMemoryService.searchAdvanced.mockResolvedValue([
        { content: JSON.stringify(mockAgent) },
      ]);

      const result = await teamAgentService.broadcastToAgents(
        "sender-agent",
        targetAgentIds,
        "This is a broadcast message",
        "notification",
        hubId,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.delivered).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe("storeAgentMemory", () => {
    it("should store agent memory successfully", async () => {
      const mockAgent = {
        context: { sessionId: "session-123" },
        id: "agent-123",
        memory: { longTerm: [] },
      };

      mockMemoryService.searchAdvanced.mockResolvedValue([
        { content: JSON.stringify(mockAgent) },
      ]);

      const memoryEntry = {
        content: "Important information to remember",
        id: "memory-123",
        importance: 0.8,
        memoryType: "knowledge" as const,
        tags: ["important", "project"],
        timestamp: new Date().toISOString(),
      };

      const result = await teamAgentService.storeAgentMemory(
        "agent-123",
        memoryEntry,
        mockSigner,
        hubId,
      );

      expect(result).toBeDefined();
      expect(mockMemoryService.addEnhanced).toHaveBeenCalled();
    });

    it("should throw error for non-existent agent", async () => {
      mockMemoryService.searchAdvanced.mockResolvedValue([]);

      const memoryEntry = {
        content: "Test memory",
        id: "memory-123",
        importance: 0.5,
        memoryType: "knowledge" as const,
        tags: [],
        timestamp: new Date().toISOString(),
      };

      await expect(
        teamAgentService.storeAgentMemory(
          "non-existent",
          memoryEntry,
          mockSigner,
          hubId,
        ),
      ).rejects.toThrow("Agent non-existent not found");
    });
  });

  describe("listAgents", () => {
    it("should list all agents", async () => {
      const mockAgents = [
        { id: "agent-1", name: "Dev Agent 1", role: "developer" },
        { id: "agent-2", name: "Architect Agent", role: "architect" },
        { id: "agent-3", name: "Dev Agent 2", role: "developer" },
      ];

      mockMemoryService.searchAdvanced.mockResolvedValue(
        mockAgents.map((agent) => ({ content: JSON.stringify(agent) })),
      );

      const result = await teamAgentService.listAgents(hubId);

      expect(result).toHaveLength(3);
      expect(result.map((a) => a.id)).toEqual([
        "agent-1",
        "agent-2",
        "agent-3",
      ]);
    });

    it("should filter agents by role", async () => {
      const mockAgents = [
        { id: "agent-1", name: "Dev Agent 1", role: "developer" },
        { id: "agent-2", name: "Architect Agent", role: "architect" },
        { id: "agent-3", name: "Dev Agent 2", role: "developer" },
      ];

      mockMemoryService.searchAdvanced.mockResolvedValue(
        mockAgents
          .filter((agent) => agent.role === "developer")
          .map((agent) => ({ content: JSON.stringify(agent) })),
      );

      const result = await teamAgentService.listAgents(hubId, "developer");

      expect(result).toHaveLength(2);
      expect(result.every((agent) => agent.role === "developer")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle memory service errors gracefully", async () => {
      mockMemoryService.addEnhanced.mockRejectedValue(
        new Error("Memory service unavailable"),
      );

      const agentConfig: AgentConfig = {
        capabilities: [],
        description: "Test",
        initialContext: {},
        name: "Test Agent",
        preferences: {},
        role: "developer",
      };

      await expect(
        teamAgentService.createAgent(agentConfig, mockSigner, hubId),
      ).rejects.toThrow("Failed to create agent");
    });

    it("should handle invalid JSON in memory service responses", async () => {
      mockMemoryService.searchAdvanced.mockResolvedValue([
        { content: "invalid json content" },
      ]);

      const result = await teamAgentService.getAgent("agent-123", hubId);

      expect(result).toBeNull();
    });
  });
});
