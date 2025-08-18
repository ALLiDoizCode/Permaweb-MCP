import { JWKInterface } from "arweave/node/lib/wallet.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProcessCacheService } from "../../../src/services/ProcessCacheService.js";
import { ProcessDiscoveryService } from "../../../src/services/ProcessDiscoveryService.js";

// Mock ProcessDiscoveryService
vi.mock("../../../src/services/ProcessDiscoveryService.js", () => ({
  ProcessDiscoveryService: {
    discoverProcessHandlers: vi.fn(),
    generateProcessMarkdown: vi.fn(),
    inferProcessType: vi.fn(),
  },
}));

const mockKeyPair = {} as JWKInterface;

const mockDiscoveryResponse = {
  handlers: [
    {
      action: "Ping",
      category: "utility",
      description: "Basic ping handler",
      examples: ["ping"],
      parameters: [],
    },
    {
      action: "Balance",
      category: "core",
      description: "Get account balance",
      examples: ["balance", "balance:target=user123"],
      parameters: [
        {
          description: "Target address",
          name: "Target",
          required: false,
          type: "string",
        },
      ],
    },
  ],
  rawResponse: {
    Description: "A test process",
    handlers: [
      { action: "Ping", description: "Basic ping handler" },
      { action: "Balance", description: "Get account balance" },
    ],
    Name: "Test Process",
    protocolVersion: "1.0.0",
  },
  success: true,
};

describe("ProcessCacheService", () => {
  const processId = "test-process-id";

  beforeEach(() => {
    vi.clearAllMocks();
    ProcessCacheService.clearAllCache();
  });

  afterEach(() => {
    ProcessCacheService.clearAllCache();
  });

  describe("getProcessInfo", () => {
    it("should discover and cache process information on first call", async () => {
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      const mockGenerateMarkdown = vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      );
      const mockInferType = vi.mocked(ProcessDiscoveryService.inferProcessType);

      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      mockGenerateMarkdown.mockReturnValue(
        "# Test Process\n\n## Handlers\n...",
      );
      mockInferType.mockReturnValue("custom");

      const result = await ProcessCacheService.getProcessInfo(
        processId,
        mockKeyPair,
      );

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.processId).toBe(processId);
      expect(result?.handlers).toHaveLength(2);
      expect(result?.processMarkdown).toBe(
        "# Test Process\n\n## Handlers\n...",
      );
      expect(result?.processType).toBe("custom");

      // Verify discovery was called
      expect(mockProcessDiscovery).toHaveBeenCalledWith(processId, mockKeyPair);
      expect(mockGenerateMarkdown).toHaveBeenCalled();
      expect(mockInferType).toHaveBeenCalled();
    });

    it("should return cached result on subsequent calls", async () => {
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Cached Process");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "token",
      );

      // First call - should discover
      const firstResult = await ProcessCacheService.getProcessInfo(
        processId,
        mockKeyPair,
      );
      expect(mockProcessDiscovery).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const secondResult = await ProcessCacheService.getProcessInfo(
        processId,
        mockKeyPair,
      );
      expect(mockProcessDiscovery).toHaveBeenCalledTimes(1); // Still only called once

      // Results should be identical
      expect(firstResult).toEqual(secondResult);
      expect(secondResult?.processMarkdown).toBe("# Cached Process");
    });

    it("should force refresh when requested", async () => {
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Refreshed Process");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "dao",
      );

      // First call
      await ProcessCacheService.getProcessInfo(processId, mockKeyPair);
      expect(mockProcessDiscovery).toHaveBeenCalledTimes(1);

      // Force refresh
      await ProcessCacheService.getProcessInfo(processId, mockKeyPair, true);
      expect(mockProcessDiscovery).toHaveBeenCalledTimes(2);
    });

    it("should return null when discovery fails", async () => {
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue({
        error: "Process not found",
        success: false,
      });

      const result = await ProcessCacheService.getProcessInfo(
        processId,
        mockKeyPair,
      );

      expect(result).toBeNull();
    });

    it("should handle discovery exceptions gracefully", async () => {
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await ProcessCacheService.getProcessInfo(
        processId,
        mockKeyPair,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Failed to discover process ${processId}:`,
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("cache management", () => {
    beforeEach(async () => {
      // Setup cache with test data
      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Test");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "custom",
      );

      await ProcessCacheService.getProcessInfo(processId, mockKeyPair);
    });

    it("should retrieve cached process info", () => {
      const cached = ProcessCacheService.getCachedProcessInfo(processId);
      expect(cached).toBeDefined();
      expect(cached?.processId).toBe(processId);
    });

    it("should return cached actions", () => {
      const actions = ProcessCacheService.getCachedActions(processId);
      expect(actions).toEqual(["Ping", "Balance"]);
    });

    it("should check if process supports action", () => {
      expect(ProcessCacheService.supportsAction(processId, "Ping")).toBe(true);
      expect(ProcessCacheService.supportsAction(processId, "ping")).toBe(true); // case insensitive
      expect(ProcessCacheService.supportsAction(processId, "Transfer")).toBe(
        false,
      );
    });

    it("should return cached markdown", () => {
      const markdown = ProcessCacheService.getCachedMarkdown(processId);
      expect(markdown).toBe("# Test");
    });

    it("should return cached process type", () => {
      const type = ProcessCacheService.getCachedProcessType(processId);
      expect(type).toBe("custom");
    });

    it("should clear specific process cache", () => {
      ProcessCacheService.clearProcessCache(processId);
      const cached = ProcessCacheService.getCachedProcessInfo(processId);
      expect(cached).toBeNull();
    });

    it("should clear all cache", () => {
      ProcessCacheService.clearAllCache();
      const cached = ProcessCacheService.getCachedProcessInfo(processId);
      expect(cached).toBeNull();
    });
  });

  describe("cache expiration", () => {
    it("should expire cache after TTL", async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000000000; // Start time

      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Test");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "custom",
      );

      // Cache process info
      await ProcessCacheService.getProcessInfo(processId, mockKeyPair);
      expect(ProcessCacheService.getCachedProcessInfo(processId)).toBeDefined();

      // Fast forward past TTL (5 minutes)
      currentTime += 6 * 60 * 1000; // 6 minutes

      // Cache should be expired
      expect(ProcessCacheService.getCachedProcessInfo(processId)).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });

    it("should clean up expired entries", async () => {
      // Setup multiple cached entries at different times
      const originalNow = Date.now;
      let currentTime = 1000000000000;

      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Test");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "custom",
      );

      // Cache first process
      await ProcessCacheService.getProcessInfo("process1", mockKeyPair);

      // Advance time by 2 minutes
      currentTime += 2 * 60 * 1000; // 2 minutes

      // Cache second process
      await ProcessCacheService.getProcessInfo("process2", mockKeyPair);

      // Advance time by 4 more minutes (total: 6min from first, 4min from second)
      currentTime += 4 * 60 * 1000; // First is now expired (6min > 5min TTL), second is not (4min < 5min TTL)

      // Clean up should remove first but not second
      const removed = ProcessCacheService.cleanupExpiredCache();
      expect(removed).toBe(1);

      expect(ProcessCacheService.getCachedProcessInfo("process1")).toBeNull();
      expect(
        ProcessCacheService.getCachedProcessInfo("process2"),
      ).toBeDefined();

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe("cache statistics", () => {
    it("should return accurate cache statistics", async () => {
      const originalNow = Date.now;
      let currentTime = 1000000000000;

      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      const mockProcessDiscovery = vi.mocked(
        ProcessDiscoveryService.discoverProcessHandlers,
      );
      mockProcessDiscovery.mockResolvedValue(mockDiscoveryResponse);
      vi.mocked(
        ProcessDiscoveryService.generateProcessMarkdown,
      ).mockReturnValue("# Test");
      vi.mocked(ProcessDiscoveryService.inferProcessType).mockReturnValue(
        "custom",
      );

      // Add some cache entries
      await ProcessCacheService.getProcessInfo("process1", mockKeyPair);
      await ProcessCacheService.getProcessInfo("process2", mockKeyPair);

      // All should be valid
      let stats = ProcessCacheService.getCacheStats();
      expect(stats.totalCached).toBe(2);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(0);

      // Advance time to expire first entry
      currentTime += 6 * 60 * 1000; // 6 minutes

      stats = ProcessCacheService.getCacheStats();
      expect(stats.totalCached).toBe(2);
      expect(stats.valid).toBe(0); // Both expired due to time advancement
      expect(stats.expired).toBe(2);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe("edge cases", () => {
    it("should handle empty actions array", () => {
      expect(ProcessCacheService.getCachedActions("nonexistent")).toEqual([]);
    });

    it("should handle null cached info gracefully", () => {
      expect(ProcessCacheService.getCachedMarkdown("nonexistent")).toBeNull();
      expect(
        ProcessCacheService.getCachedProcessType("nonexistent"),
      ).toBeNull();
      expect(ProcessCacheService.supportsAction("nonexistent", "Ping")).toBe(
        false,
      );
    });
  });
});
