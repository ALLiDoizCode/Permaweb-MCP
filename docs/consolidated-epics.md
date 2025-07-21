# Permamind Development Epics

This document consolidates all epic initiatives for the Permamind project, providing a unified view of development priorities and implementation roadmap.

---

## Table of Contents

1. [MVP Refactoring Epic - Brownfield Enhancement](#mvp-refactoring-epic---brownfield-enhancement)
2. [BMAD Integration Epic - Brownfield Enhancement](#bmad-integration-epic---brownfield-enhancement)
3. [Token Tools NLS Migration Epic](#token-tools-nls-migration-epic)
4. [Agent UX Enhancement Epic - Revolutionary Interface](#agent-ux-enhancement-epic---revolutionary-interface)
5. [AO Process Management Tools Epic](#ao-process-management-tools-epic)

---

## Epic 1: MVP Refactoring Epic - Brownfield Enhancement

### Epic Goal

Refactor Permamind project to align with MVP scope by streamlining tools to essential functionality while preserving Contact and Documentation capabilities, and simplifying memory operations to core store/search functions.

### Epic Description

**Existing System Context:**

- Current functionality: Full-featured MCP server with 6 tool categories (Contact, Documentation, Memory, Process, System, Token)
- Technology stack: FastMCP + TypeScript + Node.js 20+ + AO Connect + Arweave
- Integration points: Multiple tool factories, comprehensive service layer, extensive test suite covering all tool categories

**Enhancement Details:**

- What's being added/changed: Simplify memory tools to just storeMemory and searchMemory, remove System tools, streamline Process and Token tools to MVP essentials, keep Contact and Documentation tools intact
- How it integrates: Preserve core AO integration and existing Contact/Documentation workflows while reducing memory tool complexity
- Success criteria: Clean tool architecture with 5 focused tool categories supporting MVP user flows with comprehensive test coverage

### Stories

#### Story 1.1: Simplify Memory Tools to Core Functions

**Acceptance Criteria:**

- Remove complex memory tools: AddMemoriesBatchCommand, AddMemoryEnhancedCommand, AddReasoningChainCommand, GetAllMemoriesCommand, GetAllMemoriesForConversationCommand, GetMemoryAnalyticsCommand, LinkMemoriesCommand, SearchMemoriesAdvancedCommand
- Keep only: AddMemoryCommand (renamed to storeMemory), SearchMemoriesCommand (renamed to searchMemory)
- Update MemoryToolFactory to register only the 2 essential tools
- Preserve underlying aiMemoryService functionality
- Update tool descriptions to focus on MVP use cases

#### Story 1.2: Remove System Tools and Streamline Process Tools

**Acceptance Criteria:**

- Remove entire SystemToolFactory and related commands
- In ProcessToolFactory, keep only: ExecuteProcessActionCommand (for talkToProcess functionality), QueryAOProcessMessagesCommand
- Remove: ExecuteGraphQLQueryCommand, ExecuteSmartProcessActionCommand, GetTransactionDetailsCommand, QueryArweaveTransactionsCommand, QueryBlockInfoCommand
- Update process tool descriptions to focus on natural language process interaction
- Maintain AO process communication capabilities

#### Story 1.3: Streamline Token Tools and Preserve Contact/Documentation

**Acceptance Criteria:**

- In TokenToolFactory, keep only core tools: GetTokenBalanceCommand, TransferTokensCommand, ListTokensCommand, GetTokenInfoCommand
- Remove advanced token tools: BurnTokensCommand, CreateConfigurableTokenCommand, CreateSimpleTokenCommand, GenerateTokenLuaCommand, GetAllTokenBalancesCommand, GetTokenExamplesCommand, GetTokenNameCommand, MintTokensCommand, QueryTokenInfoCommand, SaveTokenMappingCommand, TransferTokenOwnershipCommand, ValidateTokenConfigurationCommand
- Keep ContactToolFactory completely intact (ListContactsCommand, SaveAddressMappingCommand)
- Keep DocumentationToolFactory completely intact (CheckPermawebDeployPrerequisitesCommand, DeployPermawebDirectoryCommand, ManagePermawebDocsCacheCommand, QueryPermawebDocsCommand)
- Update server.ts to register only the simplified tool factories

### Definition of Done

- [x] Memory tools reduced to 2 functions: storeMemory, searchMemory
- [x] Process tools streamlined to essential AO communication functions
- [x] Token tools reduced to 4 core operations: balance, transfer, list, info
- [x] Contact and Documentation tools remain fully functional
- [x] System tools completely removed
- [x] New test suite covers all remaining tools with 90% coverage
- [x] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [x] No regression in core AO messaging, memory storage, contact management, or documentation features

---

## Epic 2: BMAD Installation & Integration Tool Epic - Brownfield Enhancement

### Epic Goal

Create a tool that installs the complete BMAD methodology into any user's project AND integrates BMAD functionality with Claude Code slash commands, providing seamless access to the full methodology.

### Epic Description

**Existing System Context:**

- Current system: Permamind MCP server with existing tool infrastructure
- Technology stack: TypeScript, FastMCP, existing MCP tool patterns
- Integration points: UserToolFactory, command system, Claude Code slash command system

**Enhancement Details:**

- What's being added/changed: @init tool + Claude Code slash command integration
- Installation: Copies complete .bmad-core directory to user's project
- Slash commands: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /create-doc, /execute-checklist, etc.
- Integration: Detects installed BMAD and provides clean slash command access
- How it integrates: New MCP tool + Claude Code slash command registration
- Success criteria: Users run @init once, then use clean slash commands in any Claude Code session

### Stories

#### Story 2.1: Create @init MCP Tool

**User Story:** As a developer using Permamind, I want to install the complete BMAD methodology in my project with a single command so that I can access all BMAD resources locally.

**Acceptance Criteria:**

- Implement new MCP tool in Permamind UserToolFactory
- Tool copies entire .bmad-core directory structure to target project
- Include validation to check if BMAD already exists
- Provide option to update/overwrite existing installation
- Validate successful installation with basic health checks
- Provide clear feedback on installation status and next steps

#### Story 2.2: Implement Claude Code Slash Command Integration

**User Story:** As a Claude Code user with BMAD installed, I want to use clean slash commands for all BMAD functionality so that I can access agents, tasks, templates, checklists, and workflows efficiently.

**Acceptance Criteria:**

- Create agent slash commands: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /bmad-master
- Create task slash commands: /advanced-elicitation, /create-doc, /execute-checklist, /brownfield-create-epic, etc. (all 20 tasks)
- Create template slash commands: /architecture, /prd, /story, /front-end-spec, etc. (all 15 templates)
- Create checklist slash commands: /architect-checklist, /pm-checklist, /story-dod-checklist, etc. (all 7 checklists)
- Create workflow slash commands: /greenfield-fullstack, /brownfield-service, etc. (all 6 workflows)
- Ensure slash commands integrate with Claude Code's command system
- Maintain parameter passing and execution patterns from original BMAD tools

#### Story 2.3: Auto-detect BMAD Installation for Slash Commands

**User Story:** As a Claude Code user, I want slash commands to automatically detect if BMAD is installed in my project so that I get helpful guidance when BMAD is not available.

**Acceptance Criteria:**

- Slash commands detect if .bmad-core exists in current project
- Provide helpful error messages if BMAD not installed
- Auto-suggest @init if user tries slash commands without installation
- Enable slash commands to work from any directory within BMAD-enabled project
- Support multi-project workflows where some projects have BMAD and others don't
- Graceful degradation when BMAD resources are unavailable

#### Story 2.4: Add Installation Guidance and Slash Command Documentation

**User Story:** As a new BMAD user, I want comprehensive documentation and guidance so that I can understand how to install and use BMAD effectively in my projects.

**Acceptance Criteria:**

- Create help documentation for @init tool with usage examples
- Document all available slash commands with examples and parameter descriptions
- Provide post-installation usage guidance and getting started workflow
- Include troubleshooting for common installation and usage issues
- Create quick reference guide for all slash commands organized by category
- Integrate documentation with existing Permamind help system

### Definition of Done

- [ ] @init tool implemented in Permamind
- [ ] Complete .bmad-core directory installation working
- [ ] All agent slash commands implemented: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /bmad-master
- [ ] All task slash commands implemented (20 commands)
- [ ] All template slash commands implemented (15 commands)
- [ ] All checklist slash commands implemented (7 commands)
- [ ] All workflow slash commands implemented (6 commands)
- [ ] Auto-detection of BMAD installation for slash commands
- [ ] Installation validation and conflict detection
- [ ] Comprehensive documentation for installation and slash commands
- [ ] Tool tested across different project types and Claude Code sessions
- [ ] No impact on existing Permamind or Claude Code functionality
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

---

## Epic 3: Token Tools NLS Migration Epic

### Epic Goal

Replace the current 4 individual token MCP tools with a general `executeAction` NLS tool that has the AO token blueprint baked into the MCP server, enabling users to perform token operations through natural language without needing to load external NLS templates.

### Epic Description

**Existing System Context:**

- Current functionality: 4 separate MCP tools (getTokenBalance, getTokenInfo, transferTokens, listTokens) with direct process communication
- Technology stack: TypeScript, FastMCP, AO Connect, token resolution system with registry mappings
- Integration points: Token/contact resolution, denomination handling, confirmation flows, AO process communication

**Enhancement Details:**

- What's being added/changed: Replace 4 individual tools with a single `executeAction` NLS tool that has token operations baked into the server, accessible without loading external templates
- How it integrates: Leverages existing `ProcessCommunicationService` infrastructure, embeds `DEFAULT_TOKEN_PROCESS` template directly in server, uses existing token resolution system
- Success criteria: Users can perform all token operations through natural language immediately upon server startup, with no external NLS loading required

### Stories

#### Story 3.1: Create General executeAction NLS Tool with Embedded Token Blueprint

**Acceptance Criteria:**

- Create single `executeAction` MCP tool that replaces individual token tools
- Embed `DEFAULT_TOKEN_PROCESS` template directly in MCP server code
- Integrate with existing `ProcessCommunicationService` infrastructure
- Preserve token resolution system (TokenResolver.ts) functionality
- Maintain confirmation flows for resolved tokens/addresses
- Support natural language requests for balance, info, transfer, and listing operations
- No external NLS template loading required - everything baked into server

#### Story 3.2: Implement Missing saveTokenMapping Functionality

**Acceptance Criteria:**

- Complete the missing saveTokenMapping command implementation
- Make saveTokenMapping accessible through the baked-in token NLS
- Integrate with existing token registry system (Kind 30 mappings)
- Enable users to register new tokens through natural language
- Maintain compatibility with existing token/contact resolution system
- Support both direct tool access and NLS-based access to token mapping

#### Story 3.3: Embed Token Process Templates and NLS Patterns

**Acceptance Criteria:**

- Embed `DEFAULT_TOKEN_PROCESS` template directly in MCP server
- Include `TOKEN_NLS_PATTERNS` for natural language operation extraction
- Integrate `extractTokenOperation()` function into server
- Remove dependency on external template loading for token operations
- Ensure immediate availability of token NLS upon server startup
- Maintain all existing denomination handling and safety features

### Definition of Done

- [x] Single executeAction tool handles all token operations through natural language
- [x] Token NLS blueprint embedded directly in MCP server (no external loading needed)
- [x] All existing token functionality (balance, info, transfer, listing) accessible via natural language
- [x] Token resolution, confirmation flows, and denomination handling preserved
- [x] saveTokenMapping functionality implemented and integrated
- [x] Existing token registry and contact mappings work seamlessly with NLS
- [x] No regression in token operation capabilities or safety features
- [x] Users can access token operations immediately without loading external templates

---

## Epic 4: Agent UX Enhancement Epic - Revolutionary Interface

### Epic Goal

Transform Permamind from single AI interactions to collaborative AI team experiences through dual-platform agent orchestration, enabling natural team-based workflows in both Claude Desktop and Claude Code environments.

### Epic Description

**Existing System Context:**

- Current functionality: Individual AI interactions through MCP tools with single-context sessions
- Technology stack: FastMCP + TypeScript + Permamind memory system + AO Connect
- Integration points: MCP server, AI memory services, BMad workflow system

**Enhancement Details:**

- What's being added/changed: Revolutionary dual-platform agent system where users create AI teams through conversation naming (Claude Desktop) and file-based detection (Claude Code), with shared Permamind memory enabling cross-agent collaboration and workflow-aware personas
- How it integrates: Extends existing BMad agent system with conversation-based activation, leverages Permamind memory for context sharing, adds persona management and workflow integration
- Success criteria: Users experience natural AI team collaboration with persistent context, role-based specialization, and seamless workflow coordination across both platforms

### Stories

#### Story 4.1: Claude Desktop Conversation-Based Agent Teams ⚠️ DEPRECATED

**Status:** Deprecated - Superseded by Epic 6 (Prompt-Based Agent Activation)

**Reason:** MCP servers cannot access Claude Desktop conversation metadata (names, titles), making conversation-based detection technically infeasible. Epic 6 provides a superior prompt-based approach for the same user value.

**User Story:** ~~As a Claude Desktop user, I want to create project conversations with agent role names (PM, Dev, UX, QA) so that each conversation automatically activates the appropriate specialist agent with relevant context and cross-conversation awareness.~~

**Replacement:** See Epic 6 for prompt-based agent activation (`@dev ProjectX`, `get me a PM`) which provides the same collaborative agent experience through a technically feasible approach.

#### Story 4.2: Claude Code File-Based Agent Detection

**User Story:** As a Claude Code user, I want agents to automatically activate based on my commands and file operations so that I get contextual AI assistance that understands my current development focus and project state.

**Acceptance Criteria:**

- Create CLI command pattern detection for agent activation
- Implement file-based project structure with `.bmad/` directory for agent state
- Enable git-aware context switching based on file operations and commit patterns
- Support explicit agent activation via `--agent` command flags
- Maintain persistent agent state across CLI sessions through file system
- Integrate agent handoff protocols with memory transfer between sessions

#### Story 4.3: Unified Memory-Driven Context Sharing

**User Story:** As a user working across both platforms, I want my AI agents to share context intelligently so that insights from one agent (e.g., PM requirements) are available to other agents (e.g., Dev implementation) without overwhelming their specific focus areas.

**Acceptance Criteria:**

- Implement single-hub architecture with smart memory tagging system
- Create agent-specific context filtering based on memory types and importance
- Enable cross-agent insight sharing through `sharedWith` memory tags
- Support workflow-aware context loading based on current project stage
- Maintain agent specialization while enabling team intelligence
- Integrate with existing Permamind memory services and AO storage

### Definition of Done

- [ ] Claude Desktop conversation naming triggers appropriate agent activation
- [ ] Claude Code command patterns and file operations activate contextual agents
- [ ] Single Permamind hub supports intelligent cross-agent context sharing
- [ ] Agent personas adapt to workflow stages and project context
- [ ] Seamless handoff protocols between agents across both platforms
- [ ] No regression in existing BMad functionality or Permamind memory services
- [ ] Users experience natural AI team collaboration rather than tool usage
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

---

## Epic 5: AO Process Management Tools Epic

### Epic Goal

Add comprehensive AO process lifecycle management capabilities to Permamind by implementing createProcess and evalProcess tools that enable users to spawn new AO processes and evaluate code within them, providing foundational infrastructure for AO development workflows.

### Epic Description

**Existing System Context:**

- Current functionality: Permamind provides process communication through executeAction and queryAOProcessMessages tools
- Technology stack: TypeScript, FastMCP, AO Connect (@permaweb/aoconnect), existing process.ts and relay.ts modules
- Integration points: MCP tool system, AO process communication infrastructure, existing signer management

**Enhancement Details:**

- What's being added/changed: Two new MCP tools - createProcess for spawning AO processes and evalProcess for code evaluation within processes, leveraging existing createProcess() and evalProcess() functions
- How it integrates: Extends existing ProcessToolFactory with new tools, uses established AO Connect patterns, integrates with current signer and process management infrastructure
- Success criteria: Users can create new AO processes and evaluate Lua code within them through natural MCP commands, enabling full AO development lifecycle management

### Stories

#### Story 5.1: Implement createProcess MCP Tool

**User Story:** As a developer using Permamind, I want to spawn new AO processes through an MCP command so that I can create dedicated computational environments for my applications without manual AO setup.

**Acceptance Criteria:**

- Create CreateProcessCommand following existing ProcessToolFactory patterns
- Integrate with existing createProcess() function from process.ts:60
- Use established signer management from current MCP tool infrastructure
- Return processId upon successful creation with 3-second initialization delay
- Include proper error handling and validation for process creation failures
- Provide clear tool description and parameter documentation for AI understanding
- Maintain compatibility with existing AO Connect configuration (SCHEDULER, AOS_MODULE)

#### Story 5.2: Implement evalProcess MCP Tool

**User Story:** As a developer working with AO processes, I want to evaluate Lua code within existing processes through an MCP command so that I can test functionality, debug issues, and execute operations programmatically.

**Acceptance Criteria:**

- Create EvalProcessCommand following existing ProcessToolFactory patterns
- Integrate with existing evalProcess() function from relay.ts:41-52
- Accept processId and Lua code as parameters with proper validation
- Use established signer management and error handling patterns
- Handle evaluation errors gracefully with meaningful error messages
- Support both simple expressions and complex multi-line Lua code blocks
- Maintain silent error handling consistent with existing relay.ts patterns
- Include comprehensive tool description for AI-assisted usage

#### Story 5.3: Integrate Process Management Tools with Existing Infrastructure

**User Story:** As a Permamind user, I want the new process management tools to work seamlessly with existing functionality so that I can combine process creation/evaluation with memory storage, documentation queries, and workflow execution.

**Acceptance Criteria:**

- Register new tools in ProcessToolFactory alongside existing process tools
- Ensure compatibility with current executeAction and queryAOProcessMessages functionality
- Maintain existing MCP server registration patterns in server.ts
- Preserve all current process communication capabilities
- Support process lifecycle: create → evaluate → communicate → query
- Enable process management within BMAD workflow contexts
- Update tool documentation to reflect expanded process management capabilities

### Definition of Done

- [ ] CreateProcessCommand implemented and integrated with ProcessToolFactory
- [ ] EvalProcessCommand implemented with proper Lua code evaluation
- [ ] Both tools use existing createProcess() and evalProcess() functions correctly
- [ ] Tools registered in MCP server with proper descriptions and validation
- [ ] Error handling follows established patterns with meaningful messages
- [ ] Process creation returns valid processId, evaluation handles code execution
- [ ] Integration testing confirms compatibility with existing process tools
- [ ] No regression in current executeAction or queryAOProcessMessages functionality
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [ ] Documentation updated to include process management workflow examples

---

---

## Implementation Priorities

### Phase 1: Foundation (MVP Refactoring)

1. Simplify memory tools to core store/search functions
2. Remove system tools and streamline process tools
3. Reduce token tools to essential operations
4. Preserve contact and documentation capabilities

### Phase 2: NLS Enhancement (Token Tools Migration)

1. Create general executeAction NLS tool
2. Embed token blueprints directly in server
3. Implement missing saveTokenMapping functionality
4. Ensure immediate NLS availability

### Phase 3: Advanced Capabilities (BMAD Integration)

1. Create @init tool for BMAD installation
2. Implement Claude Code slash command integration for all BMAD resources
3. Add auto-detection and documentation system
4. Enable complete BMAD methodology access through clean slash commands

### Phase 4: Revolutionary UX (Agent Enhancement)

1. ~~Implement dual-platform agent detection and activation~~ (Story 4.1 deprecated)
2. Create file-based agent systems for Claude Code (Story 4.2)
3. Build unified memory-driven context sharing architecture (Story 4.3)
4. Enable natural AI team collaboration experiences

### Phase 5: AO Process Infrastructure (Process Management Tools)

1. Implement createProcess MCP tool for AO process spawning
2. Add evalProcess MCP tool for Lua code evaluation
3. Integrate with existing ProcessToolFactory and infrastructure
4. Enable complete AO development lifecycle management

---

## Risk Mitigation Strategy

### Cross-Epic Compatibility

- **Risk:** Conflicting changes between epic implementations
- **Mitigation:** Sequential implementation with thorough integration testing
- **Dependencies:** MVP Refactoring must complete before Token NLS Migration and BMAD Integration

### System Integrity

- **Risk:** Breaking existing functionality during consolidation
- **Mitigation:** Comprehensive test coverage, feature flags, rollback plans
- **Validation:** Each epic includes regression testing requirements

### Performance Impact

- **Risk:** Resource loading affecting system performance
- **Mitigation:** Lazy loading patterns, on-demand resource access, minimal startup impact
- **Monitoring:** Performance benchmarks for each implementation phase

---

## Success Metrics

### MVP Refactoring Success

- Tool count reduced from ~40 to ~12 essential tools
- Memory operations simplified to store/search only
- Contact and Documentation capabilities fully preserved
- 90% test coverage maintained

### Token NLS Migration Success

- Single executeAction tool replaces 4 individual token tools
- Token operations available immediately without external loading
- All existing functionality preserved with natural language access
- Architecture supports future NLS expansions

### BMAD Integration Success

- @init tool installs complete BMAD methodology in any project
- All 58 BMAD resources accessible via clean slash commands: 10 agents, 20 tasks, 15 templates, 7 checklists, 6 workflows
- Auto-detection works reliably across different project types
- No regression in existing Permamind functionality
- Users experience seamless BMAD access through Claude Code

### Agent UX Enhancement Success

- Dual-platform agent system operational in Claude Desktop and Claude Code
- Conversation naming and file-based detection triggers appropriate agents
- Single hub memory architecture enables intelligent context sharing
- Users experience collaborative AI teams rather than individual tool usage
- Workflow-aware personas adapt to project stages and collaboration needs

### AO Process Management Tools Success

- CreateProcess and EvalProcess tools integrated with ProcessToolFactory
- Users can spawn AO processes and evaluate Lua code through MCP commands
- Complete AO development lifecycle supported: create → evaluate → communicate → query
- Tools leverage existing createProcess() and evalProcess() functions correctly
- No regression in existing process communication or workflow capabilities

---

## Team Coordination

### Development Sequence

1. **Epic 1 (MVP Refactoring)** - Foundation simplification
2. **Epic 3 (Token NLS Migration)** - Enhanced user experience
3. **Epic 5 (AO Process Management Tools)** - Core infrastructure expansion
4. **Epic 2 (BMAD Integration)** - Advanced development capabilities
5. **Epic 4 (Agent UX Enhancement)** - File-based agents and memory sharing (Stories 4.2, 4.3)

### Quality Gates

- Each epic must pass full test suite before proceeding
- Integration testing between epic implementations
- Performance validation at each phase
- Documentation updates for each completed epic

This consolidated roadmap ensures systematic enhancement of Permamind while maintaining system integrity and providing clear development priorities.
