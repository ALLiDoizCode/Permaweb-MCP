#!/bin/bash
# Start Permaweb MCP server for Claude Code

export ENABLE_AUTO_CONTEXT=false
export SEED_PHRASE="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
export CONTEXT_RETRY_ATTEMPTS=1

cd "$(dirname "$0")"

echo "Starting Permaweb MCP Server for Claude Code..."
node bin/permaweb-mcp.js