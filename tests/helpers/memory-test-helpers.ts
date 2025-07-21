import { JWKInterface } from "arweave/node/lib/wallet.js";

import { ToolContext } from "../../src/tools/core/index.js";

/**
 * Test helper utilities for memory tools
 */

/**
 * Creates expected memory tags for assertions
 */
export function createExpectedMemoryTags(
  content: string,
  role: string,
  p: string,
) {
  return [
    { name: "Kind", value: "10" },
    { name: "Content", value: content },
    { name: "r", value: role },
    { name: "p", value: p },
  ];
}

/**
 * Creates a mock tool context for testing
 */
export function createMockToolContext(
  hubId = "test-hub-id",
  publicKey = "test-public-key",
): ToolContext {
  return {
    hubId,
    keyPair: {} as JWKInterface,
    publicKey,
  };
}

/**
 * Creates sample memory arguments for testing
 */
export function createSampleMemoryArgs(
  content = "Test memory content",
  role = "user",
  p = "test-public-key",
) {
  return {
    content,
    p,
    role,
  };
}
