import { ComplexityLevel, ProcessType } from "../types/lua-workflow.js";
import {
  ArchitecturalApproach,
  ArchitecturePattern,
  ArchitecturePatternResult,
  ComplexityEvaluation,
  DocumentationExample,
  PatternCategorization,
  ProcessTypeAnalysis,
  StateManagementType,
  UseCaseCategory,
} from "../types/process-architecture.js";
import {
  PermawebDocs,
  PermawebDocsResult,
  PermawebDomain,
} from "./PermawebDocsService.js";
import { RequirementAnalysisService } from "./RequirementAnalysisService.js";

/**
 * Service for analyzing architectural patterns from AO documentation and categorizing them
 * for process creation recommendations.
 *
 * This service processes AO documentation to:
 * - Extract architectural patterns from documented examples
 * - Categorize patterns by complexity, process type, and use case
 * - Identify process architecture approaches from real implementations
 * - Provide foundational data for architecture decision making
 */
export class ProcessArchitectureAnalysisService {
  private readonly patternKeywords = {
    bot: ["bot", "automation", "schedule", "trigger", "response"],
    chatroom: ["chat", "room", "user", "join", "leave", "broadcast"],
    daoGovernance: ["dao", "governance", "vote", "proposal", "member", "stake"],
    game: ["game", "player", "score", "round", "turn", "board"],
    handlers: [
      "handler",
      "handlers",
      "Handlers.add",
      "function",
      "callback",
      "event",
    ],
    messaging: ["message", "msg", "send", "receive", "dispatch", "ao.send"],
    multiProcess: [
      "multi-process",
      "distributed",
      "network",
      "inter-process",
      "communication",
      "spawn",
    ],
    stateful: [
      "state",
      "stateful",
      "persistent",
      "storage",
      "memory",
      "variable",
      "data",
    ],
    stateless: [
      "stateless",
      "no state",
      "immutable",
      "pure function",
      "request-response",
    ],
    tokenContract: [
      "token",
      "balance",
      "transfer",
      "mint",
      "burn",
      "allowance",
    ],
  };

  constructor(
    private permawebDocsService: PermawebDocs,
    private requirementAnalysisService: RequirementAnalysisService,
  ) {}

  /**
   * Analyze architectural patterns from user request by querying relevant documentation
   */
  async analyzeArchitecturalPatterns(
    userRequest: string,
  ): Promise<ArchitecturePatternResult> {
    try {
      // First analyze requirements to get relevant domains
      const requirements =
        await this.requirementAnalysisService.analyzeRequirements(userRequest);

      // Query documentation from relevant domains
      const docs = await this.permawebDocsService.query(
        userRequest,
        requirements.suggestedDomains,
        50,
      );

      // Extract architectural patterns from documentation
      const patterns = await this.extractProcessArchitectures(docs);

      // Analyze process types
      const processTypes =
        await this.categorizeArchitecturalApproaches(patterns);

      return {
        documentationCoverage: this.calculateDocumentationCoverage(
          docs,
          patterns,
        ),
        patterns,
        processTypes,
        totalPatternsAnalyzed: patterns.length,
      };
    } catch (error) {
      throw new Error(
        `ProcessArchitectureAnalysisService.analyzeArchitecturalPatterns failed: ${error}`,
      );
    }
  }

  /**
   * Categorize architectural approaches by various dimensions
   */
  async categorizeArchitecturalApproaches(
    patterns: ArchitecturePattern[],
  ): Promise<ProcessTypeAnalysis> {
    try {
      const stateless = patterns.filter((p) => p.processType === "stateless");
      const stateful = patterns.filter((p) => p.processType === "stateful");
      const multiProcess = patterns.filter(
        (p) => p.processType === "multi-process",
      );

      return {
        multiProcess: {
          advantages: [
            "Distributed processing capabilities",
            "Fault tolerance and resilience",
            "Load distribution across processes",
            "Specialized process responsibilities",
          ],
          patterns: multiProcess,
          useCases: this.extractUseCases(multiProcess),
        },
        stateful: {
          advantages: [
            "Persistent data across interactions",
            "Complex business logic support",
            "User session management",
            "Data consistency guarantees",
          ],
          patterns: stateful,
          useCases: this.extractUseCases(stateful),
        },
        stateless: {
          advantages: [
            "Simple to reason about and test",
            "No state synchronization issues",
            "Highly scalable and parallel",
            "Easier deployment and rollback",
          ],
          patterns: stateless,
          useCases: this.extractUseCases(stateless),
        },
      };
    } catch (error) {
      throw new Error(
        `ProcessArchitectureAnalysisService.categorizeArchitecturalApproaches failed: ${error}`,
      );
    }
  }

  /**
   * Create pattern categorization for easy lookup
   */
  async createPatternCategorization(
    patterns: ArchitecturePattern[],
  ): Promise<PatternCategorization> {
    try {
      const byComplexity = this.groupPatternsByComplexity(patterns);
      const byProcessType = this.groupPatternsByProcessType(patterns);
      const byStateManagement = this.groupPatternsByStateManagement(patterns);
      const byUseCaseCategory = this.groupPatternsByUseCaseCategory(patterns);

      return {
        byComplexity,
        byProcessType,
        byStateManagement,
        byUseCaseCategory,
      };
    } catch (error) {
      throw new Error(
        `ProcessArchitectureAnalysisService.createPatternCategorization failed: ${error}`,
      );
    }
  }

  /**
   * Extract process architectures from documentation content
   */
  async extractProcessArchitectures(
    docs: PermawebDocsResult[],
  ): Promise<ArchitecturePattern[]> {
    try {
      const patterns: ArchitecturePattern[] = [];

      for (const doc of docs) {
        const extractedPatterns = this.extractPatternsFromDocument(doc);
        patterns.push(...extractedPatterns);
      }

      // Remove duplicates and merge similar patterns
      return this.dedupAndMergePatterns(patterns);
    } catch (error) {
      throw new Error(
        `ProcessArchitectureAnalysisService.extractProcessArchitectures failed: ${error}`,
      );
    }
  }

  /**
   * Calculate documentation coverage statistics
   */
  private calculateDocumentationCoverage(
    docs: PermawebDocsResult[],
    patterns: ArchitecturePattern[],
  ) {
    const coverageByDomain = new Map<PermawebDomain, number>();

    for (const doc of docs) {
      const patternsFromDoc = patterns.filter((p) =>
        p.examples.some((e) => e.domain === doc.domain),
      );
      coverageByDomain.set(doc.domain, patternsFromDoc.length);
    }

    return Array.from(coverageByDomain.entries()).map(([domain, count]) => ({
      domain,
      patternsFound: count,
    }));
  }

  /**
   * Calculate keyword score for content analysis
   */
  private calculateKeywordScore(content: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
      const matches = (content.match(new RegExp(keyword, "gi")) || []).length;
      score += matches;
    }
    return score;
  }

  /**
   * Categorize pattern by use case
   */
  private categorizePatternByUseCase(
    pattern: ArchitecturePattern,
  ): UseCaseCategory {
    const name = pattern.name.toLowerCase();
    const description = pattern.description.toLowerCase();

    if (name.includes("token") || description.includes("token")) {
      return "token-contracts";
    }
    if (name.includes("dao") || description.includes("governance")) {
      return "dao-governance";
    }
    if (name.includes("chat") || description.includes("room")) {
      return "chatrooms";
    }
    if (name.includes("game") || description.includes("player")) {
      return "games";
    }
    if (name.includes("bot") || description.includes("automation")) {
      return "bots";
    }
    if (name.includes("workflow") || description.includes("process")) {
      return "workflows";
    }

    return "custom";
  }

  /**
   * Remove duplicate patterns and merge similar ones
   */
  private dedupAndMergePatterns(
    patterns: ArchitecturePattern[],
  ): ArchitecturePattern[] {
    const uniquePatterns = new Map<string, ArchitecturePattern>();

    for (const pattern of patterns) {
      const key = pattern.name;
      if (uniquePatterns.has(key)) {
        const existing = uniquePatterns.get(key)!;
        existing.examples.push(...pattern.examples);
        existing.handlerPatterns = Array.from(
          new Set([...existing.handlerPatterns, ...pattern.handlerPatterns]),
        );
        existing.messageTypes = Array.from(
          new Set([...existing.messageTypes, ...pattern.messageTypes]),
        );
      } else {
        uniquePatterns.set(key, pattern);
      }
    }

    return Array.from(uniquePatterns.values());
  }

  /**
   * Detect complexity level from document content
   */
  private detectComplexity(content: string): ComplexityLevel {
    const complexityIndicators = {
      complex: [
        "complex",
        "advanced",
        "enterprise",
        "sophisticated",
        "distributed",
      ],
      moderate: ["moderate", "intermediate", "standard", "typical"],
      simple: ["simple", "basic", "easy", "minimal", "hello world"],
    };

    const simpleScore = this.calculateKeywordScore(
      content,
      complexityIndicators.simple,
    );
    const moderateScore = this.calculateKeywordScore(
      content,
      complexityIndicators.moderate,
    );
    const complexScore = this.calculateKeywordScore(
      content,
      complexityIndicators.complex,
    );

    if (complexScore > moderateScore && complexScore > simpleScore) {
      return "complex";
    } else if (moderateScore > simpleScore) {
      return "moderate";
    }
    return "simple";
  }

  /**
   * Detect process type from document content
   */
  private detectProcessType(content: string): ProcessType {
    const statelessScore = this.calculateKeywordScore(
      content,
      this.patternKeywords.stateless,
    );
    const statefulScore = this.calculateKeywordScore(
      content,
      this.patternKeywords.stateful,
    );
    const multiProcessScore = this.calculateKeywordScore(
      content,
      this.patternKeywords.multiProcess,
    );

    if (
      multiProcessScore > statelessScore &&
      multiProcessScore > statefulScore
    ) {
      return "multi-process";
    } else if (statefulScore > statelessScore) {
      return "stateful";
    }
    return "stateless";
  }

  /**
   * Detect state management type from content
   */
  private detectStateManagement(content: string): StateManagementType {
    const stateKeywords = {
      external: ["external", "database", "storage", "persistent"],
      hybrid: ["hybrid", "mixed", "combination"],
      immutable: ["immutable", "readonly", "const", "frozen"],
      mutable: ["mutable", "variable", "state", "update", "modify"],
      none: ["stateless", "no state", "pure"],
    };

    let maxScore = 0;
    let detectedType: StateManagementType = "none";

    for (const [type, keywords] of Object.entries(stateKeywords)) {
      const score = this.calculateKeywordScore(content, keywords);
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as StateManagementType;
      }
    }

    return detectedType;
  }

  /**
   * Extract handler patterns from content
   */
  private extractHandlerPatterns(content: string): string[] {
    const patterns: string[] = [];

    if (content.includes("handlers.add")) {
      patterns.push("standard-handler");
    }
    if (content.includes("match")) {
      patterns.push("pattern-matching");
    }
    if (content.includes("request") && content.includes("response")) {
      patterns.push("request-response");
    }
    if (content.includes("event")) {
      patterns.push("event-driven");
    }

    return patterns.length > 0 ? patterns : ["default"];
  }

  /**
   * Extract message types from content
   */
  private extractMessageTypes(content: string): string[] {
    const types: string[] = [];
    const messagePatterns = [
      "transfer",
      "balance",
      "info",
      "register",
      "unregister",
      "vote",
      "proposal",
      "join",
      "leave",
      "broadcast",
    ];

    for (const pattern of messagePatterns) {
      if (content.includes(pattern)) {
        types.push(pattern);
      }
    }

    return types.length > 0 ? types : ["generic"];
  }

  /**
   * Extract architectural patterns from a single document
   */
  private extractPatternsFromDocument(
    doc: PermawebDocsResult,
  ): ArchitecturePattern[] {
    const patterns: ArchitecturePattern[] = [];
    const content = doc.content.toLowerCase();

    // Detect process type based on keywords
    const processType = this.detectProcessType(content);
    const complexity = this.detectComplexity(content);
    const stateManagement = this.detectStateManagement(content);
    const handlerPatterns = this.extractHandlerPatterns(content);
    const messageTypes = this.extractMessageTypes(content);

    // Create documentation example
    const docExample: DocumentationExample = {
      domain: doc.domain,
      excerpt: this.extractRelevantExcerpt(doc.content),
      relevance: doc.relevanceScore,
      source: doc.url,
      title: this.extractTitle(doc.content),
      url: doc.url,
    };

    // Determine pattern name based on content analysis
    const patternName = this.generatePatternName(
      processType,
      complexity,
      stateManagement,
    );

    patterns.push({
      complexity,
      description: this.generatePatternDescription(
        processType,
        complexity,
        stateManagement,
      ),
      examples: [docExample],
      handlerPatterns,
      messageTypes,
      name: patternName,
      processType,
      stateManagement,
    });

    return patterns;
  }

  /**
   * Extract relevant excerpt from document content
   */
  private extractRelevantExcerpt(content: string): string {
    const lines = content.split("\n");
    const relevantLines = lines.slice(0, 3).join(" ");
    return relevantLines.length > 200
      ? relevantLines.substring(0, 197) + "..."
      : relevantLines;
  }

  /**
   * Extract title from document content
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : "Untitled Process";
  }

  /**
   * Extract use cases from patterns
   */
  private extractUseCases(patterns: ArchitecturePattern[]): string[] {
    const useCases = new Set<string>();

    for (const pattern of patterns) {
      for (const example of pattern.examples) {
        if (example.title.toLowerCase().includes("token")) {
          useCases.add("Token contracts and currency systems");
        }
        if (example.title.toLowerCase().includes("dao")) {
          useCases.add("DAO governance and voting systems");
        }
        if (example.title.toLowerCase().includes("chat")) {
          useCases.add("Chat rooms and messaging applications");
        }
        if (example.title.toLowerCase().includes("game")) {
          useCases.add("Games and interactive applications");
        }
        if (example.title.toLowerCase().includes("bot")) {
          useCases.add("Automated bots and services");
        }
      }
    }

    return Array.from(useCases);
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(
    processType: ProcessType,
    complexity: ComplexityLevel,
    stateManagement: StateManagementType,
  ): string {
    return `${complexity} ${processType} process with ${stateManagement} state management`;
  }

  /**
   * Generate pattern name based on characteristics
   */
  private generatePatternName(
    processType: ProcessType,
    complexity: ComplexityLevel,
    stateManagement: StateManagementType,
  ): string {
    return `${complexity}-${processType}-${stateManagement}`;
  }

  /**
   * Group patterns by complexity
   */
  private groupPatternsByComplexity(
    patterns: ArchitecturePattern[],
  ): Record<ComplexityLevel, ArchitecturePattern[]> {
    const groups: Record<ComplexityLevel, ArchitecturePattern[]> = {
      complex: [],
      moderate: [],
      simple: [],
    };

    for (const pattern of patterns) {
      groups[pattern.complexity].push(pattern);
    }

    return groups;
  }

  /**
   * Group patterns by process type
   */
  private groupPatternsByProcessType(
    patterns: ArchitecturePattern[],
  ): Record<ProcessType, ArchitecturePattern[]> {
    const groups: Record<ProcessType, ArchitecturePattern[]> = {
      "multi-process": [],
      stateful: [],
      stateless: [],
    };

    for (const pattern of patterns) {
      groups[pattern.processType].push(pattern);
    }

    return groups;
  }

  /**
   * Group patterns by state management type
   */
  private groupPatternsByStateManagement(
    patterns: ArchitecturePattern[],
  ): Record<StateManagementType, ArchitecturePattern[]> {
    const groups: Record<StateManagementType, ArchitecturePattern[]> = {
      external: [],
      hybrid: [],
      immutable: [],
      mutable: [],
      none: [],
    };

    for (const pattern of patterns) {
      groups[pattern.stateManagement].push(pattern);
    }

    return groups;
  }

  /**
   * Group patterns by use case category
   */
  private groupPatternsByUseCaseCategory(
    patterns: ArchitecturePattern[],
  ): Record<UseCaseCategory, ArchitecturePattern[]> {
    const groups: Record<UseCaseCategory, ArchitecturePattern[]> = {
      bots: [],
      chatrooms: [],
      custom: [],
      "dao-governance": [],
      games: [],
      "token-contracts": [],
      workflows: [],
    };

    for (const pattern of patterns) {
      const category = this.categorizePatternByUseCase(pattern);
      groups[category].push(pattern);
    }

    return groups;
  }
}
