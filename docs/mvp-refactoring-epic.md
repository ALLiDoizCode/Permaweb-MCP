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

---

# Token Tools NLS Migration - Brownfield Enhancement

## Epic Title

Token Tools NLS Migration - Brownfield Enhancement

## Epic Goal

Replace the current 4 individual token MCP tools with a general `executeAction` NLS tool that has the AO token blueprint baked into the MCP server, enabling users to perform token operations through natural language without needing to load external NLS templates.

## Epic Description

### **Existing System Context:**

- Current functionality: 4 separate MCP tools (getTokenBalance, getTokenInfo, transferTokens, listTokens) with direct process communication
- Technology stack: TypeScript, FastMCP, AO Connect, token resolution system with registry mappings
- Integration points: Token/contact resolution, denomination handling, confirmation flows, AO process communication

### **Enhancement Details:**

- What's being added/changed: Replace 4 individual tools with a single `executeAction` NLS tool that has token operations baked into the server, accessible without loading external templates
- How it integrates: Leverages existing `ProcessCommunicationService` infrastructure, embeds `DEFAULT_TOKEN_PROCESS` template directly in server, uses existing token resolution system
- Success criteria: Users can perform all token operations through natural language immediately upon server startup, with no external NLS loading required

## Stories

### Story 1: Create General executeAction NLS Tool with Embedded Token Blueprint

**Acceptance Criteria:**

- Create single `executeAction` MCP tool that replaces individual token tools
- Embed `DEFAULT_TOKEN_PROCESS` template directly in MCP server code
- Integrate with existing `ProcessCommunicationService` infrastructure
- Preserve token resolution system (TokenResolver.ts) functionality
- Maintain confirmation flows for resolved tokens/addresses
- Support natural language requests for balance, info, transfer, and listing operations
- No external NLS template loading required - everything baked into server

### Story 2: Implement Missing saveTokenMapping Functionality

**Acceptance Criteria:**

- Complete the missing saveTokenMapping command implementation
- Make saveTokenMapping accessible through the baked-in token NLS
- Integrate with existing token registry system (Kind 30 mappings)
- Enable users to register new tokens through natural language
- Maintain compatibility with existing token/contact resolution system
- Support both direct tool access and NLS-based access to token mapping

### Story 3: Embed Token Process Templates and NLS Patterns

**Acceptance Criteria:**

- Embed `DEFAULT_TOKEN_PROCESS` template directly in MCP server
- Include `TOKEN_NLS_PATTERNS` for natural language operation extraction
- Integrate `extractTokenOperation()` function into server
- Remove dependency on external template loading for token operations
- Ensure immediate availability of token NLS upon server startup
- Maintain all existing denomination handling and safety features

## Compatibility Requirements

- [x] Existing token resolution system (TokenResolver.ts) remains unchanged
- [x] Token and contact registry mappings (kinds 30/31) remain compatible
- [x] Confirmation flows for resolved tokens/addresses preserved
- [x] Denomination handling logic maintained
- [x] AO process communication patterns follow existing infrastructure
- [x] No external NLS template loading required - everything baked into server

## Risk Mitigation

- **Primary Risk:** Loss of functionality during migration from individual tools to general NLS approach
- **Mitigation:** Implement executeAction tool alongside existing tools initially, with feature parity validation before removal
- **Rollback Plan:** Restore original 4 individual tools if NLS implementation fails to meet functional requirements

## Definition of Done

- [x] Single executeAction tool handles all token operations through natural language
- [x] Token NLS blueprint embedded directly in MCP server (no external loading needed)
- [x] All existing token functionality (balance, info, transfer, listing) accessible via natural language
- [x] Token resolution, confirmation flows, and denomination handling preserved
- [x] saveTokenMapping functionality implemented and integrated
- [x] Existing token registry and contact mappings work seamlessly with NLS
- [x] No regression in token operation capabilities or safety features
- [x] Users can access token operations immediately without loading external templates

## Team Handoff Instructions

**Story Manager Handoff:**

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running **TypeScript, FastMCP, AO Connect**
- Integration points: **Token resolution system, AO process communication, registry mappings (kinds 30/31)**
- Existing patterns to follow: **ProcessCommunicationService for NLS, DEFAULT_TOKEN_PROCESS template embedded in server, TokenResolver for mappings**
- Critical compatibility requirements: **Preserve token resolution, confirmation flows, denomination handling, registry system**
- **Key requirement:** Token NLS must be baked into the MCP server for immediate availability without external template loading
- Each story must include verification that existing token functionality remains intact while adding embedded NLS capabilities

The epic should maintain system integrity while delivering immediate natural language token interaction capabilities through a general executeAction tool."

## Success Criteria

The epic implementation is successful when:

1. Single executeAction tool replaces 4 individual token tools
2. Token NLS functionality is immediately available without external loading
3. All existing token operations work through natural language
4. Token resolution and safety features remain intact
5. saveTokenMapping functionality is complete and integrated
6. No regression in token operation capabilities
7. Users can perform token operations through natural language immediately upon server startup
8. Architecture supports future NLS expansions beyond token operations

## Implementation Notes

- Embed token templates directly in server code, not as external files
- Use existing ProcessCommunicationService patterns for NLS implementation
- Preserve all existing token resolution and registry functionality
- Maintain backward compatibility with existing AO integrations
- Focus on immediate availability without external dependencies
- Design executeAction tool to be extensible for future NLS blueprints
