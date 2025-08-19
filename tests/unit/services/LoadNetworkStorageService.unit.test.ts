import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock AWS S3 SDK
const mockS3ClientSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  CreateBucketCommand: vi.fn(),
  DeleteBucketCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  ListBucketsCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  PutObjectCommand: vi.fn(),
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockS3ClientSend,
  })),
  S3ServiceException: vi.fn(),
}));

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import {
  type CreateBucketResult,
  type DeleteFileParams,
  type DownloadFileParams,
  type ListBucketsResult,
  type ListFilesResult,
  LoadNetworkStorageService,
  type ServiceResult,
  type UploadFileParams,
  type UploadFileResult,
} from "../../../src/services/LoadNetworkStorageService.js";

describe("LoadNetworkStorageService", () => {
  let service: LoadNetworkStorageService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment and set test environment
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      LOAD_NETWORK_ACCESS_KEY: "test-access-key",
      LOAD_NETWORK_BUCKET_NAME: "test-bucket",
      LOAD_NETWORK_MAX_FILE_SIZE: "1048576", // 1MB
    };

    service = new LoadNetworkStorageService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      expect(S3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "",
        },
        endpoint: "https://s3.load.rs",
        forcePathStyle: true,
        region: "eu-west-2",
      });

      expect(service.getDefaultBucketName()).toBe("test-bucket");
      expect(service.getMaxFileSize()).toBe(1048576);
    });

    it("should initialize with custom configuration", () => {
      const customConfig = {
        bucketName: "custom-bucket",
        maxFileSize: 2 * 1024 * 1024, // 2MB
      };

      const customService = new LoadNetworkStorageService(customConfig);

      expect(customService.getDefaultBucketName()).toBe("custom-bucket");
      expect(customService.getMaxFileSize()).toBe(2 * 1024 * 1024);
    });

    it("should throw error when access key is missing", () => {
      // Remove access key from environment
      delete process.env.LOAD_NETWORK_ACCESS_KEY;

      expect(() => new LoadNetworkStorageService()).toThrow(
        "LoadNetworkStorageService initialization failed",
      );
    });
  });

  describe("createBucket", () => {
    it("should create bucket successfully", async () => {
      const bucketName = "test-new-bucket";
      const mockResponse = {
        Location: `https://${bucketName}.s3.eu-west-2.amazonaws.com/`,
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result: CreateBucketResult = await service.createBucket(bucketName);

      expect(CreateBucketCommand).toHaveBeenCalledWith({
        Bucket: bucketName,
      });
      expect(result.success).toBe(true);
      expect(result.bucketName).toBe(bucketName);
      expect(result.location).toBe(mockResponse.Location);
      expect(result.error).toBeUndefined();
    });

    it("should handle bucket creation failure", async () => {
      const bucketName = "invalid-bucket";
      const error = new Error("BucketAlreadyExists");

      mockS3ClientSend.mockRejectedValue(error);

      const result: CreateBucketResult = await service.createBucket(bucketName);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("CREATE_BUCKET_FAILED");
      expect(result.error!.message).toContain("Failed to create bucket");
      expect(result.error!.message).toContain(bucketName);
      expect(result.error!.solutions).toContain(
        "Verify LOAD_NETWORK_ACCESS_KEY is valid",
      );
    });
  });

  describe("listBuckets", () => {
    it("should list buckets successfully", async () => {
      const mockResponse = {
        Buckets: [
          { CreationDate: new Date("2023-01-01"), Name: "bucket1" },
          { CreationDate: new Date("2023-02-01"), Name: "bucket2" },
        ],
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result: ListBucketsResult = await service.listBuckets();

      expect(ListBucketsCommand).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
      expect(result.buckets).toHaveLength(2);
      expect(result.buckets![0].name).toBe("bucket1");
      expect(result.buckets![1].name).toBe("bucket2");
    });

    it("should handle empty bucket list", async () => {
      mockS3ClientSend.mockResolvedValue({ Buckets: [] });

      const result: ListBucketsResult = await service.listBuckets();

      expect(result.success).toBe(true);
      expect(result.buckets).toHaveLength(0);
    });

    it("should handle list buckets failure", async () => {
      const error = new Error("NetworkError");
      mockS3ClientSend.mockRejectedValue(error);

      const result: ListBucketsResult = await service.listBuckets();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("LIST_BUCKETS_FAILED");
      expect(result.error!.solutions).toContain(
        "Verify LOAD_NETWORK_ACCESS_KEY is valid",
      );
    });
  });

  describe("deleteBucket", () => {
    it("should delete bucket successfully", async () => {
      const bucketName = "bucket-to-delete";
      mockS3ClientSend.mockResolvedValue({});

      const result: ServiceResult = await service.deleteBucket(bucketName);

      expect(DeleteBucketCommand).toHaveBeenCalledWith({
        Bucket: bucketName,
      });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle delete bucket failure", async () => {
      const bucketName = "non-existent-bucket";
      const error = new Error("BucketNotEmpty");

      mockS3ClientSend.mockRejectedValue(error);

      const result: ServiceResult = await service.deleteBucket(bucketName);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("DELETE_BUCKET_FAILED");
      expect(result.error!.solutions).toContain(
        "Ensure bucket is empty before deletion",
      );
    });
  });

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const uploadParams: UploadFileParams = {
        body: Buffer.from("Hello, world!"),
        contentType: "text/plain",
        key: "documents/test.txt",
        metadata: { author: "test-user" },
      };

      const mockResponse = {
        ETag: '"abcd1234"',
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result: UploadFileResult = await service.uploadFile(uploadParams);

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Body: uploadParams.body,
        Bucket: "test-bucket",
        ContentType: uploadParams.contentType,
        Key: uploadParams.key,
        Metadata: uploadParams.metadata,
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe(uploadParams.key);
      expect(result.etag).toBe(mockResponse.ETag);
      expect(result.size).toBe(uploadParams.body.length);
      expect(result.location).toContain(uploadParams.key);
    });

    it("should use custom bucket name when provided", async () => {
      const uploadParams: UploadFileParams = {
        body: Buffer.from("test"),
        bucketName: "custom-bucket",
        key: "test.txt",
      };

      mockS3ClientSend.mockResolvedValue({ ETag: '"test"' });

      await service.uploadFile(uploadParams);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "custom-bucket",
        }),
      );
    });

    it("should reject files that exceed size limit", async () => {
      const largeFile = Buffer.alloc(2 * 1024 * 1024); // 2MB (exceeds 1MB limit)
      const uploadParams: UploadFileParams = {
        body: largeFile,
        key: "large-file.bin",
      };

      const result: UploadFileResult = await service.uploadFile(uploadParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("FILE_TOO_LARGE");
      expect(result.error!.message).toContain("exceeds maximum allowed size");
      expect(mockS3ClientSend).not.toHaveBeenCalled();
    });

    it("should handle upload failure", async () => {
      const uploadParams: UploadFileParams = {
        body: Buffer.from("test"),
        key: "test.txt",
      };

      const error = new Error("AccessDenied");
      mockS3ClientSend.mockRejectedValue(error);

      const result: UploadFileResult = await service.uploadFile(uploadParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("UPLOAD_FILE_FAILED");
      expect(result.error!.solutions).toContain(
        "Verify bucket exists and is accessible",
      );
    });
  });

  describe("downloadFile", () => {
    it("should download file successfully", async () => {
      const downloadParams: DownloadFileParams = {
        key: "documents/test.txt",
      };

      const fileContent = Buffer.from("Hello, world!");
      const mockReadableStream = {
        transformToWebStream: () => ({
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new Uint8Array(fileContent),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        }),
      };

      const mockResponse = {
        Body: mockReadableStream,
        ContentLength: fileContent.length,
        ContentType: "text/plain",
        ETag: '"abcd1234"',
        LastModified: new Date("2023-01-01"),
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result = await service.downloadFile(downloadParams);

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: downloadParams.key,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(new Uint8Array(fileContent));
      expect(result.contentType).toBe("text/plain");
      expect(result.contentLength).toBe(fileContent.length);
      expect(result.etag).toBe('"abcd1234"');
    });

    it("should use custom bucket name when provided", async () => {
      const downloadParams: DownloadFileParams = {
        bucketName: "custom-bucket",
        key: "test.txt",
      };

      const mockReadableStream = {
        transformToWebStream: () => ({
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true }),
          }),
        }),
      };

      mockS3ClientSend.mockResolvedValue({ Body: mockReadableStream });

      await service.downloadFile(downloadParams);

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: "custom-bucket",
        Key: downloadParams.key,
      });
    });

    it("should handle file not found", async () => {
      const downloadParams: DownloadFileParams = {
        key: "non-existent.txt",
      };

      // Create error that matches S3ServiceException behavior
      const error = new Error("NoSuchKey");
      error.name = "NoSuchKey";

      mockS3ClientSend.mockRejectedValue(error);

      const result = await service.downloadFile(downloadParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("FILE_NOT_FOUND");
      expect(result.error!.message).toContain("not found");
    });

    it("should handle empty file content", async () => {
      const downloadParams: DownloadFileParams = {
        key: "empty.txt",
      };

      mockS3ClientSend.mockResolvedValue({ Body: null });

      const result = await service.downloadFile(downloadParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("NO_FILE_CONTENT");
    });

    it("should handle download failure", async () => {
      const downloadParams: DownloadFileParams = {
        key: "test.txt",
      };

      const error = new Error("NetworkError");
      mockS3ClientSend.mockRejectedValue(error);

      const result = await service.downloadFile(downloadParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("DOWNLOAD_FILE_FAILED");
    });
  });

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      const deleteParams: DeleteFileParams = {
        key: "documents/test.txt",
      };

      mockS3ClientSend.mockResolvedValue({});

      const result: ServiceResult = await service.deleteFile(deleteParams);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: deleteParams.key,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should use custom bucket name when provided", async () => {
      const deleteParams: DeleteFileParams = {
        bucketName: "custom-bucket",
        key: "test.txt",
      };

      mockS3ClientSend.mockResolvedValue({});

      await service.deleteFile(deleteParams);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "custom-bucket",
        Key: deleteParams.key,
      });
    });

    it("should handle delete failure", async () => {
      const deleteParams: DeleteFileParams = {
        key: "test.txt",
      };

      const error = new Error("AccessDenied");
      mockS3ClientSend.mockRejectedValue(error);

      const result: ServiceResult = await service.deleteFile(deleteParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("DELETE_FILE_FAILED");
    });
  });

  describe("listFiles", () => {
    it("should list files successfully", async () => {
      const mockResponse = {
        Contents: [
          {
            ETag: '"abc123"',
            Key: "documents/file1.txt",
            LastModified: new Date("2023-01-01"),
            Size: 100,
            StorageClass: "STANDARD",
          },
          {
            ETag: '"def456"',
            Key: "documents/file2.txt",
            LastModified: new Date("2023-01-02"),
            Size: 200,
            StorageClass: "STANDARD",
          },
        ],
        IsTruncated: false,
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result: ListFilesResult = await service.listFiles({
        maxKeys: 10,
        prefix: "documents/",
      });

      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        ContinuationToken: undefined,
        MaxKeys: 10,
        Prefix: "documents/",
      });

      expect(result.success).toBe(true);
      expect(result.objects).toHaveLength(2);
      expect(result.objects![0].key).toBe("documents/file1.txt");
      expect(result.objects![0].size).toBe(100);
      expect(result.isTruncated).toBe(false);
    });

    it("should list files with pagination", async () => {
      const mockResponse = {
        Contents: [{ Key: "file.txt" }],
        IsTruncated: true,
        NextContinuationToken: "token123",
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result: ListFilesResult = await service.listFiles({
        continuationToken: "previous-token",
      });

      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        ContinuationToken: "previous-token",
        MaxKeys: undefined,
        Prefix: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe("token123");
    });

    it("should handle empty file list", async () => {
      mockS3ClientSend.mockResolvedValue({ Contents: [] });

      const result: ListFilesResult = await service.listFiles();

      expect(result.success).toBe(true);
      expect(result.objects).toHaveLength(0);
    });

    it("should handle list files failure", async () => {
      const error = new Error("AccessDenied");
      mockS3ClientSend.mockRejectedValue(error);

      const result: ListFilesResult = await service.listFiles();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("LIST_FILES_FAILED");
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const params: DownloadFileParams = {
        key: "documents/existing.txt",
      };

      const mockResponse = {
        ContentLength: 100,
      };

      mockS3ClientSend.mockResolvedValue(mockResponse);

      const result = await service.fileExists(params);

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: params.key,
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.size).toBe(100);
    });

    it("should return false for non-existent file", async () => {
      const params: DownloadFileParams = {
        key: "documents/non-existent.txt",
      };

      // Create error that matches S3ServiceException behavior
      const error = new Error("NoSuchKey");
      error.name = "NoSuchKey";

      mockS3ClientSend.mockRejectedValue(error);

      const result = await service.fileExists(params);

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.size).toBeUndefined();
    });

    it("should handle check failure", async () => {
      const params: DownloadFileParams = {
        key: "test.txt",
      };

      const error = new Error("AccessDenied");
      mockS3ClientSend.mockRejectedValue(error);

      const result = await service.fileExists(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("FILE_EXISTS_CHECK_FAILED");
    });
  });

  describe("utility methods", () => {
    it("should return default bucket name", () => {
      expect(service.getDefaultBucketName()).toBe("test-bucket");
    });

    it("should return max file size", () => {
      expect(service.getMaxFileSize()).toBe(1048576);
    });
  });
});
