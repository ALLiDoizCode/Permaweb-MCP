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

describe("ADPProcessCommunicationService - Parameter Extraction", () => {
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

  describe("current mathematical patterns - regression tests", () => {
    const mathHandler = {
      action: "Add",
      parameters: [
        { name: "A", type: "number" },
        { name: "B", type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    it("should extract parameters from 'add 15 and 7'", async () => {
      // Mock generateMessageTags to capture what parameters were extracted
      let capturedParameters: Record<string, any> = {};
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        capturedParameters = parameters;
        return [
          { name: "Action", value: "Add" },
          { name: "A", value: String(parameters.A || "") },
          { name: "B", value: String(parameters.B || "") },
        ];
      });

      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      // Mock process.send for Add operation (write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ result: "22" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 15 and 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({ A: 15, B: 7 });
    });

    it("should extract parameters from '15 + 7'", async () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockReturnValue([
        { name: "Action", value: "Add" },
        { name: "A", value: "15" },
        { name: "B", value: "7" },
      ]);
      // Mock process.send for Add operation (write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ result: "22" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "15 + 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({ A: 15, B: 7 });
    });

    it("should extract parameters from 'subtract 15 from 20'", async () => {
      const subtractHandler = {
        action: "Subtract",
        parameters: [
          { name: "A", type: "number" },
          { name: "B", type: "number" },
        ],
      };

      const subtractADPResponse = {
        handlers: [subtractHandler],
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
        { name: "Action", value: "Subtract" },
        { name: "A", value: "15" },
        { name: "B", value: "20" },
      ]);
      // Mock process.send for Subtract operation (write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ result: "5" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "subtract 15 from 20",
        mockKeyPair,
        subtractADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({ A: 15, B: 20 });
    });

    it("should extract parameters from '20 - 15'", async () => {
      const subtractHandler = {
        action: "Subtract",
        parameters: [
          { name: "A", type: "number" },
          { name: "B", type: "number" },
        ],
      };

      const subtractADPResponse = {
        handlers: [subtractHandler],
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
        { name: "Action", value: "Subtract" },
        { name: "A", value: "20" },
        { name: "B", value: "15" },
      ]);
      // Mock process.send for Subtract operation (write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ result: "5" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "20 - 15",
        mockKeyPair,
        subtractADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({ A: 20, B: 15 });
    });
  });

  describe("current transfer patterns - regression tests", () => {
    const transferHandler = {
      action: "Transfer",
      parameters: [
        { name: "Target", type: "address" },
        { name: "Quantity", type: "number" },
      ],
    };

    const transferADPResponse = {
      handlers: [transferHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    it("should extract transfer parameters from 'transfer 100 tokens to alice'", async () => {
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
      // Mock process.send for Transfer operation (write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ message: "Transfer successful" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "transfer 100 tokens to alice",
        mockKeyPair,
        transferADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed).toEqual({ Quantity: 100, Target: "alice" });
    });
  });

  describe("current issues - to be fixed", () => {
    const mathHandler = {
      action: "Add",
      parameters: [
        { name: "A", type: "number" },
        { name: "B", type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    it("should fail to extract from 'Add 5 and 3' (case sensitivity issue)", async () => {
      // Mock validation failure to show current issue
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: ["Could not extract parameters"],
        valid: false,
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "Add 5 and 3",
        mockKeyPair,
        mockADPResponse,
      );

      // This currently fails - will be fixed in enhancement
      expect(result.success).toBe(false);
    });

    it("should fail to extract from '5 plus 3' (missing patterns)", async () => {
      // Mock validation failure to show current issue
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: ["Could not extract parameters"],
        valid: false,
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "5 plus 3",
        mockKeyPair,
        mockADPResponse,
      );

      // This currently fails - will be fixed in enhancement
      expect(result.success).toBe(false);
    });

    it("should fail to extract from 'add 5 to 3' (missing patterns)", async () => {
      // Mock validation failure to show current issue
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: ["Could not extract parameters"],
        valid: false,
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 5 to 3",
        mockKeyPair,
        mockADPResponse,
      );

      // This currently fails - will be fixed in enhancement
      expect(result.success).toBe(false);
    });
  });
});
