# Epic 8: BMad METHOD Integration Epic - Permaweb Development Platform

## Epic Goal

Transform Permamind from a memory layer tool into a comprehensive Permaweb development platform by integrating the BMad METHOD as an expansion pack, creating a trusted agentic development environment for building and deploying Permaweb applications from concept to production.

## Epic Description

**Existing System Context:**

- Current functionality: Permamind MCP server with process management (spawnProcess, evalProcess, executeAction), memory system, and comprehensive Permaweb documentation (queryPermawebDocs)
- Technology stack: FastMCP + TypeScript + AO Connect + existing tool infrastructure + BMad METHOD framework
- Integration points: MCP tool registry, existing process communication services, memory management, documentation system

**Enhancement Details:**

- What's being added/changed: Complete BMad METHOD integration as Permaweb expansion pack with enhanced agents and full development workflows accessible through natural language MCP interactions
- How it integrates: Extends existing MCP tool framework with BMad workflow execution, enhances existing agents with Permaweb expertise and tool awareness, leverages existing process management for AO deployment
- Success criteria: Developers can execute complete Permaweb development workflows from concept to deployment through natural language interactions with streamlined agentic development

## Key Innovation: Agentic Development Environment

Combines BMad's proven development methodology with Permamind's AO integration capabilities, creating a trusted environment where AI agents can seamlessly execute complete development workflows from requirements through deployment.

## Stories

### Story 8.1: Basic MCP Tools Implementation

**User Story:** As a developer using Permamind, I want to execute BMad workflows through natural language MCP commands so that I can leverage proven development methodology for Permaweb projects.

**Acceptance Criteria:**

- Implement `executeBmadWorkflow` MCP tool supporting permaweb-fullstack, greenfield-fullstack, and brownfield-fullstack workflows
- Create `invokeAgent` MCP tool for individual BMad agent interaction with file I/O and minimal context handoffs
- Implement `executeTask` MCP tool for specific BMad task execution with input/output file management
- Enable file-based document generation (docs/, src/, processes/) with minimal context usage
- Support workflow execution with proper error handling and status reporting

### Story 8.2: BMad Agent Enhancement

**User Story:** As a developer using BMad agents, I want enhanced agents that understand Permamind tools so that I can seamlessly integrate BMad methodology with AO development capabilities.

**Acceptance Criteria:**

- Enhance existing BMad agents (analyst, pm, architect, dev, qa, po, sm) with explicit Permamind tool awareness
- Enable agents to use spawnProcess, evalProcess, executeAction, queryPermawebDocs, addMemory tools
- Implement agent handoffs using file references and summary context, not full document content
- Update agent personas with Permaweb development context and best practices
- Ensure agents can collaborate effectively across the development lifecycle

### Story 8.3: Workflow Definition & Natural Language Routing

**User Story:** As a developer, I want natural language request routing and Permaweb-specific workflows so that I can efficiently navigate between different development tasks and agents.

**Acceptance Criteria:**

- Create `permaweb-fullstack.yaml` workflow definition extending greenfield-fullstack with AO-specific development steps
- Implement natural language request routing: "implement story 1.1" → dev agent, "validate story 1.1" → qa agent
- Enable workflow-aware context switching and agent handoffs
- Support both guided and autonomous workflow execution modes
- Provide clear workflow status and progress tracking

### Story 8.4: AO Development Specialists

**User Story:** As a developer building AO processes, I want specialized Permaweb agents that understand AO architecture so that I can build robust AO applications with expert guidance.

**Acceptance Criteria:**

- Create enhanced `ao-developer.md` agent with AO Lua expertise and comprehensive tool awareness
- Implement new `permaweb-qa.md` specialist agent for AO process testing and validation
- Enable agents to directly use existing Permamind MCP tools for process lifecycle management
- Support both guided development (with user interaction) and autonomous development workflows
- Provide AO-specific development patterns and best practices guidance

### Story 8.5: aolite Testing Framework Integration

**User Story:** As a developer testing AO processes, I want integrated testing capabilities so that I can validate my processes locally before deployment.

**Acceptance Criteria:**

- Integrate aolite testing framework for local concurrent process testing
- Enable message queue validation and state consistency verification
- Support automated test generation based on process specifications
- Provide test reporting and failure analysis capabilities
- Enable continuous testing during development workflows

### Story 8.6: Basic Deployment Pipeline

**User Story:** As a developer, I want a streamlined deployment pipeline so that I can move from local testing to live AO processes with confidence.

**Acceptance Criteria:**

- Implement automated deployment pipeline: aolite local testing → spawnProcess → evalProcess → executeAction validation
- Enable deployment validation and rollback capabilities
- Support documentation generation via addMemory for deployment records
- Provide deployment status tracking and error handling
- Enable both manual and automated deployment workflows

## Technical Architecture

### BMad Expansion Pack Structure

```
.bmad-core/
├── agents/                           # Permaweb-enhanced BMad agents
│   ├── ao-developer.md              # AO Lua development specialist
│   ├── permaweb-qa.md               # AO process testing expert
│   ├── analyst.md                   # Enhanced with Permaweb context
│   ├── architect.md                 # Enhanced with AO architectural patterns
│   └── [all other BMad agents]     # Enhanced with tool awareness
├── workflows/
│   ├── permaweb-fullstack.yaml     # Complete Permaweb dApp workflow
│   └── [existing BMad workflows]   # Preserved and enhanced
├── tasks/                           # Permaweb-specific development tasks
├── checklists/                      # AO deployment quality gates
└── data/                           # Permaweb development patterns and insights
```

### MCP Tool Integration Points

```
New BMad Tools:
├── executeBmadWorkflow              # Execute complete development workflows
├── invokeAgent                      # Individual agent interaction
└── executeTask                      # Specific task execution

Enhanced Agent Tool Awareness:
├── spawnProcess                     # Create AO processes for development/testing
├── evalProcess                      # Deploy Lua code to processes
├── executeAction                    # Test and interact with processes
├── queryPermawebDocs               # Access architectural knowledge
├── addMemory                       # Store patterns and insights
└── searchMemoriesAdvanced          # Retrieve relevant context
```

### Context Window Efficiency (Preserved)

- **File-Based I/O**: Agents read/write project files, not context content
- **Minimal Handoffs**: Agent transitions use file references + summary context
- **Document Sharding**: Stories broken into implementable development chunks
- **Tool Results**: Return file paths and summaries, not full content

## Success Criteria

### Developer Experience Metrics

- **Time to Deployment**: < 30 minutes from concept to live AO process
- **Learning Curve Reduction**: 70% faster Permaweb onboarding vs manual development
- **Code Quality**: 95%+ aolite test pass rate on first deployment
- **Workflow Efficiency**: Complete permaweb-fullstack workflow under 45 minutes

### Platform Adoption Metrics

- **Developer Velocity**: Significant increase in Permaweb project completion rate
- **Cross-Ecosystem Migration**: Smooth developer transition from other Web3 platforms
- **Ecosystem Growth**: Increased developer adoption of Permaweb due to reduced complexity

### Technical Performance Metrics

- **Context Efficiency**: File-based approach maintains <10% context window usage
- **Tool Integration**: Seamless orchestration of all Permamind MCP tools
- **Workflow Execution**: Reliable end-to-end concept → code → test → deploy pipeline

## Integration with Existing Epics

### Builds on Foundation Epics

- **Epic 1 (MVP Refactoring)**: Uses simplified tool architecture as foundation
- **Epic 3 (Token NLS Migration)**: Leverages executeAction for token operations in development workflows
- **Epic 5 (AO Process Management)**: Essential dependency - uses createProcess and evalProcess extensively
- **Epic 7 (Lua Process Creation)**: Extends with BMad methodology for structured development

### Preserves System Architecture

- **Memory System**: Uses existing addMemory/searchMemoriesAdvanced for pattern storage
- **Process Management**: Builds on proven spawnProcess/evalProcess infrastructure
- **Documentation**: Extends queryPermawebDocs for development guidance
- **MCP Framework**: Natural extension of existing tool registration patterns

## Implementation Strategy

### Phase-Gate Approach with Dependencies

- **Phase 1**: Core BMad integration (Stories 8.1-8.3) - requires Epic 5 completion
- **Phase 2**: AO development tools (Stories 8.4-8.6) - requires Phase 1 + Epic 7 completion

### Risk Mitigation

- **MVP Foundation First**: Ensure Epic 1, 3, 5, 7 complete before BMad integration
- **Incremental Value**: Each story provides standalone developer value
- **Backward Compatibility**: Preserve all existing Permamind functionality

## Definition of Done

- [ ] Core BMad integration: executeBmadWorkflow, invokeAgent, executeTask tools implemented
- [ ] Enhanced agents with Permamind tool awareness and Permaweb expertise
- [ ] permaweb-fullstack.yaml workflow supporting concept-to-deployment development
- [ ] Natural language request routing working for all BMad agent interactions
- [ ] AO development specialists: ao-developer, permaweb-qa agents operational
- [ ] aolite integration providing local testing with live deployment pipeline
- [ ] Basic deployment pipeline: local testing → spawn → eval → validate
- [ ] File-based document generation preserving context window efficiency
- [ ] Zero regression in existing Permamind functionality
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [ ] End-to-end validation: concept → code → test → deploy workflow

## Dependencies

### Epic Dependencies (Must Complete First)

1. **Epic 5**: AO Process Management Tools - **REQUIRED**
   - `createProcess` and `evalProcess` tools needed for deployment pipeline
   - Process lifecycle management essential for AO development workflows

2. **Epic 7**: Lua Process Creation and Documentation Enhancement - **REQUIRED**
   - Comprehensive AO documentation system needed for agent guidance
   - `queryPermawebDocs` must have full knowledge base for development patterns

### Technical Infrastructure Dependencies

1. **Memory System Enhancement** - Enhanced `addMemory`/`searchMemoriesAdvanced` for pattern storage
2. **Documentation System** - Robust `queryPermawebDocs` with comprehensive AO knowledge
3. **File-Based Workflow System** - BMad methodology files and workflow definitions

This epic represents the culmination of Permamind's evolution from a memory layer tool into a comprehensive Permaweb development platform, providing developers with a trusted agentic environment for building robust AO applications.
