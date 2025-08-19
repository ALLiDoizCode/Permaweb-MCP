import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADPProcessCommunicationService } from "../../../src/services/ADPProcessCommunicationService.js";
import { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";

// Mock external dependencies
vi.mock("../../../src/process.js", () => ({
  read: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../../src/services/DocumentationProtocolService.js", () => ({
  DocumentationProtocolService: {
    generateMessageTags: vi.fn(),
    parseInfoResponse: vi.fn(),
    validateParameters: vi.fn(),
  },
}));

describe("ADPProcessCommunicationService - Parameter Validation", () => {
  const mockKeyPair = { kty: "RSA" };
  const sessionId = "test_session_123";

  beforeEach(() => {
    vi.clearAllMocks();
    ADPProcessCommunicationService.clearCache();
  });

  describe("Parameter Validation Middleware", () => {
    it("should validate required parameters are present", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "address" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const parameters = {
        Quantity: 100,
        Target: "test-address-123",
      };

      // Use reflection to access private method for testing
      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when required parameters are missing", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "address" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const parameters = {
        Target: "test-address-123",
        // Quantity is missing
      };

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Required parameter 'Quantity'");
    });

    it("should validate parameter types correctly", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const parameters = {
        A: "definitely-not-a-number-at-all",
        B: 25,
      };

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(false);
      // Check for either direct parameter error or validation error
      const hasParameterAError = result.errors.some(
        (err) => err.includes("parameter 'A'") || err.includes("A"),
      );
      expect(hasParameterAError).toBe(true);
    });

    it("should provide suggested fixes for validation failures", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "address" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const parameters = {
        // Both parameters missing
      };

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(false);
      expect(result.suggestedFixes).toBeDefined();
      expect(result.suggestedFixes!.length).toBeGreaterThan(0);
      expect(result.suggestedFixes![0]).toContain("Target");
    });

    it("should validate address format correctly", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [{ name: "Target", required: true, type: "address" }],
      };

      const testCases = [
        { address: "valid-address-123", shouldBeValid: true },
        { address: "a", shouldBeValid: true }, // Minimum length
        { address: "a".repeat(43), shouldBeValid: true }, // Maximum length
        { address: "a".repeat(44), shouldBeValid: false }, // Too long
        { address: "", shouldBeValid: false }, // Too short
        { address: "invalid@address", shouldBeValid: false }, // Invalid characters
      ];

      for (const testCase of testCases) {
        const parameters = { Target: testCase.address };
        const validateMethod = (ADPProcessCommunicationService as any)
          .validateExtractedParameters;
        const result = await validateMethod.call(
          ADPProcessCommunicationService,
          sessionId,
          handler,
          parameters,
        );

        expect(result.valid).toBe(testCase.shouldBeValid);
        if (!testCase.shouldBeValid) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    });

    it("should validate number ranges correctly", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [{ name: "A", required: true, type: "number" }],
      };

      const testCases = [
        { number: 0, shouldBeValid: true },
        { number: 1000000, shouldBeValid: true },
        { number: -1000000, shouldBeValid: true },
        { number: 1e16, shouldBeValid: false }, // Too large
        { number: -1e16, shouldBeValid: false }, // Too small
        { number: Infinity, shouldBeValid: false }, // Not finite
        { number: NaN, shouldBeValid: false }, // Not a number
      ];

      for (const testCase of testCases) {
        const parameters = { A: testCase.number };
        const validateMethod = (ADPProcessCommunicationService as any)
          .validateExtractedParameters;
        const result = await validateMethod.call(
          ADPProcessCommunicationService,
          sessionId,
          handler,
          parameters,
        );

        expect(result.valid).toBe(testCase.shouldBeValid);
        if (!testCase.shouldBeValid) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    });

    it("should perform contract validation for mathematical operations", async () => {
      const handler: HandlerMetadata = {
        action: "divide",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      // Test division by zero
      const parameters = {
        A: 10,
        B: 0,
      };

      // Mock the contract validation to ensure it's called
      const contractValidationSpy = vi
        .spyOn(
          ADPProcessCommunicationService as any,
          "validateParameterContracts",
        )
        .mockReturnValue({
          errors: ["Division by zero is not allowed"],
          suggestedFixes: ["Ensure the divisor (B parameter) is not zero"],
          warnings: [],
        });

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((err) => err.includes("Division by zero")),
      ).toBe(true);
      expect(
        result.suggestedFixes!.some((fix) => fix.includes("divisor")),
      ).toBe(true);

      contractValidationSpy.mockRestore();
    });

    it("should warn about very large numbers", async () => {
      const handler: HandlerMetadata = {
        action: "add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const parameters = {
        A: 1e11, // Very large number
        B: 25,
      };

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(true); // Should be valid but with warnings
      expect(result.warnings).toBeDefined();
      expect(
        result.warnings!.some((warning) => warning.includes("precision")),
      ).toBe(true);
    });
  });

  describe("Parameter Type Coercion", () => {
    it("should coerce string numbers to numbers", () => {
      const coerceMethod = (ADPProcessCommunicationService as any)
        .coerceParameterType;
      const result = coerceMethod.call(
        ADPProcessCommunicationService,
        "123",
        "number",
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(123);
    });

    it("should coerce string booleans to booleans", () => {
      const coerceMethod = (ADPProcessCommunicationService as any)
        .coerceParameterType;

      const testCases = [
        { expected: true, input: "true" },
        { expected: false, input: "false" },
        { expected: true, input: "1" },
        { expected: false, input: "0" },
        { expected: true, input: "yes" },
        { expected: false, input: "no" },
      ];

      for (const testCase of testCases) {
        const result = coerceMethod.call(
          ADPProcessCommunicationService,
          testCase.input,
          "boolean",
        );
        expect(result.success).toBe(true);
        expect(result.value).toBe(testCase.expected);
      }
    });

    it("should handle coercion failures gracefully", () => {
      const coerceMethod = (ADPProcessCommunicationService as any)
        .coerceParameterType;
      const result = coerceMethod.call(
        ADPProcessCommunicationService,
        "not-a-number",
        "number",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot coerce");
    });
  });

  describe("Retry Mechanisms", () => {
    it("should try multiple extraction strategies", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const retryMethod = (ADPProcessCommunicationService as any)
        .extractParametersWithRetry;
      const result = await retryMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        "Add 15 and 25 together",
        handler,
      );

      expect(result.parameters).toBeDefined();
      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(result.strategiesUsed).toContain("primary");
    });

    it("should succeed on first attempt with clear parameters", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const retryMethod = (ADPProcessCommunicationService as any)
        .extractParametersWithRetry;
      const result = await retryMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        "add A=15 B=25",
        handler,
      );

      expect(result.parameters.A).toBe(15);
      expect(result.parameters.B).toBe(25);
      expect(result.retryAttempts).toBe(1); // Should succeed on first try
      expect(result.extractionErrors).toHaveLength(0);
    });

    it("should use fallback strategies for unclear parameters", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "string" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const retryMethod = (ADPProcessCommunicationService as any)
        .extractParametersWithRetry;
      // Force multiple extraction attempts by providing an unclear request
      // that won't match primary patterns well
      const result = await retryMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        "vague request with unclear meaning", // This should fail primary extraction
        handler,
      );

      // Should attempt multiple strategies for unclear parameters
      expect(result.retryAttempts).toBeGreaterThan(1);
      expect(result.strategiesUsed.length).toBeGreaterThan(1);
    });
  });

  describe("Contract Testing", () => {
    it("should validate parameter formats against handler expectations", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "address" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const parameters = {
        Quantity: 100,
        Target: "valid-address-123",
      };

      const contractMethod = (ADPProcessCommunicationService as any)
        .validateParameterContracts;
      const result = contractMethod.call(
        ADPProcessCommunicationService,
        handler,
        parameters,
      );

      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid address formats", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [{ name: "Target", required: true, type: "address" }],
      };

      const parameters = {
        Target: "invalid@address#format",
      };

      const contractMethod = (ADPProcessCommunicationService as any)
        .validateParameterContracts;
      const result = contractMethod.call(
        ADPProcessCommunicationService,
        handler,
        parameters,
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("invalid characters");
    });

    it("should warn about unusually short addresses", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [{ name: "Target", required: true, type: "address" }],
      };

      const parameters = {
        Target: "short",
      };

      const contractMethod = (ADPProcessCommunicationService as any)
        .validateParameterContracts;
      const result = contractMethod.call(
        ADPProcessCommunicationService,
        handler,
        parameters,
      );

      expect(
        result.warnings!.some((warning) => warning.includes("unusually short")),
      ).toBe(true);
    });
  });

  describe("Error Message Generation", () => {
    it("should generate specific error messages for different failure types", async () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "Target", required: true, type: "address" },
          { name: "Quantity", required: true, type: "number" },
        ],
      };

      const parameters = {
        Quantity: "not-a-number",
        Target: "", // Empty address
      };

      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      const result = await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some((err) => err.includes("Target"))).toBe(true);
      expect(result.errors.some((err) => err.includes("Quantity"))).toBe(true);
    });

    it("should categorize errors by validation step", () => {
      // This would test the error categorization system
      // Since we're testing private methods, this validates the error structure
      const errorContext = (ADPProcessCommunicationService as any)
        .createErrorContext;
      const context = errorContext.call(
        ADPProcessCommunicationService,
        "validation",
        "Parameter validation failed",
        sessionId,
        "test-process",
        "test request",
        Date.now(),
        { extractedParameters: {} },
      );

      expect(context.category).toBe("validation");
      expect(context.step).toBe("Parameter validation failed");
      expect(context.sessionId).toBe(sessionId);
    });
  });

  describe("Performance Testing", () => {
    it("should complete validation within reasonable time", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const parameters = { A: 15, B: 25 };

      const startTime = Date.now();
      const validateMethod = (ADPProcessCommunicationService as any)
        .validateExtractedParameters;
      await validateMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        handler,
        parameters,
      );
      const endTime = Date.now();

      // Validation should complete within 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle retry mechanisms without significant delay", async () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const startTime = Date.now();
      const retryMethod = (ADPProcessCommunicationService as any)
        .extractParametersWithRetry;
      await retryMethod.call(
        ADPProcessCommunicationService,
        sessionId,
        "add 15 and 25",
        handler,
      );
      const endTime = Date.now();

      // Should complete within 500ms even with retries
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});
