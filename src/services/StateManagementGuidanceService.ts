import {
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import {
  DocumentationExample,
  StateManagementGuidance,
  StateManagementType,
} from "../types/process-architecture.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for providing state management guidance based on AO documentation patterns
 * and architectural requirements.
 *
 * This service analyzes AO tutorials and process examples to:
 * - Recommend appropriate state management approaches
 * - Provide implementation guidance for different state types
 * - Generate best practices from documented examples
 * - Validate state management patterns against known implementations
 */
export class StateManagementGuidanceService {
  private readonly statePatterns = {
    external: {
      bestPractices: [
        "Implement proper communication protocols",
        "Handle external process failures gracefully",
        "Use timeouts for external requests",
        "Cache frequently accessed data locally",
      ],
      description: "State managed by external processes or storage",
      implementation: `-- External state - delegated to other processes
local STATE_PROCESS = "state-manager-process-id"

Handlers.add("getData", function(msg)
  -- Request data from external state manager
  ao.send({
    Target = STATE_PROCESS,
    Action = "Get",
    Tags = {
      Key = msg.Tags.Key,
      RequestId = msg.Id
    }
  })
end)

Handlers.add("StateResponse", function(msg)
  -- Handle response from state manager
  if msg.From == STATE_PROCESS then
    -- Process the state data
    local data = json.decode(msg.Data)
    return data
  end
end)`,
      name: "External State Management",
      useCases: ["Distributed systems", "Microservices", "Shared state"],
    },
    hybrid: {
      bestPractices: [
        "Clearly separate immutable and mutable parts",
        "Use naming conventions to distinguish state types",
        "Validate modifications only affect mutable state",
        "Document state management strategy",
      ],
      description: "Combination of immutable and mutable state",
      implementation: `-- Hybrid state - immutable config + mutable data
-- MyProcess implementation
local CONFIG = {  -- Immutable
  name = "MyProcess",
  symbol = "TOK",
  decimals = 18
}

local state = {  -- Mutable
  balances = {},
  allowances = {},
  totalSupply = 0
}

Handlers.add("processData", processData)

function processData(msg)
  -- Can modify mutable state
  local amount = tonumber(msg.Tags.Amount)
  state.totalSupply = state.totalSupply + amount
  state.balances[msg.Tags.Recipient] = amount
  
  -- Cannot modify CONFIG
  return {
    config = CONFIG,
    newBalance = state.balances[msg.Tags.Recipient]
  }
end`,
      name: "Hybrid State Management",
      useCases: [
        "Complex applications",
        "Multi-feature systems",
        "Upgradeable contracts",
      ],
    },
    immutable: {
      bestPractices: [
        "Initialize state at process creation",
        "Never modify state variables",
        "Use uppercase for immutable constants",
        "Validate state on read operations",
      ],
      description: "State that never changes once set",
      implementation: `-- Immutable state - set once, never modified
local INITIAL_STATE = {
  name = "MyProcess",
  version = "1.0.0",
  createdAt = os.time()
}

-- State can only be read, never modified
Handlers.add("info", function(msg)
  return INITIAL_STATE
end)`,
      name: "Immutable State Management",
      useCases: ["Configuration data", "Process metadata", "Constants"],
    },
    mutable: {
      bestPractices: [
        "Validate state changes before applying",
        "Use atomic operations for state updates",
        "Implement proper error handling",
        "Log state changes for debugging",
      ],
      description: "State that can be modified through handlers",
      implementation: `-- Mutable state - can be updated by handlers
-- MyProcess implementation
local state = {
  balances = {},
  totalSupply = 1000000,
  owner = "process-owner-address"
}

Handlers.add("processData", processData)

function processData(msg)
  -- Validate and update state
  local amount = tonumber(msg.Tags.Amount)
  local recipient = msg.Tags.Recipient
  
  if state.balances[msg.From] >= amount then
    state.balances[msg.From] = (state.balances[msg.From] or 0) - amount
    state.balances[recipient] = (state.balances[recipient] or 0) + amount
    return "Transfer successful"
  else
    return "Insufficient balance"
  end
end`,
      name: "Mutable State Management",
      useCases: ["Token contracts", "User accounts", "Application data"],
    },
    none: {
      bestPractices: [
        "Keep handlers pure functions",
        "Avoid global variables",
        "Process all data from incoming messages",
        "Return results immediately",
      ],
      description: "Stateless processes with no persistent data",
      implementation: `-- Stateless process - no state variables needed
-- All data comes from messages and is processed immediately
Handlers.add("process", function(msg)
  local result = processData(msg.Data)
  return result
end)`,
      name: "No State Management",
      useCases: ["Calculators", "Formatters", "Simple processors"],
    },
  };

  constructor(private permawebDocsService: PermawebDocs) {}

  /**
   * Analyze state management patterns from AO documentation
   */
  async analyzeStatePatterns(docs: PermawebDocsResult[]): Promise<{
    examples: Record<StateManagementType, DocumentationExample[]>;
    patterns: Record<StateManagementType, number>;
  }> {
    try {
      const patterns: Record<StateManagementType, number> = {
        external: 0,
        hybrid: 0,
        immutable: 0,
        mutable: 0,
        none: 0,
      };

      const examples: Record<StateManagementType, DocumentationExample[]> = {
        external: [],
        hybrid: [],
        immutable: [],
        mutable: [],
        none: [],
      };

      for (const doc of docs) {
        const detectedType = this.detectStateManagementType(doc.content);
        patterns[detectedType]++;

        examples[detectedType].push({
          domain: doc.domain,
          excerpt: this.extractStateRelevantExcerpt(doc.content),
          relevance: doc.relevanceScore,
          source: doc.url,
          title: this.extractTitle(doc.content),
        });
      }

      return { examples, patterns };
    } catch (error) {
      throw new Error(
        `StateManagementGuidanceService.analyzeStatePatterns failed: ${error}`,
      );
    }
  }

  /**
   * Generate state management guidance based on requirements
   */
  async generateStateManagementGuidance(
    requirements: RequirementAnalysis,
    processType: ProcessType,
  ): Promise<StateManagementGuidance> {
    try {
      const recommended = this.recommendStateManagement(
        requirements,
        processType,
      );
      const alternatives = this.getAlternativeStateManagement(
        recommended,
        processType,
      );
      const patterns = await this.generateStatePatterns(
        recommended,
        alternatives,
      );
      const bestPractices = this.getBestPractices(
        recommended,
        requirements.complexity,
      );
      const documentation = await this.findStateManagementDocumentation(
        recommended,
        requirements,
      );

      return {
        alternatives,
        bestPractices,
        documentation,
        patterns,
        recommended,
      };
    } catch (error) {
      throw new Error(
        `StateManagementGuidanceService.generateStateManagementGuidance failed: ${error}`,
      );
    }
  }

  /**
   * Get implementation template for specific state type
   */
  getImplementationTemplate(
    stateType: StateManagementType,
    requirements: RequirementAnalysis,
  ): string {
    let template = this.statePatterns[stateType].implementation;

    // Customize template based on detected patterns
    if (requirements.detectedPatterns.includes("token-contract")) {
      // Replace all instances of MyProcess with TokenContract
      template = template.replace(/MyProcess/g, "TokenContract");
      // Replace function name and definition
      template = template.replace(/processData/g, "handleTokenOperation");
    }

    if (requirements.detectedPatterns.includes("dao-governance")) {
      // Replace all instances of MyProcess with DAOGovernance
      template = template.replace(/MyProcess/g, "DAOGovernance");
      // Replace function name and definition
      template = template.replace(/processData/g, "handleGovernanceAction");
    }

    return template;
  }

  /**
   * Validate state management choice against requirements
   */
  validateStateManagementChoice(
    stateType: StateManagementType,
    requirements: RequirementAnalysis,
    processType: ProcessType,
  ): { suggestions: string[]; valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate stateless choice
    if (processType === "stateless" && stateType !== "none") {
      warnings.push(
        "Stateless processes should not use persistent state management",
      );
      suggestions.push("Consider using 'none' state management type");
    }

    // Validate token contract state management
    if (
      requirements.detectedPatterns.includes("token-contract") &&
      stateType === "none"
    ) {
      warnings.push(
        "Token contracts typically require mutable state for balances",
      );
      suggestions.push("Consider using 'mutable' state management");
    }

    // Validate multi-process state management
    if (processType === "multi-process" && stateType === "mutable") {
      warnings.push(
        "Multi-process systems may have state consistency issues with local mutable state",
      );
      suggestions.push(
        "Consider using 'external' or 'hybrid' state management",
      );
    }

    // Validate complexity vs state management
    if (requirements.complexity === "simple" && stateType === "hybrid") {
      suggestions.push(
        "Simple applications may not need hybrid state management complexity",
      );
    }

    return {
      suggestions,
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Detect state management type from content
   */
  private detectStateManagementType(content: string): StateManagementType {
    const lowerContent = content.toLowerCase();

    // Check for external state patterns
    if (lowerContent.includes("ao.send") && lowerContent.includes("state")) {
      return "external";
    }

    // Check for hybrid patterns (both const and mutable variables)
    if (
      (lowerContent.includes("const") ||
        lowerContent.includes("local config")) &&
      lowerContent.includes("state")
    ) {
      return "hybrid";
    }

    // Check for mutable state patterns
    if (
      lowerContent.includes("state") &&
      (lowerContent.includes("=") || lowerContent.includes("update"))
    ) {
      return "mutable";
    }

    // Check for immutable patterns (constants without state)
    if (
      (lowerContent.includes("const") || lowerContent.includes("local")) &&
      !lowerContent.includes("state") &&
      !lowerContent.includes("calculate")
    ) {
      return "immutable";
    }

    // Check for stateless patterns - handlers that only compute without storing data
    if (
      lowerContent.includes("handlers.add") &&
      !lowerContent.includes("state") &&
      !lowerContent.includes("local") &&
      (lowerContent.includes("calculate") || 
       lowerContent.includes("return") ||
       lowerContent.includes("tonumber"))
    ) {
      return "none";
    }

    // Default to stateless
    return "none";
  }

  /**
   * Extract state management relevant excerpt
   */
  private extractStateRelevantExcerpt(content: string): string {
    const lines = content.split("\n");

    // Find lines containing state-related keywords
    const stateKeywords = ["state", "balance", "data", "storage", "variable"];
    const relevantLines = lines.filter((line) =>
      stateKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    if (relevantLines.length > 0) {
      return relevantLines.slice(0, 3).join(" ");
    }

    // Fallback to first few lines
    return lines.slice(0, 3).join(" ");
  }

  /**
   * Extract title from document content
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : "State Management Pattern";
  }

  /**
   * Find relevant documentation for state management
   */
  private async findStateManagementDocumentation(
    stateType: StateManagementType,
    requirements: RequirementAnalysis,
  ): Promise<DocumentationExample[]> {
    try {
      const query = `${stateType} state management ${requirements.detectedPatterns.join(" ")}`;
      const docs = await this.permawebDocsService.query(
        query,
        requirements.suggestedDomains,
        5,
      );

      return docs.map((doc) => ({
        domain: doc.domain,
        excerpt: this.extractStateRelevantExcerpt(doc.content),
        relevance: doc.relevanceScore,
        source: doc.url,
        title: this.extractTitle(doc.content),
      }));
    } catch (error) {
      // Return empty array if documentation query fails
      return [];
    }
  }

  /**
   * Generate state pattern implementations
   */
  private async generateStatePatterns(
    recommended: StateManagementType,
    alternatives: StateManagementType[],
  ) {
    const patterns = [];

    // Add recommended pattern
    patterns.push({
      description: this.statePatterns[recommended].description,
      examples: [],
      implementation: this.statePatterns[recommended].implementation,
      type: recommended,
    });

    // Add alternative patterns
    for (const alt of alternatives) {
      patterns.push({
        description: this.statePatterns[alt].description,
        examples: [],
        implementation: this.statePatterns[alt].implementation,
        type: alt,
      });
    }

    return patterns;
  }

  /**
   * Get alternative state management options
   */
  private getAlternativeStateManagement(
    recommended: StateManagementType,
    processType: ProcessType,
  ): StateManagementType[] {
    const alternatives: StateManagementType[] = [];

    // Always include none as alternative for stateless processing
    if (recommended !== "none") {
      alternatives.push("none");
    }

    // Include appropriate alternatives based on process type
    if (processType === "stateful") {
      if (recommended !== "mutable") alternatives.push("mutable");
      if (recommended !== "immutable") alternatives.push("immutable");
      if (recommended !== "hybrid") alternatives.push("hybrid");
    }

    if (processType === "multi-process") {
      if (recommended !== "external") alternatives.push("external");
      if (recommended !== "hybrid") alternatives.push("hybrid");
    }

    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  /**
   * Get best practices for state management
   */
  private getBestPractices(
    stateType: StateManagementType,
    complexity: ComplexityLevel,
  ): string[] {
    const basePractices = this.statePatterns[stateType].bestPractices;

    // Add complexity-specific practices
    const complexityPractices: Record<ComplexityLevel, string[]> = {
      complex: [
        "Design comprehensive state management strategy",
        "Implement state migration patterns",
        "Add monitoring and debugging capabilities",
      ],
      moderate: ["Implement proper validation", "Add error handling"],
      simple: ["Keep state minimal", "Use straightforward patterns"],
    };

    return [...basePractices, ...complexityPractices[complexity]];
  }

  /**
   * Recommend appropriate state management type
   */
  private recommendStateManagement(
    requirements: RequirementAnalysis,
    processType: ProcessType,
  ): StateManagementType {
    // Stateless processes should use no state
    if (processType === "stateless") {
      return "none";
    }

    // Multi-process systems often use external state
    if (processType === "multi-process") {
      return "external";
    }

    // Analyze detected patterns
    if (requirements.detectedPatterns.includes("token-contract")) {
      return "mutable"; // Tokens need mutable state for balances
    }

    if (requirements.detectedPatterns.includes("dao-governance")) {
      return "hybrid"; // DAO needs both config and mutable voting state
    }

    // Simple processes can use immutable state
    if (requirements.complexity === "simple") {
      return "immutable";
    }

    // Default to mutable for stateful processes
    return "mutable";
  }
}
