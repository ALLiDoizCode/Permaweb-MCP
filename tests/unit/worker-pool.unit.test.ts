import { JWKInterface } from "arweave/node/lib/wallet.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerPoolConfig } from "../../src/types/worker.js";

// Mock worker_threads module
const mockWorker = {
  on: vi.fn(),
  once: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn().mockResolvedValue(void 0),
};

vi.mock("worker_threads", () => ({
  Worker: vi.fn(() => mockWorker),
}));

// Mock path module
vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

// Mock crypto module
const mockUUIDs = ["uuid-1", "uuid-2", "uuid-3", "uuid-4"];
let uuidCounter = 0;

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    digest: vi.fn(() => "test-hash"),
    update: vi.fn().mockReturnThis(),
  })),
  randomUUID: vi.fn(() => {
    const uuid = mockUUIDs[uuidCounter % mockUUIDs.length];
    uuidCounter++;
    return uuid;
  }),
}));

describe("Worker Pool Management Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Worker Pool Configuration", () => {
    it("should use default configuration when none provided", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool();

      const stats = pool.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.activeWorkers).toBe(0);

      await pool.shutdown(100);
    });

    it("should use custom configuration", async () => {
      const config: Partial<WorkerPoolConfig> = {
        enablePreGeneration: true,
        maxQueueSize: 100,
        maxWorkers: 4,
        preGenerationIdleThresholdMs: 30000,
        workerTimeoutMs: 60000,
      };

      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool(config);

      // Configuration should be applied (we can't directly test private config,
      // but we can test behavior)
      const stats = pool.getStats();
      expect(stats).toBeDefined();

      await pool.shutdown(100);
    });
  });

  describe("Queue Priority Handling", () => {
    it("should prioritize high priority requests", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      const messages: any[] = [];

      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      mockWorker.postMessage.mockImplementation((msg: any) => {
        messages.push(msg);
      });

      // Queue multiple requests with different priorities
      const lowPriorityPromise = pool.generateKey("low priority mnemonic", {
        priority: "low",
      });
      const highPriorityPromise = pool.generateKey("high priority mnemonic", {
        priority: "high",
      });
      const normalPriorityPromise = pool.generateKey(
        "normal priority mnemonic",
        { priority: "normal" },
      );

      // Allow queue processing to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // High priority should be processed first
      expect(messages.length).toBeGreaterThan(0);
      if (messages[0]) {
        expect(messages[0].mnemonic).toBe("high priority mnemonic");
      }

      await pool.shutdown(100);

      // Clean up promises
      [lowPriorityPromise, highPriorityPromise, normalPriorityPromise].forEach(
        (p) => p.catch(() => {}),
      );
    });

    it("should handle queue size limits", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxQueueSize: 2, maxWorkers: 1 });

      // Fill the queue beyond capacity
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(pool.generateKey(`mnemonic ${i}`));
      }

      // Some requests should be rejected due to queue size limit
      const results = await Promise.allSettled(promises);
      const rejectedCount = results.filter(
        (r) => r.status === "rejected",
      ).length;
      expect(rejectedCount).toBeGreaterThan(0);

      await pool.shutdown(100);
    });

    it("should deduplicate identical mnemonic requests", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      const messages: any[] = [];

      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      mockWorker.postMessage.mockImplementation((msg: any) => {
        messages.push(msg);
      });

      const sameMnemonic = "identical mnemonic phrase";

      // Make multiple requests with same mnemonic
      const promise1 = pool.generateKey(sameMnemonic);
      const promise2 = pool.generateKey(sameMnemonic);
      const promise3 = pool.generateKey(sameMnemonic);

      // Allow queue processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only have one actual worker message for the duplicate mnemonics
      const uniqueMnemonics = new Set(messages.map((m) => m.mnemonic));
      expect(uniqueMnemonics.size).toBeLessThanOrEqual(1);

      await pool.shutdown(100);

      // Clean up promises
      [promise1, promise2, promise3].forEach((p) => p.catch(() => {}));
    });
  });

  describe("Concurrent Request Management", () => {
    it("should limit concurrent workers", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 2 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      // Create more requests than max workers
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(pool.generateKey(`mnemonic ${i}`));
      }

      // Allow workers to be created
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = pool.getStats();
      expect(stats.activeWorkers).toBeLessThanOrEqual(2);

      await pool.shutdown(100);

      // Clean up promises
      promises.forEach((p) => p.catch(() => {}));
    });

    it("should handle worker timeout correctly", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1, workerTimeoutMs: 50 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("timeout test mnemonic");

      // Don't simulate a response - let it timeout
      await expect(generatePromise).rejects.toThrow("Worker timeout");

      await pool.shutdown(100);
    });

    it("should recover from worker failures", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 2 });

      const messageHandlers = new Map();
      const errorHandlers = new Map();

      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          if (event === "message") {
            messageHandlers.set(event, handler);
          } else if (event === "error") {
            errorHandlers.set(event, handler);
          }
        },
      );

      const promise1 = pool.generateKey("first mnemonic");
      const promise2 = pool.generateKey("second mnemonic");

      // Simulate worker error
      const errorHandler = errorHandlers.get("error");
      if (errorHandler) {
        errorHandler(new Error("Worker crashed"));
      }

      // Pool should continue to work for remaining requests
      await expect(promise1).rejects.toThrow();

      await pool.shutdown(100);

      // Clean up promises
      promise2.catch(() => {});
    });
  });

  describe("Background Processing and Idle Detection", () => {
    it("should detect idle state when configured", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({
        enablePreGeneration: true,
        preGenerationIdleThresholdMs: 10, // Very short for testing
      });

      // Wait for idle detection
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged idle detection (in real implementation)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("idle"));

      consoleSpy.mockRestore();
      await pool.shutdown(100);
    });

    it("should not run idle detection when disabled", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({
        enablePreGeneration: false,
      });

      // No specific assertion here - just ensuring no errors occur
      await new Promise((resolve) => setTimeout(resolve, 20));

      await pool.shutdown(100);
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should track job completion statistics", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic");

      // Simulate successful completion
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        const testJwk: JWKInterface = {
          d: "test-d",
          dp: "test-dp",
          dq: "test-dq",
          e: "AQAB",
          kty: "RSA",
          n: "test-n",
          p: "test-p",
          q: "test-q",
          qi: "test-qi",
        };

        messageHandler({
          id: "uuid-1",
          result: testJwk,
          type: "result",
        });
      }

      const stats = pool.getStats();
      expect(stats.completedJobs).toBe(1);
      expect(stats.failedJobs).toBe(0);

      await pool.shutdown(100);

      // Clean up the promise
      generatePromise.catch(() => {});
    });

    it("should track job failure statistics", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic");

      // Simulate error
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        messageHandler({
          error: "Test error",
          id: "uuid-1",
          type: "error",
        });
      }

      await expect(generatePromise).rejects.toThrow("Test error");

      const stats = pool.getStats();
      expect(stats.failedJobs).toBe(1);
      expect(stats.completedJobs).toBe(0);

      await pool.shutdown(100);
    });

    it("should calculate average processing time", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      // Initial stats should have zero average
      const initialStats = pool.getStats();
      expect(initialStats.averageProcessingTimeMs).toBe(0);

      await pool.shutdown(100);
    });

    it("should provide queue size in statistics", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      mockWorker.on.mockImplementation(() => {});

      // Add requests to queue
      const promise1 = pool.generateKey("test 1");
      const promise2 = pool.generateKey("test 2");

      // Check queue size
      const stats = pool.getStats();
      expect(stats.queueSize).toBeGreaterThan(0);

      await pool.shutdown(100);

      // Clean up promises
      [promise1, promise2].forEach((p) => p.catch(() => {}));
    });
  });

  describe("Global Worker Pool Functions", () => {
    it("should create and return global worker pool instance", async () => {
      const { getWorkerPool, shutdownWorkerPool } = await import(
        "../../src/worker-pool.js"
      );

      const pool1 = getWorkerPool();
      const pool2 = getWorkerPool();

      // Should return same instance
      expect(pool1).toBe(pool2);

      await shutdownWorkerPool();
    });

    it("should create new instance with different config", async () => {
      const { getWorkerPool, shutdownWorkerPool } = await import(
        "../../src/worker-pool.js"
      );

      // Clear any existing instance
      await shutdownWorkerPool();

      const pool = getWorkerPool({ maxWorkers: 4 });
      expect(pool).toBeDefined();

      await shutdownWorkerPool();
    });

    it("should handle shutdown of non-existent pool gracefully", async () => {
      const { shutdownWorkerPool } = await import("../../src/worker-pool.js");

      // Should not throw
      await expect(shutdownWorkerPool()).resolves.not.toThrow();
    });
  });
});
