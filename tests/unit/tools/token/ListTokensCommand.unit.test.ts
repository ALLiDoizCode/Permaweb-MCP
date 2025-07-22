import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { ListTokensCommand } from "../../../../src/tools/token/commands/ListTokensCommand.js";

// Mock dependencies
vi.mock("../../../../src/relay.js", () => ({
  fetchEvents: vi.fn(),
}));

vi.mock("../../../../src/services/aiMemoryService.js", () => ({
  MEMORY_KINDS: {
    TOKEN_MAPPING: "token-mapping",
  },
}));

describe("ListTokensCommand", () => {
  let command: ListTokensCommand;
  let mockContext: ToolContext;
  let mockFetchEvents: any;  

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as any,  
      publicKey: "test-public-key",
    };

    command = new ListTokensCommand(mockContext);

    // Get mocked functions
    mockFetchEvents = (await import("../../../../src/relay.js")).fetchEvents;
  });

  describe("execute", () => {
    it("should list all token mappings successfully", async () => {
      const mockTokenMappings = [
        {
          content: "USDC",
          id: "token-1",
          processId: "process-usdc-123",
          ticker: "USDC",
        },
        {
          content: "WBTC",
          id: "token-2",
          processId: "process-wbtc-456",
          ticker: "WBTC",
        },
        {
          content: "MyToken",
          id: "token-3",
          processId: "process-mytoken-789",
          ticker: "MTK",
        },
      ];

      mockFetchEvents.mockResolvedValue(mockTokenMappings);

      const result = await command.execute({});

      const parsed = JSON.parse(result);
      expect(parsed).toEqual(mockTokenMappings);
      expect(mockFetchEvents).toHaveBeenCalledWith(
        "test-hub-id",
        JSON.stringify([{ kinds: ["token-mapping"] }]),
      );
    });

    it("should handle empty token registry", async () => {
      mockFetchEvents.mockResolvedValue([]);

      const result = await command.execute({});

      const parsed = JSON.parse(result);
      expect(parsed).toEqual([]);
      expect(mockFetchEvents).toHaveBeenCalledWith(
        "test-hub-id",
        JSON.stringify([{ kinds: ["token-mapping"] }]),
      );
    });

    it("should handle fetchEvents error", async () => {
      mockFetchEvents.mockRejectedValue(new Error("Network error"));

      const result = await command.execute({});

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Failed to list tokens: Network error");
    });

    it("should handle fetchEvents unknown error", async () => {
      mockFetchEvents.mockRejectedValue("Unknown error");

      const result = await command.execute({});

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Failed to list tokens: Unknown error");
    });

    it("should use correct filter for token mappings", async () => {
      const mockTokenMappings = [
        {
          content: "TestToken",
          id: "token-1",
          processId: "process-test-123",
          ticker: "TEST",
        },
      ];

      mockFetchEvents.mockResolvedValue(mockTokenMappings);

      await command.execute({});

      expect(mockFetchEvents).toHaveBeenCalledWith(
        "test-hub-id",
        JSON.stringify([{ kinds: ["token-mapping"] }]),
      );
    });

    it("should handle hub ID from context", async () => {
      const customContext = {
        ...mockContext,
        hubId: "custom-hub-123",
      };

      const customCommand = new ListTokensCommand(customContext);
      mockFetchEvents.mockResolvedValue([]);

      await customCommand.execute({});

      expect(mockFetchEvents).toHaveBeenCalledWith(
        "custom-hub-123",
        JSON.stringify([{ kinds: ["token-mapping"] }]),
      );
    });

    it("should return valid JSON for large token lists", async () => {
      const largeTokenList = Array.from({ length: 100 }, (_, i) => ({
        content: `Token${i}`,
        id: `token-${i}`,
        processId: `process-${i}`,
        ticker: `TK${i}`,
      }));

      mockFetchEvents.mockResolvedValue(largeTokenList);

      const result = await command.execute({});

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(100);
      expect(parsed[0].id).toBe("token-0");
      expect(parsed[99].id).toBe("token-99");
    });

    it("should handle complex token mapping data", async () => {
      const complexTokenMappings = [
        {
          content: "Complex Token Name",
          id: "token-complex-1",
          metadata: {
            decimals: 18,
            name: "Complex Token",
            symbol: "CMPLX",
            totalSupply: "1000000000000000000000000",
          },
          processId: "process-complex-abc123def456",
          tags: ["defi", "experimental"],
          ticker: "CMPLX",
        },
      ];

      mockFetchEvents.mockResolvedValue(complexTokenMappings);

      const result = await command.execute({});

      const parsed = JSON.parse(result);
      expect(parsed).toEqual(complexTokenMappings);
      expect(parsed[0].metadata.name).toBe("Complex Token");
      expect(parsed[0].tags).toContain("defi");
    });
  });
});
