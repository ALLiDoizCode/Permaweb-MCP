import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnifiedProcessResponse } from "../../../../src/types/unified-communication.js";

import {
  DocumentationProtocolService,
  type ExtendedInfoResponse,
  type HandlerMetadata,
} from "../../../../src/services/DocumentationProtocolService.js";
import { ProcessCacheService } from "../../../../src/services/ProcessCacheService.js";
import { processCommunicationService } from "../../../../src/services/ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "../../../../src/services/TokenProcessTemplateService.js";
import {
  AutoSafeToolContext,
  ToolContext,
} from "../../../../src/tools/core/index.js";
import { AOProcessCommunicateCommand } from "../../../../src/tools/process/commands/AOProcessCommunicateCommand.js";

// Mock external dependencies
vi.mock("../../../../src/services/ProcessCacheService.js", () => ({
  ProcessCacheService: {
    getProcessInfo: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ProcessCommunicationService.js", () => ({
  processCommunicationService: {
    executeProcessRequest: vi.fn(),
    executeSmartRequest: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DocumentationProtocolService.js", () => ({
  DocumentationProtocolService: {
    parseInfoResponse: vi.fn(),
  },
}));

vi.mock("../../../../src/services/TokenProcessTemplateService.js", () => ({
  TokenProcessTemplateService: {
    getTokenTemplateAsMarkdown: vi.fn(),
    isSupported: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DefaultProcessService.js", () => ({
  defaultProcessService: {
    getDefaultProcess: vi.fn(),
  },
}));

vi.mock("../../../../src/tools/core/index.js", () => ({
  AutoSafeToolContext: {
    from: vi.fn(),
  },
  CommonSchemas: {
    processId: {
      describe: vi.fn().mockReturnValue({
        describe: vi.fn(),
      }),
    },
  },
  ToolCommand: class {
    constructor() {}
  },
  ToolContext: class {
    constructor() {}
  },
  ToolMetadata: {},
}));

describe("AOProcessCommunicateCommand", () => {
  let command: AOProcessCommunicateCommand;
  let mockContext: ToolContext;
  let mockSafeContext: any;
  let mockKeyPair: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = { mockKey: "test-key" };
    mockSafeContext = {
      getKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
    };

    mockContext = {
      embeddedTemplates: new Map(),
    } as any;

    (AutoSafeToolContext.from as any).mockReturnValue(mockSafeContext);

    command = new AOProcessCommunicateCommand(mockContext);
  });

  describe("Parameter validation", () => {
    it("should validate required processId parameter", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
      };

      // Mock successful execution
      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Test Process\n## Balance\nGet account balance",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockSafeContext.getKeyPair).toHaveBeenCalled();
    });

    it("should handle optional parameters correctly", async () => {
      const args = {
        formatting: "compact" as const,
        mode: "write" as const,
        processId: "test-process-id",
        request: "transfer 100 tokens to alice",
        timeout: 60000,
        validateOnly: false,
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Token Process\n## Transfer\nTransfer tokens",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { transferred: "100" },
        handlerUsed: "Transfer",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write");
      expect(parsed.processingMode).toBe("write");
    });

    it("should handle missing processId gracefully", async () => {
      const args = {
        processId: "",
        request: "get balance",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.result.summary).toContain("failed");
    });
  });

  describe("Mode detection", () => {
    it("should detect read operations correctly", async () => {
      const args = {
        mode: "auto" as const,
        processId: "test-process-id",
        request: "get my balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Token Process\n## Balance\nGet account balance",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("read");
    });

    it("should detect write operations correctly", async () => {
      const args = {
        mode: "auto" as const,
        processId: "test-process-id",
        request: "transfer 100 tokens to alice",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Token Process\n## Transfer\nTransfer tokens",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { transferred: "100" },
        handlerUsed: "Transfer",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("write");
    });

    it("should respect explicit mode settings", async () => {
      const args = {
        mode: "validate" as const,
        processId: "test-process-id",
        request: "some action",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("validate");
      expect(parsed.result.details.validationStatus).toBe("completed");
    });
  });

  describe("ADP handler discovery", () => {
    it("should use ADP metadata when available", async () => {
      const mockADPInfo: ExtendedInfoResponse = {
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            parameters: [
              {
                description: "Address to check",
                name: "Target",
                required: false,
                type: "address",
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: new Date().toISOString(),
        protocolVersion: "1.0",
      };

      const args = {
        mode: "auto" as const,
        processId: "test-process-id",
        request: "check balance for alice",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: JSON.stringify(mockADPInfo),
        success: true,
      });

      (DocumentationProtocolService.parseInfoResponse as any).mockReturnValue(
        mockADPInfo,
      );

      (
        processCommunicationService.executeSmartRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(DocumentationProtocolService.parseInfoResponse).toHaveBeenCalled();
    });

    it("should fall back to markdown parsing when ADP not available", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Token Process\n## Balance\nGet token balance",
        success: true,
      });

      (DocumentationProtocolService.parseInfoResponse as any).mockReturnValue(
        null,
      );

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(
        processCommunicationService.executeProcessRequest,
      ).toHaveBeenCalled();
    });
  });

  describe("Parameter extraction", () => {
    it("should extract numeric parameters correctly", async () => {
      const mockHandlerMetadata: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          {
            description: "Amount to transfer",
            name: "Quantity",
            required: true,
            type: "string",
          },
          {
            description: "Recipient address",
            name: "Target",
            required: true,
            type: "address",
          },
        ],
        pattern: ["Action"],
      };

      const request = "transfer 500 tokens to alice";

      // Access private method for testing
      const extractedParams = (command as any).extractADPParameters(
        request,
        mockHandlerMetadata,
      );

      expect(extractedParams.Quantity).toBeDefined();
      expect(extractedParams.Target).toBe("alice");
    });

    it("should extract address parameters correctly", async () => {
      const mockHandlerMetadata: HandlerMetadata = {
        action: "Balance",
        parameters: [
          {
            description: "Address to check balance for",
            name: "Target",
            required: false,
            type: "address",
          },
        ],
        pattern: ["Action"],
      };

      const request =
        "check balance for vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI";

      const extractedParams = (command as any).extractADPParameters(
        request,
        mockHandlerMetadata,
      );

      expect(extractedParams.Target).toBe(
        "vh-nthvvlkzqrxc8lyytnok65yq55a_pj1zwlb9g2ji",
      );
    });
  });

  describe("Error handling", () => {
    it("should handle ProcessCacheService errors gracefully", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockRejectedValue(
        new Error("Cache service error"),
      );

      // Mock ProcessCommunicationService to also fail
      (
        processCommunicationService.executeSmartRequest as any
      ).mockRejectedValue(new Error("No process info available"));

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.result.details.error).toContain(
        "No process info available",
      );
    });

    it("should handle ProcessCommunicationService errors gracefully", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Test Process\n## Balance\nGet balance",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockRejectedValue(new Error("Communication error"));

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.result.details.error).toContain("Communication error");
    });
  });

  describe("Validation mode", () => {
    it("should perform validation without execution", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
        validateOnly: true,
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("validate");
      expect(parsed.result.details.validationStatus).toBe("completed");
      expect(parsed.success).toBe(true);

      // Should not call actual execution methods
      expect(
        processCommunicationService.executeProcessRequest,
      ).not.toHaveBeenCalled();
      expect(
        processCommunicationService.executeSmartRequest,
      ).not.toHaveBeenCalled();
    });

    it("should include validation details in response", async () => {
      const args = {
        mode: "validate" as const,
        parameters: { amount: 100, recipient: "alice" },
        processId: "test-process-id",
        request: "transfer tokens",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.result.details.parametersProvided).toEqual([
        "amount",
        "recipient",
      ]);
      expect(parsed.result.details.mode).toBe("validate");
    });
  });

  describe("Response formatting", () => {
    it("should format responses as compact when requested", async () => {
      const args = {
        formatting: "compact" as const,
        processId: "test-process-id",
        request: "get balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Test Process\n## Balance\nGet balance",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);

      // Compact formatting should not have pretty-printing (no indentation)
      expect(result).not.toContain("  ");

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should format responses as detailed by default", async () => {
      const args = {
        processId: "test-process-id",
        request: "get balance",
      };

      (ProcessCacheService.getProcessInfo as any).mockResolvedValue({
        processMarkdown: "# Test Process\n## Balance\nGet balance",
        success: true,
      });

      (
        processCommunicationService.executeProcessRequest as any
      ).mockResolvedValue({
        data: { balance: "100" },
        handlerUsed: "Balance",
        success: true,
      });

      const result = await command.execute(args);

      // Detailed formatting should have pretty-printing (indentation)
      expect(result).toContain("  ");

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
