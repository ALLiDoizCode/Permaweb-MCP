import type { Implementation } from "@modelcontextprotocol/sdk/types.js";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ChildProcess, spawn } from "child_process";

/**
 * MCP Client Test Helper Utilities
 *
 * Provides utilities for setting up MCP client connections to test server functionality
 * through real protocol communication rather than mocked interfaces.
 */

export interface McpClientTestContext {
  client: Client;
  config: McpTestServerConfig;
  serverProcess?: ChildProcess;
  transport: Transport;
}

export interface McpTestServerConfig {
  endpoint: string;
  port: number;
  startupTimeoutMs?: number;
  transport: TestTransportMode;
}

export type TestTransportMode = "httpStream" | "sse";

/**
 * Default configuration for MCP client testing
 */
export const DEFAULT_TEST_CONFIG: McpTestServerConfig = {
  endpoint: "/test-mcp",
  port: 3001,
  startupTimeoutMs: 10000,
  transport: "sse",
};

/**
 * Cleans up MCP test environment
 */
export async function cleanupMcpTestEnvironment(
  context: McpClientTestContext,
): Promise<void> {
  try {
    // Close client transport
    await context.transport.close();
  } catch (error) {
    console.warn("Error closing client transport:", error);
  }

  // Kill server process if it exists
  if (context.serverProcess) {
    context.serverProcess.kill();

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      if (!context.serverProcess) {
        resolve();
        return;
      }

      context.serverProcess.on("exit", () => resolve());

      // Force kill after timeout
      setTimeout(() => {
        if (context.serverProcess && !context.serverProcess.killed) {
          context.serverProcess.kill("SIGKILL");
        }
        resolve();
      }, 5000);
    });
  }
}

/**
 * Connects the MCP client to the server with retry logic
 */
export async function connectMcpClient(
  context: McpClientTestContext,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Connect client to transport
      await context.client.connect(context.transport);
      return; // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break; // Final attempt failed
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(
    `Failed to connect MCP client after ${maxRetries} attempts. Last error: ${lastError?.message}`,
  );
}

/**
 * Creates and configures an MCP client for testing
 */
export async function createMcpTestClient(
  config: Partial<McpTestServerConfig> = {},
): Promise<McpClientTestContext> {
  const fullConfig = { ...DEFAULT_TEST_CONFIG, ...config };

  // Create the appropriate transport
  const transport = createTestTransport(fullConfig);

  // Create MCP client with test configuration
  const clientInfo: Implementation = {
    name: "PermamindTestClient",
    version: "1.0.0-test",
  };

  const client = new Client(clientInfo, {
    capabilities: {
      experimental: {},
      sampling: {},
    },
  });

  return {
    client,
    config: fullConfig,
    transport,
  };
}

/**
 * Creates a complete MCP test environment with server and client
 */
export async function createMcpTestEnvironment(
  config: Partial<McpTestServerConfig> = {},
): Promise<McpClientTestContext> {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };

  // Start the server
  const serverProcess = await startTestServer(testConfig);

  try {
    // Create and connect the client
    const context = await createMcpTestClient(testConfig);
    context.serverProcess = serverProcess;

    // Give server a moment to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Connect the client
    await connectMcpClient(context);

    return context;
  } catch (error) {
    // Clean up server if client setup failed
    serverProcess.kill();
    throw error;
  }
}

/**
 * Helper to list all available tools from server
 */
export async function listServerTools(
  client: Client,
): Promise<Array<{ description?: string; name: string }>> {
  try {
    const response = await client.listTools();
    return response.tools.map((tool) => ({
      description: tool.description,
      name: tool.name,
    }));
  } catch (error) {
    throw new Error(
      `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Starts the MCP server in test mode as a separate process
 */
export async function startTestServer(
  config: McpTestServerConfig,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn("npm", ["start"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        // Use test seed phrase to avoid wallet issues in CI
        SEED_PHRASE: "test seed phrase for integration testing only",
        TEST_TRANSPORT: config.transport,
        TEST_TRANSPORT_ENDPOINT: config.endpoint,
        TEST_TRANSPORT_PORT: config.port.toString(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    // Set up startup timeout
    const startupTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        serverProcess.kill();
        reject(new Error("Server startup timeout"));
      }
    }, config.startupTimeoutMs || DEFAULT_TEST_CONFIG.startupTimeoutMs);

    const cleanup = () => {
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };

    // Listen for server output to detect when it's ready
    serverProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();

      // Look for FastMCP server startup indicators
      if (
        output.includes("Server started") ||
        output.includes(`port ${config.port}`) ||
        output.includes("MCP server running")
      ) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(serverProcess);
        }
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.error(`Server stderr: ${output}`);

      // Some startup messages might come through stderr
      if (
        output.includes("Server started") ||
        output.includes(`port ${config.port}`)
      ) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(serverProcess);
        }
      }
    });

    serverProcess.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(error);
      }
    });

    serverProcess.on("exit", (code, signal) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`Server exited with code ${code}, signal ${signal}`));
      }
    });
  });
}

/**
 * Helper for testing tool calls with proper error handling
 */
export async function testToolCall(
  client: Client,
  toolName: string,
  arguments_: Record<string, unknown>,
): Promise<unknown> {
  try {
    const result = await client.callTool({
      arguments: arguments_,
      name: toolName,
    });

    if (result.isError) {
      throw new Error(
        `Tool call failed: ${result.content[0]?.text || "Unknown error"}`,
      );
    }

    return result.content[0]?.text || result.content;
  } catch (error) {
    throw new Error(
      `Tool call '${toolName}' failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Helper to wait for server readiness
 */
export async function waitForServerReady(
  context: McpClientTestContext,
  timeoutMs: number = 30000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try to list tools as a readiness check
      await listServerTools(context.client);
      return; // Server is ready
    } catch (error) {
      // Server not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Server not ready after ${timeoutMs}ms timeout`);
}

/**
 * Creates the appropriate transport based on configuration
 */
function createTestTransport(config: McpTestServerConfig): Transport {
  const baseUrl = `http://localhost:${config.port}`;

  switch (config.transport) {
    case "httpStream":
      return new StreamableHTTPClientTransport(
        new URL(config.endpoint, baseUrl),
      );

    case "sse":
      return new SSEClientTransport(new URL(config.endpoint, baseUrl));

    default:
      throw new Error(`Unsupported transport type: ${config.transport}`);
  }
}
