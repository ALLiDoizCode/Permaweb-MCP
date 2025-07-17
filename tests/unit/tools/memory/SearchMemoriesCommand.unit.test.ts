import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hubService } from "../../../../src/services/HubService.js";
import { ToolContext } from "../../../../src/tools/core/index.js";
import { SearchMemoriesCommand } from "../../../../src/tools/memory/commands/SearchMemoriesCommand.js";

// Mock hubService
vi.mock("../../../../src/services/HubService.js", () => ({
  hubService: {
    search: vi.fn(),
  },
}));

describe("SearchMemoriesCommand", () => {
  let command: SearchMemoriesCommand;
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

    command = new SearchMemoriesCommand(mockContext);
  });

  it("should have correct metadata", () => {
    const metadata = command.getMetadata();
    expect(metadata.name).toBe("searchMemory");
    expect(metadata.title).toBe("Search Memory");
    expect(metadata.description).toBe(
      "Search stored memories by keywords or content",
    );
    expect(metadata.readOnlyHint).toBe(true);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should validate parameters correctly", () => {
    const schema = command.getParametersSchema();

    // Valid parameters
    const validParams = {
      search: "test query",
    };
    expect(() => schema.parse(validParams)).not.toThrow();

    // Missing required parameters
    expect(() => schema.parse({})).toThrow();

    // Empty search string should be valid
    expect(() => schema.parse({ search: "" })).not.toThrow();
  });

  it("should execute successfully and return search results", async () => {
    const mockResults = [
      { content: "First memory", id: "memory-1" },
      { content: "Second memory", id: "memory-2" },
    ];
    vi.mocked(hubService.search).mockResolvedValue(mockResults);

    const args = {
      search: "test query",
    };

    const result = await command.execute(args, mockContext);

    expect(result).toBe(JSON.stringify(mockResults));
    expect(hubService.search).toHaveBeenCalledWith(
      mockContext.hubId,
      "test query",
      "10",
    );
  });

  it("should handle empty search results", async () => {
    vi.mocked(hubService.search).mockResolvedValue([]);

    const args = {
      search: "nonexistent query",
    };

    const result = await command.execute(args, mockContext);

    expect(result).toBe("[]");
    expect(hubService.search).toHaveBeenCalledWith(
      mockContext.hubId,
      "nonexistent query",
      "10",
    );
  });

  it("should handle errors gracefully", async () => {
    const errorMessage = "Hub service error";
    vi.mocked(hubService.search).mockRejectedValue(new Error(errorMessage));

    const args = {
      search: "test query",
    };

    await expect(command.execute(args, mockContext)).rejects.toThrow(
      `Failed to search memories: ${errorMessage}`,
    );
  });

  it("should handle unknown errors", async () => {
    vi.mocked(hubService.search).mockRejectedValue("Unknown error");

    const args = {
      search: "test query",
    };

    await expect(command.execute(args, mockContext)).rejects.toThrow(
      "Failed to search memories: Unknown error",
    );
  });
});
