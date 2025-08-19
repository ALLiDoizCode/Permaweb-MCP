/**
 * Parameters for promoting media from temporal to permanent storage.
 */
export interface MediaPromotionParams {
  /** Optional new description for the promoted file */
  description?: string;

  /** The file ID to promote */
  fileId: string;

  /** Optional metadata to update during promotion */
  metadata?: Record<string, unknown>;
}

/**
 * Result interface for media promotion operations.
 */
export interface MediaPromotionResult {
  /** Error message if promotion failed */
  error?: string;

  /** The new permanent storage URL */
  permanentUrl?: string;

  /** Whether the promotion was successful */
  success: boolean;

  /** The updated media reference after promotion */
  updatedReference?: MediaReference;
}

/**
 * MediaReference interface for managing media file metadata within AI memories.
 *
 * This interface provides structured metadata for media files attached to memories,
 * supporting both temporal and permanent storage tiers with comprehensive file tracking.
 */
export interface MediaReference {
  /** Optional integrity checksum for file validation */
  checksum?: string;

  /** Optional description or caption for the media file */
  description?: string;

  /** Unique identifier for the file in the storage system */
  fileId: string;

  /** Optional metadata specific to the file type (dimensions for images, duration for videos, etc.) */
  fileMetadata?: Record<string, unknown>;

  /** Original file name provided during upload */
  fileName: string;

  /** MIME type of the file (e.g., 'image/png', 'application/pdf') */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Storage tier: 'temporal' for temporary storage, 'permanent' for Arweave storage */
  storageType: "permanent" | "temporal";

  /** ISO 8601 timestamp of when the file was uploaded */
  uploadDate: string;

  /** Access URL for retrieving the file */
  url: string;
}

/**
 * Result interface for media reference validation operations.
 */
export interface MediaValidationResult {
  /** List of validation errors, if any */
  errors: string[];

  /** Whether all media references are valid */
  isValid: boolean;

  /** Details about each validated media reference */
  validationDetails: {
    checksumValid?: boolean;
    error?: string;
    fileId: string;
    isAccessible: boolean;
    sizeMatch?: boolean;
  }[];

  /** List of warnings (non-blocking issues) */
  warnings: string[];
}
