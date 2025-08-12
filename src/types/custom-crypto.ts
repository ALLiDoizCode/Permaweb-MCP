import type { JWKInterface } from "arweave/node/lib/wallet.js";

/**
 * Performance benchmark results structure
 */
export interface BenchmarkResults {
  /** Average generation time in milliseconds */
  averageTimeMs: number;
  /** Implementation type being benchmarked */
  implementation: "custom" | "human-crypto-keys";
  /** Maximum generation time in milliseconds */
  maxTimeMs: number;
  /** Median generation time in milliseconds */
  medianTimeMs: number;
  /** Peak memory usage in megabytes */
  memoryUsageMB: number;
  /** Minimum generation time in milliseconds */
  minTimeMs: number;
  /** Number of samples in benchmark */
  samples: number;
}

/**
 * Interface for deterministic pseudo-random number generator
 * Provides cryptographically secure, reproducible randomness from seed
 */
export interface DeterministicPRNG {
  /**
   * Generate random bytes with deterministic output
   * @param length - Number of random bytes to generate
   * @returns Buffer containing random bytes
   */
  getRandomBytes(length: number): Buffer;

  /**
   * Get current internal state for debugging/validation
   * @returns Current PRNG state
   */
  getState(): PRNGState;

  /**
   * Reset PRNG to initial state for reproducibility
   */
  reset(): void;
}

/**
 * Extended key generation options with custom implementation support
 */
export interface KeyGenerationOptions {
  /** Enable benchmarking during generation */
  enableBenchmarking?: boolean;
  /** Implementation to use for key generation */
  implementation?: "custom" | "human-crypto-keys";
  /** Force non-blocking operation */
  nonBlocking?: boolean;
  /** Progress callback for generation stages */
  onProgress?: (stage: string, percentage: number) => void;
  /** Priority for worker thread processing */
  priority?: "high" | "low" | "normal";
}

/**
 * State structure for deterministic PRNG
 */
export interface PRNGState {
  /** Current counter value for reproducibility */
  counter: number;
  /** SHA-256 context hash for current state */
  hash: Buffer;
  /** Original seed for reset capability */
  seed: Buffer;
}

/**
 * Security analysis results structure
 */
export interface SecurityAnalysisResults {
  /** Known attack vector resistance */
  attackResistance: {
    /** Side-channel attack resistance */
    sidechannelAttacks: boolean;
    /** Timing attack resistance */
    timingAttacks: boolean;
    /** Weak key detection */
    weakKeyDetection: boolean;
  };
  /** Security compliance validation */
  compliance: {
    /** FIPS 140-2 compliance */
    fipsCompliant: boolean;
    /** RSA key size compliance */
    keySize: boolean;
    /** NIST SP 800-90A compliance */
    nistCompliant: boolean;
  };
  /** Key generation entropy analysis */
  entropyAnalysis: {
    /** Bias detection results */
    biasDetected: boolean;
    /** Effective entropy bits */
    effectiveEntropy: number;
    /** Statistical test results */
    statisticalTests: Record<string, boolean>;
  };
  /** PRNG randomness quality score (0-1) */
  prngQuality: number;
}

/**
 * Interface for seed-based RSA key generator
 * Provides custom implementation alternative to human-crypto-keys
 */
export interface SeedBasedKeyGenerator {
  /**
   * Generate RSA key pair from seed using Node.js native crypto
   * @param seed - Buffer containing seed bytes
   * @returns Promise resolving to JWK interface
   */
  generateFromSeed(seed: Buffer): Promise<JWKInterface>;

  /**
   * Get deterministic PRNG instance for custom randomness
   * @param seed - Buffer containing seed bytes
   * @returns Deterministic PRNG instance
   */
  getDeterministicPRNG(seed: Buffer): DeterministicPRNG;

  /**
   * Validate compatibility with existing human-crypto-keys output
   * @param mnemonic - Test mnemonic for comparison
   * @returns Promise resolving to compatibility validation result
   */
  validateCompatibility(mnemonic: string): Promise<boolean>;
}
