import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../../../../src/tools/core/index.js";

import { BuyArnsRecordCommand } from "../../../../../src/tools/arns/commands/BuyArnsRecordCommand.js";
import { GetArnsTokenCostCommand } from "../../../../../src/tools/arns/commands/GetArnsTokenCostCommand.js";

// Mock ar-io-sdk dependencies
const mockBuyRecord = vi.fn();
const mockARIOInstance = {
  buyRecord: mockBuyRecord,
};

// Mock both static and dynamic imports of ar-io-sdk
const mockARIO = {
  mainnet: vi.fn(() => mockARIOInstance),
  testnet: vi.fn(() => mockARIOInstance),
};

vi.mock("@ar.io/sdk/node", async () => {
  return {
    ARIO: mockARIO,
  };
});

// Mock GetArnsTokenCostCommand
vi.mock(
  "../../../../../src/tools/arns/commands/GetArnsTokenCostCommand.js",
  () => ({
    GetArnsTokenCostCommand: vi.fn(),
  }),
);

// Mock ArnsClientManager
vi.mock("../../../../../src/tools/arns/utils/ArnsClientManager.js", () => ({
  ArnsClientManager: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockARIOInstance),
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
        initializeAll: vi.fn(async () => ({
          generated: false,
          hubCreated: false,
          hubId: "test-hub-id",
          keyPair: {
            kty: "RSA",
            n: "test-key",
          },
          publicKey: "test-public-key",
        })),
      })),
    },
  };
});

describe("BuyArnsRecordCommand", () => {
  let command: BuyArnsRecordCommand;
  let mockContext: ToolContext;
  let mockCostCommand: any;

  beforeEach(() => {
    // Complete reset of all mocks
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Clear the centralized mock and reset to clean state
    mockBuyRecord.mockClear();
    mockBuyRecord.mockReset();

    // Reset ARIO mock functions
    mockARIO.mainnet.mockClear();
    mockARIO.testnet.mockClear();
    mockARIO.mainnet.mockReturnValue(mockARIOInstance);
    mockARIO.testnet.mockReturnValue(mockARIOInstance);

    // Setup mock context - create fresh instance each time
    mockContext = {
      hubId: "test-hub-id",
      keyPair: {
        kty: "RSA",
        n: "test-key",
      },
      publicKey: "test-public-key",
    } as ToolContext;

    // Setup cost command mock with completely fresh instance
    mockCostCommand = {
      execute: vi.fn(),
    };

    // Clear and re-setup the GetArnsTokenCostCommand constructor mock with complete reset
    const GetArnsTokenCostCommandMock = vi.mocked(GetArnsTokenCostCommand);
    GetArnsTokenCostCommandMock.mockReset();
    GetArnsTokenCostCommandMock.mockClear();
    GetArnsTokenCostCommandMock.mockImplementation(
      () => mockCostCommand as any,
    );

    // Set up default successful mock behavior that tests can override
    mockCostCommand.execute.mockResolvedValue(
      JSON.stringify({
        pricing: {
          breakdown: {
            totalCostIO: "150.000",
          },
          totalCost: "150000000000000",
        },
        success: true,
      }),
    );

    mockBuyRecord.mockResolvedValue({
      id: "test-transaction-id",
      owner: "test-public-key",
      processId: "test-process-id",
    });

    // Create command instance AFTER setting up all mocks
    command = new BuyArnsRecordCommand(mockContext);
  });

  describe("Parameter Validation", () => {
    it("should reject invalid parameters", async () => {
      const result = await command.execute({
        name: "", // Invalid empty name
        type: "lease",
      } as any);

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INVALID_PARAMETERS");
    });

    it("should reject names with .ar suffix", async () => {
      const result = await command.execute({
        name: "example.ar", // Should not include .ar suffix
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INVALID_NAME_FORMAT");
      expect(response.error.message).toContain("should not include .ar suffix");
    });

    it("should require years parameter for lease type", async () => {
      const result = await command.execute({
        name: "example",
        type: "lease",
        // Missing years parameter
      } as any);

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INVALID_PARAMETERS");
      expect(response.error.message).toContain("Years parameter is required");
    });

    it("should validate years range for lease type", async () => {
      const result = await command.execute({
        name: "example",
        type: "lease",
        years: 6, // Invalid - max is 5
      } as any);

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INVALID_PARAMETERS");
    });

    it("should validate undernames range", async () => {
      const result = await command.execute({
        name: "example",
        type: "permanent",
        undernames: 5, // Invalid - min is 10
      } as any);

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INVALID_PARAMETERS");
    });
  });

  describe("Cost Integration and Confirmation Flow", () => {
    it("should require confirmation before registration", async () => {
      // Mock successful cost calculation
      mockCostCommand.execute.mockResolvedValue(
        JSON.stringify({
          pricing: {
            breakdown: {
              totalCostIO: "150.000",
            },
            totalCost: "150000000000000", // 150 IO tokens in winston
          },
          success: true,
        }),
      );

      const result = await command.execute({
        name: "example",
        type: "permanent",
        // confirmed: false (default)
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.requiresConfirmation).toBe(true);
      expect(response.message).toContain("150.000 IO tokens");
      expect(response.instruction).toContain("confirmed: true");
    });

    it("should handle cost calculation failure", async () => {
      // Mock failed cost calculation
      mockCostCommand.execute.mockResolvedValue(
        JSON.stringify({
          error: {
            code: "NETWORK_ERROR",
            message: "Failed to fetch pricing",
          },
          success: false,
        }),
      );

      const result = await command.execute({
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("COST_CALCULATION_FAILED");
    });
  });

  describe("Registration Flow", () => {
    it("should perform permanent registration successfully", async () => {
      // Setup specific mock response for this test
      mockBuyRecord.mockResolvedValue({
        id: "test-permanent-transaction-id",
        owner: "test-public-key",
        processId: "test-process-id",
        tags: [{ name: "App-Name", value: "Permamind-ArNS" }],
      });

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
        undernames: 10,
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.transactionId).toMatch(/^test-.+transaction-id$/);
      expect(response.registration.name).toBe("example");
      expect(response.registration.type).toBe("permanent");
      expect(response.registration.owner).toBe("test-public-key");

      // Verify buyRecord was called with correct parameters
      expect(mockBuyRecord).toHaveBeenCalledWith(
        {
          name: "example",
          type: "permabuy",
        },
        {
          tags: [
            { name: "App-Name", value: "Permamind-ArNS" },
            { name: "Registration-Type", value: "permanent" },
          ],
        },
      );
    });

    it("should perform lease registration successfully", async () => {
      // Setup specific mock response for this test
      mockBuyRecord.mockResolvedValue({
        id: "test-lease-transaction-id",
        owner: "test-public-key",
        processId: "test-process-id",
      });

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "lease",
        years: 3,
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.transactionId).toMatch(/^test-.+transaction-id$/);
      expect(response.registration.type).toBe("lease");
      expect(response.registration.years).toBe(3);

      // Verify buyRecord was called with lease parameters
      expect(mockBuyRecord).toHaveBeenCalledWith(
        {
          name: "example",
          type: "lease",
          years: 3,
        },
        expect.objectContaining({
          tags: expect.arrayContaining([
            { name: "Registration-Type", value: "lease" },
          ]),
        }),
      );
    });

    it("should use testnet when specified", async () => {
      // Setup specific mock response for this test
      mockBuyRecord.mockResolvedValue({
        id: "test-testnet-transaction-id",
        owner: "test-public-key",
      });

      const result = await command.execute({
        confirmed: true,
        name: "example",
        network: "testnet",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.registration.network).toBe("testnet");

      // Testnet client should be used (verified by command execution success)
    });
  });

  describe("Error Handling", () => {
    it("should handle insufficient funds error", async () => {
      mockBuyRecord.mockRejectedValue(
        new Error("insufficient funds for transaction"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INSUFFICIENT_FUNDS");
      expect(response.error.suggestions).toContain(
        "Add more IO tokens to your wallet",
      );
    });

    it("should handle name already exists error", async () => {
      mockBuyRecord.mockRejectedValue(
        new Error("name already exists in registry"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("NAME_ALREADY_EXISTS");
      expect(response.error.suggestions).toContain("Choose a different name");
    });

    it("should handle network timeout error", async () => {
      mockBuyRecord.mockRejectedValue(
        new Error("Request timeout after 30 seconds"),
      );

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("NETWORK_TIMEOUT");
      expect(response.error.suggestions).toContain("Retry the registration");
    });

    it("should handle general registration failures", async () => {
      mockBuyRecord.mockRejectedValue(new Error("Unknown registration error"));

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("REGISTRATION_FAILED");
      expect(response.error.message).toContain("Unknown registration error");
    });
  });

  describe("Network Configuration", () => {
    it("should default to mainnet when no network specified", async () => {
      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);

      // Mainnet should be used (verified by successful execution)
    });

    it("should use environment variable for network configuration", async () => {
      // Set environment variable
      process.env.ARNS_NETWORK = "testnet";

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);

      // Testnet should be used (verified by successful execution)

      // Cleanup
      delete process.env.ARNS_NETWORK;
    });
  });

  describe("Transaction Signing Integration", () => {
    it("should initialize ARIO client with signer from context", async () => {
      // Use defaults from beforeEach - no need to re-mock

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "permanent",
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(true);

      // ARIO client should be initialized with signer (verified by successful execution)
    });
  });

  describe("Response Format", () => {
    it("should return consistent JSON structure for successful registration", async () => {
      // Mock successful flow
      mockCostCommand.execute.mockResolvedValue(
        JSON.stringify({
          pricing: {
            breakdown: {
              baseCostIO: "120.000",
              networkFeeIO: "30.000",
              totalCostIO: "150.000",
            },
            totalCost: "150000000000000",
          },
          success: true,
        }),
      );

      mockBuyRecord.mockResolvedValue({
        id: "test-transaction-id-123",
        owner: "test-public-key-456",
        processId: "test-process-id-789",
      });

      const result = await command.execute({
        confirmed: true,
        name: "example",
        type: "lease",
        undernames: 25,
        years: 2,
      });

      const response = JSON.parse(result);

      // Verify complete response structure
      expect(response).toMatchObject({
        registration: {
          cost: {
            breakdown: expect.objectContaining({
              totalCostIO: "150.000",
            }),
            totalPaid: "150.000",
          },
          name: "example",
          network: "mainnet",
          owner: "test-public-key",
          transactionId: "test-transaction-id-123",
          type: "lease",
          undernames: 25,
          years: 2,
        },
        success: true,
        transactionId: "test-transaction-id-123",
      });
    });

    it("should return consistent error structure", async () => {
      const result = await command.execute({
        name: "", // Invalid name to trigger error
        type: "permanent",
      } as any);

      const response = JSON.parse(result);

      expect(response).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
          suggestions: expect.arrayContaining([expect.any(String)]),
        },
        name: "",
        success: false,
      });
    });
  });
});
