# MVP Refactoring Epic - Brownfield Enhancement

## Epic Title

MVP Tool Simplification - Brownfield Enhancement

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

### Story 1: Simplify Memory Tools to Core Functions

**Acceptance Criteria:**

- Remove complex memory tools: AddMemoriesBatchCommand, AddMemoryEnhancedCommand, AddReasoningChainCommand, GetAllMemoriesCommand, GetAllMemoriesForConversationCommand, GetMemoryAnalyticsCommand, LinkMemoriesCommand, SearchMemoriesAdvancedCommand
- Keep only: AddMemoryCommand (renamed to storeMemory), SearchMemoriesCommand (renamed to searchMemory)
- Update MemoryToolFactory to register only the 2 essential tools
- Preserve underlying aiMemoryService functionality
- Update tool descriptions to focus on MVP use cases

### Story 2: Remove System Tools and Streamline Process Tools

**Acceptance Criteria:**

- Remove entire SystemToolFactory and related commands
- In ProcessToolFactory, keep only: ExecuteProcessActionCommand (for talkToProcess functionality), QueryAOProcessMessagesCommand
- Remove: ExecuteGraphQLQueryCommand, ExecuteSmartProcessActionCommand, GetTransactionDetailsCommand, QueryArweaveTransactionsCommand, QueryBlockInfoCommand
- Update process tool descriptions to focus on natural language process interaction
- Maintain AO process communication capabilities

### Story 3: Streamline Token Tools and Preserve Contact/Documentation

**Acceptance Criteria:**

- In TokenToolFactory, keep only core tools: GetTokenBalanceCommand, TransferTokensCommand, ListTokensCommand, GetTokenInfoCommand
- Remove advanced token tools: BurnTokensCommand, CreateConfigurableTokenCommand, CreateSimpleTokenCommand, GenerateTokenLuaCommand, GetAllTokenBalancesCommand, GetTokenExamplesCommand, GetTokenNameCommand, MintTokensCommand, QueryTokenInfoCommand, SaveTokenMappingCommand, TransferTokenOwnershipCommand, ValidateTokenConfigurationCommand
- Keep ContactToolFactory completely intact (ListContactsCommand, SaveAddressMappingCommand)
- Keep DocumentationToolFactory completely intact (CheckPermawebDeployPrerequisitesCommand, DeployPermawebDirectoryCommand, ManagePermawebDocsCacheCommand, QueryPermawebDocsCommand)
- Update server.ts to register only the simplified tool factories

## Compatibility Requirements

- [x] Existing AO process communication APIs remain unchanged
- [x] Memory storage schema is backward compatible
- [x] Contact and Documentation tool functionality preserved
- [x] FastMCP integration patterns follow existing conventions
- [x] Performance impact is minimal (improved by reducing complexity)

## Risk Mitigation

- **Primary Risk:** Breaking existing Contact and Documentation workflows
- **Mitigation:** Preserve these tool categories completely intact, only simplify memory/process/token tools
- **Rollback Plan:** Git branch protection allows easy reversion; simplified tools can be re-expanded if needed

## Definition of Done

- [x] Memory tools reduced to 2 functions: storeMemory, searchMemory
- [x] Process tools streamlined to essential AO communication functions
- [x] Token tools reduced to 4 core operations: balance, transfer, list, info
- [x] Contact and Documentation tools remain fully functional
- [x] System tools completely removed
- [x] New test suite covers all remaining tools with 90% coverage
- [x] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [x] No regression in core AO messaging, memory storage, contact management, or documentation features

## Team Handoff Instructions

**Story Manager Handoff:**

"Please develop detailed user stories for this MVP refactoring epic. Key considerations:

- This is an enhancement to an existing MCP server running FastMCP + TypeScript + AO Connect
- Integration points: aiMemoryService, AO process communication, Contact/Documentation workflows
- Existing patterns to follow: Tool factory registration, command pattern, Zod validation
- Critical compatibility requirements: Preserve Contact and Documentation tools completely
- Each story must include verification that Contact and Documentation functionality remains intact

The epic should maintain system integrity while delivering simplified tool architecture supporting MVP user flows."

## Success Criteria

The epic refactoring is successful when:

1. Tool count reduced from ~40 tools to ~12 essential tools
2. Memory operations simplified to store/search only
3. Contact and Documentation capabilities fully preserved
4. Process interaction streamlined for natural language use
5. Token operations focused on core user needs
6. Test suite provides comprehensive coverage for simplified architecture
7. Build and quality checks pass consistently
8. Team can easily work on individual stories independently

## Implementation Notes

- Preserve all existing service layer functionality
- Focus simplification on tool layer only
- Maintain backward compatibility for AO integrations
- Keep tool factory pattern consistent
- Ensure proper error handling in simplified tools
- Update tool descriptions to reflect MVP focus
