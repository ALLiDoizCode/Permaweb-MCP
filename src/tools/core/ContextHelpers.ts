import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet.js";

import { HUB_REGISTRY_ID } from "../../constants.js";
import { getKeyFromMnemonic } from "../../mnemonic.js";
import { ProfileCreateData } from "../../models/Profile.js";
import { hubRegistryService } from "../../services/RegistryService.js";
import { ToolContext } from "./ToolCommand.js";

/**
 * Auto-initializing helper to safely extract hubId, creating one if needed
 */
export async function autoHubId(context: ToolContext): Promise<string> {
  const keypairResult = await autoGenerateKeypair(context);
  const hubResult = await autoInitializeHub(
    keypairResult.keyPair,
    keypairResult.publicKey,
    context,
  );
  return hubResult.hubId;
}

/**
 * Full auto-initialization that returns all required context
 */
export async function autoInitializeContext(context: ToolContext): Promise<{
  generated: boolean;
  hubCreated: boolean;
  hubId: string;
  keyPair: JWKInterface;
  publicKey: string;
}> {
  const keypairResult = await autoGenerateKeypair(context);
  const hubResult = await autoInitializeHub(
    keypairResult.keyPair,
    keypairResult.publicKey,
    context,
  );

  return {
    generated: keypairResult.generated,
    hubCreated: hubResult.created,
    hubId: hubResult.hubId,
    keyPair: keypairResult.keyPair,
    publicKey: keypairResult.publicKey,
  };
}

/**
 * Auto-initializing helper to safely extract keyPair, creating one if needed
 */
export async function autoKeyPair(context: ToolContext): Promise<JWKInterface> {
  const result = await autoGenerateKeypair(context);
  return result.keyPair;
}

/**
 * Auto-initializing helper to safely extract publicKey, creating one if needed
 */
export async function autoPublicKey(context: ToolContext): Promise<string> {
  const result = await autoGenerateKeypair(context);
  return result.publicKey;
}

/**
 * Helper to safely extract hubId with non-null assertion
 */
export async function safeHubId(_context: ToolContext): Promise<string> {
  // Get fresh context to check current state
  const { getCurrentContext } = await import("../../server.js");
  const currentContext = getCurrentContext();

  if (!currentContext.hubId) {
    throw new Error("Hub not initialized. Please run initializeHub first.");
  }
  return currentContext.hubId;
}

/**
 * Helper to safely extract keyPair with non-null assertion
 * This provides better error messaging during development
 */
export async function safeKeyPair(
  _context: ToolContext,
): Promise<JWKInterface> {
  // Get fresh context to check current state
  const { getCurrentContext } = await import("../../server.js");
  const currentContext = getCurrentContext();

  if (!currentContext.keyPair) {
    throw new Error("Wallet not initialized. Please run initializeHub first.");
  }
  return currentContext.keyPair;
}

/**
 * Helper to safely extract publicKey with non-null assertion
 */
export async function safePublicKey(_context: ToolContext): Promise<string> {
  // Get fresh context to check current state
  const { getCurrentContext } = await import("../../server.js");
  const currentContext = getCurrentContext();

  if (!currentContext.publicKey) {
    throw new Error("Wallet not initialized. Please run initializeHub first.");
  }
  return currentContext.publicKey;
}

/**
 * Auto-generates a keypair if none exists in the context
 */
async function autoGenerateKeypair(_context: ToolContext): Promise<{
  generated: boolean;
  keyPair: JWKInterface;
  publicKey: string;
}> {
  // Get fresh context to check current state
  const { getCurrentContext } = await import("../../server.js");
  const currentContext = getCurrentContext();

  if (currentContext.keyPair && currentContext.publicKey) {
    return {
      generated: false,
      keyPair: currentContext.keyPair,
      publicKey: currentContext.publicKey,
    };
  }

  const arweave = Arweave.init({});
  let keyPair: JWKInterface;

  // Use environment seed phrase if available, otherwise generate random
  const seedPhrase = process.env.SEED_PHRASE;
  if (seedPhrase) {
    keyPair = await getKeyFromMnemonic(seedPhrase);
  } else {
    keyPair = await arweave.wallets.generate();
  }

  const publicKey = await arweave.wallets.jwkToAddress(keyPair);

  // Update server state
  const { setUserState } = await import("../../server.js");
  setUserState({ keyPair, publicKey });

  return {
    generated: true,
    keyPair,
    publicKey,
  };
}

/**
 * Auto-initializes a hub if none exists for the keypair
 */
async function autoInitializeHub(
  keyPair: JWKInterface,
  publicKey: string,
  _context: ToolContext,
): Promise<{ created: boolean; hubId: string }> {
  // Get fresh context to check current state
  const { getCurrentContext } = await import("../../server.js");
  const currentContext = getCurrentContext();

  if (currentContext.hubId) {
    return {
      created: false,
      hubId: currentContext.hubId,
    };
  }

  // Try to get existing hub first
  try {
    const zone = await hubRegistryService.getZoneById(
      HUB_REGISTRY_ID(),
      publicKey,
    );
    const hubId = (zone.spec as { processId: string }).processId;

    // Update server state
    const { setUserState } = await import("../../server.js");
    setUserState({ hubId });

    return {
      created: false,
      hubId,
    };
  } catch {
    // No hub exists, create one
    const profile: ProfileCreateData = {
      bot: true,
      coverImage: "",
      description: "Auto-initialized hub",
      displayName: "Auto Hub",
      thumbnail: "",
      userName: "",
      website: "",
    };

    const hubId = await hubRegistryService.create(keyPair, profile);

    // Update server state
    const { setUserState } = await import("../../server.js");
    setUserState({ hubId });

    return {
      created: true,
      hubId,
    };
  }
}

// Legacy non-null assertions for quick compilation fix
// These will be replaced with safer versions
export const unsafeKeyPair = (context: ToolContext) => context.keyPair!;
export const unsafeHubId = (context: ToolContext) => context.hubId!;
export const unsafePublicKey = (context: ToolContext) => context.publicKey!;
