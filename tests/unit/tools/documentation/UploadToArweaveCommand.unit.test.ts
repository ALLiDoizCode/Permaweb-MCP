import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { UploadToArweaveCommand } from "../../../../src/tools/documentation/commands/UploadToArweaveCommand.js";

// Mock TurboService
const mockUploadFile = vi.fn();
const mockGetTokenPriceForBytes = vi.fn();
vi.mock("../../../../src/services/TurboService.js", () => ({
  TurboService: vi.fn().mockImplementation(() => ({
    getTokenPriceForBytes: mockGetTokenPriceForBytes,
    uploadFile: mockUploadFile,
  })),
}));

describe("UploadToArweaveCommand", () => {
  let command: UploadToArweaveCommand;
  let mockContext: ToolContext;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock context
    mockContext = {} as ToolContext;

    // Create command instance
    command = new UploadToArweaveCommand(mockContext);

    // Setup temporary test directory
    tempDir = join(process.cwd(), "tests", "temp", "upload-test");
    await mkdir(tempDir, { recursive: true });
    testFilePath = join(tempDir, "test-file.txt");
    await writeFile(testFilePath, "Test file content for upload");

    // Reset mock function behavior
    mockGetTokenPriceForBytes.mockClear();
    mockUploadFile.mockClear();
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await rm(tempDir, { force: true, recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("successful upload scenarios", () => {
    it("should upload a file successfully with minimal parameters", async () => {
      // Mock successful upload
      mockUploadFile.mockResolvedValue({
        size: 29,
        success: true,
        transactionId: "test-transaction-id-123",
        winc: "1000",
      });

      const result = await command.execute({
        filePath: testFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe("test-transaction-id-123");
      expect(parsed.size).toBe(29);
      expect(parsed.winc).toBe("1000");
      expect(parsed.filePath).toBe(testFilePath);
      expect(parsed.url).toBe("https://arweave.net/test-transaction-id-123");

      expect(mockUploadFile).toHaveBeenCalledWith({
        contentType: "text/plain", // Auto-detected from .txt extension
        data: expect.any(Buffer),
        tags: undefined,
        target: undefined,
      });
    });

    it("should upload with custom content type and tags", async () => {
      mockUploadFile.mockResolvedValue({
        size: 29,
        success: true,
        transactionId: "test-transaction-id-456",
        winc: "1200",
      });

      const result = await command.execute({
        contentType: "text/plain",
        filePath: testFilePath,
        tags: [
          { name: "App-Name", value: "Test-App" },
          { name: "Version", value: "1.0.0" },
        ],
        target: "test-target-address",
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockUploadFile).toHaveBeenCalledWith({
        contentType: "text/plain",
        data: expect.any(Buffer),
        tags: [
          { name: "App-Name", value: "Test-App" },
          { name: "Version", value: "1.0.0" },
        ],
        target: "test-target-address",
      });
    });

    it("should handle JSON response formatting correctly", async () => {
      mockUploadFile.mockResolvedValue({
        size: 100,
        success: true,
        transactionId: "json-test-id",
        winc: "2000",
      });

      const result = await command.execute({
        filePath: testFilePath,
      });

      // Verify JSON structure
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("transactionId");
      expect(parsed).toHaveProperty("size");
      expect(parsed).toHaveProperty("winc");
      expect(parsed).toHaveProperty("filePath");
      expect(parsed).toHaveProperty("url");
    });
  });

  describe("error handling scenarios", () => {
    it("should handle file not found error", async () => {
      const nonExistentFile = join(tempDir, "nonexistent.txt");

      const result = await command.execute({
        filePath: nonExistentFile,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("FILE_ACCESS_DENIED");
      expect(parsed.error.message).toContain("Cannot access file");
      expect(parsed.error.solutions).toBeInstanceOf(Array);
      expect(parsed.error.solutions.length).toBeGreaterThan(0);
    });

    it("should handle directory instead of file error", async () => {
      const result = await command.execute({
        filePath: tempDir, // Pass directory instead of file
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("NOT_A_FILE");
      expect(parsed.error.message).toContain("not a regular file");
      expect(parsed.error.solutions).toContain(
        "Provide a path to a regular file, not a directory or special file",
      );
    });

    it("should handle file too large error", async () => {
      // Create a large test file (over 10MB)
      const largeFilePath = join(tempDir, "large-file.txt");
      const largeContent = "A".repeat(11 * 1024 * 1024); // 11MB
      await writeFile(largeFilePath, largeContent);

      const result = await command.execute({
        filePath: largeFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("FILE_TOO_LARGE");
      expect(parsed.error.message).toContain("exceeds maximum allowed size");
      expect(parsed.error.solutions).toContain(
        "Reduce file size to under 10MB",
      );
    });

    it("should handle TurboService upload failure", async () => {
      mockUploadFile.mockResolvedValue({
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: "Not enough credits in account",
          solutions: ["Add more credits to your account", "Check your balance"],
        },
        success: false,
      });

      const result = await command.execute({
        filePath: testFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("INSUFFICIENT_CREDITS");
      expect(parsed.error.message).toBe("Not enough credits in account");
      expect(parsed.error.solutions).toContain(
        "Add more credits to your account",
      );
    });

    it("should handle TurboService initialization errors", async () => {
      mockUploadFile.mockRejectedValue(
        new Error("Wallet initialization failed"),
      );

      const result = await command.execute({
        filePath: testFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("UPLOAD_ERROR");
      expect(parsed.error.message).toBe("Wallet initialization failed");
      expect(parsed.error.solutions).toContain(
        "Verify your SEED_PHRASE environment variable is set",
      );
    });
  });

  describe("parameter validation", () => {
    it("should validate required filePath parameter", async () => {
      // Test with schema validation (this would be caught by Zod before execute)
      const schema = command["parametersSchema"];
      const result = schema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("filePath");
        expect(result.error.issues[0].message).toContain("Required");
      }
    });

    it("should validate empty filePath parameter", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({ filePath: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("filePath");
      }
    });

    it("should validate tags parameter structure", async () => {
      const schema = command["parametersSchema"];

      // Test invalid tags structure
      const result = schema.safeParse({
        filePath: testFilePath,
        tags: [{ name: "", value: "test" }], // Empty name
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should accept valid parameters", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({
        contentType: "text/plain",
        filePath: testFilePath,
        tags: [{ name: "Type", value: "Test" }],
        target: "test-address",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Content Type Detection", () => {
    it("should auto-detect content type from file extension", async () => {
      // Test different file extensions
      const testCases = [
        { expectedType: "application/json", fileName: "test.json" },
        { expectedType: "text/html", fileName: "test.html" },
        { expectedType: "text/css", fileName: "test.css" },
        { expectedType: "application/javascript", fileName: "test.js" },
        { expectedType: "image/png", fileName: "test.png" },
        { expectedType: "application/pdf", fileName: "test.pdf" },
        { expectedType: "application/octet-stream", fileName: "unknown.xyz" },
      ];

      for (const { expectedType, fileName } of testCases) {
        const testFile = join(tempDir, fileName);
        await writeFile(testFile, "Test content");

        mockUploadFile.mockResolvedValue({
          size: 12,
          success: true,
          transactionId: `tx-${fileName}`,
          winc: "500",
        });

        await command.execute({
          filePath: testFile,
        });

        // Verify the correct content type was passed to TurboService
        expect(mockUploadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            contentType: expectedType,
          }),
        );

        mockUploadFile.mockClear();
      }
    });

    it("should respect user-provided content type over auto-detection", async () => {
      const testFile = join(tempDir, "test.txt");
      await writeFile(testFile, "Test content");

      mockUploadFile.mockResolvedValue({
        size: 12,
        success: true,
        transactionId: "custom-content-type-tx",
        winc: "500",
      });

      await command.execute({
        contentType: "application/custom", // User override
        filePath: testFile,
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "application/custom", // Should use user-provided type
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("should handle file read errors gracefully", async () => {
      // Create file then simulate read failure
      mockUploadFile.mockRejectedValue(
        new Error("File read error during upload"),
      );

      const result = await command.execute({
        filePath: testFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("UPLOAD_ERROR");
      expect(parsed.error.message).toContain("File read error");
    });

    it("should handle unexpected errors in upload process", async () => {
      // Simulate unexpected error during upload
      mockUploadFile.mockRejectedValue(new Error("Network connection lost"));

      const result = await command.execute({
        filePath: testFilePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("UPLOAD_ERROR");
      expect(parsed.error.message).toBe("Network connection lost");
      expect(parsed.error.solutions).toContain(
        "Check your internet connection",
      );
    });
  });

  describe("Payment Method Support", () => {
    it("should handle credits payment method (default)", async () => {
      mockUploadFile.mockResolvedValue({
        paymentMethod: "credits",
        size: 29,
        success: true,
        transactionId: "credits-tx-123",
        winc: "1000",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "credits",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.paymentMethod).toBe("credits");
      expect(parsed.tokenAmount).toBeUndefined();
    });

    it("should accept token payment method without tokenAmount parameter", async () => {
      // Test Zod schema validation - tokenAmount is no longer required
      const schema = command["parametersSchema"];
      const validationResult = schema.safeParse({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // tokenAmount is no longer required - it's auto-calculated
      });

      expect(validationResult.success).toBe(true);
    });

    it("should accept credits payment method", async () => {
      // Test Zod schema validation
      const schema = command["parametersSchema"];
      const validationResult = schema.safeParse({
        filePath: testFilePath,
        paymentMethod: "credits",
        // tokenAmount is no longer a parameter
      });

      expect(validationResult.success).toBe(true);
    });

    it("should handle successful token payment upload with auto-calculated amount", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "500000000000", // Auto-calculated required amount
      });

      mockUploadFile.mockResolvedValue({
        paymentMethod: "tokens",
        size: 29,
        success: true,
        transactionId: "token-tx-456",
        winc: "1000",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // tokenAmount is now auto-calculated, not provided by user
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.paymentMethod).toBe("tokens");
      expect(parsed.tokenAmount).toBe("500000000000"); // Should match the calculated amount
      expect(mockGetTokenPriceForBytes).toHaveBeenCalledWith({
        byteCount: 28, // File size (length of "Test file content for upload")
      });
    });
  });

  describe("Auto-Calculated Token Amount Validation", () => {
    it("should reject when calculated token amount is excessively large", async () => {
      // Mock a price calculation that returns an excessively large amount
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "2000000000000000", // Over 1000 AR limit
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("TOKEN_AMOUNT_TOO_LARGE");
      expect(parsed.error.solutions).toContain(
        "Reduce token amount to a reasonable value",
      );
    });

    it("should reject when calculated token amount is zero", async () => {
      // Mock a price calculation that returns zero
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "0",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("TOKEN_AMOUNT_TOO_SMALL");
    });

    it("should accept valid calculated token amounts", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "500000000000", // Valid amount (0.0005 AR)
      });

      mockUploadFile.mockResolvedValue({
        size: 29,
        success: true,
        transactionId: "valid-calc-tx",
        winc: "1000",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.tokenAmount).toBe("500000000000");
    });
  });

  describe("Price Calculation and Validation", () => {
    it("should handle price calculation failures", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        error: {
          message: "Network error during price calculation",
        },
        success: false,
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // No tokenAmount needed - it's calculated automatically
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("PRICE_CALCULATION_FAILED");
      expect(parsed.error.solutions).toContain(
        "Consider using 'credits' payment method as fallback",
      );
    });

    it("should handle price calculation timeouts", async () => {
      // Mock a hanging price calculation
      mockGetTokenPriceForBytes.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // No tokenAmount needed - it's calculated automatically
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("PRICE_CALCULATION_TIMEOUT");
      expect(parsed.error.solutions).toContain(
        "Check your internet connection and try again",
      );
    }, 35000); // Allow for timeout + buffer

    it("should use calculated token amount for upload", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "2000000000000", // Auto-calculated amount: 0.002 AR
      });

      mockUploadFile.mockResolvedValue({
        size: 29,
        success: true,
        transactionId: "calc-amount-tx",
        winc: "2000",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // Amount is automatically calculated from price
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.tokenAmount).toBe("2000000000000"); // Should use calculated amount
      expect(parsed.transactionId).toBe("calc-amount-tx");
    });

    it("should successfully upload with auto-calculated token amount", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        success: true,
        tokenAmount: "500000000000", // Auto-calculated: 0.0005 AR
      });

      mockUploadFile.mockResolvedValue({
        size: 29,
        success: true,
        transactionId: "auto-calc-token-tx",
        winc: "1000",
      });

      const result = await command.execute({
        filePath: testFilePath,
        paymentMethod: "tokens",
        // Amount automatically calculated - no user input needed
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe("auto-calc-token-tx");
      expect(parsed.tokenAmount).toBe("500000000000"); // Uses calculated amount
    });
  });
});
