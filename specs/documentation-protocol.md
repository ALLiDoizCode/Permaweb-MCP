# AO Documentation Protocol (ADP) v1.0

## Overview

The AO Documentation Protocol (ADP) is a standardized way for AO processes to expose their available handlers and required parameters through an enhanced Info handler. This protocol makes AO processes self-documenting and enables tools like Permamind to automatically discover process capabilities without prior knowledge of the process interface.

## Problem Statement

Currently, interacting with AO processes requires:

- Prior knowledge of available handlers and their parameters
- Manual documentation of process interfaces
- Hard-coded handler definitions in client tools
- No standardized way to validate parameters before sending messages

## Solution

ADP extends the existing Info handler to include comprehensive handler metadata, enabling:

- **Automatic Discovery**: Tools can query any process for its capabilities
- **Parameter Validation**: Validate parameters before sending messages
- **Self-Documentation**: Processes expose their own API documentation
- **Backward Compatibility**: Existing Info handlers continue to work

## Protocol Specification

### Enhanced Info Response Schema

ADP defines structured metadata for process documentation:

**HandlerParameter Structure:**

- `name`: Tag name (e.g., "Target", "Quantity")
- `type`: Data type ("string", "number", "boolean", "address", "json")
- `required`: Whether tag is mandatory (true/false)
- `description`: Human-readable description (optional)
- `examples`: Array of example values (optional)
- `validation`: Constraints object (optional)
  - `pattern`: Regex pattern for string validation
  - `min`: Minimum value for numbers
  - `max`: Maximum value for numbers
  - `enum`: Array of allowed values

**HandlerMetadata Structure:**

- `action`: Handler action name (e.g., "Transfer", "Balance")
- `pattern`: Required tags pattern (e.g., ["Action"])
- `parameters`: Array of HandlerParameter objects
- `description`: Handler description (optional)
- `examples`: Usage examples array (optional)
- `category`: Handler type ("core", "utility", "custom")
- `version`: Handler version (optional)

**ExtendedInfoResponse Structure:**

- Standard AO process fields (Name, Ticker, Logo, Description, etc.)
- `protocolVersion`: "1.0" (ADP version identifier)
- `lastUpdated`: ISO 8601 timestamp
- `handlers`: Array of HandlerMetadata objects
- `capabilities`: Supported features object

## Implementation Guide

### 1. Basic Token Process Implementation

```lua
-- Enhanced Info Handler with ADP support
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    local infoResponse = {
        -- Standard token info
        Name = "My Token",
        Ticker = "MTK",
        Logo = "https://example.com/logo.png",
        Description = "An example token with ADP support",
        Denomination = "12",
        TotalSupply = "1000000",
        Owner = "vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI",
        ProcessId = ao.id,

        -- ADP Protocol fields
        protocolVersion = "1.0",
        lastUpdated = "2024-01-15T10:30:00.000Z",
        capabilities = {
            supportsHandlerRegistry = true,
            supportsParameterValidation = true,
            supportsExamples = true
        },
        handlers = {
            {
                action = "Info",
                pattern = {"Action"},
                description = "Get comprehensive token information and handler metadata",
                examples = {"Send Info message to get token details"},
                category = "core"
            },
            {
                action = "Balance",
                pattern = {"Action"},
                parameters = {
                    {
                        name = "Target",
                        type = "address",
                        required = false,
                        description = "Address to check balance for (defaults to sender)",
                        examples = {"vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"}
                    }
                },
                description = "Get token balance for a specific address",
                examples = {"Check your own balance", "Check another address balance"},
                category = "core"
            },
            {
                action = "Transfer",
                pattern = {"Action"},
                parameters = {
                    {
                        name = "Target",
                        type = "address",
                        required = true,
                        description = "Recipient address",
                        examples = {"vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"}
                    },
                    {
                        name = "Quantity",
                        type = "string",
                        required = true,
                        description = "Amount to transfer (in token units)",
                        examples = {"100", "1000000000000"},
                        validation = {
                            pattern = "^[0-9]+$"
                        }
                    }
                },
                description = "Transfer tokens to another address",
                examples = {"Transfer 100 tokens to address"},
                category = "core"
            }
        }
    }

    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
end)
```

### 2. Using the Protocol in Client Tools

#### Process Discovery

**Process Discovery Flow:**

1. Send `Action: Info` message to target process
2. Parse response for `protocolVersion: "1.0"` and `handlers` array
3. Generate UI/documentation from handler metadata
4. Validate user input against handler tag definitions
5. Send properly formatted AO messages

**Tag Validation Flow:**

1. Find handler by action name in metadata
2. Check required tags are provided
3. Validate tag types and constraints
4. Generate AO message with proper tags
5. Send message to process

## Integration with Permamind

Permamind's `executeAction` tool now automatically:

1. **Discovers Process Capabilities**: Queries the Info handler for ADP metadata
2. **Generates Documentation**: Creates markdown documentation from handler metadata
3. **Validates Requests**: Validates natural language requests against available handlers
4. **Fallback Support**: Falls back to embedded templates for legacy processes

### Example Usage

```bash
# Permamind automatically discovers the process handlers
permamind executeAction processId="abc123..." request="transfer 100 tokens to alice"

# The tool will:
# 1. Query the Info handler
# 2. Discover Transfer handler and its parameters
# 3. Validate the request
# 4. Generate appropriate message tags
# 5. Send the message
```

## Benefits

### For Process Developers

- **Self-Documenting**: No need to maintain separate documentation
- **Standardized**: Consistent interface across all processes
- **Validation**: Automatic parameter validation prevents errors
- **Discoverability**: Tools can automatically find and use your process

### For Tool Developers

- **Automatic Integration**: No need to hard-code process interfaces
- **Dynamic Discovery**: Support new processes without code changes
- **Better UX**: Provide real-time validation and suggestions
- **Reduced Maintenance**: No manual template updates required

### For Users

- **Better Error Messages**: Clear validation errors before sending messages
- **Auto-Completion**: Tools can suggest available actions and parameters
- **Confidence**: Know exactly what a process can do before interacting
- **Consistency**: Same interaction patterns across all ADP processes

## Migration Guide

### Existing Processes

To add ADP support to an existing process:

1. **Identify Current Handlers**: List all your current handlers and their parameters
2. **Create Handler Metadata**: Define the metadata structure for each handler
3. **Enhance Info Handler**: Replace or extend your Info handler with ADP response
4. **Test Integration**: Verify the enhanced Info handler returns valid JSON
5. **Update Documentation**: Point users to the new self-documenting capabilities

### Backward Compatibility

ADP is fully backward compatible:

- Legacy processes continue to work with existing tools
- ADP-enabled tools fall back to templates for legacy processes
- No breaking changes to existing message patterns
- Standard Info fields remain unchanged

## Best Practices

### Handler Design

- Use descriptive action names
- Provide clear parameter descriptions and examples
- Include validation patterns for string parameters
- Categorize handlers (core, utility, custom)

### Parameter Validation

- Always validate required parameters
- Use appropriate parameter types
- Provide regex patterns for complex string formats
- Include example values to guide users

### Documentation

- Write clear, concise descriptions
- Provide multiple examples for complex handlers
- Keep handler metadata up to date
- Use consistent terminology across handlers

## Future Enhancements

### Version 1.1 Planning

- **Schema Validation**: JSON schema for handler definitions
- **Versioning**: Handler-level versioning support
- **Permissions**: Role-based handler access control
- **Events**: Handler event/notification metadata
- **Testing**: Built-in handler testing framework

### Community Adoption

- **Registry**: Public registry of ADP-compliant processes
- **Tooling**: IDE extensions and development tools
- **Standards**: Extended standards for specific process types
- **Analytics**: Usage analytics and optimization recommendations

## Conclusion

The AO Documentation Protocol represents a significant step forward in AO ecosystem usability and developer experience. By making processes self-documenting and discoverable, ADP enables a new generation of intelligent tools that can work with any compliant process without manual configuration.

The protocol is designed to be:

- **Simple** to implement
- **Powerful** in capabilities
- **Backward compatible** with existing processes
- **Future-proof** for ecosystem growth

We encourage all AO process developers to adopt ADP v1.0 and help build a more connected and discoverable AO ecosystem.
