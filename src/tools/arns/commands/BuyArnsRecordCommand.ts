import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { ArnsClientManager } from "../utils/ArnsClientManager.js";
import { GetArnsTokenCostCommand } from "./GetArnsTokenCostCommand.js";
// ArNS name validation utility - validates raw name (without .ar suffix)

interface BuyArnsRecordArgs {
  confirmed?: boolean;
  name: string;
  network?: "mainnet" | "testnet";
  type: "lease" | "permanent";
  undernames?: number;
  years?: number;
}

interface BuyArnsRecordResponse {
  error?: {
    code: string;
    message: string;
    suggestions: string[];
  };
  estimatedCost?: {
    breakdown: {
      baseCostIO: string;
      demandFactor: number;
      networkFeeIO: string;
      totalCostIO: string;
      undernameFeeIO?: string;
    };
    totalCost: string;
  };
  instruction?: string;
  name?: string;
  network?: string;
  registration?: {
    cost: {
      breakdown: object;
      totalPaid: string;
    };
    name: string;
    network: string;
    owner: string;
    transactionId: string;
    type: "lease" | "permanent";
    undernames: number;
    years?: number;
  };
  requiresConfirmation?: boolean;
  success: boolean;
  transactionId?: string;
}

export class BuyArnsRecordCommand extends ToolCommand<
  BuyArnsRecordArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Register ArNS names through natural language commands supporting both lease and permanent registration with transaction signing",
    name: "buyArnsRecord",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Buy ArNS Record",
  };

  protected parametersSchema = z
    .object({
      confirmed: z
        .boolean()
        .optional()
        .describe("Set to true to confirm registration"),
      name: z
        .string()
        .min(1)
        .max(51)
        .regex(/^[a-zA-Z0-9.-]+$/)
        .describe("ArNS name to register (without .ar suffix)"),
      network: z
        .enum(["mainnet", "testnet"])
        .optional()
        .describe(
          "Network to use for registration (defaults to ARNS_NETWORK env var)",
        ),
      type: z
        .enum(["lease", "permanent"])
        .describe(
          "Registration type - lease for 1-5 years, permanent for lifetime ownership",
        ),
      undernames: z
        .number()
        .int()
        .min(10)
        .max(100)
        .optional()
        .default(10)
        .describe("Number of undernames to support (10-100, default: 10)"),
      years: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Lease duration in years (1-5, required for lease type)"),
    })
    .refine((data) => data.type !== "lease" || data.years !== undefined, {
      message: "Years parameter is required when type is 'lease'",
      path: ["years"],
    });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: BuyArnsRecordArgs): Promise<string> {
    try {
      // Validate parameters first
      const validation = this.parametersSchema.safeParse(args);
      if (!validation.success) {
        return JSON.stringify({
          error: {
            code: "INVALID_PARAMETERS",
            message: `Parameter validation failed: ${validation.error.issues[0].message}`,
            suggestions: [
              "Check parameter format and requirements",
              "Ensure lease type includes years parameter",
              "Verify name contains only alphanumeric characters and hyphens",
            ],
          },
          name: args.name,
          success: false,
        } as BuyArnsRecordResponse);
      }

      // Additional name validation - the Zod schema already handles basic validation
      // ArNS names for registration should not contain .ar suffix
      if (args.name.includes(".ar")) {
        return JSON.stringify({
          error: {
            code: "INVALID_NAME_FORMAT",
            message: "ArNS name should not include .ar suffix for registration",
            suggestions: [
              "Remove .ar suffix from the name",
              "Use only the base name (e.g., 'example' instead of 'example.ar')",
            ],
          },
          name: args.name,
          success: false,
        } as BuyArnsRecordResponse);
      }

      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      const { keyPair, publicKey } = await safeContext.initializeAll();

      // Get network from args or environment
      const network =
        args.network ||
        (process.env.ARNS_NETWORK as "mainnet" | "testnet") ||
        "mainnet";

      // For registration operations, we need a client with write capabilities
      // Initialize ArNS client using the existing client manager
      const clientManager = ArnsClientManager.getInstance();
      await clientManager.initializeClient(network, keyPair);
      const arnsClient = clientManager.getClient();

      if (!arnsClient) {
        throw new Error("Failed to initialize ArNS client");
      }

      // Get cost calculation for confirmation
      const costCommand = new GetArnsTokenCostCommand(this.context);
      const costResult = await costCommand.execute({
        name: args.name,
        network,
        type: args.type,
        undernames: args.undernames,
        years: args.years,
      });

      const costData = JSON.parse(costResult);
      if (!costData.success) {
        return JSON.stringify({
          error: {
            code: "COST_CALCULATION_FAILED",
            message: "Could not calculate registration cost",
            suggestions: [
              "Check name availability and network connectivity",
              "Try again later",
              "Verify network configuration",
            ],
          },
          name: args.name,
          success: false,
        } as BuyArnsRecordResponse);
      }

      // If not confirmed, return cost information for confirmation
      if (!args.confirmed) {
        return JSON.stringify({
          estimatedCost: {
            breakdown: costData.pricing.breakdown,
            totalCost: costData.pricing.totalCost,
          },
          instruction:
            "Add 'confirmed: true' to proceed with registration after reviewing the cost",
          message: `Registration will cost ${costData.pricing.breakdown.totalCostIO} IO tokens`,
          name: args.name,
          network,
          requiresConfirmation: true,
          success: false,
        } as BuyArnsRecordResponse);
      }

      // Perform the actual registration
      try {
        // Build registration parameters based on ar.io SDK documentation
        const registrationParams: {
          name: string;
          type: "lease" | "permabuy";
          years?: number;
        } = {
          name: args.name,
          type: args.type === "permanent" ? "permabuy" : "lease",
        };

        // For lease registration, include years parameter
        if (args.type === "lease" && args.years) {
          registrationParams.years = args.years;
        }

        // Use ar-io-sdk buyRecord method
        const { ARIO, ArweaveSigner } = await import("@ar.io/sdk/node");

        // Create proper signer from JWK
        const signer = new ArweaveSigner(keyPair);

        // Initialize ARIO client for the specified network with signer
        const arioClient =
          network === "testnet"
            ? ARIO.testnet({ signer })
            : ARIO.mainnet({ signer });

        // Call the actual buyRecord method
        const registrationResult = await arioClient.buyRecord(
          registrationParams,
          {
            tags: [
              { name: "App-Name", value: "Permamind-ArNS" },
              { name: "Registration-Type", value: args.type },
            ],
          },
        );

        // Create successful response
        const successResponse: BuyArnsRecordResponse = {
          registration: {
            cost: {
              breakdown: costData.pricing.breakdown,
              totalPaid: costData.pricing.breakdown.totalCostIO,
            },
            name: args.name,
            network,
            owner: publicKey,
            transactionId: registrationResult.id,
            type: args.type,
            undernames: args.undernames || 10,
            years: args.years,
          },
          success: true,
          transactionId: registrationResult.id,
        };

        return JSON.stringify(successResponse, null, 2);
      } catch (registrationError) {
        const errorMessage =
          registrationError instanceof Error
            ? registrationError.message
            : "Unknown registration error";

        // Handle specific registration error types
        let errorCode = "REGISTRATION_FAILED";
        let suggestions = [
          "Check network connectivity",
          "Verify sufficient funds",
          "Try again later",
        ];

        if (errorMessage.includes("insufficient funds")) {
          errorCode = "INSUFFICIENT_FUNDS";
          suggestions = [
            "Add more IO tokens to your wallet",
            "Use a different payment method",
            "Check wallet balance",
          ];
        } else if (errorMessage.includes("name already exists")) {
          errorCode = "NAME_ALREADY_EXISTS";
          suggestions = [
            "Choose a different name",
            "Check name availability",
            "Try a variation of the name",
          ];
        } else if (errorMessage.includes("timeout")) {
          errorCode = "NETWORK_TIMEOUT";
          suggestions = [
            "Retry the registration",
            "Check network connectivity",
            "Try again in a few minutes",
          ];
        }

        return JSON.stringify({
          error: {
            code: errorCode,
            message: `Registration failed: ${errorMessage}`,
            suggestions,
          },
          name: args.name,
          success: false,
        } as BuyArnsRecordResponse);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return JSON.stringify({
        error: {
          code: "COMMAND_EXECUTION_FAILED",
          message: `Command execution failed: ${errorMessage}`,
          suggestions: [
            "Verify system configuration",
            "Check network settings",
            "Contact support if issue persists",
          ],
        },
        name: args.name,
        success: false,
      } as BuyArnsRecordResponse);
    }
  }
}
