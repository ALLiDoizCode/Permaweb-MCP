import { beforeEach, describe, expect, it, vi } from "vitest";

import { LuaWorkflowOrchestrationService } from "../../src/services/LuaWorkflowOrchestrationService.js";
import { PermawebDocs } from "../../src/services/PermawebDocsService.js";

// Mock the PermawebDocs service to avoid external API calls in integration tests
vi.mock("../../src/services/PermawebDocsService.js", () => ({
  PermawebDocs: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue([]),
  })),
}));

describe("Functional Code Generation - Integration", () => {
  let orchestrationService: LuaWorkflowOrchestrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrationService = new LuaWorkflowOrchestrationService();
  });

  describe("End-to-End Calculator Generation", () => {
    it("should generate working calculator with addition and subtraction from user request", async () => {
      const userRequest =
        "Create a calculator with addition and subtraction operations";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should contain proper addition handler
      expect(luaCode).toContain('"addition"');
      expect(luaCode).toContain('Action = "Sum"');
      expect(luaCode).toContain("local result = a + b");

      // Should contain proper subtraction handler
      expect(luaCode).toContain('"subtraction"');
      expect(luaCode).toContain('Action = "Difference"');
      expect(luaCode).toContain("local result = a - b");

      // Should include proper error handling
      expect(luaCode).toContain("Invalid input. Please provide numeric values");

      // Should have functional patterns detected
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "calculator",
      );
    });

    it("should generate comprehensive calculator with all operations", async () => {
      const userRequest =
        "Create a full calculator with addition, subtraction, multiplication, and division";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should contain all four operations
      expect(luaCode).toContain('"addition"');
      expect(luaCode).toContain('"subtraction"');
      expect(luaCode).toContain('"multiplication"');
      expect(luaCode).toContain('"division"');

      // Should include division by zero protection
      expect(luaCode).toContain("if b == 0 then");
      expect(luaCode).toContain("Division by zero is not allowed");
    });
  });

  describe("End-to-End Counter Generation", () => {
    it("should generate working counter from user request", async () => {
      const userRequest =
        "Create a counter with increment, decrement, and reset";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should contain all counter operations
      expect(luaCode).toContain('"increment"');
      expect(luaCode).toContain('"decrement"');
      expect(luaCode).toContain('"reset"');
      expect(luaCode).toContain('"current"');

      // Should include state management
      expect(luaCode).toContain("Counter");

      // Should have counter pattern detected
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "counter",
      );
    });
  });

  describe("End-to-End Database Generation", () => {
    it("should generate working database with CRUD operations", async () => {
      const userRequest =
        "Create a simple database with store, retrieve, update and delete operations";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should contain all CRUD operations
      expect(luaCode).toContain('"store"');
      expect(luaCode).toContain('"retrieve"');
      expect(luaCode).toContain('"update"');
      expect(luaCode).toContain('"delete"');

      // Should include key validation
      expect(luaCode).toContain("key");
      expect(luaCode).toContain("value");

      // Should have database pattern detected
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "database",
      );
    });
  });

  describe("Complex Multi-Domain Requests", () => {
    it("should handle complex requests combining multiple functional domains", async () => {
      const userRequest =
        "Create a process with calculator functionality and a counter to track operations";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should contain elements from both domains
      expect(luaCode).toContain("Handlers.add(");

      // Should detect multiple patterns
      const detectedPatterns = result.requirements.analysis.detectedPatterns;
      expect(detectedPatterns.length).toBeGreaterThan(1);
    });
  });

  describe("Backward Compatibility", () => {
    it("should still generate basic handler for non-functional requests", async () => {
      const userRequest = "Create a simple ping handler";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should generate some form of handler
      expect(luaCode).toContain("Handlers.add(");
    });

    it("should maintain existing domain-specific templates (token, DAO, etc.)", async () => {
      const userRequest = "Create a token contract with transfer functionality";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should generate handler code
      expect(luaCode).toContain("Handlers.add(");

      // Should detect token pattern
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "token-contract",
      );
    });
  });

  describe("Error Handling and Validation", () => {
    it("should include proper error handling in functional templates", async () => {
      const userRequest = "Create a calculator with division";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should include division by zero protection
      expect(luaCode).toContain("if b == 0 then");
      expect(luaCode).toContain("Division by zero is not allowed");
    });

    it("should include validation in database operations", async () => {
      const userRequest = "Create a database with key-value storage";

      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      expect(result).toBeDefined();
      expect(result.codeResult).toBeDefined();

      const luaCode = result.codeResult.generatedCode;

      // Should include key validation
      expect(luaCode).toContain("key");
      expect(luaCode).toContain("not key then");
    });
  });
});
