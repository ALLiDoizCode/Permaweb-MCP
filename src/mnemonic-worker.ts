import { JWKInterface } from "arweave/node/lib/wallet.js";
import { mnemonicToSeed } from "bip39-web-crypto";
import * as crypto from "crypto";
import { getKeyPairFromSeed } from "human-crypto-keys";
import { parentPort } from "worker_threads";

import type { WorkerMessage } from "./types/worker.js";

/**
 * Worker thread for CPU-intensive key generation
 * This isolates key generation from the main thread to prevent blocking
 */

let isShuttingDown = false;

/**
 * Generate JWK from mnemonic with progress reporting
 */
async function generateKeyInWorker(
  mnemonic: string,
  messageId: string,
): Promise<void> {
  try {
    if (isShuttingDown) {
      throw new Error("Worker is shutting down");
    }

    // Stage 1: Initialization
    sendProgress(messageId, "initialization", 0, 4000);

    if (isShuttingDown) return;

    // Stage 2: Seed generation (25% complete, estimated 1000ms)
    sendProgress(messageId, "seed_generation", 25, 3000);
    const seedBuffer = await mnemonicToSeed(mnemonic);

    if (isShuttingDown) return;

    // Stage 3: Key pair generation (50% complete, estimated 2000ms)
    sendProgress(messageId, "key_generation", 50, 2000);
    const { privateKey } = await getKeyPairFromSeed(
      // @ts-expect-error: seedBuffer type mismatch with library expectations
      seedBuffer,
      {
        id: "rsa",
        modulusLength: 4096,
      },
      { privateKeyFormat: "pkcs8-der" },
    );

    if (isShuttingDown) return;

    // Stage 4: JWK conversion (75% complete, estimated 500ms)
    sendProgress(messageId, "jwk_conversion", 75, 500);
    const jwk = await pkcs8ToJwk(privateKey as unknown as Uint8Array);

    if (isShuttingDown) return;

    // Stage 5: Completion (100% complete)
    sendProgress(messageId, "complete", 100, 0);

    // Send result
    const resultMessage: WorkerMessage = {
      id: messageId,
      result: jwk,
      type: "result",
    };

    parentPort?.postMessage(resultMessage);
  } catch (error) {
    const errorMessage: WorkerMessage = {
      error: error instanceof Error ? error.message : "Unknown error in worker",
      id: messageId,
      type: "error",
    };

    parentPort?.postMessage(errorMessage);
  }
}

/**
 * Handle graceful shutdown
 */
function handleWorkerShutdown(): void {
  isShuttingDown = true;

  // Allow current operations to complete gracefully
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

/**
 * Convert PKCS8 private key to JWK format
 */
async function pkcs8ToJwk(privateKey: Uint8Array): Promise<JWKInterface> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKey,
    { hash: "SHA-256", name: "RSA-PSS" },
    true,
    ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);

  return {
    d: jwk.d,
    dp: jwk.dp,
    dq: jwk.dq,
    e: jwk.e!,
    kty: jwk.kty!,
    n: jwk.n!,
    p: jwk.p,
    q: jwk.q,
    qi: jwk.qi,
  };
}

/**
 * Send progress update to main thread
 */
function sendProgress(
  messageId: string,
  stage: string,
  percentage: number,
  estimatedTimeMs: number,
): void {
  if (isShuttingDown) return;

  const progressMessage: WorkerMessage = {
    id: messageId,
    progress: {
      estimatedTimeMs,
      percentage,
      stage,
    },
    type: "progress",
  };

  parentPort?.postMessage(progressMessage);
}

/**
 * Setup worker message handling
 */
if (parentPort) {
  parentPort.on("message", (message: WorkerMessage) => {
    switch (message.type) {
      case "generate":
        if (message.mnemonic) {
          generateKeyInWorker(message.mnemonic, message.id);
        } else {
          const errorMessage: WorkerMessage = {
            error: "Missing mnemonic in generate message",
            id: message.id,
            type: "error",
          };
          parentPort?.postMessage(errorMessage);
        }
        break;

      case "shutdown":
        handleWorkerShutdown();
        break;

      default: {
        const errorMessage: WorkerMessage = {
          error: `Unknown message type: ${message.type}`,
          id: message.id,
          type: "error",
        };
        parentPort?.postMessage(errorMessage);
      }
    }
  });
}

// Handle worker thread errors
process.on("uncaughtException", (error) => {
  const errorMessage: WorkerMessage = {
    error: `Uncaught exception in worker: ${error.message}`,
    id: "uncaught",
    type: "error",
  };

  parentPort?.postMessage(errorMessage);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const errorMessage: WorkerMessage = {
    error: `Unhandled rejection in worker: ${reason}`,
    id: "unhandled",
    type: "error",
  };

  parentPort?.postMessage(errorMessage);
  process.exit(1);
});
