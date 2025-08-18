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

// Mock @permaweb/aoconnect completely
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

describe("Enhanced Parameter Extraction", () => {
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe("Enhanced Mathematical Patterns", () => {
    const mathHandler = {
      action: "Add",
      parameters: [
        { name: "A", required: true, type: "number" },
        { name: "B", required: true, type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    const setupMocks = (expectedParams: Record<string, any>) => {
      // Mock the parseInfoResponse to return ADP data when discoverADPSupport is called
      vi.mocked(DocumentationProtocolService.parseInfoResponse).mockReturnValue(
        mockADPResponse,
      );

      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      let capturedParameters: Record<string, any> = {};
      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        capturedParameters = parameters;
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A || "") },
          { name: "B", value: String(parameters.B || "") },
        ];
      });

      // Mock read operation for ADP discovery
      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({
          handlers: [mathHandler],
          lastUpdated: "2024-01-01T00:00:00Z",
          protocolVersion: "1.0",
        }),
      });

      // Mock send operation for write operations (Add is a write operation)
      vi.mocked(processModule.send).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });

      return capturedParameters;
    };

    it("should extract from 'Add 5 and 3' (case insensitive)", async () => {
      const captured = setupMocks({ A: 5, B: 3 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "Add 5 and 3",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(5);
      expect(result.parametersUsed.B).toBe(3);
    });

    it("should extract from '5 plus 3'", async () => {
      const captured = setupMocks({ A: 5, B: 3 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "5 plus 3",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(5);
      expect(result.parametersUsed.B).toBe(3);
    });

    it("should extract from 'add 5 to 3'", async () => {
      const captured = setupMocks({ A: 5, B: 3 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 5 to 3",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(5);
      expect(result.parametersUsed.B).toBe(3);
    });

    it("should extract from 'what is 15 plus 7'", async () => {
      const captured = setupMocks({ A: 15, B: 7 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "what is 15 plus 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(15);
      expect(result.parametersUsed.B).toBe(7);
    });

    it("should extract from 'sum of 20 and 10'", async () => {
      const captured = setupMocks({ A: 20, B: 10 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "sum of 20 and 10",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(20);
      expect(result.parametersUsed.B).toBe(10);
    });

    it("should handle negative numbers", async () => {
      const captured = setupMocks({ A: -5, B: 3 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add -5 and 3",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(-5);
      expect(result.parametersUsed.B).toBe(3);
    });

    it("should handle decimal numbers", async () => {
      const captured = setupMocks({ A: 5.5, B: 3.2 });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 5.5 and 3.2",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(5.5);
      expect(result.parametersUsed.B).toBe(3.2);
    });
  });

  describe("Subtraction Patterns", () => {
    const subtractHandler = {
      action: "Subtract",
      parameters: [
        { name: "A", required: true, type: "number" }, // subtrahend
        { name: "B", required: true, type: "number" }, // minuend
      ],
    };

    const mockADPResponse = {
      handlers: [subtractHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    const setupMocks = () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A || "") },
          { name: "B", value: String(parameters.B || "") },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });
    };

    it("should extract from 'subtract 5 from 10' correctly", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "subtract 5 from 10",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(5); // subtrahend
      expect(result.parametersUsed.B).toBe(10); // minuend
    });

    it("should extract from '10 - 5' correctly", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "10 - 5",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(10); // minuend for A in X - Y
      expect(result.parametersUsed.B).toBe(5); // subtrahend for B in X - Y
    });
  });

  describe("Multiplication and Division Patterns", () => {
    const mathHandler = {
      action: "Multiply",
      parameters: [
        { name: "A", required: true, type: "number" },
        { name: "B", required: true, type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    const setupMocks = () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A || "") },
          { name: "B", value: String(parameters.B || "") },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });
    };

    it("should extract from 'multiply 6 by 7'", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "multiply 6 by 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(6);
      expect(result.parametersUsed.B).toBe(7);
    });

    it("should extract from '6 * 7'", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "6 * 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(6);
      expect(result.parametersUsed.B).toBe(7);
    });

    it("should extract from '6 times 7'", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "6 times 7",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(6);
      expect(result.parametersUsed.B).toBe(7);
    });
  });

  describe("Fallback Pattern Testing", () => {
    const mathHandler = {
      action: "Calculate",
      parameters: [
        { name: "A", required: true, type: "number" },
        { name: "B", required: true, type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    const setupMocks = () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A || "") },
          { name: "B", value: String(parameters.B || "") },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });
    };

    it("should use fallback patterns for unclear requests", async () => {
      setupMocks();

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "calculate something with 42 and 24",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(42);
      expect(result.parametersUsed.B).toBe(24);
    });

    it("should handle edge case with only one number available", async () => {
      const oneParamHandler = {
        action: "Square",
        parameters: [{ name: "A", required: true, type: "number" }],
      };

      const oneParamResponse = {
        handlers: [oneParamHandler],
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
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A || "") },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "square the number 9",
        mockKeyPair,
        oneParamResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(9);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    const mathHandler = {
      action: "Add",
      parameters: [
        { name: "A", required: true, type: "number" },
        { name: "B", required: true, type: "number" },
      ],
    };

    const mockADPResponse = {
      handlers: [mathHandler],
      lastUpdated: "2024-01-01T00:00:00Z",
      protocolVersion: "1.0" as const,
    };

    it("should handle zero values", async () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A) },
          { name: "B", value: String(parameters.B) },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 0 and 5",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(0);
      expect(result.parametersUsed.B).toBe(5);
    });

    it("should handle very large numbers within range", async () => {
      vi.mocked(
        DocumentationProtocolService.validateParameters,
      ).mockReturnValue({
        errors: [],
        valid: true,
      });

      vi.mocked(
        DocumentationProtocolService.generateMessageTags,
      ).mockImplementation((handler, parameters) => {
        return [
          { name: "Action", value: handler.action },
          { name: "A", value: String(parameters.A) },
          { name: "B", value: String(parameters.B) },
        ];
      });

      vi.mocked(processModule.read).mockResolvedValue({
        Data: JSON.stringify({ result: "success" }),
      });

      const result = await ADPProcessCommunicationService.executeRequest(
        "test-process",
        "add 1000000 and 2000000",
        mockKeyPair,
        mockADPResponse,
      );

      expect(result.success).toBe(true);
      expect(result.parametersUsed.A).toBe(1000000);
      expect(result.parametersUsed.B).toBe(2000000);
    });
  });
});
