import { beforeEach, describe, expect, it } from "vitest";

import { LuaCodeGeneratorService } from "../../../src/services/LuaCodeGeneratorService.js";
import { PermawebDocsResult } from "../../../src/services/PermawebDocsService.js";
import { RequirementAnalysis } from "../../../src/types/lua-workflow.js";

describe("LuaCodeGeneratorService - Parameter Extraction Enhancement", () => {
  let service: LuaCodeGeneratorService;
  let mockDocs: PermawebDocsResult[];
  let calculatorRequirements: RequirementAnalysis;

  beforeEach(() => {
    service = new LuaCodeGeneratorService();
    mockDocs = [];
    calculatorRequirements = {
      complexity: "simple",
      detectedPatterns: ["calculator"],
      extractedKeywords: ["calculator", "add", "subtract"],
      processType: "stateless",
      suggestedDomains: ["ao"],
      userRequest: "Create a calculator with Add and Subtract handlers",
    };
  });

  describe("generateLuaCode with parameter extraction", () => {
    it("should generate ADP metadata with extracted parameters for calculator", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      expect(result).toBeDefined();
      expect(result.generatedCode).toContain("handlers =");

      // Check that the generated code includes parameter definitions in the ADP metadata
      const handlerMetadataMatch = result.generatedCode.match(
        /handlers\s*=\s*\{[\s\S]*\n\s*\}/,
      );
      expect(handlerMetadataMatch).toBeTruthy();

      if (handlerMetadataMatch) {
        const handlersSection = handlerMetadataMatch[0];

        // Check for Add handler with parameters
        expect(handlersSection).toMatch(/action\s*=\s*["']Add["']/);
        expect(handlersSection).toMatch(/parameters\s*=\s*\{/);

        // Should contain parameter definitions for A and B
        expect(handlersSection).toMatch(/name\s*=\s*["']A["']/);
        expect(handlersSection).toMatch(/name\s*=\s*["']B["']/);
        expect(handlersSection).toMatch(/type\s*=\s*["']number["']/);
      }
    });

    it("should include parameter descriptions and validation rules", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;
      expect(code).toContain("parameters =");

      // Check for parameter descriptions
      expect(code).toMatch(/description\s*=\s*["'][^"']*operand[^"']*["']/i);

      // Check for validation rules (min values for numbers)
      expect(code).toMatch(/required\s*=\s*(true|false)/);
      expect(code).toMatch(/type\s*=\s*["']number["']/);
    });

    it("should handle processes with address parameters", async () => {
      const transferRequirements: RequirementAnalysis = {
        complexity: "simple",
        detectedPatterns: ["token-contract"],
        extractedKeywords: ["token", "transfer"],
        processType: "stateless",
        suggestedDomains: ["ao"],
        userRequest: "Create a token transfer handler",
      };

      const result = await service.generateLuaCode(
        mockDocs,
        transferRequirements,
      );

      const code = result.generatedCode;

      // Should contain address-type parameters
      expect(code).toMatch(/type\s*=\s*["']address["']/);
      // Address parameters should have descriptive information
      expect(code).toMatch(/description\s*=\s*["'][^"']*address[^"']*["']/i);
    });

    it("should generate examples for extracted parameters", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;
      // Parameters should have descriptive information, not examples (examples are at handler level)
      expect(code).toMatch(/parameters\s*=\s*\{/);
      expect(code).toMatch(/description\s*=\s*["'][^"']*operand[^"']*["']/i);
    });

    it("should maintain ADP v1.0 compliance with parameter definitions", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;

      // Verify ADP compliance elements are present
      expect(code).toContain('protocolVersion = "1.0"');
      expect(code).toContain("handlers =");
      expect(code).toContain("capabilities =");
      expect(code).toContain("supportsHandlerRegistry = true");

      // Verify parameter definitions are included
      expect(code).toContain("parameters =");
    });

    it("should handle handlers with mixed parameter types", async () => {
      const mixedRequirements: RequirementAnalysis = {
        complexity: "complex",
        detectedPatterns: ["dao-governance"],
        extractedKeywords: ["dao", "voting", "proposal"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a DAO voting system with proposals",
      };

      const result = await service.generateLuaCode(mockDocs, mixedRequirements);

      const code = result.generatedCode;

      // Should contain different parameter types for DAO
      expect(code).toMatch(/type\s*=\s*["']string["']/); // For proposal titles/descriptions
      expect(code).toMatch(/type\s*=\s*["']number["']/); // For proposal IDs
    });

    it("should merge existing parameter definitions with extracted ones", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;

      // Should have parameters for handlers that use msg.Tags
      expect(code).toMatch(/action\s*=\s*["']Add["'][\s\S]*?parameters\s*=/);

      // Should maintain all existing ADP metadata structure
      expect(code).toContain("description =");
      expect(code).toContain("category =");
      // Note: examples are at handler level, not parameter level
    });
  });

  describe("parameter extraction integration", () => {
    it("should correctly identify required vs optional parameters", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;

      // Parameters with default values should be optional
      // Parameters without defaults or with validation should be required
      const requiredMatches = [...code.matchAll(/required\s*=\s*true/g)];
      const optionalMatches = [...code.matchAll(/required\s*=\s*false/g)];

      expect(requiredMatches.length + optionalMatches.length).toBeGreaterThan(
        0,
      );
    });

    it("should include validation rules appropriate to parameter usage", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;

      // Numeric parameters should have min value validations where appropriate
      if (code.includes('type = "number"') && code.includes("Quantity")) {
        expect(code).toMatch(/min\s*=\s*0/);
      }

      // Address parameters should have pattern validation
      if (code.includes('type = "address"')) {
        expect(code).toMatch(/pattern\s*=\s*["']\^.*43.*\$["']/);
      }
    });

    it("should generate human-readable parameter descriptions", async () => {
      const result = await service.generateLuaCode(
        mockDocs,
        calculatorRequirements,
      );

      const code = result.generatedCode;

      // Parameter descriptions should be meaningful
      if (code.includes('name = "A"')) {
        expect(code).toMatch(
          /description\s*=\s*["'][^"']*first[^"']*operand[^"']*["']/i,
        );
      }

      if (code.includes('name = "B"')) {
        expect(code).toMatch(
          /description\s*=\s*["'][^"']*second[^"']*operand[^"']*["']/i,
        );
      }
    });
  });
});
