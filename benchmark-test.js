import { performance } from "perf_hooks";
import { getKeyFromMnemonic } from "./dist/mnemonic.js";

async function benchmarkKeyGeneration() {
  try {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    console.log("🚀 Starting key generation performance benchmark...\n");

    // Test 1: First generation (no cache)
    console.log("Test 1: First generation (cache miss)");
    const start1 = performance.now();
    const key1 = await getKeyFromMnemonic(testMnemonic, { nonBlocking: false });
    const end1 = performance.now();
    const time1 = end1 - start1;
    console.log(`  ✅ Generated in ${time1.toFixed(2)}ms`);
    console.log(
      `  📊 Key type: ${key1.kty}, length: ${key1.n?.length || 0} chars\n`,
    );

    // Test 2: Second generation (should hit cache)
    console.log("Test 2: Second generation (cache hit)");
    const start2 = performance.now();
    const key2 = await getKeyFromMnemonic(testMnemonic, { nonBlocking: false });
    const end2 = performance.now();
    const time2 = end2 - start2;
    console.log(`  ⚡ Retrieved in ${time2.toFixed(2)}ms`);
    console.log(`  📊 Cache speedup: ${(time1 / time2).toFixed(1)}x faster\n`);

    // Test 3: Worker thread test (if available)
    console.log("Test 3: Worker thread generation (if available)");
    try {
      const start3 = performance.now();
      const key3 = await getKeyFromMnemonic(testMnemonic + " worker", {
        nonBlocking: true,
      });
      const end3 = performance.now();
      const time3 = end3 - start3;
      console.log(`  🔄 Worker generated in ${time3.toFixed(2)}ms`);
      console.log(
        `  📊 Worker vs sync ratio: ${(time3 / time1).toFixed(2)}x\n`,
      );
    } catch (error) {
      console.log(`  ❌ Worker thread failed: ${error.message}\n`);
    }

    // Test 4: Multiple different mnemonics timing
    console.log("Test 4: Multiple unique keys (no cache benefit)");
    const start4 = performance.now();
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        getKeyFromMnemonic(`test mnemonic number ${i}`, { nonBlocking: false }),
      );
    }
    await Promise.all(promises);
    const end4 = performance.now();
    const time4 = end4 - start4;
    console.log(`  🔄 Generated 3 keys in ${time4.toFixed(2)}ms`);
    console.log(`  📊 Average per key: ${(time4 / 3).toFixed(2)}ms\n`);

    console.log("📈 Summary:");
    console.log(`  • First generation: ${time1.toFixed(0)}ms`);
    console.log(
      `  • Cached retrieval: ${time2.toFixed(0)}ms (${(time1 / time2).toFixed(1)}x speedup)`,
    );
    console.log(`  • Average new key: ${(time4 / 3).toFixed(0)}ms`);
    console.log(
      `  • Cache hit rate would significantly improve perceived performance`,
    );
  } catch (error) {
    console.error("❌ Benchmark failed:", error.message);
    console.error('Make sure to run "npm run build" first');
  }
}

benchmarkKeyGeneration().catch(console.error);
