import { beforeEach, describe, expect, it, vi } from "vitest";

import { send } from "../../../../src/process.js";
import { ToolContext } from "../../../../src/tools/index.js";
import { SendAOMessageCommand } from "../../../../src/tools/process/commands/SendAOMessageCommand.js";

// Mock the send function from process.ts
vi.mock("../../../../src/process.js", () => ({
  send: vi.fn(),
}));

// Mock AutoSafeToolContext
vi.mock("../../../../src/tools/core/AutoSafeToolContext.js", () => ({
  AutoSafeToolContext: {
    from: vi.fn().mockReturnValue({
      getKeyPair: vi.fn().mockResolvedValue({ mock: "keypair" }),
    }),
  },
}));

// Get typed mock
const mockSend = vi.mocked(send);

describe.sequential("SendAOMessageCommand", () => {
  let command: SendAOMessageCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear previous mock setup but keep the mock function
    mockSend.mockClear();

    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    command = new SendAOMessageCommand(mockContext);
  });

  describe("Metadata", () => {
    it("should have correct metadata", () => {
      const metadata = command.getMetadata();

      expect(metadata.name).toBe("sendAOMessage");
      expect(metadata.title).toBe("Send AO Message (Write Operation)");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Send an AO message with custom tags and data",
      );
    });
  });

  describe("Parameter Validation", () => {
    it("should validate valid parameters with tags and data", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        data: "test data",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Transfer" }],
      });

      expect(result.success).toBe(true);
    });

    it("should validate valid parameters with tags only (no data)", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Ping" }],
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

    it("should reject data exceeding max length", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        data: "x".repeat(100001), // Exceeds 100000 character limit
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
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
  });

  describe("Message Sending", () => {
    it("should send message with tags and data successfully", async () => {
      const mockResult = { status: "ok" };
      mockSend.mockResolvedValue(mockResult);

      const result = await command.execute({
        data: "100",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Recipient", value: "recipient-id-12345678901234567890123" },
        ],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Message sent successfully");
      expect(parsed.result).toEqual(mockResult);

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "Transfer" },
          { name: "Recipient", value: "recipient-id-12345678901234567890123" },
        ],
        "100",
      );
    });

    it("should send message with tags only (no data)", async () => {
      const mockResult = { status: "ping" };
      mockSend.mockResolvedValue(mockResult);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Ping" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockResult);

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Ping" }],
        null,
      );
    });

    it("should send message with multiple tags", async () => {
      const mockResult = { status: "processed" };
      mockSend.mockResolvedValue(mockResult);

      await command.execute({
        data: "custom payload",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "CustomAction" },
          { name: "Type", value: "Request" },
          { name: "Priority", value: "High" },
        ],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "CustomAction" },
          { name: "Type", value: "Request" },
          { name: "Priority", value: "High" },
        ],
        "custom payload",
      );
    });
  });

  describe("Response Handling", () => {
    it("should handle null response", async () => {
      mockSend.mockResolvedValue(null);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Message sent successfully");
      expect(parsed.result).toBe("No response data");
    });

    it("should handle undefined response", async () => {
      mockSend.mockResolvedValue(undefined);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe("No response data");
    });

    it("should handle JSON object response", async () => {
      const mockResult = {
        balance: "1000",
        status: "success",
        timestamp: "2024-01-01T00:00:00Z",
      };
      mockSend.mockResolvedValue(mockResult);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Balance" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockResult);
    });

    it("should handle string response", async () => {
      mockSend.mockResolvedValue("Simple string response");

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Echo" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe("Simple string response");
    });

    it("should handle numeric response", async () => {
      mockSend.mockResolvedValue(42);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Count" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toBe(42);
    });

    it("should handle array response", async () => {
      mockSend.mockResolvedValue(["item1", "item2", "item3"]);

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "List" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(["item1", "item2", "item3"]);
    });
  });

  describe("Error Handling", () => {
    it("should handle send function errors", async () => {
      mockSend.mockRejectedValue(new Error("Network failure"));

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe("Failed to send AO message");
      expect(parsed.error).toBe("Network failure");
      expect(parsed.processId).toBe(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      );
      expect(parsed.tags).toEqual([{ name: "Action", value: "Test" }]);
    });

    it("should handle non-Error exceptions", async () => {
      mockSend.mockRejectedValue("String error");

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Unknown error");
    });

    it("should include debugging context in error response", async () => {
      mockSend.mockRejectedValue(new Error("Process not found"));

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
      mockSend.mockRejectedValue(new Error("Request timeout"));

      const result = await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "SlowOperation" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Request timeout");
    });
  });

  describe("Integration with AutoSafeToolContext", () => {
    it("should retrieve keypair from context", async () => {
      mockSend.mockResolvedValue({ result: "ok" });

      await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      // Verify send was called successfully (keypair was retrieved)
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string data", async () => {
      mockSend.mockResolvedValue({ status: "ok" });

      const result = await command.execute({
        data: "",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      // Note: Empty string is falsy, so it gets converted to null by args.data || null
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Test" }],
        null, // Empty string becomes null
      );
    });

    it("should handle data with special characters", async () => {
      mockSend.mockResolvedValue({ status: "ok" });

      const specialData = 'Special chars: {"key": "value"}, <tag>, & \n\t';

      await command.execute({
        data: specialData,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Test" }],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Test" }],
        specialData,
      );
    });

    it("should handle tag values with special characters", async () => {
      mockSend.mockResolvedValue({ status: "ok" });

      await command.execute({
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Action", value: "Test-Action_123" },
          { name: "Content-Type", value: "application/json" },
        ],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object), // KeyPair object
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "Test-Action_123" },
          { name: "Content-Type", value: "application/json" },
        ],
        null,
      );
    });

    it("should handle large but valid data payload", async () => {
      mockSend.mockResolvedValue({ status: "ok" });

      const largeData = "x".repeat(99999); // Just under 100000 limit

      const result = await command.execute({
        data: largeData,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Action", value: "Upload" }],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
