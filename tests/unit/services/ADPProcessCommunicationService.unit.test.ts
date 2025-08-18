import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as processModule from "../../../src/process.js";
import { ADPProcessCommunicationService } from "../../../src/services/ADPProcessCommunicationService.js";
import { DocumentationProtocolService } from "../../../src/services/DocumentationProtocolService.js";

// Mock dependencies

vi.mock("../../../src/services/DocumentationProtocolService.js", () => ({
  DocumentationProtocolService: {
    generateMessageTags: vi.fn(),
    parseInfoResponse: vi.fn(),
    validateParameters: vi.fn(),
  },
}));

// Mock @permaweb/aoconnect to prevent Buffer/createDataItemSigner errors
vi.mock("@permaweb/aoconnect", () => ({
  connect: vi.fn(() => ({
    dryrun: vi.fn(),
    message: vi.fn().mockResolvedValue("mock-message-id"),
    result: vi.fn(),
    spawn: vi.fn(),
  })),
  createDataItemSigner: vi.fn(() => vi.fn()),
  message: vi.fn().mockResolvedValue("mock-message-id"),
}));

// Mock process.ts functions
vi.mock("../../../src/process.js", () => ({
  read: vi.fn(),
  send: vi.fn(),
}));

// Mock fetch for GraphQL queries
global.fetch = vi.fn();

describe("ADPProcessCommunicationService", () => {
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the cache between tests
    ADPProcessCommunicationService.clearCache();
    mockKeyPair = {
      d: "mock-d-value",
      dp: "mock-dp-value",
      dq: "mock-dq-value",
      e: "AQAB",
      kty: "RSA",
      n: "mock-n-value",
      p: "mock-p-value",
      q: "mock-q-value",
      qi: "mock-qi-value",
    } as JWKInterface;
  });

  describe("cache management", () => {
    it("should clear cache for specific process", () => {
      ADPProcessCommunicationService.clearCache("test-process");
      const stats = ADPProcessCommunicationService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it("should clear all cache", () => {
      ADPProcessCommunicationService.clearCache();
      const stats = ADPProcessCommunicationService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });
  });

  describe("discoverADPSupport", () => {
    it("should discover ADP-compliant process", async () => {
      const mockAdpData = JSON.stringify({
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            parameters: [],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      });

      const mockParsedResponse = {
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            parameters: [],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0" as const,
      };

      // Mock the read call for ADP discovery
      vi.mocked(processModule.read).mockResolvedValue({
        Data: mockAdpData,
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockParsedResponse,
      );

      const result = await ADPProcessCommunicationService.discoverADPSupport(
        "test-process",
        mockKeyPair,
      );

      expect(result).toEqual(mockParsedResponse);
      expect(
        DocumentationProtocolService.parseInfoResponse,
      ).toHaveBeenCalledWith(mockAdpData);
    });

    it("should return null for non-ADP process", async () => {
      // Mock read call returning no Data or parseInfoResponse returning null
      vi.mocked(processModule.read).mockResolvedValue({
        Data: "non-adp-response",
      });

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        null,
      );

      const result = await ADPProcessCommunicationService.discoverADPSupport(
        "test-process",
        mockKeyPair,
      );

      expect(result).toBeNull();
    });

    it("should handle discovery errors gracefully", async () => {
      vi.mocked(processModule.read).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await ADPProcessCommunicationService.discoverADPSupport(
        "test-process",
        mockKeyPair,
      );

      expect(result).toBeNull();
    });
  });

  describe("executeRequest", () => {
    const mockADPResponse = {
      handlers: [
        {
          action: "Balance",
          description: "Get token balance for a specific address",
          parameters: [
            {
              description: "Address to check balance for",
              name: "Target",
              required: false,
              type: "address" as const,
            },
          ],
          pattern: ["Action"],
        },
        {
          action: "Transfer",
          description: "Transfer tokens to another address",
          parameters: [
            {
              description: "Recipient address",
              name: "Target",
              required: true,
              type: "address" as const,
            },
            {
              description: "Amount to transfer",
              name: "Quantity",
              required: true,
              type: "string" as const,
            },
          ],
          pattern: ["Action"],
        },
      ],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    it("should execute request successfully", async () => {
      const mockValidation = { errors: [], valid: true };
      const mockTags = [
        { name: "Action", value: "Balance" },
        { name: "Target", value: "alice" },
      ];
      const mockAOResponse = {
        data: { balance: "1000" },
        error: undefined,
        success: true,
      };

      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue(mockValidation);
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue(mockTags);
      // Mock process.read for read operation (Balance is read-only)
      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ balance: "1000" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "check balance for alice",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.approach).toBe("ADP");
      expect(result.handlerUsed).toBe("Balance");
      expect(result.data).toEqual({ balance: "1000" });
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("should handle parameter validation failure", async () => {
      const mockValidation = {
        errors: ["Required parameter 'Target' is missing"],
        valid: false,
      };

      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue(mockValidation);

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "transfer tokens",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(false);
      expect(result.approach).toBe("ADP");
      expect(result.error).toContain("Parameter validation failed");
    });

    it("should handle no matching handler", async () => {
      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "unknown operation",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(false);
      expect(result.approach).toBe("ADP");
      expect(result.error).toContain(
        "Could not match request to any available ADP handler",
      );
      expect(result.availableHandlers).toEqual(["Balance", "Transfer"]);
    });

    it("should discover ADP support if not provided", async () => {
      const mockAdpData = JSON.stringify(mockADPResponse);

      // Mock GraphQL discovery response
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              data: {
                transactions: {
                  edges: [
                    {
                      node: {
                        data: { size: 100, type: "application/json" },
                        id: "mock-transaction-id",
                        tags: [{ name: "Action", value: "Info-Response" }],
                      },
                    },
                  ],
                },
              },
            }),
          ok: true,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockAdpData),
        } as any);

      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockADPResponse,
      );
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([{ name: "Action", value: "Balance" }]);
      // Mock process.read for read operation
      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ balance: "1000" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "check balance",
        mockKeyPair,
      );

      expect(result.success).toBe(true);
      expect(result.approach).toBe("ADP");
    });

    it("should return error if process does not support ADP", async () => {
      // Mock read call for ADP discovery to return non-ADP data
      vi.mocked(processModule.read).mockResolvedValue({
        Data: "non-adp-response",
      });

      // Mock parseInfoResponse to return null (indicating non-ADP process)
      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        null,
      );

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "check balance",
        mockKeyPair,
      );

      expect(result.success).toBe(false);
      expect(result.approach).toBe("ADP");
      expect(result.error).toContain("Process does not support ADP");
    });
  });

  describe("parameter extraction", () => {
    it("should extract transfer parameters correctly", async () => {
      const mockADPResponse = {
        handlers: [
          {
            action: "Transfer",
            description: "Transfer tokens",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address" as const,
              },
              {
                description: "Amount to transfer",
                name: "Quantity",
                required: true,
                type: "number" as const,
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0" as const,
      };

      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([
        { name: "Action", value: "Transfer" },
        { name: "Target", value: "alice" },
        { name: "Quantity", value: "100" },
      ]);
      // Mock process.send for write operation (Transfer is a write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ message: "Transfer successful" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "transfer 100 tokens to alice",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({
        Quantity: 100,
        Target: "alice",
      });
    });
  });
});
