import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GenerateKeypairCommand } from "../../../../src/tools/user/commands/GenerateKeypairCommand.js";

// Mock the mnemonic module
vi.mock("../../../../src/mnemonic.js", () => ({
  getKeyFromMnemonic: vi.fn(),
  validateMnemonic: vi.fn(),
}));

// Mock the server module
const mockSetUserState = vi.fn();
const mockGetCurrentContext = vi.fn();

vi.mock("../../../../src/server.js", () => ({
  getCurrentContext: mockGetCurrentContext,
  setUserState: mockSetUserState,
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

    // Set up default mock returns - no existing keypair in server state
    mockGetCurrentContext.mockReturnValue({
      embeddedTemplates: new Map(),
      hubId: undefined,
      keyPair: undefined,
      publicKey: undefined,
    });

    // Clear environment variable for clean tests
    delete process.env.SEED_PHRASE;
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

    it("should return existing keypair when one already exists in server state", async () => {
      const existingKeyPair = {
        d: "existing-d",
        dp: "existing-dp",
        dq: "existing-dq",
        e: "AQAB",
        kty: "RSA",
        n: "existing-n",
        p: "existing-p",
        q: "existing-q",
      } as JWKInterface;
      const existingPublicKey = "existing-generated-public-key";

      // Mock server state to return existing keypair
      mockGetCurrentContext.mockReturnValue({
        embeddedTemplates: new Map(),
        hubId: "test-hub",
        keyPair: existingKeyPair,
        publicKey: existingPublicKey,
      });

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.publicKey).toBe(existingPublicKey);

      // Should not call wallet generation functions when keypair already exists
      expect(mockWallets.generate).not.toHaveBeenCalled();
      expect(mockWallets.jwkToAddress).not.toHaveBeenCalled();
      expect(mockSetUserState).not.toHaveBeenCalled();
    });

    it("should use SEED_PHRASE environment variable when no parameters provided", async () => {
      const envSeedPhrase =
        "test env seed phrase with twelve words for validation";
      const mockKeyPair = {
        d: "env-d",
        dp: "env-dp",
        dq: "env-dq",
        e: "AQAB",
        kty: "RSA",
        n: "env-n",
        p: "env-p",
        q: "env-q",
      } as JWKInterface;
      const mockPublicKey = "env-generated-public-key";

      // Set environment variable
      process.env.SEED_PHRASE = envSeedPhrase;

      // Mock mnemonic functions
      const { getKeyFromMnemonic } = await import(
        "../../../../src/mnemonic.js"
      );
      vi.mocked(getKeyFromMnemonic).mockResolvedValue(mockKeyPair);

      mockWallets.jwkToAddress.mockResolvedValue(mockPublicKey);

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.publicKey).toBe(mockPublicKey);
      expect(getKeyFromMnemonic).toHaveBeenCalledWith(envSeedPhrase);
      expect(mockSetUserState).toHaveBeenCalledWith({
        keyPair: mockKeyPair,
        publicKey: mockPublicKey,
      });

      // Should not use random generation when env var is available
      expect(mockWallets.generate).not.toHaveBeenCalled();

      // Clean up
      delete process.env.SEED_PHRASE;
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
