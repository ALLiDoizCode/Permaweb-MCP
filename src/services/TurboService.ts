import {
  ArweaveSigner,
  TokenType,
  TurboCryptoFundResponse,
  TurboFactory,
  TurboFundWithTokensParams,
  TurboWincForTokenResponse,
} from "@ardrive/turbo-sdk";
import { constants } from "fs";
import { access, readdir, readFile, stat } from "fs/promises";
import { join, relative, sep } from "path";
import { Readable } from "stream";

import { isMainnet } from "../constants.js";
import { getKeyFromMnemonic } from "../mnemonic.js";

export interface TurboArweaveManifest {
  index?: {
    path: string;
  };
  manifest: "arweave/paths";
  paths: {
    [key: string]: TurboManifestEntry;
  };
  version: "0.1.0";
}

export interface TurboBalanceResult {
  balance?: string;
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  success: boolean;
  winc?: string;
}

export interface TurboFileUploadProgress {
  currentFile?: string;
  failedFiles: number;
  individualResults: Array<{
    error?: string;
    filePath: string;
    status: "completed" | "failed" | "pending" | "uploading";
    transactionId?: string;
  }>;
  totalFiles: number;
  uploadedFiles: number;
}

export interface TurboFolderUploadParams {
  concurrentUploads?: number;
  excludePatterns?: string[];
  folderPath: string;
  includePatterns?: string[];
  maxFileSize?: number;
  onProgress?: (progress: TurboFileUploadProgress) => void;
  tags?: { name: string; value: string }[];
}

export interface TurboFolderUploadResult {
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  failedFiles: number;
  individualResults: Array<{
    error?: string;
    filePath: string;
    status: "completed" | "failed";
    transactionId?: string;
  }>;
  manifestId?: string;
  success: boolean;
  totalFiles: number;
  totalSize?: number;
  uploadedFiles: number;
}

export interface TurboManifestEntry {
  id: string;
}

export interface TurboServiceConfig {
  apiEndpoint?: string;
  network?: "mainnet" | "testnet";
  paymentMethod?: "credits" | "tokens";
  paymentToken?: TokenType;
  walletAddress?: string;
}

export interface TurboTokenPriceResult {
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  success: boolean;
  tokenAmount?: string;
  tokenType?: TokenType;
  wincAmount?: string;
}

export interface TurboTokenTopUpParams {
  feeMultiplier?: number;
  tokenAmount: string;
}

export interface TurboTokenTopUpResult {
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  success: boolean;
  tokenAmount?: string;
  transactionId?: string;
  wincAmount?: string;
}

export interface TurboUploadCostResult {
  byteSize?: number;
  cost?: string;
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  success: boolean;
  winc?: string;
}

export interface TurboUploadParams {
  contentType?: string;
  data: ArrayBuffer | Buffer | Readable | string | Uint8Array;
  tags?: { name: string; value: string }[];
  target?: string;
}

export interface TurboUploadResult {
  error?: {
    code: string;
    details?: unknown;
    message: string;
    solutions?: string[];
  };
  paymentMethod?: "credits" | "tokens";
  size?: number;
  success: boolean;
  transactionId?: string;
  winc?: string;
}

export class TurboService {
  private config: TurboServiceConfig;
  private turboClient: unknown = null;

  constructor(config: TurboServiceConfig = {}) {
    this.config = {
      network: config.network || (isMainnet() ? "mainnet" : "testnet"),
      paymentMethod: config.paymentMethod || "credits",
      paymentToken: config.paymentToken || "arweave",
      ...config,
    };
  }

  async checkBalance(): Promise<TurboBalanceResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      const balance = await (this.turboClient as any).getBalance();

      return {
        balance: balance.winc,
        success: true,
        winc: balance.winc,
      };
    } catch (error) {
      return {
        error: {
          code: "BALANCE_CHECK_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown balance check error",
          solutions: [
            "Check your internet connection",
            "Verify your wallet configuration",
            "Ensure you have a valid Turbo account",
            "Try checking balance again after a few moments",
          ],
        },
        success: false,
      };
    }
  }

  async getTokenPriceForBytes(params: {
    byteCount: number;
  }): Promise<TurboTokenPriceResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      const priceResult = await (this.turboClient as any).getTokenPriceForBytes(
        {
          byteCount: params.byteCount,
        },
      );

      return {
        success: true,
        tokenAmount: priceResult.tokenPrice,
        tokenType: this.config.paymentToken || "arweave",
        wincAmount: priceResult.winc,
      };
    } catch (error) {
      return {
        error: {
          code: "TOKEN_PRICE_CALCULATION_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown token price calculation error",
          solutions: [
            "Check your internet connection",
            "Verify the byte count is valid",
            "Try calculating price again after a few moments",
            "Ensure you have a valid Turbo account",
          ],
        },
        success: false,
      };
    }
  }

  async getUploadCost(params: {
    data: ArrayBuffer | Buffer | string | Uint8Array;
  }): Promise<TurboUploadCostResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      // Calculate byte size
      let byteSize: number;
      if (typeof params.data === "string") {
        byteSize = Buffer.from(params.data).length;
      } else if (params.data instanceof ArrayBuffer) {
        byteSize = params.data.byteLength;
      } else {
        byteSize = params.data.length;
      }

      const costResult = await (this.turboClient as any).getUploadCosts({
        bytes: [byteSize],
      });

      const costInWinc = Array.isArray(costResult)
        ? costResult[0]?.winc || "0"
        : (costResult as any).winc;

      return {
        byteSize: byteSize,
        cost: costInWinc,
        success: true,
        winc: costInWinc,
      };
    } catch (error) {
      return {
        error: {
          code: "COST_CALCULATION_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown cost calculation error",
          solutions: [
            "Check your internet connection",
            "Verify the data size is within acceptable limits",
            "Try calculating cost again after a few moments",
            "Ensure you have a valid Turbo account",
          ],
        },
        success: false,
      };
    }
  }

  async getWincForToken(params: {
    tokenAmount: string;
  }): Promise<TurboTokenPriceResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      const conversionResult = await (this.turboClient as any).getWincForToken({
        tokenAmount: params.tokenAmount,
      });

      return {
        success: true,
        tokenAmount: params.tokenAmount,
        tokenType: this.config.paymentToken || "arweave",
        wincAmount: conversionResult.winc,
      };
    } catch (error) {
      return {
        error: {
          code: "TOKEN_CONVERSION_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown token conversion error",
          solutions: [
            "Check your internet connection",
            "Verify the token amount is valid",
            "Ensure the token amount is in the correct format (Winston for AR)",
            "Try the conversion again after a few moments",
          ],
        },
        success: false,
      };
    }
  }

  async topUpWithTokens(
    params: TurboTokenTopUpParams,
  ): Promise<TurboTokenTopUpResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      // Validate token amount
      if (!params.tokenAmount || params.tokenAmount === "0") {
        return {
          error: {
            code: "INVALID_TOKEN_AMOUNT",
            message: "Token amount must be greater than 0",
            solutions: [
              "Provide a valid token amount in the smallest unit (Winston for AR)",
              "Ensure the amount is a positive number",
              "Check the token amount format",
            ],
          },
          success: false,
        };
      }

      const topUpResult: TurboCryptoFundResponse = await (
        this.turboClient as any
      ).topUpWithTokens({
        feeMultiplier: params.feeMultiplier,
        tokenAmount: params.tokenAmount,
      });

      return {
        success: true,
        tokenAmount: params.tokenAmount,
        transactionId: topUpResult.id,
        wincAmount: topUpResult.quantity,
      };
    } catch (error) {
      return {
        error: {
          code: "TOKEN_TOPUP_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown token top-up error",
          solutions: [
            "Check your internet connection",
            "Verify you have sufficient tokens in your wallet",
            "Ensure the token amount is valid and properly formatted",
            "Check that your wallet has the necessary permissions",
            "Try the top-up again after a few moments",
          ],
        },
        success: false,
      };
    }
  }

  async uploadFile(params: TurboUploadParams): Promise<TurboUploadResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            success: false,
          };
        }
      }

      // Validate input data
      const validationResult = this.validateUploadParams(params);
      if (!validationResult.success) {
        return {
          error: validationResult.error,
          success: false,
        };
      }

      // Enhanced payment method validation
      const paymentValidationResult = await this.validatePaymentConfiguration();
      if (!paymentValidationResult.success) {
        return {
          error: paymentValidationResult.error,
          success: false,
        };
      }

      // Detect content type if not provided
      const contentType =
        params.contentType || this.detectContentType(params.data);

      // Prepare tags - ensure critical headers are not overridden by user tags
      const userTags = (params.tags || []).filter(
        (tag) =>
          tag.name !== "Content-Type" && tag.name !== "Content-Disposition",
      );

      // For images and media files, ensure proper Content-Type for browser rendering
      const tags = [{ name: "Content-Type", value: contentType }, ...userTags];

      // Only add Content-Disposition for non-media files
      const mediaTypes = ["image/", "video/", "audio/"];
      const isMediaFile = mediaTypes.some((type) =>
        contentType.startsWith(type),
      );
      if (!isMediaFile) {
        tags.push({ name: "Content-Disposition", value: "inline" });
      }

      // Handle different data types
      let uploadResult;
      let dataSize: number;

      if (params.data instanceof Readable) {
        // For streams, we need to handle differently
        // This is a simplified implementation - production code might need more sophisticated stream handling
        const chunks: Buffer[] = [];
        for await (const chunk of params.data) {
          // Ensure chunk is a Buffer
          const bufferChunk =
            chunk instanceof Buffer ? chunk : Buffer.from(chunk);
          chunks.push(bufferChunk);
        }
        const buffer = Buffer.concat(chunks);
        dataSize = buffer.length;

        uploadResult = await (this.turboClient as any).uploadFile({
          dataItemOpts: {
            tags: tags,
            target: params.target,
          },
          fileSizeFactory: () => dataSize,
          fileStreamFactory: () => Readable.from(buffer),
        });
      } else {
        // For direct data uploads
        let uploadData: Buffer | string;
        if (typeof params.data === "string") {
          uploadData = params.data;
          dataSize = Buffer.from(params.data).length;
        } else if (params.data instanceof ArrayBuffer) {
          uploadData = Buffer.from(params.data);
          dataSize = params.data.byteLength;
        } else {
          uploadData = Buffer.from(params.data);
          dataSize = params.data.length;
        }

        uploadResult = await (this.turboClient as any).uploadFile({
          dataItemOpts: {
            tags: tags,
            target: params.target,
          },
          fileSizeFactory: () => dataSize,
          fileStreamFactory: () => Readable.from(uploadData),
        });
      }

      return {
        paymentMethod: this.config.paymentMethod || "credits",
        size: dataSize,
        success: true,
        transactionId: uploadResult.id,
        winc: uploadResult.winc,
      };
    } catch (error) {
      return {
        error: {
          code: "UPLOAD_FAILED",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown upload error",
          solutions: this.getPaymentSpecificSolutions([
            "Check your internet connection",
            "Ensure the file size is within limits",
            "Try uploading again after a few moments",
            "Verify your wallet configuration is correct",
          ]),
        },
        success: false,
      };
    }
  }

  async uploadFolder(
    params: TurboFolderUploadParams,
  ): Promise<TurboFolderUploadResult> {
    try {
      // Initialize Turbo client if not already initialized
      if (!this.turboClient) {
        const initResult = await this.initializeTurboClient();
        if (!initResult.success) {
          return {
            error: initResult.error,
            failedFiles: 0,
            individualResults: [],
            success: false,
            totalFiles: 0,
            uploadedFiles: 0,
          };
        }
      }

      // Validate folder upload parameters
      const validationResult = await this.validateFolderUploadParams(params);
      if (!validationResult.success) {
        return {
          error: validationResult.error,
          failedFiles: 0,
          individualResults: [],
          success: false,
          totalFiles: 0,
          uploadedFiles: 0,
        };
      }

      // Enhanced payment method validation
      const paymentValidationResult = await this.validatePaymentConfiguration();
      if (!paymentValidationResult.success) {
        return {
          error: paymentValidationResult.error,
          failedFiles: 0,
          individualResults: [],
          success: false,
          totalFiles: 0,
          uploadedFiles: 0,
        };
      }

      // Collect files from the folder
      const filesResult = await this.collectFiles(
        params.folderPath,
        params.includePatterns || [],
        params.excludePatterns || [],
        params.maxFileSize,
      );

      if (!filesResult.success || !filesResult.files) {
        return {
          error: filesResult.error,
          failedFiles: 0,
          individualResults: [],
          success: false,
          totalFiles: 0,
          uploadedFiles: 0,
        };
      }

      const files = filesResult.files;
      if (files.length === 0) {
        return {
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
        };
      }

      // Initialize progress tracking
      const progress: TurboFileUploadProgress = {
        failedFiles: 0,
        individualResults: files.map((file) => ({
          filePath: file.relativePath,
          status: "pending",
        })),
        totalFiles: files.length,
        uploadedFiles: 0,
      };

      const concurrentUploads = Math.min(
        params.concurrentUploads || 5,
        files.length,
      );
      const uploadedFiles: Array<{
        filePath: string;
        relativePath: string;
        transactionId: string;
      }> = [];
      const failedUploads: Array<{
        error: string;
        filePath: string;
        relativePath: string;
      }> = [];
      let totalSize = 0;

      // Report initial progress
      if (params.onProgress) {
        params.onProgress({ ...progress });
      }

      // Upload files with concurrency control
      const uploadPromises: Array<Promise<void>> = [];
      const semaphore = new Array(concurrentUploads).fill(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const semaphoreIndex = i % concurrentUploads;

        const uploadPromise = this.processFileUpload(
          file,
          params.tags || [],
          progress,
          uploadedFiles,
          failedUploads,
          params.onProgress,
        );

        uploadPromises.push(uploadPromise);
        semaphore[semaphoreIndex] = uploadPromise;

        // Wait for this batch to complete before starting the next batch
        if (uploadPromises.length % concurrentUploads === 0) {
          await Promise.all(semaphore.filter((p) => p !== null));
        }
      }

      // Wait for all remaining uploads to complete
      await Promise.all(uploadPromises);

      // Calculate total size of uploaded files
      totalSize = uploadedFiles.reduce((sum, _) => {
        const originalFile = files.find(
          (f) => f.relativePath === _.relativePath,
        );
        return sum + (originalFile?.size || 0);
      }, 0);

      // Generate and upload manifest if we have successful uploads
      let manifestId: string | undefined;
      if (uploadedFiles.length > 0) {
        const manifestResult = await this.generateManifest(uploadedFiles);
        if (manifestResult.success && manifestResult.manifest) {
          const manifestUploadResult = await this.uploadManifest(
            manifestResult.manifest,
          );
          if (manifestUploadResult.success) {
            manifestId = manifestUploadResult.transactionId;
          }
        }
      }

      // Prepare final results
      const finalResults = progress.individualResults.map((result) => ({
        error: result.error,
        filePath: result.filePath,
        status:
          result.status === "pending" || result.status === "uploading"
            ? ("failed" as const)
            : (result.status as "completed" | "failed"),
        transactionId: result.transactionId,
      }));

      const success = failedUploads.length === 0 && uploadedFiles.length > 0;

      return {
        failedFiles: failedUploads.length,
        individualResults: finalResults,
        manifestId,
        success,
        totalFiles: files.length,
        totalSize,
        uploadedFiles: uploadedFiles.length,
      };
    } catch (error) {
      return {
        error: {
          code: "FOLDER_UPLOAD_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown folder upload error",
          solutions: [
            "Check your internet connection",
            "Verify you have sufficient credits in your account",
            "Ensure the folder path is accessible",
            "Try uploading the folder again",
          ],
        },
        failedFiles: 0,
        individualResults: [],
        success: false,
        totalFiles: 0,
        uploadedFiles: 0,
      };
    }
  }

  async collectFiles(
    folderPath: string,
    includePatterns: string[] = [],
    excludePatterns: string[] = [],
    maxFileSize?: number,
  ): Promise<{
    error?: { code: string; message: string; solutions: string[] };
    files?: Array<{ filePath: string; relativePath: string; size: number }>;
    success: boolean;
  }> {
    try {
      // Validate folder existence
      await access(folderPath, constants.F_OK);
      const folderStat = await stat(folderPath);
      if (!folderStat.isDirectory()) {
        return {
          error: {
            code: "NOT_A_DIRECTORY",
            message: `Path ${folderPath} is not a directory`,
            solutions: [
              "Provide a valid directory path",
              "Check that the path points to a folder, not a file",
              "Verify the directory exists and is accessible",
            ],
          },
          success: false,
        };
      }

      const files: Array<{
        filePath: string;
        relativePath: string;
        size: number;
      }> = [];
      await this.traverseDirectory(
        folderPath,
        folderPath,
        files,
        includePatterns,
        excludePatterns,
        maxFileSize,
      );

      return { files, success: true };
    } catch (error) {
      return {
        error: {
          code: "DIRECTORY_ACCESS_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to access directory",
          solutions: [
            "Check that the directory exists",
            "Verify read permissions on the directory",
            "Ensure the path is correct and accessible",
          ],
        },
        success: false,
      };
    }
  }

  private detectContentType(data: unknown): string {
    // Basic content type detection
    if (typeof data === "string") {
      // Try to detect JSON
      try {
        JSON.parse(data);
        return "application/json";
      } catch {
        // Check if it looks like HTML
        if (data.trim().startsWith("<") && data.includes(">")) {
          return "text/html";
        }
        return "text/plain";
      }
    }

    // For binary data, default to octet-stream
    return "application/octet-stream";
  }

  private detectContentTypeFromPath(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();

    const mimeMap: Record<string, string> = {
      aac: "audio/aac",
      avi: "video/x-msvideo",
      css: "text/css",
      csv: "text/csv",
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
      // Additional audio formats
      m4a: "audio/mp4",
      markdown: "text/markdown",
      md: "text/markdown",
      mkv: "video/x-matroska",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      // Video/Audio
      mp4: "video/mp4",
      ogg: "video/ogg", // OGG can be video or audio, prioritizing video
      // Documents
      pdf: "application/pdf",
      png: "image/png",

      svg: "image/svg+xml",
      tar: "application/x-tar",
      // Text files
      txt: "text/plain",

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

  private async generateManifest(
    uploadedFiles: Array<{
      filePath: string;
      relativePath: string;
      transactionId: string;
    }>,
    indexPath?: string,
  ): Promise<{
    error?: { code: string; message: string; solutions: string[] };
    manifest?: TurboArweaveManifest;
    success: boolean;
  }> {
    try {
      const manifest: TurboArweaveManifest = {
        manifest: "arweave/paths",
        paths: {},
        version: "0.1.0",
      };

      // Add index if specified
      if (indexPath) {
        manifest.index = { path: indexPath };
      } else {
        // Try to find common index files
        const commonIndexFiles = [
          "index.html",
          "index.htm",
          "README.md",
          "index.md",
        ];
        for (const indexFile of commonIndexFiles) {
          const found = uploadedFiles.find(
            (file) =>
              file.relativePath.toLowerCase() === indexFile.toLowerCase() ||
              file.relativePath
                .toLowerCase()
                .endsWith(`/${indexFile.toLowerCase()}`),
          );
          if (found) {
            manifest.index = { path: found.relativePath };
            break;
          }
        }
      }

      // Build paths mapping
      for (const file of uploadedFiles) {
        manifest.paths[file.relativePath] = {
          id: file.transactionId,
        };
      }

      return { manifest, success: true };
    } catch (error) {
      return {
        error: {
          code: "MANIFEST_GENERATION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate manifest",
          solutions: [
            "Ensure uploaded files have valid transaction IDs",
            "Check that file paths are properly formatted",
            "Try generating the manifest again",
          ],
        },
        success: false,
      };
    }
  }

  /**
   * Get payment-method-specific error solutions
   */
  private getPaymentSpecificSolutions(baseSolutions: string[]): string[] {
    const paymentSolutions = [...baseSolutions];

    if (this.config.paymentMethod === "tokens") {
      paymentSolutions.push(
        "Verify you have sufficient AR tokens (or selected token) in your wallet",
        "Check that token top-up completed successfully",
        "Ensure your wallet supports the selected payment token",
        "Consider switching to 'credits' payment method if token issues persist",
      );
    } else {
      paymentSolutions.push(
        "Verify you have sufficient Turbo credits in your account",
        "Top up your Turbo credits if balance is low",
        "Consider using 'tokens' payment method with direct AR token payments",
      );
    }

    return paymentSolutions;
  }

  private async getWallet(): Promise<unknown> {
    try {
      const seedPhrase = process.env.SEED_PHRASE;
      if (!seedPhrase) {
        return null;
      }

      // Generate deterministic wallet from seed phrase using existing utility
      const wallet = await getKeyFromMnemonic(seedPhrase);
      return wallet;
    } catch (error) {
      throw new Error(`Failed to generate wallet from seed: ${error}`);
    }
  }

  private async initializeTurboClient(): Promise<{
    error?: {
      code: string;
      details?: unknown;
      message: string;
      solutions?: string[];
    };
    success: boolean;
  }> {
    try {
      // Get wallet from environment
      const wallet = await this.getWallet();
      if (!wallet) {
        return {
          error: {
            code: "WALLET_NOT_FOUND",
            message: "No wallet configuration found",
            solutions: [
              "Set SEED_PHRASE environment variable with your 12-word mnemonic",
              "Example: export SEED_PHRASE='word1 word2 word3 ... word12'",
              "Or create a .env file with SEED_PHRASE=your_mnemonic_here",
              "Generate a new mnemonic if you don't have one",
            ],
          },
          success: false,
        };
      }

      // Create signer from wallet
      const signer = new ArweaveSigner(wallet as any);

      // Initialize Turbo factory with payment token configuration
      const turbo = TurboFactory.authenticated({
        signer,
        token: this.config.paymentToken || "arweave",
        ...(this.config.apiEndpoint && { gatewayUrl: this.config.apiEndpoint }),
      });

      this.turboClient = turbo;

      return { success: true };
    } catch (error) {
      return {
        error: {
          code: "CLIENT_INITIALIZATION_FAILED",
          details: error,
          message:
            error instanceof Error
              ? error.message
              : "Unknown initialization error",
          solutions: [
            "Check your SEED_PHRASE environment variable is set correctly",
            "Ensure the seed phrase is a valid 12-word mnemonic",
            "Verify your internet connection",
            "Try restarting the application",
          ],
        },
        success: false,
      };
    }
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching with basic wildcards
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(filePath);
  }

  private async processFileUpload(
    file: { filePath: string; relativePath: string; size: number },
    globalTags: { name: string; value: string }[],
    progress: TurboFileUploadProgress,
    uploadedFiles: Array<{
      filePath: string;
      relativePath: string;
      transactionId: string;
    }>,
    failedUploads: Array<{
      error: string;
      filePath: string;
      relativePath: string;
    }>,
    onProgress?: (progress: TurboFileUploadProgress) => void,
  ): Promise<void> {
    try {
      // Update progress to show file is uploading
      const resultIndex = progress.individualResults.findIndex(
        (r) => r.filePath === file.relativePath,
      );
      if (resultIndex >= 0) {
        progress.individualResults[resultIndex].status = "uploading";
        progress.currentFile = file.relativePath;
      }

      if (onProgress) {
        onProgress({ ...progress });
      }

      // Read file content
      const fileContent = await readFile(file.filePath);

      // Detect content type based on file extension
      const contentType = this.detectContentTypeFromPath(file.relativePath);

      // Prepare tags for this file - ensure critical headers are not overridden
      const filteredGlobalTags = globalTags.filter(
        (tag) =>
          tag.name !== "Content-Type" && tag.name !== "Content-Disposition",
      );

      const tags = [
        { name: "Content-Type", value: contentType },
        { name: "File-Path", value: file.relativePath },
        ...filteredGlobalTags,
      ];

      // Only add Content-Disposition for non-media files
      const mediaTypes = ["image/", "video/", "audio/"];
      const isMediaFile = mediaTypes.some((type) =>
        contentType.startsWith(type),
      );
      if (!isMediaFile) {
        tags.push({ name: "Content-Disposition", value: "inline" });
      }

      // Upload the file
      const uploadResult = await this.uploadFile({
        contentType,
        data: fileContent,
        tags,
      });

      if (uploadResult.success && uploadResult.transactionId) {
        // Success
        uploadedFiles.push({
          filePath: file.filePath,
          relativePath: file.relativePath,
          transactionId: uploadResult.transactionId,
        });

        if (resultIndex >= 0) {
          progress.individualResults[resultIndex].status = "completed";
          progress.individualResults[resultIndex].transactionId =
            uploadResult.transactionId;
        }
        progress.uploadedFiles++;
      } else {
        // Failure
        const errorMessage =
          uploadResult.error?.message || "Unknown upload error";
        failedUploads.push({
          error: errorMessage,
          filePath: file.filePath,
          relativePath: file.relativePath,
        });

        if (resultIndex >= 0) {
          progress.individualResults[resultIndex].status = "failed";
          progress.individualResults[resultIndex].error = errorMessage;
        }
        progress.failedFiles++;
      }
    } catch (error) {
      // Handle file processing errors
      const errorMessage =
        error instanceof Error ? error.message : "File processing error";
      failedUploads.push({
        error: errorMessage,
        filePath: file.filePath,
        relativePath: file.relativePath,
      });

      const resultIndex = progress.individualResults.findIndex(
        (r) => r.filePath === file.relativePath,
      );
      if (resultIndex >= 0) {
        progress.individualResults[resultIndex].status = "failed";
        progress.individualResults[resultIndex].error = errorMessage;
      }
      progress.failedFiles++;
    }

    // Report progress after each file
    if (onProgress) {
      onProgress({ ...progress });
    }
  }

  private shouldIncludeFile(
    relativePath: string,
    includePatterns: string[],
    excludePatterns: string[],
  ): boolean {
    // Check exclude patterns first
    if (excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return false;
        }
      }
    }

    // If no include patterns specified, include all files (except excluded)
    if (includePatterns.length === 0) {
      return true;
    }

    // Check include patterns
    for (const pattern of includePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private async traverseDirectory(
    rootPath: string,
    currentPath: string,
    files: Array<{ filePath: string; relativePath: string; size: number }>,
    includePatterns: string[],
    excludePatterns: string[],
    maxFileSize?: number,
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules by default
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await this.traverseDirectory(
            rootPath,
            fullPath,
            files,
            includePatterns,
            excludePatterns,
            maxFileSize,
          );
        }
      } else if (entry.isFile()) {
        // Check file against patterns
        if (
          this.shouldIncludeFile(relativePath, includePatterns, excludePatterns)
        ) {
          const fileStat = await stat(fullPath);

          // Check file size limit
          if (maxFileSize && fileStat.size > maxFileSize) {
            continue; // Skip files that exceed size limit
          }

          files.push({
            filePath: fullPath,
            relativePath: relativePath.replace(/\\/g, "/"), // Normalize path separators
            size: fileStat.size,
          });
        }
      }
      // Skip symbolic links and other special file types
    }
  }

  private async uploadManifest(manifest: TurboArweaveManifest): Promise<{
    error?: { code: string; message: string; solutions: string[] };
    success: boolean;
    transactionId?: string;
  }> {
    try {
      const manifestJson = JSON.stringify(manifest, null, 2);

      const uploadResult = await this.uploadFile({
        contentType: "application/x.arweave-manifest+json",
        data: manifestJson,
        tags: [
          { name: "Type", value: "manifest" },
          {
            name: "Content-Type",
            value: "application/x.arweave-manifest+json",
          },
        ],
      });

      if (!uploadResult.success) {
        return {
          error: {
            code: uploadResult.error?.code || "MANIFEST_UPLOAD_FAILED",
            message: uploadResult.error?.message || "Failed to upload manifest",
            solutions: uploadResult.error?.solutions || [
              "Check your internet connection",
              "Verify sufficient credits in your account",
              "Try uploading the manifest again",
            ],
          },
          success: false,
        };
      }

      return {
        success: true,
        transactionId: uploadResult.transactionId,
      };
    } catch (error) {
      return {
        error: {
          code: "MANIFEST_UPLOAD_ERROR",
          message:
            error instanceof Error ? error.message : "Manifest upload error",
          solutions: [
            "Check the manifest format is valid",
            "Ensure you have sufficient credits",
            "Try uploading the manifest again",
          ],
        },
        success: false,
      };
    }
  }

  private async validateFolderUploadParams(
    params: TurboFolderUploadParams,
  ): Promise<{
    error?: { code: string; message: string; solutions: string[] };
    success: boolean;
  }> {
    if (!params.folderPath) {
      return {
        error: {
          code: "MISSING_FOLDER_PATH",
          message: "Folder path is required",
          solutions: [
            "Provide a valid folder path",
            "Ensure the path points to an existing directory",
            "Use absolute or relative paths as needed",
          ],
        },
        success: false,
      };
    }

    // Validate concurrent uploads limit
    if (
      params.concurrentUploads &&
      (params.concurrentUploads < 1 || params.concurrentUploads > 20)
    ) {
      return {
        error: {
          code: "INVALID_CONCURRENT_UPLOADS",
          message: "Concurrent uploads must be between 1 and 20",
          solutions: [
            "Set concurrentUploads between 1 and 20",
            "Use default value (5) for optimal performance",
            "Lower the value for slower networks",
          ],
        },
        success: false,
      };
    }

    // Validate max file size
    if (params.maxFileSize && params.maxFileSize < 1) {
      return {
        error: {
          code: "INVALID_MAX_FILE_SIZE",
          message: "Max file size must be greater than 0",
          solutions: [
            "Set maxFileSize to a positive number in bytes",
            "Remove maxFileSize to allow all file sizes",
            "Consider typical file sizes for your use case",
          ],
        },
        success: false,
      };
    }

    return { success: true };
  }

  /**
   * Validate payment configuration and requirements
   */
  private async validatePaymentConfiguration(): Promise<{
    error?: { code: string; message: string; solutions: string[] };
    success: boolean;
  }> {
    if (this.config.paymentMethod === "tokens") {
      // For token payments, ensure the payment token is supported
      const supportedTokens = [
        "arweave",
        "ethereum",
        "solana",
        "matic",
        "pol",
        "kyve",
        "ario",
        "base-eth",
      ];
      if (!supportedTokens.includes(this.config.paymentToken || "arweave")) {
        return {
          error: {
            code: "UNSUPPORTED_PAYMENT_TOKEN",
            message: `Payment token '${this.config.paymentToken}' is not supported`,
            solutions: [
              `Use one of the supported tokens: ${supportedTokens.join(", ")}`,
              "Default to 'arweave' for Arweave native token payments",
              "Consider using 'credits' payment method instead",
            ],
          },
          success: false,
        };
      }

      // Check if wallet has the necessary configuration for token payments
      try {
        // This is a basic check - in production you might want to verify token balance
        const balanceResult = await this.checkBalance();
        if (!balanceResult.success) {
          return {
            error: {
              code: "PAYMENT_ACCOUNT_UNAVAILABLE",
              message: "Cannot access payment account for token transactions",
              solutions: [
                "Verify your SEED_PHRASE environment variable is set correctly",
                "Ensure your wallet is properly configured",
                "Check that your wallet supports the selected payment token",
                "Try using 'credits' payment method as fallback",
              ],
            },
            success: false,
          };
        }
      } catch (error) {
        return {
          error: {
            code: "PAYMENT_VALIDATION_FAILED",
            message: `Payment validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            solutions: [
              "Check your wallet configuration",
              "Verify network connectivity",
              "Ensure payment token is properly configured",
              "Try again after a few moments",
            ],
          },
          success: false,
        };
      }
    }

    return { success: true };
  }

  private validateUploadParams(params: TurboUploadParams): {
    error?: { code: string; message: string; solutions?: string[] };
    success: boolean;
  } {
    if (!params.data) {
      return {
        error: {
          code: "INVALID_DATA",
          message: "Data is required for upload",
          solutions: [
            "Provide valid data: Buffer, ArrayBuffer, Uint8Array, string, or Readable stream",
            "Ensure the data is not empty",
            "Check that the data format is supported",
          ],
        },
        success: false,
      };
    }

    // Check data size (example: 10MB limit for basic validation)
    const maxSize = 10 * 1024 * 1024; // 10MB
    let dataSize = 0;

    if (typeof params.data === "string") {
      dataSize = Buffer.from(params.data).length;
    } else if (params.data instanceof ArrayBuffer) {
      dataSize = params.data.byteLength;
    } else if (
      params.data instanceof Buffer ||
      params.data instanceof Uint8Array
    ) {
      dataSize = params.data.length;
    } else if (params.data instanceof Readable) {
      // Skip size validation for streams
      return { success: true };
    }

    if (dataSize > maxSize) {
      return {
        error: {
          code: "FILE_TOO_LARGE",
          message: `File size ${dataSize} bytes exceeds maximum allowed size ${maxSize} bytes`,
          solutions: [
            `Reduce file size to under ${maxSize / (1024 * 1024)}MB`,
            "Compress the file if possible",
            "Split large files into smaller chunks",
            "Consider using a different upload method for very large files",
          ],
        },
        success: false,
      };
    }

    return { success: true };
  }
}
