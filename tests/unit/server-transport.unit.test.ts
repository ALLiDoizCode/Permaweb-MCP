import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTestTransportConfig,
  getTransportMode,
} from "../../src/constants.js";

// Mock environment variables
const mockEnv = {
  TEST_TRANSPORT: undefined as string | undefined,
  TEST_TRANSPORT_ENDPOINT: undefined as string | undefined,
  TEST_TRANSPORT_PORT: undefined as string | undefined,
};

describe("Transport Configuration", () => {
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
  });

  describe("getTransportMode", () => {
    it("should default to stdio when TEST_TRANSPORT is not set", () => {
      const mode = getTransportMode();
      expect(mode).toBe("stdio");
    });

    it("should return sse when TEST_TRANSPORT is set to sse", () => {
      mockEnv.TEST_TRANSPORT = "sse";
      const mode = getTransportMode();
      expect(mode).toBe("sse");
    });

    it("should return sse when TEST_TRANSPORT is set to SSE (case insensitive)", () => {
      mockEnv.TEST_TRANSPORT = "SSE";
      const mode = getTransportMode();
      expect(mode).toBe("sse");
    });

    it("should return httpStream when TEST_TRANSPORT is set to httpstream", () => {
      mockEnv.TEST_TRANSPORT = "httpstream";
      const mode = getTransportMode();
      expect(mode).toBe("httpStream");
    });

    it("should return httpStream when TEST_TRANSPORT is set to HTTPSTREAM (case insensitive)", () => {
      mockEnv.TEST_TRANSPORT = "HTTPSTREAM";
      const mode = getTransportMode();
      expect(mode).toBe("httpStream");
    });

    it("should default to stdio for invalid transport values", () => {
      mockEnv.TEST_TRANSPORT = "invalid";
      const mode = getTransportMode();
      expect(mode).toBe("stdio");
    });

    it("should default to stdio for empty transport values", () => {
      mockEnv.TEST_TRANSPORT = "";
      const mode = getTransportMode();
      expect(mode).toBe("stdio");
    });
  });

  describe("getTestTransportConfig", () => {
    it("should return default configuration for stdio mode", () => {
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "/mcp",
        mode: "stdio",
        port: 3000,
      });
    });

    it("should return sse configuration with custom port", () => {
      mockEnv.TEST_TRANSPORT = "sse";
      mockEnv.TEST_TRANSPORT_PORT = "4000";
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "/mcp",
        mode: "sse",
        port: 4000,
      });
    });

    it("should return httpStream configuration with custom endpoint", () => {
      mockEnv.TEST_TRANSPORT = "httpstream";
      mockEnv.TEST_TRANSPORT_ENDPOINT = "/api/mcp";
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "/api/mcp",
        mode: "httpStream",
        port: 3000,
      });
    });

    it("should handle invalid port gracefully", () => {
      mockEnv.TEST_TRANSPORT = "sse";
      mockEnv.TEST_TRANSPORT_PORT = "invalid";
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "/mcp",
        mode: "sse",
        port: 3000, // Should default to 3000 when parseInt fails
      });
    });

    it("should return complete configuration for all environment variables set", () => {
      mockEnv.TEST_TRANSPORT = "httpstream";
      mockEnv.TEST_TRANSPORT_PORT = "5000";
      mockEnv.TEST_TRANSPORT_ENDPOINT = "/test/endpoint";
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "/test/endpoint",
        mode: "httpStream",
        port: 5000,
      });
    });
  });

  describe("Transport Type Validation", () => {
    it("should validate transport mode types correctly", () => {
      // Test each valid transport mode
      const validModes = ["stdio", "sse", "httpStream"] as const;

      validModes.forEach((mode) => {
        mockEnv.TEST_TRANSPORT = mode === "httpStream" ? "httpstream" : mode;
        const result = getTransportMode();
        expect(result).toBe(mode);
      });
    });

    it("should handle edge cases in environment variable values", () => {
      // Test with whitespace
      mockEnv.TEST_TRANSPORT = "  sse  ";
      let mode = getTransportMode();
      expect(mode).toBe("stdio"); // Should default due to whitespace

      // Test with undefined explicitly
      mockEnv.TEST_TRANSPORT = undefined;
      mode = getTransportMode();
      expect(mode).toBe("stdio");
    });

    it("should handle endpoint paths without leading slash", () => {
      mockEnv.TEST_TRANSPORT = "sse";
      mockEnv.TEST_TRANSPORT_ENDPOINT = "api/mcp"; // No leading slash
      const config = getTestTransportConfig();
      expect(config).toEqual({
        endpoint: "api/mcp", // Function returns as-is, server handles normalization
        mode: "sse",
        port: 3000,
      });
    });
  });
});
