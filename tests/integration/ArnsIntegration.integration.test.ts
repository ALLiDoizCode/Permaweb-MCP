import { beforeAll, describe, expect, it, vi } from "vitest";

import { aiMemoryService } from "../../src/services/aiMemoryService.js";
import { ArnsIntegrationService } from "../../src/services/ArnsIntegrationService.js";
import { ArnsAddressResolver } from "../../src/tools/arns/utils/ArnsAddressResolver.js";
import { CommonSchemas } from "../../src/tools/core/ToolValidator.js";
import { ExecuteActionCommand } from "../../src/tools/process/commands/ExecuteActionCommand.js";

// Mock external dependencies with partial mocking
vi.mock("../../src/process.js", async () => {
  const actual = await vi.importActual("../../src/process.js");
  return {
    ...actual,
    checkProcess: vi.fn().mockResolvedValue(true),
    createProcess: vi.fn().mockResolvedValue("mock-process-id-123"),
    read: vi.fn().mockResolvedValue({ Data: '{"Balance": "1000"}' }),
    send: vi.fn().mockResolvedValue("tx-id-123"),
  };
});

vi.mock("../../src/relay.js", async () => {
  const actual = await vi.importActual("../../src/relay.js");
  return {
    ...actual,
    evalProcess: vi.fn().mockResolvedValue("mock-eval-result"),
    event: vi.fn().mockResolvedValue(["tag1", "tag2"]),
    fetchEvents: vi.fn().mockResolvedValue({ events: [] }),
    fetchEventsVIP01: vi.fn().mockResolvedValue({ events: [] }),
  };
});

// Mock aiMemoryService
vi.mock("../../src/services/aiMemoryService.js", () => ({
  aiMemoryService: {
    addArnsRecord: vi.fn().mockResolvedValue("ArNS record stored successfully"),
    getArnsOperationHistory: vi.fn().mockResolvedValue([]),
    searchArnsRecords: vi.fn().mockResolvedValue([]),
  },
  MEMORY_KINDS: {
    ARNS_MAPPING: "arns-mapping",
    CONTACT_MAPPING: "contact-mapping",
  },
}));

// Mock ArnsClientManager
vi.mock("../../src/tools/arns/utils/ArnsClientManager.js", () => ({
  ArnsClientManager: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => ({
        resolveArNSName: vi
          .fn()
          .mockResolvedValue("mock-resolved-address-123456789012345678901"),
      })),
      getCurrentNetwork: vi.fn(() => "testnet"),
      initializeFromEnvironment: vi.fn().mockResolvedValue(undefined),
      switchNetwork: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock ADP service
vi.mock("../../src/services/ADPProcessCommunicationService.js", () => ({
  ADPProcessCommunicationService: {
    executeRequest: vi.fn().mockResolvedValue({
      data: "Action executed successfully",
      methodUsed: "ADP",
      success: true,
    }),
  },
}));

describe("ArNS Integration", () => {
  describe("ArnsAddressResolver", () => {
    it("should identify ArNS names correctly", () => {
      expect(ArnsAddressResolver.isArnsName("example.ar")).toBe(true);
      expect(ArnsAddressResolver.isArnsName("sub.example.ar")).toBe(true);
      expect(ArnsAddressResolver.isArnsName("not-arns")).toBe(false);
    });

    it("should validate ArNS name format", async () => {
      // Use a truly invalid format that contains invalid characters
      const result =
        await ArnsAddressResolver.resolveArnsToAddress("invalid@format!");

      expect(result.resolved).toBe(false);
      expect(result.verificationMessage).toContain("Invalid ArNS name format");
    });
  });

  describe("ArnsAddressResolver Resolution", () => {
    it("should resolve ArNS names to addresses", async () => {
      // Test that ArNS names are resolved successfully
      const arnsName = "example.ar";

      const arnsResult =
        await ArnsAddressResolver.resolveArnsToAddress(arnsName);

      // ArNS name should be processed by ArNS resolver and resolve successfully
      expect(arnsResult.resolved).toBe(true);
      expect(arnsResult.requiresVerification).toBe(true);
      expect(arnsResult.verificationMessage).toContain("ArNS name");
      expect(arnsResult.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });

  describe("Cross-Tool Address Support", () => {
    it("should resolve ArNS names through ArnsAddressResolver", async () => {
      const arnsName = "test.ar";

      // ArNS name should be processed without throwing errors
      const arnsResult =
        await ArnsAddressResolver.resolveArnsToAddress(arnsName);

      expect(arnsResult).toBeDefined();

      // ArNS should be recognized and processed successfully
      expect(arnsResult.verificationMessage).toContain(".ar");
      expect(arnsResult.resolved).toBe(true);
    });
  });

  describe("Schema Validation for ArNS Names", () => {
    it("should validate ArNS names in addressOrArnsName schema", () => {
      // Test direct addresses
      const directAddress = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG";
      const directResult =
        CommonSchemas.addressOrArnsName.safeParse(directAddress);
      expect(directResult.success).toBe(true);

      // Test valid ArNS names
      const validArnsNames = ["example.ar", "sub.example.ar", "my-name.ar"];
      for (const name of validArnsNames) {
        const result = CommonSchemas.addressOrArnsName.safeParse(name);
        expect(result.success).toBe(true);
      }

      // Test invalid formats
      const invalidFormats = [
        "not-arns",
        "invalid-.ar",
        "-invalid.ar",
        "example",
        "",
      ];
      for (const invalid of invalidFormats) {
        const result = CommonSchemas.addressOrArnsName.safeParse(invalid);
        if (result.success) {
          console.log(`Unexpected success for: "${invalid}"`);
        }
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Process Communication with ArNS", () => {
    it("should execute actions on processes identified by ArNS names", async () => {
      const mockContext = {
        hubId: "test-hub",
        keyPair: { kty: "RSA", n: "mock-public-key" },
        publicKey: "mock-public-key",
      };

      const command = new ExecuteActionCommand(mockContext);

      const result = await command.execute({
        processId: "myprocess.ar",
        request: "Get process info",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.resolvedProcessId).toBe(
        "mock-resolved-address-123456789012345678901",
      );
      expect(response.originalProcessId).toBe("myprocess.ar");
    });
  });

  describe("ArNS Integration Service", () => {
    it("should provide centralized ArNS resolution with caching", async () => {
      // Test first resolution (should cache)
      const result1 = await ArnsIntegrationService.resolveArnsName("test.ar");
      expect(result1.resolved).toBe(true);
      expect(result1.value).toBe("mock-resolved-address-123456789012345678901");

      // Test second resolution (should use cache)
      const result2 = await ArnsIntegrationService.resolveArnsName("test.ar");
      expect(result2.resolved).toBe(true);
      expect(result2.value).toBe("mock-resolved-address-123456789012345678901");

      // Verify cache statistics
      const cacheStats = ArnsIntegrationService.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it("should store ArNS operations in memory", async () => {
      const mockSigner = { kty: "RSA", n: "mock-public-key" };
      const hubId = "test-hub";

      const operation = {
        arnsName: "test.ar",
        metadata: { cost: "100" },
        network: "testnet" as const,
        operation: "registration" as const,
        timestamp: new Date().toISOString(),
        transactionId: "tx-123",
      };

      const result = await ArnsIntegrationService.storeArnsOperation(
        operation,
        mockSigner,
        hubId,
      );

      expect(result).toContain("ArNS record stored");
    });

    it("should provide health check functionality", async () => {
      const health = await ArnsIntegrationService.healthCheck();

      expect(health.clientInitialized).toBe(true);
      expect(health.network).toBe("testnet");
      expect(health.cacheSize).toBeGreaterThanOrEqual(0);
      expect(health.lastError).toBeNull();
    });
  });

  describe("Memory System Integration", () => {
    it("should store and retrieve ArNS operations in memory", async () => {
      const mockSigner = { kty: "RSA", n: "mock-public-key" };
      const hubId = "test-hub";

      // Store ArNS operation
      const result = await aiMemoryService.addArnsRecord(
        mockSigner,
        hubId,
        "example.ar",
        "tx-456",
        "registration",
        { cost: "250", network: "testnet" },
        "mock-public-key",
      );

      expect(result).toContain("ArNS record stored");

      // Retrieve ArNS operations
      const history = await aiMemoryService.getArnsOperationHistory(hubId);
      expect(Array.isArray(history)).toBe(true);

      // Search ArNS records
      const searchResults = await aiMemoryService.searchArnsRecords(
        hubId,
        "example",
      );
      expect(Array.isArray(searchResults)).toBe(true);
    });
  });
});
