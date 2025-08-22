import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransferArnsRecordCommand } from "../../../../../src/tools/arns/commands/TransferArnsRecordCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

// Create mock client and manager with vi.mock() factory pattern for proper isolation
const mockArnsClient = {
  getArNSRecord: vi.fn(),
  transferRecord: vi.fn(),
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

describe("TransferArnsRecordCommand", () => {
  let command: TransferArnsRecordCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    // Clear all mocks for proper isolation
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { test: "keypair" } as any,
      publicKey: "current-owner-public-key-43-chars-1234567890A",
    };

    // Reset all mock implementations with proper defaults
    mockArnsClient.getArNSRecord.mockReset();
    mockArnsClient.transferRecord.mockReset();
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

    command = new TransferArnsRecordCommand(mockContext);
  });

  describe("Parameter Validation", () => {
    it("should validate ArNS name format", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "invalid.ar", // Should not include .ar suffix - fails regex validation
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });

    it("should validate new owner address format", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "invalid-short-address", // Too short
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("INVALID_PARAMETERS");
    });

    it("should accept valid parameters", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });

      mockArnsClient.transferRecord.mockResolvedValue({
        id: "transfer-txid-43-chars-long-12345678901ABCDEF",
        owner: "transfer-owner-address-43-chars-1234567890AB",
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe("Ownership Verification", () => {
    it("should verify current ownership before transfer", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });

      mockArnsClient.transferRecord.mockResolvedValue({
        id: "transfer-txid-43-chars-long-12345678901ABCDEF",
        owner: "transfer-owner-address-43-chars-1234567890AB",
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      expect(mockArnsClient.getArNSRecord).toHaveBeenCalledWith({
        name: "validname",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should reject transfer if not owner", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: "different-owner-address-43-chars-123456789AB",
        type: "lease",
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("UNAUTHORIZED_TRANSFER");
    });

    it("should handle record not found", async () => {
      mockArnsClient.getArNSRecord.mockResolvedValue(null);

      const result = await command.execute({
        confirmed: true,
        name: "nonexistent",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("RECORD_NOT_FOUND");
    });
  });

  describe("Transfer Flow", () => {
    beforeEach(() => {
      mockArnsClient.getArNSRecord.mockResolvedValue({
        contractTxId: mockContext.publicKey,
        type: "lease",
      });
    });

    it("should perform ownership transfer with proper parameters", async () => {
      mockArnsClient.transferRecord.mockResolvedValue({
        id: "transfer-txid-43-chars-long-12345678901ABCDEF",
        owner: "transfer-owner-address-43-chars-1234567890AB",
        processId: "process-id",
        tags: [],
      });

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      expect(mockArnsClient.transferRecord).toHaveBeenCalledWith({
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
        signer: mockContext.keyPair,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe(
        "transfer-txid-43-chars-long-12345678901ABCDEF",
      );
      expect(parsed.transfer?.name).toBe("validname");
      expect(parsed.transfer?.previousOwner).toBe(mockContext.publicKey);
      expect(parsed.transfer?.newOwner).toBe(
        "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      );
    });

    it("should require confirmation for transfer operations", async () => {
      const result = await command.execute({
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
        // confirmed: false (default)
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.requiresConfirmation).toBe(true);
      expect(parsed.instruction).toContain("confirmed: true");
      expect(mockArnsClient.transferRecord).not.toHaveBeenCalled();
    });

    it("should handle network switching", async () => {
      mockArnsClient.transferRecord.mockResolvedValue({
        id: "transfer-txid-43-chars-long-12345678901ABCDEF",
        owner: "transfer-owner-address-43-chars-1234567890AB",
        processId: "process-id",
        tags: [],
      });

      await command.execute({
        confirmed: true,
        name: "validname",
        network: "testnet",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
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

    it("should handle transfer failures gracefully", async () => {
      mockArnsClient.transferRecord.mockRejectedValue(
        new Error("Transfer operation failed"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("TRANSFER_FAILED");
      expect(parsed.error?.message).toContain("Transfer operation failed");
    });

    it("should handle network timeout scenarios", async () => {
      mockArnsClient.getArNSRecord.mockRejectedValue(
        new Error("Network connection timeout"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("NETWORK_ERROR");
    });

    it("should handle authorization errors", async () => {
      mockArnsClient.transferRecord.mockRejectedValue(
        new Error("Unauthorized operation"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("AUTHORIZATION_ERROR");
    });

    it("should handle transaction signing errors", async () => {
      mockArnsClient.transferRecord.mockRejectedValue(
        new Error("Transaction signing failed"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("TRANSACTION_ERROR");
    });

    it("should handle client not initialized error", async () => {
      mockArnsClientManager.getClient.mockReturnValue(null);

      const result = await command.execute({
        confirmed: true,
        name: "validname",
        newOwner: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("CLIENT_NOT_INITIALIZED");
    });
  });
});
