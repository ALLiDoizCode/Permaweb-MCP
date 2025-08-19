import {
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import {
  ArchitecturalApproach,
  ArchitectureMapping,
  ArchitectureRecommendation,
  ComplexityAssessment,
  ComplexityEvaluation,
  DecisionExplanation,
  DocumentationExample,
  ProcessTypeRecommendation,
} from "../types/process-architecture.js";
import { ProcessArchitectureAnalysisService } from "./ProcessArchitectureAnalysisService.js";
import { RequirementAnalysisService } from "./RequirementAnalysisService.js";

/**
 * Service for making architectural decisions by mapping user requirements to documented patterns.
 *
 * This service processes requirements analysis and architectural patterns to:
 * - Generate architecture recommendations based on complexity and use case
 * - Map requirements to appropriate process types and patterns
 * - Provide decision reasoning with documentation support
 * - Evaluate architectural complexity and provide guidance
 */
export class ArchitectureDecisionService {
  private readonly complexityWeights = {
    dataComplexity: 0.3,
    interactionComplexity: 0.25,
    performanceRequirements: 0.2,
    scalabilityRequirements: 0.25,
  };

  private readonly processTypeDecisionTree = {
    "multi-process": {
      advantages: [
        "High availability and fault tolerance",
        "Specialized process optimization",
        "Natural load distribution",
        "Independent scaling",
      ],
      conditions: [
        "distributed processing",
        "specialized responsibilities",
        "fault tolerance needs",
        "load distribution",
      ],
      disadvantages: [
        "Inter-process communication complexity",
        "Distributed system challenges",
        "Coordination overhead",
      ],
    },
    stateful: {
      advantages: [
        "Rich data modeling capabilities",
        "Complex workflow support",
        "User session persistence",
        "Transactional consistency",
      ],
      conditions: [
        "persistent data requirements",
        "user session management",
        "complex business logic",
        "data consistency needs",
      ],
      disadvantages: [
        "More complex testing and debugging",
        "State synchronization challenges",
        "Backup and recovery complexity",
      ],
    },
    stateless: {
      advantages: [
        "Simple to test and debug",
        "Easy horizontal scaling",
        "No state synchronization issues",
        "Fast deployment and rollback",
      ],
      conditions: [
        "request-response patterns",
        "no persistent state",
        "pure functions",
        "high parallelism",
      ],
      disadvantages: [
        "Cannot maintain user sessions",
        "Limited to computation-only tasks",
        "Requires external state management",
      ],
    },
  };

  constructor(
    private architectureAnalysisService: ProcessArchitectureAnalysisService,
    private requirementAnalysisService: RequirementAnalysisService,
  ) {}

  /**
   * Evaluate architectural complexity based on requirements (DEPRECATED - use shared service)
   * @deprecated Use createComplexityEvaluationFromRequirements instead
   */
  async evaluateArchitecturalComplexity(
    requirements: RequirementAnalysis,
  ): Promise<ComplexityEvaluation> {
    try {
      const factors = [
        {
          description: "Complexity of data structures and relationships",
          name: "Data Complexity",
          score: this.assessDataComplexity(requirements),
          weight: this.complexityWeights.dataComplexity,
        },
        {
          description: "Complexity of user and system interactions",
          name: "Interaction Complexity",
          score: this.assessInteractionComplexity(requirements),
          weight: this.complexityWeights.interactionComplexity,
        },
        {
          description: "Required scalability and performance characteristics",
          name: "Scalability Requirements",
          score: this.assessScalabilityRequirements(requirements),
          weight: this.complexityWeights.scalabilityRequirements,
        },
        {
          description: "Performance and latency requirements",
          name: "Performance Requirements",
          score: this.assessPerformanceRequirements(requirements),
          weight: this.complexityWeights.performanceRequirements,
        },
      ];

      const totalScore = factors.reduce(
        (sum, factor) => sum + factor.score * factor.weight,
        0,
      );

      const level: ComplexityLevel =
        totalScore >= 0.7
          ? "complex"
          : totalScore >= 0.4
            ? "moderate"
            : "simple";

      return {
        factors,
        level,
        recommendations: this.generateComplexityRecommendations(level),
        score: totalScore,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureDecisionService.evaluateArchitecturalComplexity failed: ${error}`,
      );
    }
  }

  /**
   * Generate comprehensive architecture recommendation based on requirements and patterns
   */
  async generateArchitectureRecommendation(
    requirements: RequirementAnalysis,
    patternResult: any, // ArchitecturePatternResult from analysis service
  ): Promise<ArchitectureRecommendation> {
    try {
      // Use complexity from shared RequirementAnalysisService instead of duplicating logic
      const complexity =
        await this.createComplexityEvaluationFromRequirements(requirements);

      // Get process type recommendation
      const processTypeRec = await this.recommendProcessType(
        complexity,
        patternResult,
      );

      // Map requirements to architectural approach
      const mapping = await this.mapRequirementsToArchitecture(
        requirements,
        complexity,
      );

      // Generate reasoning
      const reasoning = await this.generateDecisionReasoning(
        requirements,
        complexity,
        processTypeRec,
      );

      // Find relevant documentation examples
      const documentationSupport = this.findRelevantDocumentation(
        patternResult.patterns,
        mapping.primary.processType,
      );

      return {
        alternativeApproaches: mapping.alternatives,
        confidence: mapping.mappingConfidence,
        documentationSupport,
        errorHandlingPatterns: [], // Will be populated by error handling service
        handlerRecommendations: [], // Will be populated by handler service
        reasoning: reasoning.detailedReasonings.map((r) => r.reasoning),
        recommendedApproach: mapping.primary,
        stateManagementGuidance: {
          alternatives: this.getAlternativeStateManagement(
            mapping.primary.processType,
          ),
          bestPractices: this.getStateManagementBestPractices(
            mapping.primary.processType,
          ),
          documentation: [],
          patterns: [],
          recommended: this.recommendStateManagement(
            requirements,
            mapping.primary.processType,
          ),
        },
      };
    } catch (error) {
      throw new Error(
        `ArchitectureDecisionService.generateArchitectureRecommendation failed: ${error}`,
      );
    }
  }

  /**
   * Map requirements to specific architectural approach
   */
  async mapRequirementsToArchitecture(
    requirements: RequirementAnalysis,
    complexity: ComplexityEvaluation,
  ): Promise<ArchitectureMapping> {
    try {
      // Create primary architectural approach
      const primary: ArchitecturalApproach = {
        complexity: complexity.level,
        description: this.generateArchitectureDescription(
          requirements.processType,
          complexity.level,
          requirements.detectedPatterns,
        ),
        documentation: [], // Will be populated with actual examples
        name: this.generateArchitectureName(
          requirements.processType,
          complexity.level,
        ),
        processType: requirements.processType,
        suitableFor: this.getSuitableUseCases(
          requirements.processType,
          requirements.detectedPatterns,
        ),
      };

      // Generate alternative approaches
      const alternatives = this.generateAlternativeApproaches(
        primary,
        requirements,
        complexity,
      );

      // Calculate mapping confidence
      const mappingConfidence = this.calculateMappingConfidence(
        requirements,
        complexity,
      );

      return {
        alternatives,
        documentation: [], // Will be populated with relevant examples
        mappingConfidence,
        primary,
        reasoning: this.generateMappingReasoning(primary, complexity),
      };
    } catch (error) {
      throw new Error(
        `ArchitectureDecisionService.mapRequirementsToArchitecture failed: ${error}`,
      );
    }
  }

  /**
   * Recommend process type based on complexity and patterns
   */
  async recommendProcessType(
    complexity: ComplexityEvaluation,
    patternResult: any,
  ): Promise<ProcessTypeRecommendation> {
    try {
      // Ensure patternResult has the expected structure
      if (!patternResult?.processTypes) {
        throw new Error("patternResult.processTypes is required");
      }

      // Analyze available patterns by process type
      const { multiProcess, stateful, stateless } = patternResult.processTypes;

      // Score each process type based on complexity and pattern availability
      const processTypeScores = {
        "multi-process": this.scoreProcessType(
          "multi-process",
          complexity,
          multiProcess?.patterns?.length || 0,
        ),
        stateful: this.scoreProcessType(
          "stateful",
          complexity,
          stateful?.patterns?.length || 0,
        ),
        stateless: this.scoreProcessType(
          "stateless",
          complexity,
          stateless?.patterns?.length || 0,
        ),
      };

      // Find the highest scoring process type
      const recommended = Object.entries(processTypeScores).reduce((a, b) =>
        a[1] > b[1] ? a : b,
      )[0] as ProcessType;

      // Get alternatives (sorted by score, excluding recommended)
      const alternatives = Object.entries(processTypeScores)
        .filter(([type]) => type !== recommended)
        .sort(([, a], [, b]) => b - a)
        .map(([type]) => type as ProcessType);

      // Generate reasoning
      const reasoning = this.generateProcessTypeReasoning(
        recommended,
        complexity,
        processTypeScores,
      );

      // Find documentation evidence
      const documentationEvidence = this.findProcessTypeDocumentation(
        recommended,
        patternResult,
      );

      // Generate tradeoffs analysis
      const tradeoffs = this.generateProcessTypeTradeoffs(recommended);

      return {
        alternatives,
        documentationEvidence,
        reasoning,
        recommended,
        tradeoffs,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureDecisionService.recommendProcessType failed: ${error}`,
      );
    }
  }

  /**
   * Assess data complexity based on requirements
   */
  private assessDataComplexity(requirements: RequirementAnalysis): number {
    let score = 0.2; // Base score

    // Increase score based on detected patterns
    if (requirements.detectedPatterns.includes("token-contract")) score += 0.3;
    if (requirements.detectedPatterns.includes("dao-governance")) score += 0.5;
    if (requirements.detectedPatterns.includes("state-management"))
      score += 0.3;
    if (requirements.detectedPatterns.includes("process-communication"))
      score += 0.4;

    // Increase score based on keywords indicating data complexity
    const complexDataKeywords = [
      "balance",
      "ledger",
      "history",
      "relationship",
      "mapping",
      "governance",
      "voting",
      "proposals",
      "distributed",
      "communication",
    ];
    const keywordMatches = requirements.extractedKeywords.filter((keyword) =>
      complexDataKeywords.some((complex) => keyword.includes(complex)),
    ).length;
    score += keywordMatches * 0.15;

    return Math.min(score, 1.0);
  }

  /**
   * Assess interaction complexity based on requirements
   */
  private assessInteractionComplexity(
    requirements: RequirementAnalysis,
  ): number {
    let score = 0.1; // Base score

    // Increase score based on patterns requiring complex interactions
    if (requirements.detectedPatterns.includes("message-routing")) score += 0.4;
    if (requirements.detectedPatterns.includes("process-communication"))
      score += 0.5;
    if (requirements.detectedPatterns.includes("dao-governance")) score += 0.3;

    // Increase score based on complexity level
    switch (requirements.complexity) {
      case "complex":
        score += 0.5;
        break;
      case "moderate":
        score += 0.2;
        break;
      default:
        break;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Assess performance requirements
   */
  private assessPerformanceRequirements(
    requirements: RequirementAnalysis,
  ): number {
    let score = 0.1; // Base score

    const performanceKeywords = [
      "fast",
      "performance",
      "latency",
      "throughput",
      "real-time",
    ];
    const matches = requirements.extractedKeywords.filter((keyword) =>
      performanceKeywords.some((perf) => keyword.includes(perf)),
    ).length;

    score += matches * 0.25;

    // Stateless processes generally have better performance characteristics
    if (requirements.processType === "stateless") score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Assess scalability requirements
   */
  private assessScalabilityRequirements(
    requirements: RequirementAnalysis,
  ): number {
    let score = 0.1; // Base score

    const scalabilityKeywords = [
      "scale",
      "concurrent",
      "parallel",
      "distributed",
      "multiple",
    ];
    const matches = requirements.extractedKeywords.filter((keyword) =>
      scalabilityKeywords.some((scale) => keyword.includes(scale)),
    ).length;

    score += matches * 0.25;

    if (requirements.processType === "multi-process") score += 0.4;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate mapping confidence
   */
  private calculateMappingConfidence(
    requirements: RequirementAnalysis,
    complexity: ComplexityEvaluation,
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on clear pattern detection
    confidence += requirements.detectedPatterns.length * 0.1;

    // Increase confidence based on complexity assessment certainty
    const complexityScore = complexity.score;
    if (complexityScore > 0.8 || complexityScore < 0.2) {
      confidence += 0.2; // High confidence when complexity is clearly high or low
    }

    // Increase confidence based on keyword clarity
    confidence += Math.min(requirements.extractedKeywords.length / 10, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Convert complexity level to score (for compatibility with existing logic)
   */
  private complexityLevelToScore(level: ComplexityLevel): number {
    switch (level) {
      case "complex":
        return 0.8;
      case "moderate":
        return 0.5;
      case "simple":
        return 0.2;
      default:
        return 0.5;
    }
  }

  /**
   * Create ComplexityEvaluation from shared RequirementAnalysis (delegating to shared service)
   */
  private async createComplexityEvaluationFromRequirements(
    requirements: RequirementAnalysis,
  ): Promise<ComplexityEvaluation> {
    try {
      // Use the complexity level from the shared RequirementAnalysisService
      const level = requirements.complexity;
      const score = this.complexityLevelToScore(level);

      // Create simplified factors based on shared analysis
      const factors = [
        {
          description: "Detected patterns and functionality complexity",
          name: "Pattern Complexity",
          score: requirements.detectedPatterns.length * 0.15,
          weight: 0.4,
        },
        {
          description: "Process type and interaction requirements",
          name: "Process Interaction",
          score:
            requirements.processType === "multi-process"
              ? 0.8
              : requirements.processType === "stateful"
                ? 0.5
                : 0.3,
          weight: 0.3,
        },
        {
          description: "Keyword richness and technical complexity",
          name: "Technical Complexity",
          score: Math.min(requirements.extractedKeywords.length * 0.05, 0.8),
          weight: 0.3,
        },
      ];

      return {
        factors,
        level,
        recommendations: this.generateComplexityRecommendations(level),
        score,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureDecisionService.createComplexityEvaluationFromRequirements failed: ${error}`,
      );
    }
  }

  /**
   * Find process type documentation
   */
  private findProcessTypeDocumentation(
    processType: ProcessType,
    patternResult: any,
  ): DocumentationExample[] {
    const processTypeKey =
      processType === "multi-process" ? "multiProcess" : processType;
    const relevantPatterns =
      patternResult?.processTypes?.[processTypeKey]?.patterns || [];

    return relevantPatterns.slice(0, 3).flatMap((pattern: any) =>
      (pattern.examples || []).map((example: any) => ({
        domain: example.domain,
        excerpt: example.excerpt,
        relevance: example.relevance,
        source: example.source,
        title: example.title,
        url: example.url,
      })),
    );
  }

  /**
   * Find relevant documentation examples
   */
  private findRelevantDocumentation(
    patterns: any[],
    processType: ProcessType,
  ): DocumentationExample[] {
    return patterns
      .filter((pattern) => pattern.processType === processType)
      .slice(0, 3)
      .flatMap((pattern) => pattern.examples || []);
  }

  /**
   * Generate alternative approaches
   */
  private generateAlternativeApproaches(
    primary: ArchitecturalApproach,
    requirements: RequirementAnalysis,
    complexity: ComplexityEvaluation,
  ): ArchitecturalApproach[] {
    const alternatives: ArchitecturalApproach[] = [];
    const processTypes: ProcessType[] = [
      "stateless",
      "stateful",
      "multi-process",
    ];

    processTypes
      .filter((type) => type !== primary.processType)
      .forEach((type) => {
        alternatives.push({
          complexity: complexity.level,
          description: this.generateArchitectureDescription(
            type,
            complexity.level,
            requirements.detectedPatterns,
          ),
          documentation: [],
          name: this.generateArchitectureName(type, complexity.level),
          processType: type,
          suitableFor: this.getSuitableUseCases(
            type,
            requirements.detectedPatterns,
          ),
        });
      });

    return alternatives;
  }

  /**
   * Generate architecture description
   */
  private generateArchitectureDescription(
    processType: ProcessType,
    complexity: ComplexityLevel,
    patterns: string[],
  ): string {
    return `A ${complexity} ${processType} architecture suitable for ${patterns.join(
      ", ",
    )} patterns with appropriate scalability and maintainability characteristics.`;
  }

  /**
   * Generate architecture name
   */
  private generateArchitectureName(
    processType: ProcessType,
    complexity: ComplexityLevel,
  ): string {
    const typeNames = {
      "multi-process": "Distributed System",
      stateful: "Stateful Application",
      stateless: "Stateless Service",
    };

    return `${complexity.charAt(0).toUpperCase() + complexity.slice(1)} ${
      typeNames[processType]
    }`;
  }

  /**
   * Generate complexity-based recommendations
   */
  private generateComplexityRecommendations(level: ComplexityLevel): string[] {
    switch (level) {
      case "complex":
        return [
          "Consider multi-process architecture for complex systems",
          "Implement comprehensive error handling and recovery",
          "Plan for high scalability and performance",
          "Use advanced patterns and optimization techniques",
        ];
      case "moderate":
        return [
          "Balance simplicity with functionality",
          "Consider stateful architecture if persistence needed",
          "Implement proper error handling",
          "Plan for moderate scalability",
        ];
      case "simple":
        return [
          "Consider stateless architecture for simplicity",
          "Use minimal handler patterns",
          "Focus on clear, simple interfaces",
        ];
    }
  }

  /**
   * Generate detailed decision reasoning
   */
  private async generateDecisionReasoning(
    requirements: RequirementAnalysis,
    complexity: ComplexityEvaluation,
    processTypeRec: ProcessTypeRecommendation,
  ): Promise<DecisionExplanation> {
    const detailedReasonings = [
      {
        aspect: "Complexity Assessment",
        documentationSupport: [],
        reasoning: `Based on analysis, the system requires ${complexity.level} architecture due to factors like ${complexity.factors
          .filter((f) => f.score > 0.5)
          .map((f) => f.name.toLowerCase())
          .join(", ")}`,
      },
      {
        aspect: "Process Type Selection",
        documentationSupport: [],
        reasoning: `${processTypeRec.recommended} process type recommended because ${processTypeRec.reasoning.join(
          " and ",
        )}`,
      },
      {
        aspect: "Pattern Detection",
        documentationSupport: [],
        reasoning: `Detected patterns (${requirements.detectedPatterns.join(
          ", ",
        )}) align with documented approaches for this use case`,
      },
    ];

    return {
      alternativesConsidered: processTypeRec.alternatives,
      detailedReasonings,
      mitigations: this.suggestRiskMitigations(
        processTypeRec.recommended,
        complexity.level,
      ),
      risks: this.identifyArchitecturalRisks(
        processTypeRec.recommended,
        complexity.level,
      ),
      summary: `Recommended ${processTypeRec.recommended} architecture with ${complexity.level} complexity based on requirements analysis`,
    };
  }

  /**
   * Generate mapping reasoning
   */
  private generateMappingReasoning(
    approach: ArchitecturalApproach,
    complexity: ComplexityEvaluation,
  ): string[] {
    return [
      `Selected ${approach.name} based on ${complexity.level} complexity assessment`,
      `${approach.processType} type chosen for optimal balance of functionality and maintainability`,
      `Architecture aligns with documented patterns and best practices`,
    ];
  }

  /**
   * Generate process type reasoning
   */
  private generateProcessTypeReasoning(
    recommended: ProcessType,
    complexity: ComplexityEvaluation,
    scores: Record<ProcessType, number>,
  ): string[] {
    const reasoning = [];
    const typeInfo = this.processTypeDecisionTree[recommended];

    reasoning.push(
      `Complexity analysis indicates ${complexity.level} requirements`,
    );
    reasoning.push(
      `${recommended} architecture scored ${scores[recommended].toFixed(2)} based on pattern availability and suitability`,
    );

    // Add specific advantages
    reasoning.push(...typeInfo.advantages.slice(0, 2));

    return reasoning;
  }

  /**
   * Generate process type tradeoffs
   */
  private generateProcessTypeTradeoffs(recommended: ProcessType): {
    advantages: string[];
    disadvantages: string[];
    processType: ProcessType;
  }[] {
    return Object.entries(this.processTypeDecisionTree).map(([type, info]) => ({
      advantages: info.advantages,
      disadvantages: info.disadvantages,
      processType: type as ProcessType,
    }));
  }

  /**
   * Get alternative state management approaches
   */
  private getAlternativeStateManagement(processType: ProcessType): any[] {
    switch (processType) {
      case "multi-process":
        return ["mutable", "hybrid"];
      case "stateful":
        return ["immutable", "hybrid"];
      case "stateless":
        return ["external"];
    }
  }

  /**
   * Get state management best practices
   */
  private getStateManagementBestPractices(processType: ProcessType): string[] {
    switch (processType) {
      case "multi-process":
        return [
          "Coordinate state across processes",
          "Use consistent data formats",
          "Implement proper synchronization",
        ];
      case "stateful":
        return [
          "Initialize state properly",
          "Handle state updates atomically",
          "Validate state changes",
        ];
      case "stateless":
        return ["Avoid storing state", "Use external storage when needed"];
    }
  }

  /**
   * Get suitable use cases for architecture
   */
  private getSuitableUseCases(
    processType: ProcessType,
    patterns: string[],
  ): string[] {
    const useCases: string[] = [];

    patterns.forEach((pattern) => {
      switch (pattern) {
        case "dao-governance":
          useCases.push("Voting systems and governance protocols");
          break;
        case "handler":
          useCases.push("Message processing and request handling");
          break;
        case "message-routing":
          useCases.push("Communication and routing systems");
          break;
        case "token-contract":
          useCases.push("Token transfers and balance management");
          break;
        default:
          useCases.push("General purpose applications");
      }
    });

    return Array.from(new Set(useCases));
  }

  /**
   * Identify architectural risks
   */
  private identifyArchitecturalRisks(
    processType: ProcessType,
    complexity: ComplexityLevel,
  ): string[] {
    const risks = [];

    if (processType === "stateful" && complexity === "complex") {
      risks.push("State management complexity may lead to bugs");
      risks.push("Difficulty in testing complex state transitions");
    }

    if (processType === "multi-process") {
      risks.push("Inter-process communication failures");
      risks.push("Distributed system coordination challenges");
    }

    if (complexity === "complex") {
      risks.push("High development and maintenance overhead");
      risks.push("Potential performance bottlenecks");
    }

    return risks;
  }

  /**
   * Recommend state management approach
   */
  private recommendStateManagement(
    requirements: RequirementAnalysis,
    processType: ProcessType,
  ): any {
    if (processType === "stateless") return "none";
    if (requirements.detectedPatterns.includes("token-contract"))
      return "mutable";
    if (processType === "multi-process") return "external";
    return "mutable";
  }

  /**
   * Score process type suitability
   */
  private scoreProcessType(
    processType: ProcessType,
    complexity: ComplexityEvaluation,
    patternCount: number,
  ): number {
    let score = 0;

    // Base score from pattern availability
    score += Math.min(patternCount / 5, 0.3);

    // Complexity alignment
    switch (processType) {
      case "multi-process":
        score += complexity.level === "complex" ? 0.4 : 0.1;
        break;
      case "stateful":
        score +=
          complexity.level === "moderate"
            ? 0.4
            : complexity.level === "complex"
              ? 0.3
              : 0.1;
        break;
      case "stateless":
        score += complexity.level === "simple" ? 0.4 : 0.2;
        break;
    }

    // Additional scoring based on complexity factors
    complexity.factors.forEach((factor) => {
      if (factor.name === "Scalability Requirements" && factor.score > 0.6) {
        if (processType === "multi-process") score += 0.2;
      }
      if (factor.name === "Performance Requirements" && factor.score > 0.6) {
        if (processType === "stateless") score += 0.2;
      }
    });

    return score;
  }

  /**
   * Suggest risk mitigations
   */
  private suggestRiskMitigations(
    processType: ProcessType,
    complexity: ComplexityLevel,
  ): string[] {
    const mitigations = [];

    mitigations.push("Implement comprehensive testing strategy");
    mitigations.push("Use proper error handling and logging");

    if (processType === "stateful") {
      mitigations.push("Design clear state management patterns");
      mitigations.push("Implement state validation and recovery");
    }

    if (processType === "multi-process") {
      mitigations.push("Design robust communication protocols");
      mitigations.push("Implement proper timeout and retry logic");
    }

    return mitigations;
  }
}
