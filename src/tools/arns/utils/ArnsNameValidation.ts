/**
 * ArNS Name Validation Utilities
 * Centralized validation patterns and helpers for ArNS name format validation
 */

// ArNS name validation patterns - centralized to prevent duplication
export const BASE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.ar$/i;
export const UNDERNAME_PATTERN =
  /^[a-z0-9][a-z0-9-]*[a-z0-9]\.[a-z0-9][a-z0-9-]*[a-z0-9]\.ar$/i;

/**
 * Extract the base name from an ArNS name (removes .ar suffix)
 * For undernames, extracts the base name component
 * @param arnsName - Full ArNS name (e.g., "sub.example.ar")
 * @returns Base name without .ar suffix (e.g., "example")
 */
export function extractBaseName(arnsName: string): string {
  if (UNDERNAME_PATTERN.test(arnsName)) {
    // For undernames, get the base name part (second-to-last component)
    return arnsName.split(".").slice(-2, -1)[0];
  }
  // For base names, remove .ar suffix
  return arnsName.split(".")[0];
}

/**
 * Determine if an ArNS name is a base name or undername
 * @param name - ArNS name to categorize
 * @returns "base" | "undername"
 */
export function getArnsNameType(name: string): "base" | "undername" {
  return BASE_NAME_PATTERN.test(name) ? "base" : "undername";
}

/**
 * Validate if a string is a valid ArNS name (base or undername)
 * @param name - Name to validate
 * @returns boolean indicating if name is valid
 */
export function isValidArnsName(name: string): boolean {
  return BASE_NAME_PATTERN.test(name) || UNDERNAME_PATTERN.test(name);
}
