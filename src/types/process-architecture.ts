import { PermawebDomain } from "../services/PermawebDocsService.js";
import { ComplexityLevel, ProcessType } from "./lua-workflow.js";

/**
 * Architectural approach recommendation
 */
export interface ArchitecturalApproach {
  complexity: ComplexityLevel;
  description: string;
  documentation: DocumentationExample[];
  name: string;
  processType: ProcessType;
  suitableFor: string[];
}

/**
 * Architecture mapping result
 */
export interface ArchitectureMapping {
  alternatives: ArchitecturalApproach[];
  documentation: DocumentationExample[];
  mappingConfidence: number;
  primary: ArchitecturalApproach;
  reasoning: string[];
}

/**
 * Represents an architectural pattern identified from AO documentation
 */
export interface ArchitecturePattern {
  complexity: ComplexityLevel;
  description: string;
  examples: DocumentationExample[];
  handlerPatterns: string[];
  messageTypes: string[];
  name: string;
  processType: ProcessType;
  stateManagement: StateManagementType;
}

/**
 * Result of architectural pattern analysis from documentation
 */
export interface ArchitecturePatternResult {
  documentationCoverage: {
    domain: PermawebDomain;
    patternsFound: number;
  }[];
  patterns: ArchitecturePattern[];
  processTypes: ProcessTypeAnalysis;
  totalPatternsAnalyzed: number;
}

/**
 * Architecture recommendation result
 */
export interface ArchitectureRecommendation {
  alternativeApproaches: ArchitecturalApproach[];
  confidence: number;
  documentationSupport: DocumentationExample[];
  errorHandlingPatterns: ErrorHandlingPattern[];
  handlerRecommendations: HandlerRecommendation[];
  reasoning: string[];
  recommendedApproach: ArchitecturalApproach;
  stateManagementGuidance: StateManagementGuidance;
}

/**
 * Architecture scoring result
 */
export interface ArchitectureScore {
  breakdown: {
    bestPracticeAlignment: number;
    complexity: number;
    documentationSupport: number;
    patternMatch: number;
  };
  overall: number;
  reasoning: string[];
}

/**
 * Best practice validation result
 */
export interface BestPracticeValidation {
  errors: {
    documentation: DocumentationExample[];
    fix: string;
    practice: string;
    violation: string;
  }[];
  passed: {
    description: string;
    documentation: DocumentationExample[];
    practice: string;
  }[];
  warnings: {
    documentation: DocumentationExample[];
    issue: string;
    practice: string;
    suggestion: string;
  }[];
}

/**
 * Complexity assessment for architecture decisions
 */
export interface ComplexityAssessment {
  factors: {
    dataComplexity: number;
    interactionComplexity: number;
    performanceRequirements: number;
    scalabilityRequirements: number;
  };
  level: ComplexityLevel;
  reasoning: string[];
  recommendations: string[];
}

/**
 * Architecture complexity evaluation
 */
export interface ComplexityEvaluation {
  factors: {
    description: string;
    name: string;
    score: number;
    weight: number;
  }[];
  level: ComplexityLevel;
  recommendations: string[];
  score: number;
}

/**
 * Decision explanation for architecture choices
 */
export interface DecisionExplanation {
  alternativesConsidered: string[];
  detailedReasonings: {
    aspect: string;
    documentationSupport: string[];
    reasoning: string;
  }[];
  mitigations: string[];
  risks: string[];
  summary: string;
}

/**
 * Documentation example with metadata
 */
export interface DocumentationExample {
  domain: PermawebDomain;
  excerpt: string;
  relevance: number;
  source: string;
  title: string;
  url?: string;
}

/**
 * Error handling pattern
 */
export interface ErrorHandlingPattern {
  complexity: ComplexityLevel;
  description: string;
  documentation: DocumentationExample[];
  implementation: string;
  name: string;
  pattern: string;
  useCases: string[];
}

/**
 * Handler pattern template
 */
export interface HandlerPatternTemplate {
  complexity: ComplexityLevel;
  description: string;
  documentation: DocumentationExample[];
  name: string;
  template: string;
  useCases: string[];
}

/**
 * Individual handler recommendation
 */
export interface HandlerRecommendation {
  complexity: ComplexityLevel;
  documentation: DocumentationExample[];
  messageTypes: string[];
  name: string;
  purpose: string;
  template: string;
}

/**
 * Handler structure recommendation
 */
export interface HandlerStructureRecommendation {
  messageFlow: {
    inbound: string[];
    internal: string[];
    outbound: string[];
  };
  patterns: HandlerPatternTemplate[];
  structure: {
    primary: HandlerRecommendation[];
    secondary: HandlerRecommendation[];
    utility: HandlerRecommendation[];
  };
}

/**
 * Message pattern analysis from documentation
 */
export interface MessagePatternAnalysis {
  commonPatterns: {
    examples: DocumentationExample[];
    frequency: number;
    pattern: string;
    useCases: string[];
  }[];
  messageTypes: {
    description: string;
    documentation: DocumentationExample[];
    handlerPattern: string;
    type: string;
  }[];
  routingStrategies: {
    complexity: ComplexityLevel;
    description: string;
    examples: DocumentationExample[];
    strategy: string;
  }[];
}

/**
 * Categorization of architecture patterns
 */
export interface PatternCategorization {
  byComplexity: Record<ComplexityLevel, ArchitecturePattern[]>;
  byProcessType: Record<ProcessType, ArchitecturePattern[]>;
  byStateManagement: Record<StateManagementType, ArchitecturePattern[]>;
  byUseCaseCategory: Record<UseCaseCategory, ArchitecturePattern[]>;
}

/**
 * Analysis of process types found in documentation
 */
export interface ProcessTypeAnalysis {
  multiProcess: {
    advantages: string[];
    patterns: ArchitecturePattern[];
    useCases: string[];
  };
  stateful: {
    advantages: string[];
    patterns: ArchitecturePattern[];
    useCases: string[];
  };
  stateless: {
    advantages: string[];
    patterns: ArchitecturePattern[];
    useCases: string[];
  };
}

/**
 * Process type recommendation
 */
export interface ProcessTypeRecommendation {
  alternatives: ProcessType[];
  documentationEvidence: DocumentationExample[];
  reasoning: string[];
  recommended: ProcessType;
  tradeoffs: {
    advantages: string[];
    disadvantages: string[];
    processType: ProcessType;
  }[];
}

/**
 * Similar pattern matching result
 */
export interface SimilarPatternResult {
  averageSimilarity: number;
  matches: {
    documentation: DocumentationExample[];
    pattern: ArchitecturePattern;
    similarity: number;
  }[];
  totalMatches: number;
}

/**
 * State management guidance
 */
export interface StateManagementGuidance {
  alternatives: StateManagementType[];
  bestPractices: string[];
  documentation: DocumentationExample[];
  patterns: {
    description: string;
    examples: DocumentationExample[];
    implementation: string;
    type: StateManagementType;
  }[];
  recommended: StateManagementType;
}

/**
 * State management type enum
 */
export type StateManagementType =
  | "external"
  | "hybrid"
  | "immutable"
  | "mutable"
  | "none";

/**
 * Use case category enum
 */
export type UseCaseCategory =
  | "bots"
  | "chatrooms"
  | "custom"
  | "dao-governance"
  | "games"
  | "token-contracts"
  | "workflows";

/**
 * Architecture validation report
 */
export interface ValidationReport {
  documentation: DocumentationExample[];
  recommendations: string[];
  score: ArchitectureScore;
  summary: string;
  validation: BestPracticeValidation;
}
