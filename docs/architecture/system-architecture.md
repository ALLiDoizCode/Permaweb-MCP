# System Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CLI[Claude Code CLI]
        IDE[IDE Extensions]
        API[API Clients]
    end

    subgraph "MCP Server Layer"
        MCP[FastMCP Server]
        TR[Tool Registry]
        TF[Tool Factories]
    end

    subgraph "Service Layer"
        MS[Memory Service]
        PCS[Process Communication Service]
        PDS[Permaweb Docs Service]
        TPS[Token Process Template Service]
        RS[Registry Service]
    end

    subgraph "AO Ecosystem"
        AOP[AO Processes]
        AOM[AO Messages]
        AOC[AO Connect]
    end

    subgraph "Arweave Network"
        AR[Arweave Blockchain]
        GW[Gateway Nodes]
        HUB[Hub Processes]
    end

    subgraph "External Resources"
        PD[Permaweb Docs]
        CACHE[Doc Cache]
        REG[Hub Registry]
    end

    CLI --> MCP
    IDE --> MCP
    API --> MCP

    MCP --> TR
    TR --> TF
    TF --> MS
    TF --> PCS
    TF --> PDS
    TF --> TPS

    MS --> AOP
    PCS --> AOM
    PCS --> AOC
    TPS --> AOP

    AOP --> AR
    AOM --> AR
    AOC --> GW

    PDS --> PD
    PDS --> CACHE
    RS --> REG

    AOP --> HUB
    HUB --> AR
```

## Technology Stack

### Core Technologies

- **TypeScript 5.8+** - Primary language with strict typing
- **FastMCP 1.27+** - TypeScript MCP server framework
- **Node.js 20+** - Runtime environment
- **AO Connect 0.0.85** - Interface to AO ecosystem
- **Arweave 1.15+** - Permanent data storage

### Development & Quality Assurance

- **Vitest 3.1+** - Testing framework with coverage
- **ESLint + Prettier** - Code quality and formatting
- **TypeScript ESLint** - Advanced linting for TypeScript
- **Semantic Release** - Automated versioning and publishing
