import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isMemoryEnabled } from "../../../../src/constants.js";
import { hubService } from "../../../../src/services/HubService.js";
import { ToolContext } from "../../../../src/tools/core/index.js";
import { AddMemoryCommand } from "../../../../src/tools/memory/commands/AddMemoryCommand.js";

// Mock hubService
vi.mock("../../../../src/services/HubService.js", () => ({
  hubService: {
    createEvent: vi.fn(),
  },
}));

// Mock constants
vi.mock("../../../../src/constants.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isMemoryEnabled: vi.fn(),
  };
});

// Mock AutoSafeToolContext
vi.mock("../../../../src/tools/core/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    AutoSafeToolContext: {
      from: vi.fn().mockReturnValue({
        initializeAll: vi.fn().mockResolvedValue({
          generated: false,
          hubCreated: false,
          hubId: "test-hub-id",
          keyPair: {},
        }),
      }),
    },
  };
});

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
      "Store a memory in the AI memory system for later retrieval. When MEMORY environment variable is disabled, automatic storage is blocked unless forceStore=true is used for explicit user requests.",
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

  it("should return disabled message when memory is disabled", async () => {
    vi.mocked(isMemoryEnabled).mockReturnValue(false);

    const args = {
      content: "Test memory content",
      p: "test-public-key",
      role: "user",
    };

    const result = await command.execute(args, mockContext);
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.stored).toBe(false);
    expect(parsedResult.message).toBe(
      "Memory storage is disabled. Set MEMORY=true environment variable to enable automatic memory storage, or use forceStore=true parameter for explicit storage requests.",
    );
    expect(hubService.createEvent).not.toHaveBeenCalled();
  });

  it("should execute successfully when forceStore=true even if memory is disabled", async () => {
    vi.mocked(isMemoryEnabled).mockReturnValue(false);
    const mockResult = [{ id: "test-event-id" }];
    vi.mocked(hubService.createEvent).mockResolvedValue(mockResult);

    const args = {
      content: "Test memory content",
      forceStore: true,
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

  it("should execute successfully and create memory when enabled", async () => {
    vi.mocked(isMemoryEnabled).mockReturnValue(true);
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

  it("should handle errors gracefully when memory is enabled", async () => {
    vi.mocked(isMemoryEnabled).mockReturnValue(true);
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

  it("should handle unknown errors when memory is enabled", async () => {
    vi.mocked(isMemoryEnabled).mockReturnValue(true);
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
