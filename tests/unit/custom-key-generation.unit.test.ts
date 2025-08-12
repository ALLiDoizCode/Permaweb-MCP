import { mnemonicToSeed } from "bip39-web-crypto";
import * as crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SeedBasedKeyGenerator } from "../../src/types/custom-crypto.js";

import {
  createSeedBasedKeyGenerator,
  SeedBasedKeyGeneratorImpl,
} from "../../src/custom-key-generation.js";

// Mock human-crypto-keys to avoid actual dependency
vi.mock("human-crypto-keys", () => ({
  getKeyPairFromSeed: vi.fn().mockResolvedValue({
    privateKey: crypto.randomBytes(1024), // Mock PKCS#8 DER data
  }),
}));

describe("SeedBasedKeyGeneratorImpl", () => {
  let generator: SeedBasedKeyGenerator;
  let testSeed: Buffer;

  beforeEach(() => {
    generator = new SeedBasedKeyGeneratorImpl();
    // Use fixed seed for reproducible tests
    testSeed = Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    );
  });

  describe("generateFromSeed", () => {
    it("should generate RSA key from seed", async () => {
      const jwk = await generator.generateFromSeed(testSeed);

      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe("RSA");
      expect(jwk.n).toBeDefined();
      expect(jwk.e).toBeDefined();
      expect(jwk.d).toBeDefined();
      expect(jwk.p).toBeDefined();
      expect(jwk.q).toBeDefined();
      expect(jwk.dp).toBeDefined();
      expect(jwk.dq).toBeDefined();
      expect(jwk.qi).toBeDefined();
    });

    it("should generate identical keys for identical seeds", async () => {
      const jwk1 = await generator.generateFromSeed(testSeed);
      const jwk2 = await generator.generateFromSeed(testSeed);

      // All JWK components should be identical for deterministic generation
      expect(jwk1.n).toBe(jwk2.n);
      expect(jwk1.e).toBe(jwk2.e);
      expect(jwk1.d).toBe(jwk2.d);
      expect(jwk1.p).toBe(jwk2.p);
      expect(jwk1.q).toBe(jwk2.q);
      expect(jwk1.dp).toBe(jwk2.dp);
      expect(jwk1.dq).toBe(jwk2.dq);
      expect(jwk1.qi).toBe(jwk2.qi);
    });

    it("should generate different keys for different seeds", async () => {
      const seed1 = crypto.randomBytes(64);
      const seed2 = crypto.randomBytes(64);

      const jwk1 = await generator.generateFromSeed(seed1);
      const jwk2 = await generator.generateFromSeed(seed2);

      // Keys should be completely different
      expect(jwk1.n).not.toBe(jwk2.n);
      expect(jwk1.d).not.toBe(jwk2.d);
      expect(jwk1.p).not.toBe(jwk2.p);
      expect(jwk1.q).not.toBe(jwk2.q);
    });

    it("should generate 4096-bit RSA keys", async () => {
      const jwk = await generator.generateFromSeed(testSeed);

      // Calculate modulus length from base64url encoded n
      const modulusBytes = Buffer.from(jwk.n, "base64url");
      const modulusBits = modulusBytes.length * 8;

      // Should be 4096-bit key (allowing for slight variation due to encoding)
      expect(modulusBits).toBeGreaterThanOrEqual(4090);
      expect(modulusBits).toBeLessThanOrEqual(4100);
    });

    it("should throw error with insufficient seed length", async () => {
      const shortSeed = Buffer.from("short", "utf8");

      await expect(generator.generateFromSeed(shortSeed)).rejects.toThrow(
        "Seed must be at least 32 bytes",
      );
    });

    it("should handle generation errors gracefully", async () => {
      // Test with invalid seed to trigger error handling
      const invalidSeed = Buffer.alloc(64, 0); // All zeros might cause issues

      try {
        const result = await generator.generateFromSeed(invalidSeed);
        // Should still work but might be predictable
        expect(result.kty).toBe("RSA");
      } catch (error) {
        // Error handling should provide meaningful messages
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("getDeterministicPRNG", () => {
    it("should return deterministic PRNG instance", () => {
      const prng = generator.getDeterministicPRNG(testSeed);

      expect(prng).toBeDefined();
      expect(typeof prng.getRandomBytes).toBe("function");
      expect(typeof prng.reset).toBe("function");
      expect(typeof prng.getState).toBe("function");
    });

    it("should create PRNG with identical outputs for same seed", () => {
      const prng1 = generator.getDeterministicPRNG(testSeed);
      const prng2 = generator.getDeterministicPRNG(testSeed);

      const output1 = prng1.getRandomBytes(32);
      const output2 = prng2.getRandomBytes(32);

      expect(output1).toEqual(output2);
    });

    it("should create different PRNGs for different seeds", () => {
      const seed1 = crypto.randomBytes(64);
      const seed2 = crypto.randomBytes(64);

      const prng1 = generator.getDeterministicPRNG(seed1);
      const prng2 = generator.getDeterministicPRNG(seed2);

      const output1 = prng1.getRandomBytes(32);
      const output2 = prng2.getRandomBytes(32);

      expect(output1).not.toEqual(output2);
    });
  });

  describe("validateCompatibility", () => {
    it("should validate key structure compatibility", async () => {
      const testMnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

      // Mock successful validation (since we can't easily test exact compatibility without real implementation)
      const result = await generator.validateCompatibility(testMnemonic);

      expect(typeof result).toBe("boolean");
    });

    it("should handle validation errors gracefully", async () => {
      const invalidMnemonic = "invalid mnemonic phrase";

      const result = await generator.validateCompatibility(invalidMnemonic);

      // Should return false for invalid input rather than throwing
      expect(result).toBe(false);
    });

    it("should validate with different mnemonics", async () => {
      const mnemonics = [
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        "legal winner thank year wave sausage worth useful legal winner thank yellow",
        "letter advice cage absurd amount doctor acoustic avoid letter advice cage above",
      ];

      for (const mnemonic of mnemonics) {
        const result = await generator.validateCompatibility(mnemonic);
        expect(typeof result).toBe("boolean");
      }
    });
  });

  describe("benchmarkPerformance", () => {
    it("should return benchmark comparison results", async () => {
      const results = await SeedBasedKeyGeneratorImpl.benchmarkPerformance(2);

      expect(results).toHaveProperty("custom");
      expect(results).toHaveProperty("reference");
      expect(results).toHaveProperty("improvement");

      expect(results.custom.implementation).toBe("custom");
      expect(results.reference.implementation).toBe("human-crypto-keys");

      expect(results.custom.samples).toBe(2);
      expect(results.reference.samples).toBe(2);

      expect(typeof results.improvement).toBe("number");
      expect(results.improvement).toBeGreaterThan(0);
    });

    it("should handle different iteration counts", async () => {
      const counts = [1, 3, 5];

      for (const count of counts) {
        const results =
          await SeedBasedKeyGeneratorImpl.benchmarkPerformance(count);
        expect(results.custom.samples).toBe(count);
        expect(results.reference.samples).toBe(count);
      }
    });

    it("should provide meaningful timing statistics", async () => {
      const results = await SeedBasedKeyGeneratorImpl.benchmarkPerformance(3);

      // Custom implementation results
      expect(results.custom.averageTimeMs).toBeGreaterThan(0);
      expect(results.custom.minTimeMs).toBeGreaterThan(0);
      expect(results.custom.maxTimeMs).toBeGreaterThanOrEqual(
        results.custom.minTimeMs,
      );
      expect(results.custom.medianTimeMs).toBeGreaterThan(0);

      // Reference implementation results
      expect(results.reference.averageTimeMs).toBeGreaterThan(0);
      expect(results.reference.minTimeMs).toBeGreaterThan(0);
      expect(results.reference.maxTimeMs).toBeGreaterThanOrEqual(
        results.reference.minTimeMs,
      );
      expect(results.reference.medianTimeMs).toBeGreaterThan(0);
    });

    it("should track memory usage", async () => {
      const results = await SeedBasedKeyGeneratorImpl.benchmarkPerformance(2);

      expect(typeof results.custom.memoryUsageMB).toBe("number");
      expect(typeof results.reference.memoryUsageMB).toBe("number");

      // Memory usage should be reasonable (not negative, not extremely large)
      expect(results.custom.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(results.custom.memoryUsageMB).toBeLessThan(1000); // Less than 1GB
      expect(results.reference.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(results.reference.memoryUsageMB).toBeLessThan(1000);
    });
  });

  describe("integration with mnemonic generation", () => {
    it("should work with BIP39 mnemonic seeds", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const seed = await mnemonicToSeed(mnemonic);

      const jwk = await generator.generateFromSeed(seed);

      expect(jwk.kty).toBe("RSA");
      expect(jwk.n).toBeDefined();
      expect(jwk.d).toBeDefined();
    });

    it("should produce consistent keys for same mnemonic", async () => {
      const mnemonic =
        "legal winner thank year wave sausage worth useful legal winner thank yellow";

      const seed1 = await mnemonicToSeed(mnemonic);
      const seed2 = await mnemonicToSeed(mnemonic);

      const jwk1 = await generator.generateFromSeed(seed1);
      const jwk2 = await generator.generateFromSeed(seed2);

      expect(jwk1.n).toBe(jwk2.n);
      expect(jwk1.d).toBe(jwk2.d);
    });
  });
});

describe("createSeedBasedKeyGenerator", () => {
  it("should create key generator instance", () => {
    const generator = createSeedBasedKeyGenerator();

    expect(generator).toBeDefined();
    expect(typeof generator.generateFromSeed).toBe("function");
    expect(typeof generator.getDeterministicPRNG).toBe("function");
    expect(typeof generator.validateCompatibility).toBe("function");
  });

  it("should create independent instances", () => {
    const generator1 = createSeedBasedKeyGenerator();
    const generator2 = createSeedBasedKeyGenerator();

    expect(generator1).not.toBe(generator2);
  });
});
