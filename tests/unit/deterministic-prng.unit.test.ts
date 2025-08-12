import * as crypto from "crypto";
import { beforeEach, describe, expect, it } from "vitest";

import type { DeterministicPRNG } from "../../src/types/custom-crypto.js";

import {
  createDeterministicPRNG,
  validatePRNGQuality,
} from "../../src/deterministic-prng.js";

describe("DeterministicPRNG", () => {
  let testSeed: Buffer;
  let prng: DeterministicPRNG;

  beforeEach(() => {
    // Use fixed seed for reproducible tests
    testSeed = Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    );
    prng = createDeterministicPRNG(testSeed);
  });

  describe("constructor", () => {
    it("should create PRNG with valid seed", () => {
      expect(prng).toBeDefined();
      expect(typeof prng.getRandomBytes).toBe("function");
      expect(typeof prng.reset).toBe("function");
      expect(typeof prng.getState).toBe("function");
    });

    it("should throw error with insufficient seed length", () => {
      const shortSeed = Buffer.from("short", "utf8");
      expect(() => createDeterministicPRNG(shortSeed)).toThrow(
        "Seed must be at least 32 bytes",
      );
    });

    it("should accept exactly 32 byte seed", () => {
      const validSeed = crypto.randomBytes(32);
      expect(() => createDeterministicPRNG(validSeed)).not.toThrow();
    });

    it("should accept longer seeds", () => {
      const longSeed = crypto.randomBytes(64);
      expect(() => createDeterministicPRNG(longSeed)).not.toThrow();
    });
  });

  describe("getRandomBytes", () => {
    it("should generate requested number of bytes", () => {
      const output = prng.getRandomBytes(32);
      expect(output).toBeInstanceOf(Buffer);
      expect(output.length).toBe(32);
    });

    it("should generate different output on subsequent calls", () => {
      const output1 = prng.getRandomBytes(32);
      const output2 = prng.getRandomBytes(32);

      expect(output1).not.toEqual(output2);
    });

    it("should handle various output lengths", () => {
      const lengths = [1, 16, 32, 64, 100, 256, 1000];

      for (const length of lengths) {
        const output = prng.getRandomBytes(length);
        expect(output.length).toBe(length);
      }
    });

    it("should throw error for invalid lengths", () => {
      expect(() => prng.getRandomBytes(0)).toThrow("Length must be positive");
      expect(() => prng.getRandomBytes(-1)).toThrow("Length must be positive");
    });

    it("should be deterministic for same seed and sequence", () => {
      const prng1 = createDeterministicPRNG(testSeed);
      const prng2 = createDeterministicPRNG(testSeed);

      const output1 = prng1.getRandomBytes(64);
      const output2 = prng2.getRandomBytes(64);

      expect(output1).toEqual(output2);
    });

    it("should produce different outputs for different seeds", () => {
      const seed1 = crypto.randomBytes(32);
      const seed2 = crypto.randomBytes(32);

      const prng1 = createDeterministicPRNG(seed1);
      const prng2 = createDeterministicPRNG(seed2);

      const output1 = prng1.getRandomBytes(32);
      const output2 = prng2.getRandomBytes(32);

      expect(output1).not.toEqual(output2);
    });
  });

  describe("reset", () => {
    it("should reset PRNG to initial state", () => {
      const initialState = prng.getState();

      // Generate some data to advance state
      prng.getRandomBytes(64);
      const advancedState = prng.getState();

      // States should be different after generation
      expect(advancedState.counter).toBeGreaterThan(initialState.counter);

      // Reset should restore initial state
      prng.reset();
      const resetState = prng.getState();

      expect(resetState.counter).toBe(initialState.counter);
      expect(resetState.hash).toEqual(initialState.hash);
    });

    it("should produce identical sequences after reset", () => {
      const output1 = prng.getRandomBytes(32);
      prng.reset();
      const output2 = prng.getRandomBytes(32);

      expect(output1).toEqual(output2);
    });

    it("should allow multiple resets", () => {
      const reference = prng.getRandomBytes(32);

      // Advance state and reset multiple times
      prng.getRandomBytes(100);
      prng.reset();

      prng.getRandomBytes(200);
      prng.reset();

      const afterResets = prng.getRandomBytes(32);
      expect(afterResets).toEqual(reference);
    });
  });

  describe("getState", () => {
    it("should return current PRNG state", () => {
      const state = prng.getState();

      expect(state).toHaveProperty("counter");
      expect(state).toHaveProperty("hash");
      expect(state).toHaveProperty("seed");

      expect(typeof state.counter).toBe("number");
      expect(state.hash).toBeInstanceOf(Buffer);
      expect(state.seed).toBeInstanceOf(Buffer);
    });

    it("should reflect counter advancement", () => {
      const initialState = prng.getState();
      expect(initialState.counter).toBe(0);

      prng.getRandomBytes(64); // Should advance counter
      const advancedState = prng.getState();
      expect(advancedState.counter).toBeGreaterThan(0);
    });

    it("should return copies to prevent state mutation", () => {
      const state1 = prng.getState();
      const state2 = prng.getState();

      // Modify returned state
      state1.counter = 999;
      state1.hash.fill(0);

      // Original state should be unchanged
      expect(state2.counter).not.toBe(999);
      expect(state2.hash).not.toEqual(Buffer.alloc(32));

      // PRNG should still work normally
      const output = prng.getRandomBytes(16);
      expect(output.length).toBe(16);
    });
  });

  describe("deterministic behavior", () => {
    it("should produce identical sequences for identical seeds", () => {
      const seed = crypto.randomBytes(32);
      const prng1 = createDeterministicPRNG(seed);
      const prng2 = createDeterministicPRNG(seed);

      const sequence1: Buffer[] = [];
      const sequence2: Buffer[] = [];

      for (let i = 0; i < 10; i++) {
        sequence1.push(prng1.getRandomBytes(16));
        sequence2.push(prng2.getRandomBytes(16));
      }

      for (let i = 0; i < sequence1.length; i++) {
        expect(sequence1[i]).toEqual(sequence2[i]);
      }
    });

    it("should maintain consistency across different call patterns", () => {
      const seed = crypto.randomBytes(32);

      // Generate in one large call
      const prng1 = createDeterministicPRNG(seed);
      const output1 = prng1.getRandomBytes(100);

      // Generate in multiple small calls
      const prng2 = createDeterministicPRNG(seed);
      const chunks: Buffer[] = [];
      for (let i = 0; i < 10; i++) {
        chunks.push(prng2.getRandomBytes(10));
      }
      const output2 = Buffer.concat(chunks);

      expect(output1).toEqual(output2);
    });
  });

  describe("security properties", () => {
    it("should not reveal seed from generated output", () => {
      const seed = crypto.randomBytes(32);
      const prng = createDeterministicPRNG(seed);
      const output = prng.getRandomBytes(1000);

      // Output should not contain seed
      for (let i = 0; i <= output.length - seed.length; i++) {
        const slice = output.subarray(i, i + seed.length);
        expect(slice).not.toEqual(seed);
      }
    });

    it("should have no obvious patterns in output", () => {
      const output = prng.getRandomBytes(256);

      // Check for repeated bytes (simple pattern detection)
      let maxRepeatedCount = 0;
      for (let i = 0; i < 256; i++) {
        let count = 0;
        for (const byte of output) {
          if (byte === i) count++;
        }
        maxRepeatedCount = Math.max(maxRepeatedCount, count);
      }

      // With good randomness, no byte should appear too frequently
      // Allow some statistical variation
      expect(maxRepeatedCount).toBeLessThan(output.length * 0.1);
    });
  });
});

describe("validatePRNGQuality", () => {
  let prng: DeterministicPRNG;

  beforeEach(() => {
    const seed = crypto.randomBytes(32);
    prng = createDeterministicPRNG(seed);
  });

  it("should return quality assessment", () => {
    const result = validatePRNGQuality(prng, 1024);

    expect(result).toHaveProperty("biasScore");
    expect(result).toHaveProperty("entropyScore");
    expect(result).toHaveProperty("passed");

    expect(typeof result.biasScore).toBe("number");
    expect(typeof result.entropyScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");

    expect(result.biasScore).toBeGreaterThanOrEqual(0);
    expect(result.biasScore).toBeLessThanOrEqual(1);
    expect(result.entropyScore).toBeGreaterThanOrEqual(0);
    expect(result.entropyScore).toBeLessThanOrEqual(1);
  });

  it("should handle different sample sizes", () => {
    const sizes = [64, 256, 1024, 4096];

    for (const size of sizes) {
      const result = validatePRNGQuality(prng, size);
      expect(result.biasScore).toBeGreaterThan(0);
      expect(result.entropyScore).toBeGreaterThan(0);
    }
  });

  it("should detect good quality randomness", () => {
    const result = validatePRNGQuality(prng, 2048);

    // Our implementation should pass quality tests
    expect(result.biasScore).toBeGreaterThan(0.9);
    expect(result.entropyScore).toBeGreaterThan(0.9);
    expect(result.passed).toBe(true);
  });

  it("should be consistent for same PRNG state", () => {
    prng.reset();
    const result1 = validatePRNGQuality(prng, 512);

    prng.reset();
    const result2 = validatePRNGQuality(prng, 512);

    expect(result1.biasScore).toBe(result2.biasScore);
    expect(result1.entropyScore).toBe(result2.entropyScore);
    expect(result1.passed).toBe(result2.passed);
  });
});
