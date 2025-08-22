# Epic 10: ArNS Tools Integration Epic - Brownfield Enhancement

## Epic Goal

Integrate comprehensive Arweave Name System (ArNS) tools into Permamind MCP server to enable decentralized domain name operations, including name registration, resolution, management, and cost calculation through natural language interactions.

## Epic Description

**Existing System Context:**

- Current functionality: Permamind MCP server with existing tool infrastructure for token operations, process management, and documentation
- Technology stack: TypeScript, FastMCP, existing MCP tool patterns, AO Connect integration, Arweave ecosystem connectivity
- Integration points: Existing tool factory system, signer management infrastructure, address resolution utilities, confirmation flow patterns

**Enhancement Details:**

- What's being added/changed: New ArNS tool category with comprehensive name system operations including name resolution, registration (lease/permanent), cost calculation, name management (upgrades, extensions), and undername support following ar-io-sdk patterns
- How it integrates: Leverages existing tool factory architecture, signer management, and confirmation flows; uses ar-io-sdk as the underlying ArNS client library; follows established MCP tool patterns for parameter validation and response formatting
- Success criteria: Users can perform all ArNS operations through natural language commands, seamless integration with existing Permamind functionality, full support for ArNS lifecycle management from discovery to deployment

## ArNS Technical Overview

Based on analysis of the ar-io-sdk repository, ArNS (Arweave Name System) provides:

### Core Capabilities

- **Decentralized naming system** for Arweave ecosystem
- **Base names and undernames** with hierarchical structure
- **Lease and permanent ownership models** (1-5 year leases or permanent purchase)
- **Up to 100 undernames per base name** with configurable limits
- **Demand-based pricing** with dynamic fee calculation
- **Referral tracking** during name purchases

### Key Operations

- **Name Resolution**: `resolveArNSName()` for base names and undernames
- **Registration**: `buyRecord()` supporting lease/permanent types with duration
- **Management**: Upgrade leases to permanent, extend durations, increase undername limits
- **Cost Calculation**: `getTokenCost()` for pricing across different registration types
- **Record Management**: TTL configuration, primary name settings

### Integration Points

- **Network Support**: Mainnet, Testnet, Devnet configurations
- **Token Economics**: IO token integration for payments and transactions
- **Transaction Signing**: Compatible with existing Arweave wallet infrastructure
- **Error Handling**: Network failures, invalid names, insufficient funds

## Stories

### Story 10.1: ArNS Foundation & Client Setup

**User Story:** As a Permamind developer, I want to establish the foundational ArNS infrastructure so that subsequent ArNS tools can be built on reliable client management and network configuration.

**Scope:** Infrastructure-only implementation focusing on basic setup.

**Acceptance Criteria:**

- Create basic `ArnsToolFactory` structure following existing tool factory patterns (src/tools/arns/ArnsToolFactory.ts)
- Implement `ArnsClientManager` utility for ar-io-sdk client management
- Add network configuration support (mainnet/testnet via environment variables)
- Establish ar-io-sdk integration patterns and initialization
- Register ArnsToolFactory in server.ts (basic registration only)
- Implement basic error handling and logging patterns
- Create foundational directory structure and index files

**Implementation Approach:**

```typescript
// Tool structure following existing patterns
src/tools/arns/
├── ArnsToolFactory.ts          // Basic factory structure
├── utils/
│   └── ArnsClientManager.ts    // Client management singleton
├── commands/                   // Empty initially - populated in later stories
│   └── index.ts
└── index.ts                    // Main exports
```

**Technical Integration:**

- ar-io-sdk client initialization: `ARIO.init()` and `ARIO.testnet()` methods
- Environment variable `ARNS_NETWORK` for network configuration
- Client caching and connection management patterns
- Error handling for client initialization failures

---

### Story 10.2: ArNS Name Resolution Tools

**User Story:** As a Permamind user, I want to resolve ArNS names and query detailed name information so that I can discover and validate ArNS records before making operational decisions.

**Scope:** Read-only name operations and information retrieval.

**Acceptance Criteria:**

- Implement `ResolveArnsNameCommand` for base names and undernames resolution
- Implement `GetArnsRecordInfoCommand` for detailed name information retrieval
- Support both `.ar` base names and undername resolution (e.g., `sub.example.ar`)
- Include comprehensive validation for ArNS name formats using Zod schemas
- Implement proper error handling for invalid names and network issues
- Provide clear, AI-friendly tool descriptions and parameter documentation
- Support network switching (mainnet/testnet) via client manager

**Technical Integration:**

- Use `ArnsClientManager` from Story 10.1 for client access
- Zod schema validation for ArNS name formats (`.ar` suffix validation)
- Structured response format matching existing tool patterns
- Comprehensive error handling for DNS-like resolution failures

---

### Story 10.3: ArNS Cost Calculation & Pricing

**User Story:** As a user planning ArNS name registration, I want to calculate costs for different registration types so that I can make informed decisions about lease durations and permanent ownership.

**Scope:** Pricing and economics operations without actual registration.

**Acceptance Criteria:**

- Implement `GetArnsTokenCostCommand` for comprehensive price calculation
- Support cost calculation for lease registrations (1-5 year duration options)
- Support cost calculation for permanent registration options
- Include demand-based pricing calculation using ar-io-sdk pricing APIs
- Provide cost breakdown and comparison between lease vs permanent options
- Handle pricing failures gracefully with fallback estimates when possible
- Support undername count pricing for increased undername limits

**Technical Integration:**

- Integrate ar-io-sdk pricing APIs (`getTokenCost()` methods)
- Implement duration-based calculation logic for lease options
- Real-time demand-based pricing with API error handling
- Cost comparison utilities for decision support

---

### Story 10.4: ArNS Registration Tools

**User Story:** As a user establishing decentralized identity, I want to register ArNS names through natural language commands so that I can secure my desired names with appropriate registration types.

**Scope:** Name purchase and registration operations with transaction handling.

**Acceptance Criteria:**

- Implement `BuyArnsRecordCommand` supporting both lease and permanent registration
- Integrate with existing signer management infrastructure for transaction signing
- Support lease duration selection (1-5 years) with proper validation
- Implement permanent registration option with appropriate cost handling
- Include referral tracking support for ar-io-sdk registration flow
- Provide transaction confirmation and status reporting
- Handle registration failures with clear error messages and retry guidance
- Support undername limit specification during registration

**Registration Flow Implementation:**

1. **Cost Calculation**: Use Story 10.3 pricing tools for cost estimation
2. **Parameter Validation**: Validate name format, duration, payment amounts
3. **Transaction Creation**: Use ar-io-sdk `buyRecord()` with proper parameters
4. **Signing**: Leverage existing AutoSafeToolContext signer management
5. **Confirmation**: Transaction status tracking and result reporting
6. **Error Recovery**: Handle network failures, insufficient funds, name conflicts

**Technical Integration:**

- Use existing ToolContext signer management patterns
- Follow confirmation flow patterns from token tools
- Transaction status monitoring and reporting
- Error handling with actionable user guidance

---

### Story 10.5: ArNS Management Tools

**User Story:** As an ArNS name owner, I want to manage my existing names through upgrade, extension, and configuration operations so that I can maintain and enhance my decentralized identity infrastructure.

**Scope:** Post-registration management operations for existing names.

**Acceptance Criteria:**

- Implement `UpgradeArnsRecordCommand` for converting leased names to permanent ownership
- Implement `ExtendArnsLeaseCommand` for lease duration management before expiration
- Implement `IncreaseUndernameCountCommand` for expanding undername capacity (10 → 100)
- Include ownership validation to ensure user can manage specified names
- Support management operation cost calculation and confirmation flows
- Provide management operation status tracking and error recovery
- Handle management operation failures with clear guidance

**Management Operations:**

- **Lease to Permanent**: `upgradeRecord()` for ownership conversion with cost calculation
- **Lease Extension**: Extend lease duration with proper expiration handling
- **Undername Expansion**: Increase undername count limit with capacity validation
- **Record Updates**: Support TTL configuration and metadata management where applicable

**Technical Integration:**

- Ownership verification through ar-io-sdk record queries
- Management cost calculation integration with pricing tools
- Transaction signing and confirmation using existing patterns
- Error handling specific to management operation types

---

### Story 10.6: Cross-System Integration

**User Story:** As a Permamind user, I want ArNS operations to work seamlessly with existing functionality so that I can combine name management with token transfers, process communication, and memory storage.

**Scope:** Integration with existing Permamind tools and cross-system functionality.

**Acceptance Criteria:**

- Extend existing address resolution utilities to support ArNS name resolution
- Enable ArNS name usage in token transfer operations (`transferTokens` tool)
- Support ArNS name resolution in process communication (`executeAction` tool)
- Integrate ArNS record storage in memory system for persistent name management
- Implement ArNS name support in contact mapping system (`saveAddressMapping`)
- Provide seamless ArNS operations within natural language workflows
- Maintain full compatibility with existing MCP server patterns and error handling
- Update tool documentation and descriptions to reflect ArNS integration capabilities

**Cross-Tool Integration Points:**

- **Token Transfer Integration**: Extend `resolveAddress()` in TokenResolver.ts to support `.ar` names
- **Process Communication**: Enable ArNS name resolution in process identification
- **Contact System**: Store ArNS names alongside traditional address mappings
- **Memory Integration**: Store ArNS records and management history in aiMemoryService
- **Address Resolution**: Centralized ArNS name resolution for all tools that accept addresses

**Infrastructure Integration:**

1. **Address Resolution Enhancement**: Extend existing address resolution utilities
2. **Memory Integration**: Store ArNS operations and records in memory system
3. **Confirmation Flows**: Follow existing token tool confirmation patterns
4. **Error Handling**: Consistent error response formatting across all integrations
5. **Documentation Updates**: Tool descriptions updated for AI-assisted cross-tool usage

## Compatibility Requirements

- [ ] Existing tool APIs remain unchanged for all current consumers
- [ ] ArNS tools follow established MCP tool patterns and validation schemas
- [ ] Network configuration respects existing environment variable patterns
- [ ] Signer management integrates with current wallet and keypair infrastructure
- [ ] Error handling maintains consistency with existing tool responses
- [ ] No regression in existing token, process, or documentation functionality

## Risk Mitigation

- **Primary Risk:** ar-io-sdk dependency conflicts with existing AO Connect or Arweave dependencies
- **Mitigation:** Careful dependency analysis, version compatibility testing, isolated SDK client initialization
- **Rollback Plan:** ArNS tools are additive enhancement - can be disabled via tool factory registration without affecting core functionality

**Additional Risks:**

- **Network Dependency**: ArNS operations require network connectivity to AR.IO gateways
- **Mitigation**: Comprehensive error handling, retry mechanisms, clear offline behavior
- **Cost Volatility**: ArNS pricing is demand-based and can change
- **Mitigation**: Real-time cost calculation before transactions, user confirmation flows

## Implementation Priority

This epic should be implemented after Epic 9 (ADP Parameter Translation Quality Issues) to ensure stable process communication infrastructure exists for any ArNS-related process operations.

### Sequential Implementation (Required Dependencies)

```
10.1 (Foundation)
  ↓
10.2 (Resolution) ← Depends on client setup
  ↓
10.3 (Pricing) ← Depends on client setup
  ↓
10.4 (Registration) ← Depends on pricing + client setup
  ↓
10.5 (Management) ← Depends on registration patterns
  ↓
10.6 (Integration) ← Depends on all core functionality
```

### Parallel Development Opportunities

- **Stories 10.2 & 10.3** can be developed concurrently after 10.1 completion
- **Stories 10.4 & 10.5** can be developed concurrently after 10.2-10.3 completion
- Story 10.6 requires all previous stories but can begin integration testing during 10.4-10.5 development

### Recommended Implementation Timeline

- **Week 1**: Story 10.1 (Foundation & Client Setup) - 3-5 days
- **Week 2**: Stories 10.2 & 10.3 (Resolution & Pricing) - 5-7 days parallel development
- **Week 3**: Stories 10.4 & 10.5 (Registration & Management) - 5-7 days parallel development
- **Week 4**: Story 10.6 (Cross-System Integration) - 5-7 days integration and testing

## Definition of Done

### Story-Level Requirements

- [ ] **Story 10.1**: ArNS Foundation & Client Setup - Basic infrastructure, client management, and server registration
- [ ] **Story 10.2**: ArNS Name Resolution Tools - Name resolution and record information retrieval working
- [ ] **Story 10.3**: ArNS Cost Calculation & Pricing - Comprehensive pricing for lease and permanent options
- [ ] **Story 10.4**: ArNS Registration Tools - Name registration supporting both lease and permanent types
- [ ] **Story 10.5**: ArNS Management Tools - Post-registration management (upgrade, extend, increase limits)
- [ ] **Story 10.6**: Cross-System Integration - Seamless integration with existing Permamind infrastructure

### Technical Implementation Requirements

- [ ] ArNS name resolution working for both base names and undernames (`.ar` and `sub.example.ar`)
- [ ] Cost calculation supporting lease (1-5 years) and permanent registration options with demand-based pricing
- [ ] Registration tools handle ar-io-sdk `buyRecord()` with proper transaction signing and confirmation
- [ ] Management tools support upgrades (lease→permanent), extensions, and undername count increases (10→100)
- [ ] Integration with existing AutoSafeToolContext signer management and transaction confirmation flows
- [ ] ArNS name resolution integrated with token transfers and process communication tools
- [ ] ArNS records stored in memory system for persistent name management and history
- [ ] Cross-tool address resolution supporting `.ar` names in all address-accepting tools

### Quality & Compatibility Requirements

- [ ] Comprehensive error handling for network issues, invalid names, insufficient funds, and ownership validation
- [ ] Tool descriptions enable AI-assisted usage with proper Zod parameter validation schemas
- [ ] No regression in existing Permamind functionality or MCP tool behavior during integration
- [ ] All ArNS tools follow established MCP tool patterns and error response formatting
- [ ] Network configuration respects existing environment variable patterns (ARNS_NETWORK)
- [ ] ar-io-sdk dependency integration without conflicts with existing AO Connect or Arweave packages

### Testing & Validation Requirements

- [ ] Unit tests for all ArNS commands with comprehensive parameter validation scenarios
- [ ] Integration testing confirms ArNS operations work with token transfers and process communication
- [ ] End-to-end testing: name resolution → cost calculation → registration → management → cross-tool usage
- [ ] Network failure simulation and error recovery testing for all ArNS operations
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test
- [ ] Documentation updated to include ArNS tool examples and cross-system integration patterns

## Success Metrics

- Users can perform complete ArNS name lifecycle through natural language commands
- ArNS name resolution works seamlessly in token transfers and process communication
- Registration success rate >95% for valid names with sufficient funds
- Cost calculation accuracy matches ar-io-sdk direct calls
- Integration maintains existing Permamind tool performance characteristics
- Zero regression in existing tool functionality during ArNS integration
