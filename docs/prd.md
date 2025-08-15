# Permamind Product Requirements Document

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MVP: The 3-3-3 Rule](#mvp-the-3-3-3-rule)
3. [Problem Statement](#problem-statement)
4. [Solution Architecture](#solution-architecture)
5. [MVP Scope & Implementation](#mvp-scope--implementation)
6. [Success Metrics](#success-metrics)
7. [Future Enhancement: Agent UX Revolution](#future-enhancement-agent-ux-revolution)

## Executive Summary

Permamind makes blockchain interaction as simple as conversation. Talk to AO processes in natural language while you own your context permanently on AO.

## MVP: The 3-3-3 Rule

**The 3-3-3 MVP Foundation:**

- **3 NLS Documents**: AO Token, AO Hello, permawebDocs
- **3 MCP Tools**: talkToProcess, searchMemory, storeMemory
- **3 User Flows**: Token Management, Process Exploration, Memory Interaction

## Problem Statement

AI users avoid blockchain because it's too complex. No natural language interface + no persistent context = missed opportunities.

## Solution Architecture

**Natural Language Service (NLS) Protocol** - describe blockchain services in human language, not code.

**Core Value:**

- Say "check my balance" instead of learning AO syntax
- Own your interaction context permanently on AO
- Works in Claude Desktop today
- **Foundation for AI Team Collaboration** - MVP enables future agent orchestration features

## The 3-3-3 Architecture

### 3 NLS Documents (Static Pattern Matching)

1. **AO Token Process** - "check balance", "send tokens", "mint tokens"
2. **AO Hello Process** - "test connection", "debug process", "verify status"
3. **permawebDocs** - "query docs", "search guides", "get examples"

### 3 MCP Tools (Core Functionality)

1. **talkToProcess** - Natural language → AO messages
2. **searchMemory** - Find past interactions
3. **storeMemory** - Save context permanently

### 3 User Flows (Success Proof)

1. **Token Management**: "What's my balance?" → "Send 100 tokens to ABC123"
2. **Process Exploration**: "How do I use permawebDocs?" → Examples & docs
3. **Memory Interaction**: "What tokens did I send yesterday?" → Context retrieval

## Success Metrics

- **90%** natural language accuracy
- **95%** AO message success rate
- **80%** user task completion
- **<2 sec** response time

## MVP Scope & Implementation

### Must Have (The 3-3-3 Only)

- **3 Static NLS Documents**: Hardcoded for Token, Hello, permawebDocs
- **3 MCP Tools**: talkToProcess, searchMemory, storeMemory
- **3 User Workflows**: Token ops, process exploration, context search
- **Regex Pattern Matching**: Simple intent recognition
- **AO Context Storage**: Permanent composable storage of all interactions
- **Claude Desktop**: Seamless MCP integration

### Out of Scope

- Dynamic NLS loading
- Advanced ML processing
- Multi-protocol support
- Mobile apps
- Enterprise features
- **Agent UX orchestration** (planned for post-MVP enhancement)
- **Dual-platform collaboration** (builds on MVP foundation)
- **Workflow-aware personas** (requires MVP memory system)

## Implementation Plan

### Tech Stack

- **FastMCP** + TypeScript + Node.js 20+
- **AO Connect** for process communication
- **AO** for permanent composable context storage
- **Claude Desktop** MCP integration

### 12-Week Timeline

- **Weeks 1-4**: Foundation (NLS docs, pattern matcher, context storage)
- **Weeks 5-8**: Integration (MCP tools, Claude Desktop)
- **Weeks 9-12**: Launch (testing, polish, validation)

### Team

- 1 Lead Developer (AO expert)
- 1 Backend Developer (Node.js/TypeScript)
- 0.5 DevOps Engineer

## Success Definition

MVP succeeds when users can:

1. Ask "What's my token balance?" and get an answer
2. Say "Send 100 tokens to XYZ" and it works
3. Query "What did I do yesterday?" and retrieve owned context

**All with 90% accuracy, 95% success rate, <2 second response time.**

## Epic 8: BMad METHOD Integration - Permaweb Development Platform

**Status**: Planned Enhancement  
**Dependencies**: Epic 1-7 (3-3-3 MVP Foundation)  
**Timeline**: Post-MVP Implementation

### Vision: Complete Permaweb Development Platform

Transform Permamind from a memory layer tool into a comprehensive Permaweb development platform by integrating the BMad METHOD as an expansion pack. This creates a trusted agentic development environment for building and deploying Permaweb applications from concept to production.

### Key Innovation: Architectural Intelligence + Agentic Development

Not just code generation, but teaching WHY certain patterns work better in AO's actor model vs other blockchain architectures. Combines BMad's proven development methodology with Permamind's AO integration capabilities.

### Epic Scope

#### 8.1 Core BMad Integration (Phase 1)

- **New MCP Tools**: `executeBmadWorkflow`, `invokeAgent`, `executeTask`
- **Agent Enhancement**: Update BMad agents with Permamind tool awareness
- **Workflow Creation**: `permaweb-fullstack.yaml` workflow definition
- **Natural Language Routing**: "implement story 1.1" → dev agent

#### 8.2 AO Development Tools (Phase 2)

- **Enhanced Development**: `ao-developer.md` agent with AO Lua expertise
- **Specialized QA**: `permaweb-qa.md` agent with aolite testing integration
- **Deployment Pipeline**: aolite local testing → live AO process deployment
- **Tool Integration**: Direct use of `spawnProcess`, `evalProcess`, `executeAction`

#### 8.3 Architectural Intelligence (Phase 3)

- **Community Analysis**: GitHub/Discord mining for architectural insights
- **Pattern Reasoning**: Explain WHY forward tags > direct state changes
- **Cross-Ecosystem Bridging**: "This is like Ethereum's X but with Y difference"
- **Ecosystem Awareness**: Track evolving standards and community preferences

#### 8.4 Production Platform (Phase 4)

- **Deployment Specialist**: Production deployment and operations agent
- **Complete Pipeline**: Concept → PRD → Architecture → Code → Tests → Deployment
- **Community Contribution**: Feed successful patterns back to ecosystem
- **Enterprise Features**: Multi-process orchestration, monitoring, compliance

### Technical Architecture

#### BMad Expansion Pack Structure

```
.bmad-core/
├── agents/                  # Permaweb-enhanced BMad agents
│   ├── ao-developer.md     # AO Lua development specialist
│   ├── permaweb-qa.md      # AO process testing expert
│   └── deployment-specialist.md  # Production deployment agent
├── workflows/
│   └── permaweb-fullstack.yaml   # Complete Permaweb dApp workflow
├── tasks/                   # Permaweb-specific development tasks
└── checklists/             # AO deployment quality gates
```

#### Context Window Efficiency (Preserved)

- **File-Based I/O**: Agents read/write actual project files
- **Minimal Context**: Agent handoffs use summaries, not full content
- **Document Sharding**: Stories broken into implementable chunks
- **Tool Results**: File paths returned, not content

### Success Criteria

#### Developer Experience

- **Time to Deployment**: < 30 minutes from concept to live AO process
- **Learning Curve**: 70% faster Permaweb onboarding vs manual development
- **Code Quality**: 95%+ aolite test pass rate on first deployment
- **Architectural Alignment**: Developers understand WHY patterns work

#### Platform Adoption

- **Developer Velocity**: Significant increase in Permaweb project completion rate
- **Community Integration**: Successful patterns contributed back to ecosystem
- **Cross-Ecosystem Migration**: Developers successfully transition from other Web3 platforms

### Flagship Workflow: "Deploy Full-Stack Permaweb dApp"

**Complete End-to-End Development:**

1. **Planning**: `analyst` → Permaweb project brief with ecosystem positioning
2. **Requirements**: `pm` → PRD with AO-specific user stories and patterns
3. **Architecture**: `architect` → AO process design with WHY explanations
4. **Development**: `ao-developer` → Generate, test (aolite), deploy processes
5. **Validation**: `permaweb-qa` → Comprehensive testing and validation
6. **Production**: `deployment-specialist` → Live deployment with monitoring

**Result**: Working Permaweb dApp deployed to AO with full operational support.

### Integration with MVP Foundation

#### Builds on 3-3-3 Foundation

- **Memory System**: Stores architectural insights and successful patterns
- **Process Integration**: Uses existing `spawnProcess`, `evalProcess` tools
- **Documentation**: Leverages `queryPermawebDocs` for architectural context
- **MCP Architecture**: Extends tool framework for BMad workflow execution

#### Preserves MVP Simplicity

- BMad integration is an expansion pack, not core replacement
- 3-3-3 MVP remains focused and deliverable
- BMad features activate only when requested by developers
- Existing natural language interface preserved

### Implementation Strategy

#### Phase-Gate Approach

- **Phase 1**: Basic BMad workflow execution through MCP tools
- **Phase 2**: Full AO development capabilities with aolite testing
- **Phase 3**: Architectural intelligence and community insights
- **Phase 4**: Production-ready platform with operational support

#### Risk Mitigation

- **MVP First**: Deliver 3-3-3 foundation before BMad integration
- **Incremental Value**: Each phase provides standalone developer value
- **Community Validation**: Continuous feedback from Permaweb developer community
- **Technical Validation**: Extensive testing at each phase gate

## Future Enhancement: Agent UX Revolution

The MVP + BMad integration provides the foundation for revolutionary agent collaboration features:

### Post-MVP Vision

- **Claude Desktop**: Project conversations with agent role names (PM, Dev, UX) automatically activate specialist agents
- **Claude Code**: File-based agent detection with persistent `.bmad/` project state
- **Unified Intelligence**: Single Permamind hub enables cross-agent context sharing and team collaboration
- **Permaweb Development**: Complete agentic development platform for the permanent web

### MVP Foundation Enables

- **Memory System**: Essential for agent context sharing and handoffs
- **AO Integration**: Required for persistent agent state and workflow coordination
- **MCP Architecture**: Framework for expanding into agent orchestration tools
- **BMad Integration**: Proven development methodology for complex project orchestration

The 3-3-3 MVP establishes the core infrastructure that will power collaborative AI teams and comprehensive Permaweb development in future releases.

---

## Related Documentation

- **[Architecture Details](./architecture.md)** - Technical architecture and system design
- **[Implementation Epics](./consolidated-epics.md)** - Development roadmap and epic breakdown
- **[Development Stories](./stories/)** - Detailed implementation stories and acceptance criteria
