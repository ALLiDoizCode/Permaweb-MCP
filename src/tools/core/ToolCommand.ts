import { JWKInterface } from "arweave/node/lib/wallet.js";
import { z } from "zod";

import type { ProcessDefinition } from "../../services/ProcessCommunicationService.js";

export interface ToolContext {
  embeddedTemplates?: Map<string, ProcessDefinition>;
  hubId?: string;
  keyPair?: JWKInterface;
  publicKey?: string;
}

export interface ToolDefinition {
  annotations?: {
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
    title?: string;
  };
  description: string;
  execute: (args: unknown) => Promise<string>;
  name: string;
  parameters: z.ZodSchema<unknown>;
}

export interface ToolExecutionResult {
  data?: unknown;
  error?: {
    code: string;
    details?: unknown;
    message: string;
  };
  success: boolean;
}

export interface ToolMetadata {
  description: string;
  name: string;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
  title?: string;
}

/**
 * Auto-initializing version of SafeToolContext that creates keypairs and hubs as needed
 */
export class AutoSafeToolContext {
  get embeddedTemplates() {
    return this.context.embeddedTemplates;
  }

  constructor(private context: ToolContext) {}

  static from(context: ToolContext): AutoSafeToolContext {
    return new AutoSafeToolContext(context);
  }

  async getHubId(): Promise<string> {
    const { autoHubId } = await import("./ContextHelpers.js");
    return await autoHubId(this.context);
  }

  async getKeyPair(): Promise<JWKInterface> {
    const { autoKeyPair } = await import("./ContextHelpers.js");
    return await autoKeyPair(this.context);
  }

  async getPublicKey(): Promise<string> {
    const { autoPublicKey } = await import("./ContextHelpers.js");
    return await autoPublicKey(this.context);
  }

  async initializeAll(): Promise<{
    generated: boolean;
    hubCreated: boolean;
    hubId: string;
    keyPair: JWKInterface;
    publicKey: string;
  }> {
    const { autoInitializeContext } = await import("./ContextHelpers.js");
    return await autoInitializeContext(this.context);
  }
}

export class SafeToolContext {
  get embeddedTemplates() {
    return this.context.embeddedTemplates;
  }

  get hubId(): string {
    if (!this.context.hubId) {
      throw new Error("Hub not initialized. Please run initializeHub first.");
    }
    return this.context.hubId;
  }

  get keyPair(): JWKInterface {
    if (!this.context.keyPair) {
      throw new Error(
        "Wallet not initialized. Please run initializeHub first.",
      );
    }
    return this.context.keyPair;
  }

  get publicKey(): string {
    if (!this.context.publicKey!) {
      throw new Error(
        "Wallet not initialized. Please run initializeHub first.",
      );
    }
    return this.context.publicKey!;
  }

  constructor(private context: ToolContext) {}

  static from(context: ToolContext): SafeToolContext {
    return new SafeToolContext(context);
  }
}

export abstract class ToolCommand<TArgs = unknown, TResult = unknown> {
  protected abstract metadata: ToolMetadata;
  protected abstract parametersSchema: z.ZodSchema<TArgs>;

  abstract execute(args: TArgs, context: ToolContext): Promise<TResult>;

  getMetadata(): ToolMetadata {
    return this.metadata;
  }

  getParametersSchema(): z.ZodSchema<TArgs> {
    return this.parametersSchema;
  }

  toToolDefinition(_context: ToolContext): ToolDefinition {
    return {
      annotations: {
        openWorldHint: this.metadata.openWorldHint ?? false,
        readOnlyHint: this.metadata.readOnlyHint ?? true,
        title: this.metadata.title ?? this.metadata.name,
      },
      description: this.metadata.description,
      execute: async (args: unknown) => {
        // Wait for any pending initialization if this tool requires it
        if (this.shouldWaitForInitialization()) {
          await this.waitForPendingInitialization();
        }

        const result = await this.safeExecute(args as TArgs, _context);
        if (result.success) {
          return result.data as string;
        } else {
          throw new Error(result.error?.message || "Tool execution failed");
        }
      },
      name: this.metadata.name,
      parameters: this.parametersSchema,
    };
  }

  protected createErrorResult(
    code: string,
    message: string,
    details?: unknown,
  ): ToolExecutionResult {
    return {
      error: {
        code,
        details,
        message,
      },
      success: false,
    };
  }

  protected createSuccessResult(data: TResult): ToolExecutionResult {
    return {
      data,
      success: true,
    };
  }

  /**
   * Returns true if this tool requires wallet/hub initialization to complete before other tools can proceed
   */
  protected requiresSequentialExecution(): boolean {
    return false;
  }

  protected async safeExecute(
    args: TArgs,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      // Validate required context before execution
      this.validateContext();

      // Track sequential execution for initialization tools
      if (this.requiresSequentialExecution()) {
        await this.trackSequentialExecution();
      }

      const result = await this.execute(args, context);

      // Mark completion for initialization tools
      if (this.requiresSequentialExecution()) {
        await this.markInitializationComplete();
      }

      return this.createSuccessResult(result);
    } catch (error) {
      // Clear pending initialization on error
      if (this.requiresSequentialExecution()) {
        await this.clearPendingInitialization();
      }

      return this.createErrorResult(
        "EXECUTION_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
        error,
      );
    }
  }

  /**
   * Returns true if this tool should wait for initialization tools to complete
   */
  protected shouldWaitForInitialization(): boolean {
    return true;
  }

  protected validateContext(): void {
    // Override in subclasses to specify required context properties
    // Base implementation does nothing to maintain backward compatibility
  }

  private async clearPendingInitialization(): Promise<void> {
    const { clearInitializationPending } = await import("./ToolUtils.js");
    clearInitializationPending(this.metadata.name);
  }

  private async markInitializationComplete(): Promise<void> {
    const { markInitializationComplete } = await import("./ToolUtils.js");
    markInitializationComplete(this.metadata.name);
  }

  private async trackSequentialExecution(): Promise<void> {
    const { markInitializationPending } = await import("./ToolUtils.js");
    markInitializationPending(this.metadata.name);
  }

  private async waitForPendingInitialization(): Promise<void> {
    const { getInitializationState } = await import("./ToolUtils.js");
    const state = getInitializationState();

    if (state.pending) {
      // Wait for initialization to complete
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const currentState = getInitializationState();
          if (!currentState.pending) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100); // Check every 100ms
      });
    }
  }
}
