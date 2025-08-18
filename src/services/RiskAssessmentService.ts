import type {
  ExecutionRequest,
  OperationDetectionResult,
  RiskAssessment,
} from "../types/unified-communication.js";
import type { HandlerMetadata } from "./DocumentationProtocolService.js";

export interface ConfirmationOption {
  action: "cancel" | "modify" | "proceed" | "simulate";
  id: string;
  label: string;
  recommended: boolean;
}

export interface ConfirmationPrompt {
  confirmationOptions: ConfirmationOption[];
  consequences: string[];
  message: string;
  required: boolean;
  riskLevel: "high" | "low" | "medium";
  title: string;
  transactionPreview: TransactionPreview;
  warnings: string[];
}

export interface TransactionPreview {
  estimatedOutcome: string[];
  handler: string;
  operation: string;
  parameters: Record<string, unknown>;
  potentialRisks: string[];
  processId: string;
  resourceCost: {
    gasEstimate: number;
    tokenRequirement?: string;
  };
  reversible: boolean;
}

export class RiskAssessmentService {
  /**
   * Assess operation risk and generate confirmation prompt if needed
   */
  public static assessOperationRisk(
    request: ExecutionRequest,
    detectionResult: OperationDetectionResult,
    handlerMetadata?: HandlerMetadata,
  ): ConfirmationPrompt {
    const riskAssessment = this.performDetailedRiskAssessment(
      request,
      detectionResult,
      handlerMetadata,
    );

    const transactionPreview = this.generateTransactionPreview(
      request,
      handlerMetadata,
      riskAssessment,
    );

    return {
      confirmationOptions: this.generateConfirmationOptions(
        riskAssessment.level,
      ),
      consequences: this.generateConsequences(request, handlerMetadata),
      message: this.generateConfirmationMessage(riskAssessment, request),
      required: riskAssessment.confirmationRequired,
      riskLevel: riskAssessment.level,
      title: this.generateConfirmationTitle(
        riskAssessment.level,
        handlerMetadata?.action || request.handler,
      ),
      transactionPreview,
      warnings: riskAssessment.warnings,
    };
  }

  /**
   * Assess parameter-based risk factors
   */
  private static assessParameterBasedRisk(
    parameters: Record<string, unknown>,
  ): {
    factors: string[];
    riskLevel: "high" | "low" | "medium";
    warnings: string[];
  } {
    const factors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: "high" | "low" | "medium" = "low";

    // Large amount detection
    const amountFields = ["amount", "quantity", "value"];
    for (const field of amountFields) {
      const value = parameters[field];
      if (typeof value === "number" || typeof value === "string") {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          if (numValue > 1000000) {
            factors.push("Very large transaction amount");
            warnings.push("This involves a significant amount of tokens");
            riskLevel = "high";
          } else if (numValue > 10000) {
            factors.push("Large transaction amount");
            warnings.push("Please verify the amount is correct");
            if (riskLevel === "low") riskLevel = "medium";
          }
        }
      }
    }

    // Administrative parameter detection
    const adminParams = ["owner", "admin", "permission", "access", "role"];
    for (const param of adminParams) {
      if (parameters[param] !== undefined) {
        factors.push("Administrative parameter detected");
        warnings.push("This affects system permissions or roles");
        if (riskLevel === "low") riskLevel = "medium";
      }
    }

    // Permanent action indicators
    const permanentParams = ["permanent", "irreversible", "final"];
    for (const param of permanentParams) {
      if (
        parameters[param] === true ||
        String(parameters[param]).toLowerCase() === "true"
      ) {
        factors.push("Permanent action requested");
        warnings.push("This action cannot be reversed");
        riskLevel = "high";
      }
    }

    return { factors, riskLevel, warnings };
  }

  /**
   * Estimate gas cost for operation
   */
  private static estimateGasCost(request: ExecutionRequest): number {
    let baseCost = 100;

    if (request.operationType === "write") {
      baseCost += 200;
    }

    baseCost += Object.keys(request.parameters).length * 10;

    if (request.batchContext) {
      baseCost += 50;
    }

    return baseCost;
  }

  /**
   * Extract token requirement from parameters
   */
  private static extractTokenRequirement(
    parameters: Record<string, unknown>,
  ): string | undefined {
    const amountFields = ["amount", "quantity", "value"];

    for (const field of amountFields) {
      const value = parameters[field];
      if (value !== undefined) {
        return String(value);
      }
    }

    return undefined;
  }

  /**
   * Generate confirmation message
   */
  private static generateConfirmationMessage(
    riskAssessment: RiskAssessment,
    request: ExecutionRequest,
  ): string {
    const baseMessage = `You are about to execute a ${request.operationType} operation on process ${request.processId}.`;

    if (riskAssessment.level === "high") {
      return `${baseMessage} This is a high-risk operation that may have significant consequences. Please review the details carefully before proceeding.`;
    } else if (riskAssessment.level === "medium") {
      return `${baseMessage} Please review the operation details and confirm you want to proceed.`;
    } else {
      return `${baseMessage} Click proceed to continue.`;
    }
  }

  /**
   * Generate confirmation options based on risk level
   */
  private static generateConfirmationOptions(
    riskLevel: "high" | "low" | "medium",
  ): ConfirmationOption[] {
    const baseOptions: ConfirmationOption[] = [
      {
        action: "proceed",
        id: "proceed",
        label: "Proceed with transaction",
        recommended: false,
      },
      {
        action: "cancel",
        id: "cancel",
        label: "Cancel transaction",
        recommended: false,
      },
    ];

    if (riskLevel === "high") {
      return [
        {
          action: "simulate",
          id: "simulate",
          label: "Simulate first (recommended)",
          recommended: true,
        },
        ...baseOptions,
        {
          action: "modify",
          id: "modify",
          label: "Modify parameters",
          recommended: false,
        },
      ];
    } else if (riskLevel === "medium") {
      return [
        ...baseOptions.map((option) =>
          option.id === "cancel" ? { ...option, recommended: true } : option,
        ),
        {
          action: "simulate",
          id: "simulate",
          label: "Simulate first",
          recommended: false,
        },
      ];
    } else {
      return baseOptions.map((option) =>
        option.id === "proceed" ? { ...option, recommended: true } : option,
      );
    }
  }

  /**
   * Generate confirmation title based on risk level
   */
  private static generateConfirmationTitle(
    riskLevel: "high" | "low" | "medium",
    handler: string,
  ): string {
    switch (riskLevel) {
      case "high":
        return `⚠️ High Risk Operation: ${handler}`;
      case "medium":
        return `⚡ Confirm Operation: ${handler}`;
      case "low":
      default:
        return `✓ Confirm: ${handler}`;
    }
  }

  /**
   * Generate potential consequences list
   */
  private static generateConsequences(
    request: ExecutionRequest,
    handlerMetadata?: HandlerMetadata,
  ): string[] {
    const consequences: string[] = [];

    if (handlerMetadata) {
      const actionLower = handlerMetadata.action.toLowerCase();

      if (actionLower.includes("transfer") || actionLower.includes("send")) {
        consequences.push("Your token balance will decrease");
        consequences.push(
          "The transaction cannot be reversed without recipient cooperation",
        );
      } else if (actionLower.includes("burn")) {
        consequences.push("Tokens will be permanently destroyed");
        consequences.push("This action cannot be undone");
      } else if (actionLower.includes("mint")) {
        consequences.push(
          "New tokens will be created and added to circulation",
        );
        consequences.push("Total supply will increase");
      } else if (actionLower.includes("delete")) {
        consequences.push("Data will be permanently removed");
        consequences.push("This action cannot be undone");
      }
    }

    if (request.batchContext) {
      consequences.push("This is part of a batch operation");
      consequences.push("Failure may affect subsequent operations");
    }

    return consequences;
  }

  /**
   * Generate transaction preview with detailed impact assessment
   */
  private static generateTransactionPreview(
    request: ExecutionRequest,
    handlerMetadata?: HandlerMetadata,
    riskAssessment?: RiskAssessment,
  ): TransactionPreview {
    const estimatedOutcome: string[] = [];
    const potentialRisks: string[] = [];

    // Generate outcome predictions based on handler
    if (handlerMetadata) {
      const actionLower = handlerMetadata.action.toLowerCase();

      if (actionLower.includes("transfer") || actionLower.includes("send")) {
        estimatedOutcome.push("Tokens will be transferred from your account");
        estimatedOutcome.push("Recipient balance will increase");
        potentialRisks.push("Insufficient balance");
        potentialRisks.push("Invalid recipient address");
      } else if (actionLower.includes("mint")) {
        estimatedOutcome.push("New tokens will be created");
        estimatedOutcome.push("Total supply will increase");
        potentialRisks.push("Minting limits may be exceeded");
      } else if (actionLower.includes("burn")) {
        estimatedOutcome.push("Tokens will be permanently destroyed");
        estimatedOutcome.push("Total supply will decrease");
        potentialRisks.push("Tokens cannot be recovered after burning");
      } else if (
        actionLower.includes("delete") ||
        actionLower.includes("remove")
      ) {
        estimatedOutcome.push("Data will be permanently deleted");
        potentialRisks.push("Data cannot be recovered after deletion");
      }
    }

    // Add parameter-specific outcomes
    if (request.parameters.amount || request.parameters.quantity) {
      const amount = request.parameters.amount || request.parameters.quantity;
      estimatedOutcome.push(`Amount processed: ${amount}`);
    }

    if (request.parameters.recipient || request.parameters.target) {
      const target = request.parameters.recipient || request.parameters.target;
      estimatedOutcome.push(`Target account: ${target}`);
    }

    // Determine if operation is reversible
    const reversible = !this.isIrreversibleOperation(
      handlerMetadata?.action || request.handler,
    );

    return {
      estimatedOutcome,
      handler: request.handler,
      operation: `${request.operationType.toUpperCase()} operation`,
      parameters: request.parameters,
      potentialRisks,
      processId: request.processId,
      resourceCost: {
        gasEstimate: this.estimateGasCost(request),
        tokenRequirement: this.extractTokenRequirement(request.parameters),
      },
      reversible,
    };
  }

  /**
   * Check if transaction involves high value
   */
  private static isHighValueTransaction(
    parameters: Record<string, unknown>,
  ): boolean {
    const amountFields = ["amount", "quantity", "value"];

    for (const field of amountFields) {
      const value = parameters[field];
      if (typeof value === "number" || typeof value === "string") {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (!isNaN(numValue) && numValue > 100000) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if operation is irreversible
   */
  private static isIrreversibleOperation(action: string): boolean {
    const irreversibleActions = [
      "delete",
      "burn",
      "destroy",
      "remove",
      "revoke",
    ];
    return irreversibleActions.some((op) => action.toLowerCase().includes(op));
  }

  /**
   * Perform detailed risk assessment for high-risk operation detection
   */
  private static performDetailedRiskAssessment(
    request: ExecutionRequest,
    detectionResult: OperationDetectionResult,
    handlerMetadata?: HandlerMetadata,
  ): RiskAssessment {
    const factors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: "high" | "low" | "medium" = detectionResult.riskLevel;

    // Handler-based risk factors
    if (handlerMetadata) {
      const actionLower = handlerMetadata.action.toLowerCase();

      // Critical operations that cannot be undone
      const criticalOperations = [
        "delete",
        "burn",
        "destroy",
        "remove",
        "revoke",
      ];
      if (criticalOperations.some((op) => actionLower.includes(op))) {
        factors.push("Irreversible operation");
        warnings.push("This action cannot be undone");
        riskLevel = "high";
      }

      // Administrative operations
      const adminOperations = [
        "transfer_ownership",
        "set_admin",
        "grant_permission",
        "revoke_permission",
      ];
      if (adminOperations.some((op) => actionLower.includes(op))) {
        factors.push("Administrative operation");
        warnings.push("This affects system permissions or ownership");
        riskLevel = "high";
      }

      // Value transfer operations
      const valueOperations = ["transfer", "send", "withdraw", "mint"];
      if (valueOperations.some((op) => actionLower.includes(op))) {
        factors.push("Value transfer operation");
        if (riskLevel === "low") riskLevel = "medium";
      }
    }

    // Parameter-based risk assessment
    const parameterRisk = this.assessParameterBasedRisk(request.parameters);
    factors.push(...parameterRisk.factors);
    warnings.push(...parameterRisk.warnings);

    if (parameterRisk.riskLevel === "high" || riskLevel === "high") {
      riskLevel = "high";
    } else if (parameterRisk.riskLevel === "medium" && riskLevel === "low") {
      riskLevel = "medium";
    }

    // Operation type risk
    if (request.operationType === "write") {
      factors.push("State-modifying operation");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // Batch operation risk
    if (request.batchContext) {
      factors.push("Part of batch operation with cascading effects");
      warnings.push("Failure may affect subsequent operations in batch");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // Force confirmation requirement
    const confirmationRequired =
      riskLevel === "high" ||
      request.requireConfirmation === true ||
      this.isHighValueTransaction(request.parameters);

    return {
      confirmationRequired,
      factors,
      level: riskLevel,
      warnings,
    };
  }
}
