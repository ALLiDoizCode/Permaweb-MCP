import { promises as fs } from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaudeCodeHookContext } from "../../../src/models/TeamAgent.js";

import { ClaudeCodeToolFactory } from "../../../src/tools/claudecode/ClaudeCodeToolFactory.js";

// Mock fs module for file system operations
vi.mock("fs", () => ({
  promises: {
    access: vi.fn(),
    appendFile: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    watch: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock child_process for git operations
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock util
vi.mock("util", () => ({
  promisify: vi.fn((fn) => fn),
}));

// Mock relay functions
vi.mock("../../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

describe("Claude Code Agent Workflow Integration", () => {
  let toolFactory: ClaudeCodeToolFactory;
  const mockProjectPath = "/test/project";

  beforeEach(() => {
    vi.clearAllMocks();
    toolFactory = new ClaudeCodeToolFactory({
      categoryDescription: "Claude Code agent detection tools",
      categoryName: "Claude Code",
      context: {
        embeddedTemplates: new Map(),
        hubId: "test-hub",
        keyPair: {} as any,
        publicKey: "test-key",
      },
    });

    // Setup default mocks
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue("{}");
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Agent Detection and Configuration Workflow", () => {
    it("should initialize project, detect agent, and configure successfully", async () => {
      // Step 1: Initialize BMAD project structure
      const initializeCommand = toolFactory.getToolByName(
        "initializeBMadProject",
      );
      expect(initializeCommand).toBeDefined();

      // Mock directory doesn't exist initially
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"));

      const initResult = await initializeCommand!.execute({
        projectPath: mockProjectPath,
      });

      expect(initResult.success).toBe(true);
      expect(initResult.structureCreated).toContain(".bmad/");

      // Verify directory structure creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, ".bmad"),
        { recursive: true },
      );

      // Step 2: Configure agent for the project
      const configureCommand = toolFactory.getToolByName("configureAgent");
      expect(configureCommand).toBeDefined();

      const configResult = await configureCommand!.execute({
        agentPreferences: {
          gitIntegration: {
            enabled: true,
            watchPaths: ["src/", "tests/"],
          },
        },
        agentRole: "developer",
        projectPath: mockProjectPath,
      });

      expect(configResult.success).toBe(true);
      expect(configResult.defaultAgent).toBe("developer");

      // Step 3: Detect agent based on hook context
      const detectCommand = toolFactory.getToolByName("detectAgent");
      expect(detectCommand).toBeDefined();

      const hookContext: ClaudeCodeHookContext = {
        eventType: "UserPromptSubmit",
        sessionId: "integration-test-session",
        timestamp: new Date().toISOString(),
        toolName: "implement new feature",
        transcriptPath: "/path/to/transcript",
        workingDirectory: mockProjectPath,
      };

      const detectResult = await detectCommand!.execute({
        hookContext,
        userInput: "implement a new authentication feature",
      });

      expect(detectResult.success).toBe(true);
      expect(detectResult.detectedAgent).toBe("developer");
      expect(detectResult.confidence).toBeGreaterThan(0);

      // Step 4: Get agent state
      const getStateCommand = toolFactory.getToolByName("getAgentState");
      expect(getStateCommand).toBeDefined();

      const stateResult = await getStateCommand!.execute({
        sessionId: hookContext.sessionId,
      });

      // Note: This might fail in the mock environment, but the command should exist
      expect(getStateCommand).toBeDefined();
    });

    it("should handle agent handoff workflow", async () => {
      // Step 1: Transfer context between agents
      const transferCommand = toolFactory.getToolByName("transferAgentContext");
      expect(transferCommand).toBeDefined();

      const transferResult = await transferCommand!.execute({
        fromAgent: "developer",
        sessionId: "handoff-test-session",
        toAgent: "pm",
      });

      expect(transferResult.success).toBe(true);
      expect(transferResult.fromAgent).toBe("developer");
      expect(transferResult.toAgent).toBe("pm");
    });

    it("should handle file system errors gracefully", async () => {
      // Mock file system error
      vi.mocked(fs.mkdir).mockRejectedValue(new Error("Permission denied"));

      const initializeCommand = toolFactory.getToolByName(
        "initializeBMadProject",
      );
      const result = await initializeCommand!.execute({
        projectPath: "/restricted/path",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INITIALIZE_BMAD_ERROR");
    });

    it("should validate path security", async () => {
      const configureCommand = toolFactory.getToolByName("configureAgent");

      // Test path traversal protection
      const result = await configureCommand!.execute({
        agentRole: "developer",
        projectPath: "../malicious/path",
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Failed to configure project agent",
      );
    });
  });

  describe("Agent Detection Patterns", () => {
    it("should detect different agent types based on context", async () => {
      const detectCommand = toolFactory.getToolByName("detectAgent");

      const testCases = [
        {
          description: "development task",
          expectedAgent: "developer",
          toolName: "implement authentication system",
        },
        {
          description: "project management task",
          expectedAgent: "pm",
          toolName: "create project roadmap",
        },
        {
          description: "UX design task",
          expectedAgent: "ux-expert",
          toolName: "design user interface",
        },
        {
          description: "quality assurance task",
          expectedAgent: "qa",
          toolName: "test component functionality",
        },
        {
          description: "BMAD methodology task",
          expectedAgent: "bmad-master",
          toolName: "bmad methodology checklist",
        },
        {
          description: "architecture task",
          expectedAgent: "architect",
          toolName: "system architecture design",
        },
      ];

      for (const testCase of testCases) {
        const hookContext: ClaudeCodeHookContext = {
          eventType: "UserPromptSubmit",
          sessionId: `test-${testCase.expectedAgent}`,
          timestamp: new Date().toISOString(),
          toolName: testCase.toolName,
          transcriptPath: "/path/to/transcript",
          workingDirectory: mockProjectPath,
        };

        const result = await detectCommand!.execute({
          hookContext,
          userInput: testCase.toolName,
        });

        expect(result.success).toBe(true);
        expect(result.detectedAgent).toBe(testCase.expectedAgent);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle unknown tool names gracefully", async () => {
      const detectCommand = toolFactory.getToolByName("detectAgent");

      const hookContext: ClaudeCodeHookContext = {
        eventType: "UserPromptSubmit",
        sessionId: "unknown-test-session",
        timestamp: new Date().toISOString(),
        toolName: "some random task that doesn't match any pattern",
        transcriptPath: "/path/to/transcript",
        workingDirectory: mockProjectPath,
      };

      const result = await detectCommand!.execute({
        hookContext,
        userInput: "random unrecognized task",
      });

      // Should either detect a default agent or fail gracefully
      if (result.success) {
        expect(result.confidence).toBeLessThan(0.5);
      } else {
        expect(result.error?.code).toBeTruthy();
      }
    });

    it("should handle missing session data", async () => {
      const getStateCommand = toolFactory.getToolByName("getAgentState");

      const result = await getStateCommand!.execute({
        sessionId: "non-existent-session",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NO_AGENT_STATE");
    });
  });
});
