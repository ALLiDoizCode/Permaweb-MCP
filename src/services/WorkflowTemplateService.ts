import { RequirementAnalysis } from "../types/lua-workflow.js";
import {
  WorkflowConfiguration,
  WorkflowProcessType,
} from "../types/workflow-orchestration.js";

/**
 * Customized workflow template
 */
export interface CustomizedWorkflowTemplate {
  confidence: number;
  customizations: TemplateCustomization[];
  estimatedExecutionTime: number;
  finalConfiguration: WorkflowConfiguration;
  template: WorkflowTemplate;
  validationResults: TemplateValidationResult[];
}

/**
 * Template customization
 */
export interface TemplateCustomization {
  parameterId: string;
  reason: string;
  source: "requirements" | "system" | "user";
  value: unknown;
}

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  constraints?: {
    max?: number;
    min?: number;
    options?: unknown[];
    pattern?: string;
  };
  defaultValue?: unknown;
  description: string;
  name: string;
  required: boolean;
  type: "array" | "boolean" | "number" | "object" | "string";
}

/**
 * Template recommendation result
 */
export interface TemplateRecommendation {
  alternatives: Array<{
    confidence: number;
    reason: string;
    template: WorkflowTemplate;
  }>;
  confidence: number;
  customizations: TemplateCustomization[];
  estimatedSuccess: number;
  matchReasons: string[];
  template: WorkflowTemplate;
}

/**
 * Template stage definition
 */
export interface TemplateStage {
  defaultTools: string[];
  dependencies: string[];
  documentation: string;
  expectedOutputType: string;
  parameters: Record<string, unknown>;
  required: boolean;
  stage: string;
  validationRules: string[];
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  bestPracticesCompliance: number;
  issues: Array<{
    message: string;
    parameter?: string;
    recommendation?: string;
    severity: "error" | "info" | "warning";
    stage?: string;
  }>;
  isValid: boolean;
  requirements: {
    met: string[];
    missing: string[];
    optional: string[];
  };
  score: number;
}

/**
 * Workflow template definition
 */
export interface WorkflowTemplate {
  aoPatterns: string[];
  category: "bot" | "chatroom" | "custom" | "game" | "token";
  complexity: "complex" | "moderate" | "simple";
  configuration: Partial<WorkflowConfiguration>;
  description: string;
  documentation: {
    bestPractices: string[];
    examples: string[];
    overview: string;
    useCases: string[];
  };
  estimatedTime: number; // in milliseconds
  metadata: Record<string, unknown>;
  name: string;
  parameters: TemplateParameter[];
  processType: WorkflowProcessType;
  stages: TemplateStage[];
  templateId: string;
  version: string;
}

/**
 * Service for workflow template management and customization.
 *
 * This service provides:
 * - Template-based workflow initialization using documented AO process patterns
 * - Common process type templates (tokens, chatrooms, bots, games, custom workflows)
 * - Template customization and parameterization for specific use case requirements
 * - Integration with architecture analysis for optimal template selection
 * - Template validation using documented best practices and proven patterns
 */
export class WorkflowTemplateService {
  private readonly templates: Map<string, WorkflowTemplate>;

  constructor() {
    this.templates = new Map();
    this.initializeStandardTemplates();
  }

  /**
   * Add or update template
   */
  addTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.templateId, template);
  }

  /**
   * Customize template with specific requirements and parameters
   */
  async customizeTemplate(
    template: WorkflowTemplate,
    customization: TemplateCustomization[],
  ): Promise<CustomizedWorkflowTemplate> {
    const customizedTemplate = JSON.parse(
      JSON.stringify(template),
    ) as WorkflowTemplate;

    // Apply customizations
    for (const custom of customization) {
      this.applyCustomization(customizedTemplate, custom);
    }

    // Generate final configuration
    const finalConfiguration: WorkflowConfiguration = {
      ...template.configuration,
      processType: customizedTemplate.processType,
    } as WorkflowConfiguration;

    // Validate customizations
    const validationResults = [
      await this.validateTemplateConfiguration(customizedTemplate),
    ];

    // Calculate execution time estimate
    const estimatedExecutionTime = this.estimateExecutionTime(
      customizedTemplate,
      customization,
    );

    // Calculate confidence in customization
    const confidence = this.calculateCustomizationConfidence(
      customizedTemplate,
      customization,
    );

    return {
      confidence,
      customizations: customization,
      estimatedExecutionTime,
      finalConfiguration,
      template: customizedTemplate,
      validationResults,
    };
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): undefined | WorkflowTemplate {
    return this.templates.get(templateId);
  }

  /**
   * Load all available workflow templates
   */
  async loadAvailableTemplates(): Promise<WorkflowTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Remove template
   */
  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Select optimal template based on requirement analysis
   */
  async selectTemplateForRequirements(
    requirements: RequirementAnalysis,
  ): Promise<TemplateRecommendation> {
    const availableTemplates = await this.loadAvailableTemplates();

    let bestTemplate: null | WorkflowTemplate = null;
    let bestScore = 0;
    const matchReasons: string[] = [];

    for (const template of availableTemplates) {
      const score = this.calculateTemplateMatch(template, requirements);

      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    if (!bestTemplate) {
      // Fallback to custom template
      bestTemplate = this.getCustomTemplate();
      bestScore = 0.6;
      matchReasons.push("No specific template matched, using custom template");
    } else {
      matchReasons.push(...this.getMatchReasons(bestTemplate, requirements));
    }

    const customizations = this.generateCustomizations(
      bestTemplate,
      requirements,
    );
    const alternatives = this.getAlternativeTemplates(
      bestTemplate,
      requirements,
      availableTemplates,
    );

    return {
      alternatives,
      confidence: bestScore,
      customizations,
      estimatedSuccess: this.estimateSuccessProbability(
        bestTemplate,
        requirements,
      ),
      matchReasons,
      template: bestTemplate,
    };
  }

  /**
   * Validate template configuration and customizations
   */
  async validateTemplateConfiguration(
    template: WorkflowTemplate,
  ): Promise<TemplateValidationResult> {
    const issues: Array<{
      message: string;
      parameter?: string;
      recommendation?: string;
      severity: "error" | "info" | "warning";
      stage?: string;
    }> = [];

    let score = 1.0;
    const metRequirements: string[] = [];
    const missingRequirements: string[] = [];
    const optionalRequirements: string[] = [];

    // Validate template structure
    if (!template.name) {
      issues.push({
        message: "Template name is required",
        recommendation: "Provide a descriptive template name",
        severity: "error",
      });
      score -= 0.2;
    }

    if (template.stages.length === 0) {
      issues.push({
        message: "Template must have at least one stage",
        recommendation: "Add required workflow stages",
        severity: "error",
      });
      score -= 0.3;
    }

    // Validate stages
    for (const stage of template.stages) {
      if (!stage.stage) {
        issues.push({
          message: "Stage name is required",
          recommendation: "Provide stage name",
          severity: "error",
          stage: stage.stage,
        });
        score -= 0.1;
      }

      if (stage.required) {
        metRequirements.push(stage.stage);
      } else {
        optionalRequirements.push(stage.stage);
      }

      // Validate stage dependencies
      for (const dep of stage.dependencies) {
        const depExists = template.stages.some((s) => s.stage === dep);
        if (!depExists) {
          issues.push({
            message: `Stage dependency not found: ${dep}`,
            recommendation: `Add ${dep} stage or remove dependency`,
            severity: "error",
            stage: stage.stage,
          });
          score -= 0.1;
        }
      }
    }

    // Validate parameters
    for (const param of template.parameters) {
      if (param.required && param.defaultValue === undefined) {
        missingRequirements.push(param.name);
      } else {
        metRequirements.push(param.name);
      }

      // Validate parameter constraints
      if (param.constraints) {
        const valid = this.validateParameterConstraints(param);
        if (!valid) {
          issues.push({
            message: `Parameter constraints may be invalid: ${param.name}`,
            parameter: param.name,
            recommendation: "Review parameter constraints",
            severity: "warning",
          });
          score -= 0.05;
        }
      }
    }

    // Check AO patterns compliance
    let bestPracticesCompliance = 1.0;
    if (template.aoPatterns.length === 0) {
      issues.push({
        message: "No AO patterns specified",
        recommendation:
          "Consider adding relevant AO patterns for better compliance",
        severity: "warning",
      });
      bestPracticesCompliance -= 0.2;
    }

    // Check documentation completeness
    if (!template.documentation.overview) {
      issues.push({
        message: "Template documentation overview is missing",
        recommendation: "Add comprehensive documentation overview",
        severity: "info",
      });
      score -= 0.05;
    }

    return {
      bestPracticesCompliance,
      issues,
      isValid:
        score > 0.5 &&
        issues.filter((i) => i.severity === "error").length === 0,
      requirements: {
        met: metRequirements,
        missing: missingRequirements,
        optional: optionalRequirements,
      },
      score,
    };
  }

  /**
   * Apply customization to template
   */
  private applyCustomization(
    template: WorkflowTemplate,
    customization: TemplateCustomization,
  ): void {
    const param = template.parameters.find(
      (p) => p.name === customization.parameterId,
    );
    if (param) {
      param.defaultValue = customization.value;
    }
  }

  /**
   * Calculate confidence in customization
   */
  private calculateCustomizationConfidence(
    template: WorkflowTemplate,
    customizations: TemplateCustomization[],
  ): number {
    let confidence = 0.8; // Base confidence

    const userCustomizations = customizations.filter(
      (c) => c.source === "requirements",
    );
    confidence += userCustomizations.length * 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate template match score based on requirements
   */
  private calculateTemplateMatch(
    template: WorkflowTemplate,
    requirements: RequirementAnalysis,
  ): number {
    let score = 0;

    // Process type matching
    // Convert types for comparison
    const reqProcessType = this.mapProcessTypeToWorkflowType(
      requirements.processType,
    );
    if (reqProcessType && template.processType === reqProcessType) {
      score += 0.4;
    }

    // Pattern matching
    const matchingPatterns = template.aoPatterns.filter((pattern) =>
      requirements.detectedPatterns.includes(pattern as any),
    );
    score +=
      (matchingPatterns.length / Math.max(template.aoPatterns.length, 1)) * 0.3;

    // Complexity matching
    if (template.complexity === requirements.complexity) {
      score += 0.2;
    }

    // Keyword matching
    const templateKeywords = [
      template.name.toLowerCase(),
      template.description.toLowerCase(),
      ...template.documentation.useCases.map((uc) => uc.toLowerCase()),
    ].join(" ");

    const matchingKeywords = requirements.extractedKeywords.filter((keyword) =>
      templateKeywords.includes(keyword.toLowerCase()),
    );

    score +=
      (matchingKeywords.length /
        Math.max(requirements.extractedKeywords.length, 1)) *
      0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Helper method to create bot template
   */
  private createBotTemplate(): WorkflowTemplate {
    return {
      aoPatterns: ["handler", "message-routing"],
      category: "bot",
      complexity: "moderate",
      configuration: {
        enableTemplateMode: true,
        includeArchitectureAnalysis: false,
        mode: "guided",
      },
      description:
        "AO bot process with message handling and automated responses",
      documentation: {
        bestPractices: [
          "Implement proper error handling",
          "Use efficient message processing",
        ],
        examples: ["FAQ bot", "Task reminder bot"],
        overview: "Standard AO bot process with automated message handling",
        useCases: [
          "Automated responses",
          "Task automation",
          "Information bots",
        ],
      },
      estimatedTime: 100000,
      metadata: { author: "system", created: new Date() },
      name: "Standard Bot Process",
      parameters: [
        {
          description: "Name of the bot",
          name: "botName",
          required: true,
          type: "string",
        },
        {
          constraints: { max: 10000, min: 0 },
          defaultValue: 1000,
          description: "Response delay in milliseconds",
          name: "responseDelay",
          required: false,
          type: "number",
        },
      ],
      processType: "bot",
      stages: [
        {
          defaultTools: ["RequirementAnalysisService"],
          dependencies: [],
          documentation: "Analyze bot requirements and behavior",
          expectedOutputType: "RequirementAnalysis",
          parameters: {},
          required: true,
          stage: "requirement-analysis",
          validationRules: ["botPurposeRequired"],
        },
        {
          defaultTools: ["PermawebDocsService"],
          dependencies: ["requirement-analysis"],
          documentation: "Query AO bot patterns and examples",
          expectedOutputType: "PermawebDocsResult[]",
          parameters: { domains: ["ao"] },
          required: true,
          stage: "documentation-query",
          validationRules: ["botPatternsFound"],
        },
        {
          defaultTools: ["LuaCodeGeneratorService"],
          dependencies: ["documentation-query"],
          documentation: "Generate bot process code with handlers",
          expectedOutputType: "LuaCodeResult",
          parameters: { includeExplanation: true },
          required: true,
          stage: "code-generation",
          validationRules: ["validLuaCode", "botHandlersPresent"],
        },
        {
          defaultTools: ["GuidedProcessCreationService"],
          dependencies: ["code-generation"],
          documentation: "Create and deploy bot process",
          expectedOutputType: "GuidedProcessResult",
          parameters: { validateCode: true },
          required: true,
          stage: "process-creation",
          validationRules: ["processCreated", "botActive"],
        },
      ],
      templateId: "bot-standard",
      version: "1.0",
    };
  }

  /**
   * Helper method to create custom template
   */
  private createCustomTemplate(): WorkflowTemplate {
    return {
      aoPatterns: ["handler"],
      category: "custom",
      complexity: "moderate",
      configuration: {
        enableTemplateMode: true,
        includeArchitectureAnalysis: true,
        mode: "autonomous",
      },
      description: "Flexible AO process template for custom requirements",
      documentation: {
        bestPractices: [
          "Follow AO patterns",
          "Implement proper error handling",
        ],
        examples: ["Custom workflow", "Experimental process"],
        overview: "Flexible custom process template",
        useCases: [
          "Custom business logic",
          "Experimental processes",
          "Unique requirements",
        ],
      },
      estimatedTime: 150000,
      metadata: { author: "system", created: new Date() },
      name: "Custom Flexible Process",
      parameters: [],
      processType: "custom",
      stages: [
        {
          defaultTools: ["RequirementAnalysisService"],
          dependencies: [],
          documentation: "Analyze custom requirements",
          expectedOutputType: "RequirementAnalysis",
          parameters: {},
          required: true,
          stage: "requirement-analysis",
          validationRules: [],
        },
        {
          defaultTools: ["PermawebDocsService"],
          dependencies: ["requirement-analysis"],
          documentation: "Query relevant documentation",
          expectedOutputType: "PermawebDocsResult[]",
          parameters: { domains: ["ao", "arweave", "ario"] },
          required: true,
          stage: "documentation-query",
          validationRules: [],
        },
        {
          defaultTools: ["LuaCodeGeneratorService"],
          dependencies: ["documentation-query"],
          documentation: "Generate custom process code",
          expectedOutputType: "LuaCodeResult",
          parameters: { includeExplanation: true },
          required: true,
          stage: "code-generation",
          validationRules: ["validLuaCode"],
        },
        {
          defaultTools: ["GuidedProcessCreationService"],
          dependencies: ["code-generation"],
          documentation: "Create and deploy process",
          expectedOutputType: "GuidedProcessResult",
          parameters: { validateCode: true },
          required: true,
          stage: "process-creation",
          validationRules: ["processCreated"],
        },
      ],
      templateId: "custom-flexible",
      version: "1.0",
    };
  }

  /**
   * Helper method to create game template
   */
  private createGameTemplate(): WorkflowTemplate {
    return {
      aoPatterns: ["state-management", "handler", "process-communication"],
      category: "game",
      complexity: "complex",
      configuration: {
        enableTemplateMode: true,
        includeArchitectureAnalysis: true,
        mode: "guided",
      },
      description:
        "AO game process with state management and player interactions",
      documentation: {
        bestPractices: [
          "Implement proper state management",
          "Handle player validation",
        ],
        examples: ["Tic-tac-toe", "Rock-paper-scissors"],
        overview: "Standard AO game process with state management",
        useCases: ["Turn-based games", "Real-time games", "Strategy games"],
      },
      estimatedTime: 180000,
      metadata: { author: "system", created: new Date() },
      name: "Standard Game Process",
      parameters: [
        {
          description: "Name of the game",
          name: "gameName",
          required: true,
          type: "string",
        },
        {
          constraints: { max: 100, min: 1 },
          defaultValue: 10,
          description: "Maximum number of players",
          name: "maxPlayers",
          required: false,
          type: "number",
        },
      ],
      processType: "game",
      stages: [
        {
          defaultTools: ["RequirementAnalysisService"],
          dependencies: [],
          documentation: "Analyze game requirements and mechanics",
          expectedOutputType: "RequirementAnalysis",
          parameters: {},
          required: true,
          stage: "requirement-analysis",
          validationRules: ["gameTypeRequired"],
        },
        {
          defaultTools: ["ArchitectureDecisionService"],
          dependencies: ["requirement-analysis"],
          documentation: "Analyze game architecture and state management",
          expectedOutputType: "ArchitectureAnalysisResult",
          parameters: {},
          required: true,
          stage: "architecture-analysis",
          validationRules: ["gameArchitectureValid"],
        },
        {
          defaultTools: ["PermawebDocsService"],
          dependencies: ["architecture-analysis"],
          documentation: "Query AO game patterns and examples",
          expectedOutputType: "PermawebDocsResult[]",
          parameters: { domains: ["ao"] },
          required: true,
          stage: "documentation-query",
          validationRules: ["gamePatternsFound"],
        },
        {
          defaultTools: ["LuaCodeGeneratorService"],
          dependencies: ["documentation-query"],
          documentation: "Generate game process code",
          expectedOutputType: "LuaCodeResult",
          parameters: { includeExplanation: true },
          required: true,
          stage: "code-generation",
          validationRules: ["validLuaCode", "gameHandlersPresent"],
        },
        {
          defaultTools: ["GuidedProcessCreationService"],
          dependencies: ["code-generation"],
          documentation: "Create and deploy game process",
          expectedOutputType: "GuidedProcessResult",
          parameters: { validateCode: true },
          required: true,
          stage: "process-creation",
          validationRules: ["processCreated", "gameActive"],
        },
      ],
      templateId: "game-standard",
      version: "1.0",
    };
  }

  /**
   * Estimate execution time with customizations
   */
  private estimateExecutionTime(
    template: WorkflowTemplate,
    customizations: TemplateCustomization[],
  ): number {
    let baseTime = template.estimatedTime;

    // Adjust based on complexity of customizations
    const complexCustomizations = customizations.filter(
      (c) => c.source === "requirements" || typeof c.value === "object",
    );

    baseTime *= 1 + complexCustomizations.length * 0.1;

    return Math.round(baseTime);
  }

  private estimateSuccessProbability(
    template: WorkflowTemplate,
    requirements: RequirementAnalysis,
  ): number {
    let probability = 0.7; // Base probability

    if (template.complexity === requirements.complexity) {
      probability += 0.1;
    }

    if (
      template.aoPatterns.some((pattern) =>
        requirements.detectedPatterns.includes(pattern as any),
      )
    ) {
      probability += 0.15;
    }

    return Math.min(probability, 0.95);
  }

  /**
   * Generate customizations based on requirements
   */
  private generateCustomizations(
    template: WorkflowTemplate,
    requirements: RequirementAnalysis,
  ): TemplateCustomization[] {
    const customizations: TemplateCustomization[] = [];

    // Extract potential parameter values from requirements
    const userRequest = requirements.userRequest.toLowerCase();

    for (const param of template.parameters) {
      let value: unknown = param.defaultValue;
      let reason = "Using default value";

      // Try to extract values from user request
      if (param.name.toLowerCase().includes("name")) {
        const nameMatch = userRequest.match(
          /(?:name|called)\s+["']?([^"'\s]+)["']?/i,
        );
        if (nameMatch) {
          value = nameMatch[1];
          reason = "Extracted from user request";
        }
      }

      if (param.name.toLowerCase().includes("supply")) {
        const supplyMatch = userRequest.match(/(?:supply|amount)\s+(\d+)/i);
        if (supplyMatch) {
          value = parseInt(supplyMatch[1]);
          reason = "Extracted from user request";
        }
      }

      customizations.push({
        parameterId: param.name,
        reason,
        source: value !== param.defaultValue ? "requirements" : "system",
        value,
      });
    }

    return customizations;
  }

  private getAlternativeReason(
    alternative: WorkflowTemplate,
    selected: WorkflowTemplate,
  ): string {
    if (alternative.complexity !== selected.complexity) {
      return `Different complexity level: ${alternative.complexity}`;
    }
    if (alternative.processType !== selected.processType) {
      return `Different process type: ${alternative.processType}`;
    }
    return `Alternative ${alternative.category} template`;
  }

  /**
   * Get alternative template recommendations
   */
  private getAlternativeTemplates(
    selectedTemplate: WorkflowTemplate,
    requirements: RequirementAnalysis,
    allTemplates: WorkflowTemplate[],
  ): TemplateRecommendation["alternatives"] {
    return allTemplates
      .filter((t) => t.templateId !== selectedTemplate.templateId)
      .map((template) => ({
        confidence: this.calculateTemplateMatch(template, requirements),
        reason: this.getAlternativeReason(template, selectedTemplate),
        template,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Top 3 alternatives
  }

  private getCustomTemplate(): WorkflowTemplate {
    return this.templates.get("custom-flexible")!;
  }

  /**
   * Get match reasons for template selection
   */
  private getMatchReasons(
    template: WorkflowTemplate,
    requirements: RequirementAnalysis,
  ): string[] {
    const reasons: string[] = [];

    const reqProcessType = this.mapProcessTypeToWorkflowType(
      requirements.processType,
    );
    if (reqProcessType && template.processType === reqProcessType) {
      reasons.push(`Matches process type: ${requirements.processType}`);
    }

    const matchingPatterns = template.aoPatterns.filter((pattern) =>
      requirements.detectedPatterns.includes(pattern as any),
    );
    if (matchingPatterns.length > 0) {
      reasons.push(`Matches AO patterns: ${matchingPatterns.join(", ")}`);
    }

    if (template.complexity === requirements.complexity) {
      reasons.push(`Matches complexity level: ${requirements.complexity}`);
    }

    return reasons;
  }

  /**
   * Initialize standard workflow templates
   */
  private initializeStandardTemplates(): void {
    // Token Template
    this.addTemplate({
      aoPatterns: ["token-contract", "handler", "state-management"],
      category: "token",
      complexity: "moderate",
      configuration: {
        enableTemplateMode: true,
        includeArchitectureAnalysis: true,
        mode: "guided",
      },
      description:
        "AO token process with minting, transferring, and balance tracking",
      documentation: {
        bestPractices: [
          "Use standard AO token patterns",
          "Implement proper balance tracking",
          "Include transfer validation",
        ],
        examples: ["Basic ERC-20 style token", "Reward distribution token"],
        overview:
          "Standard AO token process implementing common token patterns",
        useCases: ["Fungible tokens", "Reward tokens", "Utility tokens"],
      },
      estimatedTime: 120000, // 2 minutes
      metadata: {
        author: "system",
        created: new Date(),
        tags: ["token", "standard", "ao"],
      },
      name: "Standard Token Process",
      parameters: [
        {
          constraints: { pattern: "^[A-Za-z][A-Za-z0-9 ]*$" },
          description: "Name of the token",
          name: "tokenName",
          required: true,
          type: "string",
        },
        {
          constraints: { pattern: "^[A-Z]{3,5}$" },
          description: "Token symbol (3-5 characters)",
          name: "tokenSymbol",
          required: true,
          type: "string",
        },
        {
          constraints: { max: 1000000000, min: 1 },
          description: "Initial token supply",
          name: "initialSupply",
          required: true,
          type: "number",
        },
        {
          constraints: { max: 18, min: 0 },
          defaultValue: 18,
          description: "Token decimal places",
          name: "decimals",
          required: false,
          type: "number",
        },
      ],
      processType: "token",
      stages: [
        {
          defaultTools: ["RequirementAnalysisService"],
          dependencies: [],
          documentation:
            "Analyze token requirements including name, symbol, and initial supply",
          expectedOutputType: "RequirementAnalysis",
          parameters: {},
          required: true,
          stage: "requirement-analysis",
          validationRules: ["tokenNameRequired", "initialSupplyRequired"],
        },
        {
          defaultTools: ["PermawebDocsService"],
          dependencies: ["requirement-analysis"],
          documentation: "Query AO token documentation and patterns",
          expectedOutputType: "PermawebDocsResult[]",
          parameters: { domains: ["ao", "arweave"] },
          required: true,
          stage: "documentation-query",
          validationRules: ["tokenPatternsFound"],
        },
        {
          defaultTools: ["LuaCodeGeneratorService"],
          dependencies: ["documentation-query"],
          documentation: "Generate token process code with handlers",
          expectedOutputType: "LuaCodeResult",
          parameters: { includeExplanation: true },
          required: true,
          stage: "code-generation",
          validationRules: ["validLuaCode", "tokenHandlersPresent"],
        },
        {
          defaultTools: ["GuidedProcessCreationService"],
          dependencies: ["code-generation"],
          documentation: "Create and deploy token process",
          expectedOutputType: "GuidedProcessResult",
          parameters: { validateCode: true },
          required: true,
          stage: "process-creation",
          validationRules: ["processCreated", "tokenDeployed"],
        },
      ],
      templateId: "token-standard",
      version: "1.0",
    });

    // Chatroom Template
    this.addTemplate({
      aoPatterns: ["message-routing", "handler", "process-communication"],
      category: "chatroom",
      complexity: "simple",
      configuration: {
        enableTemplateMode: true,
        includeArchitectureAnalysis: false,
        mode: "guided",
      },
      description:
        "AO chatroom process with message broadcasting and user management",
      documentation: {
        bestPractices: [
          "Implement message validation",
          "Use efficient broadcasting",
          "Handle user management properly",
        ],
        examples: ["Public community chat", "Private group discussion"],
        overview: "Standard AO chatroom process with message broadcasting",
        useCases: [
          "Public chatrooms",
          "Private group chat",
          "Community forums",
        ],
      },
      estimatedTime: 90000, // 1.5 minutes
      metadata: {
        author: "system",
        created: new Date(),
        tags: ["chatroom", "messaging", "ao"],
      },
      name: "Standard Chatroom Process",
      parameters: [
        {
          description: "Name of the chatroom",
          name: "chatroomName",
          required: true,
          type: "string",
        },
        {
          constraints: { max: 1000, min: 1 },
          defaultValue: 100,
          description: "Maximum number of users",
          name: "maxUsers",
          required: false,
          type: "number",
        },
        {
          defaultValue: false,
          description: "Whether chatroom is private",
          name: "isPrivate",
          required: false,
          type: "boolean",
        },
      ],
      processType: "chatroom",
      stages: [
        {
          defaultTools: ["RequirementAnalysisService"],
          dependencies: [],
          documentation: "Analyze chatroom requirements",
          expectedOutputType: "RequirementAnalysis",
          parameters: {},
          required: true,
          stage: "requirement-analysis",
          validationRules: ["chatroomNameRequired"],
        },
        {
          defaultTools: ["PermawebDocsService"],
          dependencies: ["requirement-analysis"],
          documentation: "Query AO chatroom patterns",
          expectedOutputType: "PermawebDocsResult[]",
          parameters: { domains: ["ao"] },
          required: true,
          stage: "documentation-query",
          validationRules: ["chatroomPatternsFound"],
        },
        {
          defaultTools: ["LuaCodeGeneratorService"],
          dependencies: ["documentation-query"],
          documentation: "Generate chatroom process code",
          expectedOutputType: "LuaCodeResult",
          parameters: { includeExplanation: true },
          required: true,
          stage: "code-generation",
          validationRules: ["validLuaCode", "messageHandlersPresent"],
        },
        {
          defaultTools: ["GuidedProcessCreationService"],
          dependencies: ["code-generation"],
          documentation: "Create and deploy chatroom process",
          expectedOutputType: "GuidedProcessResult",
          parameters: { validateCode: true },
          required: true,
          stage: "process-creation",
          validationRules: ["processCreated", "chatroomActive"],
        },
      ],
      templateId: "chatroom-standard",
      version: "1.0",
    });

    // Add more templates (bot, game, custom)...
    this.addTemplate(this.createBotTemplate());
    this.addTemplate(this.createGameTemplate());
    this.addTemplate(this.createCustomTemplate());
  }

  /**
   * Map ProcessType to WorkflowProcessType
   */
  private mapProcessTypeToWorkflowType(
    processType: string,
  ): undefined | WorkflowProcessType {
    switch (processType) {
      case "multi-process":
        return "bot"; // Multi-process could map to bot or game, defaulting to bot
      case "stateful":
      case "stateless":
        return "custom";
      default:
        return processType as WorkflowProcessType;
    }
  }

  private validateParameterConstraints(param: TemplateParameter): boolean {
    if (!param.constraints) return true;

    const constraints = param.constraints;

    if (constraints.min !== undefined && constraints.max !== undefined) {
      return constraints.min <= constraints.max;
    }

    if (constraints.pattern) {
      try {
        new RegExp(constraints.pattern);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }
}
