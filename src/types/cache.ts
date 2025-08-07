import { JWKInterface } from "arweave/node/lib/wallet.js";

/**
 * Cache configuration options
 */
export interface CacheConfig {
  cacheDir: string;
  enableDiskCache: boolean;
  enableMemoryCache: boolean;
  expirationHours: number;
  keysCacheDir: string;
  maxMemorySize: number;
}

/**
 * Cache entry structure for storing generated keys
 */
export interface CacheEntry {
  checksum: string;
  jwk: JWKInterface;
  timestamp: number;
  version: string;
}

/**
 * Cache statistics for monitoring and performance metrics
 */
export interface CacheStats {
  diskCacheSize: number;
  hitRatio: number;
  hits: number;
  memoryCacheSize: number;
  misses: number;
}
