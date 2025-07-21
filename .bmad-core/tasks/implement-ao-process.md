# Implement AO Process

## ⚠️ CRITICAL EXECUTION NOTICE ⚠️

**THIS IS AN EXECUTABLE WORKFLOW - NOT REFERENCE MATERIAL**

When this task is invoked:

1. **PREREQUISITES REQUIRED** - Must have business requirements and technical architecture
2. **MANDATORY STEP-BY-STEP EXECUTION** - Each section must be processed sequentially
3. **MCP TOOLS AUTHORIZED** - This is the ONLY task where createProcess, evalProcess are appropriate
4. **STORY-DRIVEN DEVELOPMENT** - Follow existing story validation and Dev Agent Record patterns

**VIOLATION INDICATOR:** If you implement AO processes without proper requirements and architecture documentation, you have violated this workflow.

## Developer Role Definition

As the **Senior Software Engineer**, your role is to:

- **Implement AO processes** based on technical specifications from architect
- **Use MCP tools** (createProcess, evalProcess, executeAction) for actual implementation
- **Write and test handlers** according to architecture specifications
- **Deploy to Permaweb** following deployment procedures
- **Update Dev Agent Record** with implementation details and decisions
- **Validate against stories** and acceptance criteria from business requirements

## Prerequisites Validation

This task REQUIRES completed documentation from previous phases:

1. **Business Requirements** (from analyst):
   - AO Process Requirements document
   - User stories and acceptance criteria
   - Tokenomics specification
   - Success metrics

2. **Technical Architecture** (from architect):
   - AO Process Architecture document
   - Handler specifications and message schemas
   - Integration requirements
   - Testing strategy

**If these are missing, STOP and request proper handoff documentation.**

## Implementation Flow

1. **Validate Prerequisites** - Confirm all required documentation exists
2. **Review Story/Epic** - Understand acceptance criteria and definition of done
3. **Set up Development Environment** - Prepare for AO process development
4. **Implement Process Handlers** - Write handlers according to architecture specs
5. **Test Process Functionality** - Validate against acceptance criteria
6. **Deploy to Permaweb** - Deploy using proper procedures
7. **Update Documentation** - Update Dev Agent Record and completion status

## MCP Tools Usage Guidelines

**Authorized MCP Tools for Implementation:**

- **`createProcess`** - Create new AO processes according to architecture specs
- **`evalProcess`** - Test and debug process functionality during development
- **`executeAction`** - Test process communication and message handling
- **`queryAOProcessMessages`** - Debug and validate process behavior
- **`deployPermawebDirectory`** - Deploy completed processes to Permaweb

**Usage Requirements:**

1. **Follow Architecture Specs** - Use MCP tools to implement the designed architecture, not ad-hoc solutions
2. **Document Decisions** - Update Dev Agent Record with implementation decisions and rationale
3. **Test Incrementally** - Test each handler as it's implemented
4. **Validate Against Stories** - Ensure implementation meets acceptance criteria
5. **Follow Security Guidelines** - Apply security patterns from architecture documentation

## Development Process

### Phase 1: Environment Setup
1. Review technical architecture and implementation requirements
2. Identify required AO modules and dependencies
3. Set up local development environment
4. Create development process using `createProcess`

### Phase 2: Handler Implementation
1. Implement core handlers according to architecture specifications
2. Use `evalProcess` to test handler functionality incrementally
3. Implement state management as designed
4. Test message processing and validation

### Phase 3: Integration Testing
1. Test inter-process communication patterns
2. Validate message schemas and data flows
3. Test error handling and edge cases
4. Use `executeAction` for integration testing

### Phase 4: Deployment and Validation
1. Prepare process for Permaweb deployment
2. Deploy using `deployPermawebDirectory` or similar
3. Validate deployed process functionality
4. Test end-to-end user scenarios

## Dev Agent Record Requirements

**MANDATORY:** Update the Dev Agent Record section with:

1. **Implementation Decisions** - Key technical decisions made during implementation
2. **Architecture Deviations** - Any changes from original architecture and rationale
3. **Testing Results** - Test execution results and coverage
4. **Deployment Status** - Deployment process and final URLs/addresses
5. **Known Issues** - Any limitations or issues discovered
6. **Performance Notes** - Performance characteristics and optimizations

## Story Validation

Before marking implementation complete:

1. **Verify Acceptance Criteria** - Each criterion from business requirements must be met
2. **Test User Scenarios** - Validate against user stories from analyst phase
3. **Check Technical Requirements** - Ensure architecture specifications are implemented
4. **Validate Performance** - Check against performance requirements
5. **Security Validation** - Verify security patterns are properly implemented

## Testing Strategy

1. **Unit Testing** - Test individual handlers in isolation
2. **Integration Testing** - Test process communication and message flows
3. **User Acceptance Testing** - Validate against business requirements
4. **Performance Testing** - Ensure scalability requirements are met
5. **Security Testing** - Validate security patterns and input validation

## Error Handling and Debugging

1. **Use `evalProcess`** for debugging handler logic
2. **Query message history** with `queryAOProcessMessages` for troubleshooting
3. **Document error patterns** and resolution approaches
4. **Implement proper error handling** according to architecture specs

## Completion Criteria

Implementation is complete when:

1. ✅ All handlers implemented according to architecture specifications
2. ✅ All acceptance criteria from business requirements are met
3. ✅ Process successfully deployed to Permaweb
4. ✅ Integration tests pass with other required processes
5. ✅ Dev Agent Record fully updated with implementation details
6. ✅ Story marked as completed in project tracking

## CRITICAL REMINDERS

**✅ PROPER USE:**

- Use MCP tools to implement designed architecture
- Follow technical specifications from architect phase
- Test incrementally and document results
- Update Dev Agent Record with all implementation decisions
- Validate against business requirements and acceptance criteria

**❌ VIOLATIONS:**

- Implementing without proper requirements and architecture documentation
- Using MCP tools for ad-hoc development without following BMAD workflow
- Skipping story validation and acceptance criteria verification
- Not updating Dev Agent Record with implementation details
- Making architectural decisions without architect consultation

This task represents the proper culmination of the BMAD workflow - taking well-defined requirements and architecture through to working AO process implementation.