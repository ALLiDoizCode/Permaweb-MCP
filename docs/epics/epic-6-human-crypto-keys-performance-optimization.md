# Epic 6: Human Crypto Keys Performance Optimization - Brownfield Enhancement

## Epic Goal

Optimize the `getKeyPairFromSeed` function performance in the Permamind project by implementing caching, alternative implementations, and architectural improvements to reduce 4096-bit RSA key generation latency by 75%+ while maintaining mandatory security requirements.

## Epic Description

**Existing System Context:**

- Current functionality: Arweave wallet key generation using `human-crypto-keys@0.1.4` with 4096-bit RSA keys
- Technology stack: TypeScript + Node.js 20+ + human-crypto-keys + bip39-web-crypto + Web Crypto API
- Integration points: `src/mnemonic.ts:20` - `getKeyFromMnemonic()` function, AO process creation, wallet operations
- Current performance: 2-30 seconds per key generation (Node-Forge bottleneck with custom PRNG)

**Enhancement Details:**

- What's being added/changed: Multi-layered performance optimization including memory/disk caching, worker thread implementation, pre-generation strategies, and custom implementation exploration
- How it integrates: Maintains existing `JWKInterface` compatibility, preserves cryptographic security standards, extends current `mnemonic.ts` module
- Success criteria: <500ms effective generation time from current 2-30 seconds, zero API breaking changes, maintained security compliance

## Performance Analysis Summary

### Root Cause Identified

- **Primary Bottleneck**: Node-Forge RSA generation with custom PRNG disables native OpenSSL APIs
- **Secondary Issues**: 4096-bit keys vs 2048-bit (4x slower), pure JavaScript implementation, variable generation times (978ms to 33,167ms)
- **Bundle Impact**: Large dependency footprint from cryptographic modules

### Optimization Targets

- **Target Performance**: <500ms generation time (75% improvement minimum)
- **Security Constraint**: 4096-bit RSA is mandatory (non-negotiable)
- **Compatibility**: Zero breaking changes to existing API surface

## Stories

### Story 6.1: Implement Memory and Disk Caching System

**User Story:** As a Permamind user, I want key generation to be instant for previously used mnemonics so that I don't wait for the same computation repeatedly.

**Acceptance Criteria:**

- Implement secure memory cache for generated keys using mnemonic hash as key
- Create persistent disk cache in `.permamind/keys/` directory with proper file permissions
- Add cache validation and corruption recovery mechanisms
- Implement cache expiration policies and cleanup routines
- Ensure secure memory handling prevents key exposure in memory dumps
- Maintain existing `getKeyFromMnemonic()` function signature with transparent caching
- Add cache statistics and monitoring for performance metrics

**Technical Implementation:**

```typescript
// Enhanced caching in mnemonic.ts
const keyCache = new Map<string, JWKInterface>();
const CACHE_DIR = join(process.cwd(), ".permamind", "keys");

async function getKeyFromMnemonicCached(
  mnemonic: string,
): Promise<JWKInterface> {
  const mnemonicHash = createHash("sha256").update(mnemonic).digest("hex");

  // Memory cache check
  if (keyCache.has(mnemonicHash)) {
    return keyCache.get(mnemonicHash)!;
  }

  // Disk cache check
  const cacheFile = join(CACHE_DIR, `${mnemonicHash}.json`);
  if (existsSync(cacheFile)) {
    const cachedKey = JSON.parse(readFileSync(cacheFile, "utf8"));
    keyCache.set(mnemonicHash, cachedKey);
    return cachedKey;
  }

  // Generate and cache
  const jwk = await generateKeyFromSeed(mnemonic);
  keyCache.set(mnemonicHash, jwk);
  writeFileSync(cacheFile, JSON.stringify(jwk));
  return jwk;
}
```

### Story 6.2: Implement Worker Thread Architecture

**User Story:** As a Permamind user, I want the system to remain responsive during key generation so that other operations are not blocked by cryptographic computation.

**Acceptance Criteria:**

- Create dedicated worker thread for CPU-intensive key generation
- Implement non-blocking key generation with progress callbacks
- Add queue management for multiple concurrent key generation requests
- Provide user feedback during generation process with time estimates
- Maintain error handling and recovery in worker thread context
- Support graceful shutdown and worker thread cleanup
- Enable background pre-generation during system idle time

**Technical Implementation:**

```typescript
// mnemonic-worker.ts
import { parentPort, workerData } from "worker_threads";

async function generateKeyInWorker() {
  const { mnemonic } = workerData;
  // Original generation logic here
  const key = await generateKeyFromSeed(mnemonic);
  parentPort?.postMessage({ success: true, key });
}

// Enhanced mnemonic.ts with worker support
export async function getKeyFromMnemonicNonBlocking(
  mnemonic: string,
  onProgress?: (stage: string) => void,
): Promise<JWKInterface> {
  onProgress?.("Generating 4096-bit RSA key (10-30 seconds)...");

  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, "mnemonic-worker.js"), {
      workerData: { mnemonic },
    });

    worker.on("message", (result) => {
      if (result.success) {
        onProgress?.("Key generation complete");
        resolve(result.key);
      } else {
        reject(new Error(result.error));
      }
    });
  });
}
```

### Story 6.3: Explore Custom Implementation Alternatives

**User Story:** As a Permamind developer, I want to evaluate custom key generation implementations so that we can achieve optimal performance while maintaining security requirements.

**Acceptance Criteria:**

- Research and prototype custom deterministic RSA key generation using Node.js native crypto
- Implement proof-of-concept using direct OpenSSL bindings via Node.js crypto.generateKeyPair()
- Create deterministic PRNG implementation for seed-based generation
- Conduct comprehensive testing against existing human-crypto-keys output for compatibility
- Perform security analysis of custom implementation approach
- Benchmark performance improvements vs current implementation
- Document risks, benefits, and migration strategy for custom solution

**Technical Exploration:**

```typescript
// custom-key-generation.ts (Proof of Concept)
export class SeedBasedKeyGenerator {
  private static createDeterministicPRNG(seed: Buffer) {
    let counter = 0;
    return {
      getRandomBytes: (length: number): Buffer => {
        const hash = createHash("sha256");
        hash.update(seed);
        hash.update(Buffer.from(counter.toString()));
        counter++;

        let result = Buffer.alloc(0);
        while (result.length < length) {
          const chunk = hash.digest();
          result = Buffer.concat([result, chunk]);
          hash.update(chunk);
        }
        return result.slice(0, length);
      },
    };
  }

  static async generateFromSeed(seed: Buffer): Promise<JWKInterface> {
    // Custom implementation using Node.js native crypto
    // with deterministic PRNG override
  }
}
```

## Definition of Done

- [ ] Memory and disk caching system implemented with secure key handling
- [ ] Worker thread architecture prevents main thread blocking during generation
- [ ] Cache hit ratio >95% for repeated mnemonic usage scenarios
- [ ] Effective generation time <500ms for cached keys (instant response)
- [ ] First-time generation remains secure with progress feedback
- [ ] Custom implementation proof-of-concept completed with security analysis
- [ ] Performance benchmarking confirms 75%+ improvement in user-perceived latency
- [ ] Zero breaking changes to existing `getKeyFromMnemonic()` API
- [ ] All existing test coverage maintained with additional performance tests
- [ ] Security audit confirms no degradation in cryptographic security
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [ ] Documentation updated with performance characteristics and caching behavior

## Risk Mitigation

### Primary Risk: Security Compromise Through Caching

- **Mitigation**: Secure file permissions, encrypted cache files, memory protection
- **Validation**: Security audit of cache implementation, key exposure testing

### Secondary Risk: Cache Corruption or Poisoning

- **Mitigation**: Checksum validation, corruption detection, automatic recovery
- **Fallback**: Graceful degradation to original implementation

### Tertiary Risk: Worker Thread Complexity

- **Mitigation**: Comprehensive error handling, graceful shutdown, resource cleanup
- **Testing**: Load testing, memory leak detection, concurrent operation validation

## Success Metrics

- **Performance**: Cached key access <100ms, first-generation <15 seconds average
- **User Experience**: Progress feedback, non-blocking operations, instant subsequent access
- **Reliability**: 99.9% cache hit reliability, zero security regressions
- **Compatibility**: 100% existing API compatibility, seamless migration

---

_This epic addresses critical performance bottlenecks while maintaining the project's security-first approach and ensuring zero disruption to existing functionality._
