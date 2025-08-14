import {
  AOPattern,
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import { PermawebDomain } from "./PermawebDocsService.js";

/**
 * Service for analyzing user requirements and mapping them to AO documentation domains and patterns.
 *
 * This service processes natural language user requests to extract:
 * - Technical keywords relevant to AO ecosystem
 * - AO patterns (handlers, message routing, state management)
 * - Suggested documentation domains for querying
 * - Complexity assessment for template selection
 * - Process type determination for code generation
 */
export class RequirementAnalysisService {
  private readonly aoKeywords = {
    daoGovernance: [
      "dao",
      "governance",
      "vote",
      "proposal",
      "member",
      "stake",
      "delegate",
    ],
    handler: [
      "handler",
      "handlers",
      "add",
      "match",
      "function",
      "callback",
      "event",
      "listener",
    ],
    messageRouting: [
      "message",
      "routing",
      "send",
      "receive",
      "dispatch",
      "forward",
      "relay",
    ],
    processComm: [
      "process",
      "communication",
      "interact",
      "call",
      "invoke",
      "connect",
    ],
    stateManagement: [
      "state",
      "data",
      "storage",
      "persist",
      "memory",
      "variable",
      "global",
    ],
    tokenContract: [
      "token",
      "balance",
      "transfer",
      "mint",
      "burn",
      "allowance",
      "pst",
    ],
  };

  private readonly complexityIndicators = {
    complex: [
      "complex",
      "dao",
      "governance",
      "multi",
      "advanced",
      "enterprise",
      "system",
    ],
    moderate: [
      "moderate",
      "token",
      "balance",
      "transfer",
      "storage",
      "interaction",
    ],
    simple: ["simple", "basic", "hello", "ping", "echo", "test"],
  };

  private readonly domainKeywords: Record<PermawebDomain, string[]> = {
    ao: [
      "ao",
      "process",
      "message",
      "lua",
      "aos",
      "spawn",
      "scheduler",
      "autonomous",
      "handler",
    ],
    ario: [
      "ar.io",
      "gateway",
      "arns",
      "hosting",
      "deployment",
      "infrastructure",
    ],
    arweave: [
      "arweave",
      "permaweb",
      "storage",
      "transaction",
      "wallet",
      "bundling",
      "permanent",
    ],
    hyperbeam: [
      "hyperbeam",
      "device",
      "wasm",
      "erlang",
      "distributed",
      "computation",
    ],
    "permaweb-glossary": [
      "what is",
      "define",
      "definition",
      "explain",
      "glossary",
      "terminology",
    ],
    wao: [
      "wao",
      "codec",
      "hashpath",
      "ao unit",
      "distributed computing",
      "message routing",
    ],
  };

  /**
   * Analyze user requirements and extract structured information
   */
  async analyzeRequirements(userRequest: string): Promise<RequirementAnalysis> {
    const normalizedRequest = userRequest.toLowerCase().trim();

    const extractedKeywords = this.extractKeywords(normalizedRequest);
    const detectedPatterns = this.detectAOPatterns(normalizedRequest);
    const suggestedDomains = this.suggestDomains(
      normalizedRequest,
      detectedPatterns,
    );
    const complexity = this.assessComplexity(
      normalizedRequest,
      detectedPatterns,
    );
    const processType = this.determineProcessType(
      normalizedRequest,
      detectedPatterns,
    );

    return {
      complexity,
      detectedPatterns,
      extractedKeywords,
      processType,
      suggestedDomains,
      userRequest,
    };
  }

  /**
   * Assess complexity level of the request
   */
  private assessComplexity(
    request: string,
    patterns: AOPattern[],
  ): ComplexityLevel {
    let complexityScore = 0;

    // Score based on complexity indicators
    for (const [level, indicators] of Object.entries(
      this.complexityIndicators,
    )) {
      for (const indicator of indicators) {
        if (request.includes(indicator)) {
          switch (level) {
            case "complex":
              complexityScore += 3;
              break;
            case "moderate":
              complexityScore += 1;
              break;
            case "simple":
              complexityScore -= 1;
              break;
          }
        }
      }
    }

    // Increase complexity based on number of patterns
    complexityScore += patterns.length;

    // Complex patterns increase score
    if (
      patterns.includes("dao-governance") ||
      patterns.includes("token-contract")
    ) {
      complexityScore += 2;
    }

    // Multi-word technical terms increase complexity
    const technicalTermCount = (
      request.match(/[a-z]+[A-Z][a-z]+|[a-z]+-[a-z]+/g) || []
    ).length;
    complexityScore += technicalTermCount;

    // Determine final complexity level
    if (complexityScore <= 0) {
      return "simple";
    } else if (complexityScore <= 3) {
      return "moderate";
    } else {
      return "complex";
    }
  }

  /**
   * Detect AO patterns based on keywords and context
   */
  private detectAOPatterns(request: string): AOPattern[] {
    const patterns: AOPattern[] = [];

    // Handler pattern detection
    if (this.aoKeywords.handler.some((keyword) => request.includes(keyword))) {
      patterns.push("handler");
    }

    // Message routing pattern detection
    if (
      this.aoKeywords.messageRouting.some((keyword) =>
        request.includes(keyword),
      )
    ) {
      patterns.push("message-routing");
    }

    // State management pattern detection
    if (
      this.aoKeywords.stateManagement.some((keyword) =>
        request.includes(keyword),
      )
    ) {
      patterns.push("state-management");
    }

    // Process communication pattern detection
    if (
      this.aoKeywords.processComm.some((keyword) => request.includes(keyword))
    ) {
      patterns.push("process-communication");
    }

    // Token contract pattern detection
    if (
      this.aoKeywords.tokenContract.some((keyword) => request.includes(keyword))
    ) {
      patterns.push("token-contract");
    }

    // DAO governance pattern detection
    if (
      this.aoKeywords.daoGovernance.some((keyword) => request.includes(keyword))
    ) {
      patterns.push("dao-governance");
    }

    return patterns;
  }

  /**
   * Determine process type based on requirements
   */
  private determineProcessType(
    request: string,
    patterns: AOPattern[],
  ): ProcessType {
    // Multi-process indicators
    if (
      request.includes("multiple") ||
      request.includes("interact") ||
      request.includes("communicate")
    ) {
      return "multi-process";
    }

    // Stateful indicators
    if (
      patterns.includes("state-management") ||
      patterns.includes("token-contract") ||
      patterns.includes("dao-governance") ||
      request.includes("store") ||
      request.includes("remember") ||
      request.includes("persist")
    ) {
      return "stateful";
    }

    // Default to stateless for simple patterns
    return "stateless";
  }

  /**
   * Extract technical keywords from user request
   */
  private extractKeywords(request: string): string[] {
    const words = request.split(/\s+/);
    const keywords: string[] = [];

    // Extract AO-specific keywords
    for (const [category, categoryKeywords] of Object.entries(
      this.aoKeywords,
    )) {
      for (const keyword of categoryKeywords) {
        if (request.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    // Extract domain-specific keywords
    for (const domainKeywords of Object.values(this.domainKeywords)) {
      for (const keyword of domainKeywords) {
        if (request.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    // Extract technical terms from words
    const technicalTerms = words.filter(
      (word) =>
        word.length > 3 &&
        /^[a-z][a-z0-9]*$/i.test(word) &&
        ![
          "create",
          "from",
          "have",
          "make",
          "need",
          "that",
          "this",
          "want",
          "will",
          "with",
        ].includes(word),
    );

    keywords.push(...technicalTerms);

    // Remove duplicates and return unique keywords
    return Array.from(new Set(keywords));
  }

  /**
   * Suggest relevant documentation domains based on request content
   */
  private suggestDomains(
    request: string,
    patterns: AOPattern[],
  ): PermawebDomain[] {
    const domainScores = new Map<PermawebDomain, number>();

    // Initialize all domains with base score
    for (const domain of Object.keys(this.domainKeywords) as PermawebDomain[]) {
      domainScores.set(domain, 0.1);
    }

    // Score based on keyword matching
    for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
      for (const keyword of keywords) {
        if (request.includes(keyword)) {
          const currentScore = domainScores.get(domain as PermawebDomain) || 0;
          domainScores.set(domain as PermawebDomain, currentScore + 1);
        }
      }
    }

    // Boost AO domain for process-related patterns
    if (patterns.length > 0) {
      const aoScore = domainScores.get("ao") || 0;
      domainScores.set("ao", aoScore + 2);
    }

    // Add glossary for definitional queries
    if (/what is|define|definition|explain|how does|what does/.test(request)) {
      const glossaryScore = domainScores.get("permaweb-glossary") || 0;
      domainScores.set("permaweb-glossary", glossaryScore + 3);
    }

    // Sort by score and return top domains
    return Array.from(domainScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([domain]) => domain);
  }
}
