import { constants } from "fs";
import { access, stat } from "fs/promises";
import { z } from "zod";

import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_TOKEN,
} from "../../../constants.js";
import {
  TurboFileUploadProgress,
  TurboService,
} from "../../../services/TurboService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface UploadFolderToArweaveArgs {
  concurrentUploads?: number;
  excludePatterns?: string[];
  folderPath: string;
  includePatterns?: string[];
  paymentMethod?: "credits" | "tokens";
  tags?: { name: string; value: string }[];
}

export class UploadFolderToArweaveCommand extends ToolCommand<
  UploadFolderToArweaveArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Upload an entire folder/directory to Arweave using Turbo SDK for permanent storage with manifest generation.
    
    🎯 USE CASE: Use this tool for uploading multiple files/folders to Arweave for permanent storage.
    For deploying complete websites/applications to the Permaweb with ArNS integration, use deployPermawebDirectory instead.
    
    This tool provides comprehensive folder upload capabilities:
    - Upload all files in a directory with recursive traversal
    - Generate Arweave manifest for browsable file structure
    - Support file filtering with include/exclude patterns
    - Concurrent uploads for improved performance
    - Individual file status tracking and error reporting
    - Automatic content-type detection for each file
    - Rollback handling for failed uploads
    
    Features:
    - Includes common web files (HTML, CSS, JS, images, etc.)
    - Excludes hidden files and node_modules by default
    - Progress reporting with individual file status
    - Manifest generation following Arweave standards
    - Gateway-browsable URLs for deployed applications
    
    Payment Methods:
    - 'tokens': Pay directly with Arweave (AR) tokens - default (amount auto-calculated)
    - 'credits': Use Turbo credits (winc) - alternative, cost-effective
    
    Prerequisites:
    - SEED_PHRASE environment variable with valid 12-word mnemonic
    - Sufficient Turbo credits OR Arweave tokens for upload costs
    - Folder must be accessible with readable files
    
    Returns:
    - Manifest transaction ID for browsable folder access
    - Individual file transaction IDs and status
    - Upload statistics and cost information
    - Auto-calculated token amount (for token payments)
    - Detailed error reporting with solutions`,
    name: "uploadFolderToArweave",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Upload Folder to Arweave (ArDrive/Turbo)",
  };

  protected parametersSchema = z.object({
    concurrentUploads: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe(
        "Number of concurrent uploads (1-20, default: 5). Higher values may be faster but use more resources.",
      ),
    excludePatterns: z
      .array(z.string())
      .optional()
      .describe(
        "Array of glob patterns for files to exclude (e.g., ['*.tmp', '*.log', 'node_modules/*']). Applied after include patterns.",
      ),
    folderPath: z
      .string()
      .min(1)
      .describe(
        "Path to the folder/directory to upload. Can be absolute or relative path.",
      ),
    includePatterns: z
      .array(z.string())
      .optional()
      .describe(
        "Array of glob patterns for files to include (e.g., ['*.html', '*.css', '*.js']). If not provided, includes all files.",
      ),
    paymentMethod: z
      .enum(["credits", "tokens"])
      .optional()
      .describe(
        "Payment method: 'tokens' uses Arweave tokens directly (default, amount auto-calculated), 'credits' uses Turbo credits as alternative",
      ),
    tags: z
      .array(
        z.object({
          name: z.string().min(1).describe("Tag name"),
          value: z.string().describe("Tag value"),
        }),
      )
      .optional()
      .describe(
        "Additional tags to attach to all uploaded files for metadata and indexing.",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: UploadFolderToArweaveArgs): Promise<string> {
    // Determine effective payment method at function scope for error handling
    const effectivePaymentMethod = args.paymentMethod || DEFAULT_PAYMENT_METHOD;

    try {
      // Validate folder exists and is accessible
      try {
        await access(args.folderPath, constants.F_OK | constants.R_OK);
      } catch (accessError) {
        return JSON.stringify({
          error: {
            code: "FOLDER_ACCESS_DENIED",
            details: accessError,
            message: `Cannot access folder at ${args.folderPath}`,
            solutions: [
              "Check that the folder path is correct",
              "Verify the folder exists at the specified location",
              "Ensure you have read permissions for the folder",
              "Use an absolute path if using a relative path",
            ],
          },
          success: false,
        });
      }

      // Validate it's a directory
      const folderStat = await stat(args.folderPath);
      if (!folderStat.isDirectory()) {
        return JSON.stringify({
          error: {
            code: "NOT_A_DIRECTORY",
            message: `Path ${args.folderPath} is not a directory`,
            solutions: [
              "Provide a path to a directory, not a file",
              "Check that the folder exists and is accessible",
              "Ensure the path points to an actual directory",
              "Use the uploadToArweave tool for single file uploads",
            ],
          },
          success: false,
        });
      }

      // Initialize Turbo service with payment configuration
      const turboService = new TurboService({
        paymentMethod: args.paymentMethod || DEFAULT_PAYMENT_METHOD,
        paymentToken: DEFAULT_PAYMENT_TOKEN, // Default to AR tokens when using token payment
      });

      // Calculate folder size and token amount if using token payment
      let calculatedTokenAmount: string | undefined;
      if (effectivePaymentMethod === "tokens") {
        // First, collect files to calculate total size
        const filesResult = await (
          turboService as unknown as {
            collectFiles: (
              folderPath: string,
              includePatterns: string[],
              excludePatterns: string[],
              maxFileSize?: number,
            ) => Promise<{
              error?: { code: string; message: string; solutions: string[] };
              files?: Array<{
                filePath: string;
                relativePath: string;
                size: number;
              }>;
              success: boolean;
            }>;
          }
        ).collectFiles(
          args.folderPath,
          args.includePatterns || [],
          args.excludePatterns || [],
        );

        if (!filesResult.success) {
          return JSON.stringify({
            error: {
              code: "FOLDER_SCAN_FAILED",
              message:
                filesResult.error?.message ||
                "Failed to scan folder for size calculation",
              solutions: [
                "Check that the folder exists and is readable",
                "Verify folder permissions",
                "Ensure the folder contains accessible files",
                "Try with a different folder path",
                ...(filesResult.error?.solutions || []),
              ],
            },
            success: false,
          });
        }

        // Calculate total folder size
        const totalBytes =
          filesResult.files?.reduce(
            (
              sum: number,
              file: { filePath: string; relativePath: string; size: number },
            ) => sum + file.size,
            0,
          ) || 0;

        if (totalBytes === 0) {
          return JSON.stringify({
            error: {
              code: "EMPTY_FOLDER",
              message: "Folder contains no uploadable files",
              solutions: [
                "Ensure the folder contains files",
                "Check include/exclude patterns are not filtering out all files",
                "Verify file permissions allow reading",
                "Try with a different folder that contains files",
              ],
            },
            success: false,
          });
        }

        // Get required token amount for the total folder size with enhanced error handling
        let priceResult;
        try {
          priceResult = (await Promise.race([
            turboService.getTokenPriceForBytes({
              byteCount: totalBytes,
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Price calculation timeout")),
                30000,
              ),
            ),
          ])) as Awaited<ReturnType<typeof turboService.getTokenPriceForBytes>>;
        } catch {
          return JSON.stringify({
            error: {
              code: "PRICE_CALCULATION_TIMEOUT",
              message: "Price calculation request timed out",
              solutions: [
                "Check your internet connection and try again",
                "Verify Turbo service is accessible",
                "Consider using 'credits' payment method as fallback",
                "Try again with a smaller folder",
              ],
            },
            success: false,
          });
        }

        if (!priceResult.success) {
          return JSON.stringify({
            error: {
              code: "PRICE_CALCULATION_FAILED",
              message:
                priceResult.error?.message || "Failed to calculate upload cost",
              solutions: [
                "Check your internet connection",
                "Verify the folder size is valid",
                "Try again after a few moments",
                "Consider using 'credits' payment method as fallback",
                "Ensure your wallet is properly configured for token payments",
              ],
            },
            success: false,
          });
        }

        // Store the calculated token amount for later use
        calculatedTokenAmount = priceResult.tokenAmount || "0";

        // Validate the calculated amount is reasonable
        const tokenValidationResult = this.validateTokenAmount(
          calculatedTokenAmount,
        );
        if (!tokenValidationResult.success) {
          return JSON.stringify({
            error: tokenValidationResult.error,
            success: false,
          });
        }
      }

      // Track progress for reporting
      const progressReports: TurboFileUploadProgress[] = [];

      // If using token payment, handle token top-up first with enhanced error handling
      if (effectivePaymentMethod === "tokens" && calculatedTokenAmount) {
        let topUpResult;
        try {
          topUpResult = (await Promise.race([
            turboService.topUpWithTokens({
              tokenAmount: calculatedTokenAmount,
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Token top-up timeout")),
                60000,
              ),
            ),
          ])) as Awaited<ReturnType<typeof turboService.topUpWithTokens>>;
        } catch {
          return JSON.stringify({
            error: {
              code: "TOKEN_TOP_UP_TIMEOUT",
              message: "Token top-up request timed out",
              solutions: [
                "Check your internet connection and try again",
                "Verify Arweave network is accessible",
                "Consider using 'credits' payment method as fallback",
                "Try again with a smaller folder",
                "Ensure your wallet has sufficient AR tokens",
              ],
            },
            success: false,
          });
        }

        if (!topUpResult.success) {
          return JSON.stringify({
            error: {
              code: "TOKEN_TOP_UP_FAILED",
              message:
                topUpResult.error?.message || "Failed to top up with tokens",
              solutions: [
                "Verify you have sufficient AR tokens in your wallet",
                "Check that your SEED_PHRASE is correct",
                "Ensure your wallet is funded with Arweave tokens",
                "Try with a smaller folder or fewer files",
                "Consider using 'credits' payment method",
                "Verify your wallet supports Arweave token payments",
                "Check if the Arweave network is experiencing issues",
              ],
            },
            success: false,
          });
        }
      }

      // Upload the folder with progress tracking
      const uploadResult = await turboService.uploadFolder({
        concurrentUploads: args.concurrentUploads ?? 5, // Apply default if not provided
        excludePatterns: args.excludePatterns,
        folderPath: args.folderPath,
        includePatterns: args.includePatterns,
        onProgress: (progress: TurboFileUploadProgress) => {
          // Collect progress reports for final summary
          progressReports.push({ ...progress });
        },
        tags: args.tags,
      });

      if (!uploadResult.success) {
        return JSON.stringify({
          error: uploadResult.error,
          progressSummary:
            progressReports.length > 0
              ? progressReports[progressReports.length - 1]
              : undefined,
          success: false,
        });
      }

      // Prepare successful response with comprehensive information
      const response = {
        failedFiles: uploadResult.failedFiles,
        folderPath: args.folderPath,
        individualResults: uploadResult.individualResults,
        manifestId: uploadResult.manifestId,
        manifestUrl: uploadResult.manifestId
          ? `https://arweave.net/${uploadResult.manifestId}`
          : undefined,
        paymentMethod: args.paymentMethod || DEFAULT_PAYMENT_METHOD,
        success: true,
        tokenAmount: calculatedTokenAmount,
        totalFiles: uploadResult.totalFiles,
        totalSize: uploadResult.totalSize,
        uploadedFiles: uploadResult.uploadedFiles,
      };

      // Add gateway URLs for easier access
      if (uploadResult.manifestId) {
        response.manifestUrl = `https://arweave.net/${uploadResult.manifestId}`;
        (response as { gatewayUrl: string } & typeof response).gatewayUrl =
          `https://${uploadResult.manifestId}.arweave.net`;
      }

      return JSON.stringify(response);
    } catch (error) {
      return JSON.stringify({
        error: {
          code: "FOLDER_UPLOAD_ERROR",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown folder upload error",
          solutions: [
            "Check that the folder exists and is readable",
            "Verify your SEED_PHRASE environment variable is set",
            effectivePaymentMethod === "tokens"
              ? "Ensure you have sufficient Arweave tokens for all files"
              : "Ensure you have sufficient Turbo credits for all files",
            "Check your internet connection",
            "Try uploading a smaller folder first",
            "Check file permissions in the folder",
            effectivePaymentMethod === "tokens"
              ? "Consider using 'credits' payment method for large folders"
              : "Consider breaking up large folders into smaller batches",
          ],
        },
        success: false,
      });
    }
  }

  private validateTokenAmount(tokenAmount: string): {
    error?: { code: string; message: string; solutions: string[] };
    success: boolean;
  } {
    // Check format - must be positive integer
    if (!/^\d+$/.test(tokenAmount)) {
      return {
        error: {
          code: "INVALID_TOKEN_AMOUNT_FORMAT",
          message:
            "Token amount must be a valid positive integer in Winston (smallest AR unit)",
          solutions: [
            "Provide token amount as a whole number in Winston",
            "Example: '1000000000000' for 0.001 AR",
            "Ensure no decimal places, negative numbers, or non-numeric characters",
            "Use getTokenPriceForBytes to estimate total cost for folder",
            "Consider using 'credits' payment method for large folders",
          ],
        },
        success: false,
      };
    }

    // Check for reasonable bounds
    const tokenAmountBigInt = BigInt(tokenAmount);

    // Minimum: 1 Winston (prevent zero/empty uploads)
    if (tokenAmountBigInt <= 0n) {
      return {
        error: {
          code: "TOKEN_AMOUNT_TOO_SMALL",
          message: "Token amount must be greater than 0 Winston",
          solutions: [
            "Provide a positive token amount",
            "Use getTokenPriceForBytes to calculate minimum required amount",
            "Consider using 'credits' payment method for very small folders",
          ],
        },
        success: false,
      };
    }

    // Maximum: 10000 AR for folder uploads (higher than single files due to multiple files)
    const maxTokenAmount = BigInt("10000000000000000"); // 10000 AR in Winston
    if (tokenAmountBigInt > maxTokenAmount) {
      return {
        error: {
          code: "TOKEN_AMOUNT_TOO_LARGE",
          message:
            "Token amount exceeds maximum limit (10000 AR) for folder uploads",
          solutions: [
            "Reduce token amount to a reasonable value",
            "Use getTokenPriceForBytes to calculate exact required amount for the folder",
            "Verify the amount is correct (Winston units are very small)",
            "Consider breaking the folder into smaller uploads",
            "Use 'credits' payment method for very large folder uploads",
          ],
        },
        success: false,
      };
    }

    return { success: true };
  }
}
