import { describe, expect, it } from "vitest";

import { TokenProcessTemplateService } from "../../../src/services/TokenProcessTemplateService.js";

describe("TokenProcessTemplateService", () => {
  describe("isSupported", () => {
    it("should return true for 'token' process type", () => {
      expect(TokenProcessTemplateService.isSupported("token")).toBe(true);
    });

    it("should return true for 'TOKEN' process type (case insensitive)", () => {
      expect(TokenProcessTemplateService.isSupported("TOKEN")).toBe(true);
    });

    it("should return false for unsupported process types", () => {
      expect(TokenProcessTemplateService.isSupported("nft")).toBe(false);
      expect(TokenProcessTemplateService.isSupported("dao")).toBe(false);
      expect(TokenProcessTemplateService.isSupported("unknown")).toBe(false);
    });
  });

  describe("getTokenTemplate", () => {
    it("should return a complete ProcessDefinition", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");

      expect(template.processId).toBe("test-process-id");
      expect(template.name).toBe("AO Token Process");
      expect(template.handlers).toHaveLength(5);
    });

    it("should include all required token handlers", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const handlerNames = template.handlers.map((h) => h.action);

      expect(handlerNames).toContain("Balance");
      expect(handlerNames).toContain("Info");
      expect(handlerNames).toContain("Transfer");
      expect(handlerNames).toContain("Balances");
      expect(handlerNames).toContain("SaveMapping");
    });

    it("should correctly configure Balance handler", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const balanceHandler = template.handlers.find(
        (h) => h.action === "Balance",
      );

      expect(balanceHandler).toBeDefined();
      expect(balanceHandler!.isWrite).toBe(false);
      expect(balanceHandler!.parameters).toHaveLength(1);
      expect(balanceHandler!.parameters[0].name).toBe("Target");
      expect(balanceHandler!.parameters[0].required).toBe(false);
    });

    it("should correctly configure Transfer handler", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const transferHandler = template.handlers.find(
        (h) => h.action === "Transfer",
      );

      expect(transferHandler).toBeDefined();
      expect(transferHandler!.isWrite).toBe(true);
      expect(transferHandler!.parameters).toHaveLength(2);

      const recipientParam = transferHandler!.parameters.find(
        (p) => p.name === "Recipient",
      );
      const quantityParam = transferHandler!.parameters.find(
        (p) => p.name === "Quantity",
      );

      expect(recipientParam).toBeDefined();
      expect(recipientParam!.required).toBe(true);
      expect(quantityParam).toBeDefined();
      expect(quantityParam!.required).toBe(true);
    });

    it("should correctly configure Info handler", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const infoHandler = template.handlers.find((h) => h.action === "Info");

      expect(infoHandler).toBeDefined();
      expect(infoHandler!.isWrite).toBe(false);
      expect(infoHandler!.parameters).toHaveLength(0);
    });

    it("should correctly configure Balances handler", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const balancesHandler = template.handlers.find(
        (h) => h.action === "Balances",
      );

      expect(balancesHandler).toBeDefined();
      expect(balancesHandler!.isWrite).toBe(false);
      expect(balancesHandler!.parameters).toHaveLength(0);
    });

    it("should correctly configure SaveMapping handler", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      const saveMappingHandler = template.handlers.find(
        (h) => h.action === "SaveMapping",
      );

      expect(saveMappingHandler).toBeDefined();
      expect(saveMappingHandler!.isWrite).toBe(true);
      expect(saveMappingHandler!.parameters).toHaveLength(3);

      const nameParam = saveMappingHandler!.parameters.find(
        (p) => p.name === "Name",
      );
      const tickerParam = saveMappingHandler!.parameters.find(
        (p) => p.name === "Ticker",
      );
      const processIdParam = saveMappingHandler!.parameters.find(
        (p) => p.name === "ProcessId",
      );

      expect(nameParam).toBeDefined();
      expect(nameParam!.required).toBe(true);
      expect(tickerParam).toBeDefined();
      expect(tickerParam!.required).toBe(true);
      expect(processIdParam).toBeDefined();
      expect(processIdParam!.required).toBe(true);
    });
  });

  describe("getTokenTemplateAsMarkdown", () => {
    it("should generate valid markdown structure", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      expect(markdown).toContain("# AO Token Process");
      expect(markdown).toContain("## Balance");
      expect(markdown).toContain("## Info");
      expect(markdown).toContain("## Transfer");
      expect(markdown).toContain("## Balances");
      expect(markdown).toContain("## SaveMapping");
    });

    it("should include handler descriptions", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      expect(markdown).toContain("Check token balance for an account");
      expect(markdown).toContain(
        "Get token information including name, ticker, and supply",
      );
      expect(markdown).toContain("Send tokens to another account");
      expect(markdown).toContain("List all token balances");
      expect(markdown).toContain(
        "Save a token name/ticker to process ID mapping for future use",
      );
    });

    it("should include parameter definitions", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      expect(markdown).toContain(
        "- Target: Account address to check balance for (optional, defaults to sender) (optional)",
      );
      expect(markdown).toContain(
        "- Recipient: Address to send tokens to (required) (required)",
      );
      expect(markdown).toContain(
        "- Quantity: Amount of tokens to send (required) (required)",
      );
    });

    it("should include examples", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      expect(markdown).toContain("Examples:");
      expect(markdown).toContain("- Check my balance");
      expect(markdown).toContain("- Send 100 tokens to alice");
      expect(markdown).toContain("- Get token info");
      expect(markdown).toContain("- List all balances");
    });

    it("should handle handlers with no parameters", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      // Info handler should not have parameter section
      const infoSection = markdown.substring(
        markdown.indexOf("## Info"),
        markdown.indexOf("## Transfer"),
      );

      expect(infoSection).toContain("Get token information");
      expect(infoSection).toContain("Examples:");
      expect(infoSection).not.toContain("- Target:");
      expect(infoSection).not.toContain("- Recipient:");
    });

    it("should maintain consistent format across all handlers", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      // Each handler should have a level 2 heading
      const level2Headers = markdown.match(/## \w+/g);
      expect(level2Headers).toHaveLength(5);

      // Each handler should have examples
      const exampleSections = markdown.match(/Examples:/g);
      expect(exampleSections).toHaveLength(5);
    });
  });
});
