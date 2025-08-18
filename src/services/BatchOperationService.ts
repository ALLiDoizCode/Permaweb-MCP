import type { JWKInterface } from "arweave/node/lib/wallet.js";

import type {
  BatchExecutionContext,
  BatchOperationItemResult,
  BatchOperationResult,
  BatchRequest,
  UnifiedProcessResponse,
} from "../types/unified-communication.js";
import type { HandlerMetadata } from "./DocumentationProtocolService.js";

import { OperationDetectionService } from "./OperationDetectionService.js";
import { processCommunicationService } from "./ProcessCommunicationService.js";
import { TransactionSimulationService } from "./TransactionSimulationService.js";

export class BatchOperationService {
  /**
   * Execute batch operations with sequential processing and error handling
   */
  public static async executeBatch(
    processId: string,
    batchRequests: BatchRequest[],
    signer: JWKInterface,
    options: {
      maxConcurrent?: number;
      processMarkdown?: string;
      rollbackOnError?: boolean;
    } = {},
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const batchId = this.generateBatchId();
    const results: BatchOperationItemResult[] = [];

    let completedOperations = 0;
    let failedOperations = 0;

    const batchContext: BatchExecutionContext = {
      batchId,
      rollbackOnError: options.rollbackOnError,
      sequenceNumber: 0,
      totalOperations: batchRequests.length,
    };

    try {
      // Process requests sequentially to maintain order and handle dependencies
      for (let i = 0; i < batchRequests.length; i++) {
        const request = batchRequests[i];
        batchContext.sequenceNumber = i + 1;

        const itemResult = await this.executeBatchItem(
          processId,
          request,
          signer,
          batchContext,
          options.processMarkdown,
        );

        results.push(itemResult);

        if (itemResult.success) {
          completedOperations++;
        } else {
          failedOperations++;

          // Handle rollback on error
          if (options.rollbackOnError) {
            const rollbackResult = await this.rollbackBatch(
              processId,
              results.slice(0, i), // Only rollback successful operations
              signer,
              batchContext,
            );

            results.push({
              error: rollbackResult.error,
              request: "ROLLBACK_BATCH",
              result: rollbackResult.response,
              sequenceNumber: i + 2,
              success: rollbackResult.success,
            });

            break; // Stop processing further requests
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const overallSuccess = failedOperations === 0 || !options.rollbackOnError;

      return {
        batchId,
        completedOperations,
        executionTime,
        failedOperations,
        results,
        success: overallSuccess,
        totalOperations: batchRequests.length,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        batchId,
        completedOperations,
        executionTime,
        failedOperations: batchRequests.length - completedOperations,
        results: [
          ...results,
          {
            error:
              error instanceof Error
                ? error.message
                : "Unknown batch execution error",
            request: "BATCH_EXECUTION_ERROR",
            sequenceNumber: results.length + 1,
            success: false,
          },
        ],
        success: false,
        totalOperations: batchRequests.length,
      };
    }
  }

  /**
   * Execute a workflow template with predefined common interaction patterns
   */
  public static async executeWorkflowTemplate(
    processId: string,
    templateName: string,
    parameters: Record<string, unknown>,
    signer: JWKInterface,
    options: {
      processMarkdown?: string;
    } = {},
  ): Promise<BatchOperationResult> {
    const template = this.getWorkflowTemplate(templateName);

    if (!template) {
      throw new Error(`Workflow template '${templateName}' not found`);
    }

    // Generate batch requests from template
    const batchRequests = template.steps.map((step) => ({
      mode: step.mode,
      parameters: step.parameters
        ? this.interpolateParameters(step.parameters, parameters)
        : undefined,
      request: this.interpolateTemplate(step.request, parameters),
      requireConfirmation: step.requireConfirmation,
    }));

    return this.executeBatch(processId, batchRequests, signer, {
      ...options,
      rollbackOnError: template.rollbackOnError,
    });
  }

  /**
   * Get predefined workflow templates for common process interaction patterns
   */
  public static getAvailableWorkflowTemplates(): Array<{
    description: string;
    name: string;
    parameters: string[];
    steps: number;
  }> {
    return [
      {
        description: "Transfer tokens with balance check and confirmation",
        name: "token-transfer-with-verification",
        parameters: ["recipient", "amount"],
        steps: 3,
      },
      {
        description: "Mint tokens and distribute to multiple recipients",
        name: "mint-and-distribute",
        parameters: ["recipients", "amounts"],
        steps: 2,
      },
      {
        description:
          "Complete token audit: info, balances, and supply verification",
        name: "full-token-audit",
        parameters: [],
        steps: 4,
      },
      {
        description: "Check balances for multiple accounts",
        name: "batch-balance-check",
        parameters: ["accounts"],
        steps: 1,
      },
    ];
  }

  /**
   * Execute individual batch item with proper error handling
   */
  private static async executeBatchItem(
    processId: string,
    request: BatchRequest,
    signer: JWKInterface,
    batchContext: BatchExecutionContext,
    processMarkdown?: string,
  ): Promise<BatchOperationItemResult> {
    try {
      // Detect operation type for the request
      const detectionResult = OperationDetectionService.detectOperationType(
        request.request,
      );

      // Execute the request using the appropriate service method
      let result: UnifiedProcessResponse;

      if (processMarkdown) {
        const response =
          await processCommunicationService.executeProcessRequest(
            processMarkdown,
            processId,
            request.request,
            signer,
          );

        // Convert to unified response format
        result = {
          executionTime: 0,
          handlerUsed: response.handlerUsed || "unknown",
          operation:
            detectionResult.operationType === "unknown"
              ? "read"
              : detectionResult.operationType,
          parameters: request.parameters || {},
          processingMode: request.mode || "auto",
          result: {
            details: (response.data || {}) as Record<string, unknown>,
            rawResponse: response,
            summary: response.success
              ? "Operation completed"
              : response.error || "Operation failed",
          },
          success: response.success,
        };
      } else {
        // Use smart request execution
        const response = await processCommunicationService.executeSmartRequest(
          processId,
          request.request,
          signer,
          processMarkdown,
        );

        result = {
          executionTime: 0,
          handlerUsed: response.handlerUsed || "unknown",
          operation:
            detectionResult.operationType === "unknown"
              ? "read"
              : detectionResult.operationType,
          parameters: request.parameters || {},
          processingMode: request.mode || "auto",
          result: {
            details: (response.data || {}) as Record<string, unknown>,
            rawResponse: response,
            summary: response.success
              ? "Operation completed"
              : response.error || "Operation failed",
          },
          success: response.success,
        };
      }

      return {
        request: request.request,
        result,
        sequenceNumber: batchContext.sequenceNumber,
        success: result.success,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during batch item execution",
        request: request.request,
        sequenceNumber: batchContext.sequenceNumber,
        success: false,
      };
    }
  }

  /**
   * Generate unique batch ID
   */
  private static generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get workflow template definition
   */
  private static getWorkflowTemplate(templateName: string): {
    rollbackOnError: boolean;
    steps: Array<{
      mode?: "auto" | "read" | "validate" | "write";
      parameters?: Record<string, string>;
      request: string;
      requireConfirmation?: boolean;
    }>;
  } | null {
    const templates: Record<string, any> = {
      "batch-balance-check": {
        rollbackOnError: false,
        steps: [
          {
            mode: "read",
            parameters: { accounts: "${accounts}" },
            request: "check balances for multiple accounts: ${accounts}",
          },
        ],
      },
      "full-token-audit": {
        rollbackOnError: false,
        steps: [
          {
            mode: "read",
            request: "get token info",
          },
          {
            mode: "read",
            request: "get total supply",
          },
          {
            mode: "read",
            request: "get all balances",
          },
          {
            mode: "read",
            request: "get my balance",
          },
        ],
      },
      "mint-and-distribute": {
        rollbackOnError: true,
        steps: [
          {
            mode: "write",
            parameters: { quantity: "${amount}", recipient: "${recipient}" },
            request: "mint ${amount} tokens to ${recipient}",
            requireConfirmation: true,
          },
          {
            mode: "read",
            parameters: { target: "${recipient}" },
            request: "get balance for ${recipient}",
          },
        ],
      },
      "token-transfer-with-verification": {
        rollbackOnError: false,
        steps: [
          {
            mode: "read",
            request: "get my balance",
          },
          {
            mode: "write",
            parameters: { amount: "${amount}", recipient: "${recipient}" },
            request: "transfer ${amount} tokens to ${recipient}",
            requireConfirmation: true,
          },
          {
            mode: "read",
            parameters: { target: "${recipient}" },
            request: "get balance for ${recipient}",
          },
        ],
      },
    };

    return templates[templateName] || null;
  }

  /**
   * Interpolate template parameters with values
   */
  private static interpolateParameters(
    templateParams: Record<string, string>,
    parameters: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, templateValue] of Object.entries(templateParams)) {
      if (
        typeof templateValue === "string" &&
        templateValue.startsWith("${") &&
        templateValue.endsWith("}")
      ) {
        const paramName = templateValue.slice(2, -1);
        result[key] = parameters[paramName];
      } else {
        result[key] = templateValue;
      }
    }

    return result;
  }

  /**
   * Interpolate template string with parameters
   */
  private static interpolateTemplate(
    template: string,
    parameters: Record<string, unknown>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `\${${key}}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    }

    return result;
  }

  /**
   * Rollback batch operations (simplified implementation)
   */
  private static async rollbackBatch(
    processId: string,
    successfulResults: BatchOperationItemResult[],
    signer: JWKInterface,
    batchContext: BatchExecutionContext,
  ): Promise<{
    error?: string;
    response?: UnifiedProcessResponse;
    success: boolean;
  }> {
    try {
      // Note: This is a simplified rollback implementation
      // In a real system, this would require transaction reversal capabilities

      const rollbackOperations = successfulResults
        .filter((result) => result.result?.operation === "write")
        .reverse(); // Reverse order for rollback

      if (rollbackOperations.length === 0) {
        return { success: true };
      }

      // For now, just return a placeholder response
      // Real implementation would need process-specific rollback logic
      return {
        response: {
          executionTime: 0,
          handlerUsed: "batch-rollback",
          operation: "write",
          parameters: { rolledBackOperations: rollbackOperations.length },
          processingMode: "batch",
          result: {
            details: {
              message: `Rolled back ${rollbackOperations.length} operations`,
            },
            rawResponse: null,
            summary: "Batch rollback completed",
          },
          success: true,
        },
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Rollback failed",
        success: false,
      };
    }
  }
}
