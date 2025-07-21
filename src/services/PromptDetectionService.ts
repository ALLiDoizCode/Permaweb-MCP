export interface AgentDetectionRequest {
  projectContext?: string;
  prompt: string;
  userId?: string;
}

export interface AgentDetectionResult {
  confidence: number;
  detectedAgents: DetectedAgent[];
  fallbackSuggestions?: string[];
  multipleAgentsDetected: boolean;
  projectContext?: string;
}

export type AgentType =
  | "analyst"
  | "architect"
  | "bmad-master"
  | "dev"
  | "devops"
  | "pm"
  | "qa"
  | "sm"
  | "ux";

export interface DetectedAgent {
  agentType: AgentType;
  confidence: number;
  context: string;
  matchedPattern: string;
}

interface AgentPattern {
  agentType: AgentType;
  aliases: string[];
  keywords: string[];
  patterns: string[];
  weight: number;
}

interface PatternMatch {
  agentType: AgentType;
  context: string;
  matchType: "alias" | "direct" | "keyword";
  pattern: string;
  patternStrength: number;
  weight: number;
}

const AGENT_PATTERNS: AgentPattern[] = [
  {
    agentType: "analyst",
    aliases: ["business analyst", "requirements analyst", "ba"],
    keywords: [
      "analyze",
      "requirements",
      "process",
      "stakeholder",
      "business",
      "model",
      "gap",
    ],
    patterns: ["@analyst", "@ba"],
    weight: 1.0,
  },
  {
    agentType: "architect",
    aliases: ["system architect", "software architect", "technical architect"],
    keywords: [
      "architecture",
      "system",
      "design",
      "structure",
      "patterns",
      "scalability",
      "technical",
    ],
    patterns: ["@architect", "@arch"],
    weight: 1.0,
  },
  {
    agentType: "bmad-master",
    aliases: [
      "bmad master",
      "methodology master",
      "coordinator",
      "orchestrator",
    ],
    keywords: [
      "bmad",
      "methodology",
      "coordinate",
      "orchestrate",
      "workflow",
      "guidance",
      "master",
    ],
    patterns: ["@bmad-master", "@bmad", "@master"],
    weight: 1.0,
  },
  {
    agentType: "dev",
    aliases: ["programmer", "engineer", "coder", "developer"],
    keywords: [
      "develop",
      "code",
      "implement",
      "build",
      "program",
      "debug",
      "fix",
      "feature",
    ],
    patterns: ["@dev", "@developer"],
    weight: 1.0,
  },
  {
    agentType: "devops",
    aliases: ["operations", "deployment engineer", "site reliability"],
    keywords: [
      "deploy",
      "infrastructure",
      "pipeline",
      "ci/cd",
      "monitoring",
      "cloud",
    ],
    patterns: ["@devops", "@ops"],
    weight: 1.0,
  },
  {
    agentType: "pm",
    aliases: ["project manager", "product manager", "lead", "coordinator"],
    keywords: [
      "manage",
      "plan",
      "coordinate",
      "requirements",
      "project",
      "schedule",
      "timeline",
    ],
    patterns: ["@pm", "@manager"],
    weight: 1.0,
  },
  {
    agentType: "qa",
    aliases: ["tester", "quality assurance", "reviewer"],
    keywords: [
      "test",
      "quality",
      "validate",
      "verify",
      "check",
      "review",
      "bug",
    ],
    patterns: ["@qa", "@tester"],
    weight: 1.0,
  },
  {
    agentType: "sm",
    aliases: ["scrum master", "agile coach", "facilitator"],
    keywords: [
      "scrum",
      "agile",
      "facilitate",
      "coach",
      "sprint",
      "ceremony",
      "impediment",
    ],
    patterns: ["@sm", "@scrum"],
    weight: 1.0,
  },
  {
    agentType: "ux",
    aliases: ["designer", "ui designer", "ux designer", "user experience"],
    keywords: [
      "design",
      "user",
      "interface",
      "experience",
      "ui",
      "mockup",
      "wireframe",
    ],
    patterns: ["@ux", "@design"],
    weight: 1.0,
  },
];

export class PromptDetectionService {
  private agentPatterns: AgentPattern[] = AGENT_PATTERNS;

  /**
   * Calculate confidence score for pattern matches
   */
  calculateConfidence(matches: PatternMatch[]): number {
    try {
      if (matches.length === 0) {
        return 0;
      }

      const baseScore =
        matches.reduce((score, match) => {
          return score + match.weight * match.patternStrength;
        }, 0) / matches.length;

      const contextBonus = this.hasProjectContext(matches) ? 0.1 : 0;
      const multipleAgentsPenalty = matches.length > 1 ? 0.15 : 0;

      const finalScore = baseScore + contextBonus - multipleAgentsPenalty;
      return Math.min(1.0, Math.max(0, finalScore));
    } catch (error) {
      throw new Error(
        `PromptDetectionService.calculateConfidence failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Detect agents from a user prompt
   */
  detectAgents(prompt: string): AgentDetectionResult {
    try {
      const normalizedPrompt = prompt.toLowerCase().trim();
      const matches = this.findPatternMatches(normalizedPrompt);
      const detectedAgents = this.convertMatchesToAgents(matches);
      const projectContext = this.extractProjectContext(prompt) || undefined;
      const confidence = this.calculateConfidence(matches);
      const fallbackSuggestions =
        matches.length === 0
          ? this.suggestFallbacks(normalizedPrompt)
          : undefined;

      return {
        confidence,
        detectedAgents,
        fallbackSuggestions,
        multipleAgentsDetected: detectedAgents.length > 1,
        projectContext,
      };
    } catch (error) {
      throw new Error(
        `PromptDetectionService.detectAgents failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Extract project context from prompt
   */
  extractProjectContext(prompt: string): null | string {
    try {
      // Match @agent ProjectName patterns (ProjectName should be capitalized or contain numbers/underscores)
      const agentProjectMatch = prompt.match(
        /@\w+\s+([A-Z][A-Za-z0-9_-]*|[A-Za-z0-9]*[0-9_-][A-Za-z0-9_-]*)/,
      );
      if (agentProjectMatch) {
        return agentProjectMatch[1];
      }

      // Match "for ProjectName" patterns (ProjectName should be capitalized or contain numbers/underscores)
      const forProjectMatch = prompt.match(
        /for\s+([A-Z][A-Za-z0-9_-]*|[A-Za-z0-9]*[0-9_-][A-Za-z0-9_-]*)/i,
      );
      if (forProjectMatch) {
        return forProjectMatch[1];
      }

      // Match "ProjectName:" patterns (ProjectName should be capitalized or contain numbers/underscores)
      const colonProjectMatch = prompt.match(
        /([A-Z][A-Za-z0-9_-]*|[A-Za-z0-9]*[0-9_-][A-Za-z0-9_-]*):/,
      );
      if (colonProjectMatch) {
        return colonProjectMatch[1];
      }

      return null;
    } catch (error) {
      throw new Error(
        `PromptDetectionService.extractProjectContext failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Suggest fallback agents for unclear prompts
   */
  suggestFallbacks(prompt: string): string[] {
    try {
      const suggestions: string[] = [];

      // Analysis and requirements terms
      if (/analyze|requirements|business|stakeholder/.test(prompt)) {
        suggestions.push("analyst");
      }

      // Architecture terms
      if (/architecture|system|technical|scalability/.test(prompt)) {
        suggestions.push("architect");
      }

      // BMAD methodology terms
      if (/bmad|methodology|workflow|coordinate/.test(prompt)) {
        suggestions.push("bmad-master");
      }

      // Generic development terms
      if (/code|develop|implement|build|program/.test(prompt)) {
        suggestions.push("dev");
      }

      // Operations and deployment terms
      if (/deploy|infrastructure|pipeline|monitoring/.test(prompt)) {
        suggestions.push("devops");
      }

      // Project management terms
      if (/plan|manage|coordinate|schedule/.test(prompt)) {
        suggestions.push("pm");
      }

      // Testing terms
      if (/test|quality|verify|check/.test(prompt)) {
        suggestions.push("qa");
      }

      // Agile and scrum terms
      if (/scrum|agile|facilitate|sprint/.test(prompt)) {
        suggestions.push("sm");
      }

      // Design terms
      if (/design|ui|ux|interface/.test(prompt)) {
        suggestions.push("ux");
      }

      return suggestions.length > 0 ? suggestions : ["dev", "pm"];
    } catch (error) {
      throw new Error(
        `PromptDetectionService.suggestFallbacks failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate agent type
   */
  validateAgentType(agentType: string): boolean {
    const validTypes: AgentType[] = [
      "analyst",
      "architect",
      "bmad-master",
      "dev",
      "devops",
      "pm",
      "qa",
      "sm",
      "ux",
    ];
    return validTypes.includes(agentType as AgentType);
  }

  private convertMatchesToAgents(matches: PatternMatch[]): DetectedAgent[] {
    const agentMap = new Map<AgentType, DetectedAgent>();

    for (const match of matches) {
      const existing = agentMap.get(match.agentType);
      if (existing) {
        // Update confidence if this match is stronger
        if (match.patternStrength > existing.confidence) {
          existing.confidence = match.patternStrength;
          existing.matchedPattern = match.pattern;
          existing.context = match.context;
        }
      } else {
        agentMap.set(match.agentType, {
          agentType: match.agentType,
          confidence: match.patternStrength,
          context: match.context,
          matchedPattern: match.pattern,
        });
      }
    }

    return Array.from(agentMap.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const agentMap = new Map<AgentType, PatternMatch>();

    // Sort by pattern strength to keep the strongest matches
    matches.sort((a, b) => b.patternStrength - a.patternStrength);

    // Check if we have any direct pattern matches
    const hasDirectPatterns = matches.some(
      (match) => match.matchType === "direct",
    );

    for (const match of matches) {
      // If we have direct patterns, only skip lower-priority matches for the same agent type
      if (
        hasDirectPatterns &&
        (match.matchType === "keyword" || match.matchType === "alias")
      ) {
        const hasDirectMatchForSameAgent = matches.some(
          (m) => m.agentType === match.agentType && m.matchType === "direct",
        );
        if (hasDirectMatchForSameAgent) {
          // Skip this lower-priority match since we have a direct match for the same agent
          continue;
        }
      }

      const existing = agentMap.get(match.agentType);
      if (!existing || match.patternStrength > existing.patternStrength) {
        agentMap.set(match.agentType, match);
      }
    }

    return Array.from(agentMap.values());
  }

  private extractMatchContext(prompt: string, pattern: string): string {
    const index = prompt.toLowerCase().indexOf(pattern.toLowerCase());
    if (index === -1) return "";

    const start = Math.max(0, index - 20);
    const end = Math.min(prompt.length, index + pattern.length + 20);

    return prompt.substring(start, end).trim();
  }

  private findPatternMatches(prompt: string): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const agentPattern of this.agentPatterns) {
      // Check direct patterns (@dev, @pm, etc.) with proper boundaries
      for (const pattern of agentPattern.patterns) {
        // For @patterns, match the @ followed by word boundary
        const regex = new RegExp(
          `${pattern.toLowerCase().replace("@", "\\@")}\\b`,
        );
        if (regex.test(prompt)) {
          matches.push({
            agentType: agentPattern.agentType,
            context: this.extractMatchContext(prompt, pattern),
            matchType: "direct",
            pattern,
            patternStrength: 1.0, // Direct pattern match has highest strength
            weight: agentPattern.weight,
          });
        }
      }

      // Check keywords with word boundaries
      for (const keyword of agentPattern.keywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
        if (regex.test(prompt)) {
          matches.push({
            agentType: agentPattern.agentType,
            context: this.extractMatchContext(prompt, keyword),
            matchType: "keyword",
            pattern: keyword,
            patternStrength: 0.7, // Keyword match has medium strength
            weight: agentPattern.weight,
          });
        }
      }

      // Check aliases with word boundaries
      for (const alias of agentPattern.aliases) {
        const regex = new RegExp(`\\b${alias.toLowerCase()}\\b`);
        if (regex.test(prompt)) {
          matches.push({
            agentType: agentPattern.agentType,
            context: this.extractMatchContext(prompt, alias),
            matchType: "alias",
            pattern: alias,
            patternStrength: 0.8, // Alias match has high strength
            weight: agentPattern.weight,
          });
        }
      }
    }

    return this.deduplicateMatches(matches);
  }

  private hasProjectContext(matches: PatternMatch[]): boolean {
    return matches.some(
      (match) =>
        match.context.includes(" ") &&
        match.context.length > match.pattern.length + 5,
    );
  }
}
