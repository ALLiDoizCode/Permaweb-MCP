import { beforeEach, describe, expect, it } from "vitest";

import { LuaCodeGeneratorService } from "../../../src/services/LuaCodeGeneratorService.js";
import { PermawebDocsResult } from "../../../src/services/PermawebDocsService.js";
import { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

describe("LuaCodeGeneratorService", () => {
  let service: LuaCodeGeneratorService;

  beforeEach(() => {
    service = new LuaCodeGeneratorService();
  });

  const createMockDocs = (): PermawebDocsResult[] => [
    {
      content: "AO handlers documentation with examples",
      domain: "ao",
      isFullDocument: false,
      relevanceScore: 8.5,
      url: "https://example.com/ao-docs",
    },
    {
      content: "Token contract patterns and best practices",
      domain: "ao",
      isFullDocument: false,
      relevanceScore: 7.2,
      url: "https://example.com/token-docs",
    },
  ];

  const createSimpleRequirements = (): RequirementAnalysis => ({
    complexity: "simple",
    detectedPatterns: ["handler"],
    extractedKeywords: ["ping", "handler", "simple"],
    processType: "stateless",
    suggestedDomains: ["ao"],
    userRequest: "Create a simple ping handler",
  });

  const createTokenRequirements = (): RequirementAnalysis => ({
    complexity: "moderate",
    detectedPatterns: ["token-contract", "handler", "state-management"],
    extractedKeywords: ["token", "contract", "balance", "transfer"],
    processType: "stateful",
    suggestedDomains: ["ao"],
    userRequest: "Create a token contract with balance and transfer",
  });

  const createDAORequirements = (): RequirementAnalysis => ({
    complexity: "complex",
    detectedPatterns: ["dao-governance", "handler", "state-management"],
    extractedKeywords: ["dao", "voting", "proposals", "governance"],
    processType: "stateful",
    suggestedDomains: ["ao"],
    userRequest: "Build a DAO with voting and proposals",
  });

  describe("generateLuaCode", () => {
    it("should generate simple ping handler code", async () => {
      const docs = createMockDocs();
      const requirements = createSimpleRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain("Handlers.add");
      expect(result.generatedCode).toContain("ping");
      expect(result.generatedCode).toContain("ao.send");
      expect(result.handlerPatterns.length).toBeGreaterThan(0);
      expect(result.usedTemplates).toContain("basic-handler");
      expect(result.documentationSources).toEqual(docs.map((d) => d.url));
      expect(result.explanation).toContain("ping");
      expect(result.bestPractices.length).toBeGreaterThan(0);
    });

    it("should generate token contract code", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain("balance");
      expect(result.generatedCode).toContain("transfer");
      expect(result.generatedCode).toContain("Balances");
      expect(result.generatedCode).toContain("State");
      expect(
        result.handlerPatterns.some((p) => p.name === "balance-handler"),
      ).toBe(true);
      expect(
        result.handlerPatterns.some((p) => p.name === "transfer-handler"),
      ).toBe(true);
      expect(result.usedTemplates).toContain("balance-handler");
      expect(result.usedTemplates).toContain("transfer-handler");
    });

    it("should generate DAO governance code", async () => {
      const docs = createMockDocs();
      const requirements = createDAORequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain("proposal");
      expect(result.generatedCode).toContain("vote");
      expect(result.generatedCode).toContain("Proposals");
      expect(result.generatedCode).toContain("State");
      expect(
        result.handlerPatterns.some((p) => p.name === "proposal-handler"),
      ).toBe(true);
      expect(
        result.handlerPatterns.some((p) => p.name === "vote-handler"),
      ).toBe(true);
      expect(result.usedTemplates).toContain("proposal-handler");
      expect(result.usedTemplates).toContain("vote-handler");
    });

    it("should include state initialization for stateful processes", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain("if not State then");
      expect(result.generatedCode).toContain("State = {");
      expect(result.generatedCode).toContain("initialized = true");
    });

    it("should include process info handler", async () => {
      const docs = createMockDocs();
      const requirements = createSimpleRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain('"info"');
      expect(result.generatedCode).toContain("Info");
      expect(result.generatedCode).toContain("Process = ao.id");
    });

    it("should generate appropriate best practices", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.bestPractices).toContain(
        "Always validate message parameters before processing",
      );
      expect(result.bestPractices).toContain(
        "Use Handlers.utils.hasMatchingTag for action matching",
      );
      expect(
        result.bestPractices.some(
          (p) =>
            p.includes("token") ||
            p.includes("balance") ||
            p.includes("transfer"),
        ),
      ).toBe(true);
    });

    it("should handle empty documentation gracefully", async () => {
      const docs: PermawebDocsResult[] = [];
      const requirements = createSimpleRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toBeDefined();
      expect(result.handlerPatterns.length).toBeGreaterThan(0);
      expect(result.documentationSources).toEqual([]);
      expect(result.bestPractices.length).toBeGreaterThan(0);
    });

    it("should generate different complexity explanations", async () => {
      const docs = createMockDocs();

      const simpleReq = createSimpleRequirements();
      const complexReq = createDAORequirements();

      const simpleResult = await service.generateLuaCode(docs, simpleReq);
      const complexResult = await service.generateLuaCode(docs, complexReq);

      expect(simpleResult.explanation).toContain("simple");
      expect(complexResult.explanation).toContain("complex");
      expect(simpleResult.explanation.length).toBeLessThan(
        complexResult.explanation.length,
      );
    });

    it("should include validation in token transfer handlers", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.generatedCode).toContain("tonumber");
      expect(result.generatedCode).toContain("qty <= 0");
      expect(result.generatedCode).toContain("Insufficient balance");
      expect(result.generatedCode).toContain("Invalid quantity");
    });

    it("should generate valid Lua syntax", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      // Basic Lua syntax checks
      expect(result.generatedCode).toContain("function(msg)");
      expect(result.generatedCode).toContain("end");
      expect(result.generatedCode).not.toContain("{{");
      expect(result.generatedCode).not.toContain("}}");

      // Should have balanced parentheses for basic validation
      const openParens = (result.generatedCode.match(/\(/g) || []).length;
      const closeParens = (result.generatedCode.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });

    it("should include pattern descriptions in handler patterns", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      for (const pattern of result.handlerPatterns) {
        expect(pattern.name).toBeDefined();
        expect(pattern.description).toBeDefined();
        expect(pattern.usedPatterns).toBeDefined();
        expect(pattern.usedPatterns.length).toBeGreaterThan(0);
      }
    });

    it("should handle mixed pattern requirements", async () => {
      const docs = createMockDocs();
      const requirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: [
          "token-contract",
          "dao-governance",
          "message-routing",
          "handler",
        ],
        extractedKeywords: ["token", "dao", "message", "routing"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token DAO with message routing",
      };

      const result = await service.generateLuaCode(docs, requirements);

      expect(result.handlerPatterns.length).toBeGreaterThan(2);
      expect(result.generatedCode).toContain("balance");
      expect(result.generatedCode).toContain("proposal");
      expect(result.usedTemplates.length).toBeGreaterThan(2);
    });
  });
});
