# Core Components

## 1. MCP Server Implementation (`src/server.ts`)

The main server orchestrates the entire system with a sophisticated initialization strategy:

**Key Responsibilities:**

- Manages Arweave wallet creation/import from mnemonic
- Handles hub registry integration and profile management
- Implements dual-phase tool registration (basic + enhanced)
- Provides graceful startup with background initialization

**Initialization Flow:**

1. Load environment configuration silently for MCP compatibility
2. Generate/load Arweave keypair from `SEED_PHRASE`
3. Register with hub registry or create new profile
4. Initialize embedded process templates
5. Register tools immediately with basic context
6. Complete full initialization in background
7. Update tool context without re-registration

## 2. Service Layer Architecture

### AI Memory Service (`src/services/aiMemoryService.ts`)

The cornerstone of persistent AI memory with advanced analytics:

**Core Features:**

- **Enhanced Memory Operations**: Structured memory storage with validation
- **Relationship Analysis**: Memory linking with strength scoring
- **Advanced Search**: Multi-dimensional filtering and ranking
- **Analytics Engine**: Usage patterns and importance distribution
- **Batch Operations**: Efficient bulk memory processing

**Memory Types Supported:**

- `conversation` - Chat interactions and context
- `knowledge` - Factual information and learning
- `procedure` - Step-by-step processes
- `reasoning` - Decision trees and logic chains
- `enhancement` - Code improvements and optimizations
- `performance` - Metrics and benchmarking
- `workflow` - Process definitions and execution history
- `context` - Comprehensive ecosystem documentation

### Process Communication Service (`src/services/ProcessCommunicationService.ts`)

Intelligent AO process interaction with natural language processing:

**Key Capabilities:**

- **Markdown Process Parsing**: Convert documentation to executable handlers
- **Natural Language Service**: AI-powered request interpretation
- **Smart Parameter Extraction**: Context-aware parameter mapping
- **Enhanced Token Operations**: Embedded templates for common patterns
- **Response Interpretation**: Structured data extraction from AO responses

**Communication Flow:**

1. Parse user request using NLS patterns
2. Match to appropriate process handler
3. Extract and validate parameters
4. Build AO message with proper tags
5. Execute via AOMessageService
6. Interpret and structure response

### Permaweb Documentation Service (`src/services/PermawebDocsService.ts`)

Live documentation integration with intelligent caching:

**Documentation Sources:**

- **Arweave Ecosystem**: 65 documents, 21,106 words
- **AO Computer System**: 90 documents, 36,805 words
- **AR.IO Infrastructure**: 125 documents, 78,208 words
- **HyperBEAM Computing**: Implementation documentation
- **Permaweb Glossary**: 9,710 words of terminology

**Advanced Features:**

- **Domain Detection**: AI-powered relevance scoring
- **Intelligent Chunking**: Semantic boundary splitting
- **Cache Management**: 24-hour TTL with retry logic
- **Relevance Ranking**: Multi-factor scoring algorithm
- **Fallback Strategies**: Graceful degradation patterns

## 3. Tool Architecture

### Tool Registry System (`src/tools/core/ToolRegistry.ts`)

Centralized tool management with category organization:

**Design Patterns:**

- **Factory Pattern**: Tool factories for each domain
- **Registry Pattern**: Central tool registration and discovery
- **Command Pattern**: Unified tool execution interface
- **Category Organization**: Logical grouping of related tools

### Tool Categories

**Memory Tools** (`src/tools/memory/`)

- `AddMemoryCommand` - Enhanced memory storage
- `SearchMemoriesCommand` - Advanced search with filters

**Token Tools** (`src/tools/token/`)

- `GetTokenBalanceCommand` - Balance queries with resolution
- `GetTokenInfoCommand` - Comprehensive token metadata
- `TransferTokensCommand` - Token transfers with validation
- `ListTokensCommand` - Registry enumeration
- `SaveTokenMappingCommand` - Token name/ID mapping

**Process Tools** (`src/tools/process/`)

- `ExecuteActionCommand` - Smart process communication
- `ExecuteProcessActionCommand` - Markdown-driven execution
- `QueryAOProcessMessagesCommand` - Message history analysis

**Documentation Tools** (`src/tools/documentation/`)

- `QueryPermawebDocsCommand` - Live documentation queries
- `ManagePermawebDocsCacheCommand` - Cache management
- `DeployPermawebDirectoryCommand` - Permaweb deployment
- `CheckPermawebDeployPrerequisitesCommand` - Deployment validation

**Contact Tools** (`src/tools/contact/`)

- `ListContactsCommand` - Address book management
- `SaveAddressMappingCommand` - Contact name mapping

**User Tools** (`src/tools/user/`)

- `GetUserPublicKeyCommand` - Wallet address retrieval
- `GetUserHubIdCommand` - Hub ID management

## 4. AO Ecosystem Integration

### Core Integration Patterns

**Process Communication** (`src/process.ts`)

- **AO Connect Integration**: Message sending and process spawning
- **Scheduler Integration**: Reliable message execution
- **Data Item Signing**: Cryptographic message authentication
- **Process Management**: Creation and lifecycle management

**Event Relay System** (`src/relay.ts`)

- **Event Broadcasting**: Hub-based event distribution
- **VIP-01 Compliance**: Standard-compliant filtering
- **Result Processing**: Enhanced data transformation
- **Error Handling**: Graceful failure management

### Message Factory (`src/messageFactory.ts`)

Standardized message construction for AO operations:

- `FetchEvents` - Event querying with filters
- `Register` - Hub registry operations
- `Info` - Process information retrieval
- `Eval` - Code execution in processes

## 5. Data Models

### Memory Model Hierarchy

**Base Memory** (`src/models/Memory.ts`)

```typescript
interface Memory {
  id: string;
  content: string;
  timestamp: string;
  p: string; // public key
  role: string;
}
```

**AI Memory Extension** (`src/models/AIMemory.ts`)

```typescript
interface AIMemory extends Memory {
  memoryType: MemoryType;
  importance: number; // 0-1 relevance score
  context: MemoryContext;
  metadata: MemoryMetadata;
  reasoning?: ReasoningTrace;
  relationships?: MemoryLink[];
}
```

**Advanced Analytics**

- Memory relationship graphs
- Importance distribution analysis
- Access pattern tracking
- Circular reference detection
