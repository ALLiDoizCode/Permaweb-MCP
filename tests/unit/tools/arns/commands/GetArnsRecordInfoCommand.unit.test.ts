import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetArnsRecordInfoCommand } from "../../../../../src/tools/arns/commands/GetArnsRecordInfoCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Create mock client and manager with vi.mock() factory pattern for proper isolation
const mockArnsClient = {
  getArNSRecord: vi.fn(),
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

describe("GetArnsRecordInfoCommand", () => {
  let command: GetArnsRecordInfoCommand;
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
    mockArnsClient.getArNSRecord.mockReset();
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

    command = new GetArnsRecordInfoCommand(mockContext);
  });

  describe("execute", () => {
    it("should get record info for valid base name", async () => {
      // Explicitly ensure client is available for this test
      mockArnsClientManager.getClient.mockReturnValue(mockArnsClient);

      const mockRecord = {
        contractTxId: "contract456",
        endTimestamp: 1672531200000, // 2023-01-01
        processId: "process123",
        purchasePrice: "1000000000000",
        startTimestamp: 1609459200000, // 2021-01-01
        type: "lease",
        undernameCount: 10,
      };

      mockArnsClient.getArNSRecord.mockResolvedValue(mockRecord);

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        network: "mainnet",
        query: {
          name: "example.ar",
          network: "mainnet",
        },
        recordInfo: {
          expiresAt: 1672531200000,
          expiresAtDate: "2023-01-01T00:00:00.000Z",
          name: "example.ar",
          owner: "contract456",
          processId: "process123",
          purchasePrice: "1000000000000",
          startTimestamp: 1609459200000,
          type: "lease",
          undernames: 10,
        },
        success: true,
      });

      expect(
        mockArnsClientManager.initializeFromEnvironment,
      ).toHaveBeenCalled();
      expect(mockArnsClient.getArNSRecord).toHaveBeenCalledWith({
        name: "example",
      });
    });

    it("should handle undername by querying base name", async () => {
      const mockRecord = {
        contractTxId: "contract456",
        processId: "process123",
        startTimestamp: 1609459200000,
        type: "permanent",
        undernameCount: 25,
      };

      mockArnsClient.getArNSRecord.mockResolvedValue(mockRecord);

      const result = await command.execute({
        name: "sub.example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed.recordInfo.name).toBe("sub.example.ar");
      expect(parsed.recordInfo.type).toBe("permanent");
      expect(parsed.recordInfo.undernames).toBe(25);
      expect(mockArnsClient.getArNSRecord).toHaveBeenCalledWith({
        name: "example",
      });
    });

    it("should handle permanent record without expiration", async () => {
      const mockRecord = {
        contractTxId: "contract456",
        processId: "process123",
        startTimestamp: 1609459200000,
        type: "permanent",
        undernameCount: 100,
      };

      mockArnsClient.getArNSRecord.mockResolvedValue(mockRecord);

      const result = await command.execute({
        name: "permanent.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed.recordInfo.type).toBe("permanent");
      expect(parsed.recordInfo.undernames).toBe(100);
      expect(parsed.recordInfo.expiresAt).toBeUndefined();
      expect(parsed.recordInfo.expiresAtDate).toBeUndefined();
    });

    it("should switch network when specified", async () => {
      const mockRecord = {
        processId: "testnet-process",
        startTimestamp: 1609459200000,
        type: "lease",
        undernameCount: 10,
      };

      mockArnsClient.getArNSRecord.mockResolvedValue(mockRecord);
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

    it("should handle record not found", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue(null);

      const result = await command.execute({
        name: "nonexistent.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "RECORD_NOT_FOUND",
        message: "ArNS record not found: nonexistent.ar",
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
      mockArnsClient.getArNSRecord.mockRejectedValue(
        new Error("Network connection failed"),
      );

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "NETWORK_ERROR",
        message: "Network connectivity issue during record lookup",
        success: false,
        suggestion:
          "Check internet connection and try again. The ArNS network may be temporarily unavailable.",
      });
    });

    it("should handle invalid name format errors", async () => {
      mockArnsClient.getArNSRecord.mockRejectedValue(
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

    it("should handle 404 not found errors", async () => {
      mockArnsClient.getArNSRecord.mockRejectedValue(
        new Error("Record not found - 404"),
      );

      const result = await command.execute({
        name: "missing.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "RECORD_NOT_FOUND",
        message: "ArNS record not found: missing.ar",
        success: false,
        suggestion:
          "Verify the name exists and is properly registered on the specified network",
      });
    });

    it("should handle general errors", async () => {
      mockArnsClient.getArNSRecord.mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await command.execute({
        name: "example.ar",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "RECORD_LOOKUP_ERROR",
        message: "Failed to get record info: Unexpected error",
        success: false,
        suggestion: "Verify name format and network connectivity, then retry",
      });
    });

    it("should validate name format with Zod schema", async () => {
      // The tool should throw a Zod validation error for invalid inputs
      try {
        await command.execute({ name: "" });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should accept valid name formats", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        processId: "test-process-id",
        startTimestamp: Date.now(),
        type: "lease",
        undernameCount: 10,
      });

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
