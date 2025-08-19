import {
  PermawebDocsResult,
  PermawebDomain,
} from "../services/PermawebDocsService.js";

/**
 * Represents AO-specific patterns that can be detected in user requirements
 */
export type AOPattern =
  | "calculator"
  | "computation"
  | "counter"
  | "dao-governance"
  | "database"
  | "handler"
  | "message-routing"
  | "process-communication"
  | "state-management"
  | "token-contract";

/**
 * Code explanation with source citations
 */
export interface CodeExplanation {
  bestPractices: string[];
  codeBreakdown: {
    documentationReference?: string;
    explanation: string;
    section: string;
  }[];
  overview: string;
  relatedSources: string[];
}

/**
 * Represents the complexity level of a user request
 */
export type ComplexityLevel = "complex" | "moderate" | "simple";

/**
 * Requirements combined with relevant documentation
 */
export interface DocumentedRequirements {
  analysis: RequirementAnalysis;
  confidence: number;
  relevantDocs: PermawebDocsResult[];
}

/**
 * Represents a specific handler pattern template
 */
export interface HandlerPattern {
  description: string;
  name: string;
  template: string;
  usedPatterns: AOPattern[];
}

/**
 * Result of Lua code generation with metadata and sources
 */
export interface LuaCodeResult {
  bestPractices: string[];
  documentationSources: string[];
  explanation: string;
  generatedCode: string;
  handlerPatterns: HandlerPattern[];
  usedTemplates: string[];
}

/**
 * Main workflow orchestration interface
 */
export interface LuaWorkflowOrchestration {
  analyzeRequirements(userRequest: string): Promise<RequirementAnalysis>;
  explainCode(
    code: LuaCodeResult,
    sources: PermawebDocsResult[],
  ): Promise<CodeExplanation>;
  generateLuaCode(
    docs: PermawebDocsResult[],
    requirements: RequirementAnalysis,
  ): Promise<LuaCodeResult>;
  queryRelevantDocs(
    analysis: RequirementAnalysis,
  ): Promise<PermawebDocsResult[]>;
}

/**
 * Complete workflow result combining all components
 */
export interface LuaWorkflowResult {
  codeResult: LuaCodeResult;
  explanation: CodeExplanation;
  requirements: DocumentedRequirements;
  timestamp: Date;
}

/**
 * Complete architecture analysis result combining all analysis components
 */
export interface ProcessArchitectureAnalysisResult {
  architectureRecommendation: Record<string, unknown>; // ArchitectureRecommendation from process-architecture types
  explanation?: Record<string, unknown>; // Architecture explanation from ArchitectureExplanationService
  requirements: RequirementAnalysis;
  timestamp: Date;
  validationReport?: Record<string, unknown>; // ValidationReport from process-architecture types
}

/**
 * Represents the type of process being created
 */
export type ProcessType = "multi-process" | "stateful" | "stateless";

/**
 * Analysis of user requirements for Lua code generation
 */
export interface RequirementAnalysis {
  complexity: ComplexityLevel;
  detectedPatterns: AOPattern[];
  extractedKeywords: string[];
  processType: ProcessType;
  suggestedDomains: PermawebDomain[];
  userRequest: string;
}
