import { JWKInterface } from "arweave/node/lib/wallet.js";
import {
  generateMnemonic as bip39Generate,
  validateMnemonic as bip39Validate,
  mnemonicToSeed,
  wordlists,
} from "bip39-web-crypto";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import { getKeyPairFromSeed } from "human-crypto-keys";
import * as os from "os";
import * as path from "path";

import type { CacheEntry, CacheStats } from "./types/cache.js";

import {
  CACHE_DIR,
  CACHE_DIR_PERMISSIONS,
  CACHE_EXPIRATION_HOURS,
  CACHE_FILE_PERMISSIONS,
  CACHE_VERSION,
  KEYS_CACHE_DIR,
  MEMORY_CACHE_MAX_SIZE,
} from "./constants.js";

/**
 * In-memory cache for generated keys
 * Uses LRU eviction policy to prevent unbounded memory growth
 */
class MemoryCache {
  private cache = new Map<
    string,
    { entry: CacheEntry; lastAccessed: number }
  >();
  private maxSize: number;

  constructor(maxSize: number = MEMORY_CACHE_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  clear(): void {
    this.cache.clear();
  }

  get(key: string): CacheEntry | undefined {
    const item = this.cache.get(key);
    if (item) {
      item.lastAccessed = Date.now();
      return item.entry;
    }
    return undefined;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  set(key: string, entry: CacheEntry): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { entry, lastAccessed: Date.now() });
  }

  size(): number {
    return this.cache.size;
  }

  private findOldestKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

/**
 * Generate a 12 word mnemonic for an Arweave key
 * @returns {string} - a promise resolving to a 12 word mnemonic seed phrase
 */
export async function generateMnemonic() {
  return await bip39Generate(128, undefined, wordlists.english);
}

/**
 * Generates a JWK object representation of an Arweave key
 * @param mnemonic - a 12 word mnemonic represented as a string
 * @returns {object} - returns a Javascript object that conforms to the JWKInterface required by Arweave-js
 *
 * @example <caption>Generate an Arweave key and get its public address</caption>
 * let key = getKeyFromMnemonic('jewel cave spy act loyal solid night manual joy select mystery unhappy')
 * arweave.wallets.jwkToAddress(key)
 * //returns qe741op_rt-iwBazAqJipTc15X8INlDCoPz6S40RBdg
 *
 */

export async function getKeyFromMnemonic(
  mnemonic: string,
  options: {
    nonBlocking?: boolean;
    onProgress?: (
      stage: string,
      percentage: number,
      estimatedTimeMs?: number,
    ) => void;
    priority?: "high" | "low" | "normal";
  } = {},
) {
  // Generate hash for cache lookup
  const mnemonicHash = getMnemonicHash(mnemonic);

  // Try to get from cache first
  const cachedKey = await getCachedKey(mnemonicHash);
  if (cachedKey) {
    return cachedKey;
  }

  // Cache miss - generate new key
  // Use worker thread if non-blocking is enabled (default: true)
  const useWorkerThread = options.nonBlocking !== false;

  if (useWorkerThread) {
    try {
      const { getWorkerPool } = await import("./worker-pool.js");
      const workerPool = getWorkerPool();

      const jwk = await workerPool.generateKey(mnemonic, {
        onProgress: options.onProgress,
        priority: options.priority,
      });

      // Cache the generated key
      await setCachedKey(mnemonicHash, jwk);

      return jwk;
    } catch (error) {
      // Fallback to synchronous generation on worker failure
      console.warn(
        "Worker thread failed, falling back to synchronous generation:",
        error,
      );
    }
  }

  // Synchronous generation (fallback or explicitly requested)
  if (options.onProgress) {
    options.onProgress("initialization", 0, 4000);
  }

  const seedBuffer = await mnemonicToSeed(mnemonic);

  if (options.onProgress) {
    options.onProgress("key_generation", 50, 2000);
  }

  const { privateKey } = await getKeyPairFromSeed(
    // @ts-expect-error: seedBuffer type mismatch with library expectations
    seedBuffer,
    {
      id: "rsa",
      modulusLength: 4096,
    },
    { privateKeyFormat: "pkcs8-der" },
  );

  if (options.onProgress) {
    options.onProgress("jwk_conversion", 75, 500);
  }

  const jwk = await pkcs8ToJwk(privateKey as unknown as Uint8Array);

  if (options.onProgress) {
    options.onProgress("complete", 100, 0);
  }

  // Cache the generated key
  await setCachedKey(mnemonicHash, jwk);

  return jwk;
}

export async function pkcs8ToJwk(
  privateKey: Uint8Array,
): Promise<JWKInterface> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKey,
    { hash: "SHA-256", name: "RSA-PSS" },
    true,
    ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);

  return {
    d: jwk.d,
    dp: jwk.dp,
    dq: jwk.dq,
    e: jwk.e!,
    kty: jwk.kty!,
    n: jwk.n!,
    p: jwk.p,
    q: jwk.q,
    qi: jwk.qi,
  };
}

// Cache Management Implementation

/**
 * Validate a mnemonic seed phrase
 * @param mnemonic - a 12 word mnemonic represented as a string
 * @returns {Promise<boolean>} - true if the mnemonic is valid, false otherwise
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  try {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      return false;
    }
    const result = await bip39Validate(mnemonic, wordlists.english);
    return result;
  } catch {
    return false;
  }
}

/**
 * Global memory cache instance
 */
const memoryCache = new MemoryCache();

/**
 * Cache statistics tracker
 */
let cacheStats: CacheStats = {
  diskCacheSize: 0,
  hitRatio: 0,
  hits: 0,
  memoryCacheSize: 0,
  misses: 0,
};

/**
 * Cleanup expired cache entries from disk
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const keysCachePath = await ensureCacheDirectory();
    const files = await fs.readdir(keysCachePath);
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(keysCachePath, file);
      try {
        const data = await fs.readFile(filePath, "utf-8");
        const entry: CacheEntry = JSON.parse(data);

        if (isExpired(entry)) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      } catch {
        // Invalid file format - remove it
        await fs.unlink(filePath).catch(() => {
          /* Ignore cleanup errors */
        });
        cleanedCount++;
      }
    }

    return cleanedCount;
  } catch (error) {
    throw new Error(
      `Failed to cleanup expired cache: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Clear all caches (memory and disk)
 */
export async function clearCache(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();

  try {
    // Clear disk cache
    const keysCachePath = await ensureCacheDirectory();
    const files = await fs.readdir(keysCachePath);

    const deletePromises = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => fs.unlink(path.join(keysCachePath, file)));

    await Promise.all(deletePromises);
  } catch (error) {
    throw new Error(
      `Failed to clear disk cache: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Reset statistics
  cacheStats = {
    diskCacheSize: 0,
    hitRatio: 0,
    hits: 0,
    memoryCacheSize: 0,
    misses: 0,
  };
}

/**
 * Get current cache statistics
 */
export function getCacheStats(): CacheStats {
  updateCacheStats();
  return { ...cacheStats };
}

/**
 * Get disk cache size and file count
 */
export async function getDiskCacheInfo(): Promise<{
  files: number;
  sizeBytes: number;
}> {
  try {
    const keysCachePath = await ensureCacheDirectory();
    const files = await fs.readdir(keysCachePath);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(keysCachePath, file);
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileCount++;
      } catch {
        // Ignore files that can't be accessed
      }
    }

    cacheStats.diskCacheSize = fileCount;
    return { files: fileCount, sizeBytes: totalSize };
  } catch {
    return { files: 0, sizeBytes: 0 };
  }
}

/**
 * Calculate checksum for cache entry validation
 */
function calculateChecksum(entry: CacheEntry): string {
  const data = JSON.stringify({
    jwk: entry.jwk,
    timestamp: entry.timestamp,
    version: entry.version,
  });
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Create cache directory structure with secure permissions
 */
async function ensureCacheDirectory(): Promise<string> {
  const homeDir = os.homedir();
  const cacheBasePath = path.join(homeDir, CACHE_DIR);
  const keysCachePath = path.join(cacheBasePath, KEYS_CACHE_DIR);

  try {
    // Create base cache directory
    await fs.mkdir(cacheBasePath, {
      mode: CACHE_DIR_PERMISSIONS,
      recursive: true,
    });

    // Create keys cache subdirectory
    await fs.mkdir(keysCachePath, {
      mode: CACHE_DIR_PERMISSIONS,
      recursive: true,
    });

    // Ensure proper permissions on existing directories
    await fs.chmod(cacheBasePath, CACHE_DIR_PERMISSIONS);
    await fs.chmod(keysCachePath, CACHE_DIR_PERMISSIONS);

    return keysCachePath;
  } catch (error) {
    throw new Error(
      `Failed to create cache directory: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get cached key from memory or disk
 */
async function getCachedKey(
  mnemonicHash: string,
): Promise<JWKInterface | undefined> {
  // Check memory cache first
  const memoryCacheEntry = memoryCache.get(mnemonicHash);
  if (memoryCacheEntry && validateCacheEntry(memoryCacheEntry)) {
    cacheStats.hits++;
    updateCacheStats();
    return memoryCacheEntry.jwk;
  }

  // Check disk cache
  const diskCacheEntry = await readDiskCache(mnemonicHash);
  if (diskCacheEntry) {
    // Store in memory cache for future access
    memoryCache.set(mnemonicHash, diskCacheEntry);
    cacheStats.hits++;
    updateCacheStats();
    return diskCacheEntry.jwk;
  }

  cacheStats.misses++;
  updateCacheStats();
  return undefined;
}

/**
 * Generate a hash from mnemonic for cache key
 */
function getMnemonicHash(mnemonic: string): string {
  return crypto.createHash("sha256").update(mnemonic.trim()).digest("hex");
}

/**
 * Check if cache entry is expired
 */
function isExpired(entry: CacheEntry): boolean {
  const expirationTime =
    entry.timestamp + CACHE_EXPIRATION_HOURS * 60 * 60 * 1000;
  return Date.now() > expirationTime;
}

/**
 * Read cache entry from disk
 */
async function readDiskCache(
  mnemonicHash: string,
): Promise<CacheEntry | undefined> {
  try {
    const keysCachePath = await ensureCacheDirectory();
    const cacheFilePath = path.join(keysCachePath, `${mnemonicHash}.json`);

    const data = await fs.readFile(cacheFilePath, "utf-8");
    const entry: CacheEntry = JSON.parse(data);

    if (!validateCacheEntry(entry)) {
      // Remove corrupted/expired cache file
      await fs.unlink(cacheFilePath).catch(() => {
        /* Ignore cleanup errors */
      });
      return undefined;
    }

    return entry;
  } catch {
    // File doesn't exist or other error - not a problem
    return undefined;
  }
}

/**
 * Cache generated key in memory and disk
 */
async function setCachedKey(
  mnemonicHash: string,
  jwk: JWKInterface,
): Promise<void> {
  const entry: CacheEntry = {
    checksum: "",
    jwk,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  };

  // Calculate checksum after creating entry structure
  entry.checksum = calculateChecksum(entry);

  // Store in memory cache
  memoryCache.set(mnemonicHash, entry);

  // Store in disk cache (async, don't wait)
  writeDiskCache(mnemonicHash, entry).catch((error) => {
    // Log error but don't fail the operation
    console.error("Failed to write disk cache:", error);
  });
}

// Secure memory cleanup on process exit
function setupProcessExitHandlers(): void {
  const cleanup = async () => {
    try {
      memoryCache.clear();

      // Shutdown worker pool if it was created
      const { shutdownWorkerPool } = await import("./worker-pool.js").catch(
        () => ({ shutdownWorkerPool: null }),
      );
      if (shutdownWorkerPool) {
        await shutdownWorkerPool().catch(() => {
          // Ignore worker pool shutdown errors during exit
        });
      }
    } catch {
      // Ignore cleanup errors
    }
  };

  process.on("exit", () => cleanup().catch(() => {}));
  process.on("SIGINT", () =>
    cleanup()
      .then(() => process.exit())
      .catch(() => process.exit()),
  );
  process.on("SIGTERM", () =>
    cleanup()
      .then(() => process.exit())
      .catch(() => process.exit()),
  );
  process.on("uncaughtException", () =>
    cleanup()
      .then(() => process.exit(1))
      .catch(() => process.exit(1)),
  );
}

/**
 * Update cache statistics
 */
function updateCacheStats(): void {
  const total = cacheStats.hits + cacheStats.misses;
  cacheStats.hitRatio = total > 0 ? cacheStats.hits / total : 0;
  cacheStats.memoryCacheSize = memoryCache.size();
}

/**
 * Validate cache entry integrity
 */
function validateCacheEntry(entry: CacheEntry): boolean {
  try {
    // Check required fields
    if (!entry.jwk || !entry.timestamp || !entry.checksum || !entry.version) {
      return false;
    }

    // Validate checksum
    const expectedChecksum = calculateChecksum(entry);
    if (entry.checksum !== expectedChecksum) {
      return false;
    }

    // Check if expired
    if (isExpired(entry)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Write cache entry to disk
 */
async function writeDiskCache(
  mnemonicHash: string,
  entry: CacheEntry,
): Promise<void> {
  try {
    const keysCachePath = await ensureCacheDirectory();
    const cacheFilePath = path.join(keysCachePath, `${mnemonicHash}.json`);

    // Write atomically using a temporary file
    const tempFilePath = `${cacheFilePath}.tmp`;
    const data = JSON.stringify(entry, null, 2);

    await fs.writeFile(tempFilePath, data, {
      mode: CACHE_FILE_PERMISSIONS,
    });

    // Atomic move
    await fs.rename(tempFilePath, cacheFilePath);
  } catch (error) {
    throw new Error(
      `Failed to write disk cache: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Initialize process exit handlers
setupProcessExitHandlers();
