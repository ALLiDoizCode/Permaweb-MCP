import { beforeAll, describe, expect, it } from "vitest";

import { LuaWorkflowOrchestrationService } from "../../src/services/LuaWorkflowOrchestrationService.js";
import { ToolContext } from "../../src/tools/core/index.js";
import { GenerateLuaProcessCommand } from "../../src/tools/process/commands/GenerateLuaProcessCommand.js";

describe("LuaWorkflow Integration", () => {
  let orchestrationService: LuaWorkflowOrchestrationService;
  let generateCommand: GenerateLuaProcessCommand;
  let mockContext: ToolContext;

  beforeAll(() => {
    orchestrationService = new LuaWorkflowOrchestrationService();

    mockContext = {
      hubId: "integration-test-hub",
      keyPair: { kty: "RSA" } as any,
      publicKey: "integration-test-key",
    };

    generateCommand = new GenerateLuaProcessCommand(mockContext);
  });

  describe("End-to-End Workflow Integration", () => {
    it("should generate simple ping handler workflow", async () => {
      const userRequest = "Create a simple ping handler";
      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      // Verify workflow components
      expect(result.requirements.analysis.userRequest).toBe(userRequest);
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "handler",
      );
      expect(result.requirements.analysis.complexity).toBe("simple");
      expect(result.requirements.analysis.processType).toBe("stateless");

      // Verify code generation
      expect(result.codeResult.generatedCode).toContain("Handlers.add");
      expect(result.codeResult.generatedCode).toContain("handler");
      expect(result.codeResult.generatedCode).toContain("ao.send");

      // Verify explanation
      expect(result.explanation.overview).toBeDefined();
      expect(result.explanation.codeBreakdown.length).toBeGreaterThan(0);
      expect(result.explanation.bestPractices.length).toBeGreaterThan(0);

      // Verify timestamp
      expect(result.timestamp).toBeInstanceOf(Date);
    }, 15000); // Allow extra time for potential documentation queries

    it("should generate token contract workflow", async () => {
      const userRequest =
        "Create a token contract with balance and transfer functionality";
      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      // Verify requirements analysis
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "token-contract",
      );
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "handler",
      );
      expect(result.requirements.analysis.complexity).toBe("complex");
      expect(result.requirements.analysis.processType).toBe("stateful");

      // Verify code includes token-specific patterns
      expect(result.codeResult.generatedCode).toContain("balance");
      expect(result.codeResult.generatedCode).toContain("transfer");
      expect(result.codeResult.generatedCode).toContain("State");
      expect(result.codeResult.generatedCode).toContain("Balances");

      // Verify handler patterns
      const balanceHandler = result.codeResult.handlerPatterns.find(
        (p) => p.name === "balance-handler",
      );
      const transferHandler = result.codeResult.handlerPatterns.find(
        (p) => p.name === "transfer-handler",
      );
      expect(balanceHandler).toBeDefined();
      expect(transferHandler).toBeDefined();

      // Verify best practices include token-specific items
      expect(
        result.codeResult.bestPractices.some(
          (practice) =>
            practice.includes("balance") || practice.includes("transfer"),
        ),
      ).toBe(true);
    }, 15000);

    it("should generate DAO governance workflow", async () => {
      const userRequest =
        "Build a DAO governance system with voting and proposals";
      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      // Verify requirements analysis
      expect(result.requirements.analysis.detectedPatterns).toContain(
        "dao-governance",
      );
      expect(result.requirements.analysis.complexity).toBe("complex");
      expect(result.requirements.analysis.processType).toBe("stateful");

      // Verify code includes DAO-specific patterns
      expect(result.codeResult.generatedCode).toContain("proposal");
      expect(result.codeResult.generatedCode).toContain("vote");
      expect(result.codeResult.generatedCode).toContain("Proposals");

      // Verify handler patterns
      const proposalHandler = result.codeResult.handlerPatterns.find(
        (p) => p.name === "proposal-handler",
      );
      const voteHandler = result.codeResult.handlerPatterns.find(
        (p) => p.name === "vote-handler",
      );
      expect(proposalHandler).toBeDefined();
      expect(voteHandler).toBeDefined();

      // Verify explanation covers DAO concepts
      expect(result.explanation.overview.toLowerCase()).toContain("governance");
    }, 15000);

    it("should handle workflow with no documentation results gracefully", async () => {
      // Use a very specific request that's unlikely to match documentation
      const userRequest = "Create a xyz123 foobar handler";
      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      // Should still generate valid workflow
      expect(result.requirements.analysis.userRequest).toBe(userRequest);
      expect(result.codeResult.generatedCode).toBeDefined();
      expect(result.explanation.overview).toBeDefined();

      // Code should still be valid Lua syntax
      expect(result.codeResult.generatedCode).toContain("Handlers.add");
      expect(result.codeResult.generatedCode).toContain("function(msg)");
      expect(result.codeResult.generatedCode).toContain("end");
    });

    it("should generate different complexity levels appropriately", async () => {
      const simpleRequest = "Create a basic ping handler";
      const complexRequest =
        "Build an advanced enterprise DAO system with multiple voting mechanisms";

      const simpleResult =
        await orchestrationService.orchestrateWorkflow(simpleRequest);
      const complexResult =
        await orchestrationService.orchestrateWorkflow(complexRequest);

      // Simple should be less complex than complex
      expect(simpleResult.requirements.analysis.complexity).toBe("simple");
      expect(complexResult.requirements.analysis.complexity).toBe("complex");

      // Complex should have more patterns (or at least same number)
      expect(
        complexResult.requirements.analysis.detectedPatterns.length,
      ).toBeGreaterThanOrEqual(
        simpleResult.requirements.analysis.detectedPatterns.length,
      );

      // Code length should generally be proportional to complexity
      expect(complexResult.codeResult.generatedCode.length).toBeGreaterThan(
        simpleResult.codeResult.generatedCode.length,
      );
    });
  });

  describe("MCP Tool Command Integration", () => {
    it("should execute complete workflow through MCP tool", async () => {
      const result = await generateCommand.execute({
        includeExplanation: true,
        userRequest: "Create a token contract",
      });

      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.workflow).toBeDefined();
      expect(parsedResult.workflow.analysis).toBeDefined();
      expect(parsedResult.workflow.code.generatedCode).toContain(
        "Handlers.add",
      );
      expect(parsedResult.workflow.explanation).toBeDefined();
    });

    it("should handle MCP tool execution without explanation", async () => {
      const result = await generateCommand.execute({
        includeExplanation: false,
        userRequest: "Create a simple handler",
      });

      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.workflow.explanation).toBeUndefined();
      expect(parsedResult.workflow.code.generatedCode).toBeDefined();
    });

    it("should validate MCP tool parameters properly", async () => {
      // Test parameter validation through actual tool execution
      try {
        await generateCommand.execute({} as any);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeDefined();
      }

      try {
        await generateCommand.execute({ userRequest: "" });
        expect.fail("Should have thrown validation error for empty string");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Cross-Service Integration", () => {
    it("should maintain data consistency across service boundaries", async () => {
      const userRequest = "Create a token with voting capabilities";

      // Test direct service integration
      const analysis =
        await orchestrationService.analyzeRequirements(userRequest);
      const docs = await orchestrationService.queryRelevantDocs(analysis);
      const code = await orchestrationService.generateLuaCode(docs, analysis);
      const explanation = await orchestrationService.explainCode(code, docs);

      // Verify data consistency
      expect(analysis.userRequest).toBe(userRequest);
      expect(code.documentationSources).toEqual(docs.map((d) => d.url));
      expect(explanation.relatedSources.length).toBeLessThanOrEqual(
        docs.length,
      );

      // Verify patterns are consistent across services
      expect(analysis.detectedPatterns).toContain("token-contract");
      expect(
        code.handlerPatterns.some((p) =>
          p.usedPatterns.includes("token-contract"),
        ),
      ).toBe(true);
    });

    it("should handle service integration with partial failures", async () => {
      // This tests the graceful handling when documentation service might fail
      // but the workflow should still complete with template-based generation
      const userRequest = "Create a specialized handler for edge case scenario";
      const result =
        await orchestrationService.orchestrateWorkflow(userRequest);

      // Workflow should complete even if documentation queries return no results
      expect(result.requirements.analysis).toBeDefined();
      expect(result.codeResult.generatedCode).toBeDefined();
      expect(result.explanation).toBeDefined();

      // Should have fallback patterns
      expect(result.codeResult.handlerPatterns.length).toBeGreaterThan(0);
      expect(result.codeResult.bestPractices.length).toBeGreaterThan(0);
    });

    it("should generate syntactically valid Lua code consistently", async () => {
      const testRequests = [
        "Create a ping handler",
        "Build a token contract",
        "Make a DAO voting system",
        "Create message routing",
      ];

      for (const request of testRequests) {
        const result = await orchestrationService.orchestrateWorkflow(request);
        const code = result.codeResult.generatedCode;

        // Basic Lua syntax validation
        expect(code).toContain("Handlers.add");
        expect(code).toContain("function(msg)");
        expect(code).toContain("end");

        // Balanced parentheses
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);

        // No template placeholders should remain
        expect(code).not.toContain("{{");
        expect(code).not.toContain("}}");

        // Should have proper ao.send calls
        expect(code).toContain("ao.send");
      }
    });
  });
});
