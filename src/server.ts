// SSE transport allows normal logging without protocol interference

import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet.js";
import dotenv from "dotenv";
import { FastMCP } from "fastmcp";

import { HUB_REGISTRY_ID } from "./constants.js";
import { getKeyFromMnemonic } from "./mnemonic.js";
// MemoryType is now imported via the tools module
import { ProfileCreateData } from "./models/Profile.js";
import { defaultProcessService } from "./services/DefaultProcessService.js";
import { hubRegistryService } from "./services/RegistryService.js";
import { ContactToolFactory } from "./tools/contact/ContactToolFactory.js";
import { DocumentationToolFactory } from "./tools/documentation/DocumentationToolFactory.js";
import { ToolContext, toolRegistry } from "./tools/index.js";
import { MemoryToolFactory } from "./tools/memory/MemoryToolFactory.js";
import { ProcessToolFactory } from "./tools/process/ProcessToolFactory.js";
import { TokenToolFactory } from "./tools/token/TokenToolFactory.js";
import { UserToolFactory } from "./tools/user/UserToolFactory.js";

let keyPair: JWKInterface;
let publicKey: string;
let hubId: string;
let initializationComplete = false;

// Export getters for current user state
export const getCurrentUserState = () => ({
  keyPair,
  publicKey,
  hubId,
  initializationComplete,
});

// Configure environment variables silently for MCP protocol compatibility
// Suppress all output from dotenv and any other initialization
const originalLog = globalThis.console.log;
const originalError = globalThis.console.error;
globalThis.console.log = () => {};
globalThis.console.error = () => {};

dotenv.config({ debug: false });

// Only restore console after dotenv is loaded (for MCP protocol compatibility)
if (process.env.NODE_ENV !== "production") {
  globalThis.console.log = originalLog;
  globalThis.console.error = originalError;
}

async function init() {
  const arweave = Arweave.init({});
  if (process.env.SEED_PHRASE) {
    keyPair = await getKeyFromMnemonic(process.env.SEED_PHRASE);
  } else {
    keyPair = await arweave.wallets.generate();
  }
  publicKey = await arweave.wallets.jwkToAddress(keyPair);
  try {
    const zone = await hubRegistryService.getZoneById(
      HUB_REGISTRY_ID(),
      publicKey,
    );
    hubId = (zone.spec as { processId: string }).processId;
  } catch (e) {
    if (
      e ==
      "TypeError: Cannot read properties of undefined (reading 'processId')"
    ) {
      const profile: ProfileCreateData = {
        bot: true,
        coverImage: "",
        description: "",
        displayName: "",
        thumbnail: "",
        userName: "",
        website: "",
      };
      hubId = await hubRegistryService.create(keyPair, profile);
    }
  }

  // Verify default process templates are loaded (silently for MCP compatibility)
  defaultProcessService.getDefaultProcesses();

  // Mark initialization as complete
  initializationComplete = true;

  // No automatic context loading on startup for better performance
}

// Setup tool registry with all available tools
function setupToolRegistry() {
  // Clear registry first
  toolRegistry.clear();

  // Create tool context
  const context: ToolContext = {
    hubId,
    keyPair,
    publicKey,
  };

  // Register Memory tools
  const memoryFactory = new MemoryToolFactory({
    categoryDescription:
      "AI Memory management tools for persistent storage and retrieval",
    categoryName: "Memory",
    context,
  });

  memoryFactory.registerTools(toolRegistry);

  // Register Token tools
  const tokenFactory = new TokenToolFactory({
    categoryDescription:
      "Token management tools for creating, transferring, and querying tokens",
    categoryName: "Token",
    context,
  });

  tokenFactory.registerTools(toolRegistry);

  // Register Contact tools
  const contactFactory = new ContactToolFactory({
    categoryDescription: "Contact and address management tools",
    categoryName: "Contact",
    context,
  });

  contactFactory.registerTools(toolRegistry);

  // Register Process tools
  const processFactory = new ProcessToolFactory({
    categoryDescription: "AO process communication and blockchain query tools",
    categoryName: "Process",
    context,
  });

  processFactory.registerTools(toolRegistry);

  // Register Documentation tools
  const documentationFactory = new DocumentationToolFactory({
    categoryDescription: "Permaweb documentation and deployment tools",
    categoryName: "Documentation",
    context,
  });

  documentationFactory.registerTools(toolRegistry);

  // Register User tools
  const userFactory = new UserToolFactory({
    categoryDescription:
      "User information tools for getting public key and hub ID",
    categoryName: "User",
    context,
  });

  userFactory.registerTools(toolRegistry);
}

const server = new FastMCP({
  name: "Permamind Memory Server",
  version: "1.0.0",
});

// All tools are now registered via the tool registry
// Start server with stdio transport (matches Claude Desktop expectation)

// Register basic tools immediately to ensure MCP server has tools available
// while initialization happens in background
function registerBasicTools() {
  // Create a minimal tool context with placeholders
  const basicContext: ToolContext = {
    hubId: "initializing",
    keyPair: {} as JWKInterface, // Will be replaced after init
    publicKey: "initializing",
  };

  // Setup tool registry with basic context
  toolRegistry.clear();

  // Register Memory tools
  const memoryFactory = new MemoryToolFactory({
    categoryDescription:
      "AI Memory management tools for persistent storage and retrieval",
    categoryName: "Memory",
    context: basicContext,
  });
  memoryFactory.registerTools(toolRegistry);

  // Register Token tools
  const tokenFactory = new TokenToolFactory({
    categoryDescription:
      "Token management tools for creating, transferring, and querying tokens",
    categoryName: "Token",
    context: basicContext,
  });
  tokenFactory.registerTools(toolRegistry);

  // Register Contact tools
  const contactFactory = new ContactToolFactory({
    categoryDescription: "Contact and address management tools",
    categoryName: "Contact",
    context: basicContext,
  });
  contactFactory.registerTools(toolRegistry);

  // Register Process tools
  const processFactory = new ProcessToolFactory({
    categoryDescription: "AO process communication and blockchain query tools",
    categoryName: "Process",
    context: basicContext,
  });
  processFactory.registerTools(toolRegistry);

  // Register Documentation tools
  const documentationFactory = new DocumentationToolFactory({
    categoryDescription: "Permaweb documentation and deployment tools",
    categoryName: "Documentation",
    context: basicContext,
  });
  documentationFactory.registerTools(toolRegistry);

  // Register User tools
  const userFactory = new UserToolFactory({
    categoryDescription:
      "User information tools for getting public key and hub ID",
    categoryName: "User",
    context: basicContext,
  });
  userFactory.registerTools(toolRegistry);

  // Get tool definitions and register them
  const toolDefinitions = toolRegistry.getToolDefinitions(basicContext);
  for (const toolDefinition of toolDefinitions) {
    server.addTool(toolDefinition);
  }
}

// Register basic tools immediately
registerBasicTools();

// Start the server immediately with basic tools
server.start({
  transportType: "stdio",
});

// Initialize properly in background and update tools when ready
init()
  .then(() => {
    // After real initialization, update the tool registry with proper context
    setupToolRegistry();
    // Note: We don't call registerToolsFromRegistry again as tools are already registered
  })
  .catch(() => {
    // Silent error handling for stdio transport compatibility
  });
