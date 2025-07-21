import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DetectedAgent,
  PromptDetectionService,
} from "../../../../src/services/PromptDetectionService.js";
import { ToolContext } from "../../../../src/tools/core/index.js";
import { AnalyzePromptCommand } from "../../../../src/tools/user/commands/AnalyzePromptCommand.js";

describe("AnalyzePromptCommand", () => {
  let command: AnalyzePromptCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {} as ToolContext;
    command = new AnalyzePromptCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(command["metadata"].name).toBe("analyzePrompt");
      expect(command["metadata"].title).toBe(
        "Analyze Prompt for Agent Detection",
      );
      expect(command["metadata"].description).toContain(
        "Analyze prompts to detect agent invocation patterns",
      );
      expect(command["metadata"].readOnlyHint).toBe(true);
      expect(command["metadata"].openWorldHint).toBe(false);
    });
  });

  describe("parameter validation", () => {
    it("should validate required prompt parameter", async () => {
      const result = await command.execute({ prompt: "" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should accept valid parameters", async () => {
      const result = await command.execute({
        projectContext: "TestProject",
        prompt: "@dev implement feature",
        userId: "user123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toBeDefined();
    });

    it("should work with minimal parameters", async () => {
      const result = await command.execute({
        prompt: "@dev implement feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should detect agents from prompt", async () => {
      const result = await command.execute({
        prompt: "@dev implement new feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("dev");
      expect(parsed.data.detectedAgents[0].confidence).toBeGreaterThan(0.9);
    });

    it("should detect multiple agents", async () => {
      const result = await command.execute({
        prompt: "@dev implement this and @qa test it",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(2);
      expect(parsed.data.multipleAgentsDetected).toBe(true);
    });

    it("should extract project context from prompt", async () => {
      const result = await command.execute({
        prompt: "@dev ProjectX implement login feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.projectContext).toBe("ProjectX");
    });

    it("should use provided project context when not detected", async () => {
      const result = await command.execute({
        projectContext: "ExternalProject",
        prompt: "@dev implement feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.projectContext).toBe("ExternalProject");
    });

    it("should prefer detected project context over provided", async () => {
      const result = await command.execute({
        projectContext: "ProvidedProject",
        prompt: "@dev DetectedProject implement feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.projectContext).toBe("DetectedProject");
    });

    it("should provide fallback suggestions for unclear prompts", async () => {
      const result = await command.execute({
        prompt: "just some random text here",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(0);
      expect(parsed.data.confidence).toBe(0);
      expect(parsed.data.fallbackSuggestions).toBeDefined();
      expect(parsed.data.fallbackSuggestions.length).toBeGreaterThan(0);
    });

    it("should handle natural language agent requests", async () => {
      const result = await command.execute({
        prompt: "I need a project manager for the deliverable timeline",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents.length).toBeGreaterThan(0);
      expect(parsed.data.detectedAgents[0].agentType).toBe("pm");
    });

    it("should handle case insensitive prompts", async () => {
      const result = await command.execute({
        prompt: "@PM MANAGE THIS PROJECT",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("pm");
    });

    it("should detect agent aliases", async () => {
      const result = await command.execute({
        prompt: "get me a programmer to help with this code",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("dev");
      expect(parsed.data.detectedAgents[0].matchedPattern).toBe("programmer");
    });

    it("should handle QA agent detection", async () => {
      const result = await command.execute({
        prompt: "@qa validate this application thoroughly",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("qa");
    });

    it("should handle UX agent detection", async () => {
      const result = await command.execute({
        prompt: "@ux create the user interface for mobile",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("ux");
    });

    it("should handle architect agent detection", async () => {
      const result = await command.execute({
        prompt: "@architect design the system patterns",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents.length).toBeGreaterThan(0);
      expect(parsed.data.detectedAgents[0].agentType).toBe("architect");
    });

    it("should handle devops agent detection", async () => {
      const result = await command.execute({
        prompt: "@devops set up CI/CD pipeline",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(1);
      expect(parsed.data.detectedAgents[0].agentType).toBe("devops");
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      // Mock the service to throw an error
      const originalService = command["promptDetectionService"];
      command["promptDetectionService"] = {
        detectAgents: vi.fn().mockImplementation(() => {
          throw new Error("Service error");
        }),
      } as unknown as PromptDetectionService;

      const result = await command.execute({
        prompt: "@dev implement feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("AGENT_DETECTION_FAILED");
      expect(parsed.error.message).toContain("Service error");

      // Restore original service
      command["promptDetectionService"] = originalService;
    });

    it("should handle unknown errors", async () => {
      // Mock the service to throw a non-Error object
      const originalService = command["promptDetectionService"];
      command["promptDetectionService"] = {
        detectAgents: vi.fn().mockImplementation(() => {
          throw "Unknown error";
        }),
      } as unknown as PromptDetectionService;

      const result = await command.execute({
        prompt: "@dev implement feature",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("AGENT_DETECTION_FAILED");
      expect(parsed.error.message).toBe("Unknown error");

      // Restore original service
      command["promptDetectionService"] = originalService;
    });
  });

  describe("complex scenarios", () => {
    it("should handle complex prompts with multiple patterns", async () => {
      const result = await command.execute({
        prompt:
          "@dev ProjectAlpha implement authentication, then @qa test the login flow for security issues",
        userId: "user123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(2);
      expect(parsed.data.multipleAgentsDetected).toBe(true);
      expect(parsed.data.projectContext).toBe("ProjectAlpha");
      expect(parsed.data.confidence).toBeGreaterThan(0.7);
    });

    it("should handle natural language mixed with direct patterns", async () => {
      const result = await command.execute({
        prompt:
          "I need @dev to implement the feature and also get a tester to validate it",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.detectedAgents).toHaveLength(2);
      expect(
        parsed.data.detectedAgents.map((a: DetectedAgent) => a.agentType),
      ).toContain("dev");
      expect(
        parsed.data.detectedAgents.map((a: DetectedAgent) => a.agentType),
      ).toContain("qa");
    });

    it("should return structured response for all scenarios", async () => {
      const scenarios = [
        "@dev implement feature",
        "just some text",
        "@dev ProjectX implement @qa test",
        "get me a programmer",
      ];

      for (const prompt of scenarios) {
        const result = await command.execute({ prompt });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty("success");
        expect(parsed.data).toHaveProperty("detectedAgents");
        expect(parsed.data).toHaveProperty("confidence");
        expect(parsed.data).toHaveProperty("multipleAgentsDetected");
        expect(Array.isArray(parsed.data.detectedAgents)).toBe(true);
        expect(typeof parsed.data.confidence).toBe("number");
        expect(typeof parsed.data.multipleAgentsDetected).toBe("boolean");
      }
    });
  });
});
