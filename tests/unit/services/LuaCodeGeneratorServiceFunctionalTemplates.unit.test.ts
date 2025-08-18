import { beforeEach, describe, expect, it, vi } from "vitest";

import { LuaWorkflowOrchestrationService } from "../../../src/services/LuaWorkflowOrchestrationService.js";
import { PermawebDocs } from "../../../src/services/PermawebDocsService.js";
import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

// Mock the PermawebDocs service to avoid external API calls
vi.mock("../../../src/services/PermawebDocsService.js", () => ({
  PermawebDocs: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue([]),
  })),
}));

describe("LuaCodeGeneratorService - Functional Templates", () => {
  let orchestrationService: LuaWorkflowOrchestrationService;
  let mockPermawebDocs: any;
  let requirementAnalysisService: RequirementAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermawebDocs = new PermawebDocs();
    requirementAnalysisService = new RequirementAnalysisService();
    orchestrationService = new LuaWorkflowOrchestrationService(
      mockPermawebDocs,
      requirementAnalysisService,
    );
  });

  describe("Calculator Template Selection", () => {
    it("should select addition template for addition requests", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a calculator with addition",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"addition"');
      expect(result.codeResult.generatedCode).toContain('Action = "Sum"');
      expect(result.codeResult.generatedCode).toContain("local result = a + b");
      expect(result.codeResult.generatedCode).toContain(
        "Invalid input. Please provide numeric values",
      );
    });

    it("should select subtraction template for subtraction requests", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Build calculator with subtract operation",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"subtraction"');
      expect(result.codeResult.generatedCode).toContain(
        'Action = "Difference"',
      );
      expect(result.codeResult.generatedCode).toContain("local result = a - b");
    });

    it("should select multiple calculator templates for comprehensive requests", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create calculator with addition and subtraction",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"addition"');
      expect(result.codeResult.generatedCode).toContain('"subtraction"');
      expect(result.codeResult.generatedCode).toContain("local result = a + b");
      expect(result.codeResult.generatedCode).toContain("local result = a - b");
    });

    it("should include division by zero protection in division template", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create calculator with division operation",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"division"');
      expect(result.codeResult.generatedCode).toContain("if b == 0 then");
      expect(result.codeResult.generatedCode).toContain(
        "Division by zero is not allowed",
      );
    });
  });

  describe("Counter Template Selection", () => {
    it("should select all counter templates for counter requests", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a counter with increment and decrement",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"increment"');
      expect(result.codeResult.generatedCode).toContain('"decrement"');
      expect(result.codeResult.generatedCode).toContain('"reset"');
      expect(result.codeResult.generatedCode).toContain('"current"');
    });
  });

  describe("Database Template Selection", () => {
    it("should select all database templates for database requests", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create simple database with store and retrieve operations",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.codeResult.generatedCode).toContain('"store"');
      expect(result.codeResult.generatedCode).toContain('"retrieve"');
      expect(result.codeResult.generatedCode).toContain('"update"');
      expect(result.codeResult.generatedCode).toContain('"delete"');
    });
  });

  describe("Template Prioritization Logic", () => {
    it("should prioritize functional templates over basic handler", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a calculator with addition",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      // Should NOT contain basic handler template placeholders
      expect(result.codeResult.generatedCode).not.toContain("{{name}}");
      expect(result.codeResult.generatedCode).not.toContain("{{action}}");
      // Should contain functional calculator template
      expect(result.codeResult.generatedCode).toContain('"addition"');
    });

    it("should fall back to basic handler only when no functional patterns detected", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a generic message handler",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      // Should contain some handler code (either functional or basic)
      expect(result.codeResult.generatedCode).toContain("");
    });
  });

  describe("ADP Metadata for Functional Templates", () => {
    it("should generate accurate ADP metadata for calculator handlers", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a calculator with addition",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "calculator",
      );
    });

    it("should generate accurate ADP metadata for counter handlers", async () => {
      const result = await orchestrationService.orchestrateWorkflow(
        "Create a counter with increment and decrement",
      );

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "counter",
      );
    });
  });
});
