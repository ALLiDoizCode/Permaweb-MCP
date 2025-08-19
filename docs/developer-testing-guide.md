# Developer Testing Guide

This guide provides comprehensive testing strategies, patterns, and best practices for developing and testing the Permamind MCP server.

## Table of Contents

- [Overview](#overview)
- [Testing Architecture](#testing-architecture)
- [Environment Setup](#environment-setup)
- [Testing Strategies](#testing-strategies)
- [Test Infrastructure](#test-infrastructure)
- [Tool Category Testing](#tool-category-testing)
- [Mocking Strategies](#mocking-strategies)
- [CI/CD Configuration](#ci-cd-configuration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

### Why MCP Testing is Complex

The Model Context Protocol (MCP) presents unique testing challenges due to its design:

- **Interactive Protocol**: Requires continuous bidirectional communication between client and server
- **Stdio Transport**: Default transport conflicts with CI test runners that also use stdin/stdout
- **Stateful Sessions**: Tool registration and context management happen during protocol handshake
- **Real-time Communication**: Server and client must maintain active connections

### Testing Philosophy

Permamind uses a **multi-layered testing approach**:

1. **Unit Tests**: Individual services and utilities tested in isolation
2. **Integration Tests**: Cross-service functionality without MCP protocol
3. **MCP Client Integration Tests**: Full protocol testing with real client-server communication
4. **End-to-End Tests**: Complete workflow testing through MCP protocol

## Testing Architecture

### Test Directory Structure

```
tests/
├── unit/                           # Individual service/utility tests
│   ├── services/                   # Service layer tests
│   ├── tools/                     # Tool command tests
│   └── utilities/                 # Utility function tests
├── integration/                    # Cross-service functionality tests
│   ├── mcp-client-integration.integration.test.ts    # MCP protocol tests
│   ├── server-test-mode.integration.test.ts          # Transport mode tests
│   └── process-workflow.integration.test.ts          # Process workflow tests
└── helpers/                        # Test utilities and helpers
    └── mcp-client-test-helper.ts   # MCP server startup & client helpers
```

### Transport Mode Testing

Permamind supports three transport modes:

| Transport      | Use Case                       | Testing Approach                   |
| -------------- | ------------------------------ | ---------------------------------- |
| **stdio**      | Production MCP clients         | Not suitable for automated testing |
| **sse**        | Server-Sent Events for testing | Primary testing transport          |
| **httpStream** | HTTP streaming for testing     | Alternative testing transport      |

## Environment Setup

### Required Dependencies

```bash
# Core testing framework
npm install --save-dev vitest @vitest/ui

# MCP client for integration testing
npm install --save-dev @modelcontextprotocol/sdk

# Coverage reporting
npm install --save-dev @vitest/coverage-v8
```

### Environment Variables

```bash
# Required for all tests
NODE_ENV=test                    # Prevents mainnet endpoint usage
SEED_PHRASE="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

# For MCP client integration tests
TEST_TRANSPORT=sse               # Use non-stdio transport
TEST_TRANSPORT_PORT=3001         # Avoid port conflicts
TEST_TRANSPORT_ENDPOINT=/test-mcp # Unique endpoint

# Optional test configuration
DEBUG=true                       # Enable debug logging
MCP_LOG_LEVEL=debug             # Detailed MCP protocol logs
TEST_TIMEOUT=45000              # Extended timeout for MCP tests
```

### Vitest Configuration

Create or update `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "*.config.ts",
        "src/types/",
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    env: {
      NODE_ENV: "test", // Prevent mainnet endpoint usage
    },
    environment: "node",
    globals: true,
    hookTimeout: 45000, // Extended for MCP tests
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Prevents test interference
      },
    },
    testTimeout: 45000, // Extended for MCP tests
  },
});
```

## Testing Strategies

### 1. Unit Testing Individual Services

Test business logic in isolation without MCP protocol overhead:

```typescript
// tests/unit/services/AIMemoryService.unit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIMemoryService } from "../../../src/services/AIMemoryService.js";

// Mock external dependencies
vi.mock("../../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

describe("AIMemoryService", () => {
  let service: AIMemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIMemoryService();
  });

  it("should store memory with valid parameters", async () => {
    const mockMemory = {
      content: "Test memory content",
      memoryType: "knowledge" as const,
      importance: 0.8,
    };

    const result = await service.addEnhanced(
      mockSigner,
      "test-hub-id",
      mockMemory,
    );

    expect(result.success).toBe(true);
    expect(result.memoryId).toBeDefined();
  });
});
```

### 2. Integration Testing Services

Test cross-service interactions:

```typescript
// tests/integration/process-workflow.integration.test.ts
import { describe, it, expect } from "vitest";
import { ProcessCommunicationService } from "../../src/services/ProcessCommunicationService.js";
import { ADPProcessCommunicationService } from "../../src/services/ADPProcessCommunicationService.js";

describe("Process Workflow Integration", () => {
  it("should create process and communicate via ADP", async () => {
    const processService = new ProcessCommunicationService();
    const adpService = new ADPProcessCommunicationService();

    // Test full workflow: spawn → evaluate → communicate
    const processId = await processService.spawnProcess(mockKeyPair);
    const evalResult = await processService.evaluateProcess(processId, luaCode);
    const commResult = await adpService.executeRequest(processId, request);

    expect(processId).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(evalResult.success).toBe(true);
    expect(commResult.success).toBe(true);
  });
});
```

### 3. MCP Client Integration Testing

Test complete MCP protocol communication:

```typescript
// tests/integration/mcp-client-integration.integration.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupMcpTestEnvironment,
  createMcpTestEnvironment,
  listServerTools,
  testToolCall,
  waitForServerReady,
} from "../helpers/mcp-client-test-helper.js";

describe("MCP Client Integration", () => {
  let testContext: McpClientTestContext;

  beforeEach(async () => {
    testContext = await createMcpTestEnvironment({
      endpoint: "/test-mcp",
      port: 3001,
      transport: "sse",
    });
    await waitForServerReady(testContext, 30000);
  }, 45000);

  afterEach(async () => {
    await cleanupMcpTestEnvironment(testContext);
  });

  it("should handle memory tool calls", async () => {
    const result = await testToolCall(
      testContext.client,
      "mcp__permamind__storeMemory",
      {
        content: "Test memory content",
        forceStore: true,
        p: "test-public-key",
        role: "user",
      },
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });
});
```

## Test Infrastructure

### MCP Test Helper Utilities

The `mcp-client-test-helper.ts` provides essential utilities:

#### Server Management

```typescript
// Start server in test mode
const serverProcess = await startTestServer({
  transport: "sse",
  port: 3001,
  endpoint: "/test-mcp",
});

// Create complete test environment
const testContext = await createMcpTestEnvironment({
  transport: "sse",
  port: 3001,
});
```

#### Client Connection

```typescript
// Create MCP client
const context = await createMcpTestClient({
  transport: "sse",
  port: 3001,
});

// Connect with retry logic
await connectMcpClient(context, maxRetries, retryDelay);

// Wait for server readiness
await waitForServerReady(context, timeoutMs);
```

#### Tool Testing

```typescript
// List available tools
const tools = await listServerTools(client);

// Test tool calls with error handling
const result = await testToolCall(client, toolName, arguments);
```

#### Cleanup

```typescript
// Proper cleanup to prevent resource leaks
await cleanupMcpTestEnvironment(testContext);
```

### Test Isolation Patterns

#### Process Isolation

Each MCP integration test spawns a separate server process:

```typescript
beforeEach(async () => {
  // Each test gets fresh server instance
  testContext = await createMcpTestEnvironment({
    port: getUniquePort(), // Dynamic port allocation
    transport: "sse",
  });
});

afterEach(async () => {
  // Cleanup prevents resource leaks
  await cleanupMcpTestEnvironment(testContext);
});
```

#### Port Management

```typescript
// Dynamic port allocation to prevent conflicts
let currentPort = 3001;
function getUniquePort(): number {
  return ++currentPort;
}
```

#### State Isolation

```typescript
// Fresh server state per test
const testConfig = {
  env: {
    NODE_ENV: "test",
    SEED_PHRASE:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    // No shared state between tests
  },
};
```

## Tool Category Testing

### Memory Tools Testing

```typescript
describe("Memory Tools", () => {
  it("should store and retrieve memories", async () => {
    // Store memory
    const storeResult = await testToolCall(
      client,
      "mcp__permamind__storeMemory",
      {
        content: "Important project information",
        memoryType: "knowledge",
        importance: 0.9,
        forceStore: true,
      },
    );

    // Search memories
    const searchResult = await testToolCall(
      client,
      "mcp__permamind__searchMemory",
      {
        search: "project information",
      },
    );

    expect(searchResult).toContain("project information");
  });
});
```

### Process Tools Testing

```typescript
describe("Process Tools", () => {
  it("should spawn and communicate with AO processes", async () => {
    // Spawn process
    const spawnResult = await testToolCall(
      client,
      "mcp__permamind__spawnProcess",
      {},
    );
    const processId = JSON.parse(spawnResult as string).processId;

    // Evaluate Lua code
    const evalResult = await testToolCall(
      client,
      "mcp__permamind__evalProcess",
      {
        processId,
        code: 'Handlers.add("Test", Handlers.utils.hasMatchingTag("Action", "Test"), function(msg) ao.send({Target = msg.From, Data = "Hello"}) end)',
      },
    );

    // Execute action
    const actionResult = await testToolCall(
      client,
      "mcp__permamind__executeAction",
      {
        processId,
        request: "Test",
      },
    );

    expect(actionResult).toBeDefined();
  });
});
```

### Token Tools Testing

```typescript
describe("Token Tools", () => {
  it("should create and interact with tokens", async () => {
    // Create token
    const tokenResult = await testToolCall(
      client,
      "mcp__permamind__createToken",
      {
        name: "TestToken",
        ticker: "TEST",
        initialSupply: "1000000",
      },
    );

    const processId = JSON.parse(tokenResult as string).processId;

    // Get token info
    const infoResult = await testToolCall(
      client,
      "mcp__permamind__getTokenInfo",
      {
        processId,
      },
    );

    expect(infoResult).toContain("TestToken");
  });
});
```

## Mocking Strategies

### External Dependencies

Mock AO and Arweave connections for unit tests:

```typescript
// Mock AO Connect
vi.mock("@permaweb/aoconnect", () => ({
  spawn: vi.fn(),
  message: vi.fn(),
  dryrun: vi.fn(),
  results: vi.fn(),
}));

// Mock Arweave operations
vi.mock("../../../src/relay.js", () => ({
  event: vi.fn().mockResolvedValue("mock-tx-id"),
  fetchEvents: vi.fn().mockResolvedValue([]),
}));
```

### Service Mocking

```typescript
// Mock service dependencies
const mockAIMemoryService = {
  addEnhanced: vi
    .fn()
    .mockResolvedValue({ success: true, memoryId: "test-id" }),
  searchEnhanced: vi.fn().mockResolvedValue({ memories: [], totalCount: 0 }),
};

// Inject mocks into tool factory
const factory = new MemoryToolFactory({
  categoryName: "Memory",
  categoryDescription: "Memory tools",
  context: mockContext,
  memoryService: mockAIMemoryService, // Injected mock
});
```

### Transport Mocking

For unit tests that don't need real MCP protocol:

```typescript
const mockMcpServer = {
  addTool: vi.fn(),
  start: vi.fn(),
  listTools: vi.fn().mockResolvedValue({ tools: [] }),
};
```

## CI/CD Configuration

### GitHub Actions Configuration

```yaml
name: Comprehensive Test Suite
on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main, development]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm test -- tests/unit/
        env:
          NODE_ENV: test
          SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run test:integration
        env:
          NODE_ENV: test
          SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

  mcp-client-tests:
    runs-on: ubuntu-latest
    # Only run on PRs with [mcp] in title for stability
    if: contains(github.event.pull_request.title, '[mcp]')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run test:mcp-client
        env:
          NODE_ENV: test
          TEST_TRANSPORT: sse
          TEST_TRANSPORT_PORT: 3001
          SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run test:coverage
        env:
          NODE_ENV: test
          SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "test:mcp-client": "NODE_ENV=test vitest run tests/integration/mcp-client-integration.integration.test.ts --testTimeout=60000",
    "test:integration": "NODE_ENV=test vitest run tests/integration/ --testTimeout=60000",
    "test:unit": "vitest run tests/unit/",
    "ci:quality": "npm run lint && npm run type-check && npm run build && npm run test:coverage"
  }
}
```

### Cross-Platform Testing

```yaml
cross-platform-tests:
  strategy:
    matrix:
      os: [ubuntu-latest, windows-latest, macos-latest]
      node-version: [18, 20, 22]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm ci
    - run: npm test
      env:
        NODE_ENV: test
        SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

## Troubleshooting

### Common Issues and Solutions

#### Server Won't Start in Tests

**Problem**: Server fails to start or times out during startup.

**Solutions**:

```bash
# Check if port is already in use
lsof -ti:3001
kill -9 $(lsof -ti:3001)

# Verify environment variables
echo $NODE_ENV $TEST_TRANSPORT $TEST_TRANSPORT_PORT

# Enable debug logging
DEBUG=true npm run test:mcp-client

# Check server output directly
npm start &
curl http://localhost:3001/test-mcp
```

#### MCP Client Connection Failures

**Problem**: Client cannot connect to server or handshake fails.

**Solutions**:

```typescript
// Increase startup timeout
const testContext = await createMcpTestEnvironment({
  startupTimeoutMs: 15000, // Increase from default 10s
});

// Add retry logic
await connectMcpClient(context, 5, 2000); // 5 retries, 2s delay

// Verify server readiness before connecting
await waitForServerReady(context, 30000);
```

#### Test Timeouts

**Problem**: Tests fail due to timeouts.

**Solutions**:

```typescript
// Increase test timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds
    hookTimeout: 45000, // 45 seconds for setup/teardown
  },
});

// Or per-test timeout
it("should handle slow operation", async () => {
  // Test implementation
}, 90000); // 90 second timeout
```

#### Resource Leaks and Port Conflicts

**Problem**: Tests fail due to resources not being cleaned up properly.

**Solutions**:

```typescript
// Always use afterEach for cleanup
afterEach(async () => {
  if (testContext) {
    await cleanupMcpTestEnvironment(testContext);
    testContext = undefined;
  }
});

// Use dynamic port allocation
let portCounter = 3000;
const getUniquePort = () => ++portCounter;

// Kill hanging processes
beforeAll(async () => {
  // Kill any hanging servers from previous test runs
  try {
    execSync("pkill -f 'npm start'", { stdio: "ignore" });
  } catch {
    // Process cleanup failed, continue
  }
});
```

#### CI Environment Issues

**Problem**: Tests pass locally but fail in CI.

**Common Causes & Solutions**:

1. **Environment Variables Missing**:

   ```yaml
   env:
     NODE_ENV: test
     SEED_PHRASE: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
   ```

2. **Different Node.js Versions**:

   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version: "20" # Pin to specific version
   ```

3. **Timing Issues**:
   ```typescript
   // Add extra delays in CI
   const isCI = process.env.CI === "true";
   const delay = isCI ? 3000 : 1000;
   await new Promise((resolve) => setTimeout(resolve, delay));
   ```

#### Tool-Specific Testing Issues

**Memory Tools**:

```bash
# Issue: Memory operations fail due to missing context
# Solution: Ensure MEMORY environment variable is set correctly
MEMORY=true npm test
```

**Process Tools**:

```bash
# Issue: AO process operations fail in test environment
# Solution: Use test endpoints and mock external calls
NODE_ENV=test npm test
```

**Token Tools**:

```bash
# Issue: Token operations require real blockchain interaction
# Solution: Mock AO Connect operations for unit tests
```

### Debugging Tips

#### Enable Verbose Logging

```bash
# Debug MCP protocol communication
MCP_LOG_LEVEL=debug npm run test:mcp-client

# Debug server startup
DEBUG=true npm start

# Debug test execution
DEBUG=vitest npm test
```

#### Inspect Server Output

```typescript
// Add server output logging to tests
serverProcess.stdout?.on("data", (data) => {
  console.log("Server:", data.toString());
});

serverProcess.stderr?.on("data", (data) => {
  console.error("Server Error:", data.toString());
});
```

#### Monitor Resource Usage

```bash
# Check for hanging processes
ps aux | grep node

# Monitor port usage
netstat -tlnp | grep :3001

# Check memory usage
top -p $(pgrep node)
```

## Best Practices

### Test Organization

1. **Hierarchical Structure**: Organize tests by feature/service/tool category
2. **Descriptive Names**: Use clear, descriptive test names that explain what's being tested
3. **Logical Grouping**: Group related tests in describe blocks
4. **Consistent Patterns**: Use consistent setup/teardown patterns across test files

### Test Isolation

1. **Independent Tests**: Each test should be able to run independently
2. **Clean State**: Start each test with fresh state
3. **Resource Cleanup**: Always clean up resources in afterEach/afterAll
4. **Avoid Test Dependencies**: Tests shouldn't depend on execution order

### Performance Optimization

1. **Parallel Execution**: Use Vitest's parallel execution capabilities
2. **Selective Testing**: Use test filters for faster development cycles
3. **Mock Heavy Operations**: Mock expensive operations like blockchain calls
4. **Efficient Setup**: Share expensive setup across tests when safe

### Error Handling

1. **Graceful Failures**: Tests should fail gracefully with clear error messages
2. **Timeout Handling**: Set appropriate timeouts for different test types
3. **Retry Logic**: Implement retry logic for flaky operations
4. **Error Context**: Provide sufficient context in error messages

### Maintainability

1. **Helper Functions**: Extract common test logic into helper functions
2. **Configuration**: Use configuration objects for test setup
3. **Documentation**: Document complex test scenarios and edge cases
4. **Regular Updates**: Keep test dependencies and patterns up to date

### CI/CD Integration

1. **Fast Feedback**: Structure CI to provide fast feedback on common issues
2. **Selective Testing**: Use labels/titles to control expensive test execution
3. **Artifact Collection**: Collect relevant artifacts on test failures
4. **Status Reporting**: Provide clear status reporting and coverage metrics

This comprehensive testing guide provides the foundation for reliable, maintainable testing of the Permamind MCP server across all scenarios and environments.
