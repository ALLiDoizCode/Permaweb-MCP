import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClaudeCodeAgentService } from "../../../src/services/ClaudeCodeAgentService.js";
import { AIMemoryService } from "../../../src/services/aiMemoryService.js";
import { TeamAgentService } from "../../../src/services/TeamAgentService.js";
import { FileSystemAgentService } from "../../../src/services/FileSystemAgentService.js";
import type {
  ClaudeCodeHookContext,
  BMadProjectConfig,
} from "../../../src/models/TeamAgent.js";

// Mock the services
vi.mock("../../../src/services/aiMemoryService.js", () => ({
  AIMemoryService: vi.fn().mockImplementation(() => ({
    addEnhanced: vi.fn().mockResolvedValue({ success: true }),
    searchAdvanced: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../../src/services/TeamAgentService.js", () => ({
  TeamAgentService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/services/FileSystemAgentService.js", () => ({
  FileSystemAgentService: vi.fn().mockImplementation(() => ({
    initializeBMadStructure: vi.fn().mockResolvedValue(undefined),
    persistAgentConfig: vi.fn().mockResolvedValue(undefined),
    loadAgentConfig: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../src/server.js", () => ({
  getCurrentUserState: vi.fn().mockReturnValue({
    keyPair: {},
    hubId: "default",
  }),
}));

describe("ClaudeCodeAgentService", () => {
  let service: ClaudeCodeAgentService;
  let mockMemoryService: AIMemoryService;
  let mockTeamAgentService: TeamAgentService;
  let mockFileSystemService: FileSystemAgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoryService = new AIMemoryService();
    mockTeamAgentService = new TeamAgentService(mockMemoryService);
    mockFileSystemService = new FileSystemAgentService();
    service = new ClaudeCodeAgentService(
      mockMemoryService,
      mockTeamAgentService,
      mockFileSystemService,
    );
  });

  describe("handleHookEvent", () => {
    it("should detect developer agent from development keywords", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        toolName: "implement new feature",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const result = await service.handleHookEvent(hookContext);

      expect(result.success).toBe(true);
      expect(result.detectedAgent).toBe("developer");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should detect PM agent from planning keywords", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        toolName: "create project roadmap",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const result = await service.handleHookEvent(hookContext);

      expect(result.success).toBe(true);
      expect(result.detectedAgent).toBe("pm");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should detect BMAD agent from methodology keywords", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        toolName: "bmad workflow checklist",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const result = await service.handleHookEvent(hookContext);

      expect(result.success).toBe(true);
      expect(result.detectedAgent).toBe("bmad-master");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should handle hook event errors gracefully", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        toolName: "implement feature", // This will trigger agent detection
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      // Mock an error in the memory service addEnhanced (called when storing context)
      vi.mocked(mockMemoryService.addEnhanced).mockRejectedValue(
        new Error("Memory error"),
      );

      const result = await service.handleHookEvent(hookContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("AGENT_DETECTION_FAILED");
    });
  });

  describe("configureProjectAgent", () => {
    it("should configure project agent successfully", async () => {
      const projectPath = "/path/to/project";
      const agentRole = "developer";

      await expect(
        service.configureProjectAgent(projectPath, agentRole),
      ).resolves.not.toThrow();

      expect(
        mockFileSystemService.initializeBMadStructure,
      ).toHaveBeenCalledWith(projectPath);
      expect(mockFileSystemService.persistAgentConfig).toHaveBeenCalledWith(
        projectPath,
        expect.objectContaining({
          projectPath,
          defaultAgent: agentRole,
        }),
      );
    });

    it("should handle configuration errors", async () => {
      vi.mocked(
        mockFileSystemService.initializeBMadStructure,
      ).mockRejectedValue(new Error("File system error"));

      await expect(
        service.configureProjectAgent("/path/to/project", "developer"),
      ).rejects.toThrow("Failed to configure project agent");
    });
  });

  describe("getAgentState", () => {
    it("should retrieve agent state from memory", async () => {
      const mockMemory = {
        id: "mem-1",
        content: "Agent activated",
        context: { agentRole: "developer" },
        importance: 0.8,
      };

      vi.mocked(mockMemoryService.searchAdvanced).mockResolvedValue([
        mockMemory,
      ]);

      const result = await service.getAgentState("test-session");

      expect(result.success).toBe(true);
      expect(result.detectedAgent).toBe("developer");
      expect(result.confidence).toBe(0.8);
    });

    it("should handle missing agent state", async () => {
      vi.mocked(mockMemoryService.searchAdvanced).mockResolvedValue([]);

      const result = await service.getAgentState("test-session");

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NO_AGENT_STATE");
    });
  });

  describe("transferAgentContext", () => {
    it("should transfer context between agents", async () => {
      const mockMemories = [
        { id: "mem-1", content: "Context 1" },
        { id: "mem-2", content: "Context 2" },
      ];

      vi.mocked(mockMemoryService.searchAdvanced).mockResolvedValue(
        mockMemories,
      );

      const result = await service.transferAgentContext(
        "developer",
        "pm",
        "test-session",
      );

      expect(result.success).toBe(true);
      expect(result.detectedAgent).toBe("pm");
      expect(result.confidence).toBe(1.0);
      expect(mockMemoryService.addEnhanced).toHaveBeenCalledWith(
        {},
        "default",
        expect.objectContaining({
          content: "Agent handoff: developer → pm",
          memoryType: "context",
        }),
      );
    });

    it("should handle transfer errors", async () => {
      vi.mocked(mockMemoryService.searchAdvanced).mockRejectedValue(
        new Error("Search error"),
      );

      const result = await service.transferAgentContext(
        "developer",
        "pm",
        "test-session",
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CONTEXT_TRANSFER_FAILED");
    });
  });
});
