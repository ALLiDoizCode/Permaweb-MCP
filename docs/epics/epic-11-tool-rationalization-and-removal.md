# Epic 11: Tool Rationalization and Removal - Brownfield Enhancement

## Epic Goal

Streamline the Permamind MCP server by removing 22 out-of-scope tools (59.5% reduction) to focus the platform on core AO process management, Arweave deployment, wallet operations, and ArNS domain management capabilities.

## Epic Description

**Existing System Context:**

- Current functionality: Full MCP server with 37 tools across 8 categories (Memory, Contact, Process, Token, Documentation, Hub, User, ArNS)
- Technology stack: FastMCP + TypeScript + Node.js 20+ + AO Connect + Arweave
- Integration points: Tool registry, server initialization, factory pattern for tool registration, comprehensive service layer, test suites for all categories

**Enhancement Details:**

- What's being added/changed: Remove 22 out-of-scope tools (Memory: 2, Contact: 2, Hub: 3, Token: 8, advanced Process: 5, Documentation query: 2), keep 15 core tools (Process: 3, Arweave: 4, User: 2, ArNS: 6), rename Documentation category to Arweave
- How it integrates: Remove tool factory registrations from server.ts, delete tool directories and commands, remove associated services, maintain existing patterns for kept tools
- Success criteria: 15 focused tools supporting core AO process management, Arweave deployment, wallet operations, and ArNS domains with all tests passing and clean codebase

## Stories

### Story 11.1: Remove Memory, Contact, and Hub Tool Categories

**Acceptance Criteria:**

- Delete complete `src/tools/memory/` directory including MemoryToolFactory and all commands (AddMemoryCommand, SearchMemoriesCommand)
- Delete complete `src/tools/contact/` directory including ContactToolFactory and all commands (SaveAddressMappingCommand, ListContactsCommand)
- Delete complete `src/tools/hub/` directory including HubToolFactory and all commands (CreateHubCommand, GetHubCommand, InitializeHubCommand)
- Remove MemoryToolFactory, ContactToolFactory, and HubToolFactory registrations from `src/server.ts`
- Remove associated service dependencies (analyze for shared usage first)
- Remove/update tests for deleted tool categories
- Verify server starts successfully after deletions
- Run `npm run type-check` and `npm run test` to verify no broken imports

### Story 11.2: Remove Token Tool Category

**Acceptance Criteria:**

- Delete complete `src/tools/token/` directory including TokenToolFactory and all 8 commands (CreateTokenCommand, GetTokenBalanceCommand, GetTokenBalancesCommand, GetTokenInfoCommand, ListTokensCommand, MintTokenCommand, SaveTokenMappingCommand, TransferTokensCommand)
- Remove TokenToolFactory registration from `src/server.ts`
- Remove TokenProcessTemplateService references and embedded token template initialization
- Remove token template from embeddedTemplates Map in server initialization
- Remove associated service dependencies (analyze for shared usage first)
- Remove/update tests for token tools
- Verify server starts successfully after deletions
- Run `npm run type-check` and `npm run test` to verify no broken imports

### Story 11.3: Remove Advanced Process Tools

**Acceptance Criteria:**

- Delete command files: AnalyzeProcessArchitectureCommand, ExecuteActionCommand, GenerateLuaProcessCommand, ValidateDeploymentCommand, RollbackDeploymentCommand
- Update ProcessToolFactory.getToolClasses() to only return: SpawnProcessCommand, EvalProcessCommand, QueryAOProcessMessagesCommand
- Verify kept process tools (spawnProcess, evalProcess, queryAOProcessMessages) still function correctly
- Remove/update tests for deleted commands
- Preserve all tests for kept process commands
- Run `npm run type-check` and `npm run test` to verify functionality
- Verify AO process lifecycle (spawn → eval → query) works end-to-end

### Story 11.4: Refactor Documentation Tools to Arweave Tools

**Acceptance Criteria:**

- Delete QueryPermawebDocsCommand and ManagePermawebDocsCacheCommand files
- Rename directory: `src/tools/documentation/` → `src/tools/arweave/`
- Rename class: DocumentationToolFactory → ArweaveToolFactory
- Update ArweaveToolFactory.getToolClasses() to only return: DeployPermawebDirectoryCommand, CheckPermawebDeployPrerequisitesCommand, UploadToArweaveCommand, UploadFolderToArweaveCommand
- Update imports in `src/server.ts` from DocumentationToolFactory to ArweaveToolFactory
- Update factory registration in server.ts with new category name "Arweave" and description
- Update all test files for renamed factory and directory
- Verify kept Arweave deployment tools function correctly
- Run `npm run type-check` and `npm run test` to verify all changes

### Story 11.5: Final Cleanup and Documentation

**Acceptance Criteria:**

- Analyze and remove any orphaned service files that are no longer used by remaining tools
- Remove unused imports and dependencies from package.json (if any)
- Update CLAUDE.md with new 15-tool inventory (Process: 3, Arweave: 4, User: 2, ArNS: 6)
- Update README.md if it references removed tools
- Run full test suite: `npm run test` with all tests passing
- Run type checking: `npm run type-check` with no errors
- Run linting: `npm run lint` with no errors
- Run full CI quality checks: `npm run ci:quality` with all gates passing
- Verify MCP server starts successfully with stdio transport
- Manually verify MCP client can connect and invoke at least one tool from each remaining category
- Document removed tools list in epic for future reference

## Definition of Done

- [x] All 22 tools successfully removed from codebase (Memory: 2, Contact: 2, Hub: 3, Token: 8, Process advanced: 5, Documentation query: 2)
- [x] 15 core tools remain functional (Process: 3, Arweave: 4, User: 2, ArNS: 6)
- [x] Documentation category renamed to Arweave with updated factory and imports
- [x] All factory registrations updated in `src/server.ts`
- [x] No unused imports, orphaned services, or dead code remain (36 orphaned services deleted)
- [x] All tests passing for remaining tools (core quality gates passing)
- [x] Build passes: `npm run build && npm run lint && npm run type-check` (all passing)
- [x] Full CI quality checks pass: `npm run ci:quality` (passing)
- [x] Server starts successfully and MCP client can invoke remaining tools
- [x] CLAUDE.md updated with new 15-tool inventory
- [x] No regression in kept functionality (AO processes, Arweave deployment, wallet operations, ArNS domains)

---

## Epic Completion Summary

### Tools Removed (22 Total)

**Memory Tools (2):**

- AddMemoryCommand
- SearchMemoriesCommand

**Contact Tools (2):**

- SaveAddressMappingCommand
- ListContactsCommand

**Hub Tools (3):**

- CreateHubCommand
- GetHubCommand
- InitializeHubCommand

**Token Tools (8):**

- CreateTokenCommand
- GetTokenBalanceCommand
- GetTokenBalancesCommand
- GetTokenInfoCommand
- ListTokensCommand
- MintTokenCommand
- SaveTokenMappingCommand
- TransferTokensCommand

**Advanced Process Tools (5):**

- AnalyzeProcessArchitectureCommand
- ExecuteActionCommand
- GenerateLuaProcessCommand
- ValidateDeploymentCommand
- RollbackDeploymentCommand

**Documentation Query Tools (2):**

- QueryPermawebDocsCommand
- ManagePermawebDocsCacheCommand

### Services Removed (36 Total)

**AI Memory & Hub Services (3):**

- aiMemoryService.ts
- HubService.ts
- EncryptionService.ts

**Token Services (4):**

- SimpleTokenService.ts
- tokenservice.ts
- TokenLuaService.ts
- TokenProcessTemplateService.ts

**Process Architecture & Analysis Services (9):**

- ProcessArchitectureAnalysisService.ts
- ArchitectureDecisionService.ts
- ArchitectureExplanationService.ts
- ArchitectureValidationService.ts
- RequirementAnalysisService.ts
- HandlerPatternRecommendationService.ts
- StateManagementGuidanceService.ts
- ErrorHandlingPatternService.ts
- CodeExplanationService.ts

**Lua & Workflow Services (6):**

- LuaCodeGeneratorService.ts
- LuaWorkflowOrchestrationService.ts
- ParameterExtractionService.ts
- WorkflowAutomationService.ts
- WorkflowStateService.ts
- TeamAgentService.ts

**Teal/Compiler Services (2):**

- TealCompilerService.ts
- TealWorkflowService.ts

**Development Pipeline Services (5):**

- AODevelopmentPipelineService.ts
- AODevelopmentDocsService.ts
- AODevToolsCompatibilityService.ts
- AOLiteTestService.ts
- AOLiteVitestIntegration.ts

**Process Validation & Legacy Services (6):**

- ProcessValidationService.ts
- ProcessCreationReportService.ts
- LegacyProcessCommunicationService.ts
- ADPValidationService.ts
- PermawebDocsService.ts
- GitContextService.ts

**Additional Cleanup (1):**

- ArnsIntegrationService.ts (orphaned service)

### Dependencies Removed

**Unused NPM Packages (2):**

- chalk (not used in active code)
- yaml (not used in active code)

**Note:** `lodash` was initially identified as unused but restored after discovering it's a required dependency of `human-crypto-keys` package.

### Services Retained (12 Total)

**Core Infrastructure (3):**

- DefaultProcessService.ts
- ProcessCommunicationService.ts
- RegistryService.ts

**Process Operations (2):**

- ArweaveGraphQLService.ts
- ProcessCacheService.ts

**Arweave Deployment (2):**

- PermawebDeployService.ts
- TurboService.ts

**Service Dependencies (5):**

- ADPProcessCommunicationService.ts
- DocumentationProtocolService.ts
- ProcessDiscoveryService.ts
- HubLuaService.ts
- AOMessageService.ts (provides types used by ProcessCommunicationService)

### Final Statistics

- **Tools**: Reduced from 37 to 15 (59.5% reduction)
- **Services**: Reduced from 48 to 12 (75% reduction)
- **Tool Categories**: Reduced from 8 to 4 categories
- **Dependencies**: 2 unused packages removed (chalk, yaml)

### Documentation Updates

- CLAUDE.md: Updated with 15-tool inventory, service layer documentation, and focused feature descriptions
- README.md: Updated feature sections to focus on core capabilities, removed references to removed features

---
