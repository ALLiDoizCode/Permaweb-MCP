import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hubService } from "../../../../src/services/HubService.js";
import { ToolContext } from "../../../../src/tools/core/index.js";
import { AddMemoryCommand } from "../../../../src/tools/memory/commands/AddMemoryCommand.js";

// Mock hubService
vi.mock("../../../../src/services/HubService.js", () => ({
  hubService: {
    createEvent: vi.fn(),
  },
}));

describe("AddMemoryCommand", () => {
  let command: AddMemoryCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = {} as JWKInterface;
    mockContext = {
      hubId: "test-hub-id",
      keyPair: mockKeyPair,
      publicKey: "test-public-key",
    };

    command = new AddMemoryCommand(mockContext);
  });

  it("should have correct metadata", () => {
    const metadata = command.getMetadata();
    expect(metadata.name).toBe("storeMemory");
    expect(metadata.title).toBe("Store Memory");
    expect(metadata.description).toBe(
      "Store a memory in the AI memory system for later retrieval",
    );
    expect(metadata.readOnlyHint).toBe(false);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should validate parameters correctly", () => {
    const schema = command.getParametersSchema();

    // Valid parameters
    const validParams = {
      content: "Test memory content",
      p: "test-public-key",
      role: "user",
    };
    expect(() => schema.parse(validParams)).not.toThrow();

    // Missing required parameters
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ content: "test" })).toThrow();
    expect(() => schema.parse({ content: "test", p: "key" })).toThrow();
  });

  it("should execute successfully and create memory", async () => {
    const mockResult = [{ id: "test-event-id" }];
    vi.mocked(hubService.createEvent).mockResolvedValue(mockResult);

    const args = {
      content: "Test memory content",
      p: "test-public-key",
      role: "user",
    };

    const result = await command.execute(args, mockContext);

    expect(result).toBe(JSON.stringify(mockResult));
    expect(hubService.createEvent).toHaveBeenCalledWith(
      mockContext.keyPair,
      mockContext.hubId,
      [
        { name: "Kind", value: "10" },
        { name: "Content", value: "Test memory content" },
        { name: "r", value: "user" },
        { name: "p", value: "test-public-key" },
      ],
    );
  });

  it("should handle errors gracefully", async () => {
    const errorMessage = "Hub service error";
    vi.mocked(hubService.createEvent).mockRejectedValue(
      new Error(errorMessage),
    );

    const args = {
      content: "Test memory content",
      p: "test-public-key",
      role: "user",
    };

    await expect(command.execute(args, mockContext)).rejects.toThrow(
      `Failed to store memory: ${errorMessage}`,
    );
  });

  it("should handle unknown errors", async () => {
    vi.mocked(hubService.createEvent).mockRejectedValue("Unknown error");

    const args = {
      content: "Test memory content",
      p: "test-public-key",
      role: "user",
    };

    await expect(command.execute(args, mockContext)).rejects.toThrow(
      "Failed to store memory: Unknown error",
    );
  });
});
