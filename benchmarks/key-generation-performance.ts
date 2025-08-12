#!/usr/bin/env tsx
import { mnemonicToSeed } from "bip39-web-crypto";
import { performance } from "perf_hooks";
import * as process from "process";

import type { BenchmarkResults } from "../src/types/custom-crypto.js";

import { SeedBasedKeyGeneratorImpl } from "../src/custom-key-generation.js";
import { getKeyFromMnemonic } from "../src/mnemonic.js";

/**
 * Comprehensive performance benchmarking suite for key generation
 *
 * Compares custom implementation against human-crypto-keys baseline
 * and provides detailed performance analysis across different scenarios.
 */
class KeyGenerationBenchmark {
  private customGenerator: SeedBasedKeyGeneratorImpl;

  constructor() {
    this.customGenerator = new SeedBasedKeyGeneratorImpl();
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runFullBenchmark(): Promise<void> {
    console.log(
      "🚀 Starting Comprehensive Key Generation Performance Benchmark",
    );
    console.log("=".repeat(80));

    try {
      // Basic performance comparison
      await this.runBasicPerformanceComparison();

      // Memory usage analysis
      await this.runMemoryUsageAnalysis();

      // Concurrent performance testing
      await this.runConcurrentPerformanceTest();

      // Different seed size testing
      await this.runSeedSizeAnalysis();

      console.log("\n✅ Benchmark suite completed successfully");
    } catch (error) {
      console.error("❌ Benchmark failed:", error);
      process.exit(1);
    }
  }

  /**
   * Benchmark a specific implementation
   */
  private async benchmarkImplementation(
    mnemonic: string,
    iterations: number,
    type: "custom" | "existing",
  ): Promise<BenchmarkResults> {
    const times: number[] = [];
    const memoryBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      if (type === "custom") {
        const seed = await mnemonicToSeed(`${mnemonic} ${i}`);
        await this.customGenerator.generateFromSeed(seed);
      } else {
        // Use unique mnemonic to avoid cache hits
        await getKeyFromMnemonic(`${mnemonic} ${i}`, { nonBlocking: false });
      }

      const end = performance.now();
      times.push(end - start);
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryUsageMB = (memoryAfter - memoryBefore) / 1024 / 1024;

    const sortedTimes = [...times].sort((a, b) => a - b);

    return {
      averageTimeMs: times.reduce((a, b) => a + b) / times.length,
      implementation: type,
      maxTimeMs: Math.max(...times),
      medianTimeMs: sortedTimes[Math.floor(sortedTimes.length / 2)],
      memoryUsageMB,
      minTimeMs: Math.min(...times),
      samples: iterations,
    };
  }

  /**
   * Display comparison results in a formatted table
   */
  private displayComparisonResults(
    custom: BenchmarkResults,
    existing: BenchmarkResults,
  ): void {
    console.log("\nResults Summary:");
    console.log(
      "Implementation    | Avg Time | Min Time | Max Time | Memory | Samples",
    );
    console.log(
      "------------------|----------|----------|----------|--------|--------",
    );

    console.log(
      `${"Custom".padEnd(16)} | ${custom.averageTimeMs.toFixed(1).padStart(8)}ms | ` +
        `${custom.minTimeMs.toFixed(1).padStart(8)}ms | ${custom.maxTimeMs.toFixed(1).padStart(8)}ms | ` +
        `${custom.memoryUsageMB.toFixed(1).padStart(6)}MB | ${custom.samples.toString().padStart(7)}`,
    );

    console.log(
      `${"Human-crypto-keys".padEnd(16)} | ${existing.averageTimeMs.toFixed(1).padStart(8)}ms | ` +
        `${existing.minTimeMs.toFixed(1).padStart(8)}ms | ${existing.maxTimeMs.toFixed(1).padStart(8)}ms | ` +
        `${existing.memoryUsageMB.toFixed(1).padStart(6)}MB | ${existing.samples.toString().padStart(7)}`,
    );

    const improvement = existing.averageTimeMs / custom.averageTimeMs;
    const memoryImprovement = existing.memoryUsageMB / custom.memoryUsageMB;

    console.log(
      `\n📈 Performance Improvement: ${improvement.toFixed(2)}x faster`,
    );
    console.log(
      `🧠 Memory Efficiency: ${memoryImprovement.toFixed(2)}x more efficient`,
    );

    if (improvement > 1) {
      console.log("✅ Custom implementation shows performance improvement!");
    } else {
      console.log("ℹ️  Custom implementation is slower (proof-of-concept)");
    }
  }

  /**
   * Format byte count for display
   */
  private formatBytes(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";

    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Compare basic performance metrics between implementations
   */
  private async runBasicPerformanceComparison(): Promise<void> {
    console.log("\n📊 Basic Performance Comparison");
    console.log("-".repeat(50));

    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const iterations = 10;

    // Benchmark custom implementation
    console.log("Benchmarking custom implementation...");
    const customResults = await this.benchmarkImplementation(
      testMnemonic,
      iterations,
      "custom",
    );

    // Benchmark existing implementation (with timeout protection)
    console.log("Benchmarking existing implementation...");
    const existingResults = await this.benchmarkImplementation(
      testMnemonic,
      Math.min(iterations, 3), // Reduce iterations for slow implementation
      "existing",
    );

    // Display results
    this.displayComparisonResults(customResults, existingResults);
  }

  /**
   * Test concurrent key generation performance
   */
  private async runConcurrentPerformanceTest(): Promise<void> {
    console.log("\n⚡ Concurrent Performance Test");
    console.log("-".repeat(50));

    const baseMemonic = "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong";
    const concurrencyLevels = [1, 2, 4, 8];

    for (const concurrency of concurrencyLevels) {
      const start = performance.now();

      const promises = Array(concurrency)
        .fill(0)
        .map(async (_, i) => {
          const seed = await mnemonicToSeed(`${baseMemonic} ${i}`);
          return this.customGenerator.generateFromSeed(seed);
        });

      await Promise.all(promises);
      const end = performance.now();

      const totalTime = end - start;
      const avgTimePerKey = totalTime / concurrency;

      console.log(
        `  Concurrency ${concurrency}: ${totalTime.toFixed(2)}ms total, ${avgTimePerKey.toFixed(2)}ms avg/key`,
      );
    }
  }

  /**
   * Analyze memory usage patterns during key generation
   */
  private async runMemoryUsageAnalysis(): Promise<void> {
    console.log("\n🧠 Memory Usage Analysis");
    console.log("-".repeat(50));

    const testMnemonic =
      "legal winner thank year wave sausage worth useful legal winner thank yellow";
    const iterations = 20;

    // Custom implementation memory analysis
    const customMemoryBefore = process.memoryUsage();
    for (let i = 0; i < iterations; i++) {
      const seed = await mnemonicToSeed(`${testMnemonic} ${i}`);
      await this.customGenerator.generateFromSeed(seed);
    }
    const customMemoryAfter = process.memoryUsage();

    const customMemoryDiff = {
      external: customMemoryAfter.external - customMemoryBefore.external,
      heapTotal: customMemoryAfter.heapTotal - customMemoryBefore.heapTotal,
      heapUsed: customMemoryAfter.heapUsed - customMemoryBefore.heapUsed,
    };

    console.log(
      `Custom Implementation Memory Usage (${iterations} generations):`,
    );
    console.log(`  Heap Used: ${this.formatBytes(customMemoryDiff.heapUsed)}`);
    console.log(
      `  Heap Total: ${this.formatBytes(customMemoryDiff.heapTotal)}`,
    );
    console.log(`  External: ${this.formatBytes(customMemoryDiff.external)}`);
    console.log(
      `  Per Key: ${this.formatBytes(customMemoryDiff.heapUsed / iterations)}`,
    );

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log("  (Forced garbage collection completed)");
    }
  }

  /**
   * Analyze performance with different seed sizes
   */
  private async runSeedSizeAnalysis(): Promise<void> {
    console.log("\n📏 Seed Size Analysis");
    console.log("-".repeat(50));

    const seedSizes = [32, 64, 128, 256, 512]; // bytes
    const iterations = 5;

    for (const size of seedSizes) {
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Create deterministic seed of specified size
        const seed = Buffer.alloc(size);
        for (let j = 0; j < size; j++) {
          seed[j] = (i * 256 + j) % 256;
        }

        const start = performance.now();
        await this.customGenerator.generateFromSeed(seed);
        const end = performance.now();

        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(
        `  ${size.toString().padStart(3)} bytes: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`,
      );
    }
  }
}

/**
 * Main benchmark execution
 */
async function main(): Promise<void> {
  // Check if we're running in a performance-appropriate environment
  if (process.env.NODE_ENV === "test") {
    console.log(
      "⚠️  Running in test environment - results may not be representative",
    );
  }

  const benchmark = new KeyGenerationBenchmark();
  await benchmark.runFullBenchmark();
}

// Execute if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
