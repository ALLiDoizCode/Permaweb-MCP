import {
  CodeExplanation,
  DocumentedRequirements,
  LuaCodeResult,
  LuaWorkflowOrchestration,
  LuaWorkflowResult,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import { CodeExplanationService } from "./CodeExplanationService.js";
import { LuaCodeGeneratorService } from "./LuaCodeGeneratorService.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";
import { RequirementAnalysisService } from "./RequirementAnalysisService.js";

/**
 * Main orchestration service that coordinates the intelligent documentation-to-code workflow.
 *
 * This service integrates all workflow components:
 * - Analyzes user requirements using RequirementAnalysisService
 * - Queries relevant documentation using PermawebDocsService
 * - Generates Lua code using LuaCodeGeneratorService
 * - Creates explanations using CodeExplanationService
 *
 * The service provides both individual workflow steps and complete end-to-end orchestration.
 */
export class LuaWorkflowOrchestrationService
  implements LuaWorkflowOrchestration
{
  private readonly codeExplanationService: CodeExplanationService;
  private readonly luaCodeGeneratorService: LuaCodeGeneratorService;
  private readonly permawebDocs: PermawebDocs;
  private readonly requirementAnalysisService: RequirementAnalysisService;

  constructor(
    permawebDocs?: PermawebDocs,
    requirementAnalysisService?: RequirementAnalysisService,
    luaCodeGeneratorService?: LuaCodeGeneratorService,
    codeExplanationService?: CodeExplanationService,
  ) {
    this.permawebDocs = permawebDocs ?? new PermawebDocs();
    this.requirementAnalysisService =
      requirementAnalysisService ?? new RequirementAnalysisService();
    this.luaCodeGeneratorService =
      luaCodeGeneratorService ?? new LuaCodeGeneratorService();
    this.codeExplanationService =
      codeExplanationService ?? new CodeExplanationService();
  }

  /**
   * Analyze requirements and query relevant documentation
   */
  async analyzeAndQuery(userRequest: string): Promise<DocumentedRequirements> {
    // Analyze user requirements
    const analysis = await this.analyzeRequirements(userRequest);

    // Query relevant documentation
    const relevantDocs = await this.queryRelevantDocs(analysis);

    // Calculate confidence based on documentation matches and pattern detection
    const confidence = this.calculateConfidence(analysis, relevantDocs);

    return {
      analysis,
      confidence,
      relevantDocs,
    };
  }

  /**
   * Analyze user requirements (LuaWorkflowOrchestration interface implementation)
   */
  async analyzeRequirements(userRequest: string): Promise<RequirementAnalysis> {
    return await this.requirementAnalysisService.analyzeRequirements(
      userRequest,
    );
  }

  /**
   * Generate code explanation (LuaWorkflowOrchestration interface implementation)
   */
  async explainCode(
    code: LuaCodeResult,
    sources: PermawebDocsResult[],
  ): Promise<CodeExplanation> {
    return await this.codeExplanationService.explainCode(code, sources);
  }

  /**
   * Generate Lua code (LuaWorkflowOrchestration interface implementation)
   */
  async generateLuaCode(
    docs: PermawebDocsResult[],
    requirements: RequirementAnalysis,
  ): Promise<LuaCodeResult> {
    return await this.luaCodeGeneratorService.generateLuaCode(
      docs,
      requirements,
    );
  }

  /**
   * Generate code with comprehensive explanation
   */
  async generateWithExplanation(
    requirements: DocumentedRequirements,
  ): Promise<{ codeResult: LuaCodeResult; explanation: CodeExplanation }> {
    // Generate Lua code
    const codeResult = await this.generateLuaCode(
      requirements.relevantDocs,
      requirements.analysis,
    );

    // Generate explanation with documentation sources
    const explanation = await this.explainCode(
      codeResult,
      requirements.relevantDocs,
    );

    return { codeResult, explanation };
  }

  /**
   * Complete end-to-end workflow orchestration
   */
  async orchestrateWorkflow(userRequest: string): Promise<LuaWorkflowResult> {
    // Step 1: Analyze requirements
    const requirements = await this.analyzeAndQuery(userRequest);

    // Step 2: Generate code with explanation
    const codeAndExplanation = await this.generateWithExplanation(requirements);

    return {
      codeResult: codeAndExplanation.codeResult,
      explanation: codeAndExplanation.explanation,
      requirements,
      timestamp: new Date(),
    };
  }

  /**
   * Query relevant documentation (LuaWorkflowOrchestration interface implementation)
   */
  async queryRelevantDocs(
    analysis: RequirementAnalysis,
  ): Promise<PermawebDocsResult[]> {
    const query = this.buildDocumentationQuery(analysis);
    const domains = analysis.suggestedDomains;

    // Query with intelligent result limiting based on complexity
    const maxResults = this.getMaxResults(analysis);

    try {
      const results = await this.permawebDocs.query(query, domains, maxResults);

      // Ensure we have some results, fallback to broader search if needed
      if (results.length === 0) {
        const fallbackQuery = analysis.extractedKeywords.join(" ");
        return await this.permawebDocs.query(
          fallbackQuery,
          undefined,
          maxResults,
        );
      }

      return results;
    } catch (error) {
      console.warn("Documentation query failed:", error);
      // Return empty array to allow workflow to continue with template-based generation
      return [];
    }
  }

  /**
   * Build optimized documentation query from requirements analysis
   */
  private buildDocumentationQuery(analysis: RequirementAnalysis): string {
    const queryParts: string[] = [];

    // Add original user request (highest priority)
    queryParts.push(analysis.userRequest);

    // Add detected patterns as query terms
    for (const pattern of analysis.detectedPatterns) {
      switch (pattern) {
        case "dao-governance":
          queryParts.push("dao governance voting proposals");
          break;
        case "handler":
          queryParts.push("handlers message processing");
          break;
        case "message-routing":
          queryParts.push("message routing send receive");
          break;
        case "process-communication":
          queryParts.push("process communication interaction");
          break;
        case "state-management":
          queryParts.push("state management data storage");
          break;
        case "token-contract":
          queryParts.push("token balance transfer mint");
          break;
      }
    }

    // Add high-value keywords
    const relevantKeywords = analysis.extractedKeywords.filter(
      (keyword) =>
        keyword.length > 2 &&
        !["and", "for", "from", "or", "that", "the", "this", "with"].includes(
          keyword,
        ),
    );
    queryParts.push(...relevantKeywords.slice(0, 5)); // Limit to top 5 keywords

    return queryParts.join(" ");
  }

  /**
   * Calculate confidence score based on analysis quality and documentation matches
   */
  private calculateConfidence(
    analysis: RequirementAnalysis,
    docs: PermawebDocsResult[],
  ): number {
    let confidence = 0.3; // Base confidence

    // Boost confidence based on detected patterns
    confidence += analysis.detectedPatterns.length * 0.15;

    // Boost confidence based on documentation matches
    confidence += Math.min(docs.length * 0.05, 0.3);

    // Boost confidence based on keyword extraction quality
    const relevantKeywords = analysis.extractedKeywords.filter(
      (k) => k.length > 2,
    );
    confidence += Math.min(relevantKeywords.length * 0.02, 0.2);

    // Adjust based on complexity (complex requests might have lower initial confidence)
    switch (analysis.complexity) {
      case "complex":
        // No adjustment - complex requests start with base confidence
        break;
      case "moderate":
        confidence += 0.05;
        break;
      case "simple":
        confidence += 0.1;
        break;
    }

    // Ensure confidence is within bounds
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Determine maximum results based on request complexity
   */
  private getMaxResults(analysis: RequirementAnalysis): number {
    switch (analysis.complexity) {
      case "complex":
        return 25; // More comprehensive documentation for complex requests
      case "moderate":
        return 15; // Moderate results for moderate complexity
      case "simple":
        return 10; // Fewer results for simple requests
      default:
        return 15;
    }
  }
}
