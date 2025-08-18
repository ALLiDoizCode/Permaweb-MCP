# Permamind Development Epics

This document consolidates all epic initiatives for the Permamind project, providing a unified view of development priorities and implementation roadmap.

---

## Table of Contents

1. [MVP Refactoring Epic - Brownfield Enhancement](#mvp-refactoring-epic---brownfield-enhancement)
2. [BMAD Integration Epic - Brownfield Enhancement](#bmad-integration-epic---brownfield-enhancement)
3. [Token Tools NLS Migration Epic](#token-tools-nls-migration-epic)
4. [Agent UX Enhancement Epic - Revolutionary Interface](#agent-ux-enhancement-epic---revolutionary-interface)
5. [AO Process Management Tools Epic](#ao-process-management-tools-epic)
6. [Human Crypto Keys Performance Optimization Epic - Brownfield Enhancement](#human-crypto-keys-performance-optimization-epic---brownfield-enhancement)
7. [Lua Process Creation and Documentation Enhancement Epic](#lua-process-creation-and-documentation-enhancement-epic)
8. [AO Process Communication ADP Migration Epic - Brownfield Enhancement](#ao-process-communication-adp-migration-epic---brownfield-enhancement)
9. [ADP Parameter Translation Quality Issues Epic - Brownfield Enhancement](#adp-parameter-translation-quality-issues-epic---brownfield-enhancement)

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

## Epic 6: Human Crypto Keys Performance Optimization Epic - Brownfield Enhancement

### Epic Goal

Optimize the `getKeyPairFromSeed` function performance in the Permamind project by implementing caching, alternative implementations, and architectural improvements to reduce 4096-bit RSA key generation latency by 75%+ while maintaining mandatory security requirements.

### Epic Description

**Existing System Context:**

- Current functionality: Arweave wallet key generation using `human-crypto-keys@0.1.4` with 4096-bit RSA keys
- Technology stack: TypeScript + Node.js 20+ + human-crypto-keys + bip39-web-crypto + Web Crypto API
- Integration points: `src/mnemonic.ts:20` - `getKeyFromMnemonic()` function, AO process creation, wallet operations
- Current performance: 2-30 seconds per key generation (Node-Forge bottleneck with custom PRNG)

**Enhancement Details:**

- What's being added/changed: Multi-layered performance optimization including memory/disk caching, worker thread implementation, pre-generation strategies, and custom implementation exploration
- How it integrates: Maintains existing `JWKInterface` compatibility, preserves cryptographic security standards, extends current `mnemonic.ts` module
- Success criteria: <500ms effective generation time from current 2-30 seconds, zero API breaking changes, maintained security compliance

### Stories

#### Story 6.1: Implement Memory and Disk Caching System

**User Story:** As a Permamind user, I want key generation to be instant for previously used mnemonics so that I don't wait for the same computation repeatedly.

**Acceptance Criteria:**

- Implement secure memory cache for generated keys using mnemonic hash as key
- Create persistent disk cache in `.permamind/keys/` directory with proper file permissions
- Add cache validation and corruption recovery mechanisms
- Implement cache expiration policies and cleanup routines
- Ensure secure memory handling prevents key exposure in memory dumps
- Maintain existing `getKeyFromMnemonic()` function signature with transparent caching
- Add cache statistics and monitoring for performance metrics

#### Story 6.2: Implement Worker Thread Architecture

**User Story:** As a Permamind user, I want the system to remain responsive during key generation so that other operations are not blocked by cryptographic computation.

**Acceptance Criteria:**

- Create dedicated worker thread for CPU-intensive key generation
- Implement non-blocking key generation with progress callbacks
- Add queue management for multiple concurrent key generation requests
- Provide user feedback during generation process with time estimates
- Maintain error handling and recovery in worker thread context
- Support graceful shutdown and worker thread cleanup
- Enable background pre-generation during system idle time

#### Story 6.3: Explore Custom Implementation Alternatives

**User Story:** As a Permamind developer, I want to evaluate custom key generation implementations so that we can achieve optimal performance while maintaining security requirements.

**Acceptance Criteria:**

- Research and prototype custom deterministic RSA key generation using Node.js native crypto
- Implement proof-of-concept using direct OpenSSL bindings via Node.js crypto.generateKeyPair()
- Create deterministic PRNG implementation for seed-based generation
- Conduct comprehensive testing against existing human-crypto-keys output for compatibility
- Perform security analysis of custom implementation approach
- Benchmark performance improvements vs current implementation
- Document risks, benefits, and migration strategy for custom solution

### Definition of Done

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

---

## Epic 7: Lua Process Creation and Documentation Enhancement Epic

### Epic Goal

Enable AI agents using the Permamind MCP server to seamlessly create and deploy functional Lua processes for AO by implementing intelligent workflow integration between existing comprehensive AO/Lua documentation and process creation tools, providing guided Lua code generation and deployment workflows.

### Epic Description

**Existing System Context:**

- Current functionality: queryPermawebDocs provides comprehensive AO/Lua knowledge (90 documents, 36,805 words) including handler patterns, process architecture, and Lua tutorials; createProcess and evalProcess tools handle process spawning and code evaluation; but AI agents lack integrated workflows connecting documentation knowledge to practical Lua code generation and deployment
- Technology stack: FastMCP + TypeScript + AO Connect + existing ProcessToolFactory + comprehensive AO documentation system
- Integration points: queryPermawebDocs tool with extensive AO knowledge base, createProcess/evalProcess tools, ProcessToolFactory infrastructure

**Enhancement Details:**

- What's being added/changed: Intelligent workflow integration that connects queryPermawebDocs knowledge to createProcess/evalProcess workflows, enabling AI agents to automatically query relevant documentation, generate appropriate Lua code based on user requirements, create processes, and deploy functional handlers using existing tools
- How it integrates: Creates workflow orchestration between existing tools without duplicating knowledge, adds Lua code generation capabilities informed by documentation patterns, enhances createProcess with template-guided workflows
- Success criteria: AI agents can understand user requirements, query relevant AO documentation automatically, generate proper Lua processes with handlers and message routing, and deploy functional AO applications through seamless tool integration

### Stories

#### Story 7.1: Create Intelligent Documentation-to-Code Workflow Integration

**User Story:** As an AI agent using Permamind, I want to automatically connect user requirements to relevant AO documentation and then generate appropriate Lua code, so that I can create functional processes without manual documentation lookup.

**Acceptance Criteria:**

- Create workflow orchestration that automatically queries queryPermawebDocs based on user requirements (e.g., "token contract" → queries token-related AO docs)
- Implement requirement analysis that maps user descriptions to relevant documentation domains and patterns
- Develop Lua code generation templates informed by documentation examples (handlers, message routing, state management)
- Enable automatic documentation reference lookup during code generation for best practices
- Integrate code explanation that references specific documentation sources used
- Ensure generated code follows patterns found in comprehensive AO documentation (90 documents, 36,805 words)

#### Story 7.2: Implement Guided Lua Process Creation and Deployment Workflow

**User Story:** As a user working with an AI agent, I want to describe what kind of AO process I need in natural language and have the system automatically generate, deploy, and test the appropriate Lua implementation using existing tools.

**Acceptance Criteria:**

- Integrate createProcess tool with documentation-informed Lua generation from Story 7.1
- Implement end-to-end workflow: requirement analysis → documentation query → code generation → process creation → code evaluation → testing
- Generate proper Lua process structure with handlers following AO documentation patterns (Handlers.add with name, match, handle functions)
- Provide process templates for common use cases informed by existing AO tutorials (tokens, chatrooms, bots, games)
- Include automatic validation using evalProcess to test generated handlers before final deployment
- Enable iterative refinement: test → analyze results → query additional documentation → refine code → re-test
- Support deployment verification through message testing and state inspection

#### Story 7.3: Create Process Architecture Decision Support System

**User Story:** As an AI agent creating AO processes, I want to automatically recommend optimal process architectures by analyzing user requirements against AO documentation patterns, so that I can suggest appropriate handler designs, state management, and message routing strategies.

**Acceptance Criteria:**

- Implement architectural pattern analysis using existing AO documentation (process examples from 90 documents)
- Create decision logic that maps user requirements to documented architecture patterns (stateless vs stateful, single vs multi-process)
- Provide handler pattern recommendations based on documented message types and workflow examples
- Include state management guidance derived from AO tutorials and process examples
- Suggest error handling patterns found in existing AO documentation and best practices
- Enable architecture validation by querying documentation for similar implemented patterns
- Support architecture explanation with references to specific documentation sources and examples

#### Story 7.4: Implement Seamless Tool Integration for Complete Process Development

**User Story:** As a user, I want the AI agent to seamlessly orchestrate all available tools (documentation queries, process creation, code evaluation) so that describing my process needs results in a functional, tested, and deployed AO process.

**Acceptance Criteria:**

- Create workflow orchestration that seamlessly connects queryPermawebDocs → createProcess → evalProcess → testing
- Enable automatic tool selection based on workflow stage (documentation lookup → code generation → process spawning → code deployment)
- Implement state management across tools to maintain context throughout the process creation workflow
- Support both guided creation (step-by-step with user feedback) and autonomous creation (fully automated from requirements)
- Provide comprehensive process creation reporting that includes documentation sources used, code generated, processes created, and test results
- Enable workflow resumption and iterative improvement (modify requirements → re-query docs → regenerate code → re-deploy)
- Support workflow templates for common process types that leverage documented AO patterns

### Definition of Done

- [ ] Intelligent workflow integration connecting queryPermawebDocs to createProcess/evalProcess workflows implemented
- [ ] Automatic documentation query system based on user requirements implemented
- [ ] Lua code generation templates informed by existing AO documentation patterns (handlers, message routing, state management)
- [ ] End-to-end guided process creation workflow: requirement analysis → documentation query → code generation → process creation → evaluation → testing
- [ ] Process architecture decision support system using documented AO patterns and examples
- [ ] Seamless tool orchestration enabling complete process development through natural language requests
- [ ] AI agents can automatically generate, deploy, and test functional AO processes from user descriptions
- [ ] Generated processes follow documented AO best practices (Handlers.add patterns, proper message handling, state management)
- [ ] Workflow supports iterative development with automatic documentation reference and code refinement
- [ ] Integration maintains full compatibility with existing queryPermawebDocs, createProcess, and evalProcess functionality
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

---

## Epic 8: AO Process Communication ADP Migration Epic - Brownfield Enhancement

### Epic Goal

Migrate Permamind's AO process communication system from fragile markdown parsing to the standardized AO Documentation Protocol (ADP) for reliable, structured process discovery and interaction while simplifying ProcessCommunicationService architecture.

### Epic Description

**Existing System Context:**

- Current functionality: AO process communication through executeAction tool using complex markdown parsing and ProcessCommunicationService with mixed responsibilities for discovery, parsing, validation, and communication
- Technology stack: TypeScript + FastMCP + AO Connect + existing DocumentationProtocolService with full ADP v1.0 implementation
- Integration points: ExecuteActionCommand, ProcessCommunicationService, DocumentationProtocolService, existing process communication infrastructure

**Enhancement Details:**

- What's being added/changed: Replace markdown-based process discovery with ADP Info queries, refactor ProcessCommunicationService to separate ADP and legacy communication paths, implement ADP-first architecture with graceful legacy fallback
- How it integrates: Leverages existing DocumentationProtocolService ADP implementation, maintains backward compatibility with non-ADP processes, simplifies service architecture through clear separation of concerns
- Success criteria: Reliable process communication using structured ADP data instead of fragile markdown parsing, simplified service architecture, improved error handling, maintained backward compatibility

### Stories

#### Story 8.1: Migrate ExecuteAction Tool to AO Documentation Protocol (ADP)

**User Story:** As a user, I want the executeAction tool to use the AO Documentation Protocol (ADP) for process discovery and communication so that I get reliable, standardized process interaction instead of fragile markdown parsing.

**Acceptance Criteria:**

- executeAction tool queries processes using ADP Info requests to discover capabilities
- Tool parses ADP-compliant responses using DocumentationProtocolService
- Tool validates parameters using ADP handler metadata before sending messages
- Tool generates message tags using ADP-structured handler definitions
- Tool gracefully falls back to legacy markdown parsing for non-ADP processes
- Tool caches ADP responses for improved performance

#### Story 8.2: Refactor ProcessCommunicationService Legacy Architecture

**User Story:** As a developer, I want the ProcessCommunicationService to be simplified and modernized so that process communication is more reliable and maintainable with clear separation between ADP and legacy approaches.

**Acceptance Criteria:**

- Simplify ProcessCommunicationService by removing complex markdown parsing logic
- Create clear separation between ADP-based and legacy process communication paths
- Reduce service complexity and improve error handling
- Maintain backward compatibility for existing integrations
- Improve performance by reducing unnecessary processing overhead
- Add comprehensive test coverage for refactored service

#### Story 8.3: Enhance GenerateLuaProcess Tool with Domain-Specific Functional Code Generation

**User Story:** As a user requesting specific AO process functionality, I want the generateLuaProcess tool to create proper domain-specific functional code instead of generic templates so that I receive working implementations that match my exact requirements.

**Acceptance Criteria:**

- Generate domain-specific handler code that implements requested functionality (e.g., calculator with addition/subtraction generates actual math operations)
- Replace generic "Handler" templates with functional, requirement-specific code
- Improve requirement analysis to detect specific mathematical, business logic, or functional patterns
- Add domain-specific code templates for common functional requirements (calculator, counter, simple database, etc.)
- Ensure generated code includes proper parameter validation and error handling for domain-specific operations
- Maintain ADP compliance and comprehensive handler metadata for all generated functional code

#### Story 8.4: Fix ExecuteAction ADP Integration Issues - Brownfield Fix

**User Story:** As a user, I want the executeAction tool to successfully communicate with deployed AO processes so that I can interact with my processes through natural language instead of receiving "Could not match request to any available handler" errors.

**Acceptance Criteria:**

- executeAction tool successfully discovers handlers from deployed AO processes
- Natural language requests correctly map to available process handlers
- Tool can communicate with both ADP-compliant and non-ADP processes
- Clear error messages when processes don't have requested handlers
- Process Info queries return proper ADP metadata for discovery

#### Story 8.5: Ensure Generated Processes are ADP-Compliant - Brownfield Fix

**User Story:** As a user creating AO processes via evalProcess, I want my deployed processes to be ADP-compliant so that the executeAction tool can discover and communicate with them successfully.

**Acceptance Criteria:**

- Processes deployed via evalProcess include proper ADP Info handler
- Info handler returns valid ADP v1.0 compliant metadata structure
- ADP metadata includes complete handler registry with actions, parameters, descriptions
- Generated processes include protocolVersion: "1.0" for ADP detection
- Handler metadata format matches DocumentationProtocolService parsing expectations

### Compatibility Requirements

- [ ] Existing executeAction API remains unchanged for consumers
- [ ] ADP and legacy processes both supported seamlessly
- [ ] ProcessCommunicationService interface maintains backward compatibility
- [ ] No regression in process communication capabilities
- [ ] Existing process tools continue to work without modification

### Risk Mitigation

- **Primary Risk:** Breaking existing process communication workflows during migration
- **Mitigation:** Implement ADP-first architecture with robust legacy fallback, comprehensive testing, and phased rollout
- **Rollback Plan:** Maintain original markdown parsing logic as fallback path, feature flags for ADP vs legacy selection

### Definition of Done

- [x] **Story 8.1**: executeAction tool uses ADP for process discovery with legacy fallback (DONE - but requires debugging)
- [x] **Story 8.2**: ProcessCommunicationService refactored with clear ADP/legacy separation (DONE)
- [ ] **Story 8.3**: generateLuaProcess creates domain-specific functional code instead of generic templates
- [ ] **Story 8.4**: executeAction ADP integration issues resolved - tool successfully communicates with deployed processes
- [ ] **Story 8.5**: Generated/deployed processes are ADP-compliant and discoverable by executeAction
- [ ] Parameter validation using ADP metadata implemented and working
- [ ] Message generation from ADP handler definitions implemented and working
- [ ] ADP response caching implemented for performance
- [ ] Legacy fallback maintains full backward compatibility
- [ ] Comprehensive test coverage for both ADP and legacy paths
- [ ] Performance improvements documented and measured
- [ ] **Critical**: Full workflow works - generateLuaProcess → spawnProcess → evalProcess → executeAction
- [ ] **QA Validation**: Calculator process example works end-to-end with natural language requests
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

---

## Epic 9: ADP Parameter Translation Quality Issues Epic - Brownfield Enhancement

### Epic Goal

Fix critical quality issues in ADP (AO Documentation Protocol) parameter translation system to ensure reliable natural language to AO process communication, eliminating parameter parsing failures and providing robust error handling for process interactions.

### Epic Description

**Existing System Context:**

- Current functionality: executeAction tool uses ADP system for natural language to AO process communication, but parameter translation layer frequently fails to map natural language requests to proper AO message tag structures
- Technology stack: TypeScript + FastMCP + AO Connect + existing ADPProcessCommunicationService + DocumentationProtocolService
- Integration points: ExecuteActionCommand, ADPProcessCommunicationService, parameter extraction logic, tag generation for AO messaging

**Enhancement Details:**

- What's being added/changed: Fix parameter translation failures, improve natural language processing for AO message tag generation, add comprehensive parameter validation and logging, implement fallback mechanisms for parsing failures
- How it integrates: Enhances existing ADPProcessCommunicationService without breaking API contracts, improves parameter extraction reliability, adds debugging capabilities to identify translation failures
- Success criteria: Natural language requests like "Add 5 and 3" correctly map to AO process tags (A=5, B=3), elimination of "Invalid input" errors from proper processes, consistent behavior across different operation types

### Stories

#### Story 9.1: Fix Parameter Extraction and Translation Logic

**User Story:** As a user of the executeAction tool, I want my natural language requests to be correctly translated into AO process parameters so that mathematical and operational commands work reliably without parameter parsing errors.

**Acceptance Criteria:**

- Fix parameter extraction logic to correctly parse natural language patterns (e.g., "Add 5 and 3" → A=5, B=3)
- Implement robust pattern matching for mathematical operations, assignments, and common process interactions
- Add comprehensive unit tests for parameter extraction with various natural language formats
- Ensure extracted parameters are properly validated before message generation
- Support multiple parameter formats and flexible natural language variations
- Fix inconsistent default value handling that causes unexpected results (e.g., subtraction returning "1234")

#### Story 9.2: Implement Parameter Validation and Error Handling

**User Story:** As a developer debugging AO process communication, I want comprehensive logging and validation of parameter translation so that I can identify and fix communication failures quickly.

**Acceptance Criteria:**

- Add detailed logging for each step of parameter translation: raw request → extracted parameters → generated tags
- Implement parameter validation middleware that catches translation failures before sending messages
- Provide clear, actionable error messages when parameter extraction fails
- Add contract testing to ensure parameter formats match process handler expectations
- Implement retry mechanisms for failed parameter extractions with alternative parsing strategies
- Create debugging tools to validate parameter translation against known process schemas

#### Story 9.3: Design Fallback Mechanisms and Alternative Input Methods

**User Story:** As a user experiencing parameter translation failures, I want the system to have fallback mechanisms so that I can still interact with processes even when natural language parsing fails.

**Acceptance Criteria:**

- Implement fallback parameter parsing using message Data field when tag-based extraction fails
- Support direct parameter specification format as backup (e.g., "A=5 B=3" when "5 and 3" fails)
- Add alternative input methods for complex parameter structures
- Implement graceful degradation when natural language processing encounters unknown patterns
- Provide user guidance for alternative input formats when automatic translation fails
- Create process-specific parameter format detection based on ADP metadata

### Compatibility Requirements

- [ ] Existing executeAction API remains unchanged for consumers
- [ ] ADPProcessCommunicationService interface maintains backward compatibility
- [ ] No regression in successful parameter translations
- [ ] ADP and legacy process communication continue to work
- [ ] DocumentationProtocolService integration preserved

### Risk Mitigation

- **Primary Risk:** Breaking existing working parameter translations during fix implementation
- **Mitigation:** Comprehensive testing of existing successful cases, feature flags for new parameter extraction logic, extensive unit test coverage
- **Rollback Plan:** Maintain original parameter extraction logic as fallback, ability to disable new translation improvements via configuration

### Definition of Done

- [ ] Story 9.1: Parameter extraction logic fixed with comprehensive test coverage for natural language patterns
- [ ] Story 9.2: Parameter validation and error handling implemented with detailed logging and debugging capabilities
- [ ] Story 9.3: Fallback mechanisms and alternative input methods implemented and tested
- [ ] Natural language requests like "Add 5 and 3" correctly generate tags A=5, B=3 for calculator processes
- [ ] Elimination of "Invalid input" errors when proper numeric values are provided in natural language
- [ ] Consistent behavior across all mathematical and operational request types
- [ ] Parameter translation failures provide clear error messages with suggested alternatives
- [ ] No regression in existing successful parameter extractions or process communication
- [ ] Comprehensive unit and integration test coverage for all parameter translation scenarios
- [ ] QA validation confirms end-to-end calculator process communication works with natural language
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

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

### Phase 6: Lua Process Creation Enhancement (Documentation-Driven Development)

1. Enhance documentation tools with comprehensive AO/Lua development knowledge
2. Create intelligent Lua process creation workflow with template integration
3. Implement process architecture guidance system
4. Integrate documentation-driven process creation for AI agents

### Phase 7: Performance Optimization (Human Crypto Keys Enhancement)

1. Implement memory and disk caching system for key generation
2. Create worker thread architecture for non-blocking key generation
3. Explore custom implementation alternatives using Node.js native crypto
4. Achieve 75%+ performance improvement while maintaining security

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

### Human Crypto Keys Performance Optimization Success

- Key generation latency reduced by 75%+ from 2-30 seconds to <500ms effective time
- Memory and disk caching system achieving >95% cache hit ratio for repeated mnemonics
- Worker thread architecture providing non-blocking key generation with progress feedback
- Custom implementation proof-of-concept evaluated with comprehensive security analysis
- Zero breaking changes to existing `getKeyFromMnemonic()` API surface
- Maintained 4096-bit RSA security requirements with enhanced performance characteristics

---

## Team Coordination

### Development Sequence

1. **Epic 1 (MVP Refactoring)** - Foundation simplification
2. **Epic 3 (Token NLS Migration)** - Enhanced user experience
3. **Epic 5 (AO Process Management Tools)** - Core infrastructure expansion
4. **Epic 8 (AO Process Communication ADP Migration)** - Standardized process communication infrastructure
5. **Epic 9 (ADP Parameter Translation Quality Issues)** - Critical bug fixes for process communication
6. **Epic 7 (Lua Process Creation and Documentation Enhancement)** - AI agent development capabilities
7. **Epic 6 (Human Crypto Keys Performance Optimization)** - Critical performance enhancement
8. **Epic 2 (BMAD Integration)** - Advanced development capabilities
9. **Epic 4 (Agent UX Enhancement)** - File-based agents and memory sharing (Stories 4.2, 4.3)

### Quality Gates

- Each epic must pass full test suite before proceeding
- Integration testing between epic implementations
- Performance validation at each phase
- Documentation updates for each completed epic

This consolidated roadmap ensures systematic enhancement of Permamind while maintaining system integrity and providing clear development priorities.
