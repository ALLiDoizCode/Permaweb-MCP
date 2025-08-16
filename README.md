# Permamind 🧠⚡️

[![npm version](https://img.shields.io/npm/v/permamind.svg)](https://www.npmjs.com/package/permamind)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![AO](https://img.shields.io/badge/AO-Powered-orange.svg)](https://ao.arweave.dev/)
[![Arweave](https://img.shields.io/badge/Arweave-Permanent-purple.svg)](https://arweave.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-lightblue.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The world's first permanent, decentralized AI memory system built on Arweave and AO**

Permamind is a Model Context Protocol (MCP) server that provides an immortal memory layer for AI agents, leveraging Arweave's permanent storage and the AO ecosystem for decentralized computation. Unlike traditional memory systems that are ephemeral and centralized, Permamind creates truly persistent AI memory that survives forever.

## 🚀 Quick Start

### NPM Package Installation

```bash
# Install globally for CLI usage
npm install -g permamind

# Or install locally in your project
npm install permamind

# Start the MCP server
npx permamind
```

### MCP Server Setup

#### For Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "permamind": {
      "command": "npx",
      "args": ["permamind"],
      "env": {
        "SEED_PHRASE": "your twelve word mnemonic phrase here for deterministic wallet"
      }
    }
  }
}
```

#### For VS Code with Claude Code Extension

1. **Install Claude Code Extension**: Search for "Claude Code" in VS Code marketplace
2. **Configure MCP Server**: Add to your VS Code settings or workspace configuration:

```json
{
  "mcpServers": {
    "permamind": {
      "command": "npx",
      "args": ["permamind"],
      "env": {
        "SEED_PHRASE": "your twelve word mnemonic phrase here"
      }
    }
  }
}
```

### Environment Configuration

Create a `.env` file or set environment variables:

```bash
# Required: Deterministic wallet generation
SEED_PHRASE="your twelve word mnemonic phrase here"

# Optional: Development mode
NODE_ENV=development

# Optional: Enable automatic memory storage
MEMORY=true

# Optional: Enable automatic context loading
ENABLE_AUTO_CONTEXT=true
```

---

## 🌟 Why Permamind?

| Traditional AI Memory        | Permamind                        |
| ---------------------------- | -------------------------------- |
| ❌ Ephemeral sessions        | ✅ Permanent storage             |
| ❌ Centralized servers       | ✅ Decentralized AO network      |
| ❌ Limited context           | ✅ Unlimited knowledge graphs    |
| ❌ No cross-session learning | ✅ Continuous learning & memory  |
| ❌ Vendor lock-in            | ✅ Open, permissionless protocol |

## 🚀 Key Features

### 🧠 **Immortal AI Memory**

- **Permanent Storage**: All memories stored forever on Arweave blockchain
- **Permissionless**: No gatekeepers, true Web3 infrastructure
- **Cross-Agent Memory**: Shared knowledge between AI systems

### 🛠 **AO Integration**

- **Complete Process Lifecycle**: Create → Evaluate → Communicate
- **Natural Language Interface**: Talk to any AO process in plain English
- **Self-Documenting Processes**: Handler definitions [AO Documentation Protocol](specs/)
- **Token Operations**: Advanced minting strategies and DeFi primitives

### 🔧 **AO Documentation Protocol (ADP)**

Permamind introduces the **[AO Documentation Protocol](specs/)** - a standard that makes AO processes self-documenting:

- **Automatic Discovery**: Processes expose their capabilities without manual documentation
- **Zero Configuration**: Tools automatically understand any ADP-compliant process
- **Dynamic Interfaces**: Generate UIs and interactions from process metadata
- **Tag Validation**: Real-time validation before sending messages
- **Developer Experience**: Instant understanding of any process's interface

**Learn more**: [ADP Specification](specs/adp-specification.md) | [Token Blueprint](specs/token-blueprint-adp.md)

### 🎯 **Developer Experience**

- **MCP Native**: Works with Claude, VS Code, Cursor, and more
- **Zero Config**: Automatic wallet generation and hub deployment

---

### 📋 **Protocol Specifications**

- **[AO Documentation Protocol](specs/)** - Complete ADP specification
- **[Token Blueprint](specs/token-blueprint-adp.md)** - Self-documenting token example

### 🏗 **Advanced Topics**

- **[Architecture Overview](docs/architecture.md)** - Technical deep dive
- **[Custom Templates](docs/custom-templates.md)** - Extend functionality
- **[Performance Optimization](docs/performance.md)** - Scale your implementation
- **[Security Guide](docs/security.md)** - Best practices and hardening

---

**Core Components:**

- **MCP Server**: FastMCP-based server exposing AI memory and AO tools
- **AO Integration**: Direct communication with AO processes via ADP
- **Memory Services**: Memory storage and retrieval
- **ADP Discovery**: Automatic process capability detection and interface generation
- **Token System**: Advanced minting strategies with credit notice detection
- **Velocity Protocol**: Decentralized hub discovery and event routing

---

## 💡 Usage Examples

### Basic Memory Operations

```bash
# Store important information
"Remember that the API key for service X is stored in environment variable Y"

# Query memories
"What do you remember about API configurations?"

# Create knowledge relationships
"Link this debugging technique to the performance optimization category"
```

### AO Process Interaction

```bash
# Discover process capabilities (automatic with ADP)
"What can this process do?"
# → Permamind queries Info handler and shows all available operations

# Natural language interaction
"Transfer 100 tokens from my wallet to alice"
# → Permamind discovers Transfer handler, validates parameters, sends message

# Create new processes
"Create a new token called 'MyToken' with symbol 'MTK'"
# → Spawns new process with ADP-compliant token template
```

### Advanced Workflows

```bash
# Complex multi-step operations
"Create a DAO, mint governance tokens, and set up voting"

# Process monitoring
"Show me all messages for this token contract"

# Knowledge graph exploration
"Show me the relationship between memory A and concept B"
```

---

## 🔧 Configuration Options

### Environment Variables

```bash
# Core Configuration
SEED_PHRASE="your twelve word mnemonic phrase"     # Required for wallet
NODE_ENV="production"                              # production | development

# Memory Management
MEMORY=true                                        # Auto-store memories
CONTEXT_REFRESH_HOURS=24                          # Context refresh interval

# AO Integration
AO_SCHEDULER="https://ao-scheduler-url"           # Custom AO scheduler
AO_MODULE="custom-module-id"                      # Custom AO module

# Logging and Debug
DEBUG=true                                         # Enable debug mode
MCP_LOG_LEVEL=info                                # Logging level
```

### Advanced MCP Configuration

```json
{
  "mcpServers": {
    "permamind": {
      "command": "npx",
      "args": ["permamind"],
      "env": {
        "SEED_PHRASE": "your twelve word mnemonic phrase",
        "MEMORY": "true",
        "ENABLE_AUTO_CONTEXT": "true",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 🌐 Ecosystem & Links

### Core Technologies

- **[AO Cookbook](https://cookbook_ao.g8way.io/)** - AO development guide and compute layer
- **[Arweave](https://arweave.org/)** - Permanent data storage
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - AI tool standard
- **[FastMCP](https://github.com/jlowin/fastmcp)** - TypeScript MCP framework
- **[Velocity Protocol](https://github.com/SpaceTurtle-Dao/velocity-protocol)** - Decentralized social protocol

### Protocol Standards

- **[AO Documentation Protocol (ADP)](specs/)** - Self-documenting process standard
- **[AO Token Standard](https://cookbook_ao.g8way.io/references/token.html)** - Token implementation guide
- **[Arweave Name System (ArNS)](https://ar.io/arns/)** - Decentralized naming

### Community & Support

- **NPM Package**: https://www.npmjs.com/package/permamind
- **Discord Community**: [Join Discord](https://discord.gg/yDJFBtfS4K)
- **Twitter Updates**: [@permamind](https://x.com/permamind)

### Related Projects

- **[AO Cookbook](https://cookbook_ao.g8way.io/)** - AO development guide
- **[Arweave Cookbook](https://cookbook.arweave.dev/)** - Arweave development
- **[Claude Desktop](https://claude.ai/download)** - Primary MCP client
- **[VS Code Claude Extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code)** - Claude in VS Code

---

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](docs/contributing.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/permamind.git
cd permamind

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **AO & Arweave Teams** - For building the permanent compute and storage layers
- **Anthropic** - For creating the Model Context Protocol and Claude
- **FastMCP Contributors** - For the excellent TypeScript MCP framework
- **Community Contributors** - For feedback, testing, and contributions

---

<div align="center">

**🧠 Building the Future of AI Memory 🧠**

_Permanent • Decentralized • Self-Documenting_

[🚀 Install Now](#quick-start) • [📚 Read Specs](specs/) • [💡 See Examples](docs/examples.md) • [🤝 Join Community](https://discord.gg/permamind)

</div>
