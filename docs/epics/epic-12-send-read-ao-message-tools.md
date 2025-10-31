# Epic 12: Add Send/Read AO Message Tools - Brownfield Enhancement

## Epic Goal

Expand the Process tool category from 3 core tools to 5 tools by adding specialized send/read operations, then streamline back to 4 tools by removing the redundant evalProcess tool, providing a complete low-level AO messaging interface.

## Epic Description

**Existing System Context:**

- Current functionality: 3 Process tools after Epic 11 (spawnProcess, evalProcess, queryAOProcessMessages)
- Technology stack: FastMCP + TypeScript + Node.js 20+ + AO Connect + @permaweb/aoconnect
- Integration points: ProcessToolFactory, tool registry, server initialization, process.ts messaging layer
- Total MCP tools after Epic 11: 15 tools (Process: 3, Arweave: 4, User: 2, ArNS: 6)

**Enhancement Details:**

- What's being added/changed: Add 2 new generic messaging tools (sendAOMessage, readAOProcess), then remove the specialized evalProcess tool
- How it integrates: New commands extend ToolCommand base class, use existing send()/read() functions from process.ts, registered in ProcessToolFactory
- Success criteria: 4 flexible Process tools (spawn, send, read, query) supporting all AO operations including Lua code deployment via custom tags

## Stories

### Story 12.1: Add Send AO Message Tool

**Acceptance Criteria:**

- Create new `SendAOMessageCommand` with flexible tag and data parameters
- Implement message sending using `send()` function from process.ts with auto-initialized keypair
- Support custom tags array and optional data payload with Zod validation
- Handle responses and errors with structured JSON formatting
- Register tool in ProcessToolFactory (3 → 4 process tools, 15 → 16 total tools)
- Run type-check, build, lint, and test with all passing

### Story 12.2: Add Read AO Process Tool

**Acceptance Criteria:**

- Create new `ReadAOProcessCommand` for dryrun queries with custom tags
- Implement read-only queries using `read()` function from process.ts (no signer needed)
- Support tags parameter with Zod validation (no data parameter for dryruns)
- Extract and parse message data from dryrun response Messages array
- Register tool in ProcessToolFactory (4 → 5 process tools, 16 → 17 total tools)
- Run type-check, build, lint, and test with all passing

### Story 12.3: Remove Deploy Lua Code to Process Tool

**Acceptance Criteria:**

- Delete `EvalProcessCommand` implementation and test files
- Remove EvalProcessCommand from ProcessToolFactory registration and exports
- Update ProcessToolFactory JSDoc to reflect 4 tools instead of 5
- Update CLAUDE.md and README.md with correct tool counts (17 → 16 total, Process: 5 → 4)
- Document migration pattern: use sendAOMessage with `Action: Eval` tag for Lua code deployment
- Verify no functionality loss - sendAOMessage supports all evalProcess use cases
- Run type-check, build, lint, and test with all passing

## Definition of Done

- [x] Story 12.1 completed: sendAOMessage tool added (15 → 16 tools)
- [x] Story 12.2 completed: readAOProcess tool added (16 → 17 tools)
- [ ] Story 12.3 completed: evalProcess tool removed (17 → 16 tools)
- [ ] Final tool count: 16 total tools (Process: 4, Arweave: 4, User: 2, ArNS: 6)
- [ ] All Process tools functional: spawnProcess, sendAOMessage, readAOProcess, queryAOProcessMessages
- [ ] Migration documentation complete for evalProcess → sendAOMessage pattern
- [ ] CLAUDE.md and README.md updated with accurate tool counts
- [ ] All tests passing for remaining Process tools
- [ ] Build passes: `npm run build && npm run lint && npm run type-check`
- [ ] Full CI quality checks pass: `npm run ci:quality`
- [ ] Server starts successfully and MCP client can invoke all 4 Process tools
- [ ] No regression in AO process management capabilities

---

## Epic Rationale

### Why Add Generic Send/Read Tools?

The current Process tool category has 3 specialized tools after Epic 11's rationalization:

- `spawnProcess` - Process creation
- `evalProcess` - Lua code deployment (specialized wrapper around send() with Action: Eval tag)
- `queryAOProcessMessages` - Message history querying

This approach has limitations:

1. **Inflexible**: evalProcess hardcodes the Action: Eval tag, limiting users to predefined operations
2. **Incomplete coverage**: No generic way to send custom messages or perform read queries
3. **Maintenance burden**: Each new message type would require a new specialized tool

### Solution: Generic Messaging Interface

Add two generic tools that expose full AO messaging capabilities:

- `sendAOMessage` - Send any message with custom tags and data (write operations)
- `readAOProcess` - Query process state with custom tags (read operations via dryrun)

### Why Remove evalProcess?

Once sendAOMessage is available, evalProcess becomes redundant:

- **Same functionality**: Both use `send()` from process.ts
- **More flexible**: sendAOMessage allows custom tags, evalProcess hardcodes Action: Eval
- **Simpler API**: One flexible tool instead of multiple specialized wrappers
- **Zero feature loss**: Users can deploy Lua code by setting Action: Eval tag themselves

### Migration Path

**Old pattern (evalProcess):**

```typescript
await evalProcess({
  processId: "abc123...",
  code: "Handlers.add('ping', ...)",
});
```

**New pattern (sendAOMessage):**

```typescript
await sendAOMessage({
  processId: "abc123...",
  tags: [{ name: "Action", value: "Eval" }],
  data: "Handlers.add('ping', ...)",
});
```

Benefits: More explicit, supports additional tags, consistent with all other message operations.

---

## Epic Completion Summary

### Tools Added (2)

- **sendAOMessage** - Flexible message sending with custom tags and data
- **readAOProcess** - Read-only dryrun queries with custom tags

### Tools Removed (1)

- **evalProcess** - Redundant specialized wrapper (functionality preserved in sendAOMessage)

### Final Process Tool Inventory (4 Tools)

1. **spawnProcess** - Create new AO processes
2. **sendAOMessage** - Send messages with custom tags (including code deployment)
3. **readAOProcess** - Read process state via dryrun queries
4. **queryAOProcessMessages** - Query process message history

### Benefits

- **Complete AO messaging interface**: Send (write), read (query), spawn, and query
- **Maximum flexibility**: Users control all tags and data
- **Reduced complexity**: 4 focused tools instead of specialized wrappers
- **Easier maintenance**: Fewer tools to test and document
- **No feature loss**: All previous capabilities preserved with better flexibility

---

## Technical Notes

### Integration with process.ts

Both new tools use existing messaging functions:

- `sendAOMessage` → calls `send(keyPair, processId, tags, data)` from process.ts
- `readAOProcess` → calls `read(processId, tags)` from process.ts
- `evalProcess` (removed) → was calling `send()` with hardcoded Action: Eval tag

### ProcessCacheService Consideration

The removed `evalProcess` tool automatically called `ProcessCacheService.clearProcessCache(processId)` after code deployment. With sendAOMessage, users deploying handlers should manually clear cache if needed. This is documented in migration notes as an acceptable trade-off for API simplicity.

### Testing Strategy

- Unit tests for each new command (SendAOMessageCommand, ReadAOProcessCommand)
- Update ProcessToolFactory tests to expect correct tool counts (4 → 5 → 4)
- Integration tests to verify send/read operations work end-to-end
- Coverage targets: 90% functions, 85% lines per architecture standards
