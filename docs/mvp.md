# Permamind MVP: The 3-3-3 Rule

## Executive Summary

Permamind makes blockchain interaction as simple as conversation. Talk to AO processes in natural language while you own your context permanently on AO.

**The 3-3-3 MVP Rule:**

- **3 NLS Documents**: AO Token, AO Hello, permawebDocs
- **3 MCP Tools**: talkToProcess, searchMemory, storeMemory
- **3 User Flows**: Token Management, Process Exploration, Memory Interaction

## Problem

AI users avoid blockchain because it's too complex. No natural language interface + no persistent context = missed opportunities.

## Solution

**Natural Language Service (NLS) Protocol** - describe blockchain services in human language, not code.

**Core Value:**

- Say "check my balance" instead of learning AO syntax
- Own your interaction context permanently on AO
- Works in Claude Desktop today

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

## MVP Scope

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
