# Permaweb MCP - Project Context for Claude Code

## Project Overview

Permaweb MCP is an MCP (Model Context Protocol) server that provides an immortal memory layer for AI agents and clients. It leverages Arweave's permanent storage and the AO (Autonomous Objects) ecosystem to create persistent, decentralized AI memory.

## Architecture

### Core Technologies

- **TypeScript** - Primary language with strict type checking
- **FastMCP** - TypeScript MCP server framework
- **AO Connect** - Interface to AO ecosystem (@permaweb/aoconnect)
- **Arweave** - Permanent data storage
- **Vitest** - Testing framework with comprehensive coverage
- **Node.js 20+** - Runtime environment

### Key Directories

````
src/
├── services/          # Core business logic services (12 services)
├── models/           # Data models and TypeScript interfaces
├── tools/            # MCP tool implementations (16 tools)
│   ├── arns/         # ArNS domain management (6 tools)
│   ├── arweave/      # Arweave deployment (4 tools)
│   ├── core/         # Shared helpers and base classes
│   ├── process/      # AO process operations (4 tools)
│   └── user/         # Wallet operations (2 tools)
├── types/            # Type definitions
├── constants.ts      # Configuration constants
├── process.ts        # AO process creation and messaging
├── relay.ts          # Arweave data relay functions
└── server.ts         # Main MCP server implementation

### Package Scripts

```json
{
  "build": "tsc",
  "start": "tsx src/server.ts",
  "dev": "fastmcp dev src/server.ts",
  "lint": "prettier --check . && eslint . && tsc --noEmit",
  "format": "prettier --write . && eslint --fix .",
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "ci:quality": "npm run lint && npm run type-check && npm run test:coverage && npm run audit && npm run build"
}
````

## Coding Standards

### TypeScript Guidelines

- **Strict Mode**: Full TypeScript strict mode enabled
- **Imports**: Use ES modules with `.js` extensions for local imports
- **Types**: Explicit typing preferred, avoid `any`
- **Interfaces**: Use interfaces for data structures
- **Error Handling**: Comprehensive try-catch with meaningful error messages

### Code Style

- **Prettier**: Auto-formatting with project configuration
- **ESLint**: Linting with TypeScript ESLint configuration
- **Line Length**: 100 characters maximum
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Required

### File Naming

- **Services**: PascalCase with Service suffix (`AIMemoryService.ts`)
- **Models**: PascalCase (`AIMemory.ts`, `WorkflowDefinition.ts`)
- **Tests**: `.unit.test.ts` or `.integration.test.ts` suffix
- **Constants**: camelCase with descriptive names
- **Always use the file naming standards as defined above**

## AO Ecosystem Integration

### Key Concepts

- **Processes**: Long-running computational units in AO
- **Messages**: Data/instruction packets sent to processes
- **Tags**: Metadata attached to messages for routing/filtering
- **Handlers**: Process functions that respond to specific message types
- **Schedulers**: Units that manage process execution timing

### AO Message Structure

```typescript
interface AOMessage {
  processId: string;
  tags: { name: string; value: string }[];
  data?: string;
  signer: DataItemSigner;
  scheduler: string;
}
```

### Process Creation Pattern

```typescript
import { spawn, createDataItemSigner } from "@permaweb/aoconnect";

const processId = await spawn({
  module: AOS_MODULE(),
  scheduler: SCHEDULER(),
  signer: createDataItemSigner(keyPair),
  tags: optionalTags,
});
```

## MCP Server Architecture

### Tool Categories (16 Tools)

**Process Tools (4):**

- `spawnProcess` - Create new AO processes
- `sendAOMessage` - Send messages with custom tags and data to processes
- `readAOProcess` - Read process state via dryrun queries (read-only)
- `queryAOProcessMessages` - Query process message history

**Arweave Tools (4):**

- `deployPermawebDirectory` - Deploy directories to Permaweb
- `checkPermawebDeployPrerequisites` - Verify deployment requirements
- `uploadToArweave` - Upload single files to Arweave
- `uploadFolderToArweave` - Upload folders to Arweave

**User Tools (2):**

- `generateKeypair` - Generate Arweave keypair from seed phrase
- `getUserPublicKey` - Get user's public key (wallet address)

**ArNS Tools (6):**

- `buyArnsRecord` - Purchase ArNS names (lease or permanent)
- `getArnsRecordInfo` - Fetch ArNS record details
- `getArnsTokenCost` - Get ArNS pricing information
- `resolveArnsName` - Resolve ArNS name to transaction ID
- `transferArnsRecord` - Transfer ArNS record ownership
- `updateArnsRecord` - Update ArNS record properties

### Tool Implementation

- Use Zod schemas for parameter validation
- Provide comprehensive descriptions for AI understanding
- Return structured responses with success/error states
- Handle asynchronous operations properly

### Service Layer (12 Services)

**Core Infrastructure:**

- DefaultProcessService, ProcessCommunicationService, RegistryService

**Process Operations:**

- ArweaveGraphQLService, ProcessCacheService

**Arweave Deployment:**

- PermawebDeployService, TurboService

**Service Dependencies:**

- ADPProcessCommunicationService, DocumentationProtocolService, ProcessDiscoveryService, HubLuaService, AOMessageService

### Error Handling

```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  return {
    success: false,
    error: {
      code: "OPERATION_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
      details: error,
    },
  };
}
```

## Testing Strategy

### Test Structure

- **Unit Tests**: Individual service and model testing
- **Integration Tests**: Cross-service functionality
- **Coverage Targets**: 90% functions, 85% lines, 75% branches

### Testing Patterns

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock external dependencies
vi.mock("../../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
}));

describe("ServiceName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle normal operation", async () => {
    // Test implementation
  });
});
```

## AO Process Management

### Core Capabilities

- **Process Creation**: Spawn new AO processes with custom configurations
- **Message Sending**: Send messages with custom tags and data to processes
- **Process Reading**: Read process state via dryrun queries (read-only)
- **Message Querying**: Query and filter process message history

### Process Interaction Patterns

- **Spawn Pattern**: Create processes with module, scheduler, and signer
- **Send Pattern**: Send messages with custom tags (including code deployment via Action: Eval)
- **Read Pattern**: Query process state via dryrun (no wallet required)
- **Query Pattern**: Fetch messages with filtering and pagination

### Lua Code Deployment Pattern

To deploy Lua code to AO processes, use `sendAOMessage` with the `Action: Eval` tag:

```typescript
await sendAOMessage({
  processId: "process-id",
  tags: [{ name: "Action", value: "Eval" }],
  data: "Handlers.add('ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), function(msg) msg.reply({ Data = 'Pong!' }) end)",
});
```

**Migration Note**: The `evalProcess` tool was removed in Epic 12 (Story 12.3). Use the pattern above instead for deploying Lua code to processes. This provides more flexibility and consistency with other message operations.

## Security Considerations

### Key Management

- Wallet keys stored securely in environment variables
- Mnemonic phrase generation for deterministic keys
- No hardcoded secrets or credentials in code

### Input Validation

- All user inputs validated with Zod schemas
- Sanitization of data before AO message construction
- Rate limiting and error handling for external calls

### Audit Requirements

- Regular dependency auditing (`npm audit`)
- Security scanning in CI/CD pipeline
- No debug logging in production code

## Performance Guidelines

### Optimization Patterns

- Async/await for all I/O operations
- Proper error boundaries and timeouts
- Efficient data structures for large datasets
- Lazy loading for optional dependencies

### Memory Management

- Clean up event listeners and timers
- Avoid memory leaks in long-running processes
- Monitor heap usage in development

## Git Workflow

### Branch Strategy

- **main**: Production-ready code
- **feature/\***: Feature development branches
- **fix/\***: Bug fix branches

### Commit Standards

- Conventional commits with scope
- Descriptive commit messages
- Co-authored attribution for AI assistance

### Pre-Push Validation

- Automated debug log removal
- Code quality checks (lint, format, type-check)
- Complete test suite execution
- Security audit and dependency validation

## Environment Configuration

### Required Environment Variables

```bash
SEED_PHRASE=your_arweave_wallet_mnemonic
NODE_ENV=production  # Default: production (set to development for local dev)
```

### Optional Configuration

```bash
DEBUG=true                    # Enable debug mode
MCP_LOG_LEVEL=info           # MCP logging level
TEST_TIMEOUT=60000           # Test timeout in ms

# Memory Management Configuration
MEMORY=true                  # Enable automatic memory storage (default: false)
                             # Set to true to enable automatic memory storage
                             # When false (default), memories are only stored when explicitly requested

# Context Management Configuration
ENABLE_AUTO_CONTEXT=true     # Enable automatic context loading on startup (default: true)
CONTEXT_REFRESH_HOURS=24     # Hours between automatic context refreshes (default: 24)
CONTEXT_RETRY_ATTEMPTS=3     # Number of retry attempts for failed URL fetches (default: 3)
CONTEXT_CHUNK_SIZE=2000      # Maximum characters per context chunk (default: 2000)
```

## Integration Points

### Arweave Ecosystem

- **Arweave Network**: Permanent data storage for files and deployments
- **Turbo SDK**: Fast uploads with credit-based payment system
- **AR.IO Gateway**: ArNS domain resolution and name services

### FastMCP Features

- Server-sent events (SSE) transport
- Tool, resource, and prompt definitions
- Authentication and session management
- Standard schema support (Zod validation)

## Development Best Practices

### Code Organization

- Single responsibility principle for services
- Clear separation of concerns
- Dependency injection where appropriate
- Immutable data structures when possible

### Documentation

- JSDoc comments for public APIs
- README files for complex modules
- Architecture diagrams for system overview
- Change logs for version tracking

### Monitoring and Debugging

- Structured logging with context
- Error tracking and reporting
- Performance monitoring
- Health check endpoints

## Common Patterns

### Service Implementation

```typescript
export class ServiceName {
  constructor(private dependency: DependencyType) {}

  async operation(params: ParamsType): Promise<ResultType> {
    try {
      // Implementation
      return result;
    } catch (error) {
      throw new Error(`ServiceName.operation failed: ${error}`);
    }
  }
}
```

### Process Message Sending

```typescript
import { send } from "./process.js";

const result = await send(
  signer,
  processId,
  [
    { name: "Action", value: "Transfer" },
    { name: "Recipient", value: recipientId },
  ],
  dataPayload,
);
```

### Arweave Deployment

```typescript
import { TurboService } from "./services/TurboService.js";

const uploadResult = await turboService.uploadFile(filePath, contentType, tags);
```

## ArNS (Arweave Name System)

### ArNS Operations

This project (Permaweb MCP) provides comprehensive ArNS domain management capabilities:

- **Record Management**: Purchase, extend, and release ArNS names
- **Undername Limits**: Increase undername capacity for domains
- **Pricing Information**: Query current ArNS pricing
- **Record Details**: Fetch complete ArNS record information

### ArNS Integration

```typescript
import { ARIO } from "@ar.io/sdk/node";

// Get ArNS record details
const record = await ario.getArNSRecord({ name: "example" });

// Purchase ArNS name
await ario.joinNetwork({
  qty: purchaseQty,
  type: "permabuy" | "lease",
});
```

This project (Permaweb MCP) provides a streamlined MCP server focused on core AO process management, Arweave deployment, wallet operations, and ArNS domain management capabilities.
