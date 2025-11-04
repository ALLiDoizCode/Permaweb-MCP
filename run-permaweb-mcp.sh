#!/bin/bash
# Script to run Permaweb MCP directly without global installation

cd "$(dirname "$0")"
node bin/permaweb-mcp.js "$@"