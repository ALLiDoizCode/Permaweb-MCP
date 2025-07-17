import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GetTokenInfoCommand } from "../../../../src/tools/token/commands/GetTokenInfoCommand.js";

// Mock dependencies
vi.mock("../../../../src/process.js", () => ({
  read: vi.fn(),
}));

vi.mock("../../../../src/tools/token/utils/TokenResolver.js", () => ({
  resolveToken: vi.fn(),
}));

describe("GetTokenInfoCommand", () => {
  let command: GetTokenInfoCommand;
  let mockContext: ToolContext;
  let mockRead: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockResolveToken: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      publicKey: "test-public-key",
    };

    command = new GetTokenInfoCommand(mockContext);

    // Get mocked functions
    mockRead = (await import("../../../../src/process.js")).read;
    mockResolveToken = (
      await import("../../../../src/tools/token/utils/TokenResolver.js")
    ).resolveToken;
  });

  describe("execute", () => {
    it("should get token info with valid process ID", async () => {
      const mockTokenInfo = {
        Denomination: "12",
        Logo: "https://example.com/logo.png",
        Name: "Test Token",
        Ticker: "TEST",
        TotalSupply: "1000000000000000000000000",
      };

      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful token info read
      mockRead.mockResolvedValue({
        Data: JSON.stringify(mockTokenInfo),
      });

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toEqual(mockTokenInfo);
      expect(parsed.processId).toBe("process-123");
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
    });

    it("should proceed with confirmed token verification", async () => {
      const mockTokenInfo = {
        Denomination: "18",
        Name: "Verified Token",
        Ticker: "VTK",
        TotalSupply: "500000000000000000000000",
      };

      // Mock token resolution requiring verification
      mockResolveToken.mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "process-123",
        verificationMessage: "Token requires confirmation",
      });

      // Mock successful token info read
      mockRead.mockResolvedValue({
        Data: JSON.stringify(mockTokenInfo),
      });

      const result = await command.execute({
        confirmed: true,
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toEqual(mockTokenInfo);
      expect(parsed.processId).toBe("process-123");
    });

    it("should handle empty token info response", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock empty token info read
      mockRead.mockResolvedValue({
        Data: null,
      });

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toBeNull();
      expect(parsed.processId).toBe("process-123");
    });

    it("should handle malformed token info JSON", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock malformed token info read
      mockRead.mockResolvedValue({
        Data: "invalid json",
      });

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toBeNull();
      expect(parsed.processId).toBe("process-123");
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
      expect(parsed.error).toContain("Failed to get token info");
      expect(parsed.error).toContain("Process communication failed");
    });

    it("should handle unknown process read errors", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock process read failure with unknown error
      mockRead.mockRejectedValue("Unknown error");

      const result = await command.execute({
        processId: "process-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Failed to get token info");
      expect(parsed.error).toContain("Unknown error");
    });

    it("should handle token resolution from ticker", async () => {
      const mockTokenInfo = {
        Denomination: "6",
        Name: "USD Coin",
        Ticker: "USDC",
        TotalSupply: "100000000000000",
      };

      // Mock successful token resolution from ticker
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-usdc-123",
      });

      // Mock successful token info read
      mockRead.mockResolvedValue({
        Data: JSON.stringify(mockTokenInfo),
      });

      const result = await command.execute({
        processId: "USDC", // Using ticker instead of process ID
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toEqual(mockTokenInfo);
      expect(parsed.processId).toBe("process-usdc-123");
    });

    it("should handle complex token info with metadata", async () => {
      const mockTokenInfo = {
        Denomination: "18",
        Description: "A complex DeFi token with advanced features",
        Logo: "https://example.com/complex-logo.png",
        Metadata: {
          createdAt: "2024-01-01T00:00:00Z",
          creator: "DeFi Team",
          version: "1.0.0",
        },
        Name: "Complex DeFi Token",
        Tags: ["defi", "yield-farming", "governance"],
        Ticker: "CDEFI",
        TotalSupply: "1000000000000000000000000000",
        Website: "https://complex-defi.com",
      };

      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-complex-123",
      });

      // Mock successful complex token info read
      mockRead.mockResolvedValue({
        Data: JSON.stringify(mockTokenInfo),
      });

      const result = await command.execute({
        processId: "process-complex-123",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.info).toEqual(mockTokenInfo);
      expect(parsed.info.Tags).toContain("defi");
      expect(parsed.info.Metadata.version).toBe("1.0.0");
      expect(parsed.processId).toBe("process-complex-123");
    });

    it("should use correct process read tags", async () => {
      // Mock successful token resolution
      mockResolveToken.mockResolvedValue({
        requiresVerification: false,
        resolved: true,
        value: "process-123",
      });

      // Mock successful token info read
      mockRead.mockResolvedValue({
        Data: JSON.stringify({ Name: "Test Token" }),
      });

      await command.execute({
        processId: "process-123",
      });

      expect(mockRead).toHaveBeenCalledWith("process-123", [
        { name: "Action", value: "Info" },
      ]);
    });
  });
});
