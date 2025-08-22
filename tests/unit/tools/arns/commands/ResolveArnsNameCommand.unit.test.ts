import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResolveArnsNameCommand } from "../../../../../src/tools/arns/commands/ResolveArnsNameCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Create mock client and manager with vi.mock() factory pattern for proper isolation
const mockArnsClient = {
  resolveArNSName: vi.fn(),
};

const mockArnsClientManager = {
  getClient: vi.fn(() => mockArnsClient),
  getCurrentNetwork: vi.fn(() => "mainnet"),
  initializeFromEnvironment: vi.fn(() => Promise.resolve()),
  switchNetwork: vi.fn(() => Promise.resolve()),
};

// Use factory pattern for reliable mock isolation (QA recommendation)
vi.mock("../../../../../src/tools/arns/utils/ArnsClientManager.js", () => ({
  ArnsClientManager: {
    getInstance: vi.fn(() => mockArnsClientManager),
  },
}));

describe("ResolveArnsNameCommand", () => {
  let command: ResolveArnsNameCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    // Clear all mocks for proper isolation (QA recommendation)
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    // Reset all mock implementations with proper defaults
    mockArnsClient.resolveArNSName.mockReset();
    mockArnsClientManager.initializeFromEnvironment.mockReset();
    mockArnsClientManager.switchNetwork.mockReset();
    mockArnsClientManager.getClient.mockReset();
    mockArnsClientManager.getCurrentNetwork.mockReset();

    // Ensure client manager returns a valid client by default (critical for mock isolation)
    mockArnsClientManager.getClient.mockReturnValue(mockArnsClient);
    mockArnsClientManager.getCurrentNetwork.mockReturnValue("mainnet");
    mockArnsClientManager.initializeFromEnvironment.mockResolvedValue(
      undefined,
    );
    mockArnsClientManager.switchNetwork.mockResolvedValue(undefined);

    command = new ResolveArnsNameCommand(mockContext);
  });

  describe("execute", () => {
    it("should resolve valid base name successfully", async () => {
      mockArnsClient.resolveArNSName.mockResolvedValue("abc123def456ghi789");

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        nameType: "base",
        network: "mainnet",
        query: {
          name: "example.ar",
          network: "mainnet",
        },
        resolvedId: "abc123def456ghi789",
        success: true,
      });

      expect(
        mockArnsClientManager.initializeFromEnvironment,
      ).toHaveBeenCalled();
      expect(mockArnsClient.resolveArNSName).toHaveBeenCalledWith({
        name: "example.ar",
      });
    });

    it("should resolve valid undername successfully", async () => {
      mockArnsClient.resolveArNSName.mockResolvedValue("xyz789abc123def456");

      const result = await command.execute({
        name: "sub.example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        nameType: "undername",
        network: "mainnet",
        query: {
          name: "sub.example.ar",
          network: "mainnet",
        },
        resolvedId: "xyz789abc123def456",
        success: true,
      });
    });

    it("should switch network when specified", async () => {
      mockArnsClient.resolveArNSName.mockResolvedValue("testnet123");
      mockArnsClientManager.getCurrentNetwork.mockReturnValue("testnet");

      const result = await command.execute({
        name: "example.ar",
        network: "testnet",
      });

      const parsed = JSON.parse(result);

      expect(mockArnsClientManager.switchNetwork).toHaveBeenCalledWith(
        "testnet",
      );
      expect(parsed.network).toBe("testnet");
    });

    it("should handle client not initialized error", async () => {
      mockArnsClientManager.getClient.mockReturnValue(null);

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "CLIENT_NOT_INITIALIZED",
        message:
          "ArNS client not initialized. Please check network configuration.",
        success: false,
        suggestion:
          "Verify ARNS_NETWORK environment variable and network connectivity",
      });
    });

    it("should handle resolution failure", async () => {
      mockArnsClient.resolveArNSName.mockResolvedValue(null);

      const result = await command.execute({
        name: "nonexistent.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "RESOLUTION_FAILED",
        message: "Failed to resolve ArNS name: nonexistent.ar",
        query: {
          name: "nonexistent.ar",
          network: "mainnet",
        },
        success: false,
        suggestion:
          "Verify the name exists and is properly registered on the specified network",
      });
    });

    it("should handle network errors", async () => {
      mockArnsClient.resolveArNSName.mockRejectedValue(
        new Error("Network connection failed"),
      );

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "NETWORK_ERROR",
        message: "Network connectivity issue during ArNS resolution",
        success: false,
        suggestion:
          "Check internet connection and try again. The ArNS network may be temporarily unavailable.",
      });
    });

    it("should handle invalid name format errors", async () => {
      mockArnsClient.resolveArNSName.mockRejectedValue(
        new Error("Invalid name format"),
      );

      const result = await command.execute({
        name: "invalid-name",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "INVALID_NAME_FORMAT",
        message: "Invalid ArNS name format: invalid-name",
        success: false,
        suggestion:
          "Ensure name follows .ar format (e.g., example.ar) or undername format (e.g., sub.example.ar)",
      });
    });

    it("should handle general errors", async () => {
      mockArnsClient.resolveArNSName.mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "RESOLUTION_ERROR",
        message: "Failed to resolve ArNS name: Unexpected error",
        success: false,
        suggestion: "Verify name format and network connectivity, then retry",
      });
    });

    it("should validate name format with Zod schema", async () => {
      try {
        await command.execute({ name: "" });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should accept valid name formats", async () => {
      mockArnsClient.resolveArNSName.mockResolvedValue("test-tx-id");

      const validNames = [
        "a.ar",
        "example.ar",
        "my-name.ar",
        "sub.example.ar",
        "deep.sub.example.ar",
        "a1-b2.test-name.ar",
      ];

      for (const validName of validNames) {
        const result = await command.execute({ name: validName });
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      }
    });
  });
});
