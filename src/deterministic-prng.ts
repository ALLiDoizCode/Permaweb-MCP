import * as crypto from "crypto";

import type { DeterministicPRNG, PRNGState } from "./types/custom-crypto.js";

/**
 * Deterministic Pseudo-Random Number Generator Implementation
 *
 * Provides cryptographically secure, reproducible randomness from seed
 * using counter-based approach with SHA-256 for deterministic output.
 *
 * Security Features:
 * - Counter-based design prevents state prediction
 * - SHA-256 provides cryptographic security
 * - Full determinism for reproducible key generation
 * - Reset capability for testing and validation
 *
 * Performance Features:
 * - Minimal computational overhead vs HMAC-DRBG
 * - Direct Buffer operations for efficiency
 * - Lazy generation of random bytes on demand
 */
export class DeterministicPRNGImpl implements DeterministicPRNG {
  private buffer: Buffer;
  private bufferOffset: number;
  private counter: number;
  private readonly seed: Buffer;

  constructor(seed: Buffer) {
    if (seed.length < 32) {
      throw new Error(
        "Seed must be at least 32 bytes for cryptographic security",
      );
    }

    this.seed = Buffer.from(seed); // Copy to prevent external mutation
    this.counter = 0;
    this.buffer = Buffer.alloc(0); // Empty buffer initially
    this.bufferOffset = 0;
  }

  /**
   * Generate deterministic random bytes using counter-based SHA-256
   *
   * Algorithm:
   * 1. Check if we have enough bytes in buffer
   * 2. If not, generate new blocks until we have sufficient bytes
   * 3. Return requested bytes from buffer and advance offset
   * 4. This ensures consistent output regardless of request patterns
   *
   * @param length - Number of random bytes to generate
   * @returns Buffer containing random bytes
   */
  getRandomBytes(length: number): Buffer {
    if (length <= 0) {
      throw new Error("Length must be positive");
    }

    // Ensure we have enough bytes in buffer
    this.ensureBufferSize(length);

    // Extract bytes from buffer
    const output = this.buffer.subarray(
      this.bufferOffset,
      this.bufferOffset + length,
    );
    this.bufferOffset += length;

    return Buffer.from(output);
  }

  /**
   * Get current internal state for debugging and validation
   * @returns Current PRNG state
   */
  getState(): PRNGState {
    // Generate current hash for state representation
    const currentHash = this.generateBlock(this.counter);

    return {
      counter: this.counter,
      hash: currentHash,
      seed: Buffer.from(this.seed),
    };
  }

  /**
   * Reset PRNG to initial state for reproducible generation
   */
  reset(): void {
    this.counter = 0;
    this.buffer = Buffer.alloc(0);
    this.bufferOffset = 0;
  }

  /**
   * Ensure buffer has at least the required number of available bytes
   * @param requiredBytes - Minimum number of bytes needed
   */
  private ensureBufferSize(requiredBytes: number): void {
    const availableBytes = this.buffer.length - this.bufferOffset;

    if (availableBytes >= requiredBytes) {
      return; // Already have enough bytes
    }

    // Calculate how many blocks we need to generate
    const blocksNeeded = Math.ceil((requiredBytes - availableBytes) / 32);

    // Generate new blocks
    const newBlocks: Buffer[] = [];
    for (let i = 0; i < blocksNeeded; i++) {
      newBlocks.push(this.generateBlock(this.counter + i));
    }

    // Advance counter
    this.counter += blocksNeeded;

    // Combine remaining buffer data with new blocks
    const remainingBuffer = this.buffer.subarray(this.bufferOffset);
    const newBuffer = Buffer.concat([remainingBuffer, ...newBlocks]);

    this.buffer = newBuffer;
    this.bufferOffset = 0;

    // Prevent counter overflow (extremely unlikely in practice)
    if (this.counter >= Number.MAX_SAFE_INTEGER) {
      throw new Error("PRNG counter overflow - reseed required");
    }
  }

  /**
   * Generate a single 32-byte block using counter-based approach
   *
   * Security: Uses SHA-256(seed || counter || domain_separator) to ensure:
   * - Deterministic output for same counter
   * - Non-predictability from counter values
   * - Domain separation from other uses
   *
   * @param counter - Counter value for this block
   * @returns 32-byte block of random data
   */
  private generateBlock(counter: number): Buffer {
    const hasher = crypto.createHash("sha256");

    // Combine seed + counter + domain separator
    hasher.update(this.seed);

    // Convert counter to 8-byte buffer (big-endian)
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter), 0);
    hasher.update(counterBuffer);

    // Add domain separation to prevent cross-protocol attacks
    hasher.update("PERMAMIND_PRNG_BLOCK");

    return hasher.digest();
  }
}

/**
 * Factory function to create deterministic PRNG instance
 * @param seed - Buffer containing seed bytes (minimum 32 bytes)
 * @returns Deterministic PRNG instance
 */
export function createDeterministicPRNG(seed: Buffer): DeterministicPRNG {
  return new DeterministicPRNGImpl(seed);
}

/**
 * Validate PRNG quality using statistical tests
 * @param prng - PRNG instance to test
 * @param sampleSize - Number of bytes to generate for testing
 * @returns Quality assessment results
 */
export function validatePRNGQuality(
  prng: DeterministicPRNG,
  sampleSize: number = 1024,
): {
  biasScore: number;
  entropyScore: number;
  passed: boolean;
} {
  const testData = prng.getRandomBytes(sampleSize);

  // Simple bias test: count bit distribution
  let onesCount = 0;
  for (const byte of testData) {
    onesCount += countSetBits(byte);
  }

  const totalBits = testData.length * 8;
  const expectedOnes = totalBits / 2;
  const biasScore = 1.0 - Math.abs(onesCount - expectedOnes) / expectedOnes;

  // Simple entropy estimation using byte frequency
  const byteFrequency = new Array(256).fill(0);
  for (const byte of testData) {
    byteFrequency[byte]++;
  }

  let entropy = 0;
  for (const freq of byteFrequency) {
    if (freq > 0) {
      const probability = freq / testData.length;
      entropy -= probability * Math.log2(probability);
    }
  }

  const maxEntropy = 8.0; // Maximum entropy for 8-bit values
  const entropyScore = entropy / maxEntropy;

  return {
    biasScore,
    entropyScore,
    passed: biasScore > 0.95 && entropyScore > 0.95,
  };
}

/**
 * Count set bits in a byte value
 */
function countSetBits(value: number): number {
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}
