import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArnsClientManager } from "../../../../../src/tools/arns/utils/ArnsClientManager.js";

// Mock the ar-io-sdk
vi.mock("@ar.io/sdk/node", () => ({
  ARIO: {
    mainnet: vi.fn(() => ({ network: "mainnet" })),
    testnet: vi.fn(() => ({ network: "testnet" })),
  },
}));

describe("ArnsClientManager", () => {
  let manager: ArnsClientManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ArnsClientManager as any).instance = undefined;
    manager = ArnsClientManager.getInstance();
    manager.resetForTesting(); // Reset client state
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.ARNS_NETWORK;
    vi.restoreAllMocks();
  });

  describe("singleton pattern", () => {
    it("should implement singleton pattern", () => {
      const instance1 = ArnsClientManager.getInstance();
      const instance2 = ArnsClientManager.getInstance();
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ArnsClientManager);
    });

    it("should return same instance across multiple calls", () => {
      const instances = Array.from({ length: 5 }, () =>
        ArnsClientManager.getInstance(),
      );
      const firstInstance = instances[0];

      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });
    });
  });

  describe("client initialization", () => {
    it("should initialize mainnet client by default", async () => {
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeClient();

      expect(ARIO.mainnet).toHaveBeenCalledOnce();
      expect(ARIO.testnet).not.toHaveBeenCalled();
      expect(manager.getCurrentNetwork()).toBe("mainnet");
      expect(manager.isInitialized()).toBe(true);
    });

    it("should initialize testnet client when specified", async () => {
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeClient("testnet");

      expect(ARIO.testnet).toHaveBeenCalledOnce();
      expect(ARIO.mainnet).not.toHaveBeenCalled();
      expect(manager.getCurrentNetwork()).toBe("testnet");
      expect(manager.isInitialized()).toBe(true);
    });

    it("should throw error for invalid network", async () => {
      await expect(manager.initializeClient("invalid" as any)).rejects.toThrow(
        "Invalid network: invalid. Must be 'mainnet' or 'testnet'",
      );
    });

    it("should handle initialization failures gracefully", async () => {
      const { ARIO } = await import("@ar.io/sdk/node");
      (ARIO.mainnet as any).mockImplementation(() => {
        throw new Error("Network connection failed");
      });

      await expect(manager.initializeClient("mainnet")).rejects.toThrow(
        "Failed to initialize ArNS client for mainnet: Network connection failed",
      );
    });
  });

  describe("network switching", () => {
    it("should switch networks correctly", async () => {
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeClient("mainnet");
      expect(manager.getCurrentNetwork()).toBe("mainnet");

      await manager.switchNetwork("testnet");
      expect(manager.getCurrentNetwork()).toBe("testnet");
      expect(ARIO.testnet).toHaveBeenCalled();
    });

    it("should not reinitialize if already on target network", async () => {
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeClient("mainnet");
      vi.clearAllMocks();

      await manager.switchNetwork("mainnet");
      expect(ARIO.mainnet).not.toHaveBeenCalled();
      expect(ARIO.testnet).not.toHaveBeenCalled();
    });
  });

  describe("environment configuration", () => {
    it("should use mainnet by default when ARNS_NETWORK not set", async () => {
      delete process.env.ARNS_NETWORK;

      await manager.initializeFromEnvironment();

      expect(manager.getCurrentNetwork()).toBe("mainnet");
      expect(manager.isInitialized()).toBe(true);
    });

    it("should use testnet when ARNS_NETWORK=testnet", async () => {
      process.env.ARNS_NETWORK = "testnet";

      await manager.initializeFromEnvironment();

      expect(manager.getCurrentNetwork()).toBe("testnet");
      expect(manager.isInitialized()).toBe(true);
    });

    it("should use mainnet when ARNS_NETWORK=mainnet", async () => {
      process.env.ARNS_NETWORK = "mainnet";
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeFromEnvironment();

      expect(ARIO.mainnet).toHaveBeenCalled();
      expect(manager.getCurrentNetwork()).toBe("mainnet");
    });

    it("should default to mainnet for invalid ARNS_NETWORK values", async () => {
      process.env.ARNS_NETWORK = "invalid";
      const { ARIO } = await import("@ar.io/sdk/node");

      await manager.initializeFromEnvironment();

      expect(ARIO.mainnet).toHaveBeenCalled();
      expect(manager.getCurrentNetwork()).toBe("mainnet");
    });

    it("should handle case-insensitive environment values", async () => {
      process.env.ARNS_NETWORK = "TESTNET";

      await manager.initializeFromEnvironment();

      expect(manager.getCurrentNetwork()).toBe("testnet");
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe("client state management", () => {
    it("should return undefined client before initialization", () => {
      expect(manager.getClient()).toBeUndefined();
      expect(manager.isInitialized()).toBe(false);
    });

    it("should return client after initialization", async () => {
      await manager.initializeClient("mainnet");

      const client = manager.getClient();
      expect(client).toBeDefined();
      expect(client).toEqual({ network: "mainnet" });
      expect(manager.isInitialized()).toBe(true);
    });

    it("should track current network correctly", async () => {
      expect(manager.getCurrentNetwork()).toBe("mainnet"); // default

      await manager.initializeClient("testnet");
      expect(manager.getCurrentNetwork()).toBe("testnet");

      await manager.switchNetwork("mainnet");
      expect(manager.getCurrentNetwork()).toBe("mainnet");
    });
  });
});
