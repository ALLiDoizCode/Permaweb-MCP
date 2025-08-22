import { JWKInterface } from "arweave/node/lib/wallet.js";

import type { ResolutionResult } from "../tools/token/utils/TokenResolver.js";

import { ArnsAddressResolver } from "../tools/arns/utils/ArnsAddressResolver.js";
import { ArnsClientManager } from "../tools/arns/utils/ArnsClientManager.js";
import { aiMemoryService, MEMORY_KINDS } from "./aiMemoryService.js";

/**
 * ArNS Integration Service
 * Provides centralized ArNS operations, caching, and cross-tool integration
 */

export interface ArnsMapping {
  arnsName: string;
  network: "mainnet" | "testnet";
  resolvedAddress: string;
  resolvedAt: string;
  ttl?: number;
}

// ArNS operation metadata interfaces
export interface ArnsOperation {
  arnsName: string;
  metadata: Record<string, unknown>;
  network?: "mainnet" | "testnet";
  operation: "registration" | "transfer" | "update";
  timestamp: string;
  transactionId: string;
}

// Cache for ArNS name resolutions
const resolutionCache = new Map<
  string,
  {
    cachedAt: number;
    result: ResolutionResult<string>;
    ttl: number;
  }
>();

// Default cache TTL (5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * ArNS Integration Service
 * Centralizes ArNS operations across Permamind tools
 */
export class ArnsIntegrationService {
  private static clientManager = ArnsClientManager.getInstance();

  /**
   * Clear ArNS resolution cache
   * @param arnsName - Optional specific name to clear (clears all if not provided)
   */
  static clearResolutionCache(arnsName?: string): void {
    if (arnsName) {
      // Clear specific name from all networks
      for (const key of resolutionCache.keys()) {
        if (key.startsWith(`${arnsName}:`)) {
          resolutionCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      resolutionCache.clear();
    }
  }

  /**
   * Get ArNS operation history for a specific name or operation type
   * @param hubId - Hub ID to search
   * @param arnsName - Optional ArNS name filter
   * @param operation - Optional operation type filter
   * @returns Promise resolving to operation history
   */
  static async getArnsOperationHistory(
    hubId: string,
    arnsName?: string,
    operation?: "registration" | "transfer" | "update",
  ) {
    try {
      return await aiMemoryService.getArnsOperationHistory(
        hubId,
        arnsName,
        operation,
      );
    } catch (error) {
      throw new Error(`Failed to get ArNS operation history: ${error}`);
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  static getCacheStats(): {
    entries: string[];
    oldestEntry: null | string;
    size: number;
    totalHits: number;
  } {
    const entries = Array.from(resolutionCache.keys());
    const now = Date.now();
    let oldestEntry: null | string = null;
    let oldestTime = now;

    // Find oldest entry
    for (const [key, cached] of resolutionCache.entries()) {
      if (cached.cachedAt < oldestTime) {
        oldestTime = cached.cachedAt;
        oldestEntry = key;
      }
    }

    // Count successful resolutions (approximate hit count)
    const totalHits = entries.filter((key) => {
      const cached = resolutionCache.get(key);
      return cached && cached.result.resolved;
    }).length;

    return {
      entries,
      oldestEntry,
      size: resolutionCache.size,
      totalHits,
    };
  }

  /**
   * Get current network configuration
   * @returns Current network name
   */
  static getCurrentNetwork(): "mainnet" | "testnet" {
    return this.clientManager.getCurrentNetwork();
  }

  /**
   * Health check for ArNS integration
   * @returns Health status
   */
  static async healthCheck(): Promise<{
    cacheSize: number;
    clientInitialized: boolean;
    lastError: null | string;
    network: "mainnet" | "testnet";
  }> {
    let lastError: null | string = null;

    try {
      // Try to initialize client
      await this.clientManager.initializeFromEnvironment();
      const client = this.clientManager.getClient();

      return {
        cacheSize: resolutionCache.size,
        clientInitialized: !!client,
        lastError,
        network: this.clientManager.getCurrentNetwork(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";

      return {
        cacheSize: resolutionCache.size,
        clientInitialized: false,
        lastError,
        network: this.clientManager.getCurrentNetwork(),
      };
    }
  }

  /**
   * Initialize ArNS client for specific network
   * @param network - Network to initialize for
   */
  static async initializeNetwork(
    network: "mainnet" | "testnet",
  ): Promise<void> {
    try {
      await this.clientManager.switchNetwork(network);
    } catch (error) {
      throw new Error(`Failed to initialize ArNS network ${network}: ${error}`);
    }
  }

  /**
   * Check if a string is an ArNS name
   * @param input - String to check
   * @returns boolean indicating if input is an ArNS name
   */
  static isArnsName(input: string): boolean {
    return ArnsAddressResolver.isArnsName(input);
  }

  /**
   * Resolve ArNS name to Arweave transaction ID with caching
   * @param arnsName - ArNS name to resolve
   * @param network - Optional network override
   * @param cacheTtl - Cache TTL in milliseconds (default: 5 minutes)
   * @returns ResolutionResult with resolved transaction ID
   */
  static async resolveArnsName(
    arnsName: string,
    network?: "mainnet" | "testnet",
    cacheTtl: number = DEFAULT_CACHE_TTL,
  ): Promise<ResolutionResult<string>> {
    try {
      // Generate cache key
      const cacheKey = `${arnsName}:${network || "auto"}`;

      // Check cache first
      const cached = resolutionCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < cached.ttl) {
        return cached.result;
      }

      // Resolve using ArnsAddressResolver
      const result = await ArnsAddressResolver.resolveArnsToAddress(
        arnsName,
        network,
      );

      // Cache successful resolutions
      if (result.resolved) {
        resolutionCache.set(cacheKey, {
          cachedAt: Date.now(),
          result,
          ttl: cacheTtl,
        });
      }

      return result;
    } catch (error) {
      return {
        requiresVerification: false,
        resolved: false,
        verificationMessage: `Error resolving ArNS name "${arnsName}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Search ArNS records in memory
   * @param hubId - Hub ID to search
   * @param query - Optional search query
   * @returns Promise resolving to matching ArNS records
   */
  static async searchArnsRecords(hubId: string, query?: string) {
    try {
      return await aiMemoryService.searchArnsRecords(hubId, query);
    } catch (error) {
      throw new Error(`Failed to search ArNS records: ${error}`);
    }
  }

  /**
   * Store ArNS name mapping in memory system
   * @param mapping - ArNS name mapping details
   * @param signer - JWK signer for memory storage
   * @param hubId - Hub ID for memory storage
   * @returns Promise resolving to storage result
   */
  static async storeArnsMapping(
    mapping: ArnsMapping,
    signer: JWKInterface,
    hubId: string,
  ): Promise<string> {
    try {
      // Validate required fields
      if (!mapping.arnsName) {
        throw new Error("ArNS name is required");
      }
      if (!mapping.resolvedAddress) {
        throw new Error("Resolved address is required");
      }

      // Extract public key for memory storage
      const publicKey = signer.n;
      if (!publicKey) {
        throw new Error("Invalid signer - missing public key");
      }

      // Create mapping metadata
      const mappingMetadata = {
        mapping_type: "arns_resolution",
        network: mapping.network,
        resolved_at: mapping.resolvedAt,
        stored_at: new Date().toISOString(),
        ttl: mapping.ttl,
      };

      // Store using aiMemoryService with mapping operation type
      const result = await aiMemoryService.addArnsRecord(
        signer,
        hubId,
        mapping.arnsName,
        mapping.resolvedAddress,
        "update", // Use update as generic mapping operation
        mappingMetadata,
        publicKey,
      );

      return result;
    } catch (error) {
      throw new Error(`Failed to store ArNS mapping: ${error}`);
    }
  }

  /**
   * Store ArNS operation in memory system
   * @param operation - ArNS operation details
   * @param signer - JWK signer for memory storage
   * @param hubId - Hub ID for memory storage
   * @returns Promise resolving to storage result
   */
  static async storeArnsOperation(
    operation: ArnsOperation,
    signer: JWKInterface,
    hubId: string,
  ): Promise<string> {
    try {
      // Validate required fields
      if (!operation.arnsName) {
        throw new Error("ArNS name is required");
      }
      if (!operation.transactionId) {
        throw new Error("Transaction ID is required");
      }
      if (!operation.operation) {
        throw new Error("Operation type is required");
      }

      // Extract public key for memory storage
      const publicKey = signer.n;
      if (!publicKey) {
        throw new Error("Invalid signer - missing public key");
      }

      // Create operation metadata with additional context
      const operationMetadata = {
        ...operation.metadata,
        network: operation.network || this.clientManager.getCurrentNetwork(),
        operation_timestamp: operation.timestamp,
        stored_at: new Date().toISOString(),
      };

      // Store using aiMemoryService
      const result = await aiMemoryService.addArnsRecord(
        signer,
        hubId,
        operation.arnsName,
        operation.transactionId,
        operation.operation,
        operationMetadata,
        publicKey,
      );

      return result;
    } catch (error) {
      throw new Error(`Failed to store ArNS operation: ${error}`);
    }
  }
}
