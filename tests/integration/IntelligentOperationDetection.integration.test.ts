import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HandlerMetadata } from "../../src/services/DocumentationProtocolService.js";

import { BatchOperationService } from "../../src/services/BatchOperationService.js";
import { OperationDetectionService } from "../../src/services/OperationDetectionService.js";
import { ParameterSuggestionService } from "../../src/services/ParameterSuggestionService.js";
import { ProcessCacheService } from "../../src/services/ProcessCacheService.js";
import { processCommunicationService } from "../../src/services/ProcessCommunicationService.js";
import { RiskAssessmentService } from "../../src/services/RiskAssessmentService.js";
import { TransactionSimulationService } from "../../src/services/TransactionSimulationService.js";
import { ToolContext } from "../../src/tools/core/index.js";
import { AOProcessCommunicateCommand } from "../../src/tools/process/commands/AOProcessCommunicateCommand.js";

// Mock external dependencies
vi.mock("../../src/services/ProcessCacheService.js");
vi.mock("../../src/tools/core/index.js", () => ({
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

describe("IntelligentOperationDetection Integration Tests", () => {
  let command: AOProcessCommunicateCommand;
  let mockContext: ToolContext;
  let mockKeyPair: JWKInterface;

  const mockProcessId = "process_id_123456789012345678901234567890123";

  const mockTokenHandlers: HandlerMetadata[] = [
    {
      action: "Transfer",
      description: "Transfer tokens to another address",
      examples: ["Transfer 100 tokens to alice"],
      isWrite: true,
      parameters: [
        { name: "target", required: true, type: "string" },
        { name: "quantity", required: true, type: "number" },
      ],
    },
    {
      action: "Balance",
      description: "Get token balance for address",
      examples: ["Check balance for alice"],
      isWrite: false,
      parameters: [{ name: "target", required: false, type: "string" }],
    },
    {
      action: "Burn",
      description: "Burn tokens permanently",
      examples: ["Burn 50 tokens"],
      isWrite: true,
      parameters: [{ name: "quantity", required: true, type: "number" }],
    },
    {
      action: "Info",
      description: "Get token information",
      examples: ["Get token info"],
      isWrite: false,
      parameters: [],
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    mockKeyPair = { mockKey: "test-key" } as any;
    mockContext = {
      embeddedTemplates: new Map(),
    } as any;

    // Mock AutoSafeToolContext
    const mockSafeContext = {
      getKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
    };

    const { AutoSafeToolContext } = await import(
      "../../src/tools/core/index.js"
    );
    vi.mocked(AutoSafeToolContext.from).mockReturnValue(mockSafeContext);

    command = new AOProcessCommunicateCommand(mockContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("End-to-End Intelligent Operation Detection Workflow", () => {
    it("should detect read operation and execute with appropriate path", async () => {
      // Setup process cache with handler metadata
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown:
          "# Token Process\n## Handlers\n- Balance: Get balance\n- Transfer: Send tokens",
        success: true,
      });

      // Mock ProcessCommunicationService for read operation
      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        data: { account: "alice", balance: "1000" },
        handlerUsed: "Balance",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const args = {
        mode: "auto" as const,
        processId: mockProcessId,
        request: "check balance for alice",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("read");
      expect(parsed.handlerUsed).toBe("Balance");
      expect(parsed.result.details.balance).toBe("1000");

      // Verify detection workflow was used
      expect(mockExecuteProcessRequest).toHaveBeenCalledWith(
        expect.stringContaining("Token Process"),
        mockProcessId,
        "check balance for alice",
        mockKeyPair,
      );
    });

    it("should detect write operation with risk assessment and confirmation", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        data: {
          amount: "100",
          from: "sender",
          to: "alice",
          transactionId: "tx_123",
        },
        handlerUsed: "Transfer",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const args = {
        mode: "auto" as const,
        processId: mockProcessId,
        request: "transfer 100 tokens to alice",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write");
      expect(parsed.handlerUsed).toBe("Transfer");
      expect(parsed.result.details.transactionId).toBe("tx_123");
      expect(parsed.transaction).toBeDefined();
      expect(parsed.transaction.status).toBe("pending");
    });

    it("should handle high-risk operations with comprehensive risk assessment", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        data: { burned: "50", transactionId: "tx_burn_456" },
        handlerUsed: "Burn",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const args = {
        mode: "auto" as const,
        processId: mockProcessId,
        request: "burn 50 tokens",
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write");
      expect(parsed.handlerUsed).toBe("Burn");

      // High-risk operations should have confirmation details
      expect(parsed.riskAssessment).toBeDefined();
      expect(parsed.riskAssessment.level).toBe("high");
      expect(parsed.riskAssessment.confirmationRequired).toBe(true);
    });
  });

  describe("Multi-Layer Detection Integration", () => {
    it("should use ADP metadata as primary detection method", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({ data: {}, handlerUsed: "Transfer", success: true });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "transfer 100 to alice",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write"); // ADP metadata indicates isWrite: true
    });

    it("should fall back to NLP when ADP detection confidence is low", async () => {
      // Setup handlers that don't strongly match the request
      const genericHandlers: HandlerMetadata[] = [
        {
          action: "GenericAction",
          description: "Generic operation",
          isWrite: false,
          parameters: [],
        },
      ];

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: genericHandlers,
        processMarkdown: "# Generic Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "GenericAction",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "send 100 tokens", // Clear NLP write intent
      });

      const parsed = JSON.parse(result);
      expect(parsed.operation).toBe("write"); // NLP should detect write intent
    });

    it("should use pattern matching as final fallback", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: [],
        processMarkdown: "# Unknown Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({ data: {}, handlerUsed: "Unknown", success: true });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "get something", // Pattern should detect read
      });

      const parsed = JSON.parse(result);
      expect(parsed.operation).toBe("read"); // Pattern matching fallback
    });
  });

  describe("Parameter Suggestion Integration", () => {
    it("should provide parameter guidance for incomplete requests", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      // Mock a scenario where parameters are missing
      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        error: "Missing required parameter: target",
        success: false,
        suggestions: {
          guidance: [
            {
              examples: ["alice", "bob"],
              guidance: "Recipient address",
              parameter: "target",
              validationRules: ["Must be a valid address"],
            },
          ],
          missingParameters: ["target"],
        },
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "transfer 100", // Missing target
      });

      const parsed = JSON.parse(result);
      expect(parsed.result.details.suggestions).toBeDefined();
      expect(parsed.result.details.suggestions.missingParameters).toContain(
        "target",
      );
      expect(parsed.result.details.suggestions.guidance).toBeDefined();
    });

    it("should handle mixed structured and natural language requests", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: { to: "alice", transferred: "100" },
        handlerUsed: "Transfer",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "please transfer quantity=100 to alice", // Mixed format
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write");
    });
  });

  describe("Transaction Simulation Integration", () => {
    it("should perform dry-run validation when validateOnly is true", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const result = await command.execute({
        processId: mockProcessId,
        request: "transfer 100 to alice",
        validateOnly: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("validate");
      expect(parsed.result.details.validationStatus).toBe("completed");
      expect(parsed.result.details.simulation).toBeDefined();
    });

    it("should provide resource cost estimates", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const result = await command.execute({
        processId: mockProcessId,
        request: "transfer 100 to alice",
        validateOnly: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.result.details.simulation.resourceCost).toBeDefined();
      expect(
        parsed.result.details.simulation.resourceCost.gasEstimate,
      ).toBeGreaterThan(0);
    });

    it("should detect potential execution errors", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const result = await command.execute({
        processId: mockProcessId,
        request: "transfer 0 to alice", // Invalid amount should trigger error
        validateOnly: true,
      });

      const parsed = JSON.parse(result);
      expect(
        parsed.result.details.simulation.potentialErrors.length,
      ).toBeGreaterThan(0);
      expect(parsed.result.details.simulation.valid).toBe(false);
    });
  });

  describe("Risk Assessment Integration", () => {
    it("should assess operation risks and generate confirmation prompts", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: { transactionId: "tx_123" },
        handlerUsed: "Burn",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "burn 1000000 tokens", // High-risk: large amount + irreversible
      });

      const parsed = JSON.parse(result);
      expect(parsed.riskAssessment).toBeDefined();
      expect(parsed.riskAssessment.level).toBe("high");
      expect(parsed.riskAssessment.confirmationRequired).toBe(true);
      expect(parsed.confirmationPrompt).toBeDefined();
      expect(parsed.confirmationPrompt.title).toContain("High Risk Operation");
    });

    it("should provide transaction previews for write operations", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: { transactionId: "tx_456" },
        handlerUsed: "Transfer",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "transfer 100 to alice",
      });

      const parsed = JSON.parse(result);
      expect(parsed.transactionPreview).toBeDefined();
      expect(parsed.transactionPreview.estimatedOutcome).toBeDefined();
      expect(parsed.transactionPreview.potentialRisks).toBeDefined();
      expect(parsed.transactionPreview.reversible).toBeDefined();
    });

    it("should provide appropriate confirmation options based on risk level", async () => {
      const testCases = [
        {
          expectedOptions: ["proceed", "cancel"],
          expectedRecommended: "proceed",
          request: "get balance", // Low risk
        },
        {
          expectedOptions: ["proceed", "cancel", "simulate"],
          expectedRecommended: "cancel",
          request: "transfer 100 to alice", // Medium risk
        },
        {
          expectedOptions: ["simulate", "proceed", "cancel", "modify"],
          expectedRecommended: "simulate",
          request: "burn 100 tokens", // High risk
        },
      ];

      for (const testCase of testCases) {
        vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
          handlers: mockTokenHandlers,
          processMarkdown: "# Token Process",
          success: true,
        });

        vi.spyOn(
          processCommunicationService,
          "executeProcessRequest",
        ).mockResolvedValue({
          data: {},
          handlerUsed: "TestHandler",
          success: true,
        });

        const result = await command.execute({
          mode: "auto" as const,
          processId: mockProcessId,
          request: testCase.request,
        });

        const parsed = JSON.parse(result);

        if (parsed.confirmationPrompt) {
          const optionActions =
            parsed.confirmationPrompt.confirmationOptions.map(
              (o: any) => o.action,
            );
          const recommendedOption =
            parsed.confirmationPrompt.confirmationOptions.find(
              (o: any) => o.recommended,
            );

          testCase.expectedOptions.forEach((expectedOption) => {
            expect(optionActions).toContain(expectedOption);
          });

          expect(recommendedOption?.action).toBe(testCase.expectedRecommended);
        }
      }
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should gracefully handle service failures in detection pipeline", async () => {
      // Simulate OperationDetectionService failure
      vi.spyOn(
        OperationDetectionService,
        "detectOperationType",
      ).mockImplementation(() => {
        throw new Error("Detection service unavailable");
      });

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "Fallback",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "test request",
      });

      const parsed = JSON.parse(result);
      // Should still succeed with fallback behavior
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBeDefined();
    });

    it("should handle parameter suggestion service failures", async () => {
      vi.spyOn(
        ParameterSuggestionService,
        "classifyRequestType",
      ).mockImplementation(() => {
        throw new Error("Parameter service unavailable");
      });

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "TestHandler",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "test request",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true); // Should continue despite parameter service failure
    });

    it("should handle transaction simulation failures gracefully", async () => {
      vi.spyOn(
        TransactionSimulationService,
        "simulateTransaction",
      ).mockRejectedValue(new Error("Simulation service unavailable"));

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      const result = await command.execute({
        processId: mockProcessId,
        request: "test request",
        validateOnly: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.result.details.error).toContain(
        "Simulation service unavailable",
      );
    });

    it("should handle risk assessment service failures", async () => {
      vi.spyOn(RiskAssessmentService, "assessOperationRisk").mockImplementation(
        () => {
          throw new Error("Risk assessment unavailable");
        },
      );

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "TestHandler",
        success: true,
      });

      const result = await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "test request",
      });

      const parsed = JSON.parse(result);
      // Should still succeed but without risk assessment details
      expect(parsed.success).toBe(true);
      expect(parsed.riskAssessment).toBeUndefined();
    });
  });

  describe("Performance and Optimization", () => {
    it("should complete intelligent detection workflow within reasonable time", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "TestHandler",
        success: true,
      });

      const startTime = Date.now();

      await command.execute({
        mode: "auto" as const,
        processId: mockProcessId,
        request: "complex multi-layer detection request with many parameters",
      });

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should efficiently handle multiple concurrent detection requests", async () => {
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: mockTokenHandlers,
        processMarkdown: "# Token Process",
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockResolvedValue({
        data: {},
        handlerUsed: "TestHandler",
        success: true,
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        command.execute({
          mode: "auto" as const,
          processId: mockProcessId,
          request: `test request ${i}`,
        }),
      );

      const results = await Promise.all(requests);
      results.forEach((result) => {
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      });
    });
  });
});
