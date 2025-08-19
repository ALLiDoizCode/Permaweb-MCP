import { beforeEach, describe, expect, it, vi } from "vitest";

import { aoMessageService } from "../../../../src/services/AOMessageService.js";
import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
} from "../../../../src/services/DocumentationProtocolService.js";
import { ExecuteActionCommand } from "../../../../src/tools/process/commands/ExecuteActionCommand.js";

// Mock dependencies
vi.mock("../../../../src/services/AOMessageService.js", () => ({
  aoMessageService: {
    executeMessage: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DocumentationProtocolService.js", () => ({
  DocumentationProtocolService: {
    generateMessageTags: vi.fn(),
    parseInfoResponse: vi.fn(),
    validateParameters: vi.fn(),
  },
  ExtendedInfoResponse: {},
  HandlerMetadata: {},
}));

vi.mock("../../../../src/services/ProcessCacheService.js", () => ({
  ProcessCacheService: {
    getProcessInfo: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ProcessCommunicationService.js", () => ({
  processCommunicationService: {
    executeSmartRequest: vi.fn(),
  },
}));

vi.mock("../../../../src/tools/core/index.js", async () => {
  const actual = (await vi.importActual(
    "../../../../src/tools/core/index.js",
  )) as any;
  return {
    ...actual,
    AutoSafeToolContext: {
      from: vi.fn(() => ({
        getKeyPair: vi.fn().mockResolvedValue({ mock: "keypair" }),
      })),
    },
  };
});

describe("ExecuteActionCommand ADP Integration", () => {
  let command: ExecuteActionCommand;
  let mockContext: any;
  let mockKeyPair: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = { mock: "keypair" };
    mockContext = {
      embeddedTemplates: new Map(),
    };

    command = new ExecuteActionCommand(mockContext);

    // Clear ADP cache before each test
    ExecuteActionCommand.clearADPCache();
  });

  describe("ADP Process Discovery", () => {
    it("should discover ADP-compliant process", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Transfer",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address",
              },
              {
                description: "Amount to transfer",
                name: "Quantity",
                required: true,
                type: "string",
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: JSON.stringify(mockAdpResponse) },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([
        { name: "Action", value: "Transfer" },
        { name: "Target", value: "alice" },
        { name: "Quantity", value: "100" },
      ]);

      const result = await command.execute({
        processId: "test-process",
        request: "send 100 tokens to alice",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Transfer");
      expect(
        vi.mocked(DocumentationProtocolService.parseInfoResponse),
      ).toHaveBeenCalled();
    });

    it("should cache ADP responses", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: JSON.stringify(mockAdpResponse) },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );

      // First call should hit the service
      await command.execute({
        processId: "test-process",
        request: "get info",
      });

      expect(vi.mocked(aoMessageService.executeMessage)).toHaveBeenCalledTimes(
        1,
      );

      // Second call should use cache
      await command.execute({
        processId: "test-process",
        request: "get balance",
      });

      // executeMessage should still be called only once (cached)
      expect(vi.mocked(aoMessageService.executeMessage)).toHaveBeenCalledTimes(
        1,
      );
    });

    it("should fallback to legacy for non-ADP processes", async () => {
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: "legacy response" },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        null,
      );

      const result = await command.execute({
        processId: "legacy-process",
        request: "test request",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("legacy");
    });
  });

  describe("ADP Parameter Validation", () => {
    it("should validate parameters using ADP metadata", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Transfer",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address",
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: JSON.stringify(mockAdpResponse) },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: ["Required parameter 'Target' is missing"],
        valid: false,
      });

      const result = await command.execute({
        processId: "test-process",
        request: "transfer tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Parameter validation failed");
    });

    it("should extract parameters from natural language", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Transfer",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address",
              },
              {
                description: "Amount to transfer",
                name: "Quantity",
                required: true,
                type: "string",
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(mockAdpResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: "Transfer successful",
          success: true,
        });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([
        { name: "Action", value: "Transfer" },
        { name: "Target", value: "alice" },
        { name: "Quantity", value: "100" },
      ]);

      const result = await command.execute({
        processId: "test-process",
        request: "send 100 tokens to alice",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.parametersUsed).toEqual({
        Quantity: "100",
        Target: "alice",
      });
    });
  });

  describe("Handler Matching", () => {
    it("should match handlers by action name", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            pattern: ["Action"],
          },
          {
            action: "Transfer",
            description: "Transfer tokens",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(mockAdpResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: "Balance: 1000",
          success: true,
        });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([{ name: "Action", value: "Balance" }]);

      const result = await command.execute({
        processId: "test-process",
        request: "check balance",
      });

      const parsed = JSON.parse(result);
      expect(parsed.handlerUsed).toBe("Balance");
      expect(parsed.confidence).toBeGreaterThan(0);
    });

    it("should match handlers by synonyms", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Transfer",
            description: "Transfer tokens to another address",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(mockAdpResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: "Transfer successful",
          success: true,
        });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([{ name: "Action", value: "Transfer" }]);

      const result = await command.execute({
        processId: "test-process",
        request: "send tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.handlerUsed).toBe("Transfer");
    });

    it("should return error when no handler matches", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: JSON.stringify(mockAdpResponse) },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );

      const result = await command.execute({
        processId: "test-process",
        request: "unknown operation",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain(
        "Could not match request to any available ADP handler",
      );
      expect(parsed.availableHandlers).toEqual(["Balance"]);
    });
  });

  describe("Cache Management", () => {
    it("should clear specific process cache", () => {
      ExecuteActionCommand.clearADPCache("test-process");
      const stats = ExecuteActionCommand.getADPCacheStats();
      expect(stats.entries).not.toContain("test-process");
    });

    it("should clear all cache", () => {
      ExecuteActionCommand.clearADPCache();
      const stats = ExecuteActionCommand.getADPCacheStats();
      expect(stats.size).toBe(0);
    });

    it("should return cache statistics", () => {
      const stats = ExecuteActionCommand.getADPCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("entries");
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle ADP discovery errors gracefully", async () => {
      vi.mocked(aoMessageService.executeMessage).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await command.execute({
        processId: "test-process",
        request: "test request",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("legacy");
    });

    it("should handle malformed ADP responses", async () => {
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: "invalid json" },
        success: true,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        null,
      );

      const result = await command.execute({
        processId: "test-process",
        request: "test request",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("legacy");
    });

    it("should handle execution errors in ADP mode", async () => {
      const mockAdpResponse: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Transfer",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(mockAdpResponse) },
          success: true,
        })
        .mockRejectedValueOnce(new Error("Execution failed"));

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockAdpResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([{ name: "Action", value: "Transfer" }]);

      const result = await command.execute({
        processId: "test-process",
        request: "transfer",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("ADP execution failed");
    });
  });
});
