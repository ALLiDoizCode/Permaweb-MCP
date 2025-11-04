#!/bin/bash
set -e

echo "🗑️  Uninstalling current global Permaweb MCP..."
sudo npm uninstall -g permaweb-mcp

echo "📦 Installing new Permaweb MCP version globally..."
sudo npm install -g ./permaweb-mcp-2.19.8.tgz

echo "✅ Successfully installed Permaweb MCP v2.19.8 globally!"
echo "🔄 Please restart Claude to use the updated version."

echo ""
echo "📋 New version includes:"
echo "  ✅ Lazy AO connection initialization (respects NODE_ENV timing)"
echo "  ✅ Removed scheduler parameters (per AO documentation)"
echo "  ✅ Proper error logging to MCP logs"
echo "  ✅ NODE_ENV=production defaults (uses mainnet)"
echo ""
echo "🧪 Test with: permaweb-mcp --test"