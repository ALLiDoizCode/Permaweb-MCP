import { beforeEach, describe, expect, it } from "vitest";

import { RequirementAnalysisService } from "../../../src/services/RequirementAnalysisService.js";

describe("RequirementAnalysisService", () => {
  let service: RequirementAnalysisService;

  beforeEach(() => {
    service = new RequirementAnalysisService();
  });

  describe("analyzeRequirements", () => {
    it("should analyze simple handler request", async () => {
      const userRequest = "Create a simple ping handler";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.userRequest).toBe(userRequest);
      expect(result.detectedPatterns).toContain("handler");
      expect(result.complexity).toBe("simple");
      expect(result.processType).toBe("stateless");
      expect(result.suggestedDomains).toContain("ao");
      expect(result.extractedKeywords).toContain("ping");
      expect(result.extractedKeywords).toContain("handler");
    });

    it("should analyze token contract request", async () => {
      const userRequest =
        "I want to create a token contract with balance and transfer functionality";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns).toContain("token-contract");
      expect(result.detectedPatterns).toContain("handler");
      expect(result.complexity).toBe("complex");
      expect(result.processType).toBe("stateful");
      expect(result.suggestedDomains).toContain("ao");
      expect(result.extractedKeywords).toContain("token");
      expect(result.extractedKeywords).toContain("balance");
      expect(result.extractedKeywords).toContain("transfer");
    });

    it("should analyze DAO governance request", async () => {
      const userRequest =
        "Build a complex DAO governance system with voting and proposals";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns).toContain("dao-governance");
      expect(result.complexity).toBe("complex");
      expect(result.processType).toBe("stateful");
      expect(result.suggestedDomains).toContain("ao");
      expect(result.extractedKeywords).toContain("governance");
      expect(result.extractedKeywords).toContain("voting");
      expect(result.extractedKeywords).toContain("proposals");
    });

    it("should analyze message routing request", async () => {
      const userRequest = "Create message routing between processes";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns).toContain("message-routing");
      expect(result.detectedPatterns).toContain("process-communication");
      expect(result.processType).toBe("stateless");
      expect(result.suggestedDomains).toContain("ao");
    });

    it("should suggest permaweb-glossary for definitional queries", async () => {
      const userRequest = "What is a handler in AO?";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.suggestedDomains).toContain("permaweb-glossary");
      expect(result.extractedKeywords).toContain("handler");
    });

    it("should handle state management requests", async () => {
      const userRequest = "I need to store and persist data in my process";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns).toContain("state-management");
      expect(result.processType).toBe("stateful");
      expect(result.extractedKeywords).toContain("store");
      expect(result.extractedKeywords).toContain("persist");
      expect(result.extractedKeywords).toContain("data");
    });

    it("should assess complexity based on indicators", async () => {
      const simpleRequest = "Create a basic ping handler";
      const simpleResult = await service.analyzeRequirements(simpleRequest);
      expect(simpleResult.complexity).toBe("simple");

      const moderateRequest = "Build a token with transfer functionality";
      const moderateResult = await service.analyzeRequirements(moderateRequest);
      expect(moderateResult.complexity).toBe("complex");

      const complexRequest = "Create an advanced enterprise DAO system";
      const complexResult = await service.analyzeRequirements(complexRequest);
      expect(complexResult.complexity).toBe("complex");
    });

    it("should extract relevant technical keywords", async () => {
      const userRequest =
        "Create an AO process with handlers and state management";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.extractedKeywords).toContain("process");
      expect(result.extractedKeywords).toContain("handlers");
      expect(result.extractedKeywords).toContain("state");
      expect(result.extractedKeywords).toContain("management");
    });

    it("should suggest multiple relevant domains", async () => {
      const userRequest = "How do I deploy a gateway on ar.io?";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.suggestedDomains).toContain("ario");
      expect(result.suggestedDomains.length).toBeGreaterThan(0);
      expect(result.suggestedDomains.length).toBeLessThanOrEqual(3);
    });

    it("should handle empty or minimal requests", async () => {
      const userRequest = "help";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.userRequest).toBe(userRequest);
      expect(result.extractedKeywords).toBeDefined();
      expect(result.detectedPatterns).toBeDefined();
      expect(result.suggestedDomains).toBeDefined();
      expect(result.complexity).toBeDefined();
      expect(result.processType).toBeDefined();
    });

    it("should detect multiple patterns in complex requests", async () => {
      const userRequest =
        "Create a token DAO with handlers for voting and message routing";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns.length).toBeGreaterThan(1);
      expect(result.detectedPatterns).toContain("token-contract");
      expect(result.detectedPatterns).toContain("dao-governance");
      expect(result.detectedPatterns).toContain("handler");
      expect(result.detectedPatterns).toContain("message-routing");
    });

    it("should handle case insensitive analysis", async () => {
      const userRequest = "CREATE A TOKEN HANDLER WITH BALANCE FUNCTIONALITY";
      const result = await service.analyzeRequirements(userRequest);

      expect(result.detectedPatterns).toContain("token-contract");
      expect(result.detectedPatterns).toContain("handler");
      expect(result.extractedKeywords).toContain("token");
      expect(result.extractedKeywords).toContain("balance");
    });

    it("should return consistent results for similar requests", async () => {
      const request1 = "Create a token contract";
      const request2 = "Build a token contract";

      const result1 = await service.analyzeRequirements(request1);
      const result2 = await service.analyzeRequirements(request2);

      expect(result1.detectedPatterns).toEqual(result2.detectedPatterns);
      expect(result1.complexity).toBe(result2.complexity);
      expect(result1.processType).toBe(result2.processType);
    });
  });
});
