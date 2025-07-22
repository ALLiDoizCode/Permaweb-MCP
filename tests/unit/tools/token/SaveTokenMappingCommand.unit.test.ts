import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { SaveTokenMappingCommand } from "../../../../src/tools/token/commands/SaveTokenMappingCommand.js";

// Mock dependencies
vi.mock("../../../../src/relay.js", () => ({
  event: vi.fn(),
}));

vi.mock("../../../../src/services/aiMemoryService.js", () => ({
  MEMORY_KINDS: {
    TOKEN_MAPPING: "30",
  },
}));

describe("SaveTokenMappingCommand", () => {
  let command: SaveTokenMappingCommand;
  let mockContext: ToolContext;
  let mockEvent: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { mockKey: "value" } as any,
      publicKey: "test-public-key",
    };

    command = new SaveTokenMappingCommand(mockContext);

    // Get mocked functions
    mockEvent = (await import("../../../../src/relay.js")).event;
  });

  describe("execute", () => {
    it("should save token mapping successfully", async () => {
      const mockTags = [
        { name: "Kind", value: "30" },
        {
          name: "Content",
          value:
            "Token mapping: Arweave Token (AR) -> xyz123def456ghi789jkl012mno345pqr678stu901v",
        },
        { name: "p", value: "test-public-key" },
        { name: "token_name", value: "Arweave Token" },
        { name: "token_ticker", value: "AR" },
        {
          name: "token_processId",
          value: "xyz123def456ghi789jkl012mno345pqr678stu901v",
        },
        { name: "domain", value: "token-registry" },
      ];

      mockEvent.mockResolvedValue(mockTags);

      const result = await command.execute({
        name: "Arweave Token",
        processId: "xyz123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "ar", // Should be auto-uppercased
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.mapping).toEqual({
        name: "Arweave Token",
        processId: "xyz123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "AR",
      });
      expect(parsed.message).toBe(
        "Token mapping saved: Arweave Token (AR) -> xyz123def456ghi789jkl012mno345pqr678stu901v",
      );
      expect(parsed.tags).toEqual(mockTags);

      expect(mockEvent).toHaveBeenCalledWith(
        { mockKey: "value" },
        "test-hub-id",
        [
          { name: "Kind", value: "30" },
          {
            name: "Content",
            value:
              "Token mapping: Arweave Token (AR) -> xyz123def456ghi789jkl012mno345pqr678stu901v",
          },
          { name: "p", value: "test-public-key" },
          { name: "token_name", value: "Arweave Token" },
          { name: "token_ticker", value: "AR" },
          {
            name: "token_processId",
            value: "xyz123def456ghi789jkl012mno345pqr678stu901v",
          },
          { name: "domain", value: "token-registry" },
        ],
      );
    });

    it("should auto-uppercase ticker", async () => {
      mockEvent.mockResolvedValue([]);

      const result = await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "test", // Should be auto-uppercased to "TEST"
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.mapping.ticker).toBe("TEST");
      expect(parsed.message).toBe(
        "Token mapping saved: Test Token (TEST) -> abc123def456ghi789jkl012mno345pqr678stu901v",
      );
    });

    it("should handle storage error", async () => {
      mockEvent.mockRejectedValue(new Error("Storage failed"));

      const result = await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Failed to save token mapping: Storage failed");
    });

    it("should handle unknown error", async () => {
      mockEvent.mockRejectedValue("Unknown error");

      const result = await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Failed to save token mapping: Unknown error");
    });

    it("should use correct memory kind for token mapping", async () => {
      mockEvent.mockResolvedValue([]);

      await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining([{ name: "Kind", value: "30" }]),
      );
    });

    it("should include all required tags", async () => {
      mockEvent.mockResolvedValue([]);

      await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining([
          { name: "Kind", value: "30" },
          {
            name: "Content",
            value:
              "Token mapping: Test Token (TEST) -> abc123def456ghi789jkl012mno345pqr678stu901v",
          },
          { name: "p", value: "test-public-key" },
          { name: "token_name", value: "Test Token" },
          { name: "token_ticker", value: "TEST" },
          {
            name: "token_processId",
            value: "abc123def456ghi789jkl012mno345pqr678stu901v",
          },
          { name: "domain", value: "token-registry" },
        ]),
      );
    });

    it("should handle context with different hub ID", async () => {
      const customContext = {
        ...mockContext,
        hubId: "custom-hub-123",
      };

      const customCommand = new SaveTokenMappingCommand(customContext);
      mockEvent.mockResolvedValue([]);

      await customCommand.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.anything(),
        "custom-hub-123",
        expect.anything(),
      );
    });

    it("should handle context with different public key", async () => {
      const customContext = {
        ...mockContext,
        publicKey: "different-public-key",
      };

      const customCommand = new SaveTokenMappingCommand(customContext);
      mockEvent.mockResolvedValue([]);

      await customCommand.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining([{ name: "p", value: "different-public-key" }]),
      );
    });
  });

  describe("parameter validation", () => {
    it("should validate process ID format via schema", () => {
      const schema = command.getParametersSchema();
      expect(() => {
        schema.parse({
          name: "Test Token",
          processId: "invalid-process-id",
          ticker: "TEST",
        });
      }).toThrow();
    });

    it("should validate name length via schema", () => {
      const schema = command.getParametersSchema();
      expect(() => {
        schema.parse({
          name: "", // Empty name
          processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
          ticker: "TEST",
        });
      }).toThrow();

      expect(() => {
        schema.parse({
          name: "a".repeat(51), // Too long name
          processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
          ticker: "TEST",
        });
      }).toThrow();
    });

    it("should validate ticker length via schema", () => {
      const schema = command.getParametersSchema();
      expect(() => {
        schema.parse({
          name: "Test Token",
          processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
          ticker: "", // Empty ticker
        });
      }).toThrow();

      expect(() => {
        schema.parse({
          name: "Test Token",
          processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
          ticker: "VERYLONGTICKER", // Too long ticker
        });
      }).toThrow();
    });

    it("should accept valid parameters via schema", () => {
      const schema = command.getParametersSchema();
      expect(() => {
        schema.parse({
          name: "Test Token",
          processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
          ticker: "TEST",
        });
      }).not.toThrow();
    });
  });

  describe("metadata", () => {
    it("should have correct tool metadata", () => {
      expect(command.metadata.name).toBe("saveTokenMapping");
      expect(command.metadata.description).toBe(
        "Save a token name/ticker to process ID mapping for future use",
      );
      expect(command.metadata.title).toBe("Save Token Mapping");
      expect(command.metadata.openWorldHint).toBe(false);
      expect(command.metadata.readOnlyHint).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed case ticker normalization", async () => {
      mockEvent.mockResolvedValue([]);

      const result = await command.execute({
        name: "Mixed Case Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "mIxEd", // Should become "MIXED"
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.mapping.ticker).toBe("MIXED");
    });

    it("should handle special characters in token name", async () => {
      mockEvent.mockResolvedValue([]);

      const result = await command.execute({
        name: "Special & Token (v2.0)",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "SPCL",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.mapping.name).toBe("Special & Token (v2.0)");
    });

    it("should handle duplicate token mapping attempt", async () => {
      // First mapping succeeds
      mockEvent.mockResolvedValue([]);

      const result1 = await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      const parsed1 = JSON.parse(result1);
      expect(parsed1.success).toBe(true);

      // Second mapping with same details should also succeed (overwrite)
      const result2 = await command.execute({
        name: "Test Token",
        processId: "abc123def456ghi789jkl012mno345pqr678stu901v",
        ticker: "TEST",
      });

      const parsed2 = JSON.parse(result2);
      expect(parsed2.success).toBe(true);
    });
  });
});
