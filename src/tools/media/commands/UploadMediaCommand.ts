import { readFile } from "fs/promises";
import { lookup } from "mime-types";
import { extname } from "path";
import { z } from "zod";

import {
  LoadNetworkStorageService,
  type UploadFileResult,
} from "../../../services/LoadNetworkStorageService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface UploadMediaArgs {
  bucketName?: string;
  fileName?: string;
  filePath: string;
  metadata?: Record<string, string>;
  storageType?: "permanent" | "temporal";
}

/**
 * Command for uploading media files to Load Network storage with comprehensive validation
 */
export class UploadMediaCommand extends ToolCommand<UploadMediaArgs, string> {
  private static readonly ALLOWED_MIME_TYPES = new Set([
    "application/gzip",
    "application/json",
    // Office documents
    "application/msword",
    // Documents
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/x-tar",
    "application/xml",
    // Archives
    "application/zip",
    "audio/mp4",
    // Audio
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "image/bmp",
    "image/gif",
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/svg+xml",
    "image/tiff",
    "image/webp",
    "text/csv",
    "text/markdown",
    "text/plain",
    "text/xml",
    "video/avi",
    // Video
    "video/mp4",
    "video/ogg",
    "video/webm",
  ]);

  private static readonly BLOCKED_EXTENSIONS = new Set([
    ".app",
    ".bat",
    ".bin",
    ".cmd",
    ".com",
    ".deb",
    ".exe",
    ".jar",
    ".js",
    ".pif",
    ".pkg",
    ".rpm",
    ".run",
    ".scr",
    ".vbs",
  ]);

  protected metadata: ToolMetadata = {
    description: `Upload media files to decentralized storage with security validation and metadata support.
    
    Supports images, documents, archives, audio, and video files with automatic MIME type detection.
    Includes file size limits, security validation, and options for temporal or permanent storage.
    
    Security features:
    - File type validation using MIME type detection
    - Blocked executable file types for security
    - File size limits to prevent quota issues
    - Path sanitization to prevent directory traversal
    
    Storage options:
    - temporal: Standard storage tier (default)
    - permanent: Long-term storage tier
    
    The tool returns file details including storage location, size, and unique identifier for retrieval.`,
    name: "uploadMedia",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Upload Media File",
  };

  protected parametersSchema = z.object({
    bucketName: z
      .string()
      .optional()
      .describe("Override default bucket name for storage"),
    fileName: z
      .string()
      .optional()
      .describe("Override filename for the uploaded file"),
    filePath: z.string().describe("Path to the local file to upload"),
    metadata: z
      .record(z.string())
      .optional()
      .describe("Additional metadata key-value pairs for the file"),
    storageType: z
      .enum(["temporal", "permanent"])
      .optional()
      .default("temporal")
      .describe(
        "Storage tier: 'temporal' for standard storage, 'permanent' for long-term storage",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: UploadMediaArgs): Promise<string> {
    try {
      // Sanitize file path to prevent directory traversal
      const sanitizedPath = this.sanitizeFilePath(args.filePath);

      // Validate file extension for security
      this.validateFileExtension(sanitizedPath);

      // Read file content
      const fileBuffer = await readFile(sanitizedPath);

      // Validate file size
      await this.validateFileSize(fileBuffer.length);

      // Detect and validate MIME type
      const mimeType = await this.validateMimeType(sanitizedPath);

      // Generate storage key
      const storageKey = this.generateStorageKey(
        args.fileName || sanitizedPath,
        args.storageType || "temporal",
      );

      // Prepare metadata
      const fileMetadata = this.prepareMetadata(
        args.metadata,
        mimeType,
        args.storageType || "temporal",
        fileBuffer.length,
      );

      // Upload file using LoadNetworkStorageService
      const storageService = new LoadNetworkStorageService(
        args.bucketName ? { bucketName: args.bucketName } : undefined,
      );

      const uploadResult: UploadFileResult = await storageService.uploadFile({
        body: fileBuffer,
        bucketName: args.bucketName,
        contentType: mimeType,
        key: storageKey,
        metadata: fileMetadata,
      });

      if (!uploadResult.success) {
        // Enhanced error reporting with LoadNetwork-specific guidance
        const error = uploadResult.error;
        const errorMessage = error?.message || "Upload failed unexpectedly";
        const solutions = error?.solutions || [];

        // Create detailed error for user
        const detailedError = {
          code: error?.code || "UPLOAD_FAILED",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          troubleshooting: solutions.slice(0, 5), // Limit to top 5 solutions
          ...(error?.code === "UPLOAD_FILE_FAILED" &&
            error.message.includes("LoadNetwork") && {
              recommendation:
                "Try again in a few minutes or check service status",
              serviceStatus:
                "LoadNetwork S3 service may be experiencing issues",
            }),
        };

        throw new Error(JSON.stringify(detailedError));
      }

      // Prepare response
      const response = {
        etag: uploadResult.etag,
        fileName: args.fileName || this.extractFileName(sanitizedPath),
        fileSize: fileBuffer.length,
        key: storageKey,
        location: uploadResult.location,
        metadata: fileMetadata,
        mimeType,
        storageType: args.storageType || "temporal",
        success: true,
        uploadedAt: new Date().toISOString(),
      };

      return JSON.stringify(response);
    } catch (error) {
      // Enhanced error response handling
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if error message is already JSON (from our enhanced error handling)
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.message && parsedError.code) {
          // Return structured error response from LoadNetwork service
          return JSON.stringify({
            details: {
              code: parsedError.code,
              recommendation: parsedError.recommendation,
              serviceStatus: parsedError.serviceStatus,
              timestamp: parsedError.timestamp,
              troubleshooting: parsedError.troubleshooting,
            },
            error: `Media upload failed: ${parsedError.message}`,
            success: false,
          });
        }
      } catch {
        // Not a JSON error, handle as regular error
      }

      // Fallback to original error format
      const errorResponse = {
        error: `Media upload failed: ${errorMessage}`,
        success: false,
      };

      return JSON.stringify(errorResponse);
    }
  }

  private extractFileName(filePath: string): string {
    return filePath.split("/").pop() || filePath.split("\\").pop() || filePath;
  }

  private generateStorageKey(
    fileName: string,
    storageType: "permanent" | "temporal",
  ): string {
    const cleanFileName = this.extractFileName(fileName);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    return `media/${storageType}/${timestamp}-${randomSuffix}-${cleanFileName}`;
  }

  private prepareMetadata(
    userMetadata: Record<string, string> | undefined,
    mimeType: string,
    storageType: string,
    fileSize: number,
  ): Record<string, string> {
    const metadata: Record<string, string> = {
      "content-type": mimeType,
      "file-size": fileSize.toString(),
      "storage-type": storageType,
      "uploaded-at": new Date().toISOString(),
      "uploaded-by": "permamind-media-tools",
      ...(userMetadata || {}),
    };

    return metadata;
  }

  private sanitizeFilePath(filePath: string): string {
    // Enhanced path sanitization to prevent directory traversal and null byte attacks
    if (filePath.includes("..") || filePath.includes("\0")) {
      throw new Error(
        "Invalid file path: directory traversal or null byte patterns are not allowed",
      );
    }

    // Normalize path separators and remove excessive slashes
    const normalizedPath = filePath.replace(/\/+/g, "/").replace(/\\+/g, "\\");

    // Basic length validation
    if (normalizedPath.length > 1000) {
      throw new Error(
        "Invalid file path: path length exceeds maximum allowed (1000 characters)",
      );
    }

    return normalizedPath;
  }

  private validateFileExtension(filePath: string): void {
    const extension = extname(filePath).toLowerCase();
    if (UploadMediaCommand.BLOCKED_EXTENSIONS.has(extension)) {
      throw new Error(
        `File type not allowed: ${extension} files are blocked for security reasons`,
      );
    }
  }

  private async validateFileSize(size: number): Promise<void> {
    // Default max file size from LoadNetworkStorageService (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (size > maxSize) {
      throw new Error(
        `File size ${size} bytes exceeds maximum allowed size of ${maxSize} bytes (100MB)`,
      );
    }
  }

  private async validateMimeType(filePath: string): Promise<string> {
    // Get MIME type from file extension
    const mimeType = lookup(filePath);
    if (!mimeType) {
      throw new Error(
        `Unable to determine MIME type for file: ${filePath}. Please ensure the file has a proper extension.`,
      );
    }

    // Check if MIME type is allowed
    if (!UploadMediaCommand.ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `MIME type ${mimeType} is not allowed. Supported types include images, documents, archives, audio, and video files.`,
      );
    }

    return mimeType;
  }
}
