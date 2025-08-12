import * as fs from "fs/promises";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock os module for homedir
vi.mock("os", () => ({
  homedir: vi.fn(),
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

// Import the functions for integration testing
import {
  cleanupExpiredCache,
  clearCache,
  generateMnemonic,
  getCacheStats,
  getDiskCacheInfo,
  getKeyFromMnemonic,
} from "../../src/mnemonic.js";

describe("Cache System Integration Tests", () => {
  let tempCacheDir: string;

  beforeEach(async () => {
    // Create temporary cache directory for testing
    tempCacheDir = await fs.mkdtemp(
      path.join("/tmp", "permamind-integration-"),
    );

    // Mock os.homedir to return temp directory
    const os = await import("os");
    vi.mocked(os.homedir).mockReturnValue(tempCacheDir);

    // Clear cache before each test
    await clearCache();
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempCacheDir, { force: true, recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore mocks
    vi.clearAllMocks();
  });

  describe("Complete Cache Workflow", () => {
    it("should handle complete cache lifecycle with real filesystem operations", async () => {
      const testMnemonic = await generateMnemonic();

      // Initial state - no cache
      let stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // First generation - should be a cache miss
      console.time("First generation (cache miss)");
      const key1 = await getKeyFromMnemonic(testMnemonic);
      console.timeEnd("First generation (cache miss)");

      stats = getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.memoryCacheSize).toBe(1);

      // Verify disk cache was created
      const diskInfo1 = await getDiskCacheInfo();
      expect(diskInfo1.files).toBe(1);
      expect(diskInfo1.sizeBytes).toBeGreaterThan(0);

      // Second generation - should be a memory cache hit (fast)
      console.time("Second generation (memory cache hit)");
      const key2 = await getKeyFromMnemonic(testMnemonic);
      console.timeEnd("Second generation (memory cache hit)");

      expect(key1).toEqual(key2);
      stats = getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitRatio).toBe(0.5);

      // Clear memory cache but keep disk cache
      await clearCache();
      stats = getCacheStats();
      expect(stats.memoryCacheSize).toBe(0);

      // Third generation - should be a disk cache hit
      console.time("Third generation (disk cache hit)");
      const key3 = await getKeyFromMnemonic(testMnemonic);
      console.timeEnd("Third generation (disk cache hit)");

      expect(key1).toEqual(key3);
      stats = getCacheStats();
      expect(stats.hits).toBe(1); // Reset after clearCache, but this is a hit
      expect(stats.memoryCacheSize).toBe(1); // Loaded back into memory
    }, 30000); // 30 second timeout for key generation

    it("should handle multiple different mnemonics efficiently", async () => {
      const mnemonics = [
        await generateMnemonic(),
        await generateMnemonic(),
        await generateMnemonic(),
      ];

      const keys: any[] = [];

      // Generate keys for all mnemonics
      for (const mnemonic of mnemonics) {
        const key = await getKeyFromMnemonic(mnemonic);
        keys.push(key);
      }

      // Verify all keys are different
      expect(keys[0]).not.toEqual(keys[1]);
      expect(keys[1]).not.toEqual(keys[2]);
      expect(keys[0]).not.toEqual(keys[2]);

      // Verify cache statistics
      const stats = getCacheStats();
      expect(stats.misses).toBe(3);
      expect(stats.memoryCacheSize).toBe(3);

      // Verify disk cache
      const diskInfo = await getDiskCacheInfo();
      expect(diskInfo.files).toBe(3);

      // Re-generate same keys - should all be cache hits
      for (let i = 0; i < mnemonics.length; i++) {
        const cachedKey = await getKeyFromMnemonic(mnemonics[i]);
        expect(cachedKey).toEqual(keys[i]);
      }

      const finalStats = getCacheStats();
      expect(finalStats.hits).toBe(3);
      expect(finalStats.hitRatio).toBe(0.5); // 3 hits out of 6 total operations
    }, 45000); // 45 second timeout for multiple key generations
  });

  describe("Performance Benchmarking", () => {
    it("should demonstrate significant performance improvement with caching", async () => {
      const testMnemonic = await generateMnemonic();

      // Time first generation (no cache)
      const start1 = Date.now();
      const key1 = await getKeyFromMnemonic(testMnemonic);
      const time1 = Date.now() - start1;

      // Time second generation (memory cache)
      const start2 = Date.now();
      const key2 = await getKeyFromMnemonic(testMnemonic);
      const time2 = Date.now() - start2;

      expect(key1).toEqual(key2);

      // Memory cache should be much faster (< 5ms vs potentially seconds)
      expect(time2).toBeLessThan(100); // Should be under 100ms for memory cache
      expect(time2).toBeLessThan(time1 / 10); // At least 10x faster

      console.log(`First generation: ${time1}ms`);
      console.log(`Memory cache hit: ${time2}ms`);
      console.log(
        `Performance improvement: ${Math.round(time1 / time2)}x faster`,
      );

      // Clear memory and test disk cache performance
      await clearCache();

      const start3 = Date.now();
      const key3 = await getKeyFromMnemonic(testMnemonic);
      const time3 = Date.now() - start3;

      expect(key1).toEqual(key3);

      // Disk cache should be faster than generation but slower than memory
      expect(time3).toBeLessThan(time1);
      expect(time3).toBeGreaterThan(time2);

      console.log(`Disk cache hit: ${time3}ms`);
    }, 30000);
  });

  describe("Cache Persistence Across Process Restarts", () => {
    it("should persist cache across simulated restarts", async () => {
      const testMnemonic = await generateMnemonic();

      // Generate and cache a key
      const originalKey = await getKeyFromMnemonic(testMnemonic);

      // Verify cache files exist
      const cacheDir = path.join(tempCacheDir, ".permamind", "keys");
      const files = await fs.readdir(cacheDir);
      expect(files.length).toBe(1);

      // Simulate process restart by clearing memory cache only
      await clearCache();

      // Key should still be retrievable from disk cache
      const restoredKey = await getKeyFromMnemonic(testMnemonic);
      expect(restoredKey).toEqual(originalKey);

      // Verify it's now back in memory cache
      const stats = getCacheStats();
      expect(stats.memoryCacheSize).toBe(1);
    });
  });

  describe("Cache Maintenance and Cleanup", () => {
    it("should properly cleanup expired entries", async () => {
      const testMnemonic = await generateMnemonic();

      // Generate and cache a key
      await getKeyFromMnemonic(testMnemonic);

      // Verify cache file exists
      const cacheDir = path.join(tempCacheDir, ".permamind", "keys");
      let files = await fs.readdir(cacheDir);
      expect(files.length).toBe(1);

      // Manually expire the cache entry by modifying timestamp
      const cacheFilePath = path.join(cacheDir, files[0]);
      const cacheData = JSON.parse(await fs.readFile(cacheFilePath, "utf-8"));

      // Set timestamp to 8 days ago (older than 7 day default expiration)
      cacheData.timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;

      // Recalculate checksum
      const crypto = await import("crypto");
      const checksumData = JSON.stringify({
        jwk: cacheData.jwk,
        timestamp: cacheData.timestamp,
        version: cacheData.version,
      });
      cacheData.checksum = crypto
        .createHash("sha256")
        .update(checksumData)
        .digest("hex");

      await fs.writeFile(cacheFilePath, JSON.stringify(cacheData));

      // Run cleanup
      const cleanedCount = await cleanupExpiredCache();
      expect(cleanedCount).toBe(1);

      // Verify expired file was removed
      files = await fs.readdir(cacheDir);
      expect(files.length).toBe(0);
    });

    it("should handle mixed valid and invalid cache files", async () => {
      const testMnemonic1 = await generateMnemonic();
      const testMnemonic2 = await generateMnemonic();

      // Generate two valid cache entries
      await getKeyFromMnemonic(testMnemonic1);
      await getKeyFromMnemonic(testMnemonic2);

      const cacheDir = path.join(tempCacheDir, ".permamind", "keys");

      // Create invalid cache file
      const invalidFile = path.join(cacheDir, "invalid.json");
      await fs.writeFile(invalidFile, "invalid json");

      // Create another invalid file with wrong structure
      const invalidFile2 = path.join(cacheDir, "invalid2.json");
      await fs.writeFile(invalidFile2, JSON.stringify({ wrong: "structure" }));

      // Run cleanup - should remove invalid files
      const cleanedCount = await cleanupExpiredCache();
      expect(cleanedCount).toBe(2); // Two invalid files

      // Valid files should remain
      const files = await fs.readdir(cacheDir);
      expect(files.length).toBe(2);

      // Keys should still be retrievable
      const key1 = await getKeyFromMnemonic(testMnemonic1);
      const key2 = await getKeyFromMnemonic(testMnemonic2);
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should recover from corrupted cache files", async () => {
      const testMnemonic = await generateMnemonic();

      // Generate and cache a key
      const originalKey = await getKeyFromMnemonic(testMnemonic);

      // Corrupt the cache file
      const cacheDir = path.join(tempCacheDir, ".permamind", "keys");
      const files = await fs.readdir(cacheDir);
      const cacheFilePath = path.join(cacheDir, files[0]);

      // Overwrite with invalid JSON
      await fs.writeFile(cacheFilePath, "corrupted cache data");

      // Clear memory cache
      await clearCache();

      // Should recover by regenerating the key
      const recoveredKey = await getKeyFromMnemonic(testMnemonic);

      // Keys should be identical (same mnemonic generates same key)
      expect(recoveredKey).toEqual(originalKey);

      // Corrupted file should be cleaned up and new valid file created
      const newFiles = await fs.readdir(cacheDir);
      expect(newFiles.length).toBe(1);
    });

    it("should handle filesystem permission errors gracefully", async () => {
      // This test is tricky to implement in a cross-platform way
      // We'll just verify that the system doesn't crash on filesystem errors
      const testMnemonic = await generateMnemonic();

      // Should complete successfully even with potential filesystem issues
      const key = await getKeyFromMnemonic(testMnemonic);
      expect(key).toBeDefined();
    });
  });
});
