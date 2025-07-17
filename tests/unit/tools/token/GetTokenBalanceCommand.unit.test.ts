import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GetTokenBalanceCommand } from "../../../../src/tools/token/commands/GetTokenBalanceCommand.js";

// Mock dependencies
vi.mock("../../../../src/process.js", () => ({
  read: vi.fn(),
}));

vi.mock("../../../../src/tools/token/utils/TokenResolver.js", () => ({
  resolveAddress: vi.fn(),
  resolveToken: vi.fn(),
}));

describe("GetTokenBalanceCommand", () => {
  let command: GetTokenBalanceCommand;
  let mockContext: ToolContext;
  let mockRead: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockResolveToken: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockResolveAddress: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      publicKey: "test-public-key",
    };

    command = new GetTokenBalanceCommand(mockContext);

    // Get mocked functions
    mockRead = (await import("../../../../src/process.js")).read;
    mockResolveToken = (
      await import("../../../../src/tools/token/utils/TokenResolver.js")
    ).resolveToken;
    mockResolveAddress = (
      await import("../../../../src/tools/token/utils/TokenResolver.js")
    ).resolveAddress;
  });

  describe("execute", () => {
    it("should get balance with valid process ID", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful balance read
      mockRead.mockResolvedValue({
        Data: JSON.stringify("1000000000000"), // 1 token with 12 decimals
      });

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.balance).toBe("1000000000000");
      expect(parsed.query.processId).toBe("process-123");
      expect(parsed.query.target).toBe("test-public-key");
    });

    it("should get balance with target address", async () => {
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
        value: "target-address-123",
      });

      // Mock successful balance read
      mockRead.mockResolvedValue({
        Data: JSON.stringify("500000000000"), // 0.5 tokens with 12 decimals
      });

      const result = await command.execute({
        processId: "process-123",
        target: "target-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.balance).toBe("500000000000");
      expect(parsed.query.target).toBe("target-address-123");
    });

    it("should handle token resolution failure", async () => {
      // Mock failed token resolution
      mockResolveToken.mockResolvedValue({
        resolved: false,
        verificationMessage: "Token not found in registry",
      });

      const result = await command.execute({
        processId: "invalid-token",
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
        target: "invalid-address",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Target address resolution failed");
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
        value: "target-address-123",
        verificationMessage: "Address requires confirmation",
      });

      const result = await command.execute({
        processId: "process-123",
        target: "target-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.requiresConfirmation).toBe(true);
      expect(parsed.message).toBe("Address requires confirmation");
      expect(parsed.resolvedTarget).toBe("target-address-123");
    });

    it("should handle process read errors", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock process read failure
      mockRead.mockRejectedValue(new Error("Process communication failed"));

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Balance query failed");
      expect(parsed.error).toContain("Process communication failed");
    });

    it("should proceed with confirmed token verification", async () => {
      // Mock token resolution requiring verification
      mockResolveToken.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "process-123",
        verificationMessage: "Token requires confirmation",
      });

      // Mock successful balance read
      mockRead.mockResolvedValue({
        Data: JSON.stringify("2000000000000"), // 2 tokens with 12 decimals
      });

      const result = await command.execute({
        confirmed: true,
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.balance).toBe("2000000000000");
      expect(parsed.query.processId).toBe("process-123");
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
        value: "target-address-123",
        verificationMessage: "Address requires confirmation",
      });

      // Mock successful balance read
      mockRead.mockResolvedValue({
        Data: JSON.stringify("750000000000"), // 0.75 tokens with 12 decimals
      });

      const result = await command.execute({
        confirmed: true,
        processId: "process-123",
        target: "target-address-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.balance).toBe("750000000000");
      expect(parsed.query.target).toBe("target-address-123");
    });
  });
});
