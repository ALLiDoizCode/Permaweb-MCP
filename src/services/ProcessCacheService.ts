import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  DocumentationProtocolService,
  ExtendedInfoResponse,
  HandlerMetadata,
} from "./DocumentationProtocolService.js";
import { ProcessDiscoveryService } from "./ProcessDiscoveryService.js";

/**
 * Cached process information including handlers and metadata
 */
export interface CachedProcessInfo {
  discovereredAt: number;
  handlers: HandlerMetadata[];
  processId: string;
  processMarkdown: string;
  processType: string;
  rawResponse: ExtendedInfoResponse;
  success: boolean;
}

/**
 * Service for caching process handler information to avoid repeated Info calls
 * Automatically discovers and caches process capabilities when new process IDs are encountered
 */
export class ProcessCacheService {
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static processCache = new Map<string, CachedProcessInfo>();

  /**
   * Clean up expired cache entries
   */
  static cleanupExpiredCache(): number {
    const now = Date.now();
    let removed = 0;

    for (const [processId, cached] of this.processCache.entries()) {
      if (now - cached.discovereredAt >= this.CACHE_TTL_MS) {
        this.processCache.delete(processId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all cached process information
   */
  static clearAllCache(): void {
    this.processCache.clear();
  }

  /**
   * Clear cache for a specific process
   */
  static clearProcessCache(processId: string): void {
    this.processCache.delete(processId);
  }

  /**
   * Get available actions for a process from cache
   */
  static getCachedActions(processId: string): string[] {
    const cached = this.getCachedProcessInfo(processId);
    if (!cached || !cached.handlers) {
      return [];
    }

    return cached.handlers.map((handler) => handler.action);
  }

  /**
   * Get process markdown documentation from cache
   */
  static getCachedMarkdown(processId: string): null | string {
    const cached = this.getCachedProcessInfo(processId);
    return cached?.processMarkdown || null;
  }

  /**
   * Get process handlers from cache only (no discovery)
   */
  static getCachedProcessInfo(processId: string): CachedProcessInfo | null {
    const cached = this.processCache.get(processId);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.discovereredAt >= this.CACHE_TTL_MS) {
      this.processCache.delete(processId);
      return null;
    }

    return cached;
  }

  /**
   * Get inferred process type from cache
   */
  static getCachedProcessType(processId: string): null | string {
    const cached = this.getCachedProcessInfo(processId);
    return cached?.processType || null;
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    expired: number;
    totalCached: number;
    valid: number;
  } {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    for (const cached of this.processCache.values()) {
      if (now - cached.discovereredAt >= this.CACHE_TTL_MS) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      expired,
      totalCached: this.processCache.size,
      valid,
    };
  }

  /**
   * Get cached process information or discover it if not cached
   * This is the main entry point that should be called whenever a new process ID is encountered
   */
  static async getProcessInfo(
    processId: string,
    keyPair: JWKInterface,
    forceRefresh = false,
  ): Promise<CachedProcessInfo | null> {
    // Check cache first
    if (!forceRefresh && this.processCache.has(processId)) {
      const cached = this.processCache.get(processId)!;
      const now = Date.now();

      // Return cached if still valid
      if (now - cached.discovereredAt < this.CACHE_TTL_MS) {
        return cached;
      }

      // Remove expired cache entry
      this.processCache.delete(processId);
    }

    // Discover process handlers
    try {
      const discovery = await ProcessDiscoveryService.discoverProcessHandlers(
        processId,
        keyPair,
      );

      if (!discovery.success) {
        return null;
      }

      // Generate process markdown
      const processMarkdown = discovery.rawResponse
        ? ProcessDiscoveryService.generateProcessMarkdown(
            discovery.rawResponse,
            processId,
          )
        : "";

      // Infer process type
      const processType = discovery.rawResponse
        ? ProcessDiscoveryService.inferProcessType(discovery.rawResponse)
        : "unknown";

      // Create cached info
      const cachedInfo: CachedProcessInfo = {
        discovereredAt: Date.now(),
        handlers: discovery.handlers || [],
        processId,
        processMarkdown,
        processType,
        rawResponse: discovery.rawResponse,
        success: true,
      };

      // Cache the result
      this.processCache.set(processId, cachedInfo);

      return cachedInfo;
    } catch (error) {
      console.error(`Failed to discover process ${processId}:`, error);
      return null;
    }
  }

  /**
   * Check if a process supports a specific action
   */
  static supportsAction(processId: string, action: string): boolean {
    const actions = this.getCachedActions(processId);
    return actions.some((a) => a.toLowerCase() === action.toLowerCase());
  }
}
