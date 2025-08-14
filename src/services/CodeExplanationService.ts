import { CodeExplanation, LuaCodeResult } from "../types/lua-workflow.js";
import { PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for generating detailed code explanations with documentation source citations.
 *
 * This service creates comprehensive explanations for generated Lua code including:
 * - Overview of the code's purpose and structure
 * - Section-by-section code breakdown with explanations
 * - Best practices extracted from documentation sources
 * - Related documentation references for further learning
 */
export class CodeExplanationService {
  /**
   * Generate comprehensive code explanation with source citations
   */
  async explainCode(
    codeResult: LuaCodeResult,
    sources: PermawebDocsResult[],
  ): Promise<CodeExplanation> {
    const overview = this.generateOverview(codeResult);
    const codeBreakdown = this.generateCodeBreakdown(codeResult, sources);
    const bestPractices = this.enhanceBestPractices(
      codeResult.bestPractices,
      sources,
    );
    const relatedSources = this.extractRelatedSources(sources);

    return {
      bestPractices,
      codeBreakdown,
      overview,
      relatedSources,
    };
  }

  /**
   * Enhance best practices with documentation context
   */
  private enhanceBestPractices(
    practices: string[],
    sources: PermawebDocsResult[],
  ): string[] {
    const enhanced = [...practices];

    // Add documentation-specific practices
    if (sources.some((s) => s.content.includes("state management"))) {
      enhanced.push(
        "Follow AO state management patterns as documented in the AO computer system guides",
      );
    }

    if (sources.some((s) => s.content.includes("message routing"))) {
      enhanced.push(
        "Implement message routing according to AO process communication protocols",
      );
    }

    if (sources.some((s) => s.content.includes("error handling"))) {
      enhanced.push(
        "Apply error handling patterns consistent with AO ecosystem standards",
      );
    }

    // Add security practices from documentation
    if (
      sources.some(
        (s) =>
          s.content.includes("security") || s.content.includes("validation"),
      )
    ) {
      enhanced.push(
        "Validate all incoming message parameters before processing",
        "Implement proper access control for sensitive operations",
        "Use consistent error messaging to avoid information leakage",
      );
    }

    return enhanced;
  }

  /**
   * Extract related documentation sources for further reference
   */
  private extractRelatedSources(sources: PermawebDocsResult[]): string[] {
    return sources.map((source) => {
      const domain = source.domain.toUpperCase();
      const snippet = source.content.substring(0, 100).replace(/\n/g, " ");
      return `${domain}: ${snippet}... (${source.url})`;
    });
  }

  /**
   * Find relevant documentation source based on keywords
   */
  private findRelevantSource(
    sources: PermawebDocsResult[],
    ...keywords: string[]
  ): string | undefined {
    const relevant = sources.find((source) => {
      const content = source.content.toLowerCase();
      return keywords.some((keyword) =>
        content.includes(keyword.toLowerCase()),
      );
    });

    return relevant?.url;
  }

  /**
   * Format pattern name for display
   */
  private formatPatternName(pattern: string): string {
    return pattern
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Generate detailed code breakdown with documentation references
   */
  private generateCodeBreakdown(
    codeResult: LuaCodeResult,
    sources: PermawebDocsResult[],
  ): CodeExplanation["codeBreakdown"] {
    const breakdown: CodeExplanation["codeBreakdown"] = [];

    // Analyze state initialization
    if (codeResult.generatedCode.includes("State = {")) {
      breakdown.push({
        documentationReference: this.findRelevantSource(
          sources,
          "state",
          "initialization",
        ),
        explanation:
          "Initializes the process state with necessary data structures. In AO, state persists between message handlers and maintains the process's memory.",
        section: "State Initialization",
      });
    }

    // Analyze each handler pattern
    for (const pattern of codeResult.handlerPatterns) {
      breakdown.push({
        documentationReference: this.findRelevantSource(
          sources,
          "handler",
          pattern.name,
        ),
        explanation: this.generateHandlerExplanation(pattern),
        section: `${pattern.name} Handler`,
      });
    }

    // Analyze message routing
    if (codeResult.generatedCode.includes("Handlers.add")) {
      breakdown.push({
        documentationReference: this.findRelevantSource(
          sources,
          "handlers",
          "message",
        ),
        explanation:
          "Uses Handlers.add() to register message handlers with specific matching criteria. The Handlers.utils.hasMatchingTag() function filters messages based on Action tags.",
        section: "Message Routing",
      });
    }

    // Analyze response patterns
    if (codeResult.generatedCode.includes("ao.send")) {
      breakdown.push({
        documentationReference: this.findRelevantSource(
          sources,
          "ao.send",
          "response",
        ),
        explanation:
          "Uses ao.send() to send response messages back to the original sender. Each response includes appropriate action tags and data payloads for client processing.",
        section: "Response Handling",
      });
    }

    // Analyze error handling
    if (codeResult.generatedCode.includes("Error")) {
      breakdown.push({
        documentationReference: this.findRelevantSource(
          sources,
          "error",
          "validation",
        ),
        explanation:
          "Implements proper error validation and response patterns. Invalid inputs are caught early and appropriate error messages are sent back to the caller.",
        section: "Error Handling",
      });
    }

    return breakdown;
  }

  /**
   * Generate explanation for a specific handler pattern
   */
  private generateHandlerExplanation(pattern: any): string {
    switch (pattern.name) {
      case "balance-handler":
        return "Processes balance inquiry requests. Retrieves the balance for the specified target account (or sender if no target specified) and returns it in a standardized response format.";

      case "ping-handler":
        return "Simple test handler that responds to ping messages with a pong. Useful for verifying process connectivity and basic functionality.";

      case "proposal-handler":
        return "Creates new governance proposals in the DAO. Assigns unique proposal IDs, stores proposal metadata, and notifies the proposer of successful creation.";

      case "transfer-handler":
        return "Handles token transfer operations with comprehensive validation. Checks transfer amount validity, sender balance sufficiency, and updates both sender and recipient balances atomically.";

      case "vote-handler":
        return "Records votes on active governance proposals. Validates proposal existence, ensures proposal is in active status, and records the member's vote preference.";

      default:
        return `${pattern.description}. This handler processes incoming messages and responds according to the specified business logic.`;
    }
  }

  /**
   * Generate high-level overview of the code
   */
  private generateOverview(codeResult: LuaCodeResult): string {
    const handlerCount = codeResult.handlerPatterns.length;
    const patterns = codeResult.handlerPatterns
      .map((p) => p.usedPatterns)
      .flat();
    const uniquePatterns = Array.from(new Set(patterns));

    return `This AO process implements ${handlerCount} handler${handlerCount > 1 ? "s" : ""} following ${uniquePatterns.length} core pattern${uniquePatterns.length > 1 ? "s" : ""}:

${uniquePatterns.map((pattern) => `• ${this.formatPatternName(pattern)}`).join("\n")}

The code follows AO best practices for message handling, state management, and error handling. Each handler is designed to process specific message types and respond appropriately to the sender.`;
  }
}
