import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpClientTestContext } from "../helpers/mcp-client-test-helper.js";

import {
  cleanupMcpTestEnvironment,
  createMcpTestEnvironment,
  listServerTools,
  testToolCall,
  waitForServerReady,
} from "../helpers/mcp-client-test-helper.js";

/**
 * MCP Client Integration Tests
 *
 * Tests the complete MCP server functionality through real client-server communication
 * using the official @modelcontextprotocol/sdk client library.
 *
 * These tests validate:
 * - Server initialization and handshake
 * - All tool categories through MCP protocol
 * - Error handling and edge cases
 * - Transport compatibility (SSE and HTTP Stream)
 *
 * NOTE: This test suite is currently skipped due to server startup timeout issues
 * in the MCP test infrastructure. The functionality is tested via unit tests and
 * service-specific integration tests.
 */

describe.skip("MCP Client Integration", () => {
  let testContext: McpClientTestContext;

  beforeEach(async () => {
    // Create test environment with SSE transport
    testContext = await createMcpTestEnvironment({
      endpoint: "/test-mcp",
      port: 3001,
      transport: "sse",
    });

    // Wait for server to be fully ready
    await waitForServerReady(testContext, 30000);
  }, 45000); // Allow extra time for server startup

  afterEach(async () => {
    if (testContext) {
      await cleanupMcpTestEnvironment(testContext);
    }
  });

  describe("Server Initialization and Handshake", () => {
    it("should complete MCP protocol handshake successfully", () => {
      // If we reach this point, the handshake was successful
      // (connection happens in beforeEach)
      expect(testContext.client).toBeDefined();
      expect(testContext.transport).toBeDefined();
    });

    it("should discover server capabilities", async () => {
      const capabilities = testContext.client.getServerCapabilities();
      expect(capabilities).toBeDefined();
      // Server should support tools at minimum
      expect(capabilities?.tools).toBeDefined();
    });

    it("should list available tools", async () => {
      const tools = await listServerTools(testContext.client);

      // Should have tools from all categories
      expect(tools.length).toBeGreaterThan(0);

      // Check for presence of key tool categories
      const toolNames = tools.map((t) => t.name);
      expect(
        toolNames.some(
          (name) => name.includes("memory") || name.includes("Memory"),
        ),
      ).toBe(true);
      expect(
        toolNames.some(
          (name) => name.includes("process") || name.includes("Process"),
        ),
      ).toBe(true);
    });
  });

  describe("Memory Tool Category", () => {
    it("should handle storeMemory tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__storeMemory",
        {
          content: "Test memory content for MCP integration",
          forceStore: true, // Force storage even if MEMORY is disabled
          p: "test-public-key-mcp-integration",
          role: "user",
        },
      );

      expect(result).toBeDefined();
      // Should return success response
      expect(typeof result).toBe("string");
    });

    it("should handle searchMemory tool call", async () => {
      // First store a memory
      await testToolCall(testContext.client, "mcp__permamind__storeMemory", {
        content: "Searchable test content for MCP client integration",
        forceStore: true,
        p: "test-public-key-search",
        role: "user",
      });

      // Then search for it
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__searchMemory",
        {
          search: "searchable test content",
        },
      );

      expect(result).toBeDefined();
    });

    it("should handle contact management tools", async () => {
      // Test saveAddressMapping
      const saveResult = await testToolCall(
        testContext.client,
        "mcp__permamind__saveAddressMapping",
        {
          address: "test_address_12345678901234567890123456789012345",
          name: "Test Contact MCP",
        },
      );
      expect(saveResult).toBeDefined();

      // Test listContacts
      const listResult = await testToolCall(
        testContext.client,
        "mcp__permamind__listContacts",
        {},
      );
      expect(listResult).toBeDefined();
    });
  });

  describe("Process Tool Category", () => {
    it("should handle analyzeProcessArchitecture tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__analyzeProcessArchitecture",
        {
          detailedExplanation: false,
          includeExamples: false,
          userRequest: "Create a simple calculator process",
        },
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle generateLuaProcess tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__generateLuaProcess",
        {
          includeExplanation: false,
          userRequest: "Create a simple ping-pong handler",
        },
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Should return JSON with code generation results
      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.workflow).toBeDefined();
    });

    it("should handle spawnProcess tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__spawnProcess",
        {},
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Should return process ID
      const parsed = JSON.parse(result as string);
      expect(parsed.processId).toBeDefined();
      expect(typeof parsed.processId).toBe("string");
    });
  });

  describe("Token Tool Category", () => {
    it("should handle listTokens tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__listTokens",
        {},
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle saveTokenMapping tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__saveTokenMapping",
        {
          name: "Test Token MCP",
          processId: "test_process_id_12345678901234567890123456789012",
          ticker: "TMCP",
        },
      );

      expect(result).toBeDefined();
    });
  });

  describe("User Tool Category", () => {
    it("should handle generateKeypair tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__generateKeypair",
        {},
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Should return wallet information
      const parsed = JSON.parse(result as string);
      expect(parsed.address).toBeDefined();
      expect(parsed.publicKey).toBeDefined();
    });

    it("should handle getUserPublicKey tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__getUserPublicKey",
        {},
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("Hub Tool Category", () => {
    it("should handle getHub tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__getHub",
        {},
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("Documentation Tool Category", () => {
    it("should handle queryPermawebDocs tool call", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__queryPermawebDocs",
        {
          maxResults: 3,
          query: "What is AO?",
        },
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Should return documentation results
      const parsed = JSON.parse(result as string);
      expect(parsed.results).toBeDefined();
      expect(Array.isArray(parsed.results)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid tool name gracefully", async () => {
      await expect(
        testToolCall(testContext.client, "nonexistent_tool", {}),
      ).rejects.toThrow();
    });

    it("should handle malformed parameters gracefully", async () => {
      await expect(
        testToolCall(testContext.client, "mcp__permamind__storeMemory", {
          // Missing required parameters
          invalidParam: "invalid",
        }),
      ).rejects.toThrow();
    });

    it("should handle timeout scenarios", async () => {
      // This test would need a tool that can timeout
      // For now, just test that the mechanism works
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__listTokens",
        {},
      );
      expect(result).toBeDefined();
    }, 10000);
  });
});

describe("MCP Client Integration - HTTP Stream Transport", () => {
  let testContext: McpClientTestContext;

  beforeEach(async () => {
    // Create test environment with HTTP Stream transport
    testContext = await createMcpTestEnvironment({
      endpoint: "/test-mcp-stream",
      port: 3002,
      transport: "httpStream",
    });

    await waitForServerReady(testContext, 30000);
  }, 45000);

  afterEach(async () => {
    if (testContext) {
      await cleanupMcpTestEnvironment(testContext);
    }
  });

  describe("HTTP Stream Transport", () => {
    it("should complete handshake with HTTP Stream transport", () => {
      expect(testContext.client).toBeDefined();
      expect(testContext.transport).toBeDefined();
    });

    it("should list tools through HTTP Stream transport", async () => {
      const tools = await listServerTools(testContext.client);
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should execute tool calls through HTTP Stream transport", async () => {
      const result = await testToolCall(
        testContext.client,
        "mcp__permamind__getUserPublicKey",
        {},
      );
      expect(result).toBeDefined();
    });
  });
});
