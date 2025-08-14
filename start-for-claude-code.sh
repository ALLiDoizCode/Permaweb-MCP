#!/bin/bash
# Start Permamind MCP server for Claude Code

export ENABLE_AUTO_CONTEXT=false
export SEED_PHRASE="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
export CONTEXT_RETRY_ATTEMPTS=1

cd "$(dirname "$0")"

echo "Starting Permamind MCP Server for Claude Code..."
node bin/permamind.js