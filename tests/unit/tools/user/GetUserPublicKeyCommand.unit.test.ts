import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GetUserPublicKeyCommand } from "../../../../src/tools/user/commands/GetUserPublicKeyCommand.js";

// Mock the server module
vi.mock("../../../../src/server.js", () => ({
  getCurrentUserState: vi.fn(),
}));

describe("GetUserPublicKeyCommand", () => {
  let command: GetUserPublicKeyCommand;
  let mockContext: ToolContext;

  beforeEach(async () => {
    mockContext = {
      hubId: "test-hub-id",
      keyPair: {} as JWKInterface,
      publicKey: "test-public-key-address",
    };
    command = new GetUserPublicKeyCommand(mockContext);

    // Mock getCurrentUserState
    const { getCurrentUserState } = await import("../../../../src/server.js");
    vi.mocked(getCurrentUserState).mockReturnValue({
      hubId: "test-hub-id",
      initializationComplete: true,
      keyPair: {} as JWKInterface,
      publicKey: "test-public-key-address",
    });
  });

  describe("execute", () => {
    it("should return the user's public key", async () => {
      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.publicKey).toBe("test-public-key-address");
    });

    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("getUserPublicKey");
      expect(metadata.description).toBe(
        "Get the current user's public key (wallet address)",
      );
      expect(metadata.title).toBe("Get User Public Key");
      expect(metadata.readOnlyHint).toBe(true);
      expect(metadata.openWorldHint).toBe(false);
    });

    it("should have empty parameters schema", () => {
      const schema = command.getParametersSchema();
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should return error when initialization is not complete", async () => {
      const { getCurrentUserState } = await import("../../../../src/server.js");
      vi.mocked(getCurrentUserState).mockReturnValue({
        hubId: "test-hub-id",
        initializationComplete: false,
        keyPair: {} as JWKInterface,
        publicKey: "initializing",
      });

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe(
        "Wallet is still initializing. Please wait a moment and try again.",
      );
    });
  });
});
