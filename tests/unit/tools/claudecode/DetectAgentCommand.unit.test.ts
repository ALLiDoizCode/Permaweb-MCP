import { describe, it, expect, beforeEach, vi } from "vitest";
import { DetectAgentCommand } from "../../../../src/tools/claudecode/commands/DetectAgentCommand.js";
import type { ClaudeCodeHookContext } from "../../../../src/models/TeamAgent.js";

// Mock the services
vi.mock("../../../../src/services/ClaudeCodeAgentService.js", () => ({
  ClaudeCodeAgentService: vi.fn().mockImplementation(() => ({
    handleHookEvent: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/aiMemoryService.js", () => ({
  AIMemoryService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../../src/services/TeamAgentService.js", () => ({
  TeamAgentService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../../src/services/FileSystemAgentService.js", () => ({
  FileSystemAgentService: vi.fn().mockImplementation(() => ({})),
}));

describe("DetectAgentCommand", () => {
  let command: DetectAgentCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new DetectAgentCommand();
  });

  describe("execute", () => {
    it("should detect agent successfully", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        toolName: "implement feature",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const input = {
        hookContext,
        userInput: "implement new feature",
      };

      // Mock successful detection
      const mockDetectionResult = {
        success: true,
        detectedAgent: "developer",
        confidence: 0.8,
        context: { pattern: "implement", hookType: "UserPromptSubmit" },
      };

      // We need to get the mocked service instance
      const { ClaudeCodeAgentService } = await import(
        "../../../../src/services/ClaudeCodeAgentService.js"
      );
      const mockService = new ClaudeCodeAgentService({} as any, {} as any, {} as any);
      vi.mocked(mockService.handleHookEvent).mockResolvedValue(mockDetectionResult);

      const result = await command.execute(input);

      expect(result.success).toBe(true);
      expect(result.data?.detectedAgent).toBe("developer");
      expect(result.data?.confidence).toBe(0.8);
      expect(result.data?.message).toContain("Agent detected: developer");
    });

    it("should handle detection failure", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const input = { hookContext };

      // Mock failed detection
      const mockDetectionResult = {
        success: false,
        confidence: 0,
        context: {},
        error: {
          code: "NO_AGENT_DETECTED",
          message: "No suitable agent pattern matched",
        },
      };

      const { ClaudeCodeAgentService } = await import(
        "../../../../src/services/ClaudeCodeAgentService.js"
      );
      const mockService = new ClaudeCodeAgentService({} as any, {} as any, {} as any);
      vi.mocked(mockService.handleHookEvent).mockResolvedValue(mockDetectionResult);

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NO_AGENT_DETECTED");
      expect(result.error?.message).toBe("No suitable agent pattern matched");
    });

    it("should handle service errors", async () => {
      const hookContext: ClaudeCodeHookContext = {
        sessionId: "test-session",
        transcriptPath: "/path/to/transcript",
        workingDirectory: "/path/to/project",
        eventType: "UserPromptSubmit",
        timestamp: "2024-01-01T00:00:00Z",
      };

      const input = { hookContext };

      const { ClaudeCodeAgentService } = await import(
        "../../../../src/services/ClaudeCodeAgentService.js"
      );
      const mockService = new ClaudeCodeAgentService({} as any, {} as any, {} as any);
      vi.mocked(mockService.handleHookEvent).mockRejectedValue(new Error("Service error"));

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("DETECT_AGENT_ERROR");
      expect(result.error?.message).toBe("Service error");
    });
  });
});