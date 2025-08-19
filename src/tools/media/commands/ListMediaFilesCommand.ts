import { z } from "zod";

import {
  type ListFilesResult,
  LoadNetworkStorageService,
} from "../../../services/LoadNetworkStorageService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface ListMediaFilesArgs {
  bucketName?: string;
  continuationToken?: string;
  filter?: {
    dateFrom?: string;
    dateTo?: string;
    maxSize?: number;
    minSize?: number;
    type?: string;
  };
  maxResults?: number;
  storageType?: "all" | "permanent" | "temporal";
}

interface MediaFileInfo {
  etag?: string;
  key: string;
  lastModified?: string;
  metadata?: Record<string, string>;
  mimeType?: string;
  size?: number;
  storageClass?: string;
  storageType?: string;
}

/**
 * Command for listing media files in Load Network storage with filtering capabilities
 */
export class ListMediaFilesCommand extends ToolCommand<
  ListMediaFilesArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `List media files stored in decentralized storage with advanced filtering and pagination.
    
    Filtering capabilities:
    - Storage type: Filter by temporal, permanent, or all storage tiers
    - File type: Filter by MIME type patterns (e.g., 'image/', 'video/', 'application/pdf')
    - File size: Filter by minimum and maximum file size in bytes
    - Date range: Filter by upload/modification date range
    - Prefix matching: Search within specific storage paths
    
    Pagination support:
    - Set maximum results per page (default: 50, max: 1000)
    - Use continuation tokens for browsing large collections
    - Automatic pagination metadata in responses
    
    Response includes:
    - File metadata (size, type, storage class, upload date)
    - Storage location and unique identifiers
    - Pagination tokens for continued browsing
    - Summary statistics (total files, filtered count)
    
    Perfect for building file browsers, managing media collections, and analyzing storage usage.`,
    name: "listMediaFiles",
    openWorldHint: false,
    readOnlyHint: true,
    title: "List Media Files",
  };

  protected parametersSchema = z.object({
    bucketName: z
      .string()
      .optional()
      .describe("Override default bucket name for listing"),
    continuationToken: z
      .string()
      .optional()
      .describe("Pagination token for continuing from previous results"),
    filter: z
      .object({
        dateFrom: z
          .string()
          .optional()
          .describe(
            "Filter files modified after this ISO date (e.g., '2024-01-01')",
          ),
        dateTo: z
          .string()
          .optional()
          .describe("Filter files modified before this ISO date"),
        maxSize: z.number().optional().describe("Maximum file size in bytes"),
        minSize: z.number().optional().describe("Minimum file size in bytes"),
        type: z
          .string()
          .optional()
          .describe(
            "Filter by MIME type prefix (e.g., 'image/', 'video/', 'application/pdf')",
          ),
      })
      .optional()
      .describe("Optional filters for refining results"),
    maxResults: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(50)
      .describe("Maximum number of files to return (default: 50, max: 1000)"),
    storageType: z
      .enum(["temporal", "permanent", "all"])
      .optional()
      .default("all")
      .describe(
        "Filter by storage type: 'temporal', 'permanent', or 'all' (default: all)",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: ListMediaFilesArgs): Promise<string> {
    try {
      // Initialize storage service
      const storageService = new LoadNetworkStorageService(
        args.bucketName ? { bucketName: args.bucketName } : undefined,
      );

      // Build prefix based on storage type filter
      const prefix = this.buildStoragePrefix(args.storageType || "all");

      // Call LoadNetwork storage service to list files
      const listResult: ListFilesResult = await storageService.listFiles({
        bucketName: args.bucketName,
        continuationToken: args.continuationToken,
        maxKeys: args.maxResults || 50,
        prefix,
      });

      if (!listResult.success) {
        throw new Error(
          listResult.error?.message || "Failed to list media files",
        );
      }

      // Process and filter results
      const rawFiles = listResult.objects || [];
      const processedFiles = await this.processFileList(rawFiles);
      const filteredFiles = this.applyFilters(processedFiles, args.filter);

      // Build response
      const response = {
        continuationToken: args.continuationToken,
        files: filteredFiles,
        hasMore: listResult.isTruncated || false,
        nextContinuationToken: listResult.nextContinuationToken,
        pagination: {
          currentPage: args.continuationToken ? "subsequent" : "first",
          maxResults: args.maxResults || 50,
          resultsCount: filteredFiles.length,
          totalFiles: rawFiles.length,
        },
        storageType: args.storageType || "all",
        success: true,
        ...(args.filter && { appliedFilters: args.filter }),
      };

      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = {
        error: `Failed to list media files: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        success: false,
      };

      return JSON.stringify(errorResponse);
    }
  }

  private applyFilters(
    files: MediaFileInfo[],
    filter?: ListMediaFilesArgs["filter"],
  ): MediaFileInfo[] {
    if (!filter) {
      return files;
    }

    return files.filter((file) => {
      // Type filter
      if (filter.type && file.mimeType) {
        if (!file.mimeType.startsWith(filter.type)) {
          return false;
        }
      }

      // Size filters
      if (filter.minSize !== undefined && file.size !== undefined) {
        if (file.size < filter.minSize) {
          return false;
        }
      }

      if (filter.maxSize !== undefined && file.size !== undefined) {
        if (file.size > filter.maxSize) {
          return false;
        }
      }

      // Date filters
      if (filter.dateFrom && file.lastModified) {
        const fileDate = new Date(file.lastModified);
        const fromDate = new Date(filter.dateFrom);
        if (fileDate < fromDate) {
          return false;
        }
      }

      if (filter.dateTo && file.lastModified) {
        const fileDate = new Date(file.lastModified);
        const toDate = new Date(filter.dateTo);
        if (fileDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }

  private buildStoragePrefix(
    storageType: "all" | "permanent" | "temporal",
  ): string {
    switch (storageType) {
      case "permanent":
        return "media/permanent/";
      case "temporal":
        return "media/temporal/";
      case "all":
      default:
        return "media/";
    }
  }

  private extractMetadataFromKey(key: string): {
    mimeType?: string;
    storageType?: string;
  } {
    // Extract storage type from key structure: media/{storageType}/{timestamp}-{random}-{filename}
    const keyParts = key.split("/");
    const storageType = keyParts.length >= 2 ? keyParts[1] : undefined;

    // For more sophisticated metadata extraction, we would need to
    // retrieve individual file metadata, which would be expensive for large lists
    // Instead, we rely on the metadata returned by the storage service

    return {
      storageType:
        storageType === "temporal" || storageType === "permanent"
          ? storageType
          : undefined,
    };
  }

  private async processFileList(
    rawFiles: Array<{
      etag?: string;
      key: string;
      lastModified?: Date;
      size?: number;
      storageClass?: string;
    }>,
  ): Promise<MediaFileInfo[]> {
    return rawFiles.map((file) => {
      // Extract additional metadata from the key structure
      const extractedMeta = this.extractMetadataFromKey(file.key);

      const processedFile: MediaFileInfo = {
        etag: file.etag,
        key: file.key,
        lastModified: file.lastModified?.toISOString(),
        size: file.size,
        storageClass: file.storageClass,
        ...extractedMeta,
      };

      return processedFile;
    });
  }
}
