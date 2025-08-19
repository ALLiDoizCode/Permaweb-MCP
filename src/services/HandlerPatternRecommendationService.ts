import {
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import {
  DocumentationExample,
  HandlerPatternTemplate,
  HandlerRecommendation,
  HandlerStructureRecommendation,
  MessagePatternAnalysis,
} from "../types/process-architecture.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";
import { RequirementAnalysisService } from "./RequirementAnalysisService.js";

/**
 * Service for analyzing message handler patterns from AO documentation and providing
 * handler structure recommendations based on detected patterns and requirements.
 *
 * This service processes AO documentation to:
 * - Analyze message patterns and handler structures
 * - Recommend appropriate handler organization
 * - Generate handler templates based on documented examples
 * - Provide validation for handler pattern implementations
 */
export class HandlerPatternRecommendationService {
  private readonly handlerPatterns: Record<
    string,
    {
      complexity: ComplexityLevel;
      name: string;
      template: string;
      useCases: string[];
    }
  > = {
    batchHandler: {
      complexity: "complex" as ComplexityLevel,
      name: "Batch Processing Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Parse batch data
  local batch = json.decode(msg.Data or "{}")
  local results = {}
  
  -- Process each item in batch
  for i, item in ipairs(batch.items or {}) do
    local result = {{BATCH_IMPLEMENTATION}}
    table.insert(results, result)
  end
  
  -- Return batch results
  return {
    action = "{{ACTION}}",
    processed = #results,
    results = results,
    success = true
  }
end)`,
      useCases: ["Bulk operations", "Data migration", "Batch processing"],
    },
    eventDriven: {
      complexity: "moderate" as ComplexityLevel,
      name: "Event-Driven Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Process event
  {{IMPLEMENTATION}}
  
  -- Emit related events
  ao.send({
    Target = ao.id,
    Action = "{{ACTION}}-Processed",
    Data = json.encode({
      originalAction = msg.Action,
      timestamp = msg.Timestamp,
      result = result
    })
  })
end)`,
      useCases: ["Async processing", "Event chains", "Workflow systems"],
    },
    patternMatching: {
      complexity: "complex" as ComplexityLevel,
      name: "Pattern Matching Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Pattern matching logic
  if msg.Tags and msg.Tags.Pattern then
    local pattern = msg.Tags.Pattern
    
    if pattern == "{{PATTERN_1}}" then
      {{PATTERN_1_IMPLEMENTATION}}
    elseif pattern == "{{PATTERN_2}}" then
      {{PATTERN_2_IMPLEMENTATION}}
    else
      return { error = "Unknown pattern: " .. pattern }
    end
  end
  
  {{DEFAULT_IMPLEMENTATION}}
end)`,
      useCases: [
        "Complex routing",
        "Multi-protocol support",
        "Flexible interfaces",
      ],
    },
    requestResponse: {
      complexity: "moderate" as ComplexityLevel,
      name: "Request-Response Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Validate request
  if not msg.Data or msg.Data == "" then
    return { error = "Invalid request data" }
  end
  
  -- Process request
  {{IMPLEMENTATION}}
  
  -- Send response
  ao.send({
    Target = msg.From,
    Action = "{{ACTION}}-Response",
    Data = result
  })
end)`,
      useCases: ["API-like interactions", "Synchronous processing"],
    },
    standardHandler: {
      complexity: "simple" as ComplexityLevel,
      name: "Standard Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Handler implementation for {{ACTION}}
  {{IMPLEMENTATION}}
  return "{{ACTION}} processed"
end)`,
      useCases: ["Basic message processing", "Simple request-response"],
    },
    statefulHandler: {
      complexity: "moderate" as ComplexityLevel,
      name: "Stateful Handler",
      template: `Handlers.add("{{ACTION}}", function(msg)
  -- Validate state
  if not {{STATE_VARIABLE}} then
    {{STATE_VARIABLE}} = {{DEFAULT_STATE}}
  end
  
  -- Update state
  {{IMPLEMENTATION}}
  
  -- Persist state changes
  {{STATE_VARIABLE}} = newState
  
  return {
    action = "{{ACTION}}",
    state = {{STATE_VARIABLE}},
    success = true
  }
end)`,
      useCases: ["State management", "Data persistence", "User sessions"],
    },
  };

  private readonly messageTypePatterns: Record<
    string,
    {
      handler: string;
      stateUpdates: string[];
      validation: string[];
    }
  > = {
    balance: {
      handler: "requestResponse",
      stateUpdates: [],
      validation: ["target"],
    },
    broadcast: {
      handler: "eventDriven",
      stateUpdates: [],
      validation: ["message", "channel"],
    },
    info: {
      handler: "standardHandler",
      stateUpdates: [],
      validation: [],
    },
    join: {
      handler: "statefulHandler",
      stateUpdates: ["channels", "members"],
      validation: ["channelId", "userId"],
    },
    proposal: {
      handler: "statefulHandler",
      stateUpdates: ["proposals", "proposalCount"],
      validation: ["title", "description", "duration"],
    },
    register: {
      handler: "statefulHandler",
      stateUpdates: ["registry", "memberCount"],
      validation: ["identifier", "data"],
    },
    transfer: {
      handler: "statefulHandler",
      stateUpdates: ["balances", "totalSupply"],
      validation: ["amount", "recipient", "balance"],
    },
    vote: {
      handler: "eventDriven",
      stateUpdates: ["votes", "proposals"],
      validation: ["proposalId", "choice"],
    },
  };

  constructor(
    private permawebDocsService: PermawebDocs,
    private requirementAnalysisService: RequirementAnalysisService,
  ) {}

  /**
   * Analyze message patterns from documentation and requirements
   */
  async analyzeMessagePatterns(
    docs: PermawebDocsResult[],
  ): Promise<MessagePatternAnalysis> {
    try {
      const commonPatterns = await this.extractCommonPatterns(docs);
      const messageTypes = await this.analyzeMessageTypes(docs);
      const routingStrategies = await this.analyzeRoutingStrategies(docs);

      return {
        commonPatterns,
        messageTypes,
        routingStrategies,
      };
    } catch (error) {
      throw new Error(
        `HandlerPatternRecommendationService.analyzeMessagePatterns failed: ${error}`,
      );
    }
  }

  /**
   * Generate handler templates based on patterns and requirements
   */
  async generateHandlerTemplates(
    requirements: RequirementAnalysis,
    messagePatterns: MessagePatternAnalysis,
  ): Promise<HandlerPatternTemplate[]> {
    try {
      const templates: HandlerPatternTemplate[] = [];

      // Generate templates based on detected patterns
      for (const pattern of requirements.detectedPatterns) {
        const template = this.createTemplateForPattern(
          pattern,
          requirements.complexity,
          messagePatterns,
        );
        if (template) {
          templates.push(template);
        }
      }

      // Add default templates if none generated
      if (templates.length === 0) {
        templates.push(this.createDefaultTemplate(requirements.complexity));
      }

      // Add utility templates
      templates.push(...this.createUtilityTemplates(requirements.processType));

      return templates;
    } catch (error) {
      throw new Error(
        `HandlerPatternRecommendationService.generateHandlerTemplates failed: ${error}`,
      );
    }
  }

  /**
   * Recommend handler structure based on message patterns and requirements
   */
  async recommendHandlerStructure(
    messagePatterns: MessagePatternAnalysis,
    requirements: RequirementAnalysis,
  ): Promise<HandlerStructureRecommendation> {
    try {
      const primaryHandlers = await this.generatePrimaryHandlers(
        requirements,
        messagePatterns,
      );
      const secondaryHandlers = await this.generateSecondaryHandlers(
        requirements,
        messagePatterns,
      );
      const utilityHandlers = await this.generateUtilityHandlers(requirements);

      const messageFlow = this.analyzeMessageFlow(requirements, [
        ...primaryHandlers,
        ...secondaryHandlers,
        ...utilityHandlers,
      ]);

      const patterns = await this.generateHandlerTemplates(
        requirements,
        messagePatterns,
      );

      return {
        messageFlow,
        patterns,
        structure: {
          primary: primaryHandlers,
          secondary: secondaryHandlers,
          utility: utilityHandlers,
        },
      };
    } catch (error) {
      throw new Error(
        `HandlerPatternRecommendationService.recommendHandlerStructure failed: ${error}`,
      );
    }
  }

  /**
   * Validate handler patterns against best practices
   */
  async validateHandlerPatterns(
    templates: HandlerPatternTemplate[],
  ): Promise<{ errors: string[]; valid: boolean; warnings: string[] }> {
    try {
      const warnings: string[] = [];
      const errors: string[] = [];

      for (const template of templates) {
        // Check for common issues
        if (!template.template.includes("function(msg)")) {
          errors.push(
            `Handler ${template.name} does not follow standard function signature`,
          );
        }

        if (
          template.complexity === "complex" &&
          !template.template.includes("validate")
        ) {
          warnings.push(
            `Complex handler ${template.name} should include validation logic`,
          );
        }

        if (!template.template.includes("return")) {
          warnings.push(`Handler ${template.name} should return a value`);
        }

        // Check for state management in stateful templates
        if (
          template.name.toLowerCase().includes("stateful") &&
          !template.template.includes("State")
        ) {
          warnings.push(
            `Stateful handler ${template.name} should manage state explicitly`,
          );
        }
      }

      return {
        errors,
        valid: errors.length === 0,
        warnings,
      };
    } catch (error) {
      throw new Error(
        `HandlerPatternRecommendationService.validateHandlerPatterns failed: ${error}`,
      );
    }
  }

  private addExample(
    map: Map<string, DocumentationExample[]>,
    pattern: string,
    doc: PermawebDocsResult,
  ) {
    if (!map.has(pattern)) {
      map.set(pattern, []);
    }
    map.get(pattern)!.push({
      domain: doc.domain,
      excerpt: this.extractRelevantExcerpt(doc.content),
      relevance: doc.relevanceScore,
      source: doc.url,
      title: this.extractTitle(doc.content),
    });
  }

  /**
   * Analyze message flow between handlers
   */
  private analyzeMessageFlow(
    requirements: RequirementAnalysis,
    handlers: HandlerRecommendation[],
  ) {
    const messageTypes = handlers.flatMap((h) => h.messageTypes);

    return {
      inbound: messageTypes.filter((type) =>
        ["proposal", "register", "transfer", "vote"].includes(type),
      ),
      internal: messageTypes.filter((type) =>
        ["error", "health", "monitor"].includes(type),
      ),
      outbound: messageTypes.filter((type) =>
        ["notification", "response", "status"].includes(type),
      ),
    };
  }

  /**
   * Analyze message types from documentation
   */
  private async analyzeMessageTypes(docs: PermawebDocsResult[]) {
    const messageTypes: Set<string> = new Set();
    const messageTypeInfo = new Map<string, any>();

    for (const doc of docs) {
      const content = doc.content;

      // Extract message types from handler definitions
      const handlerMatches = content.matchAll(
        /Handlers\.add\s*\(\s*["']([^"']+)["']/g,
      );
      for (const match of handlerMatches) {
        const messageType = match[1];
        messageTypes.add(messageType);

        if (!messageTypeInfo.has(messageType)) {
          messageTypeInfo.set(messageType, {
            description: this.generateMessageTypeDescription(messageType),
            documentation: [],
            handlerPattern: this.getHandlerPatternForMessageType(messageType),
            type: messageType,
          });
        }

        messageTypeInfo.get(messageType).documentation.push({
          domain: doc.domain,
          excerpt: this.extractRelevantExcerpt(doc.content, messageType),
          relevance: doc.relevanceScore,
          source: doc.url,
          title: this.extractTitle(doc.content),
        });
      }
    }

    return Array.from(messageTypeInfo.values());
  }

  /**
   * Analyze routing strategies from documentation
   */
  private async analyzeRoutingStrategies(docs: PermawebDocsResult[]) {
    const strategies = [
      {
        complexity: "simple" as ComplexityLevel,
        description: "Direct message routing to specific handlers",
        examples: this.findExamplesForStrategy(docs, "direct"),
        strategy: "Direct Routing",
      },
      {
        complexity: "moderate" as ComplexityLevel,
        description: "Route messages based on pattern matching",
        examples: this.findExamplesForStrategy(docs, "pattern"),
        strategy: "Pattern-Based Routing",
      },
      {
        complexity: "complex" as ComplexityLevel,
        description: "Route messages through event system",
        examples: this.findExamplesForStrategy(docs, "event"),
        strategy: "Event-Driven Routing",
      },
    ];

    return strategies;
  }

  /**
   * Create default template
   */
  private createDefaultTemplate(
    complexity: ComplexityLevel,
  ): HandlerPatternTemplate {
    const patternKey =
      complexity === "simple" ? "standardHandler" : "requestResponse";
    const pattern = this.handlerPatterns[patternKey];

    return {
      complexity,
      description: `Default ${complexity} handler pattern`,
      documentation: [],
      name: pattern.name,
      template: pattern.template,
      useCases: pattern.useCases,
    };
  }

  /**
   * Create handler recommendation
   */
  private createHandlerRecommendation(
    name: string,
    messageType: string,
    requirements: RequirementAnalysis,
  ): HandlerRecommendation {
    const patternInfo = this.messageTypePatterns[messageType] || {
      handler: "standardHandler",
      stateUpdates: [],
      validation: [],
    };

    return {
      complexity: requirements.complexity,
      documentation: [],
      messageTypes: [messageType],
      name: `${name} Handler`,
      purpose: `Handle ${messageType} messages`,
      template: this.generateHandlerTemplate(messageType, requirements),
    };
  }

  /**
   * Create template for specific pattern
   */
  private createTemplateForPattern(
    pattern: string,
    complexity: ComplexityLevel,
    messagePatterns: MessagePatternAnalysis,
  ): HandlerPatternTemplate | null {
    const patternTemplates: Record<string, Partial<HandlerPatternTemplate>> = {
      "dao-governance": {
        description: "Handler pattern for DAO governance operations",
        name: "DAO Governance Handler Pattern",
        template: this.handlerPatterns.eventDriven.template,
        useCases: ["Voting", "Proposal creation", "Member management"],
      },
      handler: {
        description: "Basic handler pattern for message processing",
        name: "Generic Handler Pattern",
        template: this.handlerPatterns.standardHandler.template,
        useCases: ["Message processing", "Request handling"],
      },
      "token-contract": {
        description: "Handler pattern for token contract operations",
        name: "Token Contract Handler Pattern",
        template: this.handlerPatterns.statefulHandler.template,
        useCases: ["Token transfers", "Balance queries", "Token info"],
      },
    };

    const templateBase = patternTemplates[pattern];
    if (!templateBase) return null;

    return {
      complexity,
      description: templateBase.description!,
      documentation: [],
      name: templateBase.name!,
      template: templateBase.template!,
      useCases: templateBase.useCases!,
    };
  }

  /**
   * Create utility templates
   */
  private createUtilityTemplates(
    processType: ProcessType,
  ): HandlerPatternTemplate[] {
    return [
      {
        complexity: "simple",
        description: "Handler for health monitoring",
        documentation: [],
        name: "Health Check Handler",
        template: this.handlerPatterns.standardHandler.template.replace(
          "{{ACTION}}",
          "health",
        ),
        useCases: ["Health monitoring", "System status"],
      },
    ];
  }

  /**
   * Extract common patterns from documentation
   */
  private async extractCommonPatterns(docs: PermawebDocsResult[]) {
    const patternCounts = new Map<string, number>();
    const patternExamples = new Map<string, DocumentationExample[]>();

    for (const doc of docs) {
      const content = doc.content.toLowerCase();

      // Count handler pattern occurrences
      if (content.includes("handlers.add")) {
        this.incrementPattern(patternCounts, "standard-handler");
        this.addExample(patternExamples, "standard-handler", doc);
      }

      if (content.includes("request") && content.includes("response")) {
        this.incrementPattern(patternCounts, "request-response");
        this.addExample(patternExamples, "request-response", doc);
      }

      if (content.includes("event") || content.includes("emit")) {
        this.incrementPattern(patternCounts, "event-driven");
        this.addExample(patternExamples, "event-driven", doc);
      }

      if (content.includes("state") || content.includes("balance")) {
        this.incrementPattern(patternCounts, "stateful");
        this.addExample(patternExamples, "stateful", doc);
      }

      if (content.includes("batch") || content.includes("bulk")) {
        this.incrementPattern(patternCounts, "batch-processing");
        this.addExample(patternExamples, "batch-processing", doc);
      }
    }

    return Array.from(patternCounts.entries()).map(([pattern, frequency]) => ({
      examples: patternExamples.get(pattern) || [],
      frequency,
      pattern,
      useCases: this.getUseCasesForPattern(pattern),
    }));
  }

  private extractRelevantExcerpt(
    content: string,
    messageType?: string,
  ): string {
    if (messageType) {
      const lines = content.split("\n");
      const relevantLine = lines.find((line) =>
        line.toLowerCase().includes(messageType.toLowerCase()),
      );
      return relevantLine
        ? relevantLine.substring(0, 200)
        : content.substring(0, 200);
    }
    return content.substring(0, 200);
  }

  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : "Handler Pattern";
  }

  private findExamplesForStrategy(
    docs: PermawebDocsResult[],
    strategy: string,
  ): DocumentationExample[] {
    return docs
      .filter((doc) =>
        doc.content.toLowerCase().includes(strategy.toLowerCase()),
      )
      .slice(0, 2)
      .map((doc) => ({
        domain: doc.domain,
        excerpt: this.extractRelevantExcerpt(doc.content, strategy),
        relevance: doc.relevanceScore,
        source: doc.url,
        title: this.extractTitle(doc.content),
      }));
  }

  /**
   * Generate handler template for specific message type
   */
  private generateHandlerTemplate(
    messageType: string,
    requirements: RequirementAnalysis,
  ): string {
    const patternInfo = this.messageTypePatterns[messageType] || {
      handler: "standardHandler",
    };
    const pattern = this.handlerPatterns[patternInfo.handler];

    let template = pattern.template;
    template = template.replace(/\{\{ACTION\}\}/g, messageType);

    // Add message type specific implementation
    const implementation = this.getImplementationForMessageType(
      messageType,
      requirements.processType,
    );
    template = template.replace(/\{\{IMPLEMENTATION\}\}/g, implementation);

    // Add state variables if needed
    if (template.includes("{{STATE_VARIABLE}}")) {
      const stateVar = this.getStateVariableForMessageType(messageType);
      template = template.replace(/\{\{STATE_VARIABLE\}\}/g, stateVar);
    }

    return template;
  }

  private generateMessageTypeDescription(messageType: string): string {
    const descriptions: Record<string, string> = {
      balance: "Query account balance information",
      info: "Provide system information",
      proposal: "Handle proposal creation and management",
      register: "Register new entities or users",
      transfer: "Handle token transfer operations",
      vote: "Process voting actions",
    };
    return descriptions[messageType] || `Handle ${messageType} operations`;
  }

  /**
   * Generate primary handlers based on requirements
   */
  private async generatePrimaryHandlers(
    requirements: RequirementAnalysis,
    messagePatterns: MessagePatternAnalysis,
  ): Promise<HandlerRecommendation[]> {
    const handlers: HandlerRecommendation[] = [];

    // Generate handlers based on detected patterns
    for (const pattern of requirements.detectedPatterns) {
      if (pattern === "token-contract") {
        handlers.push(
          this.createHandlerRecommendation(
            "Transfer",
            "transfer",
            requirements,
          ),
          this.createHandlerRecommendation("Balance", "balance", requirements),
          this.createHandlerRecommendation("Info", "info", requirements),
        );
      } else if (pattern === "dao-governance") {
        handlers.push(
          this.createHandlerRecommendation("Vote", "vote", requirements),
          this.createHandlerRecommendation(
            "Proposal",
            "proposal",
            requirements,
          ),
          this.createHandlerRecommendation(
            "Register",
            "register",
            requirements,
          ),
        );
      } else if (pattern === "handler") {
        handlers.push(
          this.createHandlerRecommendation("Process", "process", requirements),
        );
      }
    }

    // Add default handler if none generated
    if (handlers.length === 0) {
      handlers.push(
        this.createHandlerRecommendation("Info", "info", requirements),
      );
    }

    return handlers;
  }

  /**
   * Generate secondary handlers
   */
  private async generateSecondaryHandlers(
    requirements: RequirementAnalysis,
    messagePatterns: MessagePatternAnalysis,
  ): Promise<HandlerRecommendation[]> {
    const handlers: HandlerRecommendation[] = [];

    // Add common secondary handlers based on complexity
    if (
      requirements.complexity === "moderate" ||
      requirements.complexity === "complex"
    ) {
      handlers.push(
        this.createHandlerRecommendation("Status", "status", requirements),
        this.createHandlerRecommendation("Config", "config", requirements),
      );
    }

    if (requirements.complexity === "complex") {
      handlers.push(
        this.createHandlerRecommendation("Monitor", "monitor", requirements),
        this.createHandlerRecommendation("Admin", "admin", requirements),
      );
    }

    return handlers;
  }

  /**
   * Generate utility handlers
   */
  private async generateUtilityHandlers(
    requirements: RequirementAnalysis,
  ): Promise<HandlerRecommendation[]> {
    const handlers: HandlerRecommendation[] = [];

    // Always include basic utility handlers
    handlers.push(
      this.createHandlerRecommendation("Health", "health", requirements),
      this.createHandlerRecommendation("Version", "version", requirements),
    );

    // Add error handler for complex systems
    if (requirements.complexity === "complex") {
      handlers.push(
        this.createHandlerRecommendation("Error", "error", requirements),
      );
    }

    return handlers;
  }

  private getHandlerPatternForMessageType(messageType: string): string {
    const patterns: Record<string, string> = {
      balance: "request-response",
      info: "standard-handler",
      proposal: "stateful-handler",
      register: "stateful-handler",
      transfer: "stateful-handler",
      vote: "event-driven",
    };
    return patterns[messageType] || "standard-handler";
  }

  private getImplementationForMessageType(
    messageType: string,
    processType: ProcessType,
  ): string {
    const implementations: Record<string, string> = {
      balance: `-- Get balance for target
  local target = msg.Tags.Target or msg.From
  local balance = balances[target] or 0
  
  -- Return balance information
  local result = tostring(balance)`,
      info: `-- Return process information
  local result = {
    name = processName or "AO Process",
    version = "1.0.0",
    timestamp = msg.Timestamp
  }`,
      transfer: `-- Validate transfer parameters
  local amount = tonumber(msg.Tags.Amount)
  local recipient = msg.Tags.Recipient
  
  -- Process transfer
  balances[recipient] = (balances[recipient] or 0) + amount
  balances[msg.From] = (balances[msg.From] or 0) - amount`,
    };

    return (
      implementations[messageType] ||
      "-- Process message\n  local result = msg.Data"
    );
  }

  private getStateVariableForMessageType(messageType: string): string {
    const stateVars: Record<string, string> = {
      balance: "balances",
      proposal: "proposals",
      register: "registry",
      transfer: "balances",
      vote: "votes",
    };
    return stateVars[messageType] || "state";
  }

  private getUseCasesForPattern(pattern: string): string[] {
    const useCases: Record<string, string[]> = {
      "batch-processing": ["Bulk operations", "Data migration"],
      "event-driven": ["Async processing", "Event chains"],
      "request-response": ["API interactions", "Synchronous processing"],
      "standard-handler": ["Basic message processing", "Simple operations"],
      stateful: ["State management", "Data persistence"],
    };
    return useCases[pattern] || ["General purpose"];
  }

  // Helper methods
  private incrementPattern(map: Map<string, number>, pattern: string) {
    map.set(pattern, (map.get(pattern) || 0) + 1);
  }
}
