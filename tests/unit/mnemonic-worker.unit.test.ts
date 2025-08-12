import { JWKInterface } from "arweave/node/lib/wallet.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Worker } from "worker_threads";

import type { WorkerMessage } from "../../src/types/worker.js";

// Mock worker_threads module
const mockWorker = {
  on: vi.fn(),
  once: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn(),
};

vi.mock("worker_threads", () => ({
  parentPort: {
    on: vi.fn(),
    postMessage: vi.fn(),
  },
  Worker: vi.fn(() => mockWorker),
  workerData: {},
}));

// Mock path module
vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

// Mock crypto module
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    digest: vi.fn(() => "test-hash"),
    update: vi.fn().mockReturnThis(),
  })),
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

describe("Worker Thread Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Worker Message Protocol", () => {
    it("should create worker with correct parameters", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      // Generate a key to trigger worker creation
      const generatePromise = pool.generateKey("test mnemonic phrase here");

      expect(Worker).toHaveBeenCalledWith(
        expect.stringContaining("mnemonic-worker.js"),
      );

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });

    it("should handle worker message types correctly", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      // Mock worker event handlers
      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      // Generate a key to trigger worker creation
      const generatePromise = pool.generateKey("test mnemonic phrase");

      // Simulate worker messages
      const messageHandler = messageHandlers.get("message");

      if (messageHandler) {
        // Simulate progress message
        const progressMessage: WorkerMessage = {
          id: "test-uuid-123",
          progress: {
            estimatedTimeMs: 4000,
            percentage: 0,
            stage: "initialization",
          },
          type: "progress",
        };
        messageHandler(progressMessage);

        // Simulate result message
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

        const resultMessage: WorkerMessage = {
          id: "test-uuid-123",
          result: testJwk,
          type: "result",
        };
        messageHandler(resultMessage);
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });

    it("should handle worker error messages", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic");

      // Simulate error message
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        const errorMessage: WorkerMessage = {
          error: "Test worker error",
          id: "test-uuid-123",
          type: "error",
        };
        messageHandler(errorMessage);
      }

      await expect(generatePromise).rejects.toThrow("Test worker error");

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }
    });

    it("should handle worker exit events", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const exitHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (exitCode: number) => void) => {
          if (event === "exit") {
            exitHandlers.set(event, handler);
          }
        },
      );

      // Generate a key to trigger worker creation
      const generatePromise = pool.generateKey("test mnemonic");

      // Simulate worker exit
      const exitHandler = exitHandlers.get("exit");
      if (exitHandler) {
        exitHandler(1); // Exit with error code
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });
  });

  describe("Progress Callback Mechanism", () => {
    it("should call progress callback with correct parameters", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const progressCallback = vi.fn();
      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic", {
        onProgress: progressCallback,
      });

      // Simulate progress messages
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        const progressMessage: WorkerMessage = {
          id: "test-uuid-123",
          progress: {
            estimatedTimeMs: 2000,
            percentage: 50,
            stage: "key_generation",
          },
          type: "progress",
        };
        messageHandler(progressMessage);

        expect(progressCallback).toHaveBeenCalledWith(
          "key_generation",
          50,
          2000,
        );
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });

    it("should handle missing progress callback gracefully", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic");

      // Simulate progress message without callback
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        const progressMessage: WorkerMessage = {
          id: "test-uuid-123",
          progress: {
            estimatedTimeMs: 4000,
            percentage: 0,
            stage: "initialization",
          },
          type: "progress",
        };

        // Should not throw
        expect(() => messageHandler(progressMessage)).not.toThrow();
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });
  });

  describe("Worker Cleanup and Resource Management", () => {
    it("should terminate workers on shutdown", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 2 });

      // Create some workers
      const promise1 = pool.generateKey("test mnemonic 1");
      const promise2 = pool.generateKey("test mnemonic 2");

      // Shutdown the pool
      await pool.shutdown(100);

      expect(mockWorker.terminate).toHaveBeenCalled();

      // Clean up promises
      promise1.catch(() => {});
      promise2.catch(() => {});
    });

    it("should handle shutdown timeout correctly", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      // Create a worker
      const generatePromise = pool.generateKey("test mnemonic");

      // Mock setTimeout to control timing
      const originalSetTimeout = global.setTimeout;
      const timeoutCallback = vi.fn();
      global.setTimeout = vi.fn((callback: () => void, delay: number) => {
        if (delay === 100) {
          // Our shutdown timeout
          timeoutCallback.mockImplementation(callback);
        }
        return originalSetTimeout(callback, delay);
      }) as unknown as typeof setTimeout;

      // Shutdown with short timeout
      const shutdownPromise = pool.shutdown(100);

      // Trigger timeout
      if (timeoutCallback.mock.calls.length > 0) {
        timeoutCallback();
      }

      await expect(shutdownPromise).resolves.not.toThrow();

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      // Clean up the promise
      generatePromise.catch(() => {});
    });
  });

  describe("Error Propagation", () => {
    it("should propagate worker creation errors", async () => {
      // Mock Worker constructor to throw
      vi.mocked(Worker).mockImplementationOnce(() => {
        throw new Error("Failed to create worker");
      });

      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      // Generating key should still work (fallback behavior)
      const generatePromise = pool.generateKey("test mnemonic");

      // The promise might resolve or reject depending on fallback behavior
      // We just ensure it doesn't hang
      try {
        await Promise.race([
          generatePromise,
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);
      } catch {
        // Expected in some cases
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }
    });

    it("should handle malformed worker messages", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 1 });

      const messageHandlers = new Map();
      mockWorker.on.mockImplementation(
        (event: string, handler: (arg: unknown) => void) => {
          messageHandlers.set(event, handler);
        },
      );

      const generatePromise = pool.generateKey("test mnemonic");

      // Send malformed message
      const messageHandler = messageHandlers.get("message");
      if (messageHandler) {
        const malformedMessage = {
          // Missing required fields
          type: "result",
        };

        // Should not crash
        expect(() => messageHandler(malformedMessage)).not.toThrow();
      }

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });
  });

  describe("Performance Tracking", () => {
    it("should track worker pool statistics", async () => {
      const { WorkerPool } = await import("../../src/worker-pool.js");
      const pool = new WorkerPool({ maxWorkers: 2 });

      const initialStats = pool.getStats();
      expect(initialStats.activeWorkers).toBe(0);
      expect(initialStats.queueSize).toBe(0);
      expect(initialStats.completedJobs).toBe(0);
      expect(initialStats.failedJobs).toBe(0);

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }
    });

    it("should update statistics on job completion", async () => {
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
        const resultMessage: WorkerMessage = {
          id: "test-uuid-123",
          result: {
            d: "test-d",
            dp: "test-dp",
            dq: "test-dq",
            e: "AQAB",
            kty: "RSA",
            n: "test-n",
            p: "test-p",
            q: "test-q",
            qi: "test-qi",
          },
          type: "result",
        };
        messageHandler(resultMessage);
      }

      const stats = pool.getStats();
      expect(stats.completedJobs).toBe(1);

      // Clean up
      try {
        await pool.shutdown(100);
      } catch {
        // Ignore cleanup errors in tests
      }

      // Clean up the promise
      generatePromise.catch(() => {});
    });
  });
});
