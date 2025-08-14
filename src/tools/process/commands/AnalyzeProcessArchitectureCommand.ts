import { z } from "zod";

import { ArchitectureDecisionService } from "../../../services/ArchitectureDecisionService.js";
import { ArchitectureExplanationService } from "../../../services/ArchitectureExplanationService.js";
import { ArchitectureValidationService } from "../../../services/ArchitectureValidationService.js";
import { ErrorHandlingPatternService } from "../../../services/ErrorHandlingPatternService.js";
import { HandlerPatternRecommendationService } from "../../../services/HandlerPatternRecommendationService.js";
import { PermawebDocs } from "../../../services/PermawebDocsService.js";
import { ProcessArchitectureAnalysisService } from "../../../services/ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "../../../services/RequirementAnalysisService.js";
import { StateManagementGuidanceService } from "../../../services/StateManagementGuidanceService.js";
import {
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/ToolCommand.js";

type AnalyzeProcessArchitectureArgs = {
  complexityHint: "auto" | "complex" | "moderate" | "simple";
  detailedExplanation: boolean;
  focusAreas?: (
    | "handlers"
    | "messaging"
    | "patterns"
    | "performance"
    | "security"
    | "state"
    | "validation"
  )[];
  includeExamples: boolean;
  includeValidation: boolean;
  userRequest: string;
};

const analyzeProcessArchitectureParametersSchema: z.ZodType<AnalyzeProcessArchitectureArgs> =
  z.object({
    complexityHint: z
      .enum(["simple", "moderate", "complex", "auto"])
      .optional()
      .default("auto" as const)
      .describe(
        "Optional hint about expected complexity (auto = detect automatically)",
      ),
    detailedExplanation: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include detailed explanations and reasoning"),
    focusAreas: z
      .array(
        z.enum([
          "handlers",
          "state",
          "messaging",
          "performance",
          "security",
          "validation",
          "patterns",
        ]),
      )
      .optional()
      .describe(
        "Specific areas to focus the analysis on (omit for complete analysis)",
      ),
    includeExamples: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include code examples and templates in recommendations"),
    includeValidation: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include architecture validation against best practices"),
    userRequest: z
      .string()
      .min(10, "User request must be at least 10 characters")
      .max(1000, "User request cannot exceed 1000 characters")
      .describe("Detailed description of the AO process you want to create"),
  }) as z.ZodType<AnalyzeProcessArchitectureArgs>;

/**
 * MCP tool command for analyzing AO process architecture and providing comprehensive
 * recommendations based on user requirements and documented patterns.
 *
 * This command orchestrates all architecture analysis services to provide:
 * - Architectural pattern analysis from AO documentation
 * - Process type and complexity recommendations
 * - Handler pattern suggestions with templates
 * - State management guidance
 * - Error handling patterns
 * - Architecture validation against best practices
 * - Comprehensive explanations with documentation citations
 */
export class AnalyzeProcessArchitectureCommand extends ToolCommand<
  AnalyzeProcessArchitectureArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description:
      "Analyze user requirements and recommend optimal AO process architectures based on documented patterns, best practices, and comprehensive guidance for implementation",
    name: "analyzeProcessArchitecture",
    title: "Analyze AO Process Architecture with Documentation Patterns",
  };

  protected parametersSchema = analyzeProcessArchitectureParametersSchema;

  // Service instances
  private architectureAnalysisService!: ProcessArchitectureAnalysisService;
  private architectureDecisionService!: ArchitectureDecisionService;
  private errorHandlingService!: ErrorHandlingPatternService;
  private explanationService!: ArchitectureExplanationService;
  private handlerPatternService!: HandlerPatternRecommendationService;
  private permawebDocsService!: PermawebDocs;
  private requirementAnalysisService!: RequirementAnalysisService;
  private stateManagementService!: StateManagementGuidanceService;
  private validationService!: ArchitectureValidationService;

  async execute(
    args: AnalyzeProcessArchitectureArgs,
    context: ToolContext,
  ): Promise<string> {
    try {
      this.initializeServices();

      // Step 1: Analyze user requirements
      const requirements = await this.analyzeRequirements(args);

      // Step 2: Analyze architectural patterns from documentation
      const patternAnalysis = await this.analyzeArchitecturalPatterns(
        args,
        requirements,
      );

      // Step 3: Generate architecture recommendation
      const architectureRecommendation =
        await this.generateArchitectureRecommendation(
          requirements,
          patternAnalysis,
          args,
        );

      // Step 4: Enhance with specialized guidance
      const enhancedRecommendation = await this.enhanceWithSpecializedGuidance(
        architectureRecommendation,
        requirements,
        patternAnalysis,
        args,
      );

      // Step 5: Validate architecture (if requested)
      let validationReport;
      if (args.includeValidation) {
        validationReport = await this.validateArchitecture(
          enhancedRecommendation,
          patternAnalysis.documentationCoverage,
        );
      }

      // Step 6: Generate comprehensive explanation (if requested)
      let explanation;
      if (args.detailedExplanation) {
        explanation = await this.generateExplanation(
          enhancedRecommendation,
          requirements,
          validationReport,
        );
      }

      // Step 7: Format and return results
      return this.formatResults(
        enhancedRecommendation,
        validationReport,
        explanation,
        args,
      );
    } catch (error) {
      return this.formatError(error, args.userRequest);
    }
  }

  /**
   * Analyze architectural patterns from documentation
   */
  private async analyzeArchitecturalPatterns(
    args: AnalyzeProcessArchitectureArgs,
    requirements: any,
  ) {
    const patternResult =
      await this.architectureAnalysisService.analyzeArchitecturalPatterns(
        args.userRequest,
      );

    return {
      ...patternResult,
      documentationCoverage: patternResult.documentationCoverage,
    };
  }

  /**
   * Analyze user requirements
   */
  private async analyzeRequirements(args: AnalyzeProcessArchitectureArgs) {
    const requirements =
      await this.requirementAnalysisService.analyzeRequirements(
        args.userRequest,
      );

    // Override complexity if hint provided (and not 'auto')
    if (args.complexityHint && args.complexityHint !== "auto") {
      requirements.complexity = args.complexityHint;
    }

    return requirements;
  }

  /**
   * Enhance recommendation with specialized guidance
   */
  private async enhanceWithSpecializedGuidance(
    recommendation: any,
    requirements: any,
    patternAnalysis: any,
    args: AnalyzeProcessArchitectureArgs,
  ) {
    const enhanced = { ...recommendation };

    // Add handler pattern recommendations
    if (!args.focusAreas || args.focusAreas.includes("handlers")) {
      const messagePatterns =
        await this.handlerPatternService.analyzeMessagePatterns(
          // Mock docs for message pattern analysis
          [],
        );
      const handlerStructure =
        await this.handlerPatternService.recommendHandlerStructure(
          messagePatterns,
          requirements,
        );
      enhanced.handlerRecommendations = handlerStructure.structure.primary;
    }

    // Add state management guidance
    if (!args.focusAreas || args.focusAreas.includes("state")) {
      const stateGuidance =
        await this.stateManagementService.generateStateManagementGuidance(
          requirements,
          recommendation.recommendedApproach.processType,
        );
      enhanced.stateManagementGuidance = stateGuidance;
    }

    // Add error handling patterns
    if (!args.focusAreas || args.focusAreas.includes("security")) {
      const errorPatterns =
        await this.errorHandlingService.generateErrorHandlingPatterns(
          requirements,
          recommendation.recommendedApproach.processType,
        );
      enhanced.errorHandlingPatterns = errorPatterns;
    }

    return enhanced;
  }

  /**
   * Format error response
   */
  private formatError(error: any, userRequest: string): string {
    return `# ❌ Architecture Analysis Error

An error occurred while analyzing the architecture for: "${userRequest}"

**Error**: ${error instanceof Error ? error.message : "Unknown error occurred"}

## Troubleshooting
- Ensure your request describes a clear AO process use case
- Try simplifying the request or being more specific about requirements
- Check that the request is between 10-1000 characters

## Example Valid Requests
- "Create a token contract with transfer and balance capabilities"
- "Build a DAO governance system with voting and proposals"
- "Design a simple calculator service for mathematical operations"

Please try again with a refined request.`;
  }

  /**
   * Format the final results
   */
  private formatResults(
    recommendation: any,
    validationReport?: any,
    explanation?: any,
    args?: AnalyzeProcessArchitectureArgs,
  ): string {
    let result = `# AO Process Architecture Analysis\n\n`;

    // Overview section
    result += `## 📋 Architecture Overview\n\n`;
    result += `**Recommended Architecture**: ${recommendation.recommendedApproach.name}\n`;
    result += `**Process Type**: ${recommendation.recommendedApproach.processType}\n`;
    result += `**Complexity**: ${recommendation.recommendedApproach.complexity}\n`;
    result += `**Confidence**: ${(recommendation.confidence * 100).toFixed(0)}%\n\n`;

    if (explanation?.overview) {
      result += `${explanation.overview}\n\n`;
    }

    // Architecture Details
    result += `## 🏗️ Architecture Details\n\n`;

    // Process Type Explanation
    result += `### Process Type: ${recommendation.recommendedApproach.processType}\n`;
    if (explanation?.reasoning?.processTypeReasoning) {
      result += `${explanation.reasoning.processTypeReasoning}\n\n`;
    }

    // State Management
    if (recommendation.stateManagementGuidance) {
      result += `### State Management: ${recommendation.stateManagementGuidance.recommended}\n`;
      if (explanation?.reasoning?.stateManagementReasoning) {
        result += `${explanation.reasoning.stateManagementReasoning}\n\n`;
      }
    }

    // Handler Recommendations
    if (recommendation.handlerRecommendations?.length > 0) {
      result += `### 📝 Handler Recommendations\n\n`;
      recommendation.handlerRecommendations
        .slice(0, 5)
        .forEach((handler: any) => {
          result += `**${handler.name}**: ${handler.purpose}\n`;
          if (args?.includeExamples && handler.template) {
            result += `\`\`\`lua\n${handler.template.substring(0, 200)}${handler.template.length > 200 ? "..." : ""}\n\`\`\`\n\n`;
          }
        });
    }

    // Error Handling Patterns
    if (recommendation.errorHandlingPatterns?.length > 0) {
      result += `### 🛡️ Error Handling Patterns\n\n`;
      recommendation.errorHandlingPatterns
        .slice(0, 3)
        .forEach((pattern: any) => {
          result += `**${pattern.name}**: ${pattern.description}\n`;
        });
      result += `\n`;
    }

    // Validation Results
    if (validationReport) {
      result += `## ✅ Architecture Validation\n\n`;
      result += `${validationReport.summary}\n\n`;

      if (validationReport.score.overall >= 0.8) {
        result += `🎉 **Excellent**: This architecture aligns well with AO ecosystem patterns!\n\n`;
      } else if (validationReport.score.overall >= 0.6) {
        result += `✅ **Good**: This architecture follows most AO best practices.\n\n`;
      } else {
        result += `⚠️ **Needs Improvement**: Consider reviewing against AO documentation patterns.\n\n`;
      }

      if (validationReport.recommendations.length > 0) {
        result += `### Recommendations:\n`;
        validationReport.recommendations.forEach((rec: string) => {
          result += `- ${rec}\n`;
        });
        result += `\n`;
      }
    }

    // Best Practices
    if (explanation?.bestPractices?.length > 0) {
      result += `## 💡 Best Practices\n\n`;
      explanation.bestPractices.slice(0, 8).forEach((practice: string) => {
        result += `- ${practice}\n`;
      });
      result += `\n`;
    }

    // Implementation Guidance
    if (explanation?.implementationGuidance && args?.detailedExplanation) {
      result += `## 🚀 Implementation Guidance\n\n`;
      result += `${explanation.implementationGuidance.substring(0, 1500)}${explanation.implementationGuidance.length > 1500 ? "..." : ""}\n\n`;
    }

    // Documentation References
    if (explanation?.documentationCitations?.length > 0) {
      result += `## 📚 Documentation References\n\n`;
      explanation.documentationCitations
        .slice(0, 10)
        .forEach((citation: any, index: number) => {
          result += `${index + 1}. **${citation.title}** (${citation.domain})\n`;
          if (citation.excerpt) {
            result += `   ${citation.excerpt.substring(0, 150)}${citation.excerpt.length > 150 ? "..." : ""}\n`;
          }
          if (citation.source && citation.source !== "test") {
            result += `   Source: ${citation.source}\n`;
          }
          result += `\n`;
        });
    }

    // Related Patterns
    if (explanation?.relatedPatterns?.length > 0) {
      result += `## 🔗 Related Patterns\n\n`;
      explanation.relatedPatterns.forEach((pattern: string) => {
        result += `- ${pattern.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}\n`;
      });
      result += `\n`;
    }

    result += `---\n`;
    result += `*Generated with Permamind Process Architecture Analysis*\n`;
    result += `*Based on AO ecosystem documentation and best practices*\n`;

    return result;
  }

  /**
   * Generate core architecture recommendation
   */
  private async generateArchitectureRecommendation(
    requirements: any,
    patternAnalysis: any,
    args: AnalyzeProcessArchitectureArgs,
  ) {
    return await this.architectureDecisionService.generateArchitectureRecommendation(
      requirements,
      patternAnalysis,
    );
  }

  /**
   * Generate comprehensive explanation
   */
  private async generateExplanation(
    recommendation: any,
    requirements: any,
    validationReport?: any,
  ) {
    return await this.explanationService.generateArchitectureExplanation(
      recommendation,
      requirements,
      validationReport,
    );
  }

  /**
   * Initialize all required services
   */
  private initializeServices(): void {
    if (this.permawebDocsService) return; // Already initialized

    // Initialize base services
    this.permawebDocsService = new PermawebDocs();
    this.requirementAnalysisService = new RequirementAnalysisService();

    // Initialize core architecture services
    this.architectureAnalysisService = new ProcessArchitectureAnalysisService(
      this.permawebDocsService,
      this.requirementAnalysisService,
    );

    this.architectureDecisionService = new ArchitectureDecisionService(
      this.architectureAnalysisService,
      this.requirementAnalysisService,
    );

    // Initialize specialized services
    this.handlerPatternService = new HandlerPatternRecommendationService(
      this.permawebDocsService,
      this.requirementAnalysisService,
    );

    this.stateManagementService = new StateManagementGuidanceService(
      this.permawebDocsService,
    );

    this.errorHandlingService = new ErrorHandlingPatternService(
      this.permawebDocsService,
    );

    this.validationService = new ArchitectureValidationService(
      this.permawebDocsService,
    );

    this.explanationService = new ArchitectureExplanationService(
      this.permawebDocsService,
    );
  }

  /**
   * Validate architecture against documented patterns
   */
  private async validateArchitecture(
    recommendation: any,
    documentationCoverage: any,
  ) {
    // Mock documentation for validation
    const mockDocs = documentationCoverage.map((coverage: any) => ({
      content: `# ${coverage.domain} Documentation\nExample patterns for ${coverage.domain}`,
      domain: coverage.domain,
      isFullDocument: true,
      relevanceScore: 0.8,
      url: `https://docs.${coverage.domain}.com`,
    }));

    const similarPatterns = await this.validationService.findSimilarPatterns(
      recommendation,
      mockDocs,
    );

    const architectureScore =
      await this.validationService.scoreArchitectureMatch(
        recommendation,
        similarPatterns,
      );

    const bestPracticeValidation =
      await this.validationService.validateBestPractices(recommendation);

    return await this.validationService.generateValidationReport(
      architectureScore,
      bestPracticeValidation,
      recommendation,
    );
  }
}
