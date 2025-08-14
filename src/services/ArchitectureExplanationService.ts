import {
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import {
  ArchitectureRecommendation,
  DocumentationExample,
  ValidationReport,
} from "../types/process-architecture.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for generating detailed architecture explanations with comprehensive
 * documentation references and citations.
 *
 * This service creates:
 * - Detailed architecture explanations with reasoning
 * - Documentation citation systems for decisions and patterns
 * - Explanation templates that reference specific documentation sources
 * - Cross-referenced explanations linking related concepts and examples
 */
export class ArchitectureExplanationService {
  private readonly explanationTemplates = {
    complexityExplanation: {
      complex:
        "Complex architecture handles sophisticated requirements with advanced patterns, suitable for enterprise-scale systems.",
      moderate:
        "Moderate architecture balances functionality with maintainability, incorporating necessary patterns without over-engineering.",
      simple:
        "Simple architecture focuses on straightforward patterns with minimal complexity, ideal for basic use cases and rapid development.",
    },
    processTypeExplanation: {
      "multi-process": {
        benefits: [
          "High availability through process isolation",
          "Specialized optimization for different functions",
          "Natural load distribution and scaling",
          "Independent deployment and updates",
        ],
        summary:
          "A multi-process architecture distributes functionality across multiple communicating processes, each with specialized responsibilities.",
        tradeoffs: [
          "Inter-process communication complexity",
          "Distributed system coordination challenges",
          "Network partition and failure handling",
          "Increased operational complexity",
        ],
        useCases: [
          "Microservices architectures",
          "Distributed computing systems",
          "Event-driven architectures",
          "Large-scale enterprise systems",
        ],
      },
      stateful: {
        benefits: [
          "Rich data modeling and relationship management",
          "Complex business logic with data persistence",
          "User session and preference management",
          "Transactional consistency guarantees",
        ],
        summary:
          "A stateful architecture maintains persistent data across message interactions, enabling complex business logic and user session management.",
        tradeoffs: [
          "Increased complexity in testing and debugging",
          "State synchronization challenges in distributed scenarios",
          "Backup and recovery complexity",
          "Potential performance bottlenecks with large state",
        ],
        useCases: [
          "Token contracts and financial systems",
          "User account and profile management",
          "Content management systems",
          "Shopping carts and order processing",
        ],
      },
      stateless: {
        benefits: [
          "Simple to reason about and test",
          "Excellent scalability through horizontal scaling",
          "No state synchronization issues",
          "Fast deployment and rollback capabilities",
        ],
        summary:
          "A stateless architecture processes each message independently without maintaining persistent state between interactions.",
        tradeoffs: [
          "Cannot maintain user sessions or persistent data",
          "Limited to computational and transformation tasks",
          "Requires external systems for data persistence",
        ],
        useCases: [
          "API gateways and request processors",
          "Data transformation services",
          "Calculation and validation services",
          "Format converters and parsers",
        ],
      },
    },
    stateManagementExplanation: {
      external:
        "State is managed by external processes or storage systems, providing scalability and shared access.",
      hybrid:
        "Combination of immutable configuration and mutable operational data for flexibility and safety.",
      immutable:
        "State is set once at initialization and never modified, providing consistency and predictability.",
      mutable:
        "State can be modified through handlers, enabling dynamic data management with proper validation.",
      none: "No persistent state - all data is processed from incoming messages and results returned immediately.",
    },
  };

  constructor(private permawebDocsService: PermawebDocs) {}

  /**
   * Create documentation citation system for architecture decisions
   */
  async createDocumentationCitationSystem(
    recommendation: ArchitectureRecommendation,
  ): Promise<{
    citationMap: Record<string, DocumentationExample[]>;
    primarySources: DocumentationExample[];
    supportingSources: DocumentationExample[];
  }> {
    try {
      const allDocs = this.consolidateDocumentationCitations(recommendation);

      // Categorize documentation by relevance
      const primarySources = allDocs.filter((doc) => doc.relevance > 0.8);
      const supportingSources = allDocs.filter(
        (doc) => doc.relevance >= 0.5 && doc.relevance <= 0.8,
      );

      // Create citation map by topic
      const citationMap = {
        handlers: this.findDocumentationByTopic(allDocs, "handler"),
        patterns: this.findDocumentationByTopic(allDocs, "pattern"),
        processType: this.findDocumentationByTopic(allDocs, "process"),
        state: this.findDocumentationByTopic(allDocs, "state"),
      };

      return {
        citationMap,
        primarySources,
        supportingSources,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureExplanationService.createDocumentationCitationSystem failed: ${error}`,
      );
    }
  }

  /**
   * Generate comprehensive architecture explanation with documentation citations
   */
  async generateArchitectureExplanation(
    recommendation: ArchitectureRecommendation,
    requirements: RequirementAnalysis,
    validationReport?: ValidationReport,
  ): Promise<{
    bestPractices: string[];
    detailedExplanation: string;
    documentationCitations: DocumentationExample[];
    implementationGuidance: string;
    overview: string;
    reasoning: {
      complexityReasoning: string;
      handlerPatternReasoning: string;
      processTypeReasoning: string;
      stateManagementReasoning: string;
    };
    relatedPatterns: string[];
  }> {
    try {
      const overview = this.generateOverview(recommendation, requirements);
      const detailedExplanation = await this.generateDetailedExplanation(
        recommendation,
        requirements,
      );
      const documentationCitations = this.consolidateDocumentationCitations(
        recommendation,
        validationReport,
      );
      const reasoning = this.generateDetailedReasoning(
        recommendation,
        requirements,
      );
      const implementationGuidance = await this.generateImplementationGuidance(
        recommendation,
        requirements,
      );
      const bestPractices = this.generateBestPractices(recommendation);
      const relatedPatterns = await this.findRelatedPatterns(recommendation);

      return {
        bestPractices,
        detailedExplanation,
        documentationCitations,
        implementationGuidance,
        overview,
        reasoning,
        relatedPatterns,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureExplanationService.generateArchitectureExplanation failed: ${error}`,
      );
    }
  }

  /**
   * Generate explanation templates with documentation references
   */
  async generateExplanationTemplates(
    processType: ProcessType,
    complexity: ComplexityLevel,
    citations: DocumentationExample[],
  ): Promise<{
    architectureTemplate: string;
    implementationTemplate: string;
    validationTemplate: string;
  }> {
    try {
      const architectureTemplate = await this.createArchitectureTemplate(
        processType,
        complexity,
        citations,
      );
      const implementationTemplate = await this.createImplementationTemplate(
        processType,
        complexity,
        citations,
      );
      const validationTemplate = await this.createValidationTemplate(
        processType,
        citations,
      );

      return {
        architectureTemplate,
        implementationTemplate,
        validationTemplate,
      };
    } catch (error) {
      throw new Error(
        `ArchitectureExplanationService.generateExplanationTemplates failed: ${error}`,
      );
    }
  }

  /**
   * Consolidate all documentation citations
   */
  private consolidateDocumentationCitations(
    recommendation: ArchitectureRecommendation,
    validationReport?: ValidationReport,
  ): DocumentationExample[] {
    const citations = [...recommendation.documentationSupport];

    // Add handler documentation
    recommendation.handlerRecommendations.forEach((handler) => {
      citations.push(...handler.documentation);
    });

    // Add state management documentation
    citations.push(...recommendation.stateManagementGuidance.documentation);

    // Add error handling documentation
    recommendation.errorHandlingPatterns.forEach((pattern) => {
      citations.push(...pattern.documentation);
    });

    // Add validation report documentation
    if (validationReport) {
      citations.push(...validationReport.documentation);
    }

    // Remove duplicates and sort by relevance
    const uniqueCitations = citations
      .filter(
        (citation, index, array) =>
          index === array.findIndex((c) => c.source === citation.source),
      )
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return uniqueCitations.slice(0, 15); // Limit to top 15 citations
  }

  /**
   * Template generation methods
   */
  private async createArchitectureTemplate(
    processType: ProcessType,
    complexity: ComplexityLevel,
    citations: DocumentationExample[],
  ): Promise<string> {
    const template =
      this.explanationTemplates.processTypeExplanation[processType];
    const citationText = citations
      .slice(0, 3)
      .map((c) => `[${c.title}](${c.source})`)
      .join(", ");

    return `## ${processType} Architecture\n\n${template.summary}\n\n**Referenced Examples:** ${citationText}`;
  }

  private async createImplementationTemplate(
    processType: ProcessType,
    complexity: ComplexityLevel,
    citations: DocumentationExample[],
  ): Promise<string> {
    return (
      `## Implementation Template for ${processType} Process\n\n` +
      `Follow the ${complexity} complexity patterns documented in the referenced examples.\n\n` +
      `**Documentation References:** ${citations.map((c) => c.title).join(", ")}`
    );
  }

  private async createValidationTemplate(
    processType: ProcessType,
    citations: DocumentationExample[],
  ): Promise<string> {
    return (
      `## Validation Checklist for ${processType} Architecture\n\n` +
      `- [ ] Input validation implemented\n` +
      `- [ ] Error handling patterns applied\n` +
      `- [ ] State management appropriate for process type\n` +
      `- [ ] Documentation standards followed\n\n` +
      `**Reference Examples:** ${citations
        .slice(0, 2)
        .map((c) => c.title)
        .join(", ")}`
    );
  }

  /**
   * Find documentation by topic
   */
  private findDocumentationByTopic(
    docs: DocumentationExample[],
    topic: string,
  ): DocumentationExample[] {
    return docs
      .filter(
        (doc) =>
          doc.title.toLowerCase().includes(topic) ||
          doc.excerpt.toLowerCase().includes(topic),
      )
      .slice(0, 5);
  }

  /**
   * Find related patterns from AO documentation
   */
  private async findRelatedPatterns(
    recommendation: ArchitectureRecommendation,
  ): Promise<string[]> {
    // This would typically query documentation for related patterns
    // For now, return common related patterns based on the architecture
    const patterns = [];

    const processType = recommendation.recommendedApproach.processType;
    const stateType = recommendation.stateManagementGuidance.recommended;

    patterns.push(`${processType}-process-patterns`);
    patterns.push(`${stateType}-state-management`);

    if (recommendation.handlerRecommendations.length > 0) {
      patterns.push("handler-composition-patterns");
    }

    if (recommendation.errorHandlingPatterns.length > 0) {
      patterns.push("error-handling-patterns");
    }

    return patterns.slice(0, 5); // Limit to 5 related patterns
  }

  /**
   * Generate best practices list
   */
  private generateBestPractices(
    recommendation: ArchitectureRecommendation,
  ): string[] {
    const practices = [
      "Follow AO ecosystem conventions for handler naming",
      "Implement comprehensive input validation for all handlers",
      "Use consistent error handling patterns throughout the process",
      "Document all public handlers and their expected inputs/outputs",
    ];

    // Add process-type specific practices
    const processType = recommendation.recommendedApproach.processType;
    switch (processType) {
      case "multi-process":
        practices.push("Design robust inter-process communication");
        practices.push("Implement proper timeout and retry mechanisms");
        break;
      case "stateful":
        practices.push(
          "Validate state consistency before and after operations",
        );
        practices.push("Implement proper state initialization and migration");
        break;
      case "stateless":
        practices.push("Keep handlers pure and avoid side effects");
        practices.push("Minimize external dependencies and IO operations");
        break;
    }

    // Add complexity-specific practices
    const complexity = recommendation.recommendedApproach.complexity;
    if (complexity === "complex") {
      practices.push("Implement comprehensive logging and monitoring");
      practices.push("Design for graceful degradation and error recovery");
    }

    return practices;
  }

  /**
   * Generate complexity reasoning
   */
  private generateComplexityReasoning(
    complexity: ComplexityLevel,
    requirements: RequirementAnalysis,
  ): string {
    const patterns = requirements.detectedPatterns;
    const patternCount = patterns.length;

    switch (complexity) {
      case "complex":
        return `Complex architecture warranted by sophisticated requirements involving ${patterns.join(", ")} with advanced scalability and reliability needs.`;
      case "moderate":
        return `Moderate complexity selected to handle ${patternCount} detected patterns while maintaining reasonable implementation and maintenance overhead.`;
      case "simple":
        return `Simple complexity appropriate for straightforward ${patterns.join(" and ")} patterns with minimal interdependencies.`;
      default:
        return "Complexity level determined by requirements analysis and pattern detection.";
    }
  }

  /**
   * Generate detailed explanation
   */
  private async generateDetailedExplanation(
    recommendation: ArchitectureRecommendation,
    requirements: RequirementAnalysis,
  ): Promise<string> {
    const approach = recommendation.recommendedApproach;
    const processTypeInfo =
      this.explanationTemplates.processTypeExplanation[approach.processType];
    const stateInfo =
      this.explanationTemplates.stateManagementExplanation[
        recommendation.stateManagementGuidance.recommended
      ];
    const complexityInfo =
      this.explanationTemplates.complexityExplanation[approach.complexity];

    let explanation = `## Architecture Overview\n\n`;
    explanation += `${processTypeInfo.summary}\n\n`;
    explanation += `### Process Type: ${approach.processType}\n\n`;
    explanation += `**Benefits:**\n`;
    processTypeInfo.benefits.forEach((benefit) => {
      explanation += `- ${benefit}\n`;
    });
    explanation += `\n**Trade-offs:**\n`;
    processTypeInfo.tradeoffs.forEach((tradeoff) => {
      explanation += `- ${tradeoff}\n`;
    });

    explanation += `\n### State Management: ${recommendation.stateManagementGuidance.recommended}\n\n`;
    explanation += `${stateInfo}\n\n`;

    explanation += `### Complexity Level: ${approach.complexity}\n\n`;
    explanation += `${complexityInfo}\n\n`;

    explanation += `### Handler Patterns\n\n`;
    recommendation.handlerRecommendations.forEach((handler) => {
      explanation += `- **${handler.name}**: ${handler.purpose}\n`;
    });

    return explanation;
  }

  /**
   * Generate detailed reasoning for each architectural decision
   */
  private generateDetailedReasoning(
    recommendation: ArchitectureRecommendation,
    requirements: RequirementAnalysis,
  ) {
    return {
      complexityReasoning: this.generateComplexityReasoning(
        recommendation.recommendedApproach.complexity,
        requirements,
      ),
      handlerPatternReasoning: this.generateHandlerPatternReasoning(
        recommendation.handlerRecommendations,
        requirements,
      ),
      processTypeReasoning: this.generateProcessTypeReasoning(
        recommendation.recommendedApproach.processType,
        requirements,
      ),
      stateManagementReasoning: this.generateStateManagementReasoning(
        recommendation.stateManagementGuidance.recommended,
        requirements,
      ),
    };
  }

  /**
   * Generate handler pattern reasoning
   */
  private generateHandlerPatternReasoning(
    handlers: any[],
    requirements: RequirementAnalysis,
  ): string {
    const handlerTypes = handlers.map((h) => h.name).join(", ");
    const patterns = requirements.detectedPatterns;

    if (patterns.includes("token-contract")) {
      return `Handler patterns (${handlerTypes}) selected to implement token contract operations with proper validation and state management.`;
    }
    if (patterns.includes("dao-governance")) {
      return `Handler structure (${handlerTypes}) designed for governance operations including voting, proposal management, and member coordination.`;
    }

    return `Handler patterns (${handlerTypes}) chosen to support the required message processing patterns with appropriate complexity.`;
  }

  /**
   * Generate implementation guidance
   */
  private async generateImplementationGuidance(
    recommendation: ArchitectureRecommendation,
    requirements: RequirementAnalysis,
  ): Promise<string> {
    const approach = recommendation.recommendedApproach;

    let guidance = `## Implementation Guidance\n\n`;

    // Process-specific guidance
    guidance += `### ${approach.processType} Implementation\n\n`;
    guidance += this.getProcessTypeImplementationGuidance(approach.processType);

    // State management guidance
    guidance += `\n### State Management Implementation\n\n`;
    guidance += this.getStateManagementImplementationGuidance(
      recommendation.stateManagementGuidance.recommended,
    );

    // Handler implementation
    guidance += `\n### Handler Implementation\n\n`;
    recommendation.handlerRecommendations.slice(0, 3).forEach((handler) => {
      guidance += `**${handler.name}**:\n`;
      guidance += `\`\`\`lua\n${handler.template}\n\`\`\`\n\n`;
    });

    // Error handling guidance
    guidance += `\n### Error Handling\n\n`;
    recommendation.errorHandlingPatterns.slice(0, 2).forEach((pattern) => {
      guidance += `**${pattern.name}**: ${pattern.description}\n`;
    });

    return guidance;
  }

  /**
   * Generate overview of the architecture recommendation
   */
  private generateOverview(
    recommendation: ArchitectureRecommendation,
    requirements: RequirementAnalysis,
  ): string {
    const approach = recommendation.recommendedApproach;
    const patterns = requirements.detectedPatterns.join(", ");

    return `This ${approach.complexity} ${approach.processType} architecture is recommended for your "${requirements.userRequest}" based on analysis of detected patterns (${patterns}) and AO ecosystem best practices. The architecture provides ${approach.description.toLowerCase()} with confidence score of ${(recommendation.confidence * 100).toFixed(0)}%.`;
  }

  /**
   * Generate process type specific reasoning
   */
  private generateProcessTypeReasoning(
    processType: ProcessType,
    requirements: RequirementAnalysis,
  ): string {
    const patterns = requirements.detectedPatterns;
    const complexity = requirements.complexity;

    switch (processType) {
      case "multi-process":
        return `Multi-process architecture recommended for ${patterns.includes("process-communication") ? "distributed processing needs" : "scalability requirements"} with ${complexity} complexity demanding specialized process roles.`;
      case "stateful":
        return `Stateful architecture chosen due to ${patterns.includes("token-contract") ? "token balance management" : patterns.includes("dao-governance") ? "governance state tracking" : "persistent data requirements"} identified in the requirements.`;
      case "stateless":
        return `Stateless architecture selected because the requirements indicate ${patterns.includes("handler") ? "simple message processing" : "computational tasks"} without persistent data needs. This aligns with ${complexity} complexity requirements.`;
      default:
        return "Process type selected based on requirements analysis and AO best practices.";
    }
  }

  /**
   * Generate state management reasoning
   */
  private generateStateManagementReasoning(
    stateType: any,
    requirements: RequirementAnalysis,
  ): string {
    const patterns = requirements.detectedPatterns;

    switch (stateType) {
      case "external":
        return "External state management recommended for distributed architecture requiring shared state access across processes.";
      case "hybrid":
        return `Hybrid state management chosen to balance ${patterns.includes("dao-governance") ? "immutable governance rules with mutable voting data" : "configuration stability with operational flexibility"}.`;
      case "mutable":
        return `Mutable state selected to handle ${patterns.includes("token-contract") ? "token balance updates" : "dynamic data changes"} required by the application logic.`;
      case "none":
        return "No state management needed as the process handles stateless operations without persistent data.";
      default:
        return "State management approach selected based on data persistence requirements and architectural patterns.";
    }
  }

  /**
   * Helper methods for implementation guidance
   */
  private getProcessTypeImplementationGuidance(
    processType: ProcessType,
  ): string {
    switch (processType) {
      case "multi-process":
        return "Design clear communication protocols between processes. Implement proper message routing and response handling.";
      case "stateful":
        return "Initialize state properly at process startup. Implement atomic state updates with proper validation and error handling.";
      case "stateless":
        return "Implement handlers as pure functions without global state. Focus on input validation and immediate response patterns.";
      default:
        return "Follow AO process implementation best practices.";
    }
  }

  private getStateManagementImplementationGuidance(stateType: any): string {
    switch (stateType) {
      case "external":
        return "Implement proper communication with external state services. Handle timeouts and failures gracefully.";
      case "hybrid":
        return "Separate immutable configuration from mutable operational data. Use clear naming conventions.";
      case "mutable":
        return "Initialize state tables properly. Validate state changes and implement atomic updates.";
      case "none":
        return "No state variables needed. Process all data from incoming messages.";
      default:
        return "Follow state management best practices for your chosen approach.";
    }
  }
}
