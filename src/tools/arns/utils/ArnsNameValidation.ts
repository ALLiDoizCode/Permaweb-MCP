/**
 * ArNS Name Validation Utilities
 * Centralized validation patterns and helpers for ArNS name format validation
 */

// ArNS name validation patterns - centralized to prevent duplication
export const BASE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.ar$/i;
export const UNDERNAME_PATTERN =
  /^[a-z0-9][a-z0-9-]*[a-z0-9]\.[a-z0-9][a-z0-9-]*[a-z0-9]\.ar$/i;

// Patterns for names without .ar suffix (user-friendly input)
export const BASE_NAME_NO_SUFFIX_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]?$/i;
export const UNDERNAME_NO_SUFFIX_PATTERN =
  /^[a-z0-9][a-z0-9-]*[a-z0-9]?\.[a-z0-9][a-z0-9-]*[a-z0-9]?$/i;

/**
 * Extract the base name from an ArNS name (removes .ar suffix)
 * For undernames, extracts the base name component
 * @param arnsName - Full ArNS name (e.g., "sub.example.ar")
 * @returns Base name without .ar suffix (e.g., "example")
 */
export function extractBaseName(arnsName: string): string {
  const normalized = normalizeArnsName(arnsName);
  if (UNDERNAME_PATTERN.test(normalized)) {
    // For undernames, get the base name part (second-to-last component)
    return normalized.split(".").slice(-2, -1)[0];
  }
  // For base names, remove .ar suffix
  return normalized.split(".")[0];
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
 * Accepts names with or without .ar suffix for better UX
 * @param name - Name to validate
 * @returns boolean indicating if name is valid
 */
export function isValidArnsName(name: string): boolean {
  // Check if already has .ar suffix
  if (BASE_NAME_PATTERN.test(name) || UNDERNAME_PATTERN.test(name)) {
    return true;
  }

  // Check patterns without .ar suffix (user-friendly input)
  return (
    BASE_NAME_NO_SUFFIX_PATTERN.test(name) ||
    UNDERNAME_NO_SUFFIX_PATTERN.test(name)
  );
}

/**
 * Normalize ArNS name by ensuring .ar suffix
 * @param name - Input name (with or without .ar suffix)
 * @returns Normalized name with .ar suffix
 */
export function normalizeArnsName(name: string): string {
  // Already has .ar suffix
  if (name.endsWith(".ar")) {
    return name;
  }

  // Check if it's an undername without .ar suffix
  if (name.includes(".") && !name.endsWith(".ar")) {
    return `${name}.ar`;
  }

  // Simple base name without suffix
  return `${name}.ar`;
}
