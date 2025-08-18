import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { SendMessageCommand } from "../../../../src/tools/process/commands/SendMessageCommand.js";

// Mock the send function
vi.mock("../../../../src/process.js", () => ({
  send: vi.fn(),
}));

// Mock ProcessCacheService
vi.mock("../../../../src/services/ProcessCacheService.js", () => ({
  ProcessCacheService: {
    getProcessInfo: vi.fn(),
  },
}));

describe("SendMessageCommand", () => {
  let command: SendMessageCommand;
  let mockContext: ToolContext;
  let mockSend: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    // Get the mocked send function
    const { send } = await import("../../../../src/process.js");
    mockSend = send;

    command = new SendMessageCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata;
      expect(metadata.name).toBe("sendMessage");
      expect(metadata.title).toBe("Send Message to Process");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Send a message to an AO process with specific action and data",
      );
    });
  });

  describe("parametersSchema", () => {
    it("should accept valid parameters", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        action: "Ping",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional data and tags", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        action: "Transfer",
        data: "100",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [{ name: "Target", value: "recipient-id" }],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty action", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        action: "",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing processId", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        action: "Ping",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("execute", () => {
    it("should validate action against process handlers when available", async () => {
      const { ProcessCacheService } = await import(
        "../../../../src/services/ProcessCacheService.js"
      );
      const mockGetProcessInfo = ProcessCacheService.getProcessInfo as any;

      // Mock process info with specific handlers
      mockGetProcessInfo.mockResolvedValue({
        handlers: [
          { action: "Ping" },
          { action: "Balance" },
          { action: "Info" },
        ],
        success: true,
      });

      const args = {
        action: "Transfer", // Action not supported by the process
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "Action 'Transfer' not supported by process",
      );
      expect(parsedResult.supportedActions).toEqual([
        "Ping",
        "Balance",
        "Info",
      ]);
    });

    it("should proceed when action is supported by process", async () => {
      const { ProcessCacheService } = await import(
        "../../../../src/services/ProcessCacheService.js"
      );
      const mockGetProcessInfo = ProcessCacheService.getProcessInfo as any;

      // Mock process info with handlers that support the action
      mockGetProcessInfo.mockResolvedValue({
        handlers: [
          { action: "Ping" },
          { action: "Balance" },
          { action: "Transfer" }, // Action is supported
        ],
        success: true,
      });

      const mockResult = { messageId: "msg123" };
      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "Transfer",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it("should be case-insensitive for action validation", async () => {
      const { ProcessCacheService } = await import(
        "../../../../src/services/ProcessCacheService.js"
      );
      const mockGetProcessInfo = ProcessCacheService.getProcessInfo as any;

      // Mock process info with uppercase handlers
      mockGetProcessInfo.mockResolvedValue({
        handlers: [{ action: "PING" }, { action: "BALANCE" }],
        success: true,
      });

      const mockResult = { messageId: "msg123" };
      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "ping", // lowercase should match uppercase handler
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it("should send message successfully with basic parameters", async () => {
      const { ProcessCacheService } = await import(
        "../../../../src/services/ProcessCacheService.js"
      );
      const mockGetProcessInfo = ProcessCacheService.getProcessInfo as any;

      // Mock no validation (process info unavailable)
      mockGetProcessInfo.mockResolvedValue(null);
      const mockResult = { message: "Pong" };
      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "Ping",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      expect(mockSend).toHaveBeenCalledWith(
        mockContext.keyPair,
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Ping" }],
        null,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.action).toBe("Ping");
      expect(parsedResult.processId).toBe(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      );
      expect(parsedResult.result).toEqual(mockResult);
    });

    it("should send message with data and additional tags", async () => {
      const mockResult = { status: "transferred" };
      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "Transfer",
        data: "100",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        tags: [
          { name: "Target", value: "recipient-id" },
          { name: "Quantity", value: "100" },
        ],
      };
      const result = await command.execute(args);

      expect(mockSend).toHaveBeenCalledWith(
        mockContext.keyPair,
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [
          { name: "Action", value: "Transfer" },
          { name: "Target", value: "recipient-id" },
          { name: "Quantity", value: "100" },
        ],
        "100",
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.action).toBe("Transfer");
      expect(parsedResult.data).toBe("100");
      expect(parsedResult.result).toEqual(mockResult);
    });

    it("should handle null result from send", async () => {
      mockSend.mockResolvedValue(null);

      const args = {
        action: "Ping",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Message sending returned null result");
    });

    it("should handle send errors", async () => {
      const mockError = new Error("Network timeout");
      mockSend.mockRejectedValue(mockError);

      const args = {
        action: "Ping",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Network timeout");
      expect(parsedResult.message).toBe("Failed to send message to AO process");
    });

    it("should handle unknown errors", async () => {
      const mockError = "Unknown error string";
      mockSend.mockRejectedValue(mockError);

      const args = {
        action: "Ping",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Unknown error");
    });

    it("should return valid JSON response format", async () => {
      const mockResult = { status: "ok" };
      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "Info",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("success");
      expect(parsedResult).toHaveProperty("action");
      expect(parsedResult).toHaveProperty("processId");
      expect(parsedResult).toHaveProperty("result");
      expect(parsedResult).toHaveProperty("tags");
    });

    it("should pass correct signer to send", async () => {
      const mockResult = { status: "ok" };
      const customKeyPair = { custom: "key", kty: "RSA" } as any;
      const customContext = { ...mockContext, keyPair: customKeyPair };

      mockSend.mockResolvedValue(mockResult);

      const args = {
        action: "Test",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const customCommand = new SendMessageCommand(customContext);
      await customCommand.execute(args);

      expect(mockSend).toHaveBeenCalledWith(
        customKeyPair,
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
        [{ name: "Action", value: "Test" }],
        null,
      );
    });
  });

  describe("tool integration", () => {
    it("should have correct tool definition structure", () => {
      const toolDef = command.toToolDefinition(mockContext);

      expect(toolDef.name).toBe("sendMessage");
      expect(toolDef.description).toContain("Send a message to an AO process");
      expect(toolDef.annotations?.openWorldHint).toBe(false);
      expect(toolDef.annotations?.readOnlyHint).toBe(false);
      expect(toolDef.annotations?.title).toBe("Send Message to Process");
      expect(typeof toolDef.execute).toBe("function");
    });

    it("should execute through tool definition", async () => {
      const mockResult = { status: "executed" };
      mockSend.mockResolvedValue(mockResult);

      const toolDef = command.toToolDefinition(mockContext);
      const result = await toolDef.execute({
        action: "Execute",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.action).toBe("Execute");
    });
  });
});
