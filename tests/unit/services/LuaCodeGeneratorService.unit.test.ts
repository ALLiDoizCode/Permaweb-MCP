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

    it("should include ADP-compliant info handler", async () => {
      const docs = createMockDocs();
      const requirements = createSimpleRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      // Check for ADP v1.0 compliance
      expect(result.generatedCode).toContain("Info");
      expect(result.generatedCode).toContain('protocolVersion": "1.0"');
      expect(result.generatedCode).toContain("ProcessId");
      expect(result.generatedCode).toContain("handlers");
      expect(result.generatedCode).toContain("capabilities");
      expect(result.generatedCode).toContain("supportsHandlerRegistry");
      expect(result.generatedCode).toContain("json.encode(infoResponse)");
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

    it("should include required imports at the top of generated code", async () => {
      const docs = createMockDocs();
      const requirements = createSimpleRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      // Check that json import is at the very beginning
      expect(result.generatedCode).toContain('local json = require("json")');

      // Verify that the import comes before any handlers
      const jsonImportIndex = result.generatedCode.indexOf(
        'local json = require("json")',
      );
      const firstHandlerIndex = result.generatedCode.indexOf("Handlers.add");

      expect(jsonImportIndex).toBeGreaterThan(-1);
      expect(firstHandlerIndex).toBeGreaterThan(-1);
      expect(jsonImportIndex).toBeLessThan(firstHandlerIndex);
    });

    it("should include json import for token contracts that use json.encode", async () => {
      const docs = createMockDocs();
      const requirements = createTokenRequirements();

      const result = await service.generateLuaCode(docs, requirements);

      // Should include json import since ADP handler uses json.encode
      expect(result.generatedCode).toContain('local json = require("json")');

      // Should also use json.encode in the code
      expect(result.generatedCode).toContain("json.encode");

      // Import should be at the top
      const lines = result.generatedCode.split("\n");
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
      expect(nonEmptyLines[0]).toContain('local json = require("json")');
    });

    it("should include json import for DAO contracts", async () => {
      const docs = createMockDocs();
      const requirements = createDAORequirements();

      const result = await service.generateLuaCode(docs, requirements);

      // Should include json import since ADP handler always uses json.encode
      expect(result.generatedCode).toContain('local json = require("json")');
      expect(result.generatedCode).toContain("json.encode");

      // Verify positioning at the top
      const jsonImportIndex = result.generatedCode.indexOf(
        'local json = require("json")',
      );
      expect(jsonImportIndex).toBeLessThan(100); // Should be very early in the file
    });

    it("should not have duplicate imports when multiple patterns use json", async () => {
      const docs = createMockDocs();
      const requirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["token-contract", "dao-governance", "handler"],
        extractedKeywords: ["token", "dao", "json"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a complex system with multiple json usage",
      };

      const result = await service.generateLuaCode(docs, requirements);

      // Count occurrences of json import
      const matches = result.generatedCode.match(
        /local json = require\("json"\)/g,
      );
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1); // Should only appear once
    });
  });
});
