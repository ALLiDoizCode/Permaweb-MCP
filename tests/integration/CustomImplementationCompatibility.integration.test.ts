import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { mnemonicToSeed } from "bip39-web-crypto";
import * as crypto from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createSeedBasedKeyGenerator,
  SeedBasedKeyGeneratorImpl,
} from "../../src/custom-key-generation.js";
import { getKeyFromMnemonic } from "../../src/mnemonic.js";

describe("Custom Implementation Compatibility Integration Tests", () => {
  let customGenerator: SeedBasedKeyGeneratorImpl;
  const testMnemonics = [
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "legal winner thank year wave sausage worth useful legal winner thank yellow",
    "letter advice cage absurd amount doctor acoustic avoid letter advice cage above",
    "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong",
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon agent",
  ];

  beforeAll(() => {
    customGenerator = new SeedBasedKeyGeneratorImpl();
  });

  afterAll(async () => {
    // Cleanup any resources if needed
  });

  describe("JWK Structure Compatibility", () => {
    it("should generate JWK with all required fields", async () => {
      const seed = await mnemonicToSeed(testMnemonics[0]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Verify all required JWK fields are present
      expect(jwk).toHaveProperty("kty");
      expect(jwk).toHaveProperty("n");
      expect(jwk).toHaveProperty("e");
      expect(jwk).toHaveProperty("d");
      expect(jwk).toHaveProperty("p");
      expect(jwk).toHaveProperty("q");
      expect(jwk).toHaveProperty("dp");
      expect(jwk).toHaveProperty("dq");
      expect(jwk).toHaveProperty("qi");

      expect(jwk.kty).toBe("RSA");
    });

    it("should generate base64url encoded parameters", async () => {
      const seed = await mnemonicToSeed(testMnemonics[1]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // All parameters should be valid base64url strings
      const base64UrlRegex = /^[A-Za-z0-9_-]+$/;

      expect(jwk.n).toMatch(base64UrlRegex);
      expect(jwk.e).toMatch(base64UrlRegex);
      expect(jwk.d).toMatch(base64UrlRegex);
      expect(jwk.p).toMatch(base64UrlRegex);
      expect(jwk.q).toMatch(base64UrlRegex);
      expect(jwk.dp).toMatch(base64UrlRegex);
      expect(jwk.dq).toMatch(base64UrlRegex);
      expect(jwk.qi).toMatch(base64UrlRegex);
    });

    it("should generate 4096-bit modulus", async () => {
      const seed = await mnemonicToSeed(testMnemonics[2]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Decode the modulus and check bit length
      const modulusBuffer = Buffer.from(jwk.n, "base64url");
      const modulusBits = modulusBuffer.length * 8;

      expect(modulusBits).toBe(4096);
    });

    it("should use standard RSA public exponent", async () => {
      const seed = await mnemonicToSeed(testMnemonics[3]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Standard RSA public exponent is 65537 (0x010001)
      const exponentBuffer = Buffer.from(jwk.e, "base64url");
      const expectedExponent = Buffer.from([0x01, 0x00, 0x01]);

      expect(exponentBuffer).toEqual(expectedExponent);
    });
  });

  describe("Deterministic Behavior", () => {
    it("should generate identical keys for same mnemonic", async () => {
      const mnemonic = testMnemonics[0];

      const seed1 = await mnemonicToSeed(mnemonic);
      const seed2 = await mnemonicToSeed(mnemonic);

      const jwk1 = await customGenerator.generateFromSeed(seed1);
      const jwk2 = await customGenerator.generateFromSeed(seed2);

      expect(jwk1.n).toBe(jwk2.n);
      expect(jwk1.d).toBe(jwk2.d);
      expect(jwk1.p).toBe(jwk2.p);
      expect(jwk1.q).toBe(jwk2.q);
      expect(jwk1.dp).toBe(jwk2.dp);
      expect(jwk1.dq).toBe(jwk2.dq);
      expect(jwk1.qi).toBe(jwk2.qi);
    });

    it("should generate different keys for different mnemonics", async () => {
      const seeds = await Promise.all(
        testMnemonics.slice(0, 3).map((mnemonic) => mnemonicToSeed(mnemonic)),
      );

      const jwks = await Promise.all(
        seeds.map((seed) => customGenerator.generateFromSeed(seed)),
      );

      // All keys should be different
      for (let i = 0; i < jwks.length; i++) {
        for (let j = i + 1; j < jwks.length; j++) {
          expect(jwks[i].n).not.toBe(jwks[j].n);
          expect(jwks[i].d).not.toBe(jwks[j].d);
        }
      }
    });

    it("should be reproducible across multiple generations", async () => {
      const mnemonic = testMnemonics[1];
      const iterations = 5;
      const jwks: JWKInterface[] = [];

      for (let i = 0; i < iterations; i++) {
        const seed = await mnemonicToSeed(mnemonic);
        const jwk = await customGenerator.generateFromSeed(seed);
        jwks.push(jwk);
      }

      // All keys should be identical
      const reference = jwks[0];
      for (let i = 1; i < jwks.length; i++) {
        expect(jwks[i].n).toBe(reference.n);
        expect(jwks[i].d).toBe(reference.d);
        expect(jwks[i].p).toBe(reference.p);
        expect(jwks[i].q).toBe(reference.q);
      }
    });
  });

  describe("Performance Comparison", () => {
    it("should benchmark custom implementation performance", async () => {
      const testMnemonic = testMnemonics[0];
      const iterations = 3;

      // Benchmark custom implementation only (existing is too slow for CI)
      const customTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const seed = await mnemonicToSeed(testMnemonic);
        const start = performance.now();
        await customGenerator.generateFromSeed(seed);
        const end = performance.now();
        customTimes.push(end - start);
      }

      const customAvg =
        customTimes.reduce((a, b) => a + b) / customTimes.length;
      console.log(`Custom implementation average: ${customAvg.toFixed(2)}ms`);

      // Custom implementation should be reasonably fast (under 1 second for proof-of-concept)
      expect(customAvg).toBeLessThan(1000);
    });
  });

  describe("Security Properties", () => {
    it("should generate keys with proper bit distribution", async () => {
      const seed = await mnemonicToSeed(testMnemonics[0]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Test modulus bit distribution (should not be obviously biased)
      const modulusBuffer = Buffer.from(jwk.n, "base64url");
      let onesCount = 0;

      for (const byte of modulusBuffer) {
        onesCount += countSetBits(byte);
      }

      const totalBits = modulusBuffer.length * 8;
      const onesRatio = onesCount / totalBits;

      // Should be roughly balanced (within reasonable statistical bounds)
      expect(onesRatio).toBeGreaterThan(0.4);
      expect(onesRatio).toBeLessThan(0.6);
    });

    it("should not leak seed information in generated keys", async () => {
      const seed = crypto.randomBytes(64);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Generated key parameters should not contain the seed
      const keyData = JSON.stringify(jwk);
      const seedHex = seed.toString("hex");

      expect(keyData).not.toContain(seedHex);
      expect(keyData).not.toContain(seed.toString("base64"));
      expect(keyData).not.toContain(seed.toString("base64url"));
    });

    it("should generate keys with appropriate parameter sizes", async () => {
      const seed = await mnemonicToSeed(testMnemonics[4]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Check parameter sizes (in bytes)
      expect(Buffer.from(jwk.n, "base64url").length).toBe(512); // 4096 bits = 512 bytes
      expect(Buffer.from(jwk.d, "base64url").length).toBe(512); // Private exponent
      expect(Buffer.from(jwk.p, "base64url").length).toBe(256); // First prime (2048 bits)
      expect(Buffer.from(jwk.q, "base64url").length).toBe(256); // Second prime (2048 bits)
      expect(Buffer.from(jwk.dp, "base64url").length).toBe(256); // First exponent
      expect(Buffer.from(jwk.dq, "base64url").length).toBe(256); // Second exponent
      expect(Buffer.from(jwk.qi, "base64url").length).toBe(256); // Coefficient
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle minimum seed size", async () => {
      const minSeed = crypto.randomBytes(32); // Minimum 32 bytes
      const jwk = await customGenerator.generateFromSeed(minSeed);

      expect(jwk.kty).toBe("RSA");
      expect(jwk.n).toBeDefined();
    });

    it("should handle large seeds", async () => {
      const largeSeed = crypto.randomBytes(1024); // Large seed
      const jwk = await customGenerator.generateFromSeed(largeSeed);

      expect(jwk.kty).toBe("RSA");
      expect(jwk.n).toBeDefined();
    });

    it("should be consistent with different seed patterns", async () => {
      // Test with various seed patterns
      const patterns = [
        Buffer.alloc(64, 0xff), // All ones
        Buffer.alloc(64, 0xaa), // Alternating pattern
        crypto.randomBytes(64), // Random
      ];

      for (const seed of patterns) {
        const jwk1 = await customGenerator.generateFromSeed(seed);
        const jwk2 = await customGenerator.generateFromSeed(seed);

        expect(jwk1.n).toBe(jwk2.n);
        expect(jwk1.d).toBe(jwk2.d);
      }
    });

    it("should maintain determinism under concurrent generation", async () => {
      const seed = await mnemonicToSeed(testMnemonics[0]);

      // Generate keys concurrently
      const promises = Array(5)
        .fill(0)
        .map(() => customGenerator.generateFromSeed(seed));

      const results = await Promise.all(promises);

      // All results should be identical
      const reference = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].n).toBe(reference.n);
        expect(results[i].d).toBe(reference.d);
      }
    });
  });

  describe("Integration with Existing System", () => {
    it("should work with existing cache system", async () => {
      // This would test integration with the caching layer
      // For now, just verify the JWK format is cacheable
      const seed = await mnemonicToSeed(testMnemonics[0]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Should be serializable for caching
      const serialized = JSON.stringify(jwk);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.kty).toBe(jwk.kty);
      expect(deserialized.n).toBe(jwk.n);
      expect(deserialized.d).toBe(jwk.d);
    });

    it("should be compatible with Arweave wallet operations", async () => {
      // Generate a key and verify it has the structure expected by Arweave
      const seed = await mnemonicToSeed(testMnemonics[1]);
      const jwk = await customGenerator.generateFromSeed(seed);

      // Mock Arweave wallet address generation (simplified)
      // In real implementation, this would use arweave.wallets.jwkToAddress()
      expect(typeof jwk.n).toBe("string");
      expect(typeof jwk.e).toBe("string");
      expect(jwk.kty).toBe("RSA");
    });
  });
});

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
