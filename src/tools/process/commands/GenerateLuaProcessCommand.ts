import { z } from "zod";

import { LuaWorkflowOrchestrationService } from "../../../services/LuaWorkflowOrchestrationService.js";
import { ToolCommand, ToolContext, ToolMetadata } from "../../core/index.js";

interface GenerateLuaProcessArgs {
  domains?: string;
  includeExplanation?: boolean;
  userRequest: string;
}

/**
 * MCP tool command for generating AO Lua process code with automatic documentation integration.
 *
 * This command orchestrates the complete workflow:
 * 1. Analyzes user requirements to detect AO patterns and complexity
 * 2. Queries relevant Permaweb documentation automatically
 * 3. Generates appropriate Lua code using documentation-informed templates
 * 4. Provides comprehensive code explanations with source citations
 *
 * The generated code follows AO best practices and includes proper handler patterns,
 * message routing, state management, and error handling based on detected requirements.
 */
export class GenerateLuaProcessCommand extends ToolCommand<
  GenerateLuaProcessArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Generate AO Lua process code based on natural language requirements with automatic documentation reference. Analyzes user requests, queries relevant Permaweb documentation, and generates production-ready Lua code with comprehensive explanations and best practices. Uses queryPermawebDocs tool internally to understand AO patterns, handler structures, and messaging conventions.",
    name: "generateLuaProcess",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Generate Lua Process with Documentation",
  };

  protected parametersSchema = z.object({
    domains: z
      .string()
      .optional()
      .describe(
        "Optional comma-separated list of specific documentation domains to query (ao, arweave, ario, hyperbeam, permaweb-glossary, wao). If not specified, domains will be automatically detected from the request.",
      ),
    includeExplanation: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether to include detailed code explanation with documentation sources and best practices (default: true)",
      ),
    userRequest: z
      .string()
      .min(1)
      .describe(
        "Natural language description of the desired AO process functionality. Examples: 'Create a token contract', 'Build a DAO voting system', 'Make a simple ping-pong handler'",
      ),
  });

  private readonly orchestrationService: LuaWorkflowOrchestrationService;

  constructor(private context: ToolContext) {
    super();
    this.orchestrationService = new LuaWorkflowOrchestrationService();
  }

  async execute(args: GenerateLuaProcessArgs): Promise<string> {
    try {
      // Parse domains if provided
      const requestedDomains = args.domains
        ? args.domains.split(",").map((d) => d.trim())
        : undefined;

      // Execute the complete workflow
      const workflowResult =
        await this.orchestrationService.orchestrateWorkflow(args.userRequest);

      // Build response based on includeExplanation flag
      const response = {
        success: true,
        timestamp: workflowResult.timestamp.toISOString(),
        workflow: {
          analysis: {
            complexity: workflowResult.requirements.analysis.complexity,
            confidence: workflowResult.requirements.confidence,
            detectedPatterns:
              workflowResult.requirements.analysis.detectedPatterns,
            processType: workflowResult.requirements.analysis.processType,
            suggestedDomains:
              workflowResult.requirements.analysis.suggestedDomains,
          },
          code: {
            bestPractices: workflowResult.codeResult.bestPractices,
            generatedCode: workflowResult.codeResult.generatedCode,
            handlerPatterns: workflowResult.codeResult.handlerPatterns.map(
              (p) => ({
                description: p.description,
                name: p.name,
              }),
            ),
            usedTemplates: workflowResult.codeResult.usedTemplates,
          },
          documentation: {
            domains: Array.from(
              new Set(
                workflowResult.requirements.relevantDocs.map(
                  (doc) => doc.domain,
                ),
              ),
            ),
            sourcesFound: workflowResult.requirements.relevantDocs.length,
          },
          userRequest: args.userRequest,
        },
      };

      // Add explanation if requested
      if (args.includeExplanation) {
        (response.workflow as any).explanation = {
          codeBreakdown: workflowResult.explanation.codeBreakdown,
          overview: workflowResult.explanation.overview,
          relatedSources: workflowResult.explanation.relatedSources,
        };
      }

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return JSON.stringify(
        {
          error: {
            code: "WORKFLOW_GENERATION_FAILED",
            details: {
              timestamp: new Date().toISOString(),
              userRequest: args.userRequest,
            },
            message: `Failed to generate Lua process code: ${errorMessage}`,
          },
          success: false,
        },
        null,
        2,
      );
    }
  }
}
