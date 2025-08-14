import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { SpawnProcessCommand } from "../../../../src/tools/process/commands/SpawnProcessCommand.js";

// Mock the createProcess function
vi.mock("../../../../src/process.js", () => ({
  createProcess: vi.fn(),
}));

describe("SpawnProcessCommand", () => {
  let command: SpawnProcessCommand;
  let mockContext: ToolContext;
  let mockCreateProcess: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    // Get the mocked createProcess function
    const { createProcess } = await import("../../../../src/process.js");
    mockCreateProcess = createProcess;

    command = new SpawnProcessCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata;
      expect(metadata.name).toBe("spawnProcess");
      expect(metadata.title).toBe("Spawn AO Process");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Spawn a new AO process and return its process ID",
      );
    });
  });

  describe("parametersSchema", () => {
    it("should accept empty parameters", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept no additional parameters", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    it("should create process successfully", async () => {
      const mockProcessId = "test-process-id-12345";
      mockCreateProcess.mockResolvedValue(mockProcessId);

      const args = {};
      const result = await command.execute(args);

      expect(mockCreateProcess).toHaveBeenCalledWith(mockContext.keyPair);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.processId).toBe(mockProcessId);
      expect(parsedResult.message).toBe(
        `AO process created successfully: ${mockProcessId}`,
      );
    });

    it("should handle process creation errors", async () => {
      const mockError = new Error("Process creation failed");
      mockCreateProcess.mockRejectedValue(mockError);

      const args = {};
      const result = await command.execute(args);

      expect(mockCreateProcess).toHaveBeenCalledWith(mockContext.keyPair);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Process creation failed");
      expect(parsedResult.message).toBe("Failed to create AO process");
    });

    it("should handle unknown errors", async () => {
      const mockError = "Unknown error string";
      mockCreateProcess.mockRejectedValue(mockError);

      const args = {};
      const result = await command.execute(args);

      expect(mockCreateProcess).toHaveBeenCalledWith(mockContext.keyPair);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Unknown error");
      expect(parsedResult.message).toBe("Failed to create AO process");
    });

    it("should handle network timeout errors", async () => {
      const mockError = new Error("Request timeout after 30000ms");
      mockCreateProcess.mockRejectedValue(mockError);

      const args = {};
      const result = await command.execute(args);

      expect(mockCreateProcess).toHaveBeenCalledWith(mockContext.keyPair);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Request timeout after 30000ms");
      expect(parsedResult.message).toBe("Failed to create AO process");
    });

    it("should pass correct signer to createProcess", async () => {
      const mockProcessId = "test-process-id-67890";
      const customKeyPair = { custom: "key", kty: "RSA" } as any;
      const customContext = { ...mockContext, keyPair: customKeyPair };

      mockCreateProcess.mockResolvedValue(mockProcessId);

      const args = {};
      const customCommand = new SpawnProcessCommand(customContext);
      await customCommand.execute(args);

      expect(mockCreateProcess).toHaveBeenCalledWith(customKeyPair);
    });

    it("should return valid JSON response format", async () => {
      const mockProcessId = "test-process-id-validation";
      mockCreateProcess.mockResolvedValue(mockProcessId);

      const args = {};
      const result = await command.execute(args);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("success");
      expect(parsedResult).toHaveProperty("processId");
      expect(parsedResult).toHaveProperty("message");
      expect(typeof parsedResult.success).toBe("boolean");
      expect(typeof parsedResult.processId).toBe("string");
      expect(typeof parsedResult.message).toBe("string");
    });

    it("should handle AO Connect integration properly", async () => {
      // Test that the function works with actual AO process ID format
      const mockProcessId = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v";
      mockCreateProcess.mockResolvedValue(mockProcessId);

      const args = {};
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.processId).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    });
  });

  describe("tool integration", () => {
    it("should have correct tool definition structure", () => {
      const toolDef = command.toToolDefinition(mockContext);

      expect(toolDef.name).toBe("spawnProcess");
      expect(toolDef.description).toContain("Spawn a new AO process");
      expect(toolDef.annotations?.openWorldHint).toBe(false);
      expect(toolDef.annotations?.readOnlyHint).toBe(false);
      expect(toolDef.annotations?.title).toBe("Spawn AO Process");
      expect(typeof toolDef.execute).toBe("function");
    });

    it("should execute through tool definition", async () => {
      const mockProcessId = "tool-def-process-id";
      mockCreateProcess.mockResolvedValue(mockProcessId);

      const toolDef = command.toToolDefinition(mockContext);
      const result = await toolDef.execute({});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.processId).toBe(mockProcessId);
    });
  });
});
