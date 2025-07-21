import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { describe, expect, it, vi } from "vitest";

import type { ProcessDefinition } from "../../../src/services/ProcessCommunicationService.js";

import { processCommunicationService } from "../../../src/services/ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "../../../src/services/TokenProcessTemplateService.js";

// Mock dependencies
vi.mock("../../../src/services/AOMessageService.js", () => ({
  aoMessageService: {
    executeMessage: vi.fn(),
  },
}));

vi.mock("../../../src/services/DefaultProcessService.js", () => ({
  defaultProcessService: {
    canHandleRequest: vi.fn().mockReturnValue(false),
    getSuggestedOperations: vi
      .fn()
      .mockReturnValue(["Check balance", "Transfer tokens", "Get token info"]),
    processNaturalLanguage: vi.fn().mockReturnValue(null),
  },
}));

describe("Embedded Template System Integration", () => {
  const mockSigner = { kty: "RSA" } as JWKInterface;
  const mockProcessId = "a".repeat(43);

  describe("TokenProcessTemplateService", () => {
    it("should provide token template with correct structure", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate(mockProcessId);

      expect(template).toEqual({
        handlers: expect.arrayContaining([
          expect.objectContaining({
            action: "Balance",
            description: "Check token balance for an account",
            isWrite: false,
            parameters: expect.arrayContaining([
              expect.objectContaining({
                name: "Target",
                required: false,
                type: "string",
              }),
            ]),
          }),
          expect.objectContaining({
            action: "Transfer",
            description: "Send tokens to another account",
            isWrite: true,
            parameters: expect.arrayContaining([
              expect.objectContaining({
                name: "Recipient",
                required: true,
                type: "string",
              }),
              expect.objectContaining({
                name: "Quantity",
                required: true,
                type: "string",
              }),
            ]),
          }),
        ]),
        name: "AO Token Process",
        processId: mockProcessId,
      });
    });

    it("should extract token operations from natural language", () => {
      const transferResult = TokenProcessTemplateService.extractTokenOperation(
        "Send 100 tokens to alice",
      );

      expect(transferResult).toEqual({
        confidence: 0.9,
        operation: "transfer",
        parameters: {
          amount: 100,
          recipient: "alice",
        },
      });

      const balanceResult =
        TokenProcessTemplateService.extractTokenOperation("Check my balance");

      expect(balanceResult).toEqual({
        confidence: 0.85,
        operation: "balance",
        parameters: {},
      });
    });

    it("should process token requests with template integration", () => {
      const result = TokenProcessTemplateService.processTokenRequest(
        "Send 50 tokens to bob",
        mockProcessId,
      );

      expect(result).toEqual({
        confidence: 0.9,
        operation: "transfer",
        parameters: {
          amount: 50,
          recipient: "bob",
        },
        processType: "token",
        template: expect.objectContaining({
          name: "AO Token Process",
          processId: mockProcessId,
        }),
      });
    });

    it("should return null for non-token requests", () => {
      const result = TokenProcessTemplateService.extractTokenOperation(
        "Deploy a smart contract",
      );

      expect(result).toBeNull();
    });
  });

  describe("ProcessCommunicationService with Embedded Templates", () => {
    it("should prioritize embedded templates over default processing", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock successful AO message execution
      const mockAOResponse = {
        data: {
          Data: JSON.stringify({
            Account: "test-account",
            Balance: "1000",
          }),
        },
        success: true,
      };

      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue(
        mockAOResponse,
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "Check my balance",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      expect(result).toEqual({
        confidence: 0.85,
        data: {
          Account: "test-account",
          Balance: "1000",
        },
        handlerUsed: "Balance",
        processType: "token",
        success: true,
        suggestions: ["Check balance", "Transfer tokens", "Get token info"],
        templateUsed: "embedded-nls",
      });
    });

    it("should handle transfer operations with embedded templates", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock successful transfer response
      const mockAOResponse = {
        data: {
          Data: JSON.stringify({
            message: "Transfer successful",
          }),
        },
        success: true,
      };

      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue(
        mockAOResponse,
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "Send 100 tokens to alice",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      expect(result).toEqual({
        confidence: 0.9,
        data: {
          message: "Transfer successful",
        },
        handlerUsed: "Transfer",
        processType: "token",
        success: true,
        suggestions: ["Check balance", "Transfer tokens", "Get token info"],
        templateUsed: "embedded-nls",
      });

      // Verify the AO message was built correctly with mapped parameters
      expect(aoMessageService.executeMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          processId: mockProcessId,
          tags: expect.arrayContaining([
            { name: "Action", value: "Transfer" },
            { name: "Recipient", value: "alice" },
            { name: "Quantity", value: "100" },
          ]),
        }),
      );
    });

    it("should handle requests that don't match NLS patterns", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "this is not a token operation", // Should not match any patterns
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      expect(result).toEqual({
        error:
          "Could not process request. Please provide process documentation using processMarkdown parameter.",
        success: false,
      });
    });

    it("should handle requests without embedded templates", async () => {
      // Mock the defaultProcessService to return null
      const { defaultProcessService } = await import(
        "../../../src/services/DefaultProcessService.js"
      );
      vi.mocked(defaultProcessService.getSuggestedOperations).mockReturnValue(
        [],
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "unknown operation",
        mockSigner,
        undefined,
        undefined, // No embedded templates
      );

      expect(result).toEqual({
        error:
          "Could not process request. Please provide process documentation using processMarkdown parameter.",
        success: false,
      });
    });
  });

  describe("Parameter Mapping", () => {
    it("should map NLS parameters to handler parameters correctly", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock successful response
      const mockAOResponse = {
        data: { message: "Success" },
        success: true,
      };

      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue(
        mockAOResponse,
      );

      await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "Send 250 tokens to charlie",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      // Verify parameters were mapped correctly
      // NLS: { recipient: "charlie", amount: 250 }
      // Handler: { Recipient: "charlie", Quantity: "250" }
      expect(aoMessageService.executeMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          tags: expect.arrayContaining([
            { name: "Action", value: "Transfer" },
            { name: "Recipient", value: "charlie" },
            { name: "Quantity", value: "250" },
          ]),
        }),
      );
    });

    it("should handle balance operations with optional parameters", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock successful response
      const mockAOResponse = {
        data: { Balance: "500" },
        success: true,
      };

      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue(
        mockAOResponse,
      );

      await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "balance for dave",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      // Verify parameters were mapped correctly
      // NLS: { account: "dave" }
      // Handler: { Target: "dave" }
      expect(aoMessageService.executeMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          tags: expect.arrayContaining([
            { name: "Action", value: "Balance" },
            { name: "Target", value: "dave" },
          ]),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle AO message execution errors gracefully", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock AO message failure
      const mockAOResponse = {
        error: "Process execution failed",
        success: false,
      };

      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue(
        mockAOResponse,
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "Send 100 tokens to alice",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      expect(result).toEqual({
        confidence: 0.9,
        error: "Process execution failed",
        handlerUsed: "Transfer",
        processType: "token",
        success: false,
        suggestions: [],
        templateUsed: "embedded-nls",
      });
    });

    it("should handle exceptions during processing", async () => {
      // Create embedded templates map
      const embeddedTemplates = new Map<string, ProcessDefinition>();
      embeddedTemplates.set(
        "token",
        TokenProcessTemplateService.getTokenTemplate(mockProcessId),
      );

      // Mock AO message exception
      const { aoMessageService } = await import(
        "../../../src/services/AOMessageService.js"
      );
      vi.mocked(aoMessageService.executeMessage).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await processCommunicationService.executeSmartRequest(
        mockProcessId,
        "Send 100 tokens to alice",
        mockSigner,
        undefined,
        embeddedTemplates,
      );

      expect(result).toEqual({
        error: "Network error",
        success: false,
      });
    });
  });
});
