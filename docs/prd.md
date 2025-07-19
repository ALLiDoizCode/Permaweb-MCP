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

## Future Enhancement: Agent UX Revolution

The MVP provides the foundation for revolutionary agent collaboration features:

### Post-MVP Vision
- **Claude Desktop**: Project conversations with agent role names (PM, Dev, UX) automatically activate specialist agents
- **Claude Code**: File-based agent detection with persistent `.bmad/` project state
- **Unified Intelligence**: Single Permamind hub enables cross-agent context sharing and team collaboration

### MVP Foundation Enables
- **Memory System**: Essential for agent context sharing and handoffs
- **AO Integration**: Required for persistent agent state and workflow coordination  
- **MCP Architecture**: Framework for expanding into agent orchestration tools

The 3-3-3 MVP establishes the core infrastructure that will power collaborative AI teams in future releases.

---

## Related Documentation

- **[Architecture Details](./architecture.md)** - Technical architecture and system design
- **[Implementation Epics](./consolidated-epics.md)** - Development roadmap and epic breakdown
- **[Development Stories](./stories/)** - Detailed implementation stories and acceptance criteria
