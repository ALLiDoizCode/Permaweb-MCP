# Data Flow Architecture

## Memory Storage Flow

```mermaid
sequenceDiagram
    participant Client
    participant MCP as MCP Server
    participant MS as Memory Service
    participant Hub as AO Hub
    participant AR as Arweave

    Client->>MCP: Add Memory Request
    MCP->>MS: addEnhanced()
    MS->>MS: Validate & Tag Creation
    MS->>Hub: Event Message
    Hub->>AR: Permanent Storage
    AR-->>Hub: Transaction Confirmation
    Hub-->>MS: Success Response
    MS-->>MCP: Memory ID
    MCP-->>Client: Success Result
```

## Process Communication Flow

```mermaid
sequenceDiagram
    participant Client
    participant PCS as Process Communication
    participant NLS as Natural Language Service
    parameter AO as AO Process
    participant AR as Arweave

    Client->>PCS: Natural Language Request
    PCS->>NLS: Parse Request
    NLS->>PCS: Handler + Parameters
    PCS->>AO: AO Message
    AO->>AR: Process Execution
    AR-->>AO: Execution Result
    AO-->>PCS: Response Message
    PCS->>PCS: Interpret Response
    PCS-->>Client: Structured Result
```

## Documentation Query Flow

```mermaid
sequenceDiagram
    participant Client
    participant PDS as Permaweb Docs Service
    participant Cache
    participant Remote as Permaweb Sources

    Client->>PDS: Documentation Query
    PDS->>PDS: Domain Detection
    PDS->>Cache: Check Cache

    alt Cache Hit
        Cache-->>PDS: Cached Content
    else Cache Miss
        PDS->>Remote: Fetch Documentation
        Remote-->>PDS: Raw Content
        PDS->>Cache: Store Content
    end

    PDS->>PDS: Chunk & Score Content
    PDS->>PDS: Rank by Relevance
    PDS-->>Client: Relevant Chunks
```
