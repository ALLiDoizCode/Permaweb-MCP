import { mkdir, rm, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { McpClientTestContext } from "../helpers/mcp-client-test-helper.js";

import {
  cleanupMcpTestEnvironment,
  createMcpTestEnvironment,
  testToolCall,
  waitForServerReady,
} from "../helpers/mcp-client-test-helper.js";

/**
 * Media Tools Integration Tests
 *
 * Tests the complete media file upload and management workflow through real MCP client-server communication.
 *
 * These tests validate:
 * - File upload with validation and metadata
 * - File listing with filtering capabilities
 * - File retrieval with metadata
 * - Error handling for invalid files and operations
 * - Integration with LoadNetworkStorageService (mocked)
 */

// Mock LoadNetworkStorageService for testing
vi.mock("../../src/services/LoadNetworkStorageService.js", () => ({
  LoadNetworkStorageService: vi.fn().mockImplementation(() => ({
    downloadFile: vi.fn().mockResolvedValue({
      contentLength: 13,
      contentType: "text/plain",
      data: new Uint8Array([
        72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 33,
      ]), // "Hello, world!"
      etag: "test-etag-12345",
      lastModified: new Date("2024-01-01T12:00:00Z"),
      success: true,
    }),
    listFiles: vi.fn().mockResolvedValue({
      isTruncated: false,
      objects: [
        {
          etag: "test-etag-12345",
          key: "media/temporal/1640995200000-abc123-test.txt",
          lastModified: new Date("2024-01-01T12:00:00Z"),
          size: 13,
          storageClass: "STANDARD",
        },
        {
          etag: "test-etag-67890",
          key: "media/permanent/1640995300000-def456-image.jpg",
          lastModified: new Date("2024-01-01T12:05:00Z"),
          size: 50000,
          storageClass: "STANDARD",
        },
      ],
      success: true,
    }),
    uploadFile: vi.fn().mockResolvedValue({
      etag: "test-etag-12345",
      key: "media/temporal/1640995200000-abc123-test.txt",
      location:
        "https://test-bucket.s3.amazonaws.com/media/temporal/1640995200000-abc123-test.txt",
      size: 13,
      success: true,
    }),
  })),
}));

describe("Media Tools Integration", () => {
  let testContext: McpClientTestContext;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create test environment with SSE transport
    testContext = await createMcpTestEnvironment({
      endpoint: "/test-mcp",
      port: 3001,
      transport: "sse",
    });

    // Wait for server to be fully ready
    await waitForServerReady(testContext, 30000);

    // Create temporary test directory and files
    testDir = join(process.cwd(), "tmp-test-media");
    await mkdir(testDir, { recursive: true });

    // Create test text file
    testFilePath = join(testDir, "test-upload.txt");
    await writeFile(testFilePath, "Hello, world!", "utf8");
  }, 45000);

  afterEach(async () => {
    // Cleanup test files
    try {
      if (testDir) {
        await rm(testDir, { force: true, recursive: true });
      }
    } catch (error) {
      console.warn("Error cleaning up test files:", error);
    }

    // Cleanup MCP environment
    if (testContext) {
      await cleanupMcpTestEnvironment(testContext);
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("Upload Media Command", () => {
    it("should upload media file successfully", async () => {
      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: testFilePath,
        metadata: {
          category: "testing",
          description: "Integration test file",
        },
        storageType: "temporal",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.fileName).toBe("test-upload.txt");
      expect(response.mimeType).toBe("text/plain");
      expect(response.storageType).toBe("temporal");
      expect(response.key).toMatch(
        /^media\/temporal\/\d+-[a-z0-9]+-test-upload\.txt$/,
      );
      expect(response.metadata).toEqual({
        category: "testing",
        "content-type": "text/plain",
        description: "Integration test file",
        "file-size": "13",
        "storage-type": "temporal",
        "uploaded-at": expect.any(String),
        "uploaded-by": "permamind-media-tools",
      });
    });

    it("should reject blocked file types", async () => {
      const executablePath = join(testDir, "dangerous.exe");
      await writeFile(executablePath, "fake executable", "utf8");

      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: executablePath,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain("File type not allowed");
      expect(response.error).toContain(".exe files are blocked");
    });

    it("should handle file path sanitization", async () => {
      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: "../../../etc/passwd",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain(
        "directory traversal patterns are not allowed",
      );
    });

    it("should handle custom bucket names", async () => {
      const result = await testToolCall(testContext.client, "uploadMedia", {
        bucketName: "custom-bucket",
        filePath: testFilePath,
        storageType: "permanent",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.storageType).toBe("permanent");
    });
  });

  describe("List Media Files Command", () => {
    it("should list all media files", async () => {
      const result = await testToolCall(
        testContext.client,
        "listMediaFiles",
        {},
      );

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.files).toHaveLength(2);
      expect(response.pagination.resultsCount).toBe(2);
      expect(response.pagination.totalFiles).toBe(2);
      expect(response.hasMore).toBe(false);
    });

    it("should filter by storage type", async () => {
      const result = await testToolCall(testContext.client, "listMediaFiles", {
        storageType: "temporal",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.storageType).toBe("temporal");
    });

    it("should apply size filters", async () => {
      const result = await testToolCall(testContext.client, "listMediaFiles", {
        filter: {
          minSize: 1000,
        },
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.appliedFilters.minSize).toBe(1000);
      // Should only return the image file (50000 bytes) not the text file (13 bytes)
      expect(response.files).toHaveLength(1);
      expect(response.files[0].key).toContain("image.jpg");
    });

    it("should apply date filters", async () => {
      const result = await testToolCall(testContext.client, "listMediaFiles", {
        filter: {
          dateFrom: "2024-01-01T12:02:00Z",
        },
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.appliedFilters.dateFrom).toBe("2024-01-01T12:02:00Z");
      // Should only return files after 12:02:00
      expect(response.files).toHaveLength(1);
      expect(response.files[0].lastModified).toBe("2024-01-01T12:05:00.000Z");
    });

    it("should handle pagination parameters", async () => {
      const result = await testToolCall(testContext.client, "listMediaFiles", {
        maxResults: 1,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.pagination.maxResults).toBe(1);
      expect(response.pagination.currentPage).toBe("first");
    });
  });

  describe("Get Media File Command", () => {
    it("should retrieve file metadata without data", async () => {
      const result = await testToolCall(testContext.client, "getMediaFile", {
        fileId: "media/temporal/1640995200000-abc123-test.txt",
        includeData: false,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.fileId).toBe(
        "media/temporal/1640995200000-abc123-test.txt",
      );
      expect(response.contentType).toBe("text/plain");
      expect(response.contentLength).toBe(13);
      expect(response.dataIncluded).toBe(false);
      expect(response.metadata.fileName).toBe("test.txt");
      expect(response.metadata.storageType).toBe("temporal");
      expect(response.metadata.fileCategory).toBe("text");
    });

    it("should retrieve file with data included", async () => {
      const result = await testToolCall(testContext.client, "getMediaFile", {
        fileId: "media/temporal/1640995200000-abc123-test.txt",
        includeData: true,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(true);
      expect(response.dataIncluded).toBe(true);
      expect(response.dataEncoding).toBe("base64");
      expect(response.data).toBeDefined();
      expect(response.dataSize).toBe(13);

      // Decode and verify content
      const decodedData = Buffer.from(response.data, "base64").toString("utf8");
      expect(decodedData).toBe("Hello, world!");
    });

    it("should handle file not found", async () => {
      // Mock downloadFile to return not found error
      vi.mocked(
        await import("../../src/services/LoadNetworkStorageService.js"),
      ).LoadNetworkStorageService.mockImplementationOnce(() => ({
        downloadFile: vi.fn().mockResolvedValue({
          error: {
            code: "NoSuchKey",
            message: "File not found",
          },
          success: false,
        }),
      }));

      const result = await testToolCall(testContext.client, "getMediaFile", {
        fileId: "media/temporal/nonexistent-file.txt",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain("Media file not found");
    });

    it("should validate file ID format", async () => {
      const result = await testToolCall(testContext.client, "getMediaFile", {
        fileId: "invalid/../../etc/passwd",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain(
        "directory traversal patterns are not allowed",
      );
    });

    it("should require valid media path prefix", async () => {
      const result = await testToolCall(testContext.client, "getMediaFile", {
        fileId: "documents/some-file.txt",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain(
        "must be a valid media storage key starting with 'media/'",
      );
    });
  });

  describe("Media Workflow Integration", () => {
    it("should complete full upload → list → retrieve workflow", async () => {
      // Step 1: Upload a file
      const uploadResult = await testToolCall(
        testContext.client,
        "uploadMedia",
        {
          filePath: testFilePath,
          metadata: { workflow: "integration-test" },
          storageType: "temporal",
        },
      );

      const uploadResponse = JSON.parse(uploadResult);
      expect(uploadResponse.success).toBe(true);
      const fileKey = uploadResponse.key;

      // Step 2: List files and find our uploaded file
      const listResult = await testToolCall(
        testContext.client,
        "listMediaFiles",
        {
          storageType: "temporal",
        },
      );

      const listResponse = JSON.parse(listResult);
      expect(listResponse.success).toBe(true);
      const foundFile = listResponse.files.find((f: any) => f.key === fileKey);
      expect(foundFile).toBeDefined();

      // Step 3: Retrieve the specific file
      const getResult = await testToolCall(testContext.client, "getMediaFile", {
        fileId: fileKey,
        includeData: true,
      });

      const getResponse = JSON.parse(getResult);
      expect(getResponse.success).toBe(true);
      expect(getResponse.fileId).toBe(fileKey);
      expect(getResponse.dataIncluded).toBe(true);

      // Verify file content matches original
      const retrievedContent = Buffer.from(getResponse.data, "base64").toString(
        "utf8",
      );
      expect(retrievedContent).toBe("Hello, world!");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle LoadNetworkStorageService failures gracefully", async () => {
      // Mock uploadFile to fail
      vi.mocked(
        await import("../../src/services/LoadNetworkStorageService.js"),
      ).LoadNetworkStorageService.mockImplementationOnce(() => ({
        uploadFile: vi.fn().mockResolvedValue({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Storage service temporarily unavailable",
          },
          success: false,
        }),
      }));

      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: testFilePath,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain(
        "Storage service temporarily unavailable",
      );
    });

    it("should handle missing files gracefully", async () => {
      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: "/nonexistent/path/file.txt",
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain("Media upload failed");
    });

    it("should validate MIME types correctly", async () => {
      // Create file with no extension
      const noExtensionPath = join(testDir, "no-extension");
      await writeFile(noExtensionPath, "test content", "utf8");

      const result = await testToolCall(testContext.client, "uploadMedia", {
        filePath: noExtensionPath,
      });

      expect(result).toBeDefined();
      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toContain("Unable to determine MIME type");
    });
  });
});
