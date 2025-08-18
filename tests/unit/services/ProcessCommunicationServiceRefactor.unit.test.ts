import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADPProcessCommunicationService } from "../../../src/services/ADPProcessCommunicationService.js";
import { LegacyProcessCommunicationService } from "../../../src/services/LegacyProcessCommunicationService.js";
import { processCommunicationService } from "../../../src/services/ProcessCommunicationService.js";

// Mock the services
vi.mock("../../../src/services/ADPProcessCommunicationService.js", () => ({
  ADPProcessCommunicationService: {
    executeRequest: vi.fn(),
  },
}));

vi.mock("../../../src/services/LegacyProcessCommunicationService.js", () => ({
  LegacyProcessCommunicationService: {
    executeSmartRequest: vi.fn(),
    executeWithMarkdown: vi.fn(),
  },
}));

describe("ProcessCommunicationService (Refactored)", () => {
  let mockKeyPair: JWKInterface;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKeyPair = { kty: "RSA" } as JWKInterface;
  });

  describe("executeProcessRequest", () => {
    it("should route to legacy service for markdown-based requests", async () => {
      const markdown = "# Test Process\n\n## Balance";
      const mockResponse = {
        approach: "legacy" as const,
        data: { balance: "1000" },
        success: true,
      };

      vi.mocked(
        LegacyProcessCommunicationService.executeWithMarkdown,
      ).mockResolvedValue(mockResponse);

      const result = await processCommunicationService.executeProcessRequest(
        markdown,
        "test-process",
        "check balance",
        mockKeyPair,
      );

      expect(
        LegacyProcessCommunicationService.executeWithMarkdown,
      ).toHaveBeenCalledWith(
        markdown,
        "test-process",
        "check balance",
        mockKeyPair,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ balance: "1000" });
    });
  });

  describe("executeSmartRequest", () => {
    it("should use markdown path when provided", async () => {
      const markdown = "# Test Process\n\n## Balance";
      const mockResponse = {
        approach: "legacy" as const,
        data: { balance: "1000" },
        success: true,
      };

      vi.mocked(
        LegacyProcessCommunicationService.executeWithMarkdown,
      ).mockResolvedValue(mockResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance",
        mockKeyPair,
        markdown,
      );

      expect(
        LegacyProcessCommunicationService.executeWithMarkdown,
      ).toHaveBeenCalledWith(
        markdown,
        "test-process",
        "check balance",
        mockKeyPair,
      );

      expect(result.success).toBe(true);
      expect(result.approach).toBe("legacy");
    });

    it("should try ADP first when no markdown provided", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        confidence: 0.9,
        data: { balance: "1000" },
        handlerUsed: "Balance",
        parametersUsed: { Target: "alice" },
        success: true,
      };

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance for alice",
        mockKeyPair,
      );

      expect(
        ADPProcessCommunicationService.executeRequest,
      ).toHaveBeenCalledWith(
        "test-process",
        "check balance for alice",
        mockKeyPair,
      );

      expect(result.success).toBe(true);
      expect(result.approach).toBe("ADP");
      expect(result.handlerUsed).toBe("Balance");
      expect(result.confidence).toBe(0.9);
    });

    it("should fall back to legacy when ADP fails", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        error: "Process does not support ADP or discovery failed",
        success: false,
      };

      const mockLegacyResponse = {
        approach: "legacy" as const,
        confidence: 0.7,
        data: { balance: "1000" },
        handlerUsed: "Balance",
        processType: "token",
        success: true,
        suggestions: ["Balance", "Transfer"],
        templateUsed: "default",
      };

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);
      vi.mocked(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockLegacyResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance",
        mockKeyPair,
      );

      // Should try ADP first
      expect(
        ADPProcessCommunicationService.executeRequest,
      ).toHaveBeenCalledWith("test-process", "check balance", mockKeyPair);

      // Then fall back to legacy
      expect(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "test-process",
        "check balance",
        mockKeyPair,
        undefined,
      );

      expect(result.success).toBe(true);
      expect(result.approach).toBe("legacy");
      expect(result.processType).toBe("token");
      expect(result.suggestions).toEqual(["Balance", "Transfer"]);
    });

    it("should not fall back to legacy if ADP fails with validation error", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        error:
          "Parameter validation failed: Required parameter 'Target' is missing",
        success: false,
      };

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance",
        mockKeyPair,
      );

      // Should try ADP
      expect(
        ADPProcessCommunicationService.executeRequest,
      ).toHaveBeenCalledTimes(1);

      // Should NOT fall back to legacy for validation errors
      expect(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).not.toHaveBeenCalled();

      expect(result.success).toBe(false);
      expect(result.approach).toBe("ADP");
      expect(result.error).toContain("Parameter validation failed");
    });

    it("should pass embedded templates to legacy service", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        error: "Process does not support ADP or discovery failed",
        success: false,
      };

      const mockLegacyResponse = {
        approach: "legacy" as const,
        data: { balance: "1000" },
        success: true,
      };

      const embeddedTemplates = new Map([
        ["token", { handlers: [], name: "Token", processId: "" }],
      ]);

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);
      vi.mocked(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockLegacyResponse);

      await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance",
        mockKeyPair,
        undefined,
        embeddedTemplates,
      );

      expect(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).toHaveBeenCalledWith(
        "test-process",
        "check balance",
        mockKeyPair,
        embeddedTemplates,
      );
    });
  });

  describe("routing logic", () => {
    it("should prefer ADP over legacy when both succeed", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        data: { balance: "1000" },
        success: true,
      };

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "check balance",
        mockKeyPair,
      );

      // Should use ADP result and not call legacy at all
      expect(
        ADPProcessCommunicationService.executeRequest,
      ).toHaveBeenCalledTimes(1);
      expect(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).not.toHaveBeenCalled();

      expect(result.approach).toBe("ADP");
    });

    it("should handle both services failing", async () => {
      const mockADPResponse = {
        approach: "ADP" as const,
        error: "Process does not support ADP or discovery failed",
        success: false,
      };

      const mockLegacyResponse = {
        approach: "legacy" as const,
        error: "Could not process request",
        success: false,
      };

      vi.mocked(
        ADPProcessCommunicationService.executeRequest,
      ).mockResolvedValue(mockADPResponse);
      vi.mocked(
        LegacyProcessCommunicationService.executeSmartRequest,
      ).mockResolvedValue(mockLegacyResponse);

      const result = await processCommunicationService.executeSmartRequest(
        "test-process",
        "unknown request",
        mockKeyPair,
      );

      expect(result.success).toBe(false);
      expect(result.approach).toBe("legacy");
      expect(result.error).toBe("Could not process request");
    });
  });

  describe("backward compatibility", () => {
    it("should maintain existing buildAOMessage interface", () => {
      const handler = {
        action: "Balance",
        description: "Get balance",
        examples: [],
        isWrite: false,
        parameters: [],
      };

      const parameters = { Quantity: "100", Target: "alice" };

      const result = processCommunicationService.buildAOMessage(
        "test-process",
        handler,
        parameters,
      );

      expect(result.processId).toBe("test-process");
      expect(result.isWrite).toBe(false);
      expect(result.tags).toEqual(
        expect.arrayContaining([
          { name: "Action", value: "Balance" },
          { name: "Target", value: "alice" },
          { name: "Quantity", value: "100" },
        ]),
      );
      expect(result.tags).toHaveLength(3);
    });

    it("should maintain existing parseMarkdown interface", () => {
      const markdown = `# Test Process

## Balance

Get account balance.

- Target: Account address (optional)

## Transfer

Transfer tokens.

- Target: Recipient address (required)
- Quantity: Amount to transfer (required)
`;

      const result = processCommunicationService.parseMarkdown(markdown);

      expect(result.name).toBe("Test Process");
      expect(result.handlers).toHaveLength(2);
      expect(result.handlers[0].action).toBe("Balance");
      expect(result.handlers[1].action).toBe("Transfer");
      expect(result.handlers[1].isWrite).toBe(true); // Transfer is a write operation
    });
  });
});
