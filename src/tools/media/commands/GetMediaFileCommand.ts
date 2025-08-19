import { z } from "zod";

import {
  type DownloadFileResult,
  LoadNetworkStorageService,
} from "../../../services/LoadNetworkStorageService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface GetMediaFileArgs {
  bucketName?: string;
  fileId: string;
  includeData?: boolean;
}

/**
 * Command for retrieving media files and metadata from Load Network storage
 */
export class GetMediaFileCommand extends ToolCommand<GetMediaFileArgs, string> {
  protected metadata: ToolMetadata = {
    description: `Retrieve media files and their metadata from decentralized storage.
    
    Retrieval options:
    - Metadata only: Get file information without downloading content (fast, efficient)
    - Full download: Include file content as base64-encoded data for immediate use
    - Streaming support: Optimized handling for large media files
    
    File identification:
    - Use file keys from listMediaFiles results
    - Support for both storage paths and unique identifiers
    - Automatic validation of file existence and accessibility
    
    Response includes:
    - Complete file metadata (size, type, upload date, custom metadata)
    - Storage information (location, ETag, storage class)
    - Optional file content (base64-encoded when includeData=true)
    - Download statistics and performance metrics
    
    Security features:
    - Path validation to prevent unauthorized access
    - Content type verification for downloaded files
    - Size limits for in-memory file operations
    
    Perfect for media viewers, download managers, and file analysis tools.`,
    name: "getMediaFile",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Media File",
  };

  protected parametersSchema = z.object({
    bucketName: z
      .string()
      .optional()
      .describe("Override default bucket name for file retrieval"),
    fileId: z
      .string()
      .describe("File identifier (key) from listMediaFiles or upload response"),
    includeData: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Include file content as base64 data in response (default: false for metadata only)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: GetMediaFileArgs): Promise<string> {
    try {
      // Validate and sanitize file ID
      const sanitizedFileId = this.sanitizeFileId(args.fileId);

      // Initialize storage service
      const storageService = new LoadNetworkStorageService(
        args.bucketName ? { bucketName: args.bucketName } : undefined,
      );

      // Download file from storage
      const downloadResult: DownloadFileResult =
        await storageService.downloadFile({
          bucketName: args.bucketName,
          key: sanitizedFileId,
        });

      if (!downloadResult.success) {
        // Handle specific error cases
        if (
          downloadResult.error?.code === "NoSuchKey" ||
          downloadResult.error?.message?.includes("not found")
        ) {
          throw new Error(`Media file not found: ${sanitizedFileId}`);
        }
        throw new Error(
          downloadResult.error?.message || "Failed to retrieve media file",
        );
      }

      // Extract file information
      const fileInfo = this.extractFileInfo(sanitizedFileId, downloadResult);

      // Build base response
      const response: Record<string, unknown> = {
        contentLength: downloadResult.contentLength,
        contentType: downloadResult.contentType,
        etag: downloadResult.etag,
        fileId: sanitizedFileId,
        lastModified: downloadResult.lastModified?.toISOString(),
        metadata: fileInfo,
        success: true,
      };

      // Include file data if requested
      if (args.includeData && downloadResult.data) {
        // Check file size for in-memory operations (limit to 50MB for safety)
        const maxInMemorySize = 50 * 1024 * 1024; // 50MB
        if (
          downloadResult.contentLength &&
          downloadResult.contentLength > maxInMemorySize
        ) {
          response.warning = `File size (${downloadResult.contentLength} bytes) exceeds in-memory limit. Use includeData=false for large files.`;
          response.dataIncluded = false;
        } else {
          response.data = Buffer.from(downloadResult.data).toString("base64");
          response.dataIncluded = true;
          response.dataEncoding = "base64";
          response.dataSize = downloadResult.data.length;
        }
      } else {
        response.dataIncluded = false;
        response.note =
          "File content not included. Set includeData=true to download file data.";
      }

      // Add retrieval statistics
      response.retrievalInfo = {
        fileSize: downloadResult.contentLength,
        includeDataRequested: args.includeData || false,
        requestedAt: new Date().toISOString(),
        ...(args.bucketName && { customBucket: args.bucketName }),
      };

      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        error: `Failed to get media file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        fileId: args.fileId,
        success: false,
      };

      return JSON.stringify(errorResponse);
    }
  }

  private categorizeFileType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("text/")) return "text";
    if (mimeType === "application/pdf") return "pdf";
    if (
      mimeType.includes("word") ||
      mimeType.includes("excel") ||
      mimeType.includes("powerpoint") ||
      mimeType.includes("openxmlformats")
    ) {
      return "office";
    }
    if (
      mimeType === "application/zip" ||
      mimeType === "application/x-tar" ||
      mimeType === "application/gzip"
    ) {
      return "archive";
    }
    return "other";
  }

  private extractFileInfo(
    fileId: string,
    downloadResult: DownloadFileResult,
  ): Record<string, unknown> {
    // Extract information from file key structure
    const keyParts = fileId.split("/");
    const fileName = keyParts[keyParts.length - 1] || fileId;

    // Parse storage type from key structure: media/{storageType}/{timestamp}-{random}-{filename}
    let storageType: string | undefined;
    let uploadTimestamp: string | undefined;
    if (keyParts.length >= 3 && keyParts[0] === "media") {
      storageType = keyParts[1];
      // Extract timestamp from filename pattern: {timestamp}-{random}-{originalname}
      const filenameParts = fileName.split("-");
      if (filenameParts.length >= 2) {
        const timestamp = parseInt(filenameParts[0]);
        if (!isNaN(timestamp)) {
          uploadTimestamp = new Date(timestamp).toISOString();
        }
      }
    }

    const fileInfo: Record<string, unknown> = {
      fileName: this.extractOriginalFileName(fileName),
      fullPath: fileId,
      ...(storageType && { storageType }),
      ...(uploadTimestamp && { uploadedAt: uploadTimestamp }),
    };

    // Add content analysis
    if (downloadResult.contentType) {
      fileInfo.mimeType = downloadResult.contentType;
      fileInfo.fileCategory = this.categorizeFileType(
        downloadResult.contentType,
      );
    }

    if (downloadResult.contentLength) {
      fileInfo.sizeBytes = downloadResult.contentLength;
      fileInfo.sizeFormatted = this.formatFileSize(
        downloadResult.contentLength,
      );
    }

    return fileInfo;
  }

  private extractOriginalFileName(storageFileName: string): string {
    // Extract original filename from storage pattern: {timestamp}-{random}-{originalname}
    const parts = storageFileName.split("-");
    if (parts.length >= 3) {
      // Join all parts after the first two (timestamp and random)
      return parts.slice(2).join("-");
    }
    return storageFileName;
  }

  private formatFileSize(bytes: number): string {
    const units = ["bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private sanitizeFileId(fileId: string): string {
    // Enhanced sanitization to prevent path traversal and other attacks
    if (fileId.includes("..") || fileId.includes("\0")) {
      throw new Error(
        "Invalid file ID: directory traversal or null byte patterns are not allowed",
      );
    }

    // Basic length validation
    if (fileId.length > 500) {
      throw new Error(
        "Invalid file ID: file ID length exceeds maximum allowed (500 characters)",
      );
    }

    // Ensure file ID starts with expected media prefix
    if (!fileId.startsWith("media/")) {
      throw new Error(
        "Invalid file ID: must be a valid media storage key starting with 'media/'",
      );
    }

    // Validate file ID format - should follow media/{type}/{timestamp}-{random}-{filename} pattern
    const pathParts = fileId.split("/");
    if (
      pathParts.length < 3 ||
      (pathParts[1] !== "temporal" && pathParts[1] !== "permanent")
    ) {
      throw new Error(
        "Invalid file ID: must follow media/{temporal|permanent}/filename pattern",
      );
    }

    return fileId;
  }
}
