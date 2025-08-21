import { constants } from "fs";
import { access, readFile, stat } from "fs/promises";
import { z } from "zod";

import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_TOKEN,
} from "../../../constants.js";
import { TurboService } from "../../../services/TurboService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface UploadToArweaveArgs {
  contentType?: string;
  filePath: string;
  paymentMethod?: "credits" | "tokens";
  tags?: { name: string; value: string }[];
  target?: string;
}

export class UploadToArweaveCommand extends ToolCommand<
  UploadToArweaveArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: `Upload a single file to Arweave using Turbo SDK for permanent storage.
    
    🎯 USE CASE: Use this tool for uploading individual files to Arweave for permanent storage.
    For deploying complete websites/applications to the Permaweb, use deployPermawebDirectory instead.
    
    This tool provides permanent file storage on Arweave with the following features:
    - Upload any file type with automatic content-type detection
    - Add custom tags and metadata for better organization
    - Target specific addresses for payment or routing
    - Immediate transaction ID for permanent access
    - Flexible payment options: Turbo credits or Arweave tokens
    
    Payment Methods:
    - 'tokens': Pay directly with Arweave (AR) tokens - default (amount auto-calculated)
    - 'credits': Use Turbo credits (winc) - alternative, cost-effective
    
    Prerequisites:
    - SEED_PHRASE environment variable with valid 12-word mnemonic
    - Sufficient Turbo credits OR Arweave tokens for upload costs
    - File must be accessible and within size limits (10MB default)
    
    Returns:
    - Transaction ID for permanent Arweave access
    - Upload size and cost information
    - Payment method used
    - Detailed error messages with actionable solutions`,
    name: "uploadToArweave",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Upload File to Arweave (ArDrive/Turbo)",
  };

  protected parametersSchema = z.object({
    contentType: z
      .string()
      .optional()
      .describe(
        "MIME type of the file (optional). If not provided, will be auto-detected from file extension.",
      ),
    filePath: z
      .string()
      .min(1)
      .describe(
        "Path to the file to upload. Can be absolute or relative path.",
      ),
    paymentMethod: z
      .enum(["credits", "tokens"])
      .optional()
      .describe(
        "Payment method: 'tokens' uses Arweave tokens directly (default), 'credits' uses Turbo credits as alternative",
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
        "Additional tags to attach to the upload for metadata and indexing.",
      ),
    target: z
      .string()
      .optional()
      .describe(
        "Target address for payment or routing (optional). Must be a valid Arweave address.",
      ),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: UploadToArweaveArgs): Promise<string> {
    try {
      // Validate file exists and is accessible
      try {
        await access(args.filePath, constants.F_OK | constants.R_OK);
      } catch (accessError) {
        return JSON.stringify({
          error: {
            code: "FILE_ACCESS_DENIED",
            details: accessError,
            message: `Cannot access file at ${args.filePath}`,
            solutions: [
              "Check that the file path is correct",
              "Verify the file exists at the specified location",
              "Ensure you have read permissions for the file",
              "Use an absolute path if using a relative path",
            ],
          },
          success: false,
        });
      }

      // Validate it's a regular file
      const fileStat = await stat(args.filePath);
      if (!fileStat.isFile()) {
        return JSON.stringify({
          error: {
            code: "NOT_A_FILE",
            message: `Path ${args.filePath} is not a regular file`,
            solutions: [
              "Provide a path to a regular file, not a directory or special file",
              "Check that the file exists and is not a symbolic link",
              "Ensure the path points to an actual file",
            ],
          },
          success: false,
        });
      }

      // Validate file size
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileStat.size > maxSize) {
        return JSON.stringify({
          error: {
            code: "FILE_TOO_LARGE",
            message: `File size ${fileStat.size} bytes exceeds maximum allowed size ${maxSize} bytes`,
            solutions: [
              `Reduce file size to under ${maxSize / (1024 * 1024)}MB`,
              "Compress the file if possible",
              "Split large files into smaller chunks",
              "Use the uploadFolderToArweave tool for batch uploads",
            ],
          },
          success: false,
        });
      }

      // Read file content
      const fileContent = await readFile(args.filePath);

      // Initialize Turbo service with payment configuration
      const turboService = new TurboService({
        paymentMethod: args.paymentMethod || DEFAULT_PAYMENT_METHOD,
        paymentToken: DEFAULT_PAYMENT_TOKEN, // Default to AR tokens when using token payment
      });

      // If using token payment, calculate required amount and top up if needed
      let calculatedTokenAmount: string | undefined;
      const effectivePaymentMethod =
        args.paymentMethod || DEFAULT_PAYMENT_METHOD;
      if (effectivePaymentMethod === "tokens") {
        // Get required token amount for the file size with enhanced error handling
        let priceResult;
        try {
          priceResult = (await Promise.race([
            turboService.getTokenPriceForBytes({
              byteCount: fileContent.length,
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
                "Try again with a smaller file size",
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
                "Verify the file size is valid",
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

      // Detect content type if not provided by user
      const contentType =
        args.contentType || this.detectContentTypeFromPath(args.filePath);

      // Upload the file
      const uploadResult = await turboService.uploadFile({
        contentType: contentType,
        data: fileContent,
        tags: args.tags,
        target: args.target,
      });

      if (!uploadResult.success) {
        return JSON.stringify({
          error: uploadResult.error,
          success: false,
        });
      }

      return JSON.stringify({
        filePath: args.filePath,
        paymentMethod:
          uploadResult.paymentMethod ||
          args.paymentMethod ||
          DEFAULT_PAYMENT_METHOD,
        size: uploadResult.size,
        success: true,
        tokenAmount: calculatedTokenAmount,
        transactionId: uploadResult.transactionId,
        url: `https://arweave.net/${uploadResult.transactionId}`,
        winc: uploadResult.winc,
      });
    } catch (error) {
      return JSON.stringify({
        error: {
          code: "UPLOAD_ERROR",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown upload error",
          solutions: [
            "Check that the file exists and is readable",
            "Verify your SEED_PHRASE environment variable is set",
            "Ensure you have sufficient Turbo credits",
            "Check your internet connection",
            "Try uploading a smaller file first",
          ],
        },
        success: false,
      });
    }
  }

  private detectContentTypeFromPath(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();

    const mimeMap: Record<string, string> = {
      aac: "audio/aac",
      avi: "video/x-msvideo",
      css: "text/css",
      csv: "text/csv",
      // Office documents
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      flac: "audio/flac",
      flv: "video/x-flv",
      gif: "image/gif",
      gz: "application/gzip",
      htm: "text/html",
      // Web files
      html: "text/html",
      ico: "image/x-icon",

      jpeg: "image/jpeg",
      // Images
      jpg: "image/jpeg",
      js: "application/javascript",
      json: "application/json",
      m4a: "audio/mp4",

      markdown: "text/markdown",
      md: "text/markdown",

      mkv: "video/x-matroska",
      mov: "video/quicktime",
      // Audio/Video
      mp3: "audio/mpeg",

      mp4: "video/mp4",
      ogg: "video/ogg", // OGG can be video or audio, prioritizing video
      // Documents
      pdf: "application/pdf",
      png: "image/png",
      svg: "image/svg+xml",
      tar: "application/x-tar",
      txt: "text/plain",
      // Additional audio formats
      wav: "audio/wav",
      webm: "video/webm",
      webp: "image/webp",
      wmv: "video/x-ms-wmv",
      xml: "application/xml",
      // Archives
      zip: "application/zip",
    };

    return mimeMap[extension || ""] || "application/octet-stream";
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
            "Use getTokenPriceForBytes to calculate required amount",
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
            "Consider using 'credits' payment method for very small uploads",
          ],
        },
        success: false,
      };
    }

    // Maximum: 1000 AR (prevent accidental overpayment)
    const maxTokenAmount = BigInt("1000000000000000"); // 1000 AR in Winston
    if (tokenAmountBigInt > maxTokenAmount) {
      return {
        error: {
          code: "TOKEN_AMOUNT_TOO_LARGE",
          message: "Token amount exceeds maximum limit (1000 AR)",
          solutions: [
            "Reduce token amount to a reasonable value",
            "Use getTokenPriceForBytes to calculate exact required amount",
            "Verify the amount is correct (Winston units are very small)",
            "Consider breaking large uploads into smaller chunks",
          ],
        },
        success: false,
      };
    }

    return { success: true };
  }
}
