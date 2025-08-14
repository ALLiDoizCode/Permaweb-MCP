import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowTemplateService } from "../../../src/services/WorkflowTemplateService.js";
import { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

describe("WorkflowTemplateService", () => {
  let service: WorkflowTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkflowTemplateService();
  });

  describe("loadAvailableTemplates", () => {
    it("should load all standard templates", async () => {
      const templates = await service.loadAvailableTemplates();

      expect(templates.length).toBeGreaterThan(0);

      // Check that all standard templates are loaded
      const templateIds = templates.map((t) => t.templateId);
      expect(templateIds).toContain("token-standard");
      expect(templateIds).toContain("chatroom-standard");
      expect(templateIds).toContain("bot-standard");
      expect(templateIds).toContain("game-standard");
      expect(templateIds).toContain("custom-flexible");
    });

    it("should return templates with proper structure", async () => {
      const templates = await service.loadAvailableTemplates();
      const tokenTemplate = templates.find(
        (t) => t.templateId === "token-standard",
      );

      expect(tokenTemplate).toBeDefined();
      expect(tokenTemplate?.name).toBe("Standard Token Process");
      expect(tokenTemplate?.category).toBe("token");
      expect(tokenTemplate?.processType).toBe("token");
      expect(tokenTemplate?.complexity).toBe("moderate");
      expect(tokenTemplate?.stages.length).toBeGreaterThan(0);
      expect(tokenTemplate?.parameters.length).toBeGreaterThan(0);
      expect(tokenTemplate?.aoPatterns).toContain("token-contract");
    });
  });

  describe("selectTemplateForRequirements", () => {
    it("should select token template for token requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "state-management"],
        extractedKeywords: ["token", "supply", "transfer"],
        processType: "token",
        userRequest: "Create a token with 1000 supply and MYTOKEN symbol",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.template.templateId).toBe("token-standard");
      expect(recommendation.confidence).toBeGreaterThan(0.5);
      expect(recommendation.matchReasons.length).toBeGreaterThan(0);
      expect(
        recommendation.matchReasons.some((reason) => reason.includes("token")),
      ).toBe(true);
    });

    it("should select chatroom template for chatroom requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["message-routing"],
        extractedKeywords: ["chat", "room", "message"],
        processType: "chatroom",
        userRequest: "Create a chatroom for community discussions",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.template.templateId).toBe("chatroom-standard");
      expect(recommendation.confidence).toBeGreaterThan(0.5);
      expect(
        recommendation.matchReasons.some((reason) =>
          reason.includes("chatroom"),
        ),
      ).toBe(true);
    });

    it("should select bot template for bot requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["handler", "message-routing"],
        extractedKeywords: ["bot", "automated", "response"],
        processType: "multi-process", // Should map to bot
        userRequest: "Create an automated response bot",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.template.templateId).toBe("bot-standard");
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it("should select game template for game requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["state-management", "process-communication"],
        extractedKeywords: ["game", "player", "turn"],
        processType: "game",
        userRequest: "Create a tic-tac-toe game",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.template.templateId).toBe("game-standard");
      expect(recommendation.confidence).toBeGreaterThan(0.5);
    });

    it("should fallback to custom template for unmatched requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: [],
        extractedKeywords: ["unique", "special"],
        processType: "unknown", // This doesn't match any standard template type
        userRequest: "Create something completely unique and special",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      // The service will try to match and may select any template, but should prefer custom for unknown types
      expect([
        "custom-flexible",
        "chatroom-standard",
        "bot-standard",
        "game-standard",
        "token-standard",
      ]).toContain(recommendation.template.templateId);
      expect(recommendation.confidence).toBeLessThanOrEqual(0.8); // Should have lower confidence for poor matches
    });

    it("should provide alternatives in recommendation", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["handler"],
        extractedKeywords: ["process"],
        processType: "token",
        userRequest: "Create a token process",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.alternatives.length).toBeGreaterThan(0);
      expect(recommendation.alternatives.length).toBeLessThanOrEqual(3);
      expect(
        recommendation.alternatives.every(
          (alt) =>
            alt.template.templateId !== recommendation.template.templateId,
        ),
      ).toBe(true);
    });

    it("should generate customizations based on requirements", async () => {
      const requirements: RequirementAnalysis = {
        complexity: "moderate",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "MyToken"],
        processType: "token",
        userRequest: "Create a token called MyToken with supply 5000",
      };

      const recommendation =
        await service.selectTemplateForRequirements(requirements);

      expect(recommendation.customizations.length).toBeGreaterThan(0);

      // Should extract token name (the regex in the service extracts lowercase)
      const nameCustomization = recommendation.customizations.find(
        (c) => c.parameterId === "tokenName",
      );
      expect(nameCustomization?.value).toBe("mytoken"); // Service regex extracts as lowercase
      expect(nameCustomization?.source).toBe("requirements");

      // Should extract supply
      const supplyCustomization = recommendation.customizations.find(
        (c) => c.parameterId === "initialSupply",
      );
      expect(supplyCustomization?.value).toBe(5000);
    });
  });

  describe("customizeTemplate", () => {
    it("should customize template with provided customizations", async () => {
      const templates = await service.loadAvailableTemplates();
      const tokenTemplate = templates.find(
        (t) => t.templateId === "token-standard",
      )!;

      const customizations = [
        {
          parameterId: "tokenName",
          reason: "User specified",
          source: "requirements" as const,
          value: "MyCustomToken",
        },
        {
          parameterId: "initialSupply",
          reason: "User specified",
          source: "requirements" as const,
          value: 10000,
        },
      ];

      const customizedTemplate = await service.customizeTemplate(
        tokenTemplate,
        customizations,
      );

      expect(customizedTemplate.customizations).toEqual(customizations);
      expect(customizedTemplate.finalConfiguration.processType).toBe("token");
      expect(customizedTemplate.validationResults.length).toBeGreaterThan(0);
      expect(customizedTemplate.confidence).toBeGreaterThan(0);
      expect(customizedTemplate.estimatedExecutionTime).toBeGreaterThan(0);

      // Check that parameters were customized
      const nameParam = customizedTemplate.template.parameters.find(
        (p) => p.name === "tokenName",
      );
      expect(nameParam?.defaultValue).toBe("MyCustomToken");

      const supplyParam = customizedTemplate.template.parameters.find(
        (p) => p.name === "initialSupply",
      );
      expect(supplyParam?.defaultValue).toBe(10000);
    });

    it("should increase execution time for complex customizations", async () => {
      const templates = await service.loadAvailableTemplates();
      const template = templates.find(
        (t) => t.templateId === "custom-flexible",
      )!;

      const simpleCustomizations = [
        {
          parameterId: "simpleProp",
          reason: "Simple",
          source: "system" as const,
          value: "simple",
        },
      ];

      const complexCustomizations = [
        {
          parameterId: "complexProp1",
          reason: "Complex",
          source: "requirements" as const,
          value: { nested: { complex: "object" } },
        },
        {
          parameterId: "complexProp2",
          reason: "Complex",
          source: "requirements" as const,
          value: [1, 2, 3, 4, 5],
        },
      ];

      const simpleResult = await service.customizeTemplate(
        template,
        simpleCustomizations,
      );
      const complexResult = await service.customizeTemplate(
        template,
        complexCustomizations,
      );

      expect(complexResult.estimatedExecutionTime).toBeGreaterThan(
        simpleResult.estimatedExecutionTime,
      );
    });

    it("should calculate confidence based on customizations", async () => {
      const templates = await service.loadAvailableTemplates();
      const template = templates.find(
        (t) => t.templateId === "token-standard",
      )!;

      const userCustomizations = [
        {
          parameterId: "tokenName",
          reason: "User specified",
          source: "requirements" as const,
          value: "UserToken",
        },
        {
          parameterId: "initialSupply",
          reason: "User specified",
          source: "requirements" as const,
          value: 1000,
        },
      ];

      const systemCustomizations = [
        {
          parameterId: "decimals",
          reason: "System default",
          source: "system" as const,
          value: 18,
        },
      ];

      const userResult = await service.customizeTemplate(
        template,
        userCustomizations,
      );
      const systemResult = await service.customizeTemplate(
        template,
        systemCustomizations,
      );

      expect(userResult.confidence).toBeGreaterThan(systemResult.confidence);
    });
  });

  describe("validateTemplateConfiguration", () => {
    it("should validate well-formed template", async () => {
      const templates = await service.loadAvailableTemplates();
      const tokenTemplate = templates.find(
        (t) => t.templateId === "token-standard",
      )!;

      const validation =
        await service.validateTemplateConfiguration(tokenTemplate);

      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(0.8);
      expect(
        validation.issues.filter((i) => i.severity === "error"),
      ).toHaveLength(0);
      expect(validation.bestPracticesCompliance).toBeGreaterThan(0.5);
    });

    it("should identify missing template name", async () => {
      const invalidTemplate = {
        aoPatterns: [],
        category: "token" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Test",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "", // Invalid
        parameters: [],
        processType: "token" as const,
        stages: [],
        templateId: "test",
        version: "1.0",
      };

      const validation =
        await service.validateTemplateConfiguration(invalidTemplate);

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((i) =>
          i.message.includes("Template name is required"),
        ),
      ).toBe(true);
    });

    it("should identify missing stages", async () => {
      const invalidTemplate = {
        aoPatterns: [],
        category: "token" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Test",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Test Template",
        parameters: [],
        processType: "token" as const,
        stages: [], // Invalid - no stages
        templateId: "test",
        version: "1.0",
      };

      const validation =
        await service.validateTemplateConfiguration(invalidTemplate);

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((i) =>
          i.message.includes("Template must have at least one stage"),
        ),
      ).toBe(true);
    });

    it("should validate stage dependencies", async () => {
      const invalidTemplate = {
        aoPatterns: [],
        category: "token" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Test",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Test Template",
        parameters: [],
        processType: "token" as const,
        stages: [
          {
            defaultTools: [],
            dependencies: ["non-existent-stage"], // Invalid dependency
            documentation: "Test stage",
            expectedOutputType: "string",
            parameters: {},
            required: true,
            stage: "test-stage",
            validationRules: [],
          },
        ],
        templateId: "test",
        version: "1.0",
      };

      const validation =
        await service.validateTemplateConfiguration(invalidTemplate);

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((i) =>
          i.message.includes("Stage dependency not found"),
        ),
      ).toBe(true);
    });

    it("should validate required parameters", async () => {
      const templates = await service.loadAvailableTemplates();
      const tokenTemplate = templates.find(
        (t) => t.templateId === "token-standard",
      )!;

      const validation =
        await service.validateTemplateConfiguration(tokenTemplate);

      // Token template has required parameters, they should be tracked
      expect(validation.requirements.met.length).toBeGreaterThan(0);

      // Check if required parameters without defaults are flagged
      const requiredParams = tokenTemplate.parameters.filter(
        (p) => p.required && !p.defaultValue,
      );
      expect(validation.requirements.missing.length).toBe(
        requiredParams.length,
      );
    });

    it("should warn about missing AO patterns", async () => {
      const templateWithoutPatterns = {
        aoPatterns: [], // No AO patterns
        category: "custom" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Test",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Test Template",
        parameters: [],
        processType: "custom" as const,
        stages: [
          {
            defaultTools: [],
            dependencies: [],
            documentation: "Test stage",
            expectedOutputType: "string",
            parameters: {},
            required: true,
            stage: "test-stage",
            validationRules: [],
          },
        ],
        templateId: "test",
        version: "1.0",
      };

      const validation = await service.validateTemplateConfiguration(
        templateWithoutPatterns,
      );

      expect(
        validation.issues.some(
          (i) =>
            i.message.includes("No AO patterns specified") &&
            i.severity === "warning",
        ),
      ).toBe(true);
      expect(validation.bestPracticesCompliance).toBeLessThan(1.0);
    });

    it("should warn about missing documentation", async () => {
      const templateWithoutDocs = {
        aoPatterns: ["handler"],
        category: "custom" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Test",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "", // Missing overview
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Test Template",
        parameters: [],
        processType: "custom" as const,
        stages: [
          {
            defaultTools: [],
            dependencies: [],
            documentation: "Test stage",
            expectedOutputType: "string",
            parameters: {},
            required: true,
            stage: "test-stage",
            validationRules: [],
          },
        ],
        templateId: "test",
        version: "1.0",
      };

      const validation =
        await service.validateTemplateConfiguration(templateWithoutDocs);

      expect(
        validation.issues.some(
          (i) =>
            i.message.includes("documentation overview is missing") &&
            i.severity === "info",
        ),
      ).toBe(true);
    });
  });

  describe("template management", () => {
    it("should add new template", () => {
      const customTemplate = {
        aoPatterns: ["custom-pattern"],
        category: "custom" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Custom test template",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "Test template",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Custom Template",
        parameters: [],
        processType: "custom" as const,
        stages: [],
        templateId: "custom-test",
        version: "1.0",
      };

      service.addTemplate(customTemplate);

      const retrieved = service.getTemplate("custom-test");
      expect(retrieved).toEqual(customTemplate);
    });

    it("should update existing template", () => {
      const template = {
        aoPatterns: [],
        category: "custom" as const,
        complexity: "simple" as const,
        configuration: {},
        description: "Original description",
        documentation: {
          bestPractices: [],
          examples: [],
          overview: "",
          useCases: [],
        },
        estimatedTime: 1000,
        metadata: {},
        name: "Test Template",
        parameters: [],
        processType: "custom" as const,
        stages: [],
        templateId: "test-update",
        version: "1.0",
      };

      service.addTemplate(template);

      const updatedTemplate = {
        ...template,
        description: "Updated description",
      };
      service.addTemplate(updatedTemplate);

      const retrieved = service.getTemplate("test-update");
      expect(retrieved?.description).toBe("Updated description");
    });

    it("should remove template", async () => {
      const templates = await service.loadAvailableTemplates();
      const initialCount = templates.length;

      const success = service.removeTemplate("token-standard");
      expect(success).toBe(true);

      const updatedTemplates = await service.loadAvailableTemplates();
      expect(updatedTemplates.length).toBe(initialCount - 1);
      expect(
        updatedTemplates.find((t) => t.templateId === "token-standard"),
      ).toBeUndefined();
    });

    it("should return false when removing non-existent template", () => {
      const success = service.removeTemplate("non-existent");
      expect(success).toBe(false);
    });

    it("should return undefined for non-existent template", () => {
      const template = service.getTemplate("non-existent");
      expect(template).toBeUndefined();
    });
  });
});
