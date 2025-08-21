// SSE transport allows normal logging without protocol interference

import { JWKInterface } from "arweave/node/lib/wallet.js";
import dotenv from "dotenv";
import { FastMCP } from "fastmcp";

import type { ProcessDefinition } from "./services/ProcessCommunicationService.js";

import { defaultProcessService } from "./services/DefaultProcessService.js";
import { TokenProcessTemplateService } from "./services/TokenProcessTemplateService.js";
import { ContactToolFactory } from "./tools/contact/ContactToolFactory.js";
import { DocumentationToolFactory } from "./tools/documentation/DocumentationToolFactory.js";
import { HubToolFactory } from "./tools/hub/HubToolFactory.js";
import { ToolContext, toolRegistry } from "./tools/index.js";
import { MemoryToolFactory } from "./tools/memory/MemoryToolFactory.js";
import { ProcessToolFactory } from "./tools/process/ProcessToolFactory.js";
import { TokenToolFactory } from "./tools/token/TokenToolFactory.js";
import { UserToolFactory } from "./tools/user/UserToolFactory.js";

let keyPair: JWKInterface | undefined;
let publicKey: string | undefined;
let hubId: string | undefined;
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

// Export getter for current context (dynamic)
export const getCurrentContext = (): ToolContext => ({
  embeddedTemplates,
  hubId,
  keyPair,
  publicKey,
});

// Export setter for server state (used by hub initialization tools)
export const setUserState = (newState: {
  hubId?: string;
  keyPair?: JWKInterface;
  publicKey?: string;
}) => {
  if (newState.keyPair) keyPair = newState.keyPair;
  if (newState.publicKey) publicKey = newState.publicKey;
  if (newState.hubId) hubId = newState.hubId;
};

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

// Restore console after dotenv is loaded (required for MCP protocol compatibility)
globalThis.console.log = originalLog;
globalThis.console.error = originalError;

async function init() {
  // Initialize without wallet generation - wallet operations moved to tools

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

  // Create tool context - hub tools available even without initialization
  const context: ToolContext = {
    embeddedTemplates,
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

  // Register Token tools
  const tokenFactory = new TokenToolFactory({
    categoryDescription:
      "Token operations for balance, transfer, and info queries",
    categoryName: "Token",
    context,
  });

  tokenFactory.registerTools(toolRegistry);

  // Register Documentation tools
  const documentationFactory = new DocumentationToolFactory({
    categoryDescription:
      "Permaweb documentation, file storage, and deployment tools. Use ArDrive tools (uploadToArweave/uploadFolderToArweave) for file/folder uploads. Use deployPermawebDirectory only when specifically prompted to 'deploy to the permaweb'.",
    categoryName: "Documentation",
    context,
  });

  documentationFactory.registerTools(toolRegistry);

  // Register Hub tools
  const hubFactory = new HubToolFactory({
    categoryDescription:
      "Hub creation and management tools for Velocity protocol",
    categoryName: "Hub",
    context,
  });

  hubFactory.registerTools(toolRegistry);

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
    // Error during initialization - start without tools silently for MCP compatibility
    // DO NOT use console.error or console.log as it breaks the MCP stdio protocol
    server.start({
      transportType: "stdio",
    });
  }
}

// Initialize and start the server
initializeAndStart();
