import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { TransferTokensCommand } from "../../../../src/tools/token/commands/TransferTokensCommand.js";

// Mock dependencies
vi.mock("../../../../src/process.js", () => ({
  read: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../../../src/tools/token/utils/TokenResolver.js", () => ({
  resolveAddress: vi.fn(),
  resolveToken: vi.fn(),
}));

describe("TransferTokensCommand", () => {
  let command: TransferTokensCommand;
  let mockContext: ToolContext;
  let mockRead: any;
  let mockSend: any;
  let mockResolveToken: any;
  let mockResolveAddress: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as any,
      publicKey: "test-public-key",
    };

    command = new TransferTokensCommand(mockContext);

    // Get mocked functions
    const processModule = await import("../../../../src/process.js");
    mockRead = processModule.read;
    mockSend = processModule.send;

    const resolverModule = await import(
      "../../../../src/tools/token/utils/TokenResolver.js"
    );
    mockResolveToken = resolverModule.resolveToken;
    mockResolveAddress = resolverModule.resolveAddress;
  });

  describe("execute", () => {
    it("should transfer tokens with valid parameters", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful address resolution
      mockResolveAddress.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "recipient-address-123",
      });

      // Mock token info for denomination
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify({ Denomination: "12" }),
      });

      // Mock balance check
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify("5000000000000"), // 5 tokens with 12 decimals
      });

      // Mock successful transfer
      mockSend.mockResolvedValue({
        id: "transfer-tx-123",
        success: true,
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transfer.quantity).toBe("100");
      expect(parsed.transfer.actualQuantity).toBe("100000000000000"); // 100 * 10^12
      expect(parsed.transfer.recipient).toBe("recipient-address-123");
      expect(parsed.transfer.processId).toBe("process-123");
    });

    it("should handle raw amount transfers", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful address resolution
      mockResolveAddress.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "recipient-address-123",
      });

      // Mock token info for denomination
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify({ Denomination: "12" }),
      });

      // Mock balance check
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify("5000000000000"),
      });

      // Mock successful transfer
      mockSend.mockResolvedValue({
        id: "transfer-tx-123",
        success: true,
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "1000000000000", // Raw amount
        rawAmount: true,
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transfer.actualQuantity).toBe("1000000000000"); // No denomination conversion
    });

    it("should handle decimal amounts", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful address resolution
      mockResolveAddress.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "recipient-address-123",
      });

      // Mock token info for denomination
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify({ Denomination: "12" }),
      });

      // Mock balance check
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify("5000000000000"),
      });

      // Mock successful transfer
      mockSend.mockResolvedValue({
        id: "transfer-tx-123",
        success: true,
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "1.5", // Decimal amount
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transfer.actualQuantity).toBe("1.5"); // No denomination conversion for decimals
    });

    it("should handle token resolution failure", async () => {
      // Mock failed token resolution
      mockResolveToken.mockResolvedValue({
        resolved: false,
        verificationMessage: "Token not found in registry",
      });

      const result = await command.execute({
        processId: "invalid-token",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Token resolution failed");
      expect(parsed.message).toBe("Token not found in registry");
    });

    it("should handle token verification requirement", async () => {
      // Mock token resolution requiring verification
      mockResolveToken.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "process-123",
        verificationMessage: "Token requires confirmation",
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.requiresConfirmation).toBe(true);
      expect(parsed.message).toBe("Token requires confirmation");
      expect(parsed.resolvedToken).toBe("process-123");
    });

    it("should handle address resolution failure", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock failed address resolution
      mockResolveAddress.mockResolvedValue({
        resolved: false,
        verificationMessage: "Address not found in contacts",
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "100",
        recipient: "invalid-address",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Recipient resolution failed");
      expect(parsed.message).toBe("Address not found in contacts");
    });

    it("should handle address verification requirement", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock address resolution requiring verification
      mockResolveAddress.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "recipient-address-123",
        verificationMessage: "Address requires confirmation",
      });

      const result = await command.execute({
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.requiresConfirmation).toBe(true);
      expect(parsed.message).toBe("Address requires confirmation");
      expect(parsed.resolvedRecipient).toBe("recipient-address-123");
    });

    it("should handle process communication errors", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful address resolution
      mockResolveAddress.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "recipient-address-123",
      });

      // Mock token info read failure
      mockRead.mockRejectedValue(new Error("Process communication failed"));

      const result = await command.execute({
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Failed to transfer tokens");
    });

    it("should proceed with confirmed token verification", async () => {
      // Mock token resolution requiring verification
      mockResolveToken.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "process-123",
        verificationMessage: "Token requires confirmation",
      });

      // Mock successful address resolution
      mockResolveAddress.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "recipient-address-123",
      });

      // Mock token info for denomination
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify({ Denomination: "12" }),
      });

      // Mock balance check
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify("5000000000000"),
      });

      // Mock successful transfer
      mockSend.mockResolvedValue({
        id: "transfer-tx-123",
        success: true,
      });

      const result = await command.execute({
        confirmed: true,
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transfer.processId).toBe("process-123");
    });

    it("should proceed with confirmed address verification", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock address resolution requiring verification
      mockResolveAddress.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "recipient-address-123",
        verificationMessage: "Address requires confirmation",
      });

      // Mock token info for denomination
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify({ Denomination: "12" }),
      });

      // Mock balance check
      mockRead.mockResolvedValueOnce({
        Data: JSON.stringify("5000000000000"),
      });

      // Mock successful transfer
      mockSend.mockResolvedValue({
        id: "transfer-tx-123",
        success: true,
      });

      const result = await command.execute({
        confirmed: true,
        processId: "process-123",
        quantity: "100",
        recipient: "recipient-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transfer.recipient).toBe("recipient-address-123");
    });
  });
});
