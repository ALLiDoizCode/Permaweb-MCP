import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveAddress,
  resolveToken,
} from "../../../../../src/tools/token/utils/TokenResolver.js";

// Mock dependencies
vi.mock("../../../../../src/relay.js", () => ({
  fetchEvents: vi.fn(),
}));

vi.mock("../../../../../src/tools/arns/utils/ArnsAddressResolver.js", () => ({
  ArnsAddressResolver: {
    isArnsName: vi.fn(),
    resolveArnsToAddress: vi.fn(),
  },
}));

describe("TokenResolver", () => {
  let mockFetchEvents: any;
  let ArnsAddressResolver: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetchEvents = (await import("../../../../../src/relay.js")).fetchEvents;
    ArnsAddressResolver = (
      await import("../../../../../src/tools/arns/utils/ArnsAddressResolver.js")
    ).ArnsAddressResolver;
  });

  describe("resolveAddress", () => {
    it("should return direct address for processId-like input", async () => {
      const processId = "abcdefghijklmnopqrstuvwxyz1234567890123456789";
      const result = await resolveAddress(processId, "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: true,
        value: processId,
      });
    });

    it("should resolve ArNS names using ArnsAddressResolver", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(true);
      (ArnsAddressResolver.resolveArnsToAddress as any).mockResolvedValue({
        requiresVerification: true,
        resolved: true,
        value: "resolved-tx-id",
        verificationMessage: "ArNS name resolved successfully",
      });

      const result = await resolveAddress("example.ar", "testHubId");

      expect(ArnsAddressResolver.isArnsName).toHaveBeenCalledWith("example.ar");
      expect(ArnsAddressResolver.resolveArnsToAddress).toHaveBeenCalledWith(
        "example.ar",
      );
      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "resolved-tx-id",
        verificationMessage: "ArNS name resolved successfully",
      });
    });

    it("should resolve contact names from memory", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(false);
      (mockFetchEvents as any).mockResolvedValue([
        {
          contact_address: "alice-address-123",
          contact_name: "Alice",
        },
      ]);

      const result = await resolveAddress("Alice", "testHubId");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "alice-address-123",
        verificationMessage:
          "Found contact: Alice (alice-address-123). Continue?",
      });
    });

    it("should handle partial contact name matches", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(false);
      (mockFetchEvents as any).mockResolvedValue([
        {
          contact_address: "alice-address-123",
          contact_name: "Alice Smith",
        },
      ]);

      const result = await resolveAddress("alice", "testHubId");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "alice-address-123",
        verificationMessage:
          "Found contact: Alice Smith (alice-address-123). Continue?",
      });
    });

    it("should handle multiple contact matches", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(false);
      (mockFetchEvents as any).mockResolvedValue([
        {
          contact_address: "alice-address-1",
          contact_name: "Alice",
        },
        {
          contact_address: "alice-address-2",
          contact_name: "Alice Smith",
        },
      ]);

      const result = await resolveAddress("alice", "testHubId");

      expect(result).toEqual({
        matches: ["alice-address-1", "alice-address-2"],
        requiresVerification: true,
        resolved: false,
        verificationMessage: expect.stringContaining("Multiple contacts found"),
      });
    });

    it("should handle no contact found", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(false);
      (mockFetchEvents as any).mockResolvedValue([]);

      const result = await resolveAddress("unknown", "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'No contact found for "unknown". Use saveAddressMapping to register this contact.',
      });
    });

    it("should handle ArNS resolution errors gracefully", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(true);
      (ArnsAddressResolver.resolveArnsToAddress as any).mockResolvedValue({
        requiresVerification: false,
        resolved: false,
        verificationMessage: "ArNS resolution failed",
      });

      const result = await resolveAddress("invalid.ar", "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage: "ArNS resolution failed",
      });
    });

    it("should handle fetch errors gracefully", async () => {
      (ArnsAddressResolver.isArnsName as any).mockReturnValue(false);
      (mockFetchEvents as any).mockRejectedValue(new Error("Network error"));

      const result = await resolveAddress("test", "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage: 'Error resolving contact "test": Network error',
      });
    });
  });

  describe("resolveToken", () => {
    it("should return direct processId for processId-like input", async () => {
      const processId = "abcdefghijklmnopqrstuvwxyz1234567890123456789";
      const result = await resolveToken(processId, "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: true,
        value: processId,
      });
    });

    it("should resolve token by ticker with high confidence", async () => {
      (mockFetchEvents as any).mockResolvedValue([
        {
          token_name: "Test Token",
          token_processId: "test-process-id",
          token_ticker: "TEST",
        },
      ]);

      const result = await resolveToken("TEST", "testHubId");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "test-process-id",
        verificationMessage:
          "Found token: Test Token (test-process-id). Continue?",
      });
    });

    it("should resolve token by name with moderate confidence", async () => {
      (mockFetchEvents as any).mockResolvedValue([
        {
          token_name: "Test Token",
          token_processId: "test-process-id",
          token_ticker: "TEST",
        },
      ]);

      const result = await resolveToken("test token", "testHubId");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "test-process-id",
        verificationMessage:
          "Found token: Test Token (test-process-id). Continue?",
      });
    });

    it("should handle multiple token matches", async () => {
      (mockFetchEvents as any).mockResolvedValue([
        {
          token_name: "Test Token 1",
          token_processId: "test-process-1",
          token_ticker: "TEST1",
        },
        {
          token_name: "Test Token 2",
          token_processId: "test-process-2",
          token_ticker: "TEST2",
        },
      ]);

      const result = await resolveToken("test", "testHubId");

      expect(result).toEqual({
        matches: ["test-process-1", "test-process-2"],
        requiresVerification: true,
        resolved: false,
        verificationMessage: expect.stringContaining("Multiple tokens found"),
      });
    });

    it("should handle no token found", async () => {
      (mockFetchEvents as any).mockResolvedValue([]);

      const result = await resolveToken("unknown", "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'No token found for "unknown". Use saveTokenMapping to register this token.',
      });
    });

    it("should handle invalid token entries gracefully", async () => {
      (mockFetchEvents as any).mockResolvedValue([
        {
          token_name: "Valid Token",
          token_processId: "valid-process-id",
          token_ticker: "VALID",
        },
        {
          // Invalid entry - missing required fields
          token_name: "",
          token_processId: "",
          token_ticker: "",
        },
      ]);

      const result = await resolveToken("valid", "testHubId");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "valid-process-id",
        verificationMessage:
          "Found token: Valid Token (valid-process-id). Continue?",
      });
    });

    it("should handle fetch errors gracefully", async () => {
      (mockFetchEvents as any).mockRejectedValue(new Error("Network error"));

      const result = await resolveToken("test", "testHubId");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage: 'Error resolving token "test": Network error',
      });
    });
  });
});
