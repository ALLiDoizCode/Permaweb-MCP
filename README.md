# Permamind 🧠⚡️

[![npm version](https://img.shields.io/npm/v/permamind.svg)](https://www.npmjs.com/package/permamind)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![AO](https://img.shields.io/badge/AO-Powered-orange.svg)](https://ao.arweave.dev/)
[![Arweave](https://img.shields.io/badge/Arweave-Permanent-purple.svg)](https://arweave.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-lightblue.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A streamlined MCP server for AO process management, Arweave deployment, and ArNS domain operations**

Permamind is a Model Context Protocol (MCP) server that provides core infrastructure for interacting with the AO ecosystem and Arweave network. Built with TypeScript and FastMCP, it delivers 15 essential tools across 4 categories: Process management, Arweave deployment, wallet operations, and ArNS domain management.

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
```

---

## 🌟 Why Permamind?

| Manual AO Interaction        | Permamind                      |
| ---------------------------- | ------------------------------ |
| ❌ Complex CLI commands      | ✅ Natural MCP integration     |
| ❌ Manual process management | ✅ Streamlined process tools   |
| ❌ Difficult deployments     | ✅ One-command Arweave uploads |
| ❌ ArNS CLI complexity       | ✅ Simple domain management    |
| ❌ Fragmented tooling        | ✅ Unified MCP interface       |

## 🚀 Key Features

### 🔧 **Process Management (4 Tools)**

- **spawnProcess**: Create new AO processes with custom configurations
- **sendAOMessage**: Send messages with custom tags and data to processes
- **readAOProcess**: Read process state via dryrun queries (read-only)
- **queryAOProcessMessages**: Query and filter process message history

### 📦 **Arweave Deployment (4 Tools)**

- **deployPermawebDirectory**: Deploy entire directories to Permaweb
- **checkPermawebDeployPrerequisites**: Verify deployment requirements
- **uploadToArweave**: Upload single files to Arweave
- **uploadFolderToArweave**: Upload folders with automatic file handling

### 💰 **Wallet Operations (2 Tools)**

- **generateKeypair**: Generate Arweave keypair from seed phrase
- **getUserPublicKey**: Get user's public key (wallet address)

### 🌐 **ArNS Management (6 Tools)**

- **buyArnsRecord**: Purchase ArNS names (lease or permanent)
- **getArnsRecordInfo**: Fetch ArNS record details and configurations
- **getArnsTokenCost**: Query current ArNS pricing
- **resolveArnsName**: Resolve ArNS name to transaction ID
- **transferArnsRecord**: Transfer ArNS record ownership
- **updateArnsRecord**: Update ArNS record properties

### 🎯 **Developer Experience**

- **MCP Native**: Works with Claude Desktop, VS Code, Cursor, and more
- **TypeScript Built**: Full type safety and modern development experience
- **Zero Config**: Automatic wallet generation from mnemonic phrase

---

### 📋 **Core Architecture**

**Components:**

- **MCP Server**: FastMCP-based server exposing 16 tools across 4 categories
- **AO Integration**: Direct communication with AO processes via @permaweb/aoconnect
- **Arweave Deployment**: File and directory uploads via Turbo SDK
- **ArNS Management**: Comprehensive domain operations via AR.IO SDK
- **Service Layer**: 12 specialized services supporting tool operations

---

## 💡 Usage Examples

### Process Management

```bash
# Create a new AO process
"Spawn a new AO process with the default module and scheduler"

# Deploy Lua code to a process
"Send a message to process xyz123 with Action: Eval and this Lua code: Handlers.add('ping', ...)"

# Read process state
"Read the state of process xyz123 using a dryrun query"

# Query process messages
"Show me the last 50 messages for process xyz123"
```

### Arweave Deployment

```bash
# Upload a single file
"Upload my-file.json to Arweave"

# Deploy a directory to Permaweb
"Deploy the ./dist directory to Permaweb with index.html as the entry point"

# Check deployment prerequisites
"Check if I have the necessary prerequisites to deploy to Permaweb"
```

### ArNS Domain Management

```bash
# Get domain information
"Get the ArNS record for 'example'"

# Purchase an ArNS name
"Purchase the ArNS name 'myapp' as a permabuy"

# Manage domain settings
"Increase the undername limit for 'myapp' by 10"
```

---

## 🔧 Configuration Options

### Environment Variables

```bash
# Core Configuration
SEED_PHRASE="your twelve word mnemonic phrase"     # Required for wallet
NODE_ENV="production"                              # production | development

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
- **[AR.IO SDK](https://github.com/ar-io/ar-io-sdk)** - ArNS and gateway operations

### Protocol Standards

- **[AO Specification](https://ao.arweave.dev/)** - AO compute layer specification
- **[Arweave Name System (ArNS)](https://ar.io/arns/)** - Decentralized naming system
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - AI tool integration standard

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

**🚀 Streamlined MCP Server for AO & Arweave 🚀**

_Process Management • Arweave Deployment • ArNS Domains_

[🚀 Install Now](#quick-start) • [💡 See Examples](#-usage-examples) • [🤝 Join Community](https://discord.gg/yDJFBtfS4K)

</div>
