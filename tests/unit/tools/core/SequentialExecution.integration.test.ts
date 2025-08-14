import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ToolCommand,
  ToolContext,
} from "../../../../src/tools/core/ToolCommand.js";
import {
  clearInitializationPending,
  isInitializationPending,
} from "../../../../src/tools/core/ToolUtils.js";

// Mock implementation of an initialization tool
class MockInitializationTool extends ToolCommand<{ delay?: number }, string> {
  protected metadata = {
    description: "Mock initialization tool",
    name: "generateKeypair",
  };

  protected parametersSchema = vi.fn();

  async execute(args: { delay?: number }): Promise<string> {
    if (args.delay) {
      await new Promise((resolve) => setTimeout(resolve, args.delay));
    }
    return JSON.stringify({ mockResult: "initialized", success: true });
  }

  protected requiresSequentialExecution(): boolean {
    return true;
  }

  protected shouldWaitForInitialization(): boolean {
    return false;
  }
}

// Mock implementation of a regular tool that should wait
class MockRegularTool extends ToolCommand<{ data?: string }, string> {
  protected metadata = {
    description: "Mock regular tool",
    name: "addMemory",
  };

  protected parametersSchema = vi.fn();

  async execute(args: { data?: string }): Promise<string> {
    return JSON.stringify({ data: args.data || "processed", success: true });
  }
}

describe("Sequential Execution Integration", () => {
  let mockContext: ToolContext;
  let initTool: MockInitializationTool;
  let regularTool: MockRegularTool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "mock-hub-id",
      keyPair: {} as JWKInterface,
      publicKey: "mock-public-key",
    };

    initTool = new MockInitializationTool();
    regularTool = new MockRegularTool();

    // Clear any pending state
    clearInitializationPending("generateKeypair");
    clearInitializationPending("createHub");
    clearInitializationPending("initializeHub");
  });

  describe("initialization tool behavior", () => {
    it("should mark initialization as pending during execution", async () => {
      expect(isInitializationPending()).toBe(false);

      const toolDef = initTool.toToolDefinition(mockContext);

      // Start execution (with delay to check intermediate state)
      const executePromise = toolDef.execute({ delay: 100 });

      // Check that initialization is marked as pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(isInitializationPending()).toBe(true);

      // Wait for completion
      const result = await executePromise;
      expect(result).toContain("success");

      // Check that initialization is no longer pending
      expect(isInitializationPending()).toBe(false);
    });

    it("should clear pending state on error", async () => {
      const errorInitTool = new (class extends MockInitializationTool {
        async execute(): Promise<string> {
          throw new Error("Initialization failed");
        }
      })();

      expect(isInitializationPending()).toBe(false);

      const toolDef = errorInitTool.toToolDefinition(mockContext);

      try {
        await toolDef.execute({});
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // State should be cleared even after error
      expect(isInitializationPending()).toBe(false);
    });
  });

  describe("regular tool behavior", () => {
    it("should execute immediately when no initialization is pending", async () => {
      expect(isInitializationPending()).toBe(false);

      const toolDef = regularTool.toToolDefinition(mockContext);
      const startTime = Date.now();
      const result = await toolDef.execute({ data: "test" });
      const executionTime = Date.now() - startTime;

      expect(result).toContain("test");
      expect(executionTime).toBeLessThan(50); // Should be fast
    });

    it("should wait for pending initialization to complete", async () => {
      const toolDef = regularTool.toToolDefinition(mockContext);
      const initToolDef = initTool.toToolDefinition(mockContext);

      // Start initialization with delay
      const initPromise = initToolDef.execute({ delay: 200 });

      // Wait a bit to ensure initialization is marked as pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(isInitializationPending()).toBe(true);

      // Start regular tool execution
      const startTime = Date.now();
      const regularPromise = toolDef.execute({ data: "waiting" });

      // Both should complete
      await Promise.all([initPromise, regularPromise]);
      const totalTime = Date.now() - startTime;

      // Regular tool should have waited for initialization
      expect(totalTime).toBeGreaterThanOrEqual(180); // Close to the 200ms delay
      expect(isInitializationPending()).toBe(false);
    });

    it("should handle concurrent regular tools waiting for initialization", async () => {
      const toolDef1 = regularTool.toToolDefinition(mockContext);
      const toolDef2 = new MockRegularTool().toToolDefinition(mockContext);
      const initToolDef = initTool.toToolDefinition(mockContext);

      // Start initialization
      const initPromise = initToolDef.execute({ delay: 150 });

      // Wait to ensure pending state
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(isInitializationPending()).toBe(true);

      // Start multiple regular tools
      const startTime = Date.now();
      const regular1Promise = toolDef1.execute({ data: "first" });
      const regular2Promise = toolDef2.execute({ data: "second" });

      // All should complete
      const [initResult, result1, result2] = await Promise.all([
        initPromise,
        regular1Promise,
        regular2Promise,
      ]);
      const totalTime = Date.now() - startTime;

      expect(initResult).toContain("success");
      expect(result1).toContain("first");
      expect(result2).toContain("second");
      expect(totalTime).toBeGreaterThanOrEqual(130); // All waited for init
      expect(isInitializationPending()).toBe(false);
    });
  });

  describe("mixed execution scenarios", () => {
    it("should handle initialization tool followed by regular tool", async () => {
      const toolDef = regularTool.toToolDefinition(mockContext);
      const initToolDef = initTool.toToolDefinition(mockContext);

      // Execute initialization first
      const initResult = await initToolDef.execute({});
      expect(initResult).toContain("success");
      expect(isInitializationPending()).toBe(false);

      // Execute regular tool
      const startTime = Date.now();
      const result = await toolDef.execute({ data: "after-init" });
      const executionTime = Date.now() - startTime;

      expect(result).toContain("after-init");
      expect(executionTime).toBeLessThan(50); // Should be fast since init is done
    });

    it("should handle multiple initialization tools sequentially", async () => {
      const initTool1 = new MockInitializationTool();
      const initTool2 = new (class extends MockInitializationTool {
        protected metadata = {
          description: "Second init tool",
          name: "createHub",
        };
      })();

      const toolDef1 = initTool1.toToolDefinition(mockContext);
      const toolDef2 = initTool2.toToolDefinition(mockContext);

      // Execute first initialization
      const result1 = await toolDef1.execute({ delay: 50 });
      expect(result1).toContain("success");
      expect(isInitializationPending()).toBe(false);

      // Execute second initialization
      const result2 = await toolDef2.execute({ delay: 50 });
      expect(result2).toContain("success");
      expect(isInitializationPending()).toBe(false);
    });
  });
});
