# Natural Language Service Integration

**Enable your AO process to work with Claude Desktop using only markdown documentation.**

## Overview

The ProcessCommunicationService allows any AO process developer to make their process accessible to Claude Desktop users through natural language interaction. Instead of manually creating MCP tools, developers simply provide a markdown description of their process handlers, and users can interact with the process using plain English.

## How It Works

1. **Process Developer**: Creates markdown documentation describing their AO process handlers
2. **Claude Desktop User**: Uses the `executeProcessAction` tool with natural language requests
3. **Permamind**: Automatically parses the documentation, interprets the request, formats AO messages, and executes them
4. **Process**: Receives properly formatted messages and responds normally

## Quick Start

### For Process Developers

1. **Document your process** using the markdown template (see below)
2. **Share the markdown** with users along with your process ID
3. **That's it!** - Users can now interact with your process naturally

### For Claude Desktop Users

```javascript
// Use the executeProcessAction tool
executeProcessAction({
  processId: "your-process-id-here",
  processMarkdown: "# Your Process Documentation...",
  request: "Send 100 tokens to alice with memo 'payment'",
});
```

## Markdown Template

Use this template to document your AO process:

```markdown
# [Process Name]

Brief description of what your process does.

## [handler_name]

Description of what this handler does

- parameter1: description (required/optional)
- parameter2: description with type hints (required)
- parameter3: optional parameter description (optional)

Example usage or additional details (optional)

## [another_handler]

Another handler description

- param1: description (required)
- param2: description (optional)

## [read_handler]

Handler for reading data (no state changes)

- query: what to search for (optional)
```

### Template Rules

1. **Process name** in main heading (`# Process Name`)
2. **Handler names** as level 2 headings (`## handler_name`)
3. **Parameters** as bullet points with colons (`- param: description`)
4. **Required/Optional** indicators in parameter descriptions
5. **Type hints** in parameter descriptions (number, boolean, etc.)

## Real-World Examples

### Token Process

```markdown
# Token Process

A simple token contract for transfers and balance queries.

## transfer

Transfer tokens from your account to another user

- recipient: wallet address to send tokens to (required)
- amount: number of tokens to transfer (required)
- memo: optional message to include with transfer (optional)

## balance

Get the current token balance for an account

- account: wallet address to check balance (optional, defaults to caller)

## mint

Create new tokens (admin only)

- recipient: address to receive new tokens (required)
- amount: number of tokens to create (required)
```

**Usage Examples:**

- "Send 100 tokens to abc123 with memo 'payment for services'"
- "Check balance for xyz789"
- "What's my current balance?"
- "Mint 1000 tokens for alice"

### NFT Marketplace

```markdown
# NFT Marketplace

Buy, sell, and trade NFTs with escrow protection.

## list_nft

List an NFT for sale on the marketplace

- nft_id: unique identifier of the NFT (required)
- price: sale price in tokens (required)
- description: optional description of the NFT (optional)

## buy_nft

Purchase a listed NFT

- nft_id: identifier of the NFT to purchase (required)
- max_price: maximum price willing to pay (optional)

## cancel_listing

Remove your NFT from the marketplace

- nft_id: identifier of the NFT to remove (required)

## get_listings

View all NFTs currently for sale

- category: filter by NFT category (optional)
- max_price: maximum price filter (optional)
- seller: filter by seller address (optional)
```

**Usage Examples:**

- "List my NFT #1234 for 50 tokens with description 'Rare digital art'"
- "Buy NFT #5678 for up to 100 tokens"
- "Show me all NFTs under 25 tokens"
- "Cancel listing for NFT #1234"

### DAO Governance

```markdown
# DAO Governance

Decentralized governance for proposal voting and execution.

## create_proposal

Submit a new proposal for voting

- title: short proposal title (required)
- description: detailed proposal description (required)
- execution_delay: days to wait before execution (optional, defaults to 3)
- category: proposal category like 'treasury' or 'governance' (optional)

## vote

Cast your vote on an active proposal

- proposal_id: identifier of the proposal (required)
- vote: your vote - 'yes', 'no', or 'abstain' (required)
- reason: optional reason for your vote (optional)

## execute_proposal

Execute a passed proposal

- proposal_id: identifier of the proposal to execute (required)

## get_proposals

View proposals by status

- status: filter by 'active', 'passed', 'failed', or 'executed' (optional)
- category: filter by proposal category (optional)

## delegate_voting_power

Delegate your voting power to another member

- delegate: address to delegate voting power to (required)
- duration: delegation duration in days (optional, defaults to 30)
```

**Usage Examples:**

- "Create a proposal titled 'Treasury Allocation' with description 'Allocate 10000 tokens for development funding'"
- "Vote yes on proposal #5 with reason 'Good for project growth'"
- "Show me all active proposals"
- "Delegate my voting power to alice for 60 days"

### DeFi Liquidity Pool

```markdown
# Liquidity Pool

Automated market maker for token swapping and liquidity provision.

## add_liquidity

Add liquidity to the pool and receive LP tokens

- token_a_amount: amount of first token to add (required)
- token_b_amount: amount of second token to add (required)
- min_lp_tokens: minimum LP tokens to receive (optional)

## remove_liquidity

Remove liquidity from the pool

- lp_tokens: amount of LP tokens to burn (required)
- min_token_a: minimum amount of token A to receive (optional)
- min_token_b: minimum amount of token B to receive (optional)

## swap

Swap one token for another

- token_in: token to sell (required)
- amount_in: amount to sell (required)
- token_out: token to buy (required)
- min_amount_out: minimum amount to receive (optional)

## get_reserves

Check current pool reserves and prices

- No parameters required

## get_price

Get current exchange rate between tokens

- token_in: input token (required)
- token_out: output token (required)
- amount: amount to price (optional, defaults to 1)
```

**Usage Examples:**

- "Add 1000 TokenA and 2000 TokenB as liquidity"
- "Swap 100 TokenA for TokenB with minimum 180 TokenB"
- "Remove 50 LP tokens from the pool"
- "What's the current price to swap TokenA for TokenB?"

## Best Practices

### For Process Developers

#### Handler Design

- **Use clear, descriptive names** - `transfer` instead of `tx`
- **Keep parameters simple** - Avoid complex nested objects
- **Provide good descriptions** - Users need to understand what each handler does
- **Include type hints** - "number of tokens", "wallet address", "boolean flag"
- **Mark required vs optional** - Be explicit about required parameters

#### Parameter Naming

- **Use common terms** - `recipient`, `amount`, `address` instead of abbreviated versions
- **Be consistent** - Use the same parameter names across handlers
- **Avoid technical jargon** - Use user-friendly language
- **Include validation hints** - "positive number", "valid address format"

#### Documentation Structure

```markdown
# Clear Process Name

Brief overview of what the process does.

## actionName

Clear description of what this action accomplishes

- param1: clear description with type (required)
- param2: optional parameter description (optional)

Additional context or examples if helpful.
```

#### Error Handling

- **Return meaningful errors** - Help users understand what went wrong
- **Validate inputs** - Check parameter formats and ranges
- **Provide suggestions** - Tell users how to fix problems
- **Use standard error patterns** - Follow AO error conventions

### For Claude Desktop Users

#### Writing Effective Requests

- **Be specific** - Include exact amounts, addresses, and identifiers
- **Use natural language** - "Send 100 tokens to alice" works better than abbreviated forms
- **Include all required info** - Reference the process documentation for required parameters
- **Ask for clarification** - If unsure about parameters, ask the process developer

#### Parameter Extraction Tips

The service recognizes these patterns:

- **Amount patterns**: "send 100", "transfer 50 tokens", "amount: 25"
- **Address patterns**: "to alice", "recipient: abc123", "address xyz789"
- **Memo patterns**: "with memo 'text'", "message: 'text'", "note 'text'"
- **Action patterns**: Handler names in your request

## Advanced Features

### Automatic Type Detection

The service automatically detects parameter types from descriptions:

- **Numbers**: "amount", "count", "price", "quantity"
- **Addresses**: "address", "recipient", "sender", "account"
- **Booleans**: "flag", "enable", "disable", "true/false"
- **Strings**: Default type for most parameters

### Smart Parameter Extraction

The service uses multiple strategies to extract parameters:

1. **Explicit patterns**: "amount: 100", "recipient = alice"
2. **Natural language**: "send 100 to alice"
3. **Context clues**: "100 tokens" → amount, "alice" → recipient
4. **Position-based**: First number might be amount, first address might be recipient

### Read vs Write Detection

The service automatically determines if a handler requires signing:

**Write operations** (require signing):

- send, transfer, create, update, delete, set, add, remove
- mint, burn, stake, withdraw, deposit, register, vote

**Read operations** (no signing required):

- get, fetch, read, check, balance, info, status, list
- query, view, show, find

## Troubleshooting

### Common Issues

**"Could not match request to any available handler"**

- Check that your request mentions the handler name or related keywords
- Verify the markdown documentation includes the handler you're trying to use
- Try rephrasing your request to be more explicit

**"Missing required parameter"**

- Ensure all required parameters are included in your request
- Check the markdown documentation for required vs optional parameters
- Try being more explicit: "send 100 tokens to alice" instead of "send to alice"

**"Process execution failed"**

- The AO process returned an error
- Check that the process ID is correct and the process is active
- Verify parameter values are valid (correct addresses, sufficient balances, etc.)

**"Parameter extraction failed"**

- The service couldn't extract a parameter from your request
- Try using more explicit formats: "amount: 100" instead of just "100"
- Include parameter names in your request when possible

### Debugging Tips

1. **Start simple** - Test with basic requests first
2. **Check process documentation** - Ensure markdown accurately describes handlers
3. **Use explicit parameter names** - "recipient: alice, amount: 100"
4. **Test read operations first** - They don't require signing and are easier to debug
5. **Verify process ID** - Make sure you're using the correct process identifier

## Examples in Action

### Token Transfer Example

**Process Documentation:**

```markdown
# MyToken

Simple token contract for transfers and balances.

## transfer

Send tokens to another user

- recipient: wallet address (required)
- amount: number of tokens (required)
- memo: optional transfer memo (optional)

## balance

Check token balance

- account: wallet address to check (optional)
```

**User Request:** "Send 100 tokens to alice with memo 'payment'"

**Generated AO Message:**

```javascript
{
  processId: "token-process-id",
  tags: [
    { name: "Action", value: "transfer" },
    { name: "Recipient", value: "alice" },
    { name: "Amount", value: "100" },
    { name: "Memo", value: "payment" }
  ]
}
```

### NFT Listing Example

**User Request:** "List NFT #1234 for 50 tokens"

**Generated AO Message:**

```javascript
{
  processId: "nft-marketplace-id",
  tags: [
    { name: "Action", value: "list_nft" },
    { name: "Nft_id", value: "1234" },
    { name: "Price", value: "50" }
  ]
}
```

## Integration with Claude Desktop

The ProcessCommunicationService is exposed through the `executeProcessAction` MCP tool:

```typescript
// Tool definition
{
  name: "executeProcessAction",
  description: "Execute an action on any AO process using natural language",
  parameters: {
    processId: "The AO process ID to communicate with",
    processMarkdown: "Markdown documentation describing the process handlers",
    request: "Natural language request describing what action to perform"
  }
}
```

This enables seamless integration where users can:

1. Discover new AO processes through community sharing
2. Interact with any documented process using natural language
3. Build complex workflows combining multiple processes
4. Access the full AO ecosystem through Claude Desktop

## Contributing

### Improving the Service

The ProcessCommunicationService can be enhanced to support:

- **Better parameter extraction** - More sophisticated NLS patterns
- **Type validation** - Runtime parameter type checking
- **Response formatting** - Better interpretation of process responses
- **Error handling** - More helpful error messages and suggestions
- **Documentation validation** - Check markdown format and completeness

### Community Documentation

Help build a library of well-documented AO processes:

- Share your process documentation using the standard template
- Provide usage examples and common patterns
- Report issues with parameter extraction or request matching
- Suggest improvements to the markdown template

### Process Examples

We encourage the community to create and share:

- **Reference implementations** - Well-documented example processes
- **Documentation templates** - Specialized templates for different process types
- **Integration guides** - How to connect multiple processes
- **Best practices** - Lessons learned from real-world usage

---

**Build once, integrate everywhere** - Make your AO process accessible to AI agents with just markdown documentation.
