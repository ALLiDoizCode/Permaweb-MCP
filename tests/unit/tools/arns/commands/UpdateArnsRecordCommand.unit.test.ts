import { beforeEach, describe, expect, it, vi } from "vitest";

import { UpdateArnsRecordCommand } from "../../../../../src/tools/arns/commands/UpdateArnsRecordCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Create mock client and manager with vi.mock() factory pattern for proper isolation
const mockArnsClient = {
  getArNSRecord: vi.fn(),
  updateRecord: vi.fn(),
};

const mockArnsClientManager = {
  getClient: vi.fn(() => mockArnsClient),
  getCurrentNetwork: vi.fn(() => "mainnet"),
  initializeFromEnvironment: vi.fn(() => Promise.resolve()),
  switchNetwork: vi.fn(() => Promise.resolve()),
};

const mockAutoSafeToolContext = {
  initializeAll: vi.fn(),
};

// Use factory pattern for reliable mock isolation
vi.mock("../../../../../src/tools/arns/utils/ArnsClientManager.js", () => ({
  ArnsClientManager: {
    getInstance: vi.fn(() => mockArnsClientManager),
  },
}));

// Mock AutoSafeToolContext
vi.mock("../../../../../src/tools/core/index.js", async () => {
  const actual = await vi.importActual(
    "../../../../../src/tools/core/index.js",
  );
  return {
    ...actual,
    AutoSafeToolContext: {
      from: vi.fn(() => mockAutoSafeToolContext),
    },
  };
});

describe("UpdateArnsRecordCommand", () => {
  let command: UpdateArnsRecordCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    // Clear all mocks for proper isolation
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { test: "keypair" } as any,
      publicKey: "test-public-key-43-chars-long-12345678901",
    };

    // Reset all mock implementations with proper defaults
    mockArnsClient.getArNSRecord.mockReset();
    mockArnsClient.updateRecord.mockReset();
    mockArnsClientManager.initializeFromEnvironment.mockReset();
    mockArnsClientManager.switchNetwork.mockReset();
    mockArnsClientManager.getClient.mockReset();
    mockArnsClientManager.getCurrentNetwork.mockReset();
    mockAutoSafeToolContext.initializeAll.mockReset();

    // Ensure client manager returns a valid client by default
    mockArnsClientManager.getClient.mockReturnValue(mockArnsClient);
    mockArnsClientManager.getCurrentNetwork.mockReturnValue("mainnet");
    mockArnsClientManager.initializeFromEnvironment.mockResolvedValue(
      undefined,
    );

    // Setup AutoSafeToolContext mock
    mockAutoSafeToolContext.initializeAll.mockResolvedValue({
      generated: false,
      hubCreated: false,
      hubId: mockContext.hubId,
      keyPair: mockContext.keyPair,
      publicKey: mockContext.publicKey,
    });

    command = new UpdateArnsRecordCommand(mockContext);
  });

  describe("Parameter Validation", () => {
    it("should validate ArNS name format", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "invalid.ar", // Should not include .ar suffix
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
      expect(parsed.error?.message).toContain("validation failed");
    });

    it("should validate transaction ID format", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "invalid-short-txid", // Too short
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });

    it("should validate TTL range", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 100, // Too low (minimum 300)
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });

    it("should require at least one update parameter", async () => {
      const result = await command.execute({
        // No transactionId or ttlSeconds provided
        confirmed: true,
        name: "validname",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
      expect(parsed.error?.message).toContain("At least one update parameter");
    });

    it("should accept valid parameters", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });

      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe("Ownership Verification", () => {
    it("should verify current ownership before update", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });

      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      expect(mockArnsClient.getArNSRecord).toHaveBeenCalledWith({
        name: "validname",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should reject update if not owner", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: "different-owner-address-43-chars-123456789",
        type: "lease",
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("UNAUTHORIZED_UPDATE");
    });

    it("should handle record not found", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue(null);

      const result = await command.execute({
        confirmed: true,
        name: "nonexistent",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("RECORD_NOT_FOUND");
    });
  });

  describe("Update Flow", () => {
    beforeEach(() => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });
    });

    it("should perform record update with transaction ID", async () => {
      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "new-transaction-id-43-chars-123456789012",
      });

      expect(mockArnsClient.updateRecord).toHaveBeenCalledWith({
        name: "validname",
        signer: mockContext.keyPair,
        transactionId: "new-transaction-id-43-chars-123456789012",
        ttlSeconds: undefined,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe(
        "update-transaction-id-43-chars-12345678901",
      );
      expect(parsed.update?.name).toBe("validname");
      expect(parsed.update?.updatedFields).toEqual(["transactionId"]);
    });

    it("should perform record update with TTL", async () => {
      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 3600,
      });

      expect(mockArnsClient.updateRecord).toHaveBeenCalledWith({
        name: "validname",
        signer: mockContext.keyPair,
        transactionId: undefined,
        ttlSeconds: 3600,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.update?.updatedFields).toEqual(["ttlSeconds"]);
    });

    it("should perform record update with both parameters", async () => {
      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "new-transaction-id-43-chars-123456789012",
        ttlSeconds: 7200,
      });

      expect(mockArnsClient.updateRecord).toHaveBeenCalledWith({
        name: "validname",
        signer: mockContext.keyPair,
        transactionId: "new-transaction-id-43-chars-123456789012",
        ttlSeconds: 7200,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.update?.updatedFields).toEqual([
        "transactionId",
        "ttlSeconds",
      ]);
    });

    it("should require confirmation for update operations", async () => {
      const result = await command.execute({
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
        // confirmed: false (default)
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.requiresConfirmation).toBe(true);
      expect(parsed.instruction).toContain("confirmed: true");
      expect(mockArnsClient.updateRecord).not.toHaveBeenCalled();
    });

    it("should handle network switching", async () => {
      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });

      await command.execute({
        confirmed: true,
        name: "validname",
        network: "testnet",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      expect(mockArnsClientManager.switchNetwork).toHaveBeenCalledWith(
        "testnet",
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });
    });

    it("should handle update failures gracefully", async () => {
      mockArnsClient.updateRecord.mockRejectedValue(
        new Error("Update operation failed"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("UPDATE_FAILED");
      expect(parsed.error?.message).toContain("Update operation failed");
    });

    it("should handle network timeout scenarios", async () => {
      mockArnsClient.getArNSRecord.mockRejectedValue(
        new Error("Network connection timeout"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("NETWORK_ERROR");
    });

    it("should handle authorization errors", async () => {
      mockArnsClient.updateRecord.mockRejectedValue(
        new Error("Unauthorized operation"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("AUTHORIZATION_ERROR");
    });

    it("should handle transaction signing errors", async () => {
      mockArnsClient.updateRecord.mockRejectedValue(
        new Error("Transaction signing failed"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("TRANSACTION_ERROR");
    });

    it("should handle invalid transaction ID errors", async () => {
      mockArnsClient.updateRecord.mockRejectedValue(
        new Error("Invalid transaction ID provided"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_TRANSACTION_ID");
    });

    it("should handle client not initialized error", async () => {
      mockArnsClientManager.getClient.mockReturnValue(null);

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        transactionId: "valid-transaction-id-43-chars-1234567890123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("CLIENT_NOT_INITIALIZED");
    });
  });

  describe("TTL Validation Edge Cases", () => {
    beforeEach(() => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });

      mockArnsClient.updateRecord.mockResolvedValue({
        id: "update-transaction-id-43-chars-12345678901",
        owner: mockContext.publicKey,
        processId: "process-id",
        tags: [],
      });
    });

    it("should accept minimum TTL value", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 300, // Minimum value
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should accept maximum TTL value", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 86400, // Maximum value (24 hours)
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should reject TTL values below minimum", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 299, // Below minimum
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });

    it("should reject TTL values above maximum", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        ttlSeconds: 86401, // Above maximum
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });
  });
});
