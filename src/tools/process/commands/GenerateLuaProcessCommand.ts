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
      "Generate Lua code for AO processes with documentation-informed best practices. This tool ONLY generates code - it does NOT deploy processes. Use this tool for: 'create AO process code', 'generate AO process code', 'build process handlers'. After code generation, use spawnProcess + evalProcess tools for deployment (NOT aos CLI). Returns structured JSON with generated Lua code, explanations, and ADP compliance validation. For deployment workflow: 1) generateLuaProcess → 2) spawnProcess → 3) evalProcess.",
    name: "generateLuaProcess",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Generate AO Process Code (Code Only - No Deployment)",
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

      // Validate ADP compliance of generated code
      const adpValidation = this.validateADPCompliance(
        workflowResult.codeResult.generatedCode,
      );

      // Build response based on includeExplanation flag
      const response = {
        success: true,
        timestamp: workflowResult.timestamp.toISOString(),
        workflow: {
          adpCompliance: adpValidation,
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

  /**
   * Validate ADP compliance of generated Lua code
   */
  private validateADPCompliance(generatedCode: string): {
    checks: {
      hasCapabilities: boolean;
      hasHandlerRegistry: boolean;
      hasInfoHandler: boolean;
      hasPingHandler: boolean;
      hasProtocolVersion: boolean;
    };
    isCompliant: boolean;
    warnings: string[];
  } {
    const checks = {
      hasCapabilities: false,
      hasHandlerRegistry: false,
      hasInfoHandler: false,
      hasPingHandler: false,
      hasProtocolVersion: false,
    };
    const warnings: string[] = [];

    // Check for Info handler
    if (
      generatedCode.includes("Handlers.add('Info'") ||
      generatedCode.includes('Handlers.add("Info"')
    ) {
      checks.hasInfoHandler = true;
    } else {
      warnings.push("Missing Info handler for ADP compliance");
    }

    // Check for protocol version
    if (generatedCode.includes('protocolVersion = "1.0"')) {
      checks.hasProtocolVersion = true;
    } else {
      warnings.push("Missing protocolVersion field for ADP compliance");
    }

    // Check for handler registry
    if (generatedCode.includes("handlers =") && generatedCode.includes("[")) {
      checks.hasHandlerRegistry = true;
    } else {
      warnings.push("Missing handlers registry for ADP compliance");
    }

    // Check for capabilities
    if (
      generatedCode.includes("capabilities =") &&
      generatedCode.includes("supportsHandlerRegistry")
    ) {
      checks.hasCapabilities = true;
    } else {
      warnings.push("Missing capabilities object for ADP compliance");
    }

    // Check for Ping handler (useful for testing)
    if (
      generatedCode.includes("Handlers.add('Ping'") ||
      generatedCode.includes('Handlers.add("Ping"')
    ) {
      checks.hasPingHandler = true;
    } else {
      warnings.push("Missing Ping handler - recommended for ADP testing");
    }

    const isCompliant =
      checks.hasInfoHandler &&
      checks.hasProtocolVersion &&
      checks.hasHandlerRegistry &&
      checks.hasCapabilities;

    return {
      checks,
      isCompliant,
      warnings,
    };
  }
}
