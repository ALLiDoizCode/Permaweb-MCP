# Quick Start: Natural Language Service Integration

**Get your AO process working with Claude Desktop in 5 minutes.**

## For Process Developers

### Step 1: Document Your Process

Create a markdown file describing your process handlers:

```markdown
# My Token

Simple token for transfers and balances.

## transfer

Send tokens to another user

- recipient: wallet address (required)
- amount: number of tokens (required)
- memo: optional message (optional)

## balance

Check token balance

- account: wallet address (optional, defaults to caller)
```

### Step 2: Share With Users

Give users:

1. Your process ID: `abc123...`
2. Your markdown documentation

That's it! Users can now interact with your process using natural language.

## For Claude Desktop Users

### Using Any AO Process

```javascript
// Use the executeProcessAction tool
executeProcessAction({
  processId: "abc123...",
  processMarkdown: "# My Token\n\n## transfer\n...", // paste the process docs
  request: "Send 100 tokens to alice",
});
```

### Example Interactions

**Token Process:**

- "Send 100 tokens to alice with memo 'payment'"
- "Check balance for xyz789"
- "What's my current balance?"

**NFT Marketplace:**

- "List my NFT #1234 for 50 tokens"
- "Buy NFT #5678"
- "Show me all NFTs under 25 tokens"

**DAO Governance:**

- "Vote yes on proposal #5"
- "Create proposal 'Fund Development' with description '...'"
- "Show me all active proposals"

## How It Works

1. **You provide** markdown documentation of your process
2. **Permamind parses** the documentation to understand available handlers
3. **User makes request** in natural language
4. **Permamind extracts** parameters and formats AO messages
5. **Process receives** properly formatted messages and responds

## Template

Copy this template to document your process:

```markdown
# [Process Name]

Brief description.

## [action_name]

What this action does

- param1: description (required)
- param2: description (optional)

## [another_action]

Another action description

- param1: description (required)
```

## Need Help?

- **Template**: See [process-template.md](process-template.md)
- **Examples**: Check [examples/](../examples/) folder
- **Full Guide**: Read [PROCESS_INTEGRATION.md](PROCESS_INTEGRATION.md)
- **Issues**: Report on [GitHub](https://github.com/ALLiDoizCode/Permamind/issues)

---

**Make your AO process accessible to AI agents with just markdown documentation!**
