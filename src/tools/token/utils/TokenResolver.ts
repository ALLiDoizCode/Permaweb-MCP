import { fetchEvents } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/aiMemoryService.js";

export interface ResolutionResult<T> {
  matches?: T[];
  requiresVerification: boolean;
  resolved: boolean;
  value?: T;
  verificationMessage?: string;
}

interface AddressMatch {
  address: string;
  confidence: number;
  name: string;
}

interface TokenMatch {
  confidence: number;
  name?: string;
  processId: string;
  ticker?: string;
}

// Resolve contact name to address using memories
export async function resolveAddress(
  input: string,
  hubId: string,
): Promise<ResolutionResult<string>> {
  if (looksLikeProcessId(input)) {
    return { requiresVerification: false, resolved: true, value: input };
  }

  try {
    // Use dedicated kind for efficient filtering
    const filter = {
      kinds: [MEMORY_KINDS.CONTACT_MAPPING],
      limit: 100,
    };
    const _filters = JSON.stringify([filter]);
    const events = await fetchEvents(hubId, _filters);

    const addressMatches: AddressMatch[] = [];
    const inputLower = input.toLowerCase();

    for (const event of events) {
      try {
        const name = (event.contact_name as string) || "";
        const address = (event.contact_address as string) || "";

        if (!name || !address) continue;

        let confidence = 0;
        if (name.toLowerCase() === inputLower) {
          confidence = 0.9;
        } else if (name.toLowerCase().includes(inputLower)) {
          confidence = 0.7;
        }

        if (confidence > 0) {
          addressMatches.push({
            address,
            confidence,
            name,
          });
        }
      } catch {
        // Skip invalid entries
        continue;
      }
    }

    // Sort by confidence
    addressMatches.sort((a, b) => b.confidence - a.confidence);

    if (addressMatches.length === 0) {
      return {
        requiresVerification: false,
        resolved: false,
        verificationMessage: `No contact found for "${input}". Use saveAddressMapping to register this contact.`,
      };
    }

    if (addressMatches.length === 1 && addressMatches[0].confidence > 0.8) {
      const match = addressMatches[0];
      return {
        requiresVerification: true,
        resolved: true,
        value: match.address,
        verificationMessage: `Found contact: ${match.name} (${match.address}). Continue?`,
      };
    }

    // Multiple matches - return all for user selection
    return {
      matches: addressMatches.map((m) => m.address),
      requiresVerification: true,
      resolved: false,
      verificationMessage: `Multiple contacts found for "${input}": ${addressMatches
        .map((m) => `${m.name} (${m.address.slice(0, 8)}...)`)
        .join(", ")}. Please specify which one to use.`,
    };
  } catch (error) {
    return {
      requiresVerification: false,
      resolved: false,
      verificationMessage: `Error resolving contact "${input}": ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Resolve token name/ticker to processId using memories
export async function resolveToken(
  input: string,
  hubId: string,
): Promise<ResolutionResult<string>> {
  if (looksLikeProcessId(input)) {
    return { requiresVerification: false, resolved: true, value: input };
  }

  try {
    // Use dedicated kind for efficient filtering
    const filter = {
      kinds: [MEMORY_KINDS.TOKEN_MAPPING],
      limit: 100,
    };
    const _filters = JSON.stringify([filter]);
    const events = await fetchEvents(hubId, _filters);

    const tokenMatches: TokenMatch[] = [];
    const inputLower = input.toLowerCase();

    for (const event of events) {
      try {
        const name = (event.token_name as string) || "";
        const ticker = (event.token_ticker as string) || "";
        const processId = (event.token_processId as string) || "";

        if (!name || !ticker || !processId) continue;

        let confidence = 0;

        // Check if input matches ticker
        if (ticker.toLowerCase() === inputLower) {
          confidence = 0.9;
        }
        // Check if input matches name
        else if (name.toLowerCase().includes(inputLower)) {
          confidence = 0.8;
        }
        // Partial match
        else if (
          name.toLowerCase().includes(inputLower) ||
          ticker.toLowerCase().includes(inputLower)
        ) {
          confidence = 0.5;
        }

        if (confidence > 0) {
          tokenMatches.push({
            confidence,
            name,
            processId,
            ticker,
          });
        }
      } catch {
        // Skip invalid entries
        continue;
      }
    }

    // Sort by confidence
    tokenMatches.sort((a, b) => b.confidence - a.confidence);

    if (tokenMatches.length === 0) {
      return {
        requiresVerification: false,
        resolved: false,
        verificationMessage: `No token found for "${input}". Use saveTokenMapping to register this token.`,
      };
    }

    if (tokenMatches.length === 1 && tokenMatches[0].confidence > 0.8) {
      const match = tokenMatches[0];
      return {
        requiresVerification: true,
        resolved: true,
        value: match.processId,
        verificationMessage: `Found token: ${match.name || match.ticker || "Unknown"} (${match.processId}). Continue?`,
      };
    }

    // Multiple matches or low confidence - return all for user selection
    return {
      matches: tokenMatches.map((m) => m.processId),
      requiresVerification: true,
      resolved: false,
      verificationMessage: `Multiple tokens found for "${input}": ${tokenMatches
        .map(
          (m) =>
            `${m.name || m.ticker || "Unknown"} (${m.processId.slice(0, 8)}...)`,
        )
        .join(", ")}. Please specify which one to use.`,
    };
  } catch (error) {
    return {
      requiresVerification: false,
      resolved: false,
      verificationMessage: `Error resolving token "${input}": ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Check if input looks like a processId (43-character base64-like string)
function looksLikeProcessId(input: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(input);
}
