import { beforeEach, describe, expect, it } from "vitest";

import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

describe("RequirementAnalysisService - Functional Patterns", () => {
  let service: RequirementAnalysisService;

  beforeEach(() => {
    service = new RequirementAnalysisService();
  });

  describe("Calculator Pattern Detection", () => {
    it("should detect calculator pattern for addition requests", async () => {
      const result = await service.analyzeRequirements(
        "Create a calculator with addition",
      );

      expect(result.detectedPatterns).toContain("calculator");
      expect(result.detectedPatterns).toContain("handler");
      expect(result.complexity).toBe("moderate");
    });

    it("should detect calculator pattern for mathematical operations", async () => {
      const result = await service.analyzeRequirements(
        "I need to compute sum and difference",
      );

      expect(result.detectedPatterns).toContain("calculator");
      expect(result.extractedKeywords).toContain("compute");
    });

    it("should detect calculator pattern for arithmetic keywords", async () => {
      const result = await service.analyzeRequirements(
        "Build arithmetic operations multiply and divide",
      );

      expect(result.detectedPatterns).toContain("calculator");
      expect(result.extractedKeywords).toContain("multiply");
      expect(result.extractedKeywords).toContain("divide");
    });
  });

  describe("Counter Pattern Detection", () => {
    it("should detect counter pattern for counting requests", async () => {
      const result = await service.analyzeRequirements(
        "Create a counter that can increment and decrement",
      );

      expect(result.detectedPatterns).toContain("counter");
      expect(result.extractedKeywords).toContain("counter");
      expect(result.complexity).toBe("simple");
    });

    it("should detect counter pattern for tracking values", async () => {
      const result = await service.analyzeRequirements(
        "I need to track current value and reset counter",
      );

      expect(result.detectedPatterns).toContain("counter");
      expect(result.extractedKeywords).toContain("current");
      expect(result.extractedKeywords).toContain("reset");
    });
  });

  describe("Database Pattern Detection", () => {
    it("should detect database pattern for CRUD operations", async () => {
      const result = await service.analyzeRequirements(
        "Build a database to store and retrieve records",
      );

      expect(result.detectedPatterns).toContain("database");
      expect(result.detectedPatterns).toContain("state-management");
      expect(result.complexity).toBe("moderate");
    });

    it("should detect database pattern for key-value operations", async () => {
      const result = await service.analyzeRequirements(
        "Need to set, get, update and delete key-value pairs",
      );

      expect(result.detectedPatterns).toContain("database");
      expect(result.extractedKeywords).toContain("get");
      expect(result.extractedKeywords).toContain("set");
      expect(result.extractedKeywords).toContain("update");
      expect(result.extractedKeywords).toContain("delete");
    });
  });

  describe("Computation Pattern Detection", () => {
    it("should detect computation pattern for formula evaluation", async () => {
      const result = await service.analyzeRequirements(
        "Create a process to evaluate mathematical formulas",
      );

      expect(result.detectedPatterns).toContain("computation");
      expect(result.detectedPatterns).toContain("calculator");
      expect(result.complexity).toBe("complex");
    });

    it("should detect computation pattern for algorithmic processing", async () => {
      const result = await service.analyzeRequirements(
        "Build an algorithm to process and transform data",
      );

      expect(result.detectedPatterns).toContain("computation");
      expect(result.extractedKeywords).toContain("algorithm");
      expect(result.extractedKeywords).toContain("process");
      expect(result.extractedKeywords).toContain("transform");
    });
  });

  describe("Complex Functional Pattern Combinations", () => {
    it("should detect multiple functional patterns", async () => {
      const result = await service.analyzeRequirements(
        "Calculator with counter and database storage",
      );

      expect(result.detectedPatterns).toContain("calculator");
      expect(result.detectedPatterns).toContain("counter");
      expect(result.detectedPatterns).toContain("database");
      expect(result.complexity).toBe("complex");
    });

    it("should prioritize functional patterns over generic handler", async () => {
      const result = await service.analyzeRequirements(
        "Add handler for mathematical operations",
      );

      expect(result.detectedPatterns).toContain("calculator");
      expect(result.detectedPatterns).toContain("handler");
      expect(result.extractedKeywords).toContain("add");
    });
  });

  describe("Complexity Assessment for Functional Patterns", () => {
    it("should classify simple functional patterns correctly", async () => {
      const result = await service.analyzeRequirements(
        "Simple counter to add and subtract",
      );

      expect(result.complexity).toBe("simple");
      expect(result.detectedPatterns).toContain("counter");
      expect(result.detectedPatterns).toContain("calculator");
    });

    it("should classify moderate functional patterns correctly", async () => {
      const result = await service.analyzeRequirements(
        "Calculator with database storage",
      );

      expect(result.complexity).toBe("complex");
      expect(result.detectedPatterns).toContain("calculator");
      expect(result.detectedPatterns).toContain("database");
    });

    it("should classify complex functional patterns correctly", async () => {
      const result = await service.analyzeRequirements(
        "Complex algorithm with formula evaluation",
      );

      expect(result.complexity).toBe("complex");
      expect(result.detectedPatterns).toContain("computation");
    });
  });
});
