import { ComplexityLevel, ProcessType } from "../types/lua-workflow.js";
import {
  ArchitecturePattern,
  ArchitectureRecommendation,
  ArchitectureScore,
  BestPracticeValidation,
  DocumentationExample,
  SimilarPatternResult,
  ValidationReport,
} from "../types/process-architecture.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for validating architecture recommendations against documented patterns
 * and best practices from the AO ecosystem.
 *
 * This service provides:
 * - Pattern matching against documented AO architecture examples
 * - Architecture scoring based on similarity to proven patterns
 * - Best practice validation using documented guidelines
 * - Validation reporting with specific documentation citations
 */
export class ArchitectureValidationService {
  private readonly bestPractices = {
    general: [
      {
        description: "All handlers should validate input parameters",
        fix: "Add input validation checks before processing messages",
        name: "Input Validation",
        severity: "error",
        validation: (code: string) =>
          code.includes("if not") || code.includes("validate"),
      },
      {
        description: "Handlers should implement proper error handling",
        fix: "Add error handling with pcall or explicit error returns",
        name: "Error Handling",
        severity: "error",
        validation: (code: string) =>
          code.includes("pcall") || code.includes("error"),
      },
      {
        description: "Handlers should return consistent response formats",
        fix: "Ensure all code paths return appropriate values",
        name: "Consistent Returns",
        severity: "warning",
        validation: (code: string) => code.includes("return"),
      },
    ],
    "multi-process": [
      {
        description: "Implement proper inter-process communication",
        fix: "Add proper message sending patterns for inter-process communication",
        name: "Communication Protocols",
        severity: "error",
        validation: (code: string) =>
          code.includes("ao.send") && code.includes("Target"),
      },
      {
        description: "Handle communication failures gracefully",
        fix: "Implement timeout and retry logic for external communications",
        name: "Error Recovery",
        severity: "warning",
        validation: (code: string) =>
          code.includes("timeout") || code.includes("retry"),
      },
      {
        description: "Coordinate between processes properly",
        fix: "Add acknowledgment patterns for process coordination",
        name: "Process Coordination",
        severity: "warning",
        validation: (code: string) =>
          code.includes("response") || code.includes("acknowledge"),
      },
    ],
    stateful: [
      {
        description: "State should be properly initialized",
        fix: "Initialize state variables at process startup",
        name: "State Initialization",
        severity: "error",
        validation: (code: string) =>
          code.includes("local state") || code.includes("= {}"),
      },
      {
        description: "Validate state before and after operations",
        fix: "Add state validation before critical operations",
        name: "State Validation",
        severity: "warning",
        validation: (code: string) =>
          code.includes("validate") && code.includes("state"),
      },
      {
        description: "State changes should be atomic",
        fix: "Use protected calls or transactions for state changes",
        name: "Atomic Operations",
        severity: "warning",
        validation: (code: string) =>
          code.includes("pcall") || code.includes("transaction"),
      },
    ],
    stateless: [
      {
        description: "Stateless handlers should be pure functions",
        fix: "Remove state variables and make handlers pure functions",
        name: "Pure Functions",
        severity: "error",
        validation: (code: string) =>
          !code.includes("local state") && !code.includes("global"),
      },
      {
        description: "Avoid side effects in stateless processes",
        fix: "Minimize side effects or use proper response patterns",
        name: "No Side Effects",
        severity: "warning",
        validation: (code: string) =>
          !code.includes("ao.send") || code.includes("response"),
      },
    ],
  };

  private readonly patternSimilarityWeights = {
    complexity: 0.2,
    handlerPatterns: 0.2,
    messageTypes: 0.15,
    processType: 0.3,
    stateManagement: 0.15,
  };

  constructor(private permawebDocsService: PermawebDocs) {}

  /**
   * Find similar patterns in documentation based on proposed architecture
   */
  async findSimilarPatterns(
    proposedArchitecture: ArchitectureRecommendation,
    docs: PermawebDocsResult[],
  ): Promise<SimilarPatternResult> {
    try {
      const matches = [];
      let totalSimilarity = 0;

      // Create a pattern from the proposed architecture
      const proposedPattern =
        this.createPatternFromArchitecture(proposedArchitecture);

      for (const doc of docs) {
        const documentPattern = this.extractPatternFromDocument(doc);
        const similarity = this.calculatePatternSimilarity(
          proposedPattern,
          documentPattern,
        );

        if (similarity > 0.3) {
          // Only include patterns with reasonable similarity
          matches.push({
            documentation: [this.createDocumentationExample(doc)],
            pattern: documentPattern,
            similarity,
          });
          totalSimilarity += similarity;
        }
      }

      // Sort matches by similarity
      matches.sort((a, b) => b.similarity - a.similarity);

      return {
        averageSimilarity:
          matches.length > 0 ? totalSimilarity / matches.length : 0,
        matches: matches.slice(0, 10), // Limit to top 10 matches
        totalMatches: matches.length,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureValidationService.findSimilarPatterns failed: ${error}`,
      );
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport(
    score: ArchitectureScore,
    validation: BestPracticeValidation,
    architecture: ArchitectureRecommendation,
  ): Promise<ValidationReport> {
    try {
      const summary = this.generateValidationSummary(score, validation);
      const recommendations = this.generateValidationRecommendations(
        score,
        validation,
      );
      const documentation =
        this.consolidateDocumentationReferences(architecture);

      return {
        documentation,
        recommendations,
        score,
        summary,
        validation,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureValidationService.generateValidationReport failed: ${error}`,
      );
    }
  }

  /**
   * Score architecture based on similarity to documented patterns and best practices
   */
  async scoreArchitectureMatch(
    proposed: ArchitectureRecommendation,
    documented: SimilarPatternResult,
  ): Promise<ArchitectureScore> {
    try {
      // Calculate pattern match score
      const patternMatchScore = this.calculatePatternMatchScore(documented);

      // Calculate documentation support score
      const documentationSupportScore = this.calculateDocumentationSupportScore(
        proposed,
        documented,
      );

      // Calculate best practice alignment score (placeholder - would need code to validate)
      const bestPracticeScore = 0.8; // Default good score for recommendations

      // Calculate complexity appropriateness score
      const complexityScore = this.calculateComplexityScore(proposed);

      const breakdown = {
        bestPracticeAlignment: bestPracticeScore,
        complexity: complexityScore,
        documentationSupport: documentationSupportScore,
        patternMatch: patternMatchScore,
      };

      // Calculate weighted overall score
      const overall =
        patternMatchScore * 0.3 +
        documentationSupportScore * 0.25 +
        bestPracticeScore * 0.25 +
        complexityScore * 0.2;

      return {
        breakdown,
        overall,
        reasoning: this.generateScoreReasoning(breakdown, overall),
      };
    } catch (error) {
      throw new Error(
        `ArchitectureValidationService.scoreArchitectureMatch failed: ${error}`,
      );
    }
  }

  /**
   * Validate architecture against best practices
   */
  async validateBestPractices(
    architecture: ArchitectureRecommendation,
    code?: string,
  ): Promise<BestPracticeValidation> {
    try {
      const passed = [];
      const warnings = [];
      const errors = [];

      // Get applicable best practices
      const practices = [
        ...this.bestPractices.general,
        ...this.bestPractices[architecture.recommendedApproach.processType],
      ];

      // If code is provided, validate against practices
      if (code) {
        for (const practice of practices) {
          const isValid = practice.validation(code);

          if (isValid) {
            passed.push({
              description: practice.description,
              documentation: [],
              practice: practice.name,
            });
          } else {
            const violation = {
              documentation: [],
              issue: `Violation of ${practice.name}: ${practice.description}`,
              practice: practice.name,
              suggestion: practice.fix,
            };

            if (practice.severity === "error") {
              errors.push({
                documentation: [],
                fix: violation.suggestion,
                practice: practice.name,
                violation: violation.issue,
              });
            } else {
              warnings.push(violation);
            }
          }
        }
      } else {
        // Without code, assume best practices are followed but add recommendations
        for (const practice of practices) {
          passed.push({
            description: `Ensure ${practice.description.toLowerCase()}`,
            documentation: [],
            practice: practice.name,
          });
        }
      }

      return { errors, passed, warnings };
    } catch (error) {
      throw new Error(
        `ArchitectureValidationService.validateBestPractices failed: ${error}`,
      );
    }
  }

  /**
   * Calculate complexity appropriateness score
   */
  private calculateComplexityScore(
    proposed: ArchitectureRecommendation,
  ): number {
    // This is a simplified scoring - in practice would analyze requirements vs recommended complexity
    const complexity = proposed.recommendedApproach.complexity;

    // Moderate complexity generally gets best score as it balances features with simplicity
    const scores = {
      complex: 0.9,
      moderate: 1.0,
      simple: 0.8,
    };

    return scores[complexity] || 0.7;
  }

  /**
   * Calculate documentation support score
   */
  private calculateDocumentationSupportScore(
    proposed: ArchitectureRecommendation,
    documented: SimilarPatternResult,
  ): number {
    const proposedDocCount = proposed.documentationSupport.length;
    const documentedExampleCount = documented.matches.reduce(
      (total, match) => total + match.documentation.length,
      0,
    );

    // Score based on availability of documentation
    const proposedScore = Math.min(proposedDocCount / 3, 1); // Up to 3 docs give full score
    const documentedScore = Math.min(documentedExampleCount / 10, 1); // Up to 10 examples

    return proposedScore * 0.6 + documentedScore * 0.4;
  }

  /**
   * Calculate pattern match score
   */
  private calculatePatternMatchScore(documented: SimilarPatternResult): number {
    if (documented.matches.length === 0) return 0.2; // Low score for no matches

    // Weight by number of matches and average similarity
    const matchesScore = Math.min(documented.matches.length / 5, 1); // Up to 5 matches give full score
    const similarityScore = documented.averageSimilarity;

    return matchesScore * 0.4 + similarityScore * 0.6;
  }

  /**
   * Calculate similarity between patterns
   */
  private calculatePatternSimilarity(
    pattern1: ArchitecturePattern,
    pattern2: ArchitecturePattern,
  ): number {
    let similarity = 0;

    // Process type similarity
    if (pattern1.processType === pattern2.processType) {
      similarity += this.patternSimilarityWeights.processType;
    }

    // Complexity similarity
    if (pattern1.complexity === pattern2.complexity) {
      similarity += this.patternSimilarityWeights.complexity;
    } else {
      // Partial credit for adjacent complexity levels
      const complexityOrder = ["simple", "moderate", "complex"];
      const diff = Math.abs(
        complexityOrder.indexOf(pattern1.complexity) -
          complexityOrder.indexOf(pattern2.complexity),
      );
      if (diff === 1) {
        similarity += this.patternSimilarityWeights.complexity * 0.5;
      }
    }

    // Handler patterns similarity
    const handlerIntersection = pattern1.handlerPatterns.filter((h) =>
      pattern2.handlerPatterns.includes(h),
    );
    const handlerUnion = new Set([
      ...pattern1.handlerPatterns,
      ...pattern2.handlerPatterns,
    ]);
    const handlerSimilarity =
      handlerUnion.size > 0
        ? handlerIntersection.length / handlerUnion.size
        : 0;
    similarity +=
      this.patternSimilarityWeights.handlerPatterns * handlerSimilarity;

    // Message types similarity
    const messageIntersection = pattern1.messageTypes.filter((m) =>
      pattern2.messageTypes.includes(m),
    );
    const messageUnion = new Set([
      ...pattern1.messageTypes,
      ...pattern2.messageTypes,
    ]);
    const messageSimilarity =
      messageUnion.size > 0
        ? messageIntersection.length / messageUnion.size
        : 0;
    similarity +=
      this.patternSimilarityWeights.messageTypes * messageSimilarity;

    // State management similarity
    if (pattern1.stateManagement === pattern2.stateManagement) {
      similarity += this.patternSimilarityWeights.stateManagement;
    }

    return similarity;
  }

  /**
   * Consolidate documentation references
   */
  private consolidateDocumentationReferences(
    architecture: ArchitectureRecommendation,
  ): DocumentationExample[] {
    const docs = [...architecture.documentationSupport];

    // Add unique references from handler recommendations
    for (const handler of architecture.handlerRecommendations) {
      for (const doc of handler.documentation) {
        if (!docs.some((d) => d.source === doc.source)) {
          docs.push(doc);
        }
      }
    }

    // Add references from state management guidance
    for (const doc of architecture.stateManagementGuidance.documentation) {
      if (!docs.some((d) => d.source === doc.source)) {
        docs.push(doc);
      }
    }

    return docs.slice(0, 20); // Limit to top 20 references
  }

  private createDocumentationExample(
    doc: PermawebDocsResult,
  ): DocumentationExample {
    return {
      domain: doc.domain,
      excerpt: doc.content.substring(0, 200),
      relevance: doc.relevanceScore,
      source: doc.url,
      title: this.extractTitleFromContent(doc.content),
    };
  }

  /**
   * Create pattern from architecture recommendation
   */
  private createPatternFromArchitecture(
    architecture: ArchitectureRecommendation,
  ): ArchitecturePattern {
    return {
      complexity: architecture.recommendedApproach.complexity,
      description: architecture.recommendedApproach.description,
      examples: architecture.documentationSupport,
      handlerPatterns:
        architecture.handlerRecommendations.map((h) => h.name) || [],
      messageTypes:
        architecture.handlerRecommendations.flatMap((h) => h.messageTypes) ||
        [],
      name: architecture.recommendedApproach.name,
      processType: architecture.recommendedApproach.processType,
      stateManagement: architecture.stateManagementGuidance.recommended,
    };
  }

  private detectComplexityFromContent(content: string): ComplexityLevel {
    if (content.includes("complex") || content.includes("distributed")) {
      return "complex";
    }
    if (content.includes("moderate") || content.includes("balance")) {
      return "moderate";
    }
    return "simple";
  }

  /**
   * Helper methods for content analysis
   */
  private detectProcessTypeFromContent(content: string): ProcessType {
    if (content.includes("stateless") || !content.includes("state")) {
      return "stateless";
    }
    if (content.includes("multi-process") || content.includes("ao.send")) {
      return "multi-process";
    }
    return "stateful";
  }

  private detectStateManagementFromContent(content: string): any {
    if (!content.includes("state")) return "none";
    if (content.includes("const") && content.includes("state")) return "hybrid";
    if (content.includes("ao.send") && content.includes("state"))
      return "external";
    if (content.includes("state")) return "mutable";
    return "immutable";
  }

  private extractHandlerPatternsFromContent(content: string): string[] {
    const patterns = [];
    if (content.includes("handlers.add")) patterns.push("standard-handler");
    if (content.includes("pcall")) patterns.push("error-handling");
    if (content.includes("validate")) patterns.push("validation");
    return patterns;
  }

  private extractMessageTypesFromContent(content: string): string[] {
    const types = [];
    if (content.includes("transfer")) types.push("transfer");
    if (content.includes("balance")) types.push("balance");
    if (content.includes("vote")) types.push("vote");
    if (content.includes("info")) types.push("info");
    return types;
  }

  /**
   * Extract pattern from documentation
   */
  private extractPatternFromDocument(
    doc: PermawebDocsResult,
  ): ArchitecturePattern {
    const content = doc.content.toLowerCase();

    // Detect process type
    const processType = this.detectProcessTypeFromContent(content);

    // Detect complexity
    const complexity = this.detectComplexityFromContent(content);

    // Extract handler patterns
    const handlerPatterns = this.extractHandlerPatternsFromContent(content);

    // Extract message types
    const messageTypes = this.extractMessageTypesFromContent(content);

    // Detect state management
    const stateManagement = this.detectStateManagementFromContent(content);

    return {
      complexity,
      description: doc.content.substring(0, 200),
      examples: [this.createDocumentationExample(doc)],
      handlerPatterns,
      messageTypes,
      name: this.extractTitleFromContent(doc.content),
      processType,
      stateManagement,
    };
  }

  private extractTitleFromContent(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : "Architecture Pattern";
  }

  /**
   * Generate score reasoning
   */
  private generateScoreReasoning(breakdown: any, overall: number): string[] {
    const reasoning = [];

    reasoning.push(
      `Overall architecture score: ${(overall * 100).toFixed(0)}%`,
    );

    if (breakdown.patternMatch > 0.8) {
      reasoning.push("Strong match with documented patterns");
    } else if (breakdown.patternMatch > 0.5) {
      reasoning.push("Moderate match with existing patterns");
    } else {
      reasoning.push(
        "Limited matching patterns found - consider validating approach",
      );
    }

    if (breakdown.documentationSupport > 0.7) {
      reasoning.push("Well-supported by documentation and examples");
    } else {
      reasoning.push("Could benefit from additional documentation references");
    }

    if (breakdown.bestPracticeAlignment > 0.8) {
      reasoning.push("Aligns well with AO best practices");
    }

    return reasoning;
  }

  /**
   * Generate validation recommendations
   */
  private generateValidationRecommendations(
    score: ArchitectureScore,
    validation: BestPracticeValidation,
  ): string[] {
    const recommendations = [];

    // Score-based recommendations
    if (score.overall < 0.7) {
      recommendations.push(
        "Consider reviewing architecture against documented AO patterns",
      );
    }

    if (score.breakdown.patternMatch < 0.5) {
      recommendations.push(
        "Search for more similar patterns in AO documentation to validate approach",
      );
    }

    if (score.breakdown.documentationSupport < 0.6) {
      recommendations.push(
        "Add more documentation references to support architectural decisions",
      );
    }

    // Error and warning based recommendations
    if (validation.errors.length > 0) {
      recommendations.push("Address critical errors before implementation");
    }

    if (validation.warnings.length > 2) {
      recommendations.push(
        "Review and address warnings to improve architecture quality",
      );
    }

    return recommendations;
  }

  /**
   * Generate validation summary
   */
  private generateValidationSummary(
    score: ArchitectureScore,
    validation: BestPracticeValidation,
  ): string {
    const scorePercent = (score.overall * 100).toFixed(0);
    const errorCount = validation.errors.length;
    const warningCount = validation.warnings.length;

    if (errorCount > 0) {
      return `Architecture validation score: ${scorePercent}%. ${errorCount} critical issues and ${warningCount} warnings need attention.`;
    } else if (warningCount > 0) {
      return `Architecture validation score: ${scorePercent}%. ${warningCount} warnings to consider for optimization.`;
    } else {
      return `Architecture validation score: ${scorePercent}%. Architecture follows documented patterns and best practices.`;
    }
  }
}
