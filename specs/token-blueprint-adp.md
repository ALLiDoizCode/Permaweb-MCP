# AO Token Blueprint with Documentation Protocol (ADP)

## Overview

This document provides a complete implementation of an AO Token using the AO Documentation Protocol (ADP) v1.0. The token blueprint demonstrates how to create a self-documenting, discoverable AO process that automatically exposes its capabilities and interface through standardized metadata.

## Token Implementation

### Process Information

- **Name**: Example Protocol Token
- **Ticker**: EPT
- **Description**: A demonstration token implementing the AO Handler Registry Protocol
- **Denomination**: 12 (supports fractional tokens)
- **Total Supply**: 1,000,000 EPT
- **Features**: Transferable, Burnable, Mintable

### Complete Lua Implementation

```lua
-- AO Token with Documentation Protocol (ADP) v1.0
-- Name: Example Protocol Token (EPT)
-- Self-documenting token with automatic API documentation

local json = require('json')
local bint = require('.bint')(256)

-- Token State Variables
Name = "Example Protocol Token"
Ticker = "EPT"
Logo = "https://example.com/ept-logo.png"
Description = "A demonstration token implementing the AO Handler Registry Protocol"
Denomination = 12
TotalSupply = "1000000000000000000"
Owner = "vh-owner-address-here"
Transferable = true
Burnable = true

-- Token Balances
Balances = {
    [Owner] = TotalSupply
}

-- Utility Functions
local function addBalance(address, amount)
    local currentBalance = bint(Balances[address] or "0")
    Balances[address] = tostring(bint.__add(currentBalance, bint(amount)))
end

local function subtractBalance(address, amount)
    local currentBalance = bint(Balances[address] or "0")
    Balances[address] = tostring(bint.__sub(currentBalance, bint(amount)))
end

-- Enhanced Info Handler with ADP v1.0
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    local infoResponse = {
        -- Standard Token Information
        Name = Name,
        Ticker = Ticker,
        Logo = Logo,
        Description = Description,
        Denomination = tostring(Denomination),
        TotalSupply = TotalSupply,
        Owner = Owner,
        Transferable = Transferable,
        Burnable = Burnable,
        ProcessId = ao.id,

        -- ADP Protocol Fields
        protocolVersion = "1.0",
        lastUpdated = "2024-01-15T10:30:00.000Z",
        capabilities = {
            supportsHandlerRegistry = true,
            supportsParameterValidation = true,
            supportsExamples = true
        },

        -- Handler Metadata
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
                tags = {
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
                action = "Balances",
                pattern = {"Action"},
                description = "Get all token balances",
                examples = {"Get all holder balances"},
                category = "utility"
            },
            {
                action = "Transfer",
                pattern = {"Action"},
                tags = {
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
            },
            {
                action = "Mint",
                pattern = {"Action"},
                tags = {
                    {
                        name = "Quantity",
                        type = "string",
                        required = true,
                        description = "Amount to mint (in token units)",
                        examples = {"100", "1000000000000"},
                        validation = {
                            pattern = "^[0-9]+$"
                        }
                    },
                    {
                        name = "Target",
                        type = "address",
                        required = false,
                        description = "Recipient address (defaults to sender)",
                        examples = {"vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"}
                    }
                },
                description = "Mint new tokens (requires owner permissions)",
                examples = {"Mint 100 tokens to address"},
                category = "core"
            },
            {
                action = "Burn",
                pattern = {"Action"},
                tags = {
                    {
                        name = "Quantity",
                        type = "string",
                        required = true,
                        description = "Amount to burn (in token units)",
                        examples = {"100", "1000000000000"},
                        validation = {
                            pattern = "^[0-9]+$"
                        }
                    }
                },
                description = "Burn tokens from sender's balance",
                examples = {"Burn 100 tokens"},
                category = "utility"
            }
        }
    }

    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
end)

-- Balance Handler
Handlers.add('Balance', Handlers.utils.hasMatchingTag('Action', 'Balance'), function(msg)
    local target = msg.Tags.Target or msg.From
    local balance = Balances[target] or "0"

    ao.send({
        Target = msg.From,
        Data = json.encode({
            Account = target,
            Balance = balance,
            Ticker = Ticker,
            Data = balance
        })
    })
end)

-- Balances Handler
Handlers.add('Balances', Handlers.utils.hasMatchingTag('Action', 'Balances'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode(Balances)
    })
end)

-- Transfer Handler
Handlers.add('Transfer', Handlers.utils.hasMatchingTag('Action', 'Transfer'), function(msg)
    assert(type(msg.Tags.Target) == 'string', 'Target is required')
    assert(type(msg.Tags.Quantity) == 'string', 'Quantity is required')

    local target = msg.Tags.Target
    local quantity = bint(msg.Tags.Quantity)
    local senderBalance = bint(Balances[msg.From] or "0")

    -- Validation
    assert(quantity > bint(0), 'Quantity must be greater than 0')
    assert(senderBalance >= quantity, 'Insufficient balance')
    assert(target ~= msg.From, 'Cannot transfer to self')

    -- Execute transfer
    subtractBalance(msg.From, tostring(quantity))
    addBalance(target, tostring(quantity))

    -- Send confirmation to sender
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Status = "Success",
            Message = "Transfer completed",
            From = msg.From,
            To = target,
            Quantity = tostring(quantity),
            NewBalance = Balances[msg.From]
        })
    })

    -- Notify recipient
    ao.send({
        Target = target,
        Data = json.encode({
            Status = "Received",
            Message = "Tokens received",
            From = msg.From,
            Quantity = tostring(quantity),
            NewBalance = Balances[target]
        })
    })
end)

-- Mint Handler (Owner only)
Handlers.add('Mint', Handlers.utils.hasMatchingTag('Action', 'Mint'), function(msg)
    assert(msg.From == Owner, 'Only owner can mint tokens')
    assert(type(msg.Tags.Quantity) == 'string', 'Quantity is required')

    local quantity = bint(msg.Tags.Quantity)
    local target = msg.Tags.Target or msg.From

    -- Validation
    assert(quantity > bint(0), 'Quantity must be greater than 0')

    -- Execute mint
    addBalance(target, tostring(quantity))
    TotalSupply = tostring(bint.__add(bint(TotalSupply), quantity))

    -- Send confirmation
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Status = "Success",
            Message = "Tokens minted",
            Target = target,
            Quantity = tostring(quantity),
            NewBalance = Balances[target],
            NewTotalSupply = TotalSupply
        })
    })

    -- Notify recipient if different from sender
    if target ~= msg.From then
        ao.send({
            Target = target,
            Data = json.encode({
                Status = "Minted",
                Message = "Tokens minted to your account",
                Quantity = tostring(quantity),
                NewBalance = Balances[target]
            })
        })
    end
end)

-- Burn Handler
Handlers.add('Burn', Handlers.utils.hasMatchingTag('Action', 'Burn'), function(msg)
    assert(type(msg.Tags.Quantity) == 'string', 'Quantity is required')

    local quantity = bint(msg.Tags.Quantity)
    local senderBalance = bint(Balances[msg.From] or "0")

    -- Validation
    assert(quantity > bint(0), 'Quantity must be greater than 0')
    assert(senderBalance >= quantity, 'Insufficient balance to burn')

    -- Execute burn
    subtractBalance(msg.From, tostring(quantity))
    TotalSupply = tostring(bint.__sub(bint(TotalSupply), quantity))

    -- Send confirmation
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Status = "Success",
            Message = "Tokens burned",
            Quantity = tostring(quantity),
            NewBalance = Balances[msg.From],
            NewTotalSupply = TotalSupply
        })
    })
end)

-- Total Supply Handler
Handlers.add('TotalSupply', Handlers.utils.hasMatchingTag('Action', 'TotalSupply'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode({
            TotalSupply = TotalSupply,
            Ticker = Ticker
        })
    })
end)

print("AO Token with ADP v1.0 loaded successfully")
print("Token: " .. Name .. " (" .. Ticker .. ")")
print("Protocol Version: 1.0")
print("Total Supply: " .. TotalSupply)
print("Handlers: Info, Balance, Balances, Transfer, Mint, Burn, TotalSupply")
```

## Handler Documentation

### Core Handlers

#### Info

- **Purpose**: Get comprehensive token information and handler metadata
- **Tags**: None
- **Returns**: Extended info response with AHRP metadata
- **Example**: Send message with `Action: Info`

#### Balance

- **Purpose**: Get token balance for a specific address
- **Tags**:
  - `Target` (optional): Address to check (defaults to sender)
- **Returns**: Balance information
- **Example**: `Action: Balance, Target: vh-address`

#### Transfer

- **Purpose**: Transfer tokens to another address
- **Tags**:
  - `Target` (required): Recipient address
  - `Quantity` (required): Amount to transfer
- **Validation**: Sufficient balance, positive amount, valid address
- **Example**: `Action: Transfer, Target: vh-address, Quantity: 100`

### Administrative Handlers

#### Mint

- **Purpose**: Mint new tokens (owner only)
- **Tags**:
  - `Quantity` (required): Amount to mint
  - `Target` (optional): Recipient address (defaults to sender)
- **Permissions**: Owner only
- **Example**: `Action: Mint, Quantity: 1000, Target: vh-address`

#### Burn

- **Purpose**: Burn tokens from sender's balance
- **Tags**:
  - `Quantity` (required): Amount to burn
- **Validation**: Sufficient balance, positive amount
- **Example**: `Action: Burn, Quantity: 100`

### Utility Handlers

#### Balances

- **Purpose**: Get all token balances
- **Tags**: None
- **Returns**: Complete balance mapping
- **Example**: `Action: Balances`

#### TotalSupply

- **Purpose**: Get current total supply
- **Tags**: None
- **Returns**: Total supply information
- **Example**: `Action: TotalSupply`

## Integration with Tools

### Permamind Integration

With ADP support, this token can be used with Permamind's `executeAction` tool:

```bash
# Automatic handler discovery
permamind executeAction processId="token-process-id" request="get my balance"

# Natural language requests
permamind executeAction processId="token-process-id" request="transfer 100 tokens to alice"

# Mint tokens (if owner)
permamind executeAction processId="token-process-id" request="mint 1000 tokens"
```

### Client Applications

Applications can discover handlers automatically:

1. **Send Info Message**: Query the token process with `Action: Info`
2. **Parse Response**: Check for `protocolVersion: "1.0"` and handler metadata
3. **Generate Interface**: Create forms/UI based on handler tag definitions
4. **Validate Input**: Use tag constraints to validate user input before sending
5. **Send Messages**: Construct proper AO messages with required tags

Example flow:

- User wants to transfer tokens
- App finds Transfer handler in metadata
- App generates form with Target and Quantity fields
- App validates input against tag constraints
- App sends message with proper tags

## Protocol Benefits

### Self-Documentation

- No separate API documentation needed
- Always up-to-date handler information
- Consistent interface across all ADP tokens

### Developer Experience

- Auto-completion in tools
- Tag validation before sending
- Clear error messages and examples

### Tool Integration

- Automatic UI generation
- Dynamic handler discovery
- Standardized interaction patterns

## Deployment Guide

### 1. Process Creation

```bash
# Spawn new AO process
aos --spawn

# Load the token blueprint
.load token-ahrp-blueprint.lua
```

### 2. Verification

```bash
# Test Info handler
send({ Target = ao.id, Action = "Info" })

# Verify ADP compliance
# Should return protocolVersion: "1.0" and handlers array
```

### 3. Initial Configuration

```bash
# Update owner address
Owner = "your-wallet-address"

# Set initial balances
Balances = { [Owner] = TotalSupply }

# Customize token details
Name = "Your Token Name"
Ticker = "YOUR"
Logo = "https://your-domain.com/logo.png"
```

## Best Practices

### Security

- Always validate input tags
- Implement proper access controls for administrative functions
- Use assertion-based error handling
- Validate addresses and amounts

### Performance

- Use efficient balance operations with bint
- Minimize state changes per transaction
- Implement proper event notifications

### Usability

- Provide clear error messages
- Include comprehensive examples in handler metadata
- Follow consistent naming conventions
- Document all validation rules

## Conclusion

This token blueprint demonstrates the power of the AO Documentation Protocol in creating self-documenting, discoverable AO processes. By implementing ADP, tokens become immediately compatible with intelligent tools and provide a superior developer experience while maintaining full backward compatibility with existing AO infrastructure.
