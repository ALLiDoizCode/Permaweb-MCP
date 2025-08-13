#!/bin/bash
set -e

echo "🗑️  Uninstalling current global Permamind..."
sudo npm uninstall -g permamind

echo "📦 Installing new Permamind version globally..."
sudo npm install -g ./permamind-2.18.5.tgz

echo "✅ Successfully installed Permamind v2.18.5 globally!"
echo "🔄 Please restart Claude to use the updated version."

echo ""
echo "📋 New version includes:"
echo "  ✅ Lazy AO connection initialization (respects NODE_ENV timing)"
echo "  ✅ Removed scheduler parameters (per AO documentation)"
echo "  ✅ Proper error logging to MCP logs"
echo "  ✅ NODE_ENV=production defaults (uses mainnet)"
echo ""
echo "🧪 Test with: permamind --test"