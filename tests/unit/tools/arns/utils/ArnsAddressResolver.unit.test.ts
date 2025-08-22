import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArnsAddressResolver } from "../../../../../src/tools/arns/utils/ArnsAddressResolver.js";
import { ArnsClientManager } from "../../../../../src/tools/arns/utils/ArnsClientManager.js";

// Mock ArnsClientManager
vi.mock("../../../../../src/tools/arns/utils/ArnsClientManager.js", () => {
  const mockClientManager = {
    getClient: vi.fn(),
    getCurrentNetwork: vi.fn(() => "mainnet"),
    initializeFromEnvironment: vi.fn(),
    switchNetwork: vi.fn(),
  };

  return {
    ArnsClientManager: {
      getInstance: vi.fn(() => mockClientManager),
    },
  };
});

describe("ArnsAddressResolver", () => {
  let mockClientManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientManager = (ArnsClientManager.getInstance as any)();
  });

  describe("isArnsName", () => {
    it("should identify valid ArNS names", () => {
      expect(ArnsAddressResolver.isArnsName("example.ar")).toBe(true);
      expect(ArnsAddressResolver.isArnsName("sub.example.ar")).toBe(true);
      expect(ArnsAddressResolver.isArnsName("test-name.ar")).toBe(true);
    });

    it("should reject invalid ArNS names", () => {
      expect(ArnsAddressResolver.isArnsName("example")).toBe(false);
      expect(ArnsAddressResolver.isArnsName("example.com")).toBe(false);
      expect(ArnsAddressResolver.isArnsName("")).toBe(false);
      expect(ArnsAddressResolver.isArnsName("invalid-.ar")).toBe(false);
      expect(ArnsAddressResolver.isArnsName("-invalid.ar")).toBe(false);
    });
  });

  describe("resolveArnsToAddress", () => {
    it("should resolve valid ArNS name successfully", async () => {
      const mockClient = {
        resolveArNSName: vi.fn().mockResolvedValue("resolved-transaction-id"),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("example.ar");

      expect(result).toEqual({
        requiresVerification: true,
        resolved: true,
        value: "resolved-transaction-id",
        verificationMessage:
          'ArNS name "example.ar" resolved to resolved-transaction-id on mainnet. Continue?',
      });

      expect(
        mockClientManager.initializeFromEnvironment,
      ).toHaveBeenCalledOnce();
      expect(mockClient.resolveArNSName).toHaveBeenCalledWith({
        name: "example",
      });
    });

    it("should handle invalid ArNS name format", async () => {
      const result =
        await ArnsAddressResolver.resolveArnsToAddress("invalid-name");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'Invalid ArNS name format: "invalid-name". Must be a valid ArNS name (e.g., example.ar or sub.example.ar)',
      });

      expect(
        mockClientManager.initializeFromEnvironment,
      ).not.toHaveBeenCalled();
    });

    it("should handle ArNS name resolution failure", async () => {
      const mockClient = {
        resolveArNSName: vi.fn().mockResolvedValue(null),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("nonexistent.ar");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'ArNS name "nonexistent.ar" could not be resolved. The name may not exist or the network may be unavailable. Please verify the name exists and try again.',
      });
    });

    it("should handle client initialization failure", async () => {
      mockClientManager.getClient.mockReturnValue(null);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("example.ar");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'Error resolving ArNS name "example.ar": ArNS client not initialized. Please try using the direct address instead.',
      });
    });

    it("should handle network timeout errors", async () => {
      const mockClient = {
        resolveArNSName: vi
          .fn()
          .mockRejectedValue(new Error("network timeout")),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("example.ar");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'Network timeout resolving ArNS name "example.ar". Please check your internet connection and try again.',
      });
    });

    it("should handle name not found errors", async () => {
      const mockClient = {
        resolveArNSName: vi
          .fn()
          .mockRejectedValue(new Error("name does not exist")),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("missing.ar");

      expect(result).toEqual({
        requiresVerification: false,
        resolved: false,
        verificationMessage:
          'ArNS name "missing.ar" does not exist. Please verify the name spelling and try again.',
      });
    });

    it("should use specified network", async () => {
      const mockClient = {
        resolveArNSName: vi.fn().mockResolvedValue("testnet-id"),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);
      mockClientManager.getCurrentNetwork.mockReturnValue("testnet");

      const result = await ArnsAddressResolver.resolveArnsToAddress(
        "example.ar",
        "testnet",
      );

      expect(result.verificationMessage).toContain("testnet");
      expect(mockClientManager.switchNetwork).toHaveBeenCalledWith("testnet");
    });

    it("should handle undernames correctly", async () => {
      const mockClient = {
        resolveArNSName: vi.fn().mockResolvedValue("undername-id"),
      };
      mockClientManager.getClient.mockReturnValue(mockClient);

      const result =
        await ArnsAddressResolver.resolveArnsToAddress("sub.example.ar");

      expect(result.resolved).toBe(true);
      expect(mockClient.resolveArNSName).toHaveBeenCalledWith({
        name: "sub.example",
      });
    });
  });
});
