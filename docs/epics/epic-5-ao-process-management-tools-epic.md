# Epic 5: AO Process Management Tools Epic

## Epic Goal

Add comprehensive AO process lifecycle management capabilities to Permamind by implementing createProcess and evalProcess tools that enable users to spawn new AO processes and evaluate code within them, providing foundational infrastructure for AO development workflows.

## Epic Description

**Existing System Context:**

- Current functionality: Permamind provides process communication through executeAction and queryAOProcessMessages tools
- Technology stack: TypeScript, FastMCP, AO Connect (@permaweb/aoconnect), existing process.ts and relay.ts modules
- Integration points: MCP tool system, AO process communication infrastructure, existing signer management

**Enhancement Details:**

- What's being added/changed: Two new MCP tools - createProcess for spawning AO processes and evalProcess for code evaluation within processes, leveraging existing createProcess() and evalProcess() functions
- How it integrates: Extends existing ProcessToolFactory with new tools, uses established AO Connect patterns, integrates with current signer and process management infrastructure
- Success criteria: Users can create new AO processes and evaluate Lua code within them through natural MCP commands, enabling full AO development lifecycle management

## Stories

### Story 5.1: Implement createProcess MCP Tool

**User Story:** As a developer using Permamind, I want to spawn new AO processes through an MCP command so that I can create dedicated computational environments for my applications without manual AO setup.

**Acceptance Criteria:**

- Create CreateProcessCommand following existing ProcessToolFactory patterns
- Integrate with existing createProcess() function from process.ts:60
- Use established signer management from current MCP tool infrastructure
- Return processId upon successful creation with 3-second initialization delay
- Include proper error handling and validation for process creation failures
- Provide clear tool description and parameter documentation for AI understanding
- Maintain compatibility with existing AO Connect configuration (SCHEDULER, AOS_MODULE)

### Story 5.2: Implement evalProcess MCP Tool

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

### Story 5.3: Integrate Process Management Tools with Existing Infrastructure

**User Story:** As a Permamind user, I want the new process management tools to work seamlessly with existing functionality so that I can combine process creation/evaluation with memory storage, documentation queries, and workflow execution.

**Acceptance Criteria:**

- Register new tools in ProcessToolFactory alongside existing process tools
- Ensure compatibility with current executeAction and queryAOProcessMessages functionality
- Maintain existing MCP server registration patterns in server.ts
- Preserve all current process communication capabilities
- Support process lifecycle: create → evaluate → communicate → query
- Enable process management within BMAD workflow contexts
- Update tool documentation to reflect expanded process management capabilities

## Definition of Done

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
