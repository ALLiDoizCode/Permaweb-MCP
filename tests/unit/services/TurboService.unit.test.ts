import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TurboService } from "../../../src/services/TurboService.js";

// Mock external dependencies
vi.mock("@ardrive/turbo-sdk", () => ({
  ArweaveSigner: vi.fn(),
  TurboFactory: {
    authenticated: vi.fn(),
  },
}));

vi.mock("../../../src/constants.js", () => ({
  isMainnet: vi.fn(() => false),
}));

vi.mock("../../../src/mnemonic.js", () => ({
  getKeyFromMnemonic: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  access: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

describe("TurboService", () => {
  let service: TurboService;
  let mockTurboClient: any;
  let mockSigner: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock turbo client
    mockTurboClient = {
      getBalance: vi.fn(),
      getUploadCosts: vi.fn(),
      upload: vi.fn(),
      uploadFile: vi.fn(),
    };

    mockSigner = {};

    // Mock TurboFactory.authenticated to return our mock client
    const { TurboFactory } = vi.mocked(await import("@ardrive/turbo-sdk"));
    TurboFactory.authenticated.mockReturnValue(mockTurboClient);

    // Mock ArweaveSigner
    const { ArweaveSigner } = vi.mocked(await import("@ardrive/turbo-sdk"));
    ArweaveSigner.mockImplementation(() => mockSigner);

    // Mock getKeyFromMnemonic to return a fake wallet
    const { getKeyFromMnemonic } = vi.mocked(
      await import("../../../src/mnemonic.js"),
    );
    getKeyFromMnemonic.mockResolvedValue({
      d: "fake-d-value",
      kty: "RSA",
      n: "fake-n-value",
    });

    // Set mock environment variable
    process.env.SEED_PHRASE =
      "test phrase with twelve words for mnemonic seed generation testing purposes";

    service = new TurboService();
  });

  afterEach(() => {
    delete process.env.SEED_PHRASE;
  });

  describe("constructor", () => {
    it("should create service with default config", () => {
      const defaultService = new TurboService();
      expect(defaultService).toBeDefined();
    });

    it("should create service with custom config", () => {
      const config = {
        apiEndpoint: "https://custom-endpoint.com",
        network: "mainnet" as const,
        walletAddress: "test-address",
      };
      const customService = new TurboService(config);
      expect(customService).toBeDefined();
    });
  });

  describe("uploadFile", () => {
    it("should upload string data successfully", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        contentType: "text/plain",
        data: "Hello, world!",
        tags: [{ name: "Custom-Tag", value: "custom-value" }],
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("test-transaction-id");
      expect(result.winc).toBe("1000");
      expect(result.size).toBe(13); // "Hello, world!" length

      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "text/plain" },
            { name: "Custom-Tag", value: "custom-value" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should upload Buffer data successfully", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1500",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const testBuffer = Buffer.from("Binary data");
      const params = {
        contentType: "application/octet-stream",
        data: testBuffer,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("test-transaction-id");
      expect(result.size).toBe(testBuffer.length);

      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "application/octet-stream" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should upload ArrayBuffer data successfully", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "2000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const testArrayBuffer = new ArrayBuffer(16);
      const params = {
        data: testArrayBuffer,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("test-transaction-id");
      expect(result.size).toBe(16);
      expect(result.winc).toBe("2000");
    });

    it("should upload Readable stream successfully", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "2500",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const testData = "Stream data content";
      const readableStream = Readable.from([testData]);
      const params = {
        contentType: "text/plain",
        data: readableStream,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("test-transaction-id");
      expect(result.size).toBe(Buffer.from(testData).length);

      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "text/plain" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should use provided content type for JSON strings", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const jsonData = '{"key": "value"}';
      const params = {
        contentType: "application/json",
        data: jsonData,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "application/json" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should use provided content type for HTML strings", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const htmlData = "<html><body>Test</body></html>";
      const params = {
        contentType: "text/html",
        data: htmlData,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "text/html" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should default to text/plain for string data when no content type provided", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const data = "some data without specified content type";
      const params = {
        data: data,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
      expect(mockTurboClient.uploadFile).toHaveBeenCalledWith({
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "text/plain" },
            { name: "Content-Disposition", value: "inline" },
          ],
          target: undefined,
        },
        fileSizeFactory: expect.any(Function),
        fileStreamFactory: expect.any(Function),
      });
    });

    it("should handle upload failure", async () => {
      const uploadError = new Error("Network connection failed");
      mockTurboClient.uploadFile.mockRejectedValue(uploadError);

      const params = {
        data: "Test data",
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("UPLOAD_FAILED");
      expect(result.error?.message).toBe("Network connection failed");
      expect(result.error?.solutions).toContain(
        "Check your internet connection",
      );
    });

    it("should handle missing data validation", async () => {
      const params = {
        data: "" as any,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_DATA");
      expect(result.error?.message).toBe("Data is required for upload");
    });

    it("should handle file size validation", async () => {
      // Create a large buffer that exceeds the 10MB limit
      const largeData = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const params = {
        data: largeData,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("FILE_TOO_LARGE");
      expect(result.error?.message).toContain("exceeds maximum allowed size");
    });

    it("should handle wallet initialization failure", async () => {
      // Remove SEED_PHRASE to simulate missing wallet
      delete process.env.SEED_PHRASE;

      const params = {
        data: "Test data",
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("WALLET_NOT_FOUND");
      expect(result.error?.message).toBe("No wallet configuration found");
    });
  });

  describe("checkBalance", () => {
    it("should check balance successfully", async () => {
      const mockBalanceResult = {
        winc: "5000000000",
      };
      mockTurboClient.getBalance.mockResolvedValue(mockBalanceResult);

      const result = await service.checkBalance();

      expect(result.success).toBe(true);
      expect(result.balance).toBe("5000000000");
      expect(result.winc).toBe("5000000000");
    });

    it("should handle balance check failure", async () => {
      const balanceError = new Error("Service unavailable");
      mockTurboClient.getBalance.mockRejectedValue(balanceError);

      const result = await service.checkBalance();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("BALANCE_CHECK_FAILED");
      expect(result.error?.message).toBe("Service unavailable");
    });

    it("should handle wallet initialization failure for balance check", async () => {
      delete process.env.SEED_PHRASE;

      const result = await service.checkBalance();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("WALLET_NOT_FOUND");
    });
  });

  describe("getUploadCost", () => {
    it("should calculate upload cost for string data", async () => {
      const mockCostResult = {
        winc: "1000000",
      };
      mockTurboClient.getUploadCosts.mockResolvedValue(mockCostResult);

      const params = {
        data: "Test data for cost calculation",
      };

      const result = await service.getUploadCost(params);

      expect(result.success).toBe(true);
      expect(result.cost).toBe("1000000");
      expect(result.winc).toBe("1000000");
      expect(result.byteSize).toBe(Buffer.from(params.data).length);

      expect(mockTurboClient.getUploadCosts).toHaveBeenCalledWith({
        bytes: [Buffer.from(params.data).length],
      });
    });

    it("should calculate upload cost for Buffer data", async () => {
      const mockCostResult = {
        winc: "2000000",
      };
      mockTurboClient.getUploadCosts.mockResolvedValue(mockCostResult);

      const testBuffer = Buffer.from("Binary test data");
      const params = {
        data: testBuffer,
      };

      const result = await service.getUploadCost(params);

      expect(result.success).toBe(true);
      expect(result.byteSize).toBe(testBuffer.length);
    });

    it("should calculate upload cost for ArrayBuffer data", async () => {
      const mockCostResult = {
        winc: "3000000",
      };
      mockTurboClient.getUploadCosts.mockResolvedValue(mockCostResult);

      const testArrayBuffer = new ArrayBuffer(1024);
      const params = {
        data: testArrayBuffer,
      };

      const result = await service.getUploadCost(params);

      expect(result.success).toBe(true);
      expect(result.byteSize).toBe(1024);
    });

    it("should handle cost calculation failure", async () => {
      const costError = new Error("Cost service unavailable");
      mockTurboClient.getUploadCosts.mockRejectedValue(costError);

      const params = {
        data: "Test data",
      };

      const result = await service.getUploadCost(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("COST_CALCULATION_FAILED");
      expect(result.error?.message).toBe("Cost service unavailable");
    });
  });

  describe("private methods", () => {
    it("should handle client initialization with signer", async () => {
      // Set up the mock for this test
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        data: "Test initialization",
      };

      const result = await service.uploadFile(params);

      // Verify that the service successfully initializes
      expect(result.success).toBe(true);

      // Verify ArweaveSigner was created
      const { ArweaveSigner } = vi.mocked(await import("@ardrive/turbo-sdk"));
      expect(ArweaveSigner).toHaveBeenCalledWith({
        d: "fake-d-value",
        kty: "RSA",
        n: "fake-n-value",
      });

      // Verify TurboFactory.authenticated was called with signer and default token
      const { TurboFactory } = vi.mocked(await import("@ardrive/turbo-sdk"));
      expect(TurboFactory.authenticated).toHaveBeenCalledWith({
        signer: mockSigner,
        token: "arweave", // Default token type
      });
    });

    it("should handle wallet generation from mnemonic", async () => {
      const { getKeyFromMnemonic } = vi.mocked(
        await import("../../../src/mnemonic.js"),
      );

      const params = {
        data: "Test wallet generation",
      };

      await service.uploadFile(params);

      expect(getKeyFromMnemonic).toHaveBeenCalledWith(
        "test phrase with twelve words for mnemonic seed generation testing purposes",
      );
    });

    it("should handle client initialization failure", async () => {
      const { TurboFactory } = vi.mocked(await import("@ardrive/turbo-sdk"));
      TurboFactory.authenticated.mockImplementation(() => {
        throw new Error("TurboFactory initialization failed");
      });

      const params = {
        data: "Test initialization failure",
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CLIENT_INITIALIZATION_FAILED");
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle empty string data", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "100",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        data: "",
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_DATA");
    });

    it("should handle null data", async () => {
      const params = {
        data: null as any,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_DATA");
    });

    it("should handle undefined data", async () => {
      const params = {
        data: undefined as any,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_DATA");
    });

    it("should skip size validation for Readable streams", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      // Create a readable stream
      const readableStream = Readable.from(["test data"]);
      const params = {
        data: readableStream,
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(true);
    });

    it("should handle unknown error types", async () => {
      mockTurboClient.uploadFile.mockRejectedValue(
        "String error instead of Error object",
      );

      const params = {
        data: "Test data",
      };

      const result = await service.uploadFile(params);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Unknown upload error");
    });
  });

  describe("uploadFolder", () => {
    let mockFs: any;

    beforeEach(async () => {
      mockFs = vi.mocked(await import("fs/promises"));

      // Setup default successful fs mocks
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, size: 1024 });
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.js" },
      ]);
      mockFs.readFile.mockResolvedValue(Buffer.from("test file content"));
    });

    it("should upload folder successfully with basic params", async () => {
      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(result.uploadedFiles).toBe(2);
      expect(result.failedFiles).toBe(0);
      expect(result.manifestId).toBeDefined();
      expect(result.individualResults).toHaveLength(2);
    });

    it("should handle folder path validation failure", async () => {
      const params = {
        folderPath: "",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("MISSING_FOLDER_PATH");
      expect(result.totalFiles).toBe(0);
    });

    it("should handle directory not found", async () => {
      mockFs.access.mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      const params = {
        folderPath: "/nonexistent/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("DIRECTORY_ACCESS_FAILED");
      expect(result.totalFiles).toBe(0);
    });

    it("should handle path is not a directory", async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });

      const params = {
        folderPath: "/test/file.txt",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NOT_A_DIRECTORY");
      expect(result.totalFiles).toBe(0);
    });

    it("should handle empty folder", async () => {
      mockFs.readdir.mockResolvedValue([]);

      const params = {
        folderPath: "/test/empty-folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NO_FILES_FOUND");
      expect(result.totalFiles).toBe(0);
    });

    it("should filter files by include patterns", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.js" },
        { isDirectory: () => false, isFile: () => true, name: "file3.html" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        folderPath: "/test/folder",
        includePatterns: ["*.txt", "*.js"],
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2); // Only .txt and .js files
      expect(result.uploadedFiles).toBe(2);
    });

    it("should filter files by exclude patterns", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.js" },
        { isDirectory: () => true, isFile: () => false, name: "node_modules" },
        { isDirectory: () => true, isFile: () => false, name: ".git" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        excludePatterns: ["*.js"],
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(1); // Only .txt file
      expect(result.uploadedFiles).toBe(1);
    });

    it("should handle concurrent uploads configuration", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file3.txt" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        concurrentUploads: 2,
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(3);
      expect(result.uploadedFiles).toBe(3);
    });

    it("should handle invalid concurrent uploads limit", async () => {
      const params = {
        concurrentUploads: 25, // Exceeds limit of 20
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_CONCURRENT_UPLOADS");
      expect(result.totalFiles).toBe(0);
    });

    it("should handle max file size filtering", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "small.txt" },
        { isDirectory: () => false, isFile: () => true, name: "large.txt" },
      ]);

      // Mock different file sizes
      mockFs.stat.mockImplementation((filePath) => {
        if (filePath.includes("small.txt")) {
          return Promise.resolve({ isDirectory: () => true, size: 100 });
        } else if (filePath.includes("large.txt")) {
          return Promise.resolve({ isDirectory: () => true, size: 2000 });
        }
        return Promise.resolve({ isDirectory: () => true, size: 1024 });
      });

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        folderPath: "/test/folder",
        maxFileSize: 1000, // Only allow files up to 1000 bytes
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(1); // Only small.txt should be included
      expect(result.uploadedFiles).toBe(1);
    });

    it("should report progress during upload", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.txt" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const progressCallback = vi.fn();
      const params = {
        folderPath: "/test/folder",
        onProgress: progressCallback,
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(progressCallback).toHaveBeenCalled();

      // Check that progress was reported with correct structure
      const progressCalls = progressCallback.mock.calls;
      expect(progressCalls[0][0]).toMatchObject({
        failedFiles: expect.any(Number),
        individualResults: expect.any(Array),
        totalFiles: 2,
        uploadedFiles: expect.any(Number),
      });
    });

    it("should handle partial upload failures", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
        { isDirectory: () => false, isFile: () => true, name: "file2.txt" },
      ]);

      // Mock first upload success, second upload failure, then manifest upload success
      mockTurboClient.uploadFile
        .mockResolvedValueOnce({ id: "success-id", winc: "1000" })
        .mockRejectedValueOnce(new Error("Upload failed"))
        .mockResolvedValueOnce({ id: "manifest-id", winc: "500" }); // Manifest upload success

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false); // Overall failure due to partial failure
      expect(result.totalFiles).toBe(2);
      expect(result.uploadedFiles).toBe(1);
      expect(result.failedFiles).toBe(1);
      expect(result.manifestId).toBeDefined(); // Manifest should still be created for successful uploads
    });

    it("should handle manifest generation failure", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };

      // Mock successful file upload but manifest upload failure
      mockTurboClient.uploadFile
        .mockResolvedValueOnce(mockUploadResult) // File upload success
        .mockRejectedValueOnce(new Error("Manifest upload failed")); // Manifest upload failure

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true); // File uploads succeeded
      expect(result.totalFiles).toBe(1);
      expect(result.uploadedFiles).toBe(1);
      expect(result.manifestId).toBeUndefined(); // Manifest should be undefined due to failure
    });

    it("should handle recursive directory traversal", async () => {
      // Mock nested directory structure
      mockFs.readdir
        .mockResolvedValueOnce([
          { isDirectory: () => false, isFile: () => true, name: "file1.txt" },
          { isDirectory: () => true, isFile: () => false, name: "subfolder" },
        ])
        .mockResolvedValueOnce([
          { isDirectory: () => false, isFile: () => true, name: "file2.txt" },
        ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2); // Files from root and subfolder
      expect(result.uploadedFiles).toBe(2);
    });

    it("should generate manifest with correct structure", async () => {
      mockFs.readdir.mockResolvedValue([
        { isDirectory: () => false, isFile: () => true, name: "index.html" },
        { isDirectory: () => false, isFile: () => true, name: "style.css" },
      ]);

      const mockUploadResult = {
        id: "test-transaction-id",
        winc: "1000",
      };
      mockTurboClient.uploadFile.mockResolvedValue(mockUploadResult);

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(true);
      expect(result.manifestId).toBeDefined();

      // Verify that manifest upload was called with correct structure
      const manifestUploadCall = mockTurboClient.uploadFile.mock.calls.find(
        (call) =>
          call[0].dataItemOpts?.tags?.some(
            (tag: any) => tag.name === "Type" && tag.value === "manifest",
          ),
      );
      expect(manifestUploadCall).toBeDefined();

      if (manifestUploadCall) {
        // Extract the data from the fileStreamFactory
        const dataStream = manifestUploadCall[0].fileStreamFactory();
        const chunks = [];
        for await (const chunk of dataStream) {
          // chunk might be a string or buffer
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const manifestData = JSON.parse(Buffer.concat(chunks).toString());
        expect(manifestData.manifest).toBe("arweave/paths");
        expect(manifestData.version).toBe("0.1.0");
        expect(manifestData.paths).toBeDefined();
        expect(manifestData.index?.path).toBe("index.html"); // Should auto-detect index.html
      }
    });

    it("should handle wallet initialization failure", async () => {
      delete process.env.SEED_PHRASE;

      const params = {
        folderPath: "/test/folder",
      };

      const result = await service.uploadFolder(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("WALLET_NOT_FOUND");
      expect(result.totalFiles).toBe(0);
    });
  });
});
