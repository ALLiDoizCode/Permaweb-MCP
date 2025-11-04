#!/usr/bin/env node

/**
 * Simple test script to verify MCP tools are loaded correctly
 * This script loads the server module to trigger tool registration
 */

console.log("🔍 Testing Permamind Tool Registry\n");
console.log("⏳ Initializing server...\n");

// Suppress server startup output
const originalLog = console.log;
const originalError = console.error;
console.log = () => {};
console.error = () => {};

// Import server to trigger initialization
await import("./dist/server.js").catch((err) => {
  console.log = originalLog;
  console.error = originalError;
  console.error("❌ Error loading server:", err.message);
  process.exit(1);
});

// Wait a moment for initialization
await new Promise((resolve) => setTimeout(resolve, 1000));

// Restore console
console.log = originalLog;
console.error = originalError;

// Now import the tool registry
const { toolRegistry } = await import("./dist/tools/index.js");

console.log("✓ Server initialized\n");

// Get all registered tools
const tools = Array.from(toolRegistry.entries());

console.log(`📊 Total tools registered: ${tools.length}\n`);

// Group tools by category
const toolsByCategory = {};

for (const [name, tool] of tools) {
  const category = tool.category || "Uncategorized";
  if (!toolsByCategory[category]) {
    toolsByCategory[category] = [];
  }
  toolsByCategory[category].push({
    description: tool.definition().description?.substring(0, 60) + "...",
    name,
  });
}

// Display tools by category
for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
  console.log(`\n📂 ${category} (${categoryTools.length} tools):`);
  categoryTools.forEach((tool) => {
    console.log(`  ✓ ${tool.name}`);
    console.log(`    ${tool.description}`);
  });
}

console.log("\n✅ Tool inventory verification complete!\n");

// Verify expected tool count
if (tools.length === 15) {
  console.log("✅ SUCCESS: All 15 tools are registered correctly!");
  process.exit(0);
} else {
  console.error(`❌ ERROR: Expected 15 tools, found ${tools.length}`);
  process.exit(1);
}
