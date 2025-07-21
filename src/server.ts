// SSE transport allows normal logging without protocol interference

import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet.js";
import dotenv from "dotenv";
import { FastMCP } from "fastmcp";

import type { ProcessDefinition } from "./services/ProcessCommunicationService.js";

import { HUB_REGISTRY_ID } from "./constants.js";
import { getKeyFromMnemonic } from "./mnemonic.js";
// MemoryType is now imported via the tools module
import { ProfileCreateData } from "./models/Profile.js";
import { defaultProcessService } from "./services/DefaultProcessService.js";
import { hubRegistryService } from "./services/RegistryService.js";
import { TokenProcessTemplateService } from "./services/TokenProcessTemplateService.js";
import { ContactToolFactory } from "./tools/contact/ContactToolFactory.js";
import { DocumentationToolFactory } from "./tools/documentation/DocumentationToolFactory.js";
import { ToolContext, toolRegistry } from "./tools/index.js";
import { MemoryToolFactory } from "./tools/memory/MemoryToolFactory.js";
import { ProcessToolFactory } from "./tools/process/ProcessToolFactory.js";
import { UserToolFactory } from "./tools/user/UserToolFactory.js";

let keyPair: JWKInterface;
let publicKey: string;
let hubId: string;
let embeddedTemplates: Map<string, ProcessDefinition>;
let initializationComplete = false;

// Export getters for current user state
export const getCurrentUserState = () => ({
  embeddedTemplates,
  hubId,
  initializationComplete,
  keyPair,
  publicKey,
});

// Export template availability checker
export const isTemplateAvailable = (templateType: string): boolean => {
  return embeddedTemplates?.has(templateType) ?? false;
};

// Export embedded templates getter
export const getEmbeddedTemplates = ():
  | Map<string, ProcessDefinition>
  | undefined => {
  return embeddedTemplates;
};

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

  // Initialize embedded templates
  embeddedTemplates = new Map<string, ProcessDefinition>();
  embeddedTemplates.set(
    "token",
    TokenProcessTemplateService.getTokenTemplate(""),
  );

  // Verify template availability (silent verification for MCP compatibility)
  if (!embeddedTemplates.has("token")) {
    throw new Error("Failed to initialize embedded token template");
  }

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
    embeddedTemplates,
    hubId,
    keyPair,
    publicKey,
  };

  // Note: BMAD and Claude Code tools removed

  // Register Memory tools
  const memoryFactory = new MemoryToolFactory({
    categoryDescription:
      "AI Memory management tools for persistent storage and retrieval",
    categoryName: "Memory",
    context,
  });

  memoryFactory.registerTools(toolRegistry);

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

// Initialize properly first, then register tools and start server
async function initializeAndStart() {
  try {
    // Complete initialization first to get real keyPair and context
    await init();

    // Now setup tool registry with proper context
    setupToolRegistry();

    // Get tool definitions with proper context and register them
    const context: ToolContext = {
      embeddedTemplates,
      hubId,
      keyPair,
      publicKey,
    };

    const toolDefinitions = toolRegistry.getToolDefinitions(context);
    for (const toolDefinition of toolDefinitions) {
      server.addTool(toolDefinition);
    }

    // Start the server with fully initialized tools
    server.start({
      transportType: "stdio",
    });
  } catch {
    // Silent error handling for stdio transport compatibility
    // Fallback: start server without tools if initialization fails
    server.start({
      transportType: "stdio",
    });
  }
}

// Initialize and start the server
initializeAndStart();
