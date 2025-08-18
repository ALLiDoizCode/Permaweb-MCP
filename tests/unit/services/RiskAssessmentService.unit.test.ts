import { describe, expect, it } from "vitest";

import type { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";
import type {
  ExecutionRequest,
  OperationDetectionResult,
  RiskAssessment,
} from "../../../src/types/unified-communication.js";

import {
  type ConfirmationOption,
  type ConfirmationPrompt,
  RiskAssessmentService,
  type TransactionPreview,
} from "../../../src/services/RiskAssessmentService.js";

describe("RiskAssessmentService", () => {
  const mockProcessId = "process_id_123456789012345678901234567890123";

  const mockExecutionRequest: ExecutionRequest = {
    handler: "Transfer",
    operationType: "write",
    parameters: {
      amount: 100,
      target: "alice",
    },
    processId: mockProcessId,
  };

  const mockDetectionResult: OperationDetectionResult = {
    confidence: 0.9,
    detectionMethod: "adp",
    operationType: "write",
    reasoning: "ADP metadata indicates write operation",
    riskLevel: "medium",
  };

  const mockTransferHandler: HandlerMetadata = {
    action: "Transfer",
    description: "Transfer tokens to another address",
    isWrite: true,
    parameters: [
      { name: "target", required: true, type: "string" },
      { name: "amount", required: true, type: "number" },
    ],
  };

  const mockBurnHandler: HandlerMetadata = {
    action: "Burn",
    description: "Burn tokens permanently",
    isWrite: true,
    parameters: [{ name: "amount", required: true, type: "number" }],
  };

  describe("assessOperationRisk", () => {
    describe("Risk Level Assessment", () => {
      it("should assess low-risk operations", () => {
        const lowRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Balance",
          operationType: "read",
          parameters: { target: "alice" },
        };

        const lowRiskDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          operationType: "read",
          riskLevel: "low",
        };

        const balanceHandler: HandlerMetadata = {
          action: "Balance",
          description: "Get token balance",
          isWrite: false,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          lowRiskRequest,
          lowRiskDetection,
          balanceHandler,
        );

        expect(result.riskLevel).toBe("low");
        expect(result.required).toBe(false);
        expect(result.title).toBe("✓ Confirm: Balance");
        expect(
          result.confirmationOptions.find((o) => o.recommended)?.action,
        ).toBe("proceed");
      });

      it("should assess medium-risk operations", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("medium");
        expect(result.required).toBe(false);
        expect(result.title).toBe("⚡ Confirm Operation: Transfer");
        expect(
          result.confirmationOptions.find((o) => o.recommended)?.action,
        ).toBe("cancel");
      });

      it("should assess high-risk burn operations", () => {
        const burnRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Burn",
          parameters: { amount: 1000 },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          burnRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.required).toBe(true);
        expect(result.title).toBe("⚠️ High Risk Operation: Burn");
        expect(
          result.confirmationOptions.find((o) => o.recommended)?.action,
        ).toBe("simulate");
        expect(result.warnings).toContain("This action cannot be undone");
      });

      it("should assess high-risk large amount operations", () => {
        const largeAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: 5000000, // Very large amount
            target: "alice",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          largeAmountRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.required).toBe(true);
        expect(result.warnings).toContain(
          "This involves a significant amount of tokens",
        );
      });

      it("should assess administrative operations", () => {
        const adminHandler: HandlerMetadata = {
          action: "Set_Admin",
          description: "Set new admin",
          isWrite: true,
        };

        const adminRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Set_Admin",
          parameters: { admin: "new_admin_address" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          adminRequest,
          mockDetectionResult,
          adminHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.required).toBe(true);
        expect(result.warnings).toContain(
          "This affects system permissions or ownership",
        );
      });
    });

    describe("Confirmation Requirements", () => {
      it("should require confirmation for high-risk operations", () => {
        const deleteHandler: HandlerMetadata = {
          action: "Delete",
          description: "Delete data permanently",
          isWrite: true,
        };

        const deleteRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Delete",
          parameters: { target: "important_data" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          deleteRequest,
          mockDetectionResult,
          deleteHandler,
        );

        expect(result.required).toBe(true);
        expect(result.riskLevel).toBe("high");
      });

      it("should require confirmation when explicitly requested", () => {
        const explicitConfirmRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          requireConfirmation: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          explicitConfirmRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.required).toBe(true);
      });

      it("should require confirmation for high-value transactions", () => {
        const highValueRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: 200000, // High value threshold
            target: "alice",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          highValueRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.required).toBe(true);
      });

      it("should not require confirmation for low-risk read operations", () => {
        const readRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Info",
          operationType: "read",
          parameters: {},
        };

        const readDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          operationType: "read",
          riskLevel: "low",
        };

        const infoHandler: HandlerMetadata = {
          action: "Info",
          description: "Get token info",
          isWrite: false,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          readRequest,
          readDetection,
          infoHandler,
        );

        expect(result.required).toBe(false);
        expect(result.riskLevel).toBe("low");
      });
    });

    describe("Parameter-Based Risk Assessment", () => {
      it("should detect large amounts in different fields", () => {
        const testCases = [
          { amount: 2000000 },
          { quantity: 2000000 },
          { value: 2000000 },
        ];

        for (const params of testCases) {
          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: params,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            mockTransferHandler,
          );

          expect(result.riskLevel).toBe("high");
          expect(result.warnings).toContain(
            "This involves a significant amount of tokens",
          );
        }
      });

      it("should detect moderate amounts", () => {
        const moderateAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: 50000, // Moderate amount
            target: "alice",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          moderateAmountRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("medium");
        expect(result.warnings).toContain(
          "Please verify the amount is correct",
        );
      });

      it("should detect administrative parameters", () => {
        const adminParams = ["owner", "admin", "permission", "access", "role"];

        for (const param of adminParams) {
          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: { [param]: "test_value" },
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            mockTransferHandler,
          );

          expect(result.warnings).toContain(
            "This affects system permissions or roles",
          );
        }
      });

      it("should detect permanent action indicators", () => {
        const permanentParams = ["permanent", "irreversible", "final"];

        for (const param of permanentParams) {
          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: { [param]: true },
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            mockTransferHandler,
          );

          expect(result.riskLevel).toBe("high");
          expect(result.warnings).toContain("This action cannot be reversed");
        }
      });

      it("should handle string boolean values", () => {
        const request: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: { permanent: "true" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          request,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.warnings).toContain("This action cannot be reversed");
      });

      it("should handle string amounts", () => {
        const stringAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: "3000000", // Large string amount
            target: "alice",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          stringAmountRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.warnings).toContain(
          "This involves a significant amount of tokens",
        );
      });

      it("should ignore invalid numeric strings", () => {
        const invalidAmountRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: "not-a-number",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          invalidAmountRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        // Should not detect large amount risk
        expect(result.warnings).not.toContain(
          "This involves a significant amount of tokens",
        );
      });
    });

    describe("Handler-Based Risk Factors", () => {
      it("should identify critical irreversible operations", () => {
        const criticalOperations = [
          "delete",
          "burn",
          "destroy",
          "remove",
          "revoke",
        ];

        for (const operation of criticalOperations) {
          const handler: HandlerMetadata = {
            action: operation,
            description: `${operation} operation`,
            isWrite: true,
          };

          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            handler: operation,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            handler,
          );

          expect(result.riskLevel).toBe("high");
          expect(result.warnings).toContain("This action cannot be undone");
        }
      });

      it("should identify administrative operations", () => {
        const adminOperations = [
          "transfer_ownership",
          "set_admin",
          "grant_permission",
          "revoke_permission",
        ];

        for (const operation of adminOperations) {
          const handler: HandlerMetadata = {
            action: operation,
            description: `${operation} operation`,
            isWrite: true,
          };

          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            handler: operation,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            handler,
          );

          expect(result.riskLevel).toBe("high");
          expect(result.warnings).toContain(
            "This affects system permissions or ownership",
          );
        }
      });

      it("should identify value transfer operations", () => {
        const valueOperations = ["transfer", "send", "withdraw", "mint"];

        for (const operation of valueOperations) {
          const handler: HandlerMetadata = {
            action: operation,
            description: `${operation} operation`,
            isWrite: true,
          };

          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            handler: operation,
            parameters: { amount: 100 },
          };

          const lowRiskDetection: OperationDetectionResult = {
            ...mockDetectionResult,
            riskLevel: "low",
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            lowRiskDetection,
            handler,
          );

          expect(result.riskLevel).toBe("medium"); // Should escalate from low to medium
        }
      });

      it("should handle case-insensitive operation matching", () => {
        const handler: HandlerMetadata = {
          action: "BURN_TOKENS",
          description: "Burn tokens permanently",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          handler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.warnings).toContain("This action cannot be undone");
      });
    });

    describe("Batch Operation Risk Assessment", () => {
      it("should assess additional risk for batch operations", () => {
        const batchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_123",
            operationIndex: 2,
            totalOperations: 5,
          },
        };

        const lowRiskDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          riskLevel: "low",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          batchRequest,
          lowRiskDetection,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("medium"); // Should escalate from low
        expect(result.warnings).toContain(
          "Failure may affect subsequent operations in batch",
        );
      });

      it("should not escalate already high-risk batch operations", () => {
        const batchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_456",
            operationIndex: 1,
            totalOperations: 3,
          },
          handler: "Burn",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          batchRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.riskLevel).toBe("high"); // Should remain high
        expect(result.warnings).toContain(
          "Failure may affect subsequent operations in batch",
        );
      });
    });

    describe("Risk Level Escalation", () => {
      it("should escalate from low to medium for write operations", () => {
        const lowRiskDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          riskLevel: "low",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest, // write operation
          lowRiskDetection,
          mockTransferHandler,
        );

        expect(result.riskLevel).toBe("medium");
      });

      it("should combine multiple risk factors correctly", () => {
        const multiRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            // Batch operation (medium -> high remains high)
            batchId: "batch_789",
            operationIndex: 1,
            totalOperations: 2,
          },
          handler: "Burn",
          parameters: {
            amount: 5000000, // Large amount (high)
            permanent: true, // Permanent action (high)
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          multiRiskRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.riskLevel).toBe("high");
        expect(result.warnings.length).toBeGreaterThan(2); // Multiple warnings
        expect(result.warnings).toContain("This action cannot be undone");
        expect(result.warnings).toContain(
          "This involves a significant amount of tokens",
        );
        expect(result.warnings).toContain("This action cannot be reversed");
      });

      it("should not escalate high-risk operations", () => {
        const alreadyHighRisk: OperationDetectionResult = {
          ...mockDetectionResult,
          riskLevel: "high",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          alreadyHighRisk,
          mockBurnHandler,
        );

        expect(result.riskLevel).toBe("high"); // Should remain high
      });
    });
  });

  describe("Confirmation Options", () => {
    describe("Low-Risk Confirmation Options", () => {
      it("should provide proceed-recommended options for low risk", () => {
        const lowRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "read",
        };

        const lowRiskDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          operationType: "read",
          riskLevel: "low",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          lowRiskRequest,
          lowRiskDetection,
        );

        const recommendedOption = result.confirmationOptions.find(
          (o) => o.recommended,
        );
        expect(recommendedOption?.action).toBe("proceed");
        expect(recommendedOption?.label).toBe("Proceed with transaction");

        expect(result.confirmationOptions.map((o) => o.action)).toEqual([
          "proceed",
          "cancel",
        ]);
      });
    });

    describe("Medium-Risk Confirmation Options", () => {
      it("should provide cancel-recommended options for medium risk", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        const recommendedOption = result.confirmationOptions.find(
          (o) => o.recommended,
        );
        expect(recommendedOption?.action).toBe("cancel");

        const actions = result.confirmationOptions.map((o) => o.action);
        expect(actions).toContain("proceed");
        expect(actions).toContain("cancel");
        expect(actions).toContain("simulate");
      });
    });

    describe("High-Risk Confirmation Options", () => {
      it("should provide simulate-recommended options for high risk", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        const recommendedOption = result.confirmationOptions.find(
          (o) => o.recommended,
        );
        expect(recommendedOption?.action).toBe("simulate");
        expect(recommendedOption?.label).toBe("Simulate first (recommended)");

        const actions = result.confirmationOptions.map((o) => o.action);
        expect(actions).toContain("simulate");
        expect(actions).toContain("proceed");
        expect(actions).toContain("cancel");
        expect(actions).toContain("modify");
      });

      it("should include modify option for high-risk operations", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        const modifyOption = result.confirmationOptions.find(
          (o) => o.action === "modify",
        );
        expect(modifyOption).toBeDefined();
        expect(modifyOption?.label).toBe("Modify parameters");
        expect(modifyOption?.recommended).toBe(false);
      });
    });

    describe("Confirmation Option Properties", () => {
      it("should provide proper option IDs", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        result.confirmationOptions.forEach((option) => {
          expect(option.id).toBeDefined();
          expect(option.id.length).toBeGreaterThan(0);
          expect(option.id).toBe(option.action); // ID should match action
        });
      });

      it("should provide descriptive labels", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        result.confirmationOptions.forEach((option) => {
          expect(option.label).toBeDefined();
          expect(option.label.length).toBeGreaterThan(0);
          expect(option.label).not.toBe(option.action); // Label should be descriptive
        });
      });

      it("should have exactly one recommended option", () => {
        const testCases = [
          { riskLevel: "low" as const },
          { riskLevel: "medium" as const },
          { riskLevel: "high" as const },
        ];

        for (const testCase of testCases) {
          const detection: OperationDetectionResult = {
            ...mockDetectionResult,
            riskLevel: testCase.riskLevel,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            mockExecutionRequest,
            detection,
            mockTransferHandler,
          );

          const recommendedOptions = result.confirmationOptions.filter(
            (o) => o.recommended,
          );
          expect(recommendedOptions).toHaveLength(1);
        }
      });
    });
  });

  describe("Transaction Preview", () => {
    describe("Handler-Specific Previews", () => {
      it("should generate transfer operation preview", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.transactionPreview.operation).toBe("WRITE operation");
        expect(result.transactionPreview.handler).toBe("Transfer");
        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Tokens will be transferred from your account",
        );
        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Recipient balance will increase",
        );
        expect(result.transactionPreview.potentialRisks).toContain(
          "Insufficient balance",
        );
        expect(result.transactionPreview.reversible).toBe(true);
      });

      it("should generate mint operation preview", () => {
        const mintHandler: HandlerMetadata = {
          action: "Mint",
          description: "Mint new tokens",
          isWrite: true,
        };

        const mintRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Mint",
          parameters: { amount: 500, recipient: "alice" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mintRequest,
          mockDetectionResult,
          mintHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "New tokens will be created",
        );
        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Total supply will increase",
        );
        expect(result.transactionPreview.potentialRisks).toContain(
          "Minting limits may be exceeded",
        );
        expect(result.transactionPreview.reversible).toBe(true);
      });

      it("should generate burn operation preview", () => {
        const burnRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Burn",
          parameters: { amount: 100 },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          burnRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Tokens will be permanently destroyed",
        );
        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Total supply will decrease",
        );
        expect(result.transactionPreview.potentialRisks).toContain(
          "Tokens cannot be recovered after burning",
        );
        expect(result.transactionPreview.reversible).toBe(false);
      });

      it("should generate delete operation preview", () => {
        const deleteHandler: HandlerMetadata = {
          action: "Delete",
          description: "Delete data permanently",
          isWrite: true,
        };

        const deleteRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          handler: "Delete",
          parameters: { target: "data_id_123" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          deleteRequest,
          mockDetectionResult,
          deleteHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Data will be permanently deleted",
        );
        expect(result.transactionPreview.potentialRisks).toContain(
          "Data cannot be recovered after deletion",
        );
        expect(result.transactionPreview.reversible).toBe(false);
      });
    });

    describe("Parameter-Specific Preview Elements", () => {
      it("should include amount information", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Amount processed: 100",
        );
        expect(result.transactionPreview.parameters.amount).toBe(100);
      });

      it("should include target information", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Target account: alice",
        );
        expect(result.transactionPreview.parameters.target).toBe("alice");
      });

      it("should handle recipient parameter", () => {
        const requestWithRecipient: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            amount: 250,
            recipient: "bob",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          requestWithRecipient,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Target account: bob",
        );
      });

      it("should handle quantity parameter", () => {
        const requestWithQuantity: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: {
            quantity: 750,
            target: "charlie",
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          requestWithQuantity,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.transactionPreview.estimatedOutcome).toContain(
          "Amount processed: 750",
        );
      });
    });

    describe("Resource Cost Estimation", () => {
      it("should estimate basic gas costs", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(
          result.transactionPreview.resourceCost.gasEstimate,
        ).toBeGreaterThan(100);
        expect(typeof result.transactionPreview.resourceCost.gasEstimate).toBe(
          "number",
        );
      });

      it("should scale gas costs with parameters", () => {
        const simpleRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: { amount: 100 },
        };

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

        const simpleResult = RiskAssessmentService.assessOperationRisk(
          simpleRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        const complexResult = RiskAssessmentService.assessOperationRisk(
          complexRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(
          complexResult.transactionPreview.resourceCost.gasEstimate,
        ).toBeGreaterThan(
          simpleResult.transactionPreview.resourceCost.gasEstimate,
        );
      });

      it("should add gas costs for write operations", () => {
        const readRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "read",
        };

        const writeRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "write",
        };

        const readResult = RiskAssessmentService.assessOperationRisk(
          readRequest,
          mockDetectionResult,
        );

        const writeResult = RiskAssessmentService.assessOperationRisk(
          writeRequest,
          mockDetectionResult,
        );

        expect(
          writeResult.transactionPreview.resourceCost.gasEstimate,
        ).toBeGreaterThan(
          readResult.transactionPreview.resourceCost.gasEstimate,
        );
      });

      it("should add gas costs for batch operations", () => {
        const singleRequest = mockExecutionRequest;

        const batchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_123",
            operationIndex: 1,
            totalOperations: 3,
          },
        };

        const singleResult = RiskAssessmentService.assessOperationRisk(
          singleRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        const batchResult = RiskAssessmentService.assessOperationRisk(
          batchRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(
          batchResult.transactionPreview.resourceCost.gasEstimate,
        ).toBeGreaterThan(
          singleResult.transactionPreview.resourceCost.gasEstimate,
        );
      });

      it("should extract token requirements", () => {
        const testCases = [
          { amount: "1000" },
          { quantity: "500" },
          { value: "250" },
        ];

        for (const params of testCases) {
          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            parameters: params,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            mockTransferHandler,
          );

          expect(result.transactionPreview.resourceCost.tokenRequirement).toBe(
            Object.values(params)[0],
          );
        }
      });

      it("should handle requests without token requirements", () => {
        const requestWithoutAmount: ExecutionRequest = {
          ...mockExecutionRequest,
          parameters: { target: "alice" },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          requestWithoutAmount,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(
          result.transactionPreview.resourceCost.tokenRequirement,
        ).toBeUndefined();
      });
    });

    describe("Reversibility Assessment", () => {
      it("should identify irreversible operations", () => {
        const irreversibleActions = [
          "delete",
          "burn",
          "destroy",
          "remove",
          "revoke",
        ];

        for (const action of irreversibleActions) {
          const handler: HandlerMetadata = {
            action: action,
            description: `${action} operation`,
            isWrite: true,
          };

          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            handler: action,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            handler,
          );

          expect(result.transactionPreview.reversible).toBe(false);
        }
      });

      it("should identify reversible operations", () => {
        const reversibleActions = ["transfer", "mint", "send", "create"];

        for (const action of reversibleActions) {
          const handler: HandlerMetadata = {
            action: action,
            description: `${action} operation`,
            isWrite: true,
          };

          const request: ExecutionRequest = {
            ...mockExecutionRequest,
            handler: action,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            request,
            mockDetectionResult,
            handler,
          );

          expect(result.transactionPreview.reversible).toBe(true);
        }
      });

      it("should handle case-insensitive reversibility detection", () => {
        const handler: HandlerMetadata = {
          action: "BURN_TOKENS",
          description: "Burn tokens permanently",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          handler,
        );

        expect(result.transactionPreview.reversible).toBe(false);
      });
    });

    describe("Preview Completeness", () => {
      it("should include all required preview fields", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        const preview = result.transactionPreview;
        expect(preview.handler).toBeDefined();
        expect(preview.operation).toBeDefined();
        expect(preview.processId).toBeDefined();
        expect(preview.parameters).toBeDefined();
        expect(preview.estimatedOutcome).toBeDefined();
        expect(preview.potentialRisks).toBeDefined();
        expect(preview.resourceCost).toBeDefined();
        expect(preview.reversible).toBeDefined();
      });

      it("should provide meaningful preview content", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        const preview = result.transactionPreview;
        expect(preview.estimatedOutcome.length).toBeGreaterThan(0);
        expect(preview.potentialRisks.length).toBeGreaterThan(0);
        expect(preview.resourceCost.gasEstimate).toBeGreaterThan(0);
      });
    });
  });

  describe("Confirmation Messages and Consequences", () => {
    describe("Confirmation Messages", () => {
      it("should generate appropriate message for high risk", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.message).toContain("high-risk operation");
        expect(result.message).toContain("significant consequences");
        expect(result.message).toContain("review the details carefully");
      });

      it("should generate appropriate message for medium risk", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.message).toContain("review the operation details");
        expect(result.message).toContain("confirm you want to proceed");
      });

      it("should generate appropriate message for low risk", () => {
        const lowRiskRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          operationType: "read",
        };

        const lowRiskDetection: OperationDetectionResult = {
          ...mockDetectionResult,
          operationType: "read",
          riskLevel: "low",
        };

        const result = RiskAssessmentService.assessOperationRisk(
          lowRiskRequest,
          lowRiskDetection,
        );

        expect(result.message).toContain("Click proceed to continue");
      });

      it("should include process ID in message", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.message).toContain(mockProcessId);
      });

      it("should include operation type in message", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.message).toContain("write operation");
      });
    });

    describe("Consequences Generation", () => {
      it("should generate transfer consequences", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.consequences).toContain(
          "Your token balance will decrease",
        );
        expect(result.consequences).toContain(
          "The transaction cannot be reversed without recipient cooperation",
        );
      });

      it("should generate send operation consequences", () => {
        const sendHandler: HandlerMetadata = {
          action: "Send",
          description: "Send tokens",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          sendHandler,
        );

        expect(result.consequences).toContain(
          "Your token balance will decrease",
        );
        expect(result.consequences).toContain(
          "The transaction cannot be reversed without recipient cooperation",
        );
      });

      it("should generate burn operation consequences", () => {
        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mockBurnHandler,
        );

        expect(result.consequences).toContain(
          "Tokens will be permanently destroyed",
        );
        expect(result.consequences).toContain("This action cannot be undone");
      });

      it("should generate mint operation consequences", () => {
        const mintHandler: HandlerMetadata = {
          action: "Mint",
          description: "Mint new tokens",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          mintHandler,
        );

        expect(result.consequences).toContain(
          "New tokens will be created and added to circulation",
        );
        expect(result.consequences).toContain("Total supply will increase");
      });

      it("should generate delete operation consequences", () => {
        const deleteHandler: HandlerMetadata = {
          action: "Delete",
          description: "Delete data",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          deleteHandler,
        );

        expect(result.consequences).toContain(
          "Data will be permanently removed",
        );
        expect(result.consequences).toContain("This action cannot be undone");
      });

      it("should generate batch operation consequences", () => {
        const batchRequest: ExecutionRequest = {
          ...mockExecutionRequest,
          batchContext: {
            batchId: "batch_123",
            operationIndex: 1,
            totalOperations: 3,
          },
        };

        const result = RiskAssessmentService.assessOperationRisk(
          batchRequest,
          mockDetectionResult,
          mockTransferHandler,
        );

        expect(result.consequences).toContain(
          "This is part of a batch operation",
        );
        expect(result.consequences).toContain(
          "Failure may affect subsequent operations",
        );
      });

      it("should handle operations without specific consequences", () => {
        const unknownHandler: HandlerMetadata = {
          action: "CustomAction",
          description: "Custom operation",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          unknownHandler,
        );

        // Should not crash and should provide basic consequences if available
        expect(result.consequences).toBeDefined();
        expect(Array.isArray(result.consequences)).toBe(true);
      });
    });

    describe("Confirmation Titles", () => {
      it("should generate appropriate titles for each risk level", () => {
        const testCases = [
          { 
            expected: "✓ Confirm: Balance", 
            riskLevel: "low" as const,
            handler: { action: "Balance", description: "Get balance", isWrite: false },
            request: { ...mockExecutionRequest, operationType: "read" as const, handler: "Balance" }
          },
          {
            expected: "⚡ Confirm Operation: Transfer",
            riskLevel: "medium" as const,
            handler: mockTransferHandler,
            request: mockExecutionRequest
          },
          {
            expected: "⚠️ High Risk Operation: Burn",
            riskLevel: "high" as const,
            handler: { action: "Burn", description: "Burn tokens", isWrite: true },
            request: { ...mockExecutionRequest, handler: "Burn" }
          },
        ];

        for (const testCase of testCases) {
          const detection: OperationDetectionResult = {
            ...mockDetectionResult,
            riskLevel: testCase.riskLevel,
          };

          const result = RiskAssessmentService.assessOperationRisk(
            testCase.request,
            detection,
            testCase.handler,
          );

          expect(result.title).toBe(testCase.expected);
        }
      });

      it("should include handler name in title", () => {
        const customHandler: HandlerMetadata = {
          action: "CustomHandler",
          description: "Custom operation",
          isWrite: true,
        };

        const result = RiskAssessmentService.assessOperationRisk(
          mockExecutionRequest,
          mockDetectionResult,
          customHandler,
        );

        expect(result.title).toContain("CustomHandler");
      });
    });
  });
});
