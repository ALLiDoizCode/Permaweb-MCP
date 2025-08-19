import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock FastMCP to avoid actual server startup during tests
const mockStart = vi.fn();
const mockAddTool = vi.fn();

vi.mock("fastmcp", () => ({
  FastMCP: vi.fn().mockImplementation(() => ({
    addTool: mockAddTool,
    start: mockStart,
  })),
}));

// Mock dotenv
vi.mock("dotenv", () => ({
  default: {
    config: vi.fn(),
  },
}));

// Mock external dependencies
vi.mock("../../src/services/DefaultProcessService.js", () => ({
  defaultProcessService: {
    getDefaultProcesses: vi.fn(),
  },
}));

vi.mock("../../src/services/TokenProcessTemplateService.js", () => ({
  TokenProcessTemplateService: {
    getTokenTemplate: vi.fn().mockReturnValue({}),
  },
}));

// Mock all tool factories
vi.mock("../../src/tools/contact/ContactToolFactory.js", () => ({
  ContactToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/documentation/DocumentationToolFactory.js", () => ({
  DocumentationToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/hub/HubToolFactory.js", () => ({
  HubToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/memory/MemoryToolFactory.js", () => ({
  MemoryToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/process/ProcessToolFactory.js", () => ({
  ProcessToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/token/TokenToolFactory.js", () => ({
  TokenToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/user/UserToolFactory.js", () => ({
  UserToolFactory: vi.fn().mockImplementation(() => ({
    registerTools: vi.fn(),
  })),
}));

vi.mock("../../src/tools/index.js", () => ({
  toolRegistry: {
    clear: vi.fn(),
    getToolDefinitions: vi
      .fn()
      .mockReturnValue([{ description: "Test tool", name: "test-tool" }]),
  },
}));

// Mock environment variables
const mockEnv = {
  TEST_TRANSPORT: undefined as string | undefined,
  TEST_TRANSPORT_ENDPOINT: undefined as string | undefined,
  TEST_TRANSPORT_PORT: undefined as string | undefined,
};

describe("Server Test Mode Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    mockEnv.TEST_TRANSPORT = undefined;
    mockEnv.TEST_TRANSPORT_PORT = undefined;
    mockEnv.TEST_TRANSPORT_ENDPOINT = undefined;

    // Mock process.env
    vi.stubGlobal("process", {
      env: mockEnv,
    });

    // Suppress console output for tests
    vi.stubGlobal("console", {
      error: vi.fn(),
      log: vi.fn(),
    });
  });

  describe("Server Initialization", () => {
    it("should start server with default stdio transport", async () => {
      // Import after mocks are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockStart).toHaveBeenCalledWith({
        transportType: "stdio",
      });
    });

    it("should start server with SSE transport when TEST_TRANSPORT=sse", async () => {
      mockEnv.TEST_TRANSPORT = "sse";
      mockEnv.TEST_TRANSPORT_PORT = "4000";
      mockEnv.TEST_TRANSPORT_ENDPOINT = "/test";

      // Re-import the constants module to pick up new env vars
      await vi.resetModules();

      // Import after mocks and env are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockStart).toHaveBeenCalledWith({
        sse: {
          endpoint: "/test",
          port: 4000,
        },
        transportType: "sse",
      });
    });

    it("should start server with HTTP Stream transport when TEST_TRANSPORT=httpstream", async () => {
      mockEnv.TEST_TRANSPORT = "httpstream";
      mockEnv.TEST_TRANSPORT_PORT = "5000";
      mockEnv.TEST_TRANSPORT_ENDPOINT = "/api";

      // Re-import the constants module to pick up new env vars
      await vi.resetModules();

      // Import after mocks and env are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockStart).toHaveBeenCalledWith({
        httpStream: {
          endpoint: "/api",
          port: 5000,
        },
        transportType: "httpStream",
      });
    });

    it("should fall back to stdio transport for invalid TEST_TRANSPORT values", async () => {
      mockEnv.TEST_TRANSPORT = "invalid-transport";

      // Re-import the constants module to pick up new env vars
      await vi.resetModules();

      // Import after mocks and env are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockStart).toHaveBeenCalledWith({
        transportType: "stdio",
      });
    });
  });

  describe("Tool Registration", () => {
    it("should register tools regardless of transport mode", async () => {
      mockEnv.TEST_TRANSPORT = "sse";

      // Re-import the constants module to pick up new env vars
      await vi.resetModules();

      // Import after mocks and env are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify tools were registered
      expect(mockAddTool).toHaveBeenCalledWith({
        description: "Test tool",
        name: "test-tool",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization errors gracefully and still start server", async () => {
      // Mock tool registry to throw an error during initialization
      vi.doMock("../../src/tools/index.js", () => ({
        toolRegistry: {
          clear: vi.fn(),
          getToolDefinitions: vi.fn().mockImplementation(() => {
            throw new Error("Tool initialization failed");
          }),
        },
      }));

      mockEnv.TEST_TRANSPORT = "httpstream";

      // Re-import the constants module to pick up new env vars
      await vi.resetModules();

      // Import after mocks and env are set up
      const { default: serverModule } = await import("../../src/server.js");

      // Wait a bit for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still start server even with initialization errors
      expect(mockStart).toHaveBeenCalledWith({
        httpStream: {
          endpoint: "/mcp",
          port: 3000,
        },
        transportType: "httpStream",
      });
    });
  });
});
