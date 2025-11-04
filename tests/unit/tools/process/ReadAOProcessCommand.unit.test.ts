import { beforeEach, describe, expect, it, vi } from "vitest";

import { read } from "../../../../src/process.js";
import { ToolContext } from "../../../../src/tools/index.js";
import { ReadAOProcessCommand } from "../../../../src/tools/process/commands/ReadAOProcessCommand.js";

// Mock the read function from process.ts
vi.mock("../../../../src/process.js", () => ({
  read: vi.fn(),
}));

// Get typed mock
const mockRead = vi.mocked(read);

describe.sequential("ReadAOProcessCommand", () => {
  let command: ReadAOProcessCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockClear();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    command = new ReadAOProcessCommand(mockContext);
  });

  describe("Metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("readAOProcess");
      expect(metadata.title).toBe("Read AO Process (Dryrun Query)");
      expect(metadata.readOnlyHint).toBe(true);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Read data from an AO process using dryrun query",
      );
    });
  });

  describe("Parameter Validation", () => {
    it("should validate valid parameters with processId and tags", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Balance" }],
      });

      expect(result.success).toBe(true);
    });

    it("should validate multiple tags", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "Query" },
          { name: "Target", value: "State" },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid processId format", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "invalid-short-id",
        tags: [{ name: "Action", value: "Test" }],
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty tags array", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [],
      });

      expect(result.success).toBe(false);
    });

    it("should reject tags with empty names", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "", value: "test" }],
      });

      expect(result.success).toBe(false);
    });

    it("should accept tags with empty values", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "" }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Dryrun Query Execution", () => {
    it("should execute dryrun query successfully with string data", async () => {
      const mockMessage = {
        Data: "Balance: 1000",
        From: "process-id",
        Tags: [{ name: "Action", value: "Balance" }],
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Balance" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Dryrun query completed successfully");
      expect(parsed.result).toBe("Balance: 1000");

      expect(mockRead).toHaveBeenCalledWith(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Balance" }],
      );
    });

    it("should execute dryrun query with JSON data", async () => {
      const jsonData = { balance: "1000", status: "active" };
      const mockMessage = {
        Data: JSON.stringify(jsonData),
        From: "process-id",
        Tags: [{ name: "Action", value: "Info" }],
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Info" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(jsonData);
    });

    it("should execute dryrun with multiple tags", async () => {
      const mockMessage = {
        Data: "Query result",
        From: "process-id",
        Tags: [
          { name: "Action", value: "Query" },
          { name: "Type", value: "State" },
        ],
      };
      mockRead.mockResolvedValue(mockMessage);

      await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "Query" },
          { name: "Type", value: "State" },
        ],
      });

      expect(mockRead).toHaveBeenCalledWith(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "Query" },
          { name: "Type", value: "State" },
        ],
      );
    });
  });

  describe("Response Handling", () => {
    it("should handle undefined response from dryrun", async () => {
      mockRead.mockResolvedValue(undefined);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("No response from dryrun query");
      expect(parsed.result).toBeNull();
    });

    it("should handle null response from dryrun", async () => {
      mockRead.mockResolvedValue(null);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("No response from dryrun query");
      expect(parsed.result).toBeNull();
    });

    it("should handle message without Data field", async () => {
      const mockMessage = {
        From: "process-id",
        Tags: [{ name: "Action", value: "Test" }],
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockMessage);
    });

    it("should parse valid JSON string data", async () => {
      const jsonData = { count: 42, items: ["a", "b", "c"] };
      const mockMessage = {
        Data: JSON.stringify(jsonData),
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "List" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(jsonData);
    });

    it("should keep raw string when JSON parsing fails", async () => {
      const mockMessage = {
        Data: "Not valid JSON {",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe("Not valid JSON {");
    });

    it("should handle empty string data", async () => {
      const mockMessage = {
        Data: "",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockMessage);
    });

    it("should handle complex nested JSON data", async () => {
      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        status: "ok",
      };
      const mockMessage = {
        Data: JSON.stringify(complexData),
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Complex" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(complexData);
    });

    it("should handle numeric data", async () => {
      const mockMessage = {
        Data: "12345",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Count" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // "12345" string gets parsed as JSON number
      expect(parsed.result).toBe(12345);
    });
  });

  describe("Error Handling", () => {
    it("should handle read function errors", async () => {
      mockRead.mockRejectedValue(new Error("Network failure"));

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe("Failed to execute dryrun query");
      expect(parsed.error).toBe("Network failure");
      expect(parsed.processId).toBe(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      );
      expect(parsed.tags).toEqual([{ name: "Action", value: "Test" }]);
    });

    it("should handle non-Error exceptions", async () => {
      mockRead.mockRejectedValue("String error");

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Unknown error");
    });

    it("should include debugging context in error response", async () => {
      mockRead.mockRejectedValue(new Error("Process not found"));

      const result = await command.execute({
        processId: "missing-process-id-1234567890123456789",
        tags: [
          { name: "Action", value: "Query" },
          { name: "Type", value: "Balance" },
        ],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.processId).toBe("missing-process-id-1234567890123456789");
      expect(parsed.tags).toEqual([
        { name: "Action", value: "Query" },
        { name: "Type", value: "Balance" },
      ]);
    });

    it("should handle timeout errors", async () => {
      mockRead.mockRejectedValue(new Error("Request timeout"));

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "SlowQuery" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Request timeout");
    });

    it("should handle invalid process errors", async () => {
      mockRead.mockRejectedValue(new Error("Invalid process ID"));

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Invalid process ID");
    });
  });

  describe("Edge Cases", () => {
    it("should handle tag values with special characters", async () => {
      const mockMessage = {
        Data: "result",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "Test-Action_123" },
          { name: "Content-Type", value: "application/json" },
        ],
      });

      expect(mockRead).toHaveBeenCalledWith(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "Test-Action_123" },
          { name: "Content-Type", value: "application/json" },
        ],
      );
    });

    it("should handle data with special characters", async () => {
      const specialData = 'Special chars: {"key": "value"}, <tag>, & \n\t';
      const mockMessage = {
        Data: specialData,
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe(specialData);
    });

    it("should handle very long response data", async () => {
      const longData = "x".repeat(10000);
      const mockMessage = {
        Data: longData,
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "LongData" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe(longData);
    });

    it("should handle message with only Tags field", async () => {
      const mockMessage = {
        Tags: [
          { name: "Status", value: "Success" },
          { name: "Code", value: "200" },
        ],
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Status" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockMessage);
    });

    it("should handle Data field with boolean-like string", async () => {
      const mockMessage = {
        Data: "true",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Check" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // "true" string gets parsed as JSON boolean
      expect(parsed.result).toBe(true);
    });

    it("should handle Data field with null string", async () => {
      const mockMessage = {
        Data: "null",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // "null" string gets parsed as JSON null, but since responseData is null,
      // the result falls back to the whole message object
      expect(parsed.result).toEqual(mockMessage);
    });
  });

  describe("No Signer Required", () => {
    it("should execute without accessing keypair from context", async () => {
      const mockMessage = {
        Data: "result",
        From: "process-id",
      };
      mockRead.mockResolvedValue(mockMessage);

      // Execute command without any signer/keypair setup
      await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      // Verify read was called (no signer needed for dryrun)
      expect(mockRead).toHaveBeenCalledTimes(1);
      expect(mockRead).toHaveBeenCalledWith(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Test" }],
      );
    });
  });
});
