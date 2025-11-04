#!/bin/bash
set -e

echo "🔧 Updating global Permaweb MCP installation..."

# Check if we have the package extracted
if [ ! -d "package" ]; then
    echo "❌ Package directory not found. Please run this from the Permaweb MCP project directory where package/ exists."
    exit 1
fi

# Check if global installation exists
if [ ! -d "/usr/local/lib/node_modules/permaweb-mcp" ]; then
    echo "❌ Global Permaweb MCP installation not found at /usr/local/lib/node_modules/permaweb-mcp"
    exit 1
fi

echo "📋 Creating backups..."
sudo cp /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp.js /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp.js.backup
sudo cp /usr/local/lib/node_modules/permaweb-mcp/dist/server.js /usr/local/lib/node_modules/permaweb-mcp/dist/server.js.backup
sudo cp /usr/local/lib/node_modules/permaweb-mcp/dist/process.js /usr/local/lib/node_modules/permaweb-mcp/dist/process.js.backup
sudo cp /usr/local/lib/node_modules/permaweb-mcp/dist/constants.js /usr/local/lib/node_modules/permaweb-mcp/dist/constants.js.backup

echo "📦 Copying updated files..."
sudo cp package/bin/permaweb-mcp.js /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp.js
sudo cp package/bin/permaweb-mcp-setup.js /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp-setup.js
sudo cp -r package/dist/* /usr/local/lib/node_modules/permaweb-mcp/dist/
sudo cp package/package.json /usr/local/lib/node_modules/permaweb-mcp/package.json

echo "🔒 Setting correct permissions..."
sudo chown -R root:wheel /usr/local/lib/node_modules/permaweb-mcp/
sudo chmod +x /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp.js
sudo chmod +x /usr/local/lib/node_modules/permaweb-mcp/bin/permaweb-mcp-setup.js

echo "✅ Global Permaweb MCP installation updated successfully!"
echo "🔄 Please restart Claude to use the updated version."
echo ""
echo "📋 Updated with fixes:"
echo "  • Lazy AO connection initialization (respects NODE_ENV timing)"
echo "  • Removed scheduler parameters (per AO documentation)"
echo "  • Proper error logging to MCP logs"
echo "  • NODE_ENV=production defaults (uses mainnet)"