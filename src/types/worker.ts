import { JWKInterface } from "arweave/node/lib/wallet.js";

/**
 * Options for key generation requests
 */
export interface KeyGenerationOptions {
  nonBlocking?: boolean;
  onProgress?: (
    stage: string,
    percentage: number,
    estimatedTimeMs?: number,
  ) => void;
  priority?: "high" | "low" | "normal";
}

/**
 * Performance tracking data
 */
export interface PerformanceData {
  endTime?: number;
  estimatedTotalMs?: number;
  stage: string;
  startTime: number;
}

/**
 * Queue entry for managing key generation requests
 */
export interface QueueEntry {
  id: string;
  mnemonic: string;
  priority: "high" | "low" | "normal";
  progressCallback?: (
    stage: string,
    percentage: number,
    estimatedTimeMs?: number,
  ) => void;
  reject: (error: Error) => void;
  resolve: (value: JWKInterface) => void;
  timestamp: number;
}

/**
 * Worker message types for communication between main thread and workers
 */
export interface WorkerMessage {
  error?: string;
  id: string;
  mnemonic?: string;
  progress?: {
    estimatedTimeMs?: number;
    percentage: number;
    stage: string;
  };
  result?: JWKInterface;
  type: "error" | "generate" | "progress" | "result" | "shutdown";
}

/**
 * Worker pool configuration options
 */
export interface WorkerPoolConfig {
  enablePreGeneration: boolean;
  maxQueueSize: number;
  maxWorkers: number;
  preGenerationIdleThresholdMs: number;
  workerTimeoutMs: number;
}

/**
 * Worker pool statistics for monitoring
 */
export interface WorkerPoolStats {
  activeWorkers: number;
  averageProcessingTimeMs: number;
  completedJobs: number;
  failedJobs: number;
  queueSize: number;
}
