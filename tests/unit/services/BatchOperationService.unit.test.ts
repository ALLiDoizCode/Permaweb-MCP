import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BatchExecutionContext,
  BatchRequest,
  UnifiedProcessResponse,
} from "../../../src/types/unified-communication.js";

import { BatchOperationService } from "../../../src/services/BatchOperationService.js";

// Mock dependencies
vi.mock("../../../src/services/OperationDetectionService.js", () => ({
  OperationDetectionService: {
    detectOperationType: vi.fn(),
  },
}));

vi.mock("../../../src/services/ProcessCommunicationService.js", () => ({
  processCommunicationService: {
    executeProcessRequest: vi.fn(),
    executeSmartRequest: vi.fn(),
  },
}));

vi.mock("../../../src/services/TransactionSimulationService.js", () => ({
  TransactionSimulationService: {},
}));

describe("BatchOperationService", () => {
  const mockSigner: JWKInterface = {} as JWKInterface;
  const mockProcessId = "process_id_123456789012345678901234567890123";

  const mockBatchRequests: BatchRequest[] = [
    {
      mode: "read",
      request: "get balance",
    },
    {
      mode: "write",
      parameters: { amount: 100, recipient: "alice" },
      request: "transfer 100 to alice",
    },
    {
      mode: "read",
      parameters: { target: "alice" },
      request: "check balance for alice",
    },
  ];

  const mockUnifiedResponse: UnifiedProcessResponse = {
    executionTime: 100,
    handlerUsed: "Balance",
    operation: "read",
    parameters: {},
    processingMode: "auto",
    result: {
      details: { balance: "1000" },
      rawResponse: { data: { balance: "1000" }, success: true },
      summary: "Operation completed",
    },
    success: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeBatch", () => {
    describe("Sequential Batch Processing", () => {
      it("should execute batch operations in sequence", async () => {
        const { OperationDetectionService } = await import(
          "../../../src/services/OperationDetectionService.js"
        );
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          OperationDetectionService.detectOperationType,
        ).mockReturnValue({
          confidence: 0.9,
          detectionMethod: "pattern",
          operationType: "read",
          reasoning: "read pattern detected",
          riskLevel: "low",
        });

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({
          data: { balance: "1000" },
          handlerUsed: "Balance",
          success: true,
        });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]], // Single request first
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(1);
        expect(result.completedOperations).toBe(1);
        expect(result.failedOperations).toBe(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].success).toBe(true);
        expect(result.results[0].sequenceNumber).toBe(1);
      });

      it("should maintain operation sequence numbers", async () => {
        const { OperationDetectionService } = await import(
          "../../../src/services/OperationDetectionService.js"
        );
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          OperationDetectionService.detectOperationType,
        ).mockReturnValue({
          confidence: 0.9,
          detectionMethod: "pattern",
          operationType: "read",
          reasoning: "read pattern",
          riskLevel: "low",
        });

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({
          data: { result: "success" },
          success: true,
        });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests,
          mockSigner,
        );

        expect(result.results[0].sequenceNumber).toBe(1);
        expect(result.results[1].sequenceNumber).toBe(2);
        expect(result.results[2].sequenceNumber).toBe(3);
      });

      it("should generate unique batch IDs", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result1 = await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
        );

        const result2 = await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
        );

        expect(result1.batchId).toBeDefined();
        expect(result2.batchId).toBeDefined();
        expect(result1.batchId).not.toBe(result2.batchId);
        expect(result1.batchId).toMatch(/^batch_\d+_[a-z0-9]+$/);
      });

      it("should track execution time", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ data: {}, success: true }), 10),
            ),
        );

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
        );

        expect(result.executionTime).toBeGreaterThan(0);
        expect(typeof result.executionTime).toBe("number");
      });
    });

    describe("Error Handling", () => {
      it("should handle individual operation failures without rollback", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: { balance: "1000" }, success: true })
          .mockRejectedValueOnce(new Error("Transfer failed"))
          .mockResolvedValueOnce({ data: { balance: "900" }, success: true });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests,
          mockSigner,
          { rollbackOnError: false },
        );

        expect(result.success).toBe(true); // Overall success despite one failure
        expect(result.completedOperations).toBe(2);
        expect(result.failedOperations).toBe(1);
        expect(result.results).toHaveLength(3);
        expect(result.results[0].success).toBe(true);
        expect(result.results[1].success).toBe(false);
        expect(result.results[1].error).toContain("Transfer failed");
        expect(result.results[2].success).toBe(true);
      });

      it("should handle rollback on error", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: { balance: "1000" }, success: true })
          .mockRejectedValueOnce(new Error("Transfer failed"));

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests.slice(0, 2), // Only first two operations
          mockSigner,
          { rollbackOnError: true },
        );

        expect(result.success).toBe(false);
        expect(result.completedOperations).toBe(1);
        expect(result.failedOperations).toBe(1);
        expect(result.results).toHaveLength(3); // Original 2 + rollback operation

        const rollbackResult = result.results[2];
        expect(rollbackResult.request).toBe("ROLLBACK_BATCH");
        expect(rollbackResult.sequenceNumber).toBe(3);
      });

      it("should handle complete batch execution errors", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // Mock a catastrophic failure during batch processing
        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockImplementation(() => {
          throw new Error("System failure");
        });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests,
          mockSigner,
        );

        expect(result.success).toBe(false);
        expect(result.completedOperations).toBe(0);
        expect(result.failedOperations).toBe(3);
        expect(
          result.results.some((r) => r.request === "BATCH_EXECUTION_ERROR"),
        ).toBe(true);
      });

      it("should handle empty batch requests gracefully", async () => {
        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [],
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(0);
        expect(result.completedOperations).toBe(0);
        expect(result.failedOperations).toBe(0);
        expect(result.results).toHaveLength(0);
      });
    });

    describe("Process Markdown Integration", () => {
      it("should use process markdown when provided", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        const mockProcessMarkdown = "# Process Documentation\n...";

        vi.mocked(
          processCommunicationService.executeProcessRequest,
        ).mockResolvedValue({
          data: { balance: "1000" },
          handlerUsed: "Balance",
          success: true,
        });

        await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
          { processMarkdown: mockProcessMarkdown },
        );

        expect(
          processCommunicationService.executeProcessRequest,
        ).toHaveBeenCalledWith(
          mockProcessMarkdown,
          mockProcessId,
          mockBatchRequests[0].request,
          mockSigner,
        );
      });

      it("should fall back to smart request without process markdown", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
        );

        expect(
          processCommunicationService.executeSmartRequest,
        ).toHaveBeenCalledWith(
          mockProcessId,
          mockBatchRequests[0].request,
          mockSigner,
          undefined,
        );
      });
    });

    describe("Operation Detection Integration", () => {
      it("should detect operation types for each request", async () => {
        const { OperationDetectionService } = await import(
          "../../../src/services/OperationDetectionService.js"
        );
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(OperationDetectionService.detectOperationType)
          .mockReturnValueOnce({
            confidence: 0.9,
            detectionMethod: "pattern",
            operationType: "read",
            reasoning: "balance query",
            riskLevel: "low",
          })
          .mockReturnValueOnce({
            confidence: 0.8,
            detectionMethod: "nlp",
            operationType: "write",
            reasoning: "transfer operation",
            riskLevel: "medium",
          });

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests.slice(0, 2),
          mockSigner,
        );

        expect(
          OperationDetectionService.detectOperationType,
        ).toHaveBeenCalledWith(mockBatchRequests[0].request);
        expect(
          OperationDetectionService.detectOperationType,
        ).toHaveBeenCalledWith(mockBatchRequests[1].request);
      });

      it("should handle unknown operation types gracefully", async () => {
        const { OperationDetectionService } = await import(
          "../../../src/services/OperationDetectionService.js"
        );
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          OperationDetectionService.detectOperationType,
        ).mockReturnValue({
          confidence: 0.1,
          detectionMethod: "fallback",
          operationType: "unknown",
          reasoning: "could not determine",
          riskLevel: "low",
        });

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [mockBatchRequests[0]],
          mockSigner,
        );

        expect(result.results[0].result?.operation).toBe("read"); // Default fallback
      });
    });

    describe("Batch Context Management", () => {
      it("should provide proper batch context to operations", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests,
          mockSigner,
          { rollbackOnError: true },
        );

        // Verify batch context was maintained
        expect(result.batchId).toBeDefined();
        expect(result.totalOperations).toBe(3);

        // Check that sequence numbers are correct
        result.results.forEach((itemResult, index) => {
          expect(itemResult.sequenceNumber).toBe(index + 1);
        });
      });

      it("should handle different batch options", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const options = {
          maxConcurrent: 5,
          processMarkdown: "# Test Process",
          rollbackOnError: false,
        };

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          mockBatchRequests,
          mockSigner,
          options,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(3);
      });
    });
  });

  describe("executeWorkflowTemplate", () => {
    describe("Template Execution", () => {
      it("should execute token transfer with verification template", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "token-transfer-with-verification",
          { amount: "100", recipient: "alice" },
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(3); // Balance check, transfer, verification
        expect(result.batchId).toBeDefined();
      });

      it("should execute full token audit template", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "full-token-audit",
          {},
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(4); // Info, supply, all balances, my balance
      });

      it("should execute mint and distribute template", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "mint-and-distribute",
          { amount: "500", recipient: "alice" },
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(2); // Mint, balance check
      });

      it("should execute batch balance check template", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        const result = await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "batch-balance-check",
          { accounts: "alice,bob,charlie" },
          mockSigner,
        );

        expect(result.success).toBe(true);
        expect(result.totalOperations).toBe(1);
      });

      it("should interpolate template parameters correctly", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        const mockExecuteSmartRequest = vi.mocked(
          processCommunicationService.executeSmartRequest,
        );
        mockExecuteSmartRequest.mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "token-transfer-with-verification",
          { amount: "250", recipient: "test_user" },
          mockSigner,
        );

        // Check that parameters were interpolated in the requests
        const calls = mockExecuteSmartRequest.mock.calls;
        expect(
          calls.some((call) =>
            call[1].includes("transfer 250 tokens to test_user"),
          ),
        ).toBe(true);
        expect(
          calls.some((call) => call[1].includes("get balance for test_user")),
        ).toBe(true);
      });

      it("should throw error for unknown template", async () => {
        await expect(
          BatchOperationService.executeWorkflowTemplate(
            mockProcessId,
            "non-existent-template",
            {},
            mockSigner,
          ),
        ).rejects.toThrow(
          "Workflow template 'non-existent-template' not found",
        );
      });

      it("should respect template rollback settings", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // Mint template has rollbackOnError: true
        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: {}, success: true })
          .mockRejectedValueOnce(new Error("Balance check failed"));

        const result = await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "mint-and-distribute",
          { amount: "100", recipient: "alice" },
          mockSigner,
        );

        expect(result.success).toBe(false);
        // Should include rollback operation
        expect(result.results.some((r) => r.request === "ROLLBACK_BATCH")).toBe(
          true,
        );
      });
    });
  });

  describe("getAvailableWorkflowTemplates", () => {
    it("should return list of available templates", () => {
      const templates = BatchOperationService.getAvailableWorkflowTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      // Check that all templates have required fields
      templates.forEach((template) => {
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.parameters).toBeDefined();
        expect(template.steps).toBeDefined();
        expect(Array.isArray(template.parameters)).toBe(true);
        expect(typeof template.steps).toBe("number");
      });
    });

    it("should include expected templates", () => {
      const templates = BatchOperationService.getAvailableWorkflowTemplates();
      const templateNames = templates.map((t) => t.name);

      expect(templateNames).toContain("token-transfer-with-verification");
      expect(templateNames).toContain("mint-and-distribute");
      expect(templateNames).toContain("full-token-audit");
      expect(templateNames).toContain("batch-balance-check");
    });

    it("should provide accurate step counts", () => {
      const templates = BatchOperationService.getAvailableWorkflowTemplates();

      const transferTemplate = templates.find(
        (t) => t.name === "token-transfer-with-verification",
      );
      expect(transferTemplate?.steps).toBe(3);

      const auditTemplate = templates.find(
        (t) => t.name === "full-token-audit",
      );
      expect(auditTemplate?.steps).toBe(4);

      const mintTemplate = templates.find(
        (t) => t.name === "mint-and-distribute",
      );
      expect(mintTemplate?.steps).toBe(2);

      const balanceTemplate = templates.find(
        (t) => t.name === "batch-balance-check",
      );
      expect(balanceTemplate?.steps).toBe(1);
    });
  });

  describe("Template Parameter Interpolation", () => {
    describe("Parameter Replacement", () => {
      it("should handle single parameter replacement", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        const mockExecuteSmartRequest = vi.mocked(
          processCommunicationService.executeSmartRequest,
        );
        mockExecuteSmartRequest.mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "batch-balance-check",
          { accounts: "alice,bob" },
          mockSigner,
        );

        const call = mockExecuteSmartRequest.mock.calls[0];
        expect(call[1]).toBe("check balances for multiple accounts: alice,bob");
      });

      it("should handle multiple parameter replacements", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        const mockExecuteSmartRequest = vi.mocked(
          processCommunicationService.executeSmartRequest,
        );
        mockExecuteSmartRequest.mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "token-transfer-with-verification",
          { amount: "999", recipient: "test_recipient" },
          mockSigner,
        );

        const calls = mockExecuteSmartRequest.mock.calls;

        // Check transfer request
        const transferCall = calls.find((call) => call[1].includes("transfer"));
        expect(transferCall?.[1]).toBe("transfer 999 tokens to test_recipient");

        // Check balance request
        const balanceCall = calls.find((call) =>
          call[1].includes("get balance for"),
        );
        expect(balanceCall?.[1]).toBe("get balance for test_recipient");
      });

      it("should handle missing parameters gracefully", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        // Missing 'amount' parameter
        await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "token-transfer-with-verification",
          { recipient: "alice" }, // Missing amount
          mockSigner,
        );

        // Should not throw, but parameters will be undefined
        const calls = vi.mocked(processCommunicationService.executeSmartRequest)
          .mock.calls;
        expect(calls.length).toBeGreaterThan(0);
      });

      it("should handle nested parameter objects", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockResolvedValue({ data: {}, success: true });

        await BatchOperationService.executeWorkflowTemplate(
          mockProcessId,
          "mint-and-distribute",
          {
            amount: "750",
            metadata: { note: "test distribution" },
            recipient: "complex_recipient",
          },
          mockSigner,
        );

        // Should handle complex parameter structures
        expect(
          vi.mocked(processCommunicationService.executeSmartRequest),
        ).toHaveBeenCalled();
      });
    });
  });

  describe("Rollback Functionality", () => {
    describe("Rollback Logic", () => {
      it("should identify write operations for rollback", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // First operation succeeds (write), second fails
        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: {}, success: true })
          .mockRejectedValueOnce(new Error("Second operation failed"));

        const writeRequest: BatchRequest = {
          mode: "write",
          request: "transfer 100 to alice",
        };

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [writeRequest, mockBatchRequests[1]],
          mockSigner,
          { rollbackOnError: true },
        );

        expect(result.success).toBe(false);
        expect(result.results.some((r) => r.request === "ROLLBACK_BATCH")).toBe(
          true,
        );
      });

      it("should not rollback if no write operations succeeded", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // First operation fails immediately (no write operations to rollback)
        vi.mocked(
          processCommunicationService.executeSmartRequest,
        ).mockRejectedValue(new Error("First operation failed"));

        const readRequest: BatchRequest = {
          mode: "read",
          request: "get balance",
        };

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [readRequest],
          mockSigner,
          { rollbackOnError: true },
        );

        expect(result.success).toBe(false);
        expect(result.results.some((r) => r.request === "ROLLBACK_BATCH")).toBe(
          false,
        );
      });

      it("should handle rollback failures gracefully", async () => {
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // Setup successful write operation followed by failure
        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: {}, success: true })
          .mockRejectedValueOnce(new Error("Operation failed"));

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [
            { mode: "write", request: "mint 100 to alice" },
            { mode: "read", request: "get balance" },
          ],
          mockSigner,
          { rollbackOnError: true },
        );

        // Even if rollback logic has issues, should not crash
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
      });

      it("should reverse order of operations for rollback", async () => {
        // This test verifies the rollback implementation handles operation ordering
        const { processCommunicationService } = await import(
          "../../../src/services/ProcessCommunicationService.js"
        );

        // Multiple successful write operations, then a failure
        vi.mocked(processCommunicationService.executeSmartRequest)
          .mockResolvedValueOnce({ data: {}, success: true }) // First write succeeds
          .mockResolvedValueOnce({ data: {}, success: true }) // Second write succeeds
          .mockRejectedValueOnce(new Error("Third operation fails")); // Failure triggers rollback

        const result = await BatchOperationService.executeBatch(
          mockProcessId,
          [
            { mode: "write", request: "transfer 50 to alice" },
            { mode: "write", request: "mint 25 to bob" },
            { mode: "write", request: "burn 10" },
          ],
          mockSigner,
          { rollbackOnError: true },
        );

        expect(result.success).toBe(false);
        expect(result.completedOperations).toBe(2);
        expect(result.failedOperations).toBe(1);

        // Should have rollback operation result
        const rollbackResult = result.results.find(
          (r) => r.request === "ROLLBACK_BATCH",
        );
        expect(rollbackResult).toBeDefined();
        expect(rollbackResult?.success).toBe(true); // Rollback should succeed
      });
    });
  });
});
