import { ToolContext } from "./ToolCommand.js";

interface InitializationState {
  currentTool?: string;
  pending: boolean;
  startTime?: number;
}

/**
 * Tool utilities for managing sequential execution and initialization state
 */

export class ContextValidationError extends Error {
  constructor(
    message: string,
    public code: string = "VALIDATION_ERROR",
  ) {
    super(message);
    this.name = "ToolValidationError";
  }
}

let initializationState: InitializationState = {
  pending: false,
};

const INITIALIZATION_TOOLS = new Set([
  "createHub",
  "generateKeypair",
  "initializeHub",
]);

/**
 * Clear pending initialization state (used on error)
 */
export function clearInitializationPending(toolName: string): void {
  if (
    isInitializationTool(toolName) &&
    initializationState.currentTool === toolName
  ) {
    initializationState = {
      pending: false,
    };
  }
}

/**
 * Get the name of the currently executing initialization tool
 */
export function getCurrentInitializationTool(): string | undefined {
  return initializationState.currentTool;
}

/**
 * Get how long the current initialization has been running (in ms)
 */
export function getInitializationDuration(): number | undefined {
  if (!initializationState.pending || !initializationState.startTime) {
    return undefined;
  }
  return Date.now() - initializationState.startTime;
}

/**
 * Get current initialization state
 */
export function getInitializationState(): InitializationState {
  return { ...initializationState };
}

/**
 * Helper to get validated hubId from context
 */
export function getValidatedHubId(context: ToolContext) {
  validateRequiredContext(context, ["hubId"]);
  return context.hubId!;
}

/**
 * Helper to get validated keyPair from context
 */
export function getValidatedKeyPair(context: ToolContext) {
  validateRequiredContext(context, ["keyPair"]);
  return context.keyPair!;
}

/**
 * Helper to get validated publicKey from context
 */
export function getValidatedPublicKey(context: ToolContext) {
  validateRequiredContext(context, ["publicKey"]);
  return context.publicKey!;
}

/**
 * Check if initialization is currently pending
 */
export function isInitializationPending(): boolean {
  return initializationState.pending;
}

/**
 * Check if a tool name is an initialization tool that requires sequential execution
 */
export function isInitializationTool(toolName: string): boolean {
  return INITIALIZATION_TOOLS.has(toolName);
}

/**
 * Mark initialization as complete for a specific tool
 */
export function markInitializationComplete(toolName: string): void {
  if (
    isInitializationTool(toolName) &&
    initializationState.currentTool === toolName
  ) {
    initializationState = {
      pending: false,
    };
  }
}

/**
 * Mark initialization as pending for a specific tool
 */
export function markInitializationPending(toolName: string): void {
  if (isInitializationTool(toolName)) {
    initializationState = {
      currentTool: toolName,
      pending: true,
      startTime: Date.now(),
    };
  }
}

/**
 * Validates that required context properties are present
 * Throws ToolValidationError if validation fails
 */
export function validateRequiredContext(
  context: ToolContext,
  required: Array<keyof ToolContext>,
): void {
  const missing: string[] = [];

  for (const key of required) {
    if (context[key] === undefined) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new ContextValidationError(
      `Missing required context: ${missing.join(", ")}. Please initialize your hub first using the initializeHub tool.`,
      "MISSING_CONTEXT",
    );
  }
}
