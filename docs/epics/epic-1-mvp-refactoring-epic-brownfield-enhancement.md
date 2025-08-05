# Epic 1: MVP Refactoring Epic - Brownfield Enhancement

## Epic Goal

Refactor Permamind project to align with MVP scope by streamlining tools to essential functionality while preserving Contact and Documentation capabilities, and simplifying memory operations to core store/search functions.

## Epic Description

**Existing System Context:**

- Current functionality: Full-featured MCP server with 6 tool categories (Contact, Documentation, Memory, Process, System, Token)
- Technology stack: FastMCP + TypeScript + Node.js 20+ + AO Connect + Arweave
- Integration points: Multiple tool factories, comprehensive service layer, extensive test suite covering all tool categories

**Enhancement Details:**

- What's being added/changed: Simplify memory tools to just storeMemory and searchMemory, remove System tools, streamline Process and Token tools to MVP essentials, keep Contact and Documentation tools intact
- How it integrates: Preserve core AO integration and existing Contact/Documentation workflows while reducing memory tool complexity
- Success criteria: Clean tool architecture with 5 focused tool categories supporting MVP user flows with comprehensive test coverage

## Stories

### Story 1.1: Simplify Memory Tools to Core Functions

**Acceptance Criteria:**

- Remove complex memory tools: AddMemoriesBatchCommand, AddMemoryEnhancedCommand, AddReasoningChainCommand, GetAllMemoriesCommand, GetAllMemoriesForConversationCommand, GetMemoryAnalyticsCommand, LinkMemoriesCommand, SearchMemoriesAdvancedCommand
- Keep only: AddMemoryCommand (renamed to storeMemory), SearchMemoriesCommand (renamed to searchMemory)
- Update MemoryToolFactory to register only the 2 essential tools
- Preserve underlying aiMemoryService functionality
- Update tool descriptions to focus on MVP use cases

### Story 1.2: Remove System Tools and Streamline Process Tools

**Acceptance Criteria:**

- Remove entire SystemToolFactory and related commands
- In ProcessToolFactory, keep only: ExecuteProcessActionCommand (for talkToProcess functionality), QueryAOProcessMessagesCommand
- Remove: ExecuteGraphQLQueryCommand, ExecuteSmartProcessActionCommand, GetTransactionDetailsCommand, QueryArweaveTransactionsCommand, QueryBlockInfoCommand
- Update process tool descriptions to focus on natural language process interaction
- Maintain AO process communication capabilities

### Story 1.3: Streamline Token Tools and Preserve Contact/Documentation

**Acceptance Criteria:**

- In TokenToolFactory, keep only core tools: GetTokenBalanceCommand, TransferTokensCommand, ListTokensCommand, GetTokenInfoCommand
- Remove advanced token tools: BurnTokensCommand, CreateConfigurableTokenCommand, CreateSimpleTokenCommand, GenerateTokenLuaCommand, GetAllTokenBalancesCommand, GetTokenExamplesCommand, GetTokenNameCommand, MintTokensCommand, QueryTokenInfoCommand, SaveTokenMappingCommand, TransferTokenOwnershipCommand, ValidateTokenConfigurationCommand
- Keep ContactToolFactory completely intact (ListContactsCommand, SaveAddressMappingCommand)
- Keep DocumentationToolFactory completely intact (CheckPermawebDeployPrerequisitesCommand, DeployPermawebDirectoryCommand, ManagePermawebDocsCacheCommand, QueryPermawebDocsCommand)
- Update server.ts to register only the simplified tool factories

## Definition of Done

- [x] Memory tools reduced to 2 functions: storeMemory, searchMemory
- [x] Process tools streamlined to essential AO communication functions
- [x] Token tools reduced to 4 core operations: balance, transfer, list, info
- [x] Contact and Documentation tools remain fully functional
- [x] System tools completely removed
- [x] New test suite covers all remaining tools with 90% coverage
- [x] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [x] No regression in core AO messaging, memory storage, contact management, or documentation features

---
