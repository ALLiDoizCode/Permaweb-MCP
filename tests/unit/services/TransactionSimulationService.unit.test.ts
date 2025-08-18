import type { JWKInterface } from "arweave/node/lib/wallet.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";
import type { ExecutionRequest } from "../../../src/types/unified-communication.js";

import { TransactionSimulationService } from "../../../src/services/TransactionSimulationService.js";

// Mock ParameterSuggestionService
vi.mock("../../../src/services/ParameterSuggestionService.js", () => ({
  ParameterSuggestionService: {
    validateParametersAgainstADP: vi.fn(),
  },
}));

describe("TransactionSimulationService", () => {
  const mockSigner: JWKInterface = {} as JWKInterface;

  const mockExecutionRequest: ExecutionRequest = {
    handler: "Transfer",
    operationType: "write",
    parameters: {
      quantity: 100,
      target: "alice",
    },
    processId: "process_id_123456789012345678901234567890123",
  };

  const mockTransferHandler: HandlerMetadata = {
    action: "Transfer",
    description: "Transfer tokens",
    isWrite: true,
    parameters: [
      { name: "target", required: true, type: "string" },
      { name: "quantity", required: true, type: "number" },
    ],
  };

  const mockBurnHandler: HandlerMetadata = {
    action: "Burn",
    description: "Burn tokens permanently",
    isWrite: true,
    parameters: [{ name: "quantity", required: true, type: "number" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("simulateTransaction", () => {
    describe("Parameter Validation Integration", () => {
      it("should validate parameters using ADP metadata", async () => {
        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        const mockValidation = [
          {
            field: "quantity",
            message: "Quantity must be positive",
            severity: "warning" as const,
          },
        ];

        vi.mocked(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).mockReturnValue(mockValidation);

        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).toHaveBeenCalledWith(
          mockTransferHandler,
          mockExecutionRequest.parameters,
        );
        expect(result.potentialErrors).toContainEqual(mockValidation[0]);
      });

      it("should skip parameter validation when no handler metadata", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
        );

        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        expect(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).not.toHaveBeenCalled();
        expect(result.valid).toBeDefined();
      });
    });

    describe("Risk Assessment", () => {
      it("should assess basic write operation risk", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.riskAssessment.level).toBe("medium");
        expect(result.riskAssessment.factors).toContain(
          "Write operation modifies state",
        );
        expect(result.riskAssessment.factors).toContain(
          "Involves value transfer",
        );
      });

      it("should identify high-risk burn operations", async () => {
        const burnRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Burn",
          parameters: { quantity: 1000 },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          burnRequest,
          mockSigner,
          mockBurnHandler,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "High-risk action: Burn",
        );
        expect(result.riskAssessment.warnings).toContain(
          "This action cannot be undone",
        );
      });

      it("should assess large amount risks", async () => {
        const largeAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 2000000, // Large amount
            target: "alice",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          largeAmountRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "Large transaction amount",
        );
        expect(result.riskAssessment.warnings).toContain(
          "This involves a significant amount",
        );
      });

      it("should detect administrative parameter risks", async () => {
        const adminRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            adminAddress: "new_admin_123",
            permission: "owner",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          adminRequest,
          mockSigner,
        );

        expect(result.riskAssessment.factors).toContain(
          "Administrative action",
        );
        expect(result.riskAssessment.warnings).toContain(
          "This affects system permissions or ownership",
        );
      });

      it("should assess batch operation risks", async () => {
        const batchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_123",
            operationIndex: 2,
            totalOperations: 5,
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          batchRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.riskAssessment.factors).toContain(
          "Part of batch operation",
        );
        expect(result.riskAssessment.warnings).toContain(
          "Batch operations may have cascading effects",
        );
      });

      it("should require confirmation for high-risk operations", async () => {
        const highRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Delete",
          parameters: { target: "important_data" },
        };

        const deleteHandler: HandlerMetadata = {
          action: "Delete",
          description: "Delete data permanently",
          isWrite: true,
        };

        const result = await TransactionSimulationService.simulateTransaction(
          highRiskRequest,
          mockSigner,
          deleteHandler,
        );

        expect(result.riskAssessment.confirmationRequired).toBe(true);
      });

      it("should respect explicit confirmation requirements", async () => {
        const confirmationRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          requireConfirmation: true,
        };

        const result = await TransactionSimulationService.simulateTransaction(
          confirmationRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.riskAssessment.confirmationRequired).toBe(true);
      });
    });

    describe("Resource Requirements Estimation", () => {
      it("should estimate basic gas costs", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
        );

        expect(result.resourceRequirements.gasEstimate).toBeGreaterThan(100);
        expect(result.resourceRequirements.permissionRequirements).toContain(
          "Valid wallet signature",
        );
        expect(result.resourceRequirements.permissionRequirements).toContain(
          "Write access to process",
        );
      });

      it("should scale gas costs with parameter complexity", async () => {
        const complexRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            param1: "value1",
            param2: "value2",
            param3: "value3",
            param4: "value4",
            param5: "value5",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          complexRequest,
          mockSigner,
        );

        const simpleResult =
          await TransactionSimulationService.simulateTransaction(
            mockExecutionRequest,
            mockSigner,
          );

        expect(result.resourceRequirements.gasEstimate!).toBeGreaterThan(
          simpleResult.resourceRequirements.gasEstimate!,
        );
      });

      it("should estimate token requirements", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
        );

        expect(result.resourceRequirements.tokenRequirement).toBe("100");
      });

      it("should not require write permissions for read operations", async () => {
        const readRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "read",
        };

        const result = await TransactionSimulationService.simulateTransaction(
          readRequest,
          mockSigner,
        );

        expect(result.resourceRequirements.permissionRequirements).toContain(
          "Valid wallet signature",
        );
        expect(
          result.resourceRequirements.permissionRequirements,
        ).not.toContain("Write access to process");
      });
    });

    describe("Execution Error Checking", () => {
      it("should detect zero or negative amounts", async () => {
        const zeroAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 0,
            target: "alice",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          zeroAmountRequest,
          mockSigner,
          mockTransferHandler,
        );

        const amountError = result.potentialErrors.find(
          (error) => error.field === "amount" || error.field === "quantity",
        );
        expect(amountError).toBeDefined();
        expect(amountError!.severity).toBe("error");
        expect(amountError!.message).toContain("must be greater than zero");
        expect(result.valid).toBe(false);
      });

      it("should detect missing recipient for transfer operations", async () => {
        const missingRecipientRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 100,
            // Missing target/recipient
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          missingRecipientRequest,
          mockSigner,
          mockTransferHandler,
        );

        const recipientError = result.potentialErrors.find(
          (error) => error.field === "recipient",
        );
        expect(recipientError).toBeDefined();
        expect(recipientError!.message).toContain(
          "Transfer operations require a recipient",
        );
        expect(result.valid).toBe(false);
      });

      it("should validate process ID format", async () => {
        const invalidProcessRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          processId: "invalid_process_id",
        };

        const result = await TransactionSimulationService.simulateTransaction(
          invalidProcessRequest,
          mockSigner,
        );

        const processError = result.potentialErrors.find(
          (error) => error.field === "processId",
        );
        expect(processError).toBeDefined();
        expect(processError!.message).toContain("Invalid process ID format");
        expect(result.valid).toBe(false);
      });

      it("should handle valid requests without errors", async () => {
        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        vi.mocked(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).mockReturnValue([]);

        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          mockTransferHandler,
        );

        const errors = result.potentialErrors.filter(
          (error) => error.severity === "error",
        );
        expect(errors).toHaveLength(0);
        expect(result.valid).toBe(true);
      });
    });

    describe("Transaction Outcome Simulation", () => {
      it("should simulate balance query outcomes", async () => {
        const balanceHandler: HandlerMetadata = {
          action: "Balance",
          description: "Get balance",
          isWrite: false,
        };

        const balanceRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Balance",
          operationType: "read",
        };

        const result = await TransactionSimulationService.simulateTransaction(
          balanceRequest,
          mockSigner,
          balanceHandler,
        );

        expect(result.estimatedOutcome.expectedResponse).toEqual({
          fields: ["balance", "account", "ticker"],
          type: "balance_query",
        });
      });

      it("should simulate transfer outcomes", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.estimatedOutcome.expectedResponse).toEqual({
          fields: ["transactionId", "from", "to", "amount"],
          type: "transfer_confirmation",
        });
        expect(result.estimatedOutcome.stateChanges).toEqual({
          recipientBalance: "increased",
          senderBalance: "decreased",
        });
      });

      it("should simulate mint outcomes", async () => {
        const mintHandler: HandlerMetadata = {
          action: "Mint",
          description: "Mint new tokens",
          isWrite: true,
        };

        const mintRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Mint",
          parameters: { quantity: 100, recipient: "alice" },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          mintRequest,
          mockSigner,
          mintHandler,
        );

        expect(result.estimatedOutcome.expectedResponse).toEqual({
          fields: ["transactionId", "recipient", "amount"],
          type: "mint_confirmation",
        });
        expect(result.estimatedOutcome.stateChanges).toEqual({
          recipientBalance: "increased",
          totalSupply: "increased",
        });
      });

      it("should simulate burn outcomes", async () => {
        const burnRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Burn",
          parameters: { quantity: 50 },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          burnRequest,
          mockSigner,
          mockBurnHandler,
        );

        expect(result.estimatedOutcome.expectedResponse).toEqual({
          fields: ["transactionId", "amount"],
          type: "burn_confirmation",
        });
        expect(result.estimatedOutcome.stateChanges).toEqual({
          senderBalance: "decreased",
          totalSupply: "decreased",
        });
      });

      it("should simulate info query outcomes", async () => {
        const infoHandler: HandlerMetadata = {
          action: "Info",
          description: "Get token info",
          isWrite: false,
        };

        const infoRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Info",
          operationType: "read",
        };

        const result = await TransactionSimulationService.simulateTransaction(
          infoRequest,
          mockSigner,
          infoHandler,
        );

        expect(result.estimatedOutcome.expectedResponse).toEqual({
          fields: ["name", "ticker", "totalSupply", "owner"],
          type: "info_response",
        });
      });

      it("should include basic outcome information", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          mockTransferHandler,
        );

        expect(result.estimatedOutcome.handler).toBe("Transfer");
        expect(result.estimatedOutcome.operationType).toBe("write");
        expect(result.estimatedOutcome.processId).toBe(
          mockExecutionRequest.processId,
        );
        expect(result.estimatedOutcome.timestamp).toBeDefined();
        expect(result.estimatedOutcome.amountProcessed).toBe(100);
        expect(result.estimatedOutcome.targetAccount).toBe("alice");
      });
    });

    describe("Error Handling", () => {
      it("should handle simulation errors gracefully", async () => {
        // Force an error by providing invalid handler metadata
        const invalidHandler = {
          action: "Test",
          parameters: [{ name: null }], // This could cause processing errors
        } as any;

        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          mockSigner,
          invalidHandler,
        );

        // Should not throw, should return safe fallback
        expect(result.valid).toBe(false);
        expect(result.potentialErrors.length).toBeGreaterThan(0);
        // The risk level may be medium or high depending on other factors
        expect(["medium", "high"]).toContain(result.riskAssessment.level);
        expect(result.resourceRequirements.gasEstimate).toBeDefined();
      });

      it("should handle missing signer gracefully", async () => {
        const result = await TransactionSimulationService.simulateTransaction(
          mockExecutionRequest,
          null as any,
        );

        expect(result).toBeDefined();
        expect(result.valid).toBeDefined();
      });

      it("should provide meaningful error messages", async () => {
        const invalidRequest: ExecutionRequest = {
          handler: "Transfer",
          operationType: "write",
          parameters: {},
          processId: "invalid",
        };

        const result = await TransactionSimulationService.simulateTransaction(
          invalidRequest,
          mockSigner,
          mockTransferHandler,
        );

        const errors = result.potentialErrors.filter(
          (error) => error.severity === "error",
        );

        for (const error of errors) {
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
          expect(error.suggestion).toBeDefined();
          expect(error.suggestion!.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("performDryRun", () => {
    describe("Dry Run Results", () => {
      it("should provide dry run summary", async () => {
        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        vi.mocked(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).mockReturnValue([
          {
            field: "quantity",
            message: "Large amount detected",
            severity: "warning",
            suggestion: "Consider smaller amounts",
          },
        ]);

        const result = await TransactionSimulationService.performDryRun(
          mockExecutionRequest,
          mockTransferHandler,
        );

        expect(result.canProceed).toBeDefined();
        expect(result.estimatedGas).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.warnings).toBeDefined();
        expect(result.warnings).toContain("Large amount detected");
      });

      it("should provide optimization recommendations", async () => {
        const complexRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            // Many parameters to trigger high gas estimate (need >20 to exceed 500 threshold)
            param1: "value1",
            param2: "value2",
            param3: "value3",
            param4: "value4",
            param5: "value5",
            param6: "value6",
            param7: "value7",
            param8: "value8",
            param9: "value9",
            param10: "value10",
            param11: "value11",
            param12: "value12",
            param13: "value13",
            param14: "value14",
            param15: "value15",
            param16: "value16",
            param17: "value17",
            param18: "value18",
            param19: "value19",
            param20: "value20",
            param21: "value21",
            param22: "value22",
          },
        };

        const result = await TransactionSimulationService.performDryRun(
          complexRequest,
          mockTransferHandler,
        );

        expect(
          result.recommendations.some((rec) =>
            rec.includes("batching multiple operations"),
          ),
        ).toBe(true);
        expect(
          result.recommendations.some((rec) =>
            rec.includes("simplifying the parameter set"),
          ),
        ).toBe(true);
      });

      it("should recommend simulation for high-risk operations", async () => {
        const highRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 2000000, // Large amount = high risk
            target: "alice",
          },
        };

        const result = await TransactionSimulationService.performDryRun(
          highRiskRequest,
          mockTransferHandler,
        );

        expect(
          result.recommendations.some((rec) =>
            rec.includes("simulation mode first"),
          ),
        ).toBe(true);
      });

      it("should recommend chunking for large batch operations", async () => {
        const largeBatchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_123",
            operationIndex: 3,
            totalOperations: 10, // Large batch
          },
        };

        const result =
          await TransactionSimulationService.performDryRun(largeBatchRequest);

        expect(
          result.recommendations.some((rec) =>
            rec.includes("chunking into smaller batches"),
          ),
        ).toBe(true);
      });

      it("should indicate when operations cannot proceed", async () => {
        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        vi.mocked(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).mockReturnValue([
          {
            field: "quantity",
            message: "Invalid quantity",
            severity: "error",
            suggestion: "Fix the quantity parameter",
          },
        ]);

        const result = await TransactionSimulationService.performDryRun(
          mockExecutionRequest,
          mockTransferHandler,
        );

        expect(result.canProceed).toBe(false);
        expect(result.recommendations).toContain("Fix the quantity parameter");
      });

      it("should provide gas estimates", async () => {
        const result = await TransactionSimulationService.performDryRun(
          mockExecutionRequest,
          mockTransferHandler,
        );

        expect(result.estimatedGas).toBeGreaterThan(0);
        expect(typeof result.estimatedGas).toBe("number");
      });
    });

    describe("Error Handling in Dry Run", () => {
      it("should handle dry run errors gracefully", async () => {
        // Create a request that would cause simulation to fail
        const invalidRequest: ExecutionRequest = {
          handler: "Invalid",
          operationType: "write",
          parameters: {},
          processId: "", // Empty process ID
        };

        const result =
          await TransactionSimulationService.performDryRun(invalidRequest);

        expect(result.canProceed).toBe(false);
        expect(result.recommendations.length).toBeGreaterThan(0);
      });

      it("should separate warnings from errors", async () => {
        const { ParameterSuggestionService } = await import(
          "../../../src/services/ParameterSuggestionService.js"
        );
        vi.mocked(
          ParameterSuggestionService.validateParametersAgainstADP,
        ).mockReturnValue([
          {
            field: "param1",
            message: "Warning message",
            severity: "warning",
          },
          {
            field: "param2",
            message: "Error message",
            severity: "error",
            suggestion: "Fix this error",
          },
        ]);

        const result = await TransactionSimulationService.performDryRun(
          mockExecutionRequest,
          mockTransferHandler,
        );

        expect(result.warnings).toContain("Warning message");
        expect(result.warnings).not.toContain("Error message");
        expect(result.recommendations).toContain("Fix this error");
        expect(result.canProceed).toBe(false);
      });
    });
  });

  describe("Parameter Risk Assessment", () => {
    describe("Amount-Based Risks", () => {
      it("should detect large amounts in different fields", async () => {
        const amountFields = ["amount", "quantity", "value"];

        for (const field of amountFields) {
          const largeAmountRequest: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: {
              [field]: 5000000, // Very large amount
            },
          };

          const result = await TransactionSimulationService.simulateTransaction(
            largeAmountRequest,
            mockSigner,
          );

          expect(result.riskAssessment.level).toBe("high");
          expect(result.riskAssessment.factors).toContain(
            "Large transaction amount",
          );
        }
      });

      it("should detect moderate amounts", async () => {
        const moderateAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 50000, // Moderate amount
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          moderateAmountRequest,
          mockSigner,
        );

        expect(result.riskAssessment.factors).toContain(
          "Moderate transaction amount",
        );
      });

      it("should handle string amounts", async () => {
        const stringAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: "2000000", // Large string amount
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          stringAmountRequest,
          mockSigner,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "Large transaction amount",
        );
      });

      it("should ignore non-numeric strings", async () => {
        const invalidStringRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: "not-a-number",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          invalidStringRequest,
          mockSigner,
        );

        expect(result.riskAssessment.factors).not.toContain(
          "Large transaction amount",
        );
      });
    });

    describe("Action-Based Risks", () => {
      it("should detect permanent actions in parameter values", async () => {
        const permanentActionRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            action: "delete",
            target: "important_data",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          permanentActionRequest,
          mockSigner,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "Permanent action detected",
        );
        expect(result.riskAssessment.warnings).toContain(
          "This action cannot be reversed",
        );
      });

      it("should detect permanent actions in parameter keys", async () => {
        const permanentKeyRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            deleteTarget: "some_value",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          permanentKeyRequest,
          mockSigner,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "Permanent action detected",
        );
      });

      it("should detect all permanent action indicators", async () => {
        const permanentActions = ["delete", "burn", "destroy", "remove"];

        for (const action of permanentActions) {
          const actionRequest: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: {
              operation: action,
            },
          };

          const result = await TransactionSimulationService.simulateTransaction(
            actionRequest,
            mockSigner,
          );

          expect(result.riskAssessment.level).toBe("high");
          expect(result.riskAssessment.factors).toContain(
            "Permanent action detected",
          );
        }
      });
    });

    describe("Administrative Risks", () => {
      it("should detect administrative parameter keys", async () => {
        const adminKeys = ["admin", "owner", "permission", "access"];

        for (const key of adminKeys) {
          const adminRequest: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: {
              [key]: "some_value",
            },
          };

          const result = await TransactionSimulationService.simulateTransaction(
            adminRequest,
            mockSigner,
          );

          expect(result.riskAssessment.factors).toContain(
            "Administrative action",
          );
          expect(result.riskAssessment.warnings).toContain(
            "This affects system permissions or ownership",
          );
        }
      });

      it("should handle case-insensitive administrative detection", async () => {
        const adminRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            ADMIN_ADDRESS: "new_admin",
            ownerShip: "transfer",
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          adminRequest,
          mockSigner,
        );

        expect(result.riskAssessment.factors).toContain(
          "Administrative action",
        );
      });
    });

    describe("Combined Risk Assessment", () => {
      it("should combine multiple risk factors appropriately", async () => {
        const multiRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            action: "burn", // Permanent action (high risk)
            adminPermission: "owner", // Admin action (medium -> high remains high)
            quantity: 5000000, // Large amount (high risk)
          },
        };

        const result = await TransactionSimulationService.simulateTransaction(
          multiRiskRequest,
          mockSigner,
        );

        expect(result.riskAssessment.level).toBe("high");
        expect(result.riskAssessment.factors).toContain(
          "Large transaction amount",
        );
        expect(result.riskAssessment.factors).toContain(
          "Administrative action",
        );
        expect(result.riskAssessment.factors).toContain(
          "Permanent action detected",
        );
        expect(result.riskAssessment.warnings.length).toBeGreaterThan(1);
      });

      it("should escalate risk levels correctly", async () => {
        // Start with low risk
        const lowRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "read",
          parameters: { query: "balance" },
        };

        const lowResult =
          await TransactionSimulationService.simulateTransaction(
            lowRiskRequest,
            mockSigner,
          );
        expect(lowResult.riskAssessment.level).toBe("low");

        // Add medium risk factor
        const mediumRiskRequest: ExecutionRequest = {
          ...lowRiskRequest,
          parameters: { ...lowRiskRequest.parameters, adminCheck: "true" },
        };

        const mediumResult =
          await TransactionSimulationService.simulateTransaction(
            mediumRiskRequest,
            mockSigner,
          );
        expect(mediumResult.riskAssessment.level).toBe("medium");

        // Add high risk factor
        const highRiskRequest: ExecutionRequest = {
          ...mediumRiskRequest,
          parameters: { ...mediumRiskRequest.parameters, quantity: 10000000 },
        };

        const highResult =
          await TransactionSimulationService.simulateTransaction(
            highRiskRequest,
            mockSigner,
          );
        expect(highResult.riskAssessment.level).toBe("high");
      });
    });
  });
});
