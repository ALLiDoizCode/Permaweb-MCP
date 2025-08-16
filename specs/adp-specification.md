# AO Documentation Protocol (ADP) v1.0 - Technical Specification

## Table of Contents

1. [Abstract](#abstract)
2. [Motivation](#motivation)
3. [Specification](#specification)
4. [Implementation](#implementation)
5. [Security Considerations](#security-considerations)
6. [Examples](#examples)
7. [Backward Compatibility](#backward-compatibility)
8. [Reference Implementation](#reference-implementation)

## Abstract

The AO Documentation Protocol (ADP) v1.0 is a standardized extension to the AO ecosystem's Info handler that enables processes to automatically document their capabilities, handlers, and interfaces. This protocol makes AO processes self-documenting, eliminating the need for manual API documentation and enabling intelligent tool integration.

## Motivation

### Current Limitations

The existing AO ecosystem requires:

- Manual documentation of process interfaces
- Hard-coded handler definitions in client tools
- Prior knowledge of available handlers and tags
- No standardized tag validation

### Goals

ADP addresses these limitations by providing:

- **Automatic Discovery**: Tools can query any process for its capabilities
- **Self-Documentation**: Processes expose their own API documentation
- **Tag Validation**: Validate tags before sending messages
- **Standardization**: Consistent interface patterns across processes
- **Tool Integration**: Enable intelligent client applications

## Specification

### Protocol Identifier

- **Version**: 1.0
- **Namespace**: `protocolVersion: "1.0"`
- **Content-Type**: `application/json`

### Core Data Structures

#### HandlerTag

Describes a tag accepted by a handler:

- **name**: Tag name (e.g., "Target", "Quantity")
- **type**: Data type ("string", "number", "boolean", "address", "json")
- **required**: Whether tag is mandatory (true/false)
- **description**: Human-readable description (optional)
- **examples**: Array of example values (optional)
- **validation**: Validation constraints (optional)

#### ValidationRules

Defines constraints for tag validation:

- **pattern**: Regex pattern for string validation (optional)
- **min**: Minimum value for numbers (optional)
- **max**: Maximum value for numbers (optional)
- **enum**: Array of allowed values (optional)

#### HandlerMetadata

Describes a single handler and its capabilities:

- **action**: Handler action name
- **pattern**: Array of required tags for routing
- **tags**: Array of expected tags (optional)
- **description**: Handler description (optional)
- **examples**: Array of usage examples (optional)
- **category**: Handler classification ("core", "utility", "custom")
- **version**: Handler version (optional)

#### ExtendedInfoResponse

The complete AHRP-compliant Info response:

**Standard AO process fields (backward compatible):**

- Name, Ticker, Logo, Description, Denomination, TotalSupply, Owner, ProcessId

**AHRP-specific fields:**

- **protocolVersion**: "1.0" (protocol version identifier)
- **lastUpdated**: ISO 8601 timestamp
- **handlers**: Array of handler definitions
- **capabilities**: Supported features object

#### Capabilities

Supported protocol features:

- **supportsHandlerRegistry**: AHRP support flag
- **supportsTagValidation**: Tag validation support
- **supportsExamples**: Example provision capability

### Message Patterns

#### Info Request

Standard AO message requesting process information:

```
Tags: [
  { name: "Action", value: "Info" }
]
```

#### Info Response

ADP-compliant response structure:

```json
{
  "Name": "Example Token",
  "Ticker": "EXT",
  "protocolVersion": "1.0",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "handlers": [
    {
      "action": "Transfer",
      "pattern": ["Action"],
      "tags": [
        {
          "name": "Target",
          "type": "address",
          "required": true,
          "description": "Recipient address",
          "examples": ["vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"]
        },
        {
          "name": "Quantity",
          "type": "string",
          "required": true,
          "description": "Amount to transfer",
          "validation": {
            "pattern": "^[0-9]+$"
          }
        }
      ],
      "description": "Transfer tokens to another address",
      "category": "core"
    }
  ],
  "capabilities": {
    "supportsHandlerRegistry": true,
    "supportsTagValidation": true,
    "supportsExamples": true
  }
}
```

## Implementation

### Detection Algorithm

Tools should detect ADP compliance by checking:

1. Response is valid JSON object
2. Contains `protocolVersion: "1.0"`
3. Contains `handlers` array

### Tag Validation

Implementations MUST validate tags according to these rules:

1. **Required Tags**: All tags marked `required: true` must be present
2. **Type Validation**: Tags must match the specified type
3. **Pattern Validation**: String tags must match regex patterns if specified
4. **Enumeration Validation**: Tags must be from allowed values if enum is specified
5. **Range Validation**: Numeric tags must be within min/max bounds if specified

### Message Tag Generation

Tools should generate message tags using this approach:

1. **Pattern Tags**: Add all tags from the handler's `pattern` array
2. **Action Tag**: Always include `Action` tag with the handler's action name
3. **Handler Tags**: Add tags from the handler's `tags` array that are provided
4. **String Conversion**: Convert all tag values to strings for AO message format

### Error Handling

Implementations MUST handle these error conditions:

- **Invalid JSON**: Treat as legacy (non-ADP) process
- **Missing Fields**: Fall back to embedded templates or manual configuration
- **Validation Errors**: Provide detailed error messages with field names
- **Network Timeouts**: Graceful fallback to legacy mode

## Security Considerations

### Information Disclosure

Handler metadata may reveal:

- Process capabilities and limitations
- Parameter validation rules
- Internal structure information

**Mitigation**: Processes should only expose metadata for publicly accessible handlers.

### Tag Injection

Malicious tags could exploit:

- SQL injection (if process uses databases)
- Code injection through dynamic evaluation
- Buffer overflow in tag processing

**Mitigation**: Always validate and sanitize tags before processing.

### Denial of Service

Large handler metadata could cause:

- Memory exhaustion in client applications
- Network bandwidth consumption
- Processing delays

**Mitigation**: Implement reasonable limits on metadata size and complexity.

### Version Compatibility

Future protocol versions could:

- Break existing implementations
- Introduce security vulnerabilities
- Cause parsing errors

**Mitigation**: Always check protocol version before processing.

## Examples

### Basic Process

```lua
-- Simple ping process with AHRP
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Name = "Ping Process",
            Description = "Simple ping/pong process",
            protocolVersion = "1.0",
            lastUpdated = "2024-01-15T10:30:00.000Z",
            handlers = {
                {
                    action = "Ping",
                    pattern = {"Action"},
                    description = "Respond with pong",
                    examples = {"Send Ping to test connectivity"},
                    category = "utility"
                }
            }
        })
    })
end)
```

### Token Process

```lua
-- Token process with comprehensive AHRP metadata
local tokenHandlers = {
    {
        action = "Balance",
        pattern = {"Action"},
        tags = {
            {
                name = "Target",
                type = "address",
                required = false,
                description = "Address to check balance for"
            }
        },
        description = "Get token balance",
        category = "core"
    },
    {
        action = "Transfer",
        pattern = {"Action"},
        tags = {
            {
                name = "Target",
                type = "address",
                required = true,
                description = "Recipient address"
            },
            {
                name = "Quantity",
                type = "string",
                required = true,
                description = "Amount to transfer",
                validation = {
                    pattern = "^[0-9]+$"
                }
            }
        },
        description = "Transfer tokens",
        category = "core"
    }
}
```

### DAO Process

```lua
-- DAO process with governance handlers
local daoHandlers = {
    {
        action = "Propose",
        pattern = {"Action"},
        tags = {
            {
                name = "Title",
                type = "string",
                required = true,
                description = "Proposal title"
            },
            {
                name = "Description",
                type = "string",
                required = true,
                description = "Detailed proposal description"
            },
            {
                name = "Duration",
                type = "number",
                required = false,
                description = "Voting duration in blocks",
                validation = {
                    min = 1,
                    max = 100000
                }
            }
        },
        description = "Create a new proposal",
        category = "core"
    },
    {
        action = "Vote",
        pattern = {"Action"},
        tags = {
            {
                name = "ProposalId",
                type = "string",
                required = true,
                description = "ID of proposal to vote on"
            },
            {
                name = "Choice",
                type = "string",
                required = true,
                description = "Vote choice",
                validation = {
                    enum = ["yes", "no", "abstain"]
                }
            }
        },
        description = "Vote on a proposal",
        category = "core"
    }
}
```

## Backward Compatibility

### Legacy Process Support

AHRP is fully backward compatible:

1. **Legacy Processes**: Continue to work with existing tools
2. **Legacy Tools**: Can still interact with AHRP processes using standard patterns
3. **Gradual Migration**: Processes can add AHRP support without breaking changes
4. **Fallback Mechanisms**: Tools should fallback to embedded templates for legacy processes

### Migration Strategy

1. **Phase 1**: Add AHRP support to new processes
2. **Phase 2**: Update existing processes with AHRP metadata
3. **Phase 3**: Deprecate embedded templates in favor of discovery
4. **Phase 4**: Remove legacy fallbacks (future version)

### Version Evolution

Future versions will maintain compatibility:

- **Additive Changes**: New fields will be optional
- **Breaking Changes**: Will increment major version
- **Deprecation Policy**: 6-month notice for breaking changes

## Reference Implementation

### AO Process Implementation

The core ADP implementation is done within AO processes using Lua. The enhanced Info handler must:

1. **Collect Handler Metadata**: Define all available handlers with their tag requirements
2. **Generate Response**: Create JSON response with protocol version and handler definitions
3. **Send Response**: Return the structured data via AO messaging

### Integration Examples

#### Basic Process Discovery

```lua
-- Client queries process for capabilities
Send({ Target = processId, Action = "Info" })

-- Process responds with ADP metadata
-- Client parses response and generates UI dynamically
```

#### Tool Integration

Tools can implement ADP support by:

1. **Sending Info Message**: Query process with `Action: Info`
2. **Parsing Response**: Check for `protocolVersion: "1.0"`
3. **Generating Interface**: Create UI/CLI from handler metadata
4. **Validating Input**: Use handler tag definitions to validate user input
5. **Sending Messages**: Generate proper AO messages with required tags

## Conclusion

The AO Documentation Protocol v1.0 provides a standardized, secure, and extensible foundation for automatic API documentation in the AO ecosystem. By implementing ADP, processes become self-documenting and immediately compatible with intelligent tooling, significantly improving the developer experience while maintaining full backward compatibility.

### Key Benefits

- **Developer Experience**: Automatic API discovery and documentation
- **Tool Integration**: Seamless integration with IDEs and applications
- **Standardization**: Consistent patterns across the entire ecosystem
- **Security**: Built-in tag validation and error handling
- **Future-Proof**: Extensible design for ecosystem evolution

### Adoption Roadmap

1. **Immediate**: New processes should implement ADP v1.0
2. **Short-term**: Existing processes should add ADP support
3. **Medium-term**: Tools should prioritize ADP discovery over embedded templates
4. **Long-term**: ADP becomes the standard for all AO process interaction

The protocol is production-ready and available for immediate adoption in the AO ecosystem.
