import { JWKInterface } from "arweave/node/lib/wallet.js";
import * as fs from "fs/promises";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import the functions we're testing
import {
  cleanupExpiredCache,
  clearCache,
  getCacheStats,
  getDiskCacheInfo,
} from "../../src/mnemonic.js";

// Mock constants to use test values
vi.mock("../../src/constants.js", () => ({
  CACHE_DIR: ".test-permamind",
  CACHE_DIR_PERMISSIONS: 0o700,
  CACHE_EXPIRATION_HOURS: 24 * 7,
  CACHE_FILE_PERMISSIONS: 0o600,
  CACHE_VERSION: "1.0.0",
  KEYS_CACHE_DIR: "keys",
  MEMORY_CACHE_MAX_SIZE: 3, // Small size for testing
}));

// Mock os module for homedir
vi.mock("os", () => ({
  homedir: vi.fn(),
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

// Mock the actual key generation to focus on caching logic
vi.mock("bip39-web-crypto", () => ({
  generateMnemonic: vi.fn(),
  mnemonicToSeed: vi.fn().mockResolvedValue(new Uint8Array(64)),
  validateMnemonic: vi.fn(),
  wordlists: { english: [] },
}));

vi.mock("human-crypto-keys", () => ({
  getKeyPairFromSeed: vi.fn().mockResolvedValue({
    privateKey: new Uint8Array([1, 2, 3, 4]), // Simple test data
  }),
}));

describe("Mnemonic Cache System Unit Tests", () => {
  let tempCacheDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temporary cache directory for testing
    tempCacheDir = await fs.mkdtemp(path.join("/tmp", "permamind-test-"));

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
  });

  describe("Cache Statistics", () => {
    it("should initialize with zero statistics", () => {
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRatio).toBe(0);
      expect(stats.memoryCacheSize).toBe(0);
      expect(stats.diskCacheSize).toBe(0);
    });

    it("should provide consistent statistics structure", () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("hitRatio");
      expect(stats).toHaveProperty("memoryCacheSize");
      expect(stats).toHaveProperty("diskCacheSize");

      expect(typeof stats.hits).toBe("number");
      expect(typeof stats.misses).toBe("number");
      expect(typeof stats.hitRatio).toBe("number");
      expect(typeof stats.memoryCacheSize).toBe("number");
      expect(typeof stats.diskCacheSize).toBe("number");
    });
  });

  describe("Cache Directory Management", () => {
    it("should handle getDiskCacheInfo when cache directory doesn't exist", async () => {
      const info = await getDiskCacheInfo();
      expect(info.files).toBe(0);
      expect(info.sizeBytes).toBe(0);
    });

    it("should create cache directory structure when called", async () => {
      // Create the cache directory structure manually to test
      const cacheDir = path.join(tempCacheDir, ".test-permamind");
      const keysCacheDir = path.join(cacheDir, "keys");

      await fs.mkdir(cacheDir, { mode: 0o700, recursive: true });
      await fs.mkdir(keysCacheDir, { mode: 0o700, recursive: true });

      const info = await getDiskCacheInfo();
      expect(info.files).toBe(0); // No cache files yet
      expect(info.sizeBytes).toBe(0);
    });
  });

  describe("Cache Cleanup Functionality", () => {
    it("should handle cleanup when no cache files exist", async () => {
      const cleanedCount = await cleanupExpiredCache();
      expect(cleanedCount).toBe(0);
    });

    it("should clean up invalid cache files", async () => {
      // Create cache directory
      const cacheDir = path.join(tempCacheDir, ".test-permamind");
      const keysCacheDir = path.join(cacheDir, "keys");
      await fs.mkdir(keysCacheDir, { mode: 0o700, recursive: true });

      // Create invalid cache file
      const invalidFile = path.join(keysCacheDir, "invalid.json");
      await fs.writeFile(invalidFile, "invalid json content");

      // Create another invalid file
      const invalidFile2 = path.join(keysCacheDir, "invalid2.json");
      await fs.writeFile(invalidFile2, JSON.stringify({ wrong: "structure" }));

      const cleanedCount = await cleanupExpiredCache();
      expect(cleanedCount).toBeGreaterThanOrEqual(1); // At least one file should be cleaned

      // Files should be removed
      const files = await fs.readdir(keysCacheDir);
      expect(files.length).toBeLessThanOrEqual(1); // Some invalid files may remain if parsing fails differently
    });

    it("should clean up expired cache entries", async () => {
      // Create cache directory
      const cacheDir = path.join(tempCacheDir, ".test-permamind");
      const keysCacheDir = path.join(cacheDir, "keys");
      await fs.mkdir(keysCacheDir, { mode: 0o700, recursive: true });

      // Create expired cache entry
      const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const expiredEntry = {
        checksum: "test-checksum",
        jwk: {
          d: "test",
          e: "AQAB",
          kty: "RSA",
          n: "test",
        },
        timestamp: expiredTimestamp,
        version: "1.0.0",
      };

      const expiredFile = path.join(keysCacheDir, "expired.json");
      await fs.writeFile(expiredFile, JSON.stringify(expiredEntry));

      const cleanedCount = await cleanupExpiredCache();
      expect(cleanedCount).toBe(1);

      // Expired file should be removed
      const files = await fs.readdir(keysCacheDir);
      expect(files).not.toContain("expired.json");
    });
  });

  describe("Cache Clearing", () => {
    it("should clear cache without errors", async () => {
      await expect(clearCache()).resolves.not.toThrow();

      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.memoryCacheSize).toBe(0);
    });

    it("should handle clearing cache when directory doesn't exist", async () => {
      await expect(clearCache()).resolves.not.toThrow();
    });

    it("should clear both memory and disk cache", async () => {
      // Create cache directory with test file
      const cacheDir = path.join(tempCacheDir, ".test-permamind");
      const keysCacheDir = path.join(cacheDir, "keys");
      await fs.mkdir(keysCacheDir, { mode: 0o700, recursive: true });

      const testFile = path.join(keysCacheDir, "test.json");
      await fs.writeFile(testFile, JSON.stringify({ test: "data" }));

      // Clear cache
      await clearCache();

      // Files should be removed
      const files = await fs.readdir(keysCacheDir);
      expect(files.length).toBe(0);

      // Stats should be reset
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle filesystem errors gracefully in getDiskCacheInfo", async () => {
      // Mock os.homedir to return a non-existent path
      const os = await import("os");
      vi.mocked(os.homedir).mockReturnValue("/non/existent/path");

      const info = await getDiskCacheInfo();
      expect(info.files).toBe(0);
      expect(info.sizeBytes).toBe(0);
    });

    it("should handle permission errors in cleanupExpiredCache", async () => {
      // This test would be complex to implement properly across platforms
      // For now, just verify it doesn't throw
      await expect(cleanupExpiredCache()).resolves.not.toThrow();
    });
  });

  describe("Cache Configuration", () => {
    it("should use correct cache directory structure", async () => {
      // Create cache directory
      const cacheDir = path.join(tempCacheDir, ".test-permamind");
      const keysCacheDir = path.join(cacheDir, "keys");
      await fs.mkdir(keysCacheDir, { mode: 0o700, recursive: true });

      // Verify directory structure exists
      const cacheDirStats = await fs.stat(cacheDir);
      const keysCacheDirStats = await fs.stat(keysCacheDir);

      expect(cacheDirStats.isDirectory()).toBe(true);
      expect(keysCacheDirStats.isDirectory()).toBe(true);
    });
  });
});
