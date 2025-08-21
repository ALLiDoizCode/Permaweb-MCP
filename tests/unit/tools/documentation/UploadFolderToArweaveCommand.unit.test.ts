import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { UploadFolderToArweaveCommand } from "../../../../src/tools/documentation/commands/UploadFolderToArweaveCommand.js";

// Mock TurboService
const mockUploadFolder = vi.fn();
const mockTopUpWithTokens = vi.fn();
const mockCollectFiles = vi.fn();
const mockGetTokenPriceForBytes = vi.fn();
vi.mock("../../../../src/services/TurboService.js", () => ({
  TurboService: vi.fn().mockImplementation(() => ({
    collectFiles: mockCollectFiles,
    getTokenPriceForBytes: mockGetTokenPriceForBytes,
    topUpWithTokens: mockTopUpWithTokens,
    uploadFolder: mockUploadFolder,
  })),
}));

describe("UploadFolderToArweaveCommand", () => {
  let command: UploadFolderToArweaveCommand;
  let mockContext: ToolContext;
  let tempDir: string;
  let testFolderPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock context
    mockContext = {} as ToolContext;

    // Create command instance
    command = new UploadFolderToArweaveCommand(mockContext);

    // Setup temporary test directory structure
    tempDir = join(process.cwd(), "tests", "temp", "folder-upload-test");
    testFolderPath = join(tempDir, "test-folder");
    await mkdir(testFolderPath, { recursive: true });

    // Create test files
    await writeFile(
      join(testFolderPath, "index.html"),
      "<html><head><title>Test</title></head><body><h1>Test</h1></body></html>",
    );
    await writeFile(
      join(testFolderPath, "style.css"),
      "body { font-family: Arial; }",
    );
    await writeFile(join(testFolderPath, "script.js"), "console.log('test');");
    await writeFile(join(testFolderPath, "data.json"), '{"test": "data"}');

    // Reset mock function behavior
    mockUploadFolder.mockClear();
    mockTopUpWithTokens.mockClear();
    mockCollectFiles.mockClear();
    mockGetTokenPriceForBytes.mockClear();

    // Set up default mock behaviors for tokens payment method (default)
    mockCollectFiles.mockResolvedValue({
      files: [
        { filePath: "index.html", relativePath: "index.html", size: 500 },
        { filePath: "style.css", relativePath: "style.css", size: 200 },
        { filePath: "script.js", relativePath: "script.js", size: 100 },
        { filePath: "data.json", relativePath: "data.json", size: 50 },
      ],
      success: true,
    });

    mockGetTokenPriceForBytes.mockResolvedValue({
      success: true,
      tokenAmount: "1000000000000", // 0.001 AR in winston
      tokenType: "arweave",
      wincAmount: "850000",
    });

    mockTopUpWithTokens.mockResolvedValue({
      success: true,
    });
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
    it("should upload a folder successfully with minimal parameters", async () => {
      // Mock successful folder upload
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          {
            filePath: "index.html",
            status: "completed",
            transactionId: "html-tx-id",
          },
          {
            filePath: "style.css",
            status: "completed",
            transactionId: "css-tx-id",
          },
          {
            filePath: "script.js",
            status: "completed",
            transactionId: "js-tx-id",
          },
          {
            filePath: "data.json",
            status: "completed",
            transactionId: "json-tx-id",
          },
        ],
        manifestId: "manifest-transaction-id-123",
        success: true,
        totalFiles: 4,
        totalSize: 1500,
        uploadedFiles: 4,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.manifestId).toBe("manifest-transaction-id-123");
      expect(parsed.manifestUrl).toBe(
        "https://arweave.net/manifest-transaction-id-123",
      );
      expect(parsed.gatewayUrl).toBe(
        "https://manifest-transaction-id-123.arweave.net",
      );
      expect(parsed.totalFiles).toBe(4);
      expect(parsed.uploadedFiles).toBe(4);
      expect(parsed.failedFiles).toBe(0);
      expect(parsed.folderPath).toBe(testFolderPath);
      expect(parsed.individualResults).toHaveLength(4);

      expect(mockUploadFolder).toHaveBeenCalledWith({
        concurrentUploads: 5,
        excludePatterns: undefined,
        folderPath: testFolderPath,
        includePatterns: undefined,
        onProgress: expect.any(Function),
        tags: undefined,
      });
    });

    it("should upload with custom parameters", async () => {
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          {
            filePath: "index.html",
            status: "completed",
            transactionId: "custom-html-tx",
          },
          {
            filePath: "style.css",
            status: "completed",
            transactionId: "custom-css-tx",
          },
        ],
        manifestId: "custom-manifest-id",
        success: true,
        totalFiles: 2,
        totalSize: 800,
        uploadedFiles: 2,
      });

      const result = await command.execute({
        concurrentUploads: 10,
        excludePatterns: ["*.tmp", "*.log"],
        folderPath: testFolderPath,
        includePatterns: ["*.html", "*.css"],
        tags: [
          { name: "App-Name", value: "Test-Website" },
          { name: "Version", value: "1.0.0" },
        ],
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockUploadFolder).toHaveBeenCalledWith({
        concurrentUploads: 10,
        excludePatterns: ["*.tmp", "*.log"],
        folderPath: testFolderPath,
        includePatterns: ["*.html", "*.css"],
        onProgress: expect.any(Function),
        tags: [
          { name: "App-Name", value: "Test-Website" },
          { name: "Version", value: "1.0.0" },
        ],
      });
    });

    it("should handle progress reporting correctly", async () => {
      let progressCallback: any;
      mockUploadFolder.mockImplementation((params: any) => {
        progressCallback = params.onProgress;
        return Promise.resolve({
          failedFiles: 0,
          individualResults: [
            {
              filePath: "file1.txt",
              status: "completed",
              transactionId: "tx1",
            },
            {
              filePath: "file2.txt",
              status: "completed",
              transactionId: "tx2",
            },
          ],
          manifestId: "progress-test-manifest",
          success: true,
          totalFiles: 2,
          totalSize: 500,
          uploadedFiles: 2,
        });
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      // Verify progress callback was passed
      expect(progressCallback).toBeDefined();
      expect(typeof progressCallback).toBe("function");

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe("error handling scenarios", () => {
    it("should handle folder not found error", async () => {
      const nonExistentFolder = join(tempDir, "nonexistent-folder");

      const result = await command.execute({
        folderPath: nonExistentFolder,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("FOLDER_ACCESS_DENIED");
      expect(parsed.error.message).toContain("Cannot access folder");
      expect(parsed.error.solutions).toBeInstanceOf(Array);
      expect(parsed.error.solutions.length).toBeGreaterThan(0);
    });

    it("should handle file instead of directory error", async () => {
      // Create a file instead of directory
      const filePath = join(tempDir, "not-a-directory.txt");
      await writeFile(filePath, "content");

      const result = await command.execute({
        folderPath: filePath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("NOT_A_DIRECTORY");
      expect(parsed.error.message).toContain("not a directory");
      expect(parsed.error.solutions).toContain(
        "Provide a path to a directory, not a file",
      );
    });

    it("should handle TurboService folder upload failure", async () => {
      mockUploadFolder.mockResolvedValue({
        error: {
          code: "NO_FILES_FOUND",
          message: "No files found matching criteria",
          solutions: [
            "Check your include/exclude patterns",
            "Verify the folder contains files",
          ],
        },
        failedFiles: 0,
        individualResults: [],
        success: false,
        totalFiles: 0,
        uploadedFiles: 0,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("NO_FILES_FOUND");
      expect(parsed.error.message).toBe("No files found matching criteria");
      expect(parsed.error.solutions).toContain(
        "Check your include/exclude patterns",
      );
    });

    it("should handle partial upload failures with progress summary", async () => {
      const progressData = {
        currentFile: "failed-file.txt",
        failedFiles: 2,
        individualResults: [
          { filePath: "file1.txt", status: "completed", transactionId: "tx1" },
          { filePath: "file2.txt", status: "completed", transactionId: "tx2" },
          { error: "Upload timeout", filePath: "file3.txt", status: "failed" },
          { error: "Network error", filePath: "file4.txt", status: "failed" },
        ],
        totalFiles: 4,
        uploadedFiles: 2,
      };

      let progressCallback: any;
      mockUploadFolder.mockImplementation((params: any) => {
        progressCallback = params.onProgress;
        // Simulate progress reporting
        if (progressCallback) {
          progressCallback(progressData);
        }
        return Promise.resolve({
          error: {
            code: "PARTIAL_UPLOAD_FAILURE",
            message: "Some files failed to upload",
          },
          failedFiles: 2,
          individualResults: progressData.individualResults,
          success: false,
          totalFiles: 4,
          uploadedFiles: 2,
        });
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("PARTIAL_UPLOAD_FAILURE");
      expect(parsed.progressSummary).toBeDefined();
      expect(parsed.progressSummary.totalFiles).toBe(4);
      expect(parsed.progressSummary.uploadedFiles).toBe(2);
      expect(parsed.progressSummary.failedFiles).toBe(2);
    });

    it("should handle TurboService exceptions", async () => {
      mockUploadFolder.mockRejectedValue(new Error("Unexpected service error"));

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("FOLDER_UPLOAD_ERROR");
      expect(parsed.error.message).toBe("Unexpected service error");
      expect(parsed.error.solutions).toContain(
        "Check your internet connection",
      );
    });
  });

  describe("parameter validation", () => {
    it("should validate required folderPath parameter", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("folderPath");
        expect(result.error.issues[0].message).toContain("Required");
      }
    });

    it("should validate empty folderPath parameter", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({ folderPath: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("folderPath");
      }
    });

    it("should validate concurrentUploads range", async () => {
      const schema = command["parametersSchema"];

      // Test too low
      const resultLow = schema.safeParse({
        concurrentUploads: 0,
        folderPath: testFolderPath,
      });
      expect(resultLow.success).toBe(false);

      // Test too high
      const resultHigh = schema.safeParse({
        concurrentUploads: 25,
        folderPath: testFolderPath,
      });
      expect(resultHigh.success).toBe(false);

      // Test valid range
      const resultValid = schema.safeParse({
        concurrentUploads: 10,
        folderPath: testFolderPath,
      });
      expect(resultValid.success).toBe(true);
    });

    it("should validate tags parameter structure", async () => {
      const schema = command["parametersSchema"];

      // Test invalid tags structure
      const result = schema.safeParse({
        folderPath: testFolderPath,
        tags: [{ name: "", value: "test" }], // Empty name
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should set default values correctly", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({
        folderPath: testFolderPath,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.concurrentUploads).toBe(5); // Default value
      }
    });

    it("should accept valid parameters with all options", async () => {
      const schema = command["parametersSchema"];
      const result = schema.safeParse({
        concurrentUploads: 3,
        excludePatterns: ["*.tmp"],
        folderPath: testFolderPath,
        includePatterns: ["*.html", "*.css"],
        tags: [{ name: "Type", value: "Website" }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("response format consistency", () => {
    it("should return consistent JSON structure for success", async () => {
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          { filePath: "test.txt", status: "completed", transactionId: "tx1" },
        ],
        manifestId: "test-manifest",
        success: true,
        totalFiles: 1,
        totalSize: 100,
        uploadedFiles: 1,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("manifestId");
      expect(parsed).toHaveProperty("manifestUrl");
      expect(parsed).toHaveProperty("gatewayUrl");
      expect(parsed).toHaveProperty("totalFiles");
      expect(parsed).toHaveProperty("uploadedFiles");
      expect(parsed).toHaveProperty("failedFiles");
      expect(parsed).toHaveProperty("totalSize");
      expect(parsed).toHaveProperty("individualResults");
      expect(parsed).toHaveProperty("folderPath");
    });

    it("should return consistent JSON structure for errors", async () => {
      const result = await command.execute({
        folderPath: "/nonexistent/path",
      });

      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("success", false);
      expect(parsed).toHaveProperty("error");
      expect(parsed.error).toHaveProperty("code");
      expect(parsed.error).toHaveProperty("message");
      expect(parsed.error).toHaveProperty("solutions");
      expect(Array.isArray(parsed.error.solutions)).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle empty folder gracefully", async () => {
      // Create empty folder
      const emptyFolderPath = join(tempDir, "empty-folder");
      await mkdir(emptyFolderPath);

      mockUploadFolder.mockResolvedValue({
        error: {
          code: "NO_FILES_FOUND",
          message: "No files found matching the specified criteria",
          solutions: [
            "Check your include/exclude patterns",
            "Verify the folder contains files",
            "Ensure file size limits are appropriate",
          ],
        },
        failedFiles: 0,
        individualResults: [],
        success: false,
        totalFiles: 0,
        uploadedFiles: 0,
      });

      const result = await command.execute({
        folderPath: emptyFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("NO_FILES_FOUND");
    });

    it("should handle manifest generation without index", async () => {
      // Mock successful upload without index file
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          {
            filePath: "style.css",
            status: "completed",
            transactionId: "css-tx",
          },
          {
            filePath: "script.js",
            status: "completed",
            transactionId: "js-tx",
          },
        ],
        manifestId: "no-index-manifest",
        success: true,
        totalFiles: 2,
        totalSize: 500,
        uploadedFiles: 2,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.manifestId).toBe("no-index-manifest");
      expect(parsed.manifestUrl).toBe("https://arweave.net/no-index-manifest");
    });
  });

  describe("Payment Method Support", () => {
    it("should handle credits payment method (default)", async () => {
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          { filePath: "index.html", status: "completed", transactionId: "tx1" },
          { filePath: "style.css", status: "completed", transactionId: "tx2" },
          { filePath: "script.js", status: "completed", transactionId: "tx3" },
          { filePath: "data.json", status: "completed", transactionId: "tx4" },
        ],
        manifestId: "credits-manifest-123",
        success: true,
        totalFiles: 4,
        totalSize: 1500,
        uploadedFiles: 4,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "credits",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.paymentMethod).toBe("credits");
      expect(parsed.tokenAmount).toBeUndefined();
      expect(parsed.manifestId).toBe("credits-manifest-123");
      expect(mockTopUpWithTokens).not.toHaveBeenCalled();
    });

    it("should accept tokens payment method without tokenAmount (auto-calculated)", async () => {
      // Test Zod schema validation - tokenAmount is now auto-calculated
      const schema = command["parametersSchema"];
      const validationResult = schema.safeParse({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        // tokenAmount is auto-calculated, not required
      });

      expect(validationResult.success).toBe(true);
      if (validationResult.success) {
        expect(validationResult.data.paymentMethod).toBe("tokens");
        expect(validationResult.data.folderPath).toBe(testFolderPath);
      }
    });

    it("should handle successful token payment folder upload", async () => {
      mockTopUpWithTokens.mockResolvedValue({
        success: true,
        transactionId: "topup-tx-789",
        wincAmount: "5000",
      });

      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [
          {
            filePath: "index.html",
            status: "completed",
            transactionId: "token-tx1",
          },
          {
            filePath: "style.css",
            status: "completed",
            transactionId: "token-tx2",
          },
          {
            filePath: "script.js",
            status: "completed",
            transactionId: "token-tx3",
          },
          {
            filePath: "data.json",
            status: "completed",
            transactionId: "token-tx4",
          },
        ],
        manifestId: "token-manifest-456",
        success: true,
        totalFiles: 4,
        totalSize: 1500,
        uploadedFiles: 4,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        // tokenAmount is now auto-calculated, not passed as parameter
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.paymentMethod).toBe("tokens");
      expect(parsed.tokenAmount).toBe("1000000000000"); // Auto-calculated from mock
      expect(parsed.manifestId).toBe("token-manifest-456");
      expect(mockTopUpWithTokens).toHaveBeenCalledWith({
        tokenAmount: "1000000000000", // Auto-calculated value from mock
      });
    });
  });

  describe("Token Auto-Calculation", () => {
    it("should handle empty folder with token payment", async () => {
      // Mock empty folder scenario
      mockCollectFiles.mockResolvedValue({
        files: [], // No files found
        success: true,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("EMPTY_FOLDER");
      expect(parsed.error.solutions).toContain(
        "Ensure the folder contains files",
      );
    });

    it("should handle price calculation failure during auto-calculation", async () => {
      mockGetTokenPriceForBytes.mockResolvedValue({
        error: { message: "Network error during price calculation" },
        success: false,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("PRICE_CALCULATION_FAILED");
      expect(parsed.error.solutions).toContain(
        "Consider using 'credits' payment method as fallback",
      );
    });

    it("should successfully auto-calculate token amount for valid folder", async () => {
      mockUploadFolder.mockResolvedValue({
        failedFiles: 0,
        individualResults: [],
        manifestId: "auto-calc-manifest",
        success: true,
        totalFiles: 4,
        totalSize: 1500,
        uploadedFiles: 4,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.tokenAmount).toBe("1000000000000"); // Auto-calculated value
      expect(mockCollectFiles).toHaveBeenCalledWith(testFolderPath, [], []);
      expect(mockGetTokenPriceForBytes).toHaveBeenCalledWith({
        byteCount: 850, // Total folder size from mock (500+200+100+50)
      });
      expect(mockTopUpWithTokens).toHaveBeenCalledWith({
        tokenAmount: "1000000000000",
      });
    });

    it("should handle folder scan failure during auto-calculation", async () => {
      mockCollectFiles.mockResolvedValue({
        error: { message: "Permission denied reading folder" },
        success: false,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("FOLDER_SCAN_FAILED");
      expect(parsed.error.solutions).toContain(
        "Check that the folder exists and is readable",
      );
    });
  });

  describe("Token Top-Up Handling", () => {
    it("should handle token top-up failures", async () => {
      mockTopUpWithTokens.mockResolvedValue({
        error: {
          message: "Insufficient AR tokens in wallet",
        },
        success: false,
      });

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        tokenAmount: "1000000000000",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("TOKEN_TOP_UP_FAILED");
      expect(parsed.error.message).toContain(
        "Insufficient AR tokens in wallet",
      );
      expect(parsed.error.solutions).toContain(
        "Verify you have sufficient AR tokens in your wallet",
      );
    });

    it("should handle token top-up timeouts", async () => {
      // Mock a hanging top-up operation
      mockTopUpWithTokens.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const result = await command.execute({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        tokenAmount: "1000000000000",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("TOKEN_TOP_UP_TIMEOUT");
      expect(parsed.error.solutions).toContain(
        "Check your internet connection and try again",
      );
    }, 65000); // Allow for timeout + buffer
  });

  describe("Parameter Validation with Payment Methods", () => {
    it("should validate payment method accepts both credits and tokens", async () => {
      const schema = command["parametersSchema"];

      // Test credits payment method
      const creditsResult = schema.safeParse({
        folderPath: testFolderPath,
        paymentMethod: "credits",
      });

      // Test tokens payment method (auto-calculates amount)
      const tokensResult = schema.safeParse({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
      });

      expect(creditsResult.success).toBe(true);
      expect(tokensResult.success).toBe(true);
    });

    it("should validate tokens payment method with auto-calculation", async () => {
      const schema = command["parametersSchema"];

      const result = schema.safeParse({
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        // tokenAmount is auto-calculated in execute()
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentMethod).toBe("tokens");
        expect(result.data.folderPath).toBe(testFolderPath);
      }
    });

    it("should accept valid token payment parameters", async () => {
      const schema = command["parametersSchema"];

      const result = schema.safeParse({
        concurrentUploads: 10,
        folderPath: testFolderPath,
        paymentMethod: "tokens",
        tags: [{ name: "Type", value: "Test" }],
        tokenAmount: "1000000000000",
      });

      expect(result.success).toBe(true);
    });
  });
});
