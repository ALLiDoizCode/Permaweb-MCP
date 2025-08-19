import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  getLoadNetworkAccessKey,
  getLoadNetworkBucketName,
  getLoadNetworkMaxFileSize,
  LOAD_NETWORK_S3_CONFIG,
} from "../constants.js";

/**
 * Result interface for bucket creation operations
 */
export interface CreateBucketResult extends ServiceResult {
  bucketName?: string;
  location?: string;
}

/**
 * Parameters for file deletion operations
 */
export interface DeleteFileParams {
  /** Bucket name (optional, uses default if not provided) */
  bucketName?: string;
  /** Object key/path in the bucket */
  key: string;
}

/**
 * Parameters for file download operations
 */
export interface DownloadFileParams {
  /** Bucket name (optional, uses default if not provided) */
  bucketName?: string;
  /** Object key/path in the bucket */
  key: string;
}

/**
 * Result interface for file download operations
 */
export interface DownloadFileResult extends ServiceResult {
  contentLength?: number;
  contentType?: string;
  data?: Uint8Array;
  etag?: string;
  lastModified?: Date;
}

/**
 * Result interface for listing buckets
 */
export interface ListBucketsResult extends ServiceResult {
  buckets?: Array<{
    creationDate?: Date;
    name: string;
  }>;
}

/**
 * Parameters for listing files/objects
 */
export interface ListFilesParams {
  /** Bucket name (optional, uses default if not provided) */
  bucketName?: string;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Maximum number of objects to return */
  maxKeys?: number;
  /** Prefix to filter objects */
  prefix?: string;
}

/**
 * Result interface for listing files/objects
 */
export interface ListFilesResult extends ServiceResult {
  isTruncated?: boolean;
  nextContinuationToken?: string;
  objects?: Array<{
    etag?: string;
    key: string;
    lastModified?: Date;
    size?: number;
    storageClass?: string;
  }>;
}

/**
 * Configuration options for LoadNetworkStorageService
 */
export interface LoadNetworkStorageConfig {
  /** Override default bucket name */
  bucketName?: string;
  /** Override default maximum file size in bytes */
  maxFileSize?: number;
}

/**
 * Standard service result interface
 */
export interface ServiceResult {
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  success: boolean;
}

/**
 * Parameters for file upload operations
 */
export interface UploadFileParams {
  /** Access control list (e.g., 'public-read', 'private') */
  acl?: ObjectCannedACL;
  /** File content as Buffer or Uint8Array */
  body: Buffer | Uint8Array;
  /** Bucket name (optional, uses default if not provided) */
  bucketName?: string;
  /** Content type (MIME type) */
  contentType?: string;
  /** Object key/path in the bucket */
  key: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Result interface for file upload operations
 */
export interface UploadFileResult extends ServiceResult {
  arweaveId?: string; // Arweave transaction ID if available
  dataItemId?: string; // ANS-104 DataItem ID if available
  etag?: string;
  key?: string;
  location?: string;
  size?: number;
}

/**
 * LoadNetworkStorageService provides S3-compatible storage operations
 * for Load Network's distributed storage system.
 *
 * This service follows Load Network's specific authentication model
 * (access key only, empty secret key) and regional constraints
 * (eu-west-2 only).
 *
 * @example
 * ```typescript
 * const storageService = new LoadNetworkStorageService();
 *
 * // Create a bucket
 * const createResult = await storageService.createBucket("my-bucket");
 *
 * // Upload a file
 * const uploadResult = await storageService.uploadFile({
 *   key: "documents/file.txt",
 *   body: Buffer.from("Hello, world!"),
 *   contentType: "text/plain"
 * });
 *
 * // List files
 * const listResult = await storageService.listFiles({
 *   prefix: "documents/"
 * });
 * ```
 */
export class LoadNetworkStorageService {
  private defaultBucketName: string;
  private maxFileSize: number;
  private s3Client: S3Client;

  /**
   * Creates a new LoadNetworkStorageService instance
   *
   * @param config - Optional configuration to override defaults
   * @throws {Error} When LOAD_NETWORK_ACCESS_KEY environment variable is not set
   */
  constructor(config?: LoadNetworkStorageConfig) {
    // Validate environment configuration
    this.validateEnvironment();

    this.defaultBucketName = config?.bucketName || getLoadNetworkBucketName();
    this.maxFileSize = config?.maxFileSize || getLoadNetworkMaxFileSize();

    // Initialize S3Client with Load Network specific configuration
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: getLoadNetworkAccessKey(),
        secretAccessKey: "", // Load Network requires empty secret key
      },
      endpoint: LOAD_NETWORK_S3_CONFIG.endpoint,
      forcePathStyle: LOAD_NETWORK_S3_CONFIG.forcePathStyle,
      region: LOAD_NETWORK_S3_CONFIG.region,
    });
  }

  /**
   * Checks if a permanently stored file has been archived to Arweave
   * This may need to be called some time after upload as archival can be asynchronous
   *
   * @param key - The file key to check
   * @param bucketName - Optional bucket name
   * @returns Promise resolving to Arweave information if available
   */
  async checkArweaveStatus(
    key: string,
    bucketName?: string,
  ): Promise<
    {
      arweaveId?: string;
      dataItemId?: string;
      isArchived?: boolean;
    } & ServiceResult
  > {
    try {
      const targetBucket = bucketName || this.defaultBucketName;

      // Try to get object metadata which might include Arweave information
      const headCommand = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      try {
        const headResponse = await this.s3Client.send(headCommand);

        // Check metadata and headers for Arweave information
        const metadata = headResponse.Metadata || {};
        const result: {
          arweaveId?: string;
          dataItemId?: string;
          isArchived?: boolean;
        } = {};

        // Look for Arweave-related metadata
        for (const [key, value] of Object.entries(metadata)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("arweave") || lowerKey.includes("tx")) {
            if (typeof value === "string" && value.length === 43) {
              result.arweaveId = value;
              result.isArchived = true;
            }
          }
          if (lowerKey.includes("dataitem")) {
            if (typeof value === "string" && value.length === 43) {
              result.dataItemId = value;
            }
          }
        }

        return {
          success: true,
          ...result,
        };
      } catch (headError) {
        // HeadObject might not be supported, but that doesn't mean the file isn't archived
        console.warn(
          "HeadObject failed, cannot check Arweave archival status:",
          headError,
        );
        return {
          error: {
            code: "ARWEAVE_STATUS_CHECK_FAILED",
            message:
              "Cannot check Arweave archival status - metadata unavailable",
            solutions: [
              "LoadNetwork may not expose Arweave IDs through S3 metadata",
              "Check LoadNetwork documentation for alternative methods",
              "Try waiting longer for archival to complete",
              "Consider using LoadNetwork-specific APIs if available",
            ],
          },
          success: false,
        };
      }
    } catch (error) {
      return {
        error: {
          code: "ARWEAVE_STATUS_CHECK_ERROR",
          message: `Error checking Arweave status: ${error instanceof Error ? error.message : "Unknown error"}`,
          solutions: [
            "Verify file exists in the bucket",
            "Check network connectivity to LoadNetwork",
            "Ensure LOAD_NETWORK_ACCESS_KEY has read permissions",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Checks the health and availability of LoadNetwork S3 service
   * Uses the S3 listBuckets operation to verify service connectivity and authentication
   *
   * @returns Promise resolving to health check result with service status
   */
  async checkServiceHealth(): Promise<{
    authenticated?: boolean;
    available: boolean;
    endpoint: string;
    error?: string;
    responseTime?: number;
    serviceInfo?: string;
  }> {
    const startTime = Date.now();

    try {
      // Test S3 service connectivity using listBuckets operation
      // This verifies both connectivity and authentication
      const listResult = await this.listBuckets();
      const responseTime = Date.now() - startTime;

      if (listResult.success) {
        return {
          authenticated: true,
          available: true,
          endpoint: LOAD_NETWORK_S3_CONFIG.endpoint,
          responseTime,
          serviceInfo: `LoadNetwork S3 service operational (${listResult.buckets?.length || 0} buckets accessible)`,
        };
      } else {
        // Service responded but with an error (authentication, permissions, etc.)
        return {
          authenticated: false,
          available: true, // Endpoint is reachable
          endpoint: LOAD_NETWORK_S3_CONFIG.endpoint,
          error: listResult.error?.message,
          responseTime,
          serviceInfo:
            "LoadNetwork endpoint reachable but authentication/permissions failed",
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        authenticated: false,
        available: false,
        endpoint: LOAD_NETWORK_S3_CONFIG.endpoint,
        error: error instanceof Error ? error.message : "Network error",
        responseTime,
        serviceInfo: "LoadNetwork endpoint unreachable or network error",
      };
    }
  }

  /**
   * Creates a new bucket in Load Network storage
   *
   * @param bucketName - Name of the bucket to create
   * @returns Promise resolving to CreateBucketResult
   */
  async createBucket(bucketName: string): Promise<CreateBucketResult> {
    try {
      const command = new CreateBucketCommand({
        Bucket: bucketName,
      });

      const response = await this.s3Client.send(command);

      return {
        bucketName,
        location: response.Location,
        success: true,
      };
    } catch (error) {
      return this.handleS3Error(
        error,
        "CREATE_BUCKET_FAILED",
        `Failed to create bucket '${bucketName}'`,
        [
          "Verify LOAD_NETWORK_ACCESS_KEY is valid",
          "Check bucket name follows S3 naming conventions",
          "Ensure Load Network service is accessible",
          "Verify you have permissions to create buckets",
        ],
      );
    }
  }

  /**
   * Deletes an empty bucket from Load Network storage
   *
   * @param bucketName - Name of the bucket to delete
   * @returns Promise resolving to ServiceResult
   */
  async deleteBucket(bucketName: string): Promise<ServiceResult> {
    try {
      const command = new DeleteBucketCommand({
        Bucket: bucketName,
      });

      await this.s3Client.send(command);

      return {
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: "DELETE_BUCKET_FAILED",
          details: error,
          message: `Failed to delete bucket '${bucketName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          solutions: [
            "Ensure bucket is empty before deletion",
            "Verify bucket name exists",
            "Check you have permissions to delete buckets",
            "Confirm bucket is not being used by other processes",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Deletes a file from Load Network storage
   *
   * @param params - Delete parameters including key and bucket
   * @returns Promise resolving to ServiceResult
   */
  async deleteFile(params: DeleteFileParams): Promise<ServiceResult> {
    try {
      const bucketName = params.bucketName || this.defaultBucketName;

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      });

      await this.s3Client.send(command);

      return {
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: "DELETE_FILE_FAILED",
          details: error,
          message: `Failed to delete file '${params.key}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          solutions: [
            "Verify file exists before deletion",
            "Check you have permissions to delete files",
            "Ensure bucket name is correct",
            "Verify network connectivity to Load Network",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Downloads a file from Load Network storage
   *
   * @param params - Download parameters including key and bucket
   * @returns Promise resolving to DownloadFileResult
   */
  async downloadFile(params: DownloadFileParams): Promise<DownloadFileResult> {
    try {
      const bucketName = params.bucketName || this.defaultBucketName;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        return {
          error: {
            code: "NO_FILE_CONTENT",
            message: `File '${params.key}' exists but has no content`,
            solutions: [
              "Verify the file was uploaded correctly",
              "Check if the file is corrupted",
            ],
          },
          success: false,
        };
      }

      // Convert response body to Uint8Array
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }

      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        data,
        etag: response.ETag,
        lastModified: response.LastModified,
        success: true,
      };
    } catch (error) {
      if (
        (error instanceof S3ServiceException && error.name === "NoSuchKey") ||
        (error instanceof Error && error.name === "NoSuchKey")
      ) {
        return {
          error: {
            code: "FILE_NOT_FOUND",
            message: `File '${params.key}' not found`,
            solutions: [
              "Verify the file key/path is correct",
              "Check if the file exists using listFiles()",
              "Ensure bucket name is correct",
            ],
          },
          success: false,
        };
      }

      return {
        error: {
          code: "DOWNLOAD_FILE_FAILED",
          details: error,
          message: `Failed to download file '${params.key}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          solutions: [
            "Verify file exists in the bucket",
            "Check network connectivity to Load Network",
            "Verify LOAD_NETWORK_ACCESS_KEY has download permissions",
            "Ensure bucket name is correct",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Checks if a file exists in Load Network storage
   *
   * @param params - Parameters including key and bucket
   * @returns Promise resolving to ServiceResult with existence information
   */
  async fileExists(
    params: DownloadFileParams,
  ): Promise<{ exists?: boolean; size?: number } & ServiceResult> {
    try {
      const bucketName = params.bucketName || this.defaultBucketName;

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      });

      const response = await this.s3Client.send(command);

      return {
        exists: true,
        size: response.ContentLength,
        success: true,
      };
    } catch (error) {
      if (
        (error instanceof S3ServiceException && error.name === "NoSuchKey") ||
        (error instanceof Error && error.name === "NoSuchKey")
      ) {
        return {
          exists: false,
          success: true,
        };
      }

      return {
        error: {
          code: "FILE_EXISTS_CHECK_FAILED",
          details: error,
          message: `Failed to check if file '${params.key}' exists: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          solutions: [
            "Verify network connectivity to Load Network",
            "Check LOAD_NETWORK_ACCESS_KEY has read permissions",
            "Ensure bucket name is correct",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Generates a pre-signed URL for temporary public access to a file
   *
   * @param params - Parameters including key, bucket, and expiration
   * @returns Promise resolving to the pre-signed URL or error
   */
  async generatePresignedUrl(params: {
    bucketName?: string;
    expiresIn?: number; // seconds, default 3600 (1 hour)
    key: string;
  }): Promise<{ url?: string } & ServiceResult> {
    try {
      const bucketName = params.bucketName || this.defaultBucketName;
      const expiresIn = params.expiresIn || 3600;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return {
        success: true,
        url: presignedUrl,
      };
    } catch (error) {
      return this.handleS3Error(
        error,
        "PRESIGNED_URL_FAILED",
        `Failed to generate pre-signed URL for '${params.key}'`,
        [
          "Verify file exists in the bucket",
          "Check LOAD_NETWORK_ACCESS_KEY has read permissions",
          "Ensure LoadNetwork supports pre-signed URLs",
          "Try downloading via S3 API instead",
        ],
      );
    }
  }

  /**
   * Gets the default bucket name configured for this service
   *
   * @returns The default bucket name
   */
  getDefaultBucketName(): string {
    return this.defaultBucketName;
  }

  /**
   * Gets the maximum file size limit configured for this service
   *
   * @returns The maximum file size in bytes
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  /**
   * Lists all buckets accessible with current credentials
   *
   * @returns Promise resolving to ListBucketsResult
   */
  async listBuckets(): Promise<ListBucketsResult> {
    try {
      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);

      const buckets =
        response.Buckets?.map((bucket) => ({
          creationDate: bucket.CreationDate,
          name: bucket.Name || "",
        })) || [];

      return {
        buckets,
        success: true,
      };
    } catch (error) {
      return this.handleS3Error(
        error,
        "LIST_BUCKETS_FAILED",
        "Failed to list buckets",
        [
          "Verify LOAD_NETWORK_ACCESS_KEY is valid",
          "Check network connectivity to Load Network",
          "Ensure Load Network service is accessible",
        ],
      );
    }
  }

  /**
   * Lists files/objects in a bucket with optional filtering
   *
   * @param params - List parameters including bucket, prefix, and pagination
   * @returns Promise resolving to ListFilesResult
   */
  async listFiles(params: ListFilesParams = {}): Promise<ListFilesResult> {
    try {
      const bucketName = params.bucketName || this.defaultBucketName;

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: params.continuationToken,
        MaxKeys: params.maxKeys,
        Prefix: params.prefix,
      });

      const response = await this.s3Client.send(command);

      const objects =
        response.Contents?.map((obj) => ({
          etag: obj.ETag,
          key: obj.Key || "",
          lastModified: obj.LastModified,
          size: obj.Size,
          storageClass: obj.StorageClass,
        })) || [];

      return {
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken,
        objects,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: "LIST_FILES_FAILED",
          details: error,
          message: `Failed to list files in bucket: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          solutions: [
            "Verify bucket exists and is accessible",
            "Check LOAD_NETWORK_ACCESS_KEY has list permissions",
            "Ensure network connectivity to Load Network",
            "Verify bucket name is correct",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Uploads a file to Load Network storage
   * Automatically creates the bucket if it doesn't exist
   *
   * @param params - Upload parameters including key, body, and metadata
   * @returns Promise resolving to UploadFileResult
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    try {
      // Validate file size
      if (params.body.length > this.maxFileSize) {
        return {
          error: {
            code: "FILE_TOO_LARGE",
            message: `File size ${params.body.length} bytes exceeds maximum allowed size of ${this.maxFileSize} bytes`,
            solutions: [
              "Reduce file size before upload",
              "Consider splitting large files into chunks",
              "Increase LOAD_NETWORK_MAX_FILE_SIZE environment variable if permitted",
            ],
          },
          success: false,
        };
      }

      const bucketName = params.bucketName || this.defaultBucketName;

      // Note: LoadNetwork may auto-create buckets or have different bucket requirements
      // Skipping explicit bucket creation and letting LoadNetwork handle it
      // await this.ensureBucketExists(bucketName);

      const command = new PutObjectCommand({
        Body: params.body,
        Bucket: bucketName,
        ContentType: params.contentType,
        Key: params.key,
        Metadata: params.metadata,
        ...(params.acl && { ACL: params.acl }), // Include ACL if specified
      });

      const response = await this.s3Client.send(command);

      // Extract potential Arweave/DataItem information from response
      const arweaveInfo = await this.extractArweaveInfo(
        response,
        params.key,
        bucketName,
      );

      return {
        etag: response.ETag,
        key: params.key,
        location: `${LOAD_NETWORK_S3_CONFIG.endpoint}/${bucketName}/${params.key}`,
        size: params.body.length,
        success: true,
        ...arweaveInfo, // Include any discovered Arweave/DataItem IDs
      };
    } catch (error) {
      return this.handleS3Error(
        error,
        "UPLOAD_FILE_FAILED",
        `Failed to upload file '${params.key}'`,
        [
          "Verify bucket exists and is accessible",
          "Check file permissions and content",
          "Ensure network connectivity to Load Network",
          "Verify LOAD_NETWORK_ACCESS_KEY has upload permissions",
          "LoadNetwork S3 service may be temporarily unavailable",
        ],
      );
    }
  }

  /**
   * Ensures a bucket exists, creating it if necessary
   * @private
   * @param bucketName - Name of the bucket to ensure exists
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      // Try to create bucket - if it already exists, LoadNetwork will handle gracefully
      const createResult = await this.createBucket(bucketName);
      if (
        !createResult.success &&
        createResult.error?.code !== "BUCKET_ALREADY_EXISTS"
      ) {
        // Only warn for non-existence errors
        console.warn(
          `Warning: Could not create bucket '${bucketName}': ${createResult.error?.message}`,
        );
      }
    } catch (error) {
      // If we can't create the bucket, let the upload attempt and handle the error there
      // This prevents bucket creation errors from blocking uploads to existing buckets
      console.warn(
        `Warning: Could not verify/create bucket '${bucketName}': ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Attempts to extract Arweave transaction ID and DataItem information from LoadNetwork responses
   * @private
   * @param response - The S3 response object
   * @param key - The object key
   * @param bucketName - The bucket name
   * @returns Object with potential arweaveId and dataItemId
   */
  private async extractArweaveInfo(
    response: any,
    key: string,
    bucketName: string,
  ): Promise<{ arweaveId?: string; dataItemId?: string }> {
    const result: { arweaveId?: string; dataItemId?: string } = {};

    try {
      // Check response headers and metadata for Arweave information
      const metadata = response.$metadata?.httpHeaders || {};

      // Look for common Arweave/LoadNetwork headers
      for (const [headerName, headerValue] of Object.entries(metadata)) {
        const lowerHeader = headerName.toLowerCase();
        if (
          lowerHeader.includes("arweave") ||
          lowerHeader.includes("tx-id") ||
          lowerHeader.includes("transaction")
        ) {
          console.log(
            `Found potential Arweave header: ${headerName}: ${headerValue}`,
          );
          if (typeof headerValue === "string" && headerValue.length === 43) {
            result.arweaveId = headerValue;
          }
        }
        if (
          lowerHeader.includes("dataitem") ||
          lowerHeader.includes("data-item")
        ) {
          console.log(
            `Found potential DataItem header: ${headerName}: ${headerValue}`,
          );
          if (typeof headerValue === "string" && headerValue.length === 43) {
            result.dataItemId = headerValue;
          }
        }
      }

      // For permanent storage, try to check if the object has been archived to Arweave
      // This might happen asynchronously, so we may not get the ID immediately
      if (key.startsWith("media/permanent/")) {
        // Could potentially make additional LoadNetwork API calls here
        // to check archival status, but would need LoadNetwork-specific endpoints
        console.log(
          "Permanent storage detected - Arweave archival may be in progress",
        );
      }
    } catch (error) {
      // Don't fail the upload if we can't extract Arweave info
      console.warn("Could not extract Arweave information:", error);
    }

    return result;
  }

  /**
   * Extracts meaningful error message from LoadNetwork responses
   * @private
   * @param error - The S3 error with potential response data
   * @returns Human-readable error message
   */
  private extractLoadNetworkErrorMessage(error: any): string {
    try {
      // If we have raw response body from LoadNetwork
      if (error.$response?.body) {
        let bodyText = error.$response.body;
        if (typeof bodyText !== "string" && bodyText.toString) {
          bodyText = bodyText.toString();
        }

        // Common LoadNetwork error responses
        if (typeof bodyText === "string") {
          if (bodyText.includes("S3 request failed")) {
            return "LoadNetwork S3 service request failed";
          }
          if (bodyText.includes("not implemented")) {
            return `LoadNetwork S3 operation not supported: ${bodyText}`;
          }
          if (bodyText.length > 0 && bodyText.length < 200) {
            return `LoadNetwork error: ${bodyText}`;
          }
        }
      }

      // Fall back to original error message without AWS SDK details
      return error.message?.split("\n")[0] || "LoadNetwork S3 service error";
    } catch (e) {
      return "LoadNetwork S3 service returned unparseable error response";
    }
  }

  /**
   * Enhanced error handling for S3 operations that handles LoadNetwork specific response formats
   * @private
   * @param error - The error from S3 operation
   * @param code - Error code to use in response
   * @param baseMessage - Base error message
   * @param solutions - Array of solution suggestions
   * @returns ServiceResult with comprehensive error information
   */
  private handleS3Error(
    error: any,
    code: string,
    baseMessage: string,
    solutions: string[],
  ): ServiceResult {
    const errorDetails: any = {
      code,
      details: error,
      solutions,
    };

    // Handle LoadNetwork specific deserialization errors
    if (error.message?.includes("Deserialization error")) {
      // Extract the actual response if available
      const actualMessage = this.extractLoadNetworkErrorMessage(error);
      errorDetails.message = `${baseMessage}: ${actualMessage}`;

      // Add LoadNetwork specific solutions
      errorDetails.solutions = [
        "LoadNetwork S3 service returned non-XML response (service may be down)",
        "Check LoadNetwork service status at the endpoint",
        "Verify your LOAD_NETWORK_ACCESS_KEY is valid and has proper permissions",
        "Ensure the bucket exists or has been created properly",
        "Try again later if service is temporarily unavailable",
        ...solutions,
      ];
    } else if (error.$metadata?.httpStatusCode === 500) {
      errorDetails.message = `${baseMessage}: LoadNetwork S3 service returned HTTP 500 (Internal Server Error)`;
      errorDetails.solutions = [
        "LoadNetwork S3 service is experiencing server-side issues",
        "Check if the service endpoint is responding correctly",
        "Verify bucket configuration and permissions",
        "Try again later as this may be a temporary service issue",
        ...solutions,
      ];
    } else if (error.$metadata?.httpStatusCode === 501) {
      errorDetails.message = `${baseMessage}: Operation not implemented by LoadNetwork S3 service`;
      errorDetails.solutions = [
        "This S3 operation is not yet supported by LoadNetwork",
        "Check LoadNetwork documentation for supported operations",
        "Consider using alternative storage approaches",
        ...solutions,
      ];
    } else if (error.message?.includes("The bucket was not created")) {
      errorDetails.message = `${baseMessage}: Bucket creation failed on LoadNetwork`;
      errorDetails.code = "BUCKET_CREATION_FAILED";
      errorDetails.solutions = [
        "LoadNetwork may have restrictions on bucket creation",
        "Try using an existing bucket if available",
        "Verify your access key has bucket creation permissions",
        "Check if bucket name meets LoadNetwork requirements",
        ...solutions,
      ];
    } else {
      errorDetails.message = `${baseMessage}: ${error instanceof Error ? error.message : "Unknown error"}`;
    }

    return {
      error: errorDetails,
      success: false,
    };
  }

  /**
   * Validates required environment variables
   * @private
   * @throws {Error} When required environment variables are missing
   */
  private validateEnvironment(): void {
    try {
      getLoadNetworkAccessKey();
    } catch (error) {
      throw new Error(
        `LoadNetworkStorageService initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
