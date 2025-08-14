import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { EvalProcessCommand } from "../../../../src/tools/process/commands/EvalProcessCommand.js";

// Mock the evalProcess function
vi.mock("../../../../src/relay.js", () => ({
  evalProcess: vi.fn(),
}));

describe("EvalProcessCommand", () => {
  let command: EvalProcessCommand;
  let mockContext: ToolContext;
  let mockEvalProcess: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    // Get the mocked evalProcess function
    const { evalProcess } = await import("../../../../src/relay.js");
    mockEvalProcess = evalProcess;

    command = new EvalProcessCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata;
      expect(metadata.name).toBe("evalProcess");
      expect(metadata.title).toBe("Evaluate Process Code");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Deploy and evaluate Lua code within an existing AO process",
      );
    });
  });

  describe("parametersSchema", () => {
    it("should accept valid processId and code", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        code: "return 2 + 2",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid processId length", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        code: "return 2 + 2",
        processId: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty code", () => {
      const schema = (command as any).parametersSchema;
      const result = schema.safeParse({
        code: "",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(false);
    });

    it("should reject code that is too long", () => {
      const schema = (command as any).parametersSchema;
      const longCode = "x".repeat(10001);
      const result = schema.safeParse({
        code: longCode,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(false);
    });

    it("should accept multi-line Lua code", () => {
      const schema = (command as any).parametersSchema;
      const multiLineCode = `
        local function test()
          return "Hello, World!"
        end
        return test()
      `;
      const result = schema.safeParse({
        code: multiLineCode,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    it("should evaluate code successfully", async () => {
      const mockResult = { output: "4", status: "success" };
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: "return 2 + 2",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      expect(mockEvalProcess).toHaveBeenCalledWith(
        mockContext.keyPair,
        args.code,
        args.processId,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toEqual(mockResult);
      expect(parsedResult.message).toBe("Code evaluated successfully");
    });

    it("should handle null result from evalProcess as success", async () => {
      mockEvalProcess.mockResolvedValue(null);

      const args = {
        code: "Handlers.add('test', function() end)",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe("Code evaluated successfully (handler registration completed)");
      expect(parsedResult.result).toBe("No return value - handlers registered successfully");
    });

    it("should handle undefined result from evalProcess as success", async () => {
      mockEvalProcess.mockResolvedValue(undefined);

      const args = {
        code: "local var = 'initialized'",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe("Code evaluated successfully (handler registration completed)");
      expect(parsedResult.result).toBe("No return value - handlers registered successfully");
    });

    it("should handle evaluation errors", async () => {
      const mockError = new Error("Lua evaluation failed");
      mockEvalProcess.mockRejectedValue(mockError);

      const args = {
        code: "invalid lua code",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Lua evaluation failed");
      expect(parsedResult.message).toBe(
        "Failed to evaluate code in AO process",
      );
    });

    it("should handle unknown errors", async () => {
      const mockError = "Unknown error string";
      mockEvalProcess.mockRejectedValue(mockError);

      const args = {
        code: "return 2 + 2",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Unknown error");
      expect(parsedResult.message).toBe(
        "Failed to evaluate code in AO process",
      );
    });

    it("should handle network timeout errors", async () => {
      const mockError = new Error("Request timeout after 30000ms");
      mockEvalProcess.mockRejectedValue(mockError);

      const args = {
        code: "return 2 + 2",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Request timeout after 30000ms");
      expect(parsedResult.message).toBe(
        "Failed to evaluate code in AO process",
      );
    });

    it("should pass correct parameters to evalProcess", async () => {
      const mockResult = { output: "Hello, World!" };
      const customKeyPair = { custom: "key", kty: "RSA" } as any;
      const customContext = { ...mockContext, keyPair: customKeyPair };

      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: 'return "Hello, World!"',
        processId: "custom-process-id-1234567890123456789012345",
      };
      const customCommand = new EvalProcessCommand(customContext);
      await customCommand.execute(args);

      expect(mockEvalProcess).toHaveBeenCalledWith(
        customKeyPair,
        args.code,
        args.processId,
      );
    });

    it("should return valid JSON response format", async () => {
      const mockResult = { status: "ok" };
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: "return true",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("success");
      expect(parsedResult).toHaveProperty("result");
      expect(parsedResult).toHaveProperty("message");
      expect(typeof parsedResult.success).toBe("boolean");
      expect(typeof parsedResult.message).toBe("string");
    });

    it("should handle complex multi-line Lua code", async () => {
      const complexCode = `
        local function fibonacci(n)
          if n <= 1 then
            return n
          else
            return fibonacci(n-1) + fibonacci(n-2)
          end
        end
        
        return fibonacci(5)
      `;
      const mockResult = { output: "5", status: "success" };
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: complexCode,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      expect(mockEvalProcess).toHaveBeenCalledWith(
        mockContext.keyPair,
        complexCode,
        args.processId,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toEqual(mockResult);
    });
  });

  describe("tool integration", () => {
    it("should have correct tool definition structure", () => {
      const toolDef = command.toToolDefinition(mockContext);

      expect(toolDef.name).toBe("evalProcess");
      expect(toolDef.description).toContain(
        "Deploy and evaluate Lua code within an existing AO process",
      );
      expect(toolDef.annotations?.openWorldHint).toBe(false);
      expect(toolDef.annotations?.readOnlyHint).toBe(false);
      expect(toolDef.annotations?.title).toBe("Evaluate Process Code");
      expect(typeof toolDef.execute).toBe("function");
    });

    it("should execute through tool definition", async () => {
      const mockResult = { output: "test result" };
      mockEvalProcess.mockResolvedValue(mockResult);

      const toolDef = command.toToolDefinition(mockContext);
      const result = await toolDef.execute({
        code: "return 'test'",
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toEqual(mockResult);
    });

    it("should have correct tool definition structure for validation", () => {
      const toolDef = command.toToolDefinition(mockContext);

      // Should have correct basic structure
      expect(toolDef.name).toBe("evalProcess");
      expect(typeof toolDef.execute).toBe("function");
      expect(toolDef.description).toContain("Deploy and evaluate Lua code");
    });
  });

  describe("AO-specific Lua code patterns", () => {
    it("should handle AO message handling patterns", async () => {
      const aoCode = `
        Handlers.add(
          "test",
          Handlers.utils.hasMatchingTag("Action", "Test"),
          function(msg)
            return "Test handler executed"
          end
        )
      `;
      const mockResult = { status: "handler_added" };
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: aoCode,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toEqual(mockResult);
    });

    it("should handle variable assignments and state changes", async () => {
      const stateCode = `
        Name = "Test Process"
        Owner = msg.From
        Balance = 1000
        return { Name = Name, Owner = Owner, Balance = Balance }
      `;
      const mockResult = {
        Balance: 1000,
        Name: "Test Process",
        Owner: "test-owner",
      };
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: stateCode,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toEqual(mockResult);
    });

    it("should handle simple expressions", async () => {
      const simpleExpression = "2 + 2";
      const mockResult = 4;
      mockEvalProcess.mockResolvedValue(mockResult);

      const args = {
        code: simpleExpression,
        processId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      };
      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result).toBe(4);
    });
  });
});
