import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../../../../src/tools/core/index.js";

import { GetArnsTokenCostCommand } from "../../../../../src/tools/arns/commands/GetArnsTokenCostCommand.js";

// Mock ar-io-sdk dependencies
vi.mock("@ar.io/sdk/node", () => ({
  ARIO: {
    mainnet: vi.fn(),
    testnet: vi.fn(),
  },
}));

// Mock ArnsClientManager
vi.mock("../../../../../src/tools/arns/utils/ArnsClientManager.js", () => ({
  ArnsClientManager: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => ({})), // Return mock client
      getCurrentNetwork: vi.fn(() => "mainnet"),
      initializeClient: vi.fn(),
    })),
  },
}));

// Mock AutoSafeToolContext
vi.mock("../../../../../src/tools/core/index.js", async () => {
  const actual = await vi.importActual(
    "../../../../../src/tools/core/index.js",
  );
  return {
    ...actual,
    AutoSafeToolContext: {
      from: vi.fn(() => ({
        initializeAll: vi.fn(async () => ({ hubId: "test-hub-id" })),
      })),
    },
  };
});

describe("GetArnsTokenCostCommand", () => {
  let command: GetArnsTokenCostCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {} as ToolContext;
    command = new GetArnsTokenCostCommand(mockContext);
  });

  describe("Parameter Validation", () => {
    it("should validate lease type requires years parameter", async () => {
      const result = await command.execute({
        name: "testname",
        type: "lease",
        // Missing years parameter
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("Years parameter is required");
    });

    it("should validate name format and length", async () => {
      const result = await command.execute({
        name: "invalid_name!", // Invalid characters
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("Parameter validation failed");
    });

    it("should validate undername limits", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
        undernames: 200, // Above max limit
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("Parameter validation failed");
    });

    it("should accept valid parameters", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
        undernames: 50,
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.name).toBe("testname");
      expect(response.type).toBe("permanent");
      expect(response.undernames).toBe(50);
    });
  });

  describe("Pricing Calculations", () => {
    it("should calculate lease pricing for different durations", async () => {
      const result1 = await command.execute({
        name: "testname",
        type: "lease",
        years: 1,
      });

      const result5 = await command.execute({
        name: "testname",
        type: "lease",
        years: 5,
      });

      const response1 = JSON.parse(result1);
      const response5 = JSON.parse(result5);

      expect(response1.success).toBe(true);
      expect(response5.success).toBe(true);
      expect(parseInt(response5.pricing.baseCost)).toBeGreaterThan(
        parseInt(response1.pricing.baseCost),
      );
    });

    it("should calculate permanent registration cost", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.type).toBe("permanent");
      expect(response.pricing.baseCost).toBeDefined();
      expect(response.pricing.totalCost).toBeDefined();
    });

    it("should include undername pricing", async () => {
      const result10 = await command.execute({
        name: "testname",
        type: "permanent",
        undernames: 10, // Default
      });

      const result50 = await command.execute({
        name: "testname",
        type: "permanent",
        undernames: 50, // Extra undernames
      });

      const response10 = JSON.parse(result10);
      const response50 = JSON.parse(result50);

      expect(response10.success).toBe(true);
      expect(response50.success).toBe(true);
      expect(parseInt(response50.pricing.totalCost)).toBeGreaterThan(
        parseInt(response10.pricing.totalCost),
      );
      expect(response50.pricing.undernameFee).toBeDefined();
    });

    it("should handle different name lengths", async () => {
      const shortName = await command.execute({
        name: "ab", // 2 chars
        type: "permanent",
      });

      const longName = await command.execute({
        name: "verylongname", // 12 chars
        type: "permanent",
      });

      const shortResponse = JSON.parse(shortName);
      const longResponse = JSON.parse(longName);

      expect(shortResponse.success).toBe(true);
      expect(longResponse.success).toBe(true);
      expect(parseInt(shortResponse.pricing.baseCost)).toBeGreaterThan(
        parseInt(longResponse.pricing.baseCost),
      );
    });
  });

  describe("Network Configuration", () => {
    it("should use network parameter when provided", async () => {
      const result = await command.execute({
        name: "testname",
        network: "testnet",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.network).toBe("testnet");
    });

    it("should default to mainnet when no network specified", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.network).toBe("mainnet");
    });
  });

  describe("Error Handling", () => {
    it("should handle API failures with fallback estimates", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.pricing.isEstimate).toBe(true);
    });

    it("should provide meaningful error messages", async () => {
      // Test with invalid parameters to trigger validation error
      const result = await command.execute({
        name: "", // Empty name
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error?.message).toBeDefined();
      expect(response.error?.suggestions).toBeDefined();
    });
  });

  describe("Enhanced Cost Breakdown", () => {
    it("should include detailed cost breakdown in response", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
        undernames: 25,
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.pricing.breakdown).toBeDefined();
      expect(response.pricing.breakdown.baseCostARIO).toBeDefined();
      expect(response.pricing.breakdown.networkFeeARIO).toBeDefined();
      expect(response.pricing.breakdown.totalCostARIO).toBeDefined();
      expect(response.pricing.breakdown.demandFactor).toBeDefined();
      expect(response.pricing.breakdown.undernameFeeARIO).toBeDefined(); // Extra undernames
      expect(response.pricing.breakdown.costPerUndernameARIO).toBeDefined();
    });

    it("should include cost efficiency analysis for lease options", async () => {
      const result = await command.execute({
        name: "testname",
        type: "lease",
        years: 2,
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.comparison).toBeDefined();
      expect(response.comparison.costEfficiency).toBeDefined();
      expect(response.comparison.costEfficiency.breakEvenYears).toBeDefined();
      expect(response.comparison.costEfficiency.longTermSavings).toBeDefined();
      expect(response.comparison.costEfficiency.shortTermBenefit).toBeDefined();
      expect(response.pricing.breakdown.pricePerYearARIO).toBeDefined();
    });

    it("should format ARIO token amounts correctly", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.pricing.breakdown.baseCostARIO).toMatch(
        /^\d+(\.\d+)?[kM]?$/,
      ); // Number format with optional k/M suffix
      expect(response.pricing.breakdown.networkFeeARIO).toMatch(
        /^\d+(\.\d+)?[kM]?$/,
      );
      expect(response.pricing.breakdown.totalCostARIO).toMatch(
        /^\d+(\.\d+)?[kM]?$/,
      );
    });
  });

  describe("Response Format", () => {
    it("should return consistent JSON structure for success", async () => {
      const result = await command.execute({
        name: "testname",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response).toHaveProperty("success");
      expect(response).toHaveProperty("name");
      expect(response).toHaveProperty("type");
      expect(response).toHaveProperty("undernames");
      expect(response).toHaveProperty("network");
      expect(response).toHaveProperty("pricing");
      expect(response.pricing).toHaveProperty("baseCost");
      expect(response.pricing).toHaveProperty("networkFee");
      expect(response.pricing).toHaveProperty("totalCost");
      expect(response.pricing).toHaveProperty("isEstimate");
      expect(response.pricing).toHaveProperty("breakdown");
    });

    it("should return consistent JSON structure for errors", async () => {
      const result = await command.execute({
        name: "", // Invalid to trigger error
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response).toHaveProperty("success");
      expect(response).toHaveProperty("name");
      expect(response).toHaveProperty("error");
      expect(response.error).toHaveProperty("code");
      expect(response.error).toHaveProperty("message");
      expect(response.error).toHaveProperty("suggestions");
    });
  });
});
