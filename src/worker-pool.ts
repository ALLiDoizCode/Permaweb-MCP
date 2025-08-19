import { JWKInterface } from "arweave/node/lib/wallet.js";
import * as crypto from "crypto";
import * as path from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

import type {
  KeyGenerationOptions,
  PerformanceData,
  QueueEntry,
  WorkerMessage,
  WorkerPoolConfig,
  WorkerPoolStats,
} from "./types/worker.js";

/**
 * Worker pool for managing multiple worker threads for key generation
 * Provides non-blocking key generation with queue management and error handling
 */
export class WorkerPool {
  private availableWorkers: string[] = [];
  private busyWorkers = new Map<string, string>(); // workerId -> requestId
  private config: WorkerPoolConfig;
  private isShuttingDown = false;
  private lastActivityTime = Date.now();
  private pendingRequests = new Map<string, QueueEntry>();
  private performanceHistory: PerformanceData[] = [];
  private preGenerationTimer?: NodeJS.Timeout;
  private requestQueue: QueueEntry[] = [];
  private shutdownTimeout?: NodeJS.Timeout;
  private stats: WorkerPoolStats;
  private workers = new Map<string, Worker>();

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    this.config = {
      enablePreGeneration: config.enablePreGeneration ?? false,
      maxQueueSize: config.maxQueueSize ?? 50,
      maxWorkers: config.maxWorkers ?? 2,
      preGenerationIdleThresholdMs:
        config.preGenerationIdleThresholdMs ?? 60000,
      workerTimeoutMs: config.workerTimeoutMs ?? 30000,
    };

    this.stats = {
      activeWorkers: 0,
      averageProcessingTimeMs: 0,
      completedJobs: 0,
      failedJobs: 0,
      queueSize: 0,
    };

    this.setupProcessExitHandlers();
    this.startIdleDetection();
  }

  /**
   * Generate key from mnemonic using worker thread
   */
  async generateKey(
    mnemonic: string,
    options: KeyGenerationOptions = {},
  ): Promise<JWKInterface> {
    if (this.isShuttingDown) {
      throw new Error("Worker pool is shutting down");
    }

    this.lastActivityTime = Date.now();

    // Check for duplicate requests
    const mnemonicHash = this.getMnemonicHash(mnemonic);
    const existingRequest = Array.from(this.pendingRequests.values()).find(
      (entry) => this.getMnemonicHash(entry.mnemonic) === mnemonicHash,
    );

    if (existingRequest) {
      // Return promise that resolves when existing request completes
      return new Promise((resolve, reject) => {
        const originalResolve = existingRequest.resolve;
        const originalReject = existingRequest.reject;

        existingRequest.resolve = (value: JWKInterface) => {
          originalResolve(value);
          resolve(value);
        };

        existingRequest.reject = (error: Error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const priority = options.priority ?? "normal";

      const queueEntry: QueueEntry = {
        id: requestId,
        mnemonic,
        priority,
        progressCallback: options.onProgress,
        reject,
        resolve,
        timestamp: Date.now(),
      };

      // Check queue size limit
      if (this.requestQueue.length >= this.config.maxQueueSize) {
        reject(new Error("Request queue is full"));
        return;
      }

      // Add to queue with priority ordering
      this.addToQueue(queueEntry);
      this.processQueue();
    });
  }

  /**
   * Get current worker pool statistics
   */
  getStats(): WorkerPoolStats {
    this.stats.activeWorkers = this.workers.size;
    this.stats.queueSize = this.requestQueue.length;

    if (this.performanceHistory.length > 0) {
      const completedTasks = this.performanceHistory.filter((p) => p.endTime);
      if (completedTasks.length > 0) {
        const totalTime = completedTasks.reduce(
          (sum, p) => sum + (p.endTime! - p.startTime),
          0,
        );
        this.stats.averageProcessingTimeMs = totalTime / completedTasks.length;
      }
    }

    return { ...this.stats };
  }

  /**
   * Shutdown worker pool gracefully
   */
  async shutdown(timeoutMs: number = 5000): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Stop idle detection and pre-generation
    if (this.preGenerationTimer) {
      clearTimeout(this.preGenerationTimer);
    }

    // Reject all queued requests
    for (const entry of this.requestQueue) {
      entry.reject(new Error("Worker pool shutting down"));
    }
    this.requestQueue = [];

    // Set shutdown timeout
    this.shutdownTimeout = setTimeout(() => {
      // Force terminate all workers
      for (const worker of this.workers.values()) {
        worker.terminate();
      }
    }, timeoutMs);

    // Send shutdown signal to all workers
    const shutdownPromises: Promise<void>[] = [];
    for (const [workerId, worker] of this.workers) {
      shutdownPromises.push(this.shutdownWorker(workerId, worker));
    }

    try {
      await Promise.allSettled(shutdownPromises);
    } finally {
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }
      this.workers.clear();
      this.availableWorkers = [];
      this.busyWorkers.clear();
    }
  }

  /**
   * Add request to priority queue
   */
  private addToQueue(entry: QueueEntry): void {
    const priorityOrder = { high: 0, low: 2, normal: 1 };

    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const existingPriority = priorityOrder[this.requestQueue[i].priority];
      const newPriority = priorityOrder[entry.priority];

      if (newPriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, entry);
  }

  /**
   * Create new worker thread
   */
  private async createWorker(): Promise<string> {
    const workerId = crypto.randomUUID();

    // Get current directory for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Determine correct worker path based on environment
    let workerPath: string;
    try {
      // Try compiled .js version first (production/build environment)
      workerPath = path.join(__dirname, "mnemonic-worker.js");
      await import("fs/promises").then((fs) => fs.access(workerPath));
    } catch {
      // Fall back to .ts version for development with tsx/ts-node
      workerPath = path.join(__dirname, "mnemonic-worker.ts");
    }

    const worker = new Worker(workerPath);

    worker.on("message", (message: WorkerMessage) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on("error", (error) => {
      this.handleWorkerError(workerId, error);
    });

    worker.on("exit", (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workers.set(workerId, worker);
    this.availableWorkers.push(workerId);

    return workerId;
  }

  /**
   * Generate hash from mnemonic for deduplication
   */
  private getMnemonicHash(mnemonic: string): string {
    return crypto.createHash("sha256").update(mnemonic.trim()).digest("hex");
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerId: string, error: Error): void {
    const requestId = this.busyWorkers.get(workerId);
    const request = requestId ? this.pendingRequests.get(requestId) : undefined;

    if (request) {
      this.pendingRequests.delete(request.id);
      this.busyWorkers.delete(workerId);
      this.stats.failedJobs++;
      request.reject(new Error(`Worker error: ${error.message}`));
    }

    // Remove failed worker
    this.workers.delete(workerId);
    const index = this.availableWorkers.indexOf(workerId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    if (code !== 0 && !this.isShuttingDown) {
      console.error(`Worker ${workerId} exited with code ${code}`);
    }

    this.workers.delete(workerId);
    const index = this.availableWorkers.indexOf(workerId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
    this.busyWorkers.delete(workerId);
  }

  /**
   * Handle messages from worker threads
   */
  private handleWorkerMessage(workerId: string, message: WorkerMessage): void {
    const requestId = this.busyWorkers.get(workerId);
    const request = requestId ? this.pendingRequests.get(requestId) : undefined;

    switch (message.type) {
      case "error":
        if (request) {
          this.pendingRequests.delete(request.id);
          this.busyWorkers.delete(workerId);
          this.availableWorkers.push(workerId);

          this.stats.failedJobs++;
          this.recordPerformanceData(request.id, "failed");

          request.reject(new Error(message.error || "Worker error"));
          this.processQueue();
        }
        break;

      case "progress":
        if (request?.progressCallback && message.progress) {
          request.progressCallback(
            message.progress.stage,
            message.progress.percentage,
            message.progress.estimatedTimeMs,
          );
        }
        break;

      case "result":
        if (request && message.result) {
          this.pendingRequests.delete(request.id);
          this.busyWorkers.delete(workerId);
          this.availableWorkers.push(workerId);

          this.stats.completedJobs++;
          this.recordPerformanceData(request.id, "completed");

          request.resolve(message.result);
          this.processQueue();
        }
        break;
    }
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isShuttingDown || this.requestQueue.length === 0) {
      return;
    }

    // Create workers if needed and available
    const workersNeeded = Math.min(
      this.requestQueue.length,
      this.config.maxWorkers - this.workers.size,
    );

    for (let i = 0; i < workersNeeded; i++) {
      try {
        await this.createWorker();
      } catch (error) {
        console.error("Failed to create worker:", error);
        break;
      }
    }

    // Assign work to available workers
    while (this.requestQueue.length > 0 && this.availableWorkers.length > 0) {
      const request = this.requestQueue.shift()!;
      const workerId = this.availableWorkers.shift()!;
      const worker = this.workers.get(workerId);

      if (!worker) {
        // Worker no longer exists, requeue request
        this.requestQueue.unshift(request);
        continue;
      }

      this.pendingRequests.set(request.id, request);
      this.busyWorkers.set(workerId, request.id);
      this.recordPerformanceData(request.id, "started");

      const message: WorkerMessage = {
        id: request.id,
        mnemonic: request.mnemonic,
        type: "generate",
      };

      worker.postMessage(message);

      // Set timeout for this request
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          this.busyWorkers.delete(workerId);
          this.availableWorkers.push(workerId);
          this.stats.failedJobs++;
          request.reject(new Error("Worker timeout"));
        }
      }, this.config.workerTimeoutMs);
    }
  }

  /**
   * Record performance data for analytics
   */
  private recordPerformanceData(requestId: string, stage: string): void {
    const existing = this.performanceHistory.find((p) => p.stage === requestId);

    if (stage === "started") {
      this.performanceHistory.push({
        stage: requestId,
        startTime: Date.now(),
      });
    } else if (existing) {
      existing.endTime = Date.now();
    }

    // Keep only recent history (last 100 entries)
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }

  /**
   * Setup process exit handlers for graceful shutdown
   */
  private setupProcessExitHandlers(): void {
    const gracefulShutdown = () => {
      this.shutdown(5000).catch(console.error);
    };

    // Only add listeners if not already added (prevent memory leak in tests)
    if (!this.isShuttingDown) {
      process.once("SIGINT", gracefulShutdown);
      process.once("SIGTERM", gracefulShutdown);
      process.once("exit", gracefulShutdown);
    }
  }

  /**
   * Shutdown individual worker
   */
  private async shutdownWorker(
    workerId: string,
    worker: Worker,
  ): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        resolve();
      }, 2000);

      worker.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      const shutdownMessage: WorkerMessage = {
        id: "shutdown",
        type: "shutdown",
      };

      worker.postMessage(shutdownMessage);
    });
  }

  /**
   * Start idle detection for background pre-generation
   */
  private startIdleDetection(): void {
    if (!this.config.enablePreGeneration) {
      return;
    }

    const checkIdle = () => {
      const idleTime = Date.now() - this.lastActivityTime;

      if (
        idleTime > this.config.preGenerationIdleThresholdMs &&
        this.requestQueue.length === 0 &&
        this.busyWorkers.size === 0
      ) {
        // System is idle - could implement pre-generation here
        // Detected idle state - ready for background pre-generation
      }

      this.preGenerationTimer = setTimeout(checkIdle, 10000);
    };

    checkIdle();
  }
}

// Global worker pool instance
let globalWorkerPool: undefined | WorkerPool;

/**
 * Get or create global worker pool instance
 */
export function getWorkerPool(config?: Partial<WorkerPoolConfig>): WorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WorkerPool(config);
  }
  return globalWorkerPool;
}

/**
 * Shutdown global worker pool
 */
export async function shutdownWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.shutdown();
    globalWorkerPool = undefined;
  }
}
