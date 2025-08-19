import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GenerateKeypairCommand } from "../../../../src/tools/user/commands/GenerateKeypairCommand.js";

// Mock the mnemonic module
vi.mock("../../../../src/mnemonic.js", () => ({
  getKeyFromMnemonic: vi.fn(),
  validateMnemonic: vi.fn(),
}));

// Mock Arweave
const mockWallets = {
  generate: vi.fn(),
  jwkToAddress: vi.fn(),
};

vi.mock("arweave", () => ({
  default: {
    init: vi.fn(() => ({
      wallets: mockWallets,
    })),
  },
}));

describe("GenerateKeypairCommand", () => {
  let command: GenerateKeypairCommand;
  let mockContext: ToolContext;

  beforeEach(async () => {
    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {} as JWKInterface,
      publicKey: "test-public-key-address",
    };

    command = new GenerateKeypairCommand(mockContext);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should generate keypair from valid seed phrase", async () => {
      const testSeedPhrase =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const mockKeyPair = {
        d: "test-d",
        e: "AQAB",
        kty: "RSA",
        n: "test-n",
        p: "test-p",
        q: "test-q",
      } as JWKInterface;
      const mockPublicKey = "test-generated-public-key";

      // Mock mnemonic validation and key generation
      const { getKeyFromMnemonic, validateMnemonic } = await import(
        "../../../../src/mnemonic.js"
      );
      vi.mocked(validateMnemonic).mockResolvedValue(true);
      vi.mocked(getKeyFromMnemonic).mockResolvedValue(mockKeyPair);
      mockWallets.jwkToAddress.mockResolvedValue(mockPublicKey);

      const result = await command.execute({ seedPhrase: testSeedPhrase });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.publicKey).toBe(mockPublicKey);
      expect(validateMnemonic).toHaveBeenCalledWith(testSeedPhrase);
      expect(getKeyFromMnemonic).toHaveBeenCalledWith(testSeedPhrase);
      expect(mockWallets.jwkToAddress).toHaveBeenCalledWith(mockKeyPair);
    });

    it("should generate random keypair when no seed phrase provided", async () => {
      const mockKeyPair = {
        d: "random-d",
        e: "AQAB",
        kty: "RSA",
        n: "random-n",
        p: "random-p",
        q: "random-q",
      } as JWKInterface;
      const mockPublicKey = "random-generated-public-key";

      mockWallets.generate.mockResolvedValue(mockKeyPair);
      mockWallets.jwkToAddress.mockResolvedValue(mockPublicKey);

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.publicKey).toBe(mockPublicKey);
      expect(mockWallets.generate).toHaveBeenCalled();
      expect(mockWallets.jwkToAddress).toHaveBeenCalledWith(mockKeyPair);
    });

    it("should return error for invalid seed phrase", async () => {
      const invalidSeedPhrase = "invalid seed phrase";

      // Mock mnemonic validation to return false
      const { validateMnemonic } = await import("../../../../src/mnemonic.js");
      vi.mocked(validateMnemonic).mockResolvedValue(false);

      const result = await command.execute({ seedPhrase: invalidSeedPhrase });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe(
        "Invalid seed phrase. Must be a valid 12-word mnemonic.",
      );
      expect(validateMnemonic).toHaveBeenCalledWith(invalidSeedPhrase);
    });

    it("should handle errors during key generation", async () => {
      const testError = new Error("Key generation failed");
      mockWallets.generate.mockRejectedValue(testError);

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe(
        "Failed to generate keypair: Key generation failed",
      );
    });

    it("should handle errors during seed phrase key generation", async () => {
      const testSeedPhrase =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const testError = new Error("Mnemonic key generation failed");

      const { getKeyFromMnemonic, validateMnemonic } = await import(
        "../../../../src/mnemonic.js"
      );
      vi.mocked(validateMnemonic).mockResolvedValue(true);
      vi.mocked(getKeyFromMnemonic).mockRejectedValue(testError);

      const result = await command.execute({ seedPhrase: testSeedPhrase });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe(
        "Failed to generate keypair: Mnemonic key generation failed",
      );
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("generateKeypair");
      expect(metadata.description).toBe(
        "Generate a new Arweave keypair from a seed phrase or randomly",
      );
      expect(metadata.title).toBe("Generate Keypair");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
    });
  });

  describe("parameters schema", () => {
    it("should accept valid parameters", () => {
      const schema = command.getParametersSchema();

      // Valid with seed phrase
      const resultWithSeed = schema.safeParse({
        seedPhrase:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      });
      expect(resultWithSeed.success).toBe(true);

      // Valid without seed phrase
      const resultWithoutSeed = schema.safeParse({});
      expect(resultWithoutSeed.success).toBe(true);
    });

    it("should reject invalid parameter types", () => {
      const schema = command.getParametersSchema();

      const result = schema.safeParse({
        seedPhrase: 123, // Invalid type
      });
      expect(result.success).toBe(false);
    });
  });
});
