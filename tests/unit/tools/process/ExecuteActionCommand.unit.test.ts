import { JWKInterface } from "arweave/node/lib/wallet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processCommunicationService } from "../../../../src/services/ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "../../../../src/services/TokenProcessTemplateService.js";
import { ToolContext } from "../../../../src/tools/core/ToolCommand.js";
import { ExecuteActionCommand } from "../../../../src/tools/process/commands/ExecuteActionCommand.js";

// Mock the dependencies
vi.mock("../../../../src/services/ProcessCommunicationService.js", () => ({
  processCommunicationService: {
    executeSmartRequest: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DefaultProcessService.js", () => ({
  defaultProcessService: {
    getDefaultProcess: vi.fn(),
  },
}));

describe("ExecuteActionCommand", () => {
  let command: ExecuteActionCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = { kty: "RSA" } as JWKInterface;
    mockContext = {
      hubId: "test-hub-id",
      keyPair: mockKeyPair,
      publicKey: "test-public-key",
    };

    command = new ExecuteActionCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();
      expect(metadata.name).toBe("executeAction");
      expect(metadata.title).toBe("Execute Action");
      expect(metadata.description).toContain("Send messages to AO processes");
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.readOnlyHint).toBe(false);
    });
  });

  describe("parameter validation", () => {
    it("should validate required parameters", () => {
      const schema = command.getParametersSchema();

      // Valid parameters
      expect(() =>
        schema.parse({
          processId: "a".repeat(43),
          request: "Check my balance",
        }),
      ).not.toThrow();

      // Invalid processId
      expect(() =>
        schema.parse({
          processId: "invalid-process-id",
          request: "Check my balance",
        }),
      ).toThrow();

      // Missing request
      expect(() =>
        schema.parse({
          processId: "a".repeat(43),
        }),
      ).toThrow();
    });
  });

  describe("execute", () => {
    it("should execute request without processType", async () => {
      const mockResponse = {
        data: { balance: "1000" },
        handlerUsed: "Balance",
        success: true,
      };

      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockResponse);

      const result = await command.execute({
        processId: "a".repeat(43),
        request: "Check my balance",
      });

      expect(
        processCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "a".repeat(43),
        "Check my balance",
        mockKeyPair,
        undefined,
        undefined,
      );

      expect(JSON.parse(result)).toEqual(
        expect.objectContaining({
          approach: "legacy", // New field from refactored architecture
          data: mockResponse.data,
          handlerUsed: mockResponse.handlerUsed,
          success: mockResponse.success,
        }),
      );
    });

    it("should execute request with token processType", async () => {
      const mockResponse = {
        data: { balance: "1000" },
        handlerUsed: "Balance",
        success: true,
      };

      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockResponse);

      const result = await command.execute({
        processId: "a".repeat(43),
        processType: "token",
        request: "Check my balance",
      });

      expect(
        processCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "a".repeat(43),
        "Check my balance",
        mockKeyPair,
        expect.stringContaining("# AO Token Process"),
        undefined,
      );

      expect(JSON.parse(result)).toEqual(
        expect.objectContaining({
          approach: "legacy", // New field from refactored architecture
          data: mockResponse.data,
          handlerUsed: mockResponse.handlerUsed,
          success: mockResponse.success,
        }),
      );
    });

    it("should handle token transfer requests", async () => {
      const mockResponse = {
        data: { message: "Transfer successful" },
        handlerUsed: "Transfer",
        success: true,
      };

      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockResponse);

      const result = await command.execute({
        processId: "a".repeat(43),
        processType: "token",
        request: "Send 100 tokens to alice",
      });

      expect(
        processCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "a".repeat(43),
        "Send 100 tokens to alice",
        mockKeyPair,
        expect.stringContaining("# AO Token Process"),
        undefined,
      );

      expect(JSON.parse(result)).toEqual(
        expect.objectContaining({
          approach: "legacy", // New field from refactored architecture
          data: mockResponse.data,
          handlerUsed: mockResponse.handlerUsed,
          success: mockResponse.success,
        }),
      );
    });

    it("should handle token info requests", async () => {
      const mockResponse = {
        data: {
          name: "Test Token",
          ticker: "TEST",
          totalSupply: "1000000",
        },
        handlerUsed: "Info",
        success: true,
      };

      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockResponse);

      const result = await command.execute({
        processId: "a".repeat(43),
        processType: "token",
        request: "Get token info",
      });

      expect(
        processCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "a".repeat(43),
        "Get token info",
        mockKeyPair,
        expect.stringContaining("# AO Token Process"),
        undefined,
      );

      expect(JSON.parse(result)).toEqual(
        expect.objectContaining({
          approach: "legacy", // New field from refactored architecture
          data: mockResponse.data,
          handlerUsed: mockResponse.handlerUsed,
          success: mockResponse.success,
        }),
      );
    });

    it("should handle errors gracefully", async () => {
      const mockError = new Error("Process communication failed");

      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockRejectedValue(mockError);

      const result = await command.execute({
        processId: "a".repeat(43),
        request: "Check my balance",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Process communication failed");
    });

    it("should handle unknown errors", async () => {
      vi.mocked(
        processCommunicationService.executeSmartRequest,
      ).mockRejectedValue("Unknown error");

      const result = await command.execute({
        processId: "a".repeat(43),
        request: "Check my balance",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Unknown error");
    });
  });

  describe("TokenProcessTemplateService integration", () => {
    it("should use embedded token template for supported process types", () => {
      expect(TokenProcessTemplateService.isSupported("token")).toBe(true);
      expect(TokenProcessTemplateService.isSupported("TOKEN")).toBe(true);
      expect(TokenProcessTemplateService.isSupported("nft")).toBe(false);
    });

    it("should generate correct markdown for token template", () => {
      const markdown =
        TokenProcessTemplateService.getTokenTemplateAsMarkdown(
          "test-process-id",
        );

      expect(markdown).toContain("# AO Token Process");
      expect(markdown).toContain("## Balance");
      expect(markdown).toContain("## Info");
      expect(markdown).toContain("## Transfer");
      expect(markdown).toContain("## Balances");
    });

    it("should populate processId in template", () => {
      const template =
        TokenProcessTemplateService.getTokenTemplate("test-process-id");
      expect(template.processId).toBe("test-process-id");
      expect(template.name).toBe("AO Token Process");
    });
  });
});
