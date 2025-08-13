#!/bin/bash
set -e

echo "🔧 Updating global Permamind installation..."

# Check if we have the package extracted
if [ ! -d "package" ]; then
    echo "❌ Package directory not found. Please run this from the Permamind project directory where package/ exists."
    exit 1
fi

# Check if global installation exists
if [ ! -d "/usr/local/lib/node_modules/permamind" ]; then
    echo "❌ Global Permamind installation not found at /usr/local/lib/node_modules/permamind"
    exit 1
fi

echo "📋 Creating backups..."
sudo cp /usr/local/lib/node_modules/permamind/bin/permamind.js /usr/local/lib/node_modules/permamind/bin/permamind.js.backup
sudo cp /usr/local/lib/node_modules/permamind/dist/server.js /usr/local/lib/node_modules/permamind/dist/server.js.backup
sudo cp /usr/local/lib/node_modules/permamind/dist/process.js /usr/local/lib/node_modules/permamind/dist/process.js.backup
sudo cp /usr/local/lib/node_modules/permamind/dist/constants.js /usr/local/lib/node_modules/permamind/dist/constants.js.backup

echo "📦 Copying updated files..."
sudo cp package/bin/permamind.js /usr/local/lib/node_modules/permamind/bin/permamind.js
sudo cp package/bin/permamind-setup.js /usr/local/lib/node_modules/permamind/bin/permamind-setup.js
sudo cp -r package/dist/* /usr/local/lib/node_modules/permamind/dist/
sudo cp package/package.json /usr/local/lib/node_modules/permamind/package.json

echo "🔒 Setting correct permissions..."
sudo chown -R root:wheel /usr/local/lib/node_modules/permamind/
sudo chmod +x /usr/local/lib/node_modules/permamind/bin/permamind.js
sudo chmod +x /usr/local/lib/node_modules/permamind/bin/permamind-setup.js

echo "✅ Global Permamind installation updated successfully!"
echo "🔄 Please restart Claude to use the updated version."
echo ""
echo "📋 Updated with fixes:"
echo "  • Lazy AO connection initialization (respects NODE_ENV timing)"
echo "  • Removed scheduler parameters (per AO documentation)"
echo "  • Proper error logging to MCP logs"  
echo "  • NODE_ENV=production defaults (uses mainnet)"