import { beforeEach, describe, expect, it } from "vitest";

import {
  AgentType,
  PromptDetectionService,
} from "../../../src/services/PromptDetectionService.js";

describe("PromptDetectionService", () => {
  let service: PromptDetectionService;

  beforeEach(() => {
    service = new PromptDetectionService();
  });

  describe("detectAgents", () => {
    it("should detect @dev notation", () => {
      const result = service.detectAgents("@dev implement new feature");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@dev");
      expect(result.multipleAgentsDetected).toBe(false);
    });

    it("should detect @pm notation", () => {
      const result = service.detectAgents("@pm plan the project timeline");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("pm");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@pm");
    });

    it("should detect @qa notation", () => {
      const result = service.detectAgents("@qa test this application");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("qa");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@qa");
    });

    it("should detect @ux notation", () => {
      const result = service.detectAgents("@ux create the interface");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("ux");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@ux");
    });

    it("should detect natural language dev requests", () => {
      const result = service.detectAgents("I need help implementing this code");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.6);
    });

    it("should detect natural language PM requests", () => {
      const result = service.detectAgents(
        "get me a project manager to organize the schedule",
      );

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("pm");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.6);
    });

    it("should detect multiple agents in one prompt", () => {
      const result = service.detectAgents(
        "@dev implement this and @qa test it",
      );

      expect(result.detectedAgents).toHaveLength(2);
      expect(result.multipleAgentsDetected).toBe(true);
      expect(result.detectedAgents.map((a) => a.agentType)).toContain("dev");
      expect(result.detectedAgents.map((a) => a.agentType)).toContain("qa");
    });

    it("should handle prompts with no agent patterns", () => {
      const result = service.detectAgents("just some random text here");

      expect(result.detectedAgents).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.fallbackSuggestions).toBeDefined();
      expect(result.fallbackSuggestions?.length).toBeGreaterThan(0);
    });

    it("should detect agent aliases", () => {
      const result = service.detectAgents("I need a programmer to help");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
      expect(result.detectedAgents[0].matchedPattern).toBe("programmer");
    });

    it("should handle case insensitive matching", () => {
      const result = service.detectAgents("@DEV BUILD THIS FEATURE");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
    });

    it("should detect devops agent", () => {
      const result = service.detectAgents("@devops deploy this application");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("devops");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
    });

    it("should detect architect agent", () => {
      const result = service.detectAgents(
        "@architect design the system structure",
      );

      expect(result.detectedAgents.length).toBeGreaterThan(0);
      expect(result.detectedAgents[0].agentType).toBe("architect");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@architect");
    });

    it("should detect analyst agent", () => {
      const result = service.detectAgents("@analyst review business processes");

      expect(result.detectedAgents.length).toBeGreaterThan(0);
      expect(result.detectedAgents[0].agentType).toBe("analyst");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@analyst");
    });

    it("should detect bmad-master agent", () => {
      const result = service.detectAgents(
        "@bmad-master orchestrate the methodology",
      );

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("bmad-master");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@bmad-master");
    });

    it("should detect sm (scrum master) agent", () => {
      const result = service.detectAgents("@sm facilitate the retrospective");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("sm");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.9);
      expect(result.detectedAgents[0].matchedPattern).toBe("@sm");
    });

    it("should detect analyst with natural language", () => {
      const result = service.detectAgents(
        "I need a business analyst for the process evaluation",
      );

      expect(result.detectedAgents.length).toBeGreaterThan(0);
      expect(result.detectedAgents[0].agentType).toBe("analyst");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.6);
    });

    it("should detect bmad-master with bmad keyword", () => {
      const result = service.detectAgents("need bmad methodology guidance");

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("bmad-master");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.6);
    });

    it("should detect scrum master with agile keywords", () => {
      const result = service.detectAgents(
        "need scrum facilitator for the retrospective",
      );

      expect(result.detectedAgents.length).toBeGreaterThan(0);
      expect(result.detectedAgents[0].agentType).toBe("sm");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.6);
    });
  });

  describe("extractProjectContext", () => {
    it("should extract project context from @agent ProjectName format", () => {
      const context = service.extractProjectContext(
        "@dev ProjectX implement feature",
      );
      expect(context).toBe("ProjectX");
    });

    it("should extract project context from 'for ProjectName' format", () => {
      const context = service.extractProjectContext(
        "implement this for MyProject",
      );
      expect(context).toBe("MyProject");
    });

    it("should extract project context from 'ProjectName:' format", () => {
      const context = service.extractProjectContext(
        "ProjectY: implement new feature",
      );
      expect(context).toBe("ProjectY");
    });

    it("should return null when no project context found", () => {
      const context = service.extractProjectContext(
        "just implement this feature",
      );
      expect(context).toBeNull();
    });

    it("should handle multiple potential contexts and return the first one", () => {
      const context = service.extractProjectContext(
        "@dev Project1 implement for Project2",
      );
      expect(context).toBe("Project1");
    });
  });

  describe("calculateConfidence", () => {
    it("should return 0 for no matches", () => {
      const confidence = service.calculateConfidence([]);
      expect(confidence).toBe(0);
    });

    it("should calculate high confidence for direct pattern matches", () => {
      const matches = [
        {
          agentType: "dev" as AgentType,
          context: "@dev implement feature",
          matchType: "direct" as const,
          pattern: "@dev",
          patternStrength: 1.0,
          weight: 1.0,
        },
      ];

      const confidence = service.calculateConfidence(matches);
      expect(confidence).toBeGreaterThan(0.8);
    });

    it("should calculate medium confidence for keyword matches", () => {
      const matches = [
        {
          agentType: "dev" as AgentType,
          context: "implement this feature",
          matchType: "keyword" as const,
          pattern: "implement",
          patternStrength: 0.7,
          weight: 1.0,
        },
      ];

      const confidence = service.calculateConfidence(matches);
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(0.9);
    });

    it("should apply penalty for multiple agents", () => {
      const singleMatch = [
        {
          agentType: "dev" as AgentType,
          context: "@dev implement",
          matchType: "direct" as const,
          pattern: "@dev",
          patternStrength: 1.0,
          weight: 1.0,
        },
      ];

      const multipleMatches = [
        ...singleMatch,
        {
          agentType: "qa" as AgentType,
          context: "@qa test",
          matchType: "direct" as const,
          pattern: "@qa",
          patternStrength: 1.0,
          weight: 1.0,
        },
      ];

      const singleConfidence = service.calculateConfidence(singleMatch);
      const multipleConfidence = service.calculateConfidence(multipleMatches);

      expect(multipleConfidence).toBeLessThan(singleConfidence);
    });
  });

  describe("suggestFallbacks", () => {
    it("should suggest dev for development terms", () => {
      const suggestions = service.suggestFallbacks("need to code this feature");
      expect(suggestions).toContain("dev");
    });

    it("should suggest pm for project management terms", () => {
      const suggestions = service.suggestFallbacks("need to plan this project");
      expect(suggestions).toContain("pm");
    });

    it("should suggest qa for testing terms", () => {
      const suggestions = service.suggestFallbacks(
        "need to test this application",
      );
      expect(suggestions).toContain("qa");
    });

    it("should suggest ux for design terms", () => {
      const suggestions = service.suggestFallbacks(
        "need to design the interface",
      );
      expect(suggestions).toContain("ux");
    });

    it("should provide default suggestions when no specific terms match", () => {
      const suggestions = service.suggestFallbacks("just some random text");
      expect(suggestions).toContain("dev");
      expect(suggestions).toContain("pm");
    });

    it("should suggest multiple agents for mixed terms", () => {
      const suggestions = service.suggestFallbacks(
        "need to code and test this",
      );
      expect(suggestions).toContain("dev");
      expect(suggestions).toContain("qa");
    });
  });

  describe("validateAgentType", () => {
    it("should validate supported agent types", () => {
      expect(service.validateAgentType("analyst")).toBe(true);
      expect(service.validateAgentType("architect")).toBe(true);
      expect(service.validateAgentType("bmad-master")).toBe(true);
      expect(service.validateAgentType("dev")).toBe(true);
      expect(service.validateAgentType("devops")).toBe(true);
      expect(service.validateAgentType("pm")).toBe(true);
      expect(service.validateAgentType("qa")).toBe(true);
      expect(service.validateAgentType("sm")).toBe(true);
      expect(service.validateAgentType("ux")).toBe(true);
    });

    it("should reject unsupported agent types", () => {
      expect(service.validateAgentType("invalid")).toBe(false);
      expect(service.validateAgentType("random")).toBe(false);
      expect(service.validateAgentType("")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle empty prompts gracefully", () => {
      const result = service.detectAgents("");
      expect(result.detectedAgents).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it("should handle whitespace-only prompts", () => {
      const result = service.detectAgents("   \n\t   ");
      expect(result.detectedAgents).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it("should handle very long prompts", () => {
      const longPrompt = "a".repeat(10000) + " @dev implement";
      const result = service.detectAgents(longPrompt);
      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
    });
  });

  describe("complex scenarios", () => {
    it("should handle compound requests with project context", () => {
      const result = service.detectAgents(
        "@dev ProjectX implement login and @qa test authentication",
      );

      expect(result.detectedAgents).toHaveLength(2);
      expect(result.multipleAgentsDetected).toBe(true);
      expect(result.projectContext).toBe("ProjectX");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should prioritize direct patterns over keywords", () => {
      const result = service.detectAgents(
        "@pm organize the project deliverables",
      );

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("pm");
      expect(result.detectedAgents[0].matchedPattern).toBe("@pm");
    });

    it("should handle natural language with multiple potential matches", () => {
      const result = service.detectAgents(
        "I need a developer to code and implement the feature",
      );

      expect(result.detectedAgents).toHaveLength(1);
      expect(result.detectedAgents[0].agentType).toBe("dev");
      expect(result.detectedAgents[0].confidence).toBeGreaterThan(0.7);
    });
  });
});
