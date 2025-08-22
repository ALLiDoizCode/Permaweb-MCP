import { z } from "zod";

import {
  AutoSafeToolContext,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";
import { ArnsClientManager } from "../utils/ArnsClientManager.js";
import {
  isValidArnsName,
  normalizeArnsName,
} from "../utils/ArnsNameValidation.js";

interface ArnsTokenCostResponse {
  comparison?: {
    costEfficiency?: {
      breakEvenYears?: number; // How many years until permanent becomes cheaper
      longTermSavings?: string; // Potential savings with permanent in ARIO
      shortTermBenefit?: string; // Savings with lease for specified period in ARIO
    };
    leaseTotal?: string; // Total lease cost in winston
    leaseTotalARIO?: string; // Total lease cost in ARIO for display
    permanentCost?: string; // Permanent cost in winston
    permanentCostARIO?: string; // Permanent cost in ARIO for display
    recommendation?: string;
  };
  error?: {
    code: string;
    message: string;
    suggestions: string[];
  };
  name: string;
  network: string;
  pricing: {
    baseCost: string; // IO tokens in winston
    // Enhanced breakdown details
    breakdown?: {
      baseCostARIO: string; // Base cost in ARIO tokens for display
      costPerUndernameARIO?: string; // Cost per additional undername in ARIO
      demandFactor: number; // Current demand multiplier
      networkFeeARIO: string; // Network fee in ARIO tokens for display
      pricePerYearARIO?: string; // For lease: cost per year in ARIO
      totalCostARIO: string; // Total cost in ARIO tokens for display
      undernameFeeARIO?: string; // Undername fee in ARIO tokens for display
    };
    isEstimate: boolean;
    networkFee: string; // Demand factor adjustment
    totalCost: string; // Total in winston
    undernameFee?: string; // Additional undername cost
  };
  success: boolean;
  type: "lease" | "permanent";
  undernames: number;
  years?: number;
}

interface GetArnsTokenCostArgs {
  confirmed?: boolean;
  name: string;
  network?: "mainnet" | "testnet";
  type: "lease" | "permanent";
  undernames?: number;
  years?: number;
}

export class GetArnsTokenCostCommand extends ToolCommand<
  GetArnsTokenCostArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Calculate costs for ArNS name registration including lease and permanent options with demand-based pricing",
    name: "getArnsTokenCost",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get ArNS Token Cost",
  };

  protected parametersSchema = z
    .object({
      confirmed: z
        .boolean()
        .optional()
        .describe("Set to true to confirm cost calculation"),
      name: z
        .string()
        .min(1)
        .max(51)
        .refine(
          isValidArnsName,
          "Invalid ArNS name format. Must be valid name or undername (e.g., example, example.ar, sub.example, or sub.example.ar)",
        )
        .describe(
          "ArNS name to calculate cost for (with or without .ar suffix)",
        ),
      network: z
        .enum(["mainnet", "testnet"])
        .optional()
        .describe(
          "Network to use for pricing (defaults to ARNS_NETWORK env var)",
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

  async execute(args: GetArnsTokenCostArgs): Promise<string> {
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
          name: args.name || "",
          success: false,
        });
      }

      // Auto-initialize keypair and hub if needed
      const safeContext = AutoSafeToolContext.from(this.context);
      await safeContext.initializeAll();

      // Get network from args or environment
      const network =
        args.network ||
        (process.env.ARNS_NETWORK as "mainnet" | "testnet") ||
        "mainnet";

      // Initialize ArNS client
      const clientManager = ArnsClientManager.getInstance();
      await clientManager.initializeClient(network);
      const arnsClient = clientManager.getClient();

      if (!arnsClient) {
        throw new Error("ArNS client not initialized");
      }

      // Normalize the name to ensure consistent handling
      const normalizedName = normalizeArnsName(args.name);
      const baseName = normalizedName.replace(".ar", ""); // Remove .ar for API calls

      // USD pricing removed - only ARIO denomination needed

      const response: ArnsTokenCostResponse = {
        name: args.name, // Keep original input name for consistency
        network,
        pricing: {
          baseCost: "0",
          isEstimate: false,
          networkFee: "0",
          totalCost: "0",
        },
        success: true,
        type: args.type,
        undernames: args.undernames || 10,
        years: args.years,
      };

      try {
        // Get real pricing from ar-io-sdk
        // Map our type to ar-io-sdk type
        const arnsType = args.type === "permanent" ? "permabuy" : "lease";

        // Build request parameters
        const costRequest: {
          intent: string;
          name: string;
          type: string;
          undernames?: number;
          years?: number;
        } = {
          intent: "Buy-Record",
          name: baseName, // Use base name for API calls
          type: arnsType,
        };

        // Add years for lease type
        if (args.type === "lease" && args.years) {
          costRequest.years = args.years;
        }

        // Add undernames if specified (even though it may not affect pricing currently)
        if (args.undernames && args.undernames > 10) {
          costRequest.undernames = args.undernames;
        }

        // Get token cost and detailed cost breakdown
        // Note: Using type assertion due to incomplete TypeScript definitions in ar-io-sdk
        const tokenCost = await (
          arnsClient as {
            getTokenCost: (params: typeof costRequest) => Promise<number>;
          }
        ).getTokenCost(costRequest);
        const demandFactor = await (
          arnsClient as {
            getDemandFactor: () => Promise<number>;
          }
        ).getDemandFactor();

        // Get base registration fees for comparison
        const registrationFees = await (
          arnsClient as {
            getRegistrationFees: () => Promise<
              Record<
                string,
                { lease: Record<string, number>; permabuy: number }
              >
            >;
          }
        ).getRegistrationFees();
        const nameLength = args.name.length;
        const baseFees =
          registrationFees[nameLength.toString()] || registrationFees["51"];

        // Calculate base cost and network fee
        const baseCost =
          arnsType === "permabuy"
            ? baseFees.permabuy
            : baseFees.lease[args.years?.toString() || "1"];
        const networkFee = tokenCost - baseCost; // Difference is network fee/demand adjustment

        // Calculate undername fee (if applicable)
        const undernameFee =
          args.undernames && args.undernames > 10
            ? (args.undernames - 10) * 100000000 // Placeholder: 0.1 IO per extra undername
            : undefined;

        const totalCost = tokenCost + (undernameFee || 0);

        response.pricing = {
          baseCost: baseCost.toString(),
          breakdown: {
            baseCostARIO: this.winstonToARIO(baseCost),
            costPerUndernameARIO:
              args.undernames && args.undernames > 10
                ? this.winstonToARIO(100000000) // 0.1 IO per extra undername
                : undefined,
            demandFactor,
            networkFeeARIO: this.winstonToARIO(networkFee),
            pricePerYearARIO:
              args.type === "lease" && args.years
                ? this.winstonToARIO(Math.round(totalCost / args.years))
                : undefined,
            totalCostARIO: this.winstonToARIO(totalCost),
            undernameFeeARIO: undernameFee
              ? this.winstonToARIO(undernameFee)
              : undefined,
          },
          isEstimate: false, // Real pricing from ar-io-sdk
          networkFee: networkFee.toString(),
          totalCost: totalCost.toString(),
          undernameFee: undernameFee?.toString(),
        };

        // Add cost comparison for decision support
        if (args.type === "lease" && args.years) {
          // Calculate permanent cost for comparison
          const permanentCost = await (
            arnsClient as {
              getTokenCost: (params: {
                intent: string;
                name: string;
                type: string;
                undernames?: number;
              }) => Promise<number>;
            }
          ).getTokenCost({
            intent: "Buy-Record",
            name: baseName, // Use base name for API calls
            type: "permabuy",
            undernames: args.undernames,
          });

          const leaseTotal = parseInt(response.pricing.totalCost);
          const permanentTotal = permanentCost + (undernameFee || 0);
          const leaseCostPerYear = Math.round(leaseTotal / args.years);

          // Calculate break-even analysis
          const breakEvenAnalysis = await this.calculateBreakEvenAnalysis(
            leaseCostPerYear,
            permanentTotal,
            args.years,
          );

          response.comparison = {
            costEfficiency: {
              breakEvenYears: breakEvenAnalysis.breakEvenYears,
              longTermSavings: breakEvenAnalysis.longTermSavingsARIO,
              shortTermBenefit: breakEvenAnalysis.shortTermBenefitARIO,
            },
            leaseTotal: leaseTotal.toString(),
            leaseTotalARIO: this.winstonToARIO(leaseTotal),
            permanentCost: permanentTotal.toString(),
            permanentCostARIO: this.winstonToARIO(permanentTotal),
            recommendation:
              breakEvenAnalysis.breakEvenYears <= args.years
                ? `Permanent registration pays for itself in ${breakEvenAnalysis.breakEvenYears} years. Consider permanent for long-term use.`
                : breakEvenAnalysis.breakEvenYears <= 3
                  ? `Permanent registration becomes cost-effective after ${breakEvenAnalysis.breakEvenYears} years.`
                  : `${args.years}-year lease is cost-effective for your use case.`,
          };
        }
      } catch {
        // Fallback to estimated pricing based on known registration fees
        const baseCost = this.getEstimatedBaseCost(args);
        const demandMultiplier = 3.1; // Approximate current demand factor
        const networkFee = Math.round(baseCost * (demandMultiplier - 1));
        const undernameFee =
          args.undernames && args.undernames > 10
            ? (args.undernames - 10) * 100000000 // 0.1 IO per extra undername
            : undefined;

        const totalCostFallback = baseCost + networkFee + (undernameFee || 0);

        response.pricing = {
          baseCost: baseCost.toString(),
          breakdown: {
            baseCostARIO: this.winstonToARIO(baseCost),
            costPerUndernameARIO:
              args.undernames && args.undernames > 10
                ? this.winstonToARIO(100000000) // 0.1 IO per extra undername
                : undefined,
            demandFactor: demandMultiplier,
            networkFeeARIO: this.winstonToARIO(networkFee),
            pricePerYearARIO:
              args.type === "lease" && args.years
                ? this.winstonToARIO(Math.round(totalCostFallback / args.years))
                : undefined,
            totalCostARIO: this.winstonToARIO(totalCostFallback),
            undernameFeeARIO: undernameFee
              ? this.winstonToARIO(undernameFee)
              : undefined,
          },
          isEstimate: true,
          networkFee: networkFee.toString(),
          totalCost: totalCostFallback.toString(),
          undernameFee: undernameFee?.toString(),
        };

        // Add comparison for lease types in fallback mode
        if (args.type === "lease" && args.years) {
          // Calculate permanent cost estimate for comparison
          const permanentBaseCost = this.getEstimatedBaseCost({
            ...args,
            type: "permanent",
          });
          const permanentNetworkFee = Math.round(
            permanentBaseCost * (demandMultiplier - 1),
          );
          const permanentTotal =
            permanentBaseCost + permanentNetworkFee + (undernameFee || 0);
          const leaseCostPerYear = Math.round(totalCostFallback / args.years);

          // Calculate break-even analysis
          const breakEvenAnalysis = await this.calculateBreakEvenAnalysis(
            leaseCostPerYear,
            permanentTotal,
            args.years,
          );

          response.comparison = {
            costEfficiency: {
              breakEvenYears: breakEvenAnalysis.breakEvenYears,
              longTermSavings: breakEvenAnalysis.longTermSavingsARIO,
              shortTermBenefit: breakEvenAnalysis.shortTermBenefitARIO,
            },
            leaseTotal: totalCostFallback.toString(),
            leaseTotalARIO: this.winstonToARIO(totalCostFallback),
            permanentCost: permanentTotal.toString(),
            permanentCostARIO: this.winstonToARIO(permanentTotal),
            recommendation:
              breakEvenAnalysis.breakEvenYears <= args.years
                ? `Permanent registration pays for itself in ${breakEvenAnalysis.breakEvenYears} years (estimate)`
                : breakEvenAnalysis.breakEvenYears <= 3
                  ? `Permanent registration becomes cost-effective after ${breakEvenAnalysis.breakEvenYears} years (estimate)`
                  : `${args.years}-year lease is cost-effective for your use case (estimate)`,
          };
        }

        response.error = {
          code: "PRICING_API_UNAVAILABLE",
          message: "Live pricing unavailable, using estimates",
          suggestions: ["Try again later", "Check network connectivity"],
        };
      }

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return JSON.stringify({
        error: {
          code: "COST_CALCULATION_FAILED",
          message: `Cost calculation failed: ${errorMessage}`,
          suggestions: [
            "Verify name format",
            "Check network configuration",
            "Try again",
          ],
        },
        name: args.name,
        success: false,
      });
    }
  }

  /**
   * Calculate break-even analysis between lease and permanent options
   */
  private calculateBreakEvenAnalysis(
    leaseCostPerYear: number,
    permanentCost: number,
    currentLeaseDuration: number,
  ): {
    breakEvenYears: number;
    longTermSavingsARIO: string;
    shortTermBenefitARIO: string;
  } {
    const breakEvenYears = Math.ceil(permanentCost / leaseCostPerYear);
    const longTermSavings = Math.max(0, leaseCostPerYear * 5 - permanentCost);
    const shortTermBenefit = Math.max(
      0,
      permanentCost - leaseCostPerYear * currentLeaseDuration,
    );

    return {
      breakEvenYears,
      longTermSavingsARIO: this.winstonToARIO(longTermSavings),
      shortTermBenefitARIO: this.winstonToARIO(shortTermBenefit),
    };
  }

  /**
   * Get estimated base cost based on actual ar-io-sdk registration fee structure
   * Uses known pricing tiers from the registry for fallback when API is unavailable
   */
  private getEstimatedBaseCost(args: GetArnsTokenCostArgs): number {
    // Base costs per character length (in IO tokens, multiply by 1e12 for winston)
    const baseFees: Record<
      string,
      { lease: Record<string, number>; permabuy: number }
    > = {
      "1": {
        lease: {
          "1": 3723.408,
          "2": 4343.976,
          "3": 4964.544,
          "4": 5585.112,
          "5": 6205.68,
        },
        permabuy: 15514.2,
      },
      "2": {
        lease: {
          "1": 744.6816,
          "2": 868.7952,
          "3": 992.9088,
          "4": 1117.0224,
          "5": 1241.136,
        },
        permabuy: 3102.84,
      },
      "3": {
        lease: {
          "1": 74.46816,
          "2": 86.87952,
          "3": 99.29088,
          "4": 111.70224,
          "5": 124.1136,
        },
        permabuy: 310.284,
      },
      "4": {
        lease: {
          "1": 37.23408,
          "2": 43.43976,
          "3": 49.64544,
          "4": 55.85112,
          "5": 62.0568,
        },
        permabuy: 155.142,
      },
      "5": {
        lease: {
          "1": 9.30852,
          "2": 10.85994,
          "3": 12.41136,
          "4": 13.96278,
          "5": 15.5142,
        },
        permabuy: 38.7855,
      },
      "6": {
        lease: {
          "1": 5.585112,
          "2": 6.515964,
          "3": 7.446816,
          "4": 8.377668,
          "5": 9.30852,
        },
        permabuy: 23.2713,
      },
      "7": {
        lease: {
          "1": 2.9787264,
          "2": 3.4751808,
          "3": 3.9716352,
          "4": 4.4680896,
          "5": 4.964544,
        },
        permabuy: 12.41136,
      },
      "8": {
        lease: {
          "1": 1.861704,
          "2": 2.171988,
          "3": 2.482272,
          "4": 2.792556,
          "5": 3.10284,
        },
        permabuy: 7.7571,
      },
    };

    const nameLength = Math.min(args.name.length, 8);
    const lengthKey = nameLength.toString();
    const fees = baseFees[lengthKey] || baseFees["8"]; // Default to 8+ char pricing

    if (args.type === "permanent") {
      return Math.round(fees.permabuy * 1e12); // Convert to winston (1e12)
    } else if (args.type === "lease" && args.years) {
      const yearKey = args.years.toString();
      const leaseFee = fees.lease[yearKey] || fees.lease["1"];
      return Math.round(leaseFee * 1e12); // Convert to winston
    }

    return Math.round(fees.permabuy * 1e12); // Default to permanent
  }

  /**
   * Convert winston (1e12) to ARIO tokens for user-friendly display
   * ARIO has 6 decimal places, and 1 IO = 1,000,000 ARIO (1e6)
   */
  private winstonToARIO(winston: number | string): string {
    const winstonNum =
      typeof winston === "string" ? parseInt(winston) : winston;
    // Convert winston to IO, then IO to ARIO
    // 1 IO = 1e12 winston, 1 IO = 1e6 ARIO
    // So: winston / 1e12 * 1e6 = winston / 1e6
    const ario = winstonNum / 1e6;

    // Format with appropriate precision and k/M notation for readability
    if (ario >= 1000000) {
      return (ario / 1000000).toFixed(1) + "M"; // Millions
    } else if (ario >= 1000) {
      return (ario / 1000).toFixed(1) + "k"; // Thousands
    } else if (ario >= 100) {
      return ario.toFixed(0); // Whole numbers for hundreds
    } else if (ario >= 10) {
      return ario.toFixed(1); // 1 decimal for tens
    } else if (ario >= 1) {
      return ario.toFixed(2); // 2 decimals for single digits
    } else {
      return ario.toFixed(6); // Up to 6 decimals for small amounts
    }
  }
}
