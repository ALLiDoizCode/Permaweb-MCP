/**
 * Resolution Result Types
 * Shared type definitions for address and name resolution utilities
 */

export interface ResolutionResult<T> {
  matches?: T[];
  requiresVerification: boolean;
  resolved: boolean;
  value?: T;
  verificationMessage?: string;
}
