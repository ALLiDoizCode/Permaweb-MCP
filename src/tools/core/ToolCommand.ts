import { JWKInterface } from "arweave/node/lib/wallet.js";
import { z } from "zod";

import type { ProcessDefinition } from "../../services/ProcessCommunicationService.js";

export interface ToolContext {
  embeddedTemplates?: Map<string, ProcessDefinition>;
  hubId: string;
  keyPair: JWKInterface;
  publicKey: string;
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

  toToolDefinition(context: ToolContext): ToolDefinition {
    return {
      annotations: {
        openWorldHint: this.metadata.openWorldHint ?? false,
        readOnlyHint: this.metadata.readOnlyHint ?? true,
        title: this.metadata.title ?? this.metadata.name,
      },
      description: this.metadata.description,
      execute: async (args: unknown) => {
        const result = await this.safeExecute(args as TArgs, context);
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

  protected async safeExecute(
    args: TArgs,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      const result = await this.execute(args, context);
      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(
        "EXECUTION_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
        error,
      );
    }
  }
}
