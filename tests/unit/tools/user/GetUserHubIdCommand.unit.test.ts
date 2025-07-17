import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GetUserHubIdCommand } from "../../../../src/tools/user/commands/GetUserHubIdCommand.js";

// Mock the server module
vi.mock("../../../../src/server.js", () => ({
  getCurrentUserState: vi.fn(),
}));

describe("GetUserHubIdCommand", () => {
  let command: GetUserHubIdCommand;
  let mockContext: ToolContext;

  beforeEach(async () => {
    mockContext = {
      hubId: "test-hub-id-12345",
      keyPair: {} as JWKInterface,
      publicKey: "test-public-key",
    };
    command = new GetUserHubIdCommand(mockContext);
    
    // Mock getCurrentUserState
    const { getCurrentUserState } = await import("../../../../src/server.js");
    vi.mocked(getCurrentUserState).mockReturnValue({
      hubId: "test-hub-id-12345",
      keyPair: {} as JWKInterface,
      publicKey: "test-public-key",
      initializationComplete: true,
    });
  });

  describe("execute", () => {
    it("should return the user's hub ID", async () => {
      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.hubId).toBe("test-hub-id-12345");
    });

    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("getUserHubId");
      expect(metadata.description).toBe(
        "Get the current user's hub ID for AI memory storage",
      );
      expect(metadata.title).toBe("Get User Hub ID");
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
        hubId: "initializing",
        keyPair: {} as JWKInterface,
        publicKey: "test-public-key",
        initializationComplete: false,
      });

      const result = await command.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Wallet is still initializing. Please wait a moment and try again.");
    });
  });
});
