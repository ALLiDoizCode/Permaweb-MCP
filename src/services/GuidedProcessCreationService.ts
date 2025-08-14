import { JWKInterface } from "arweave/node/lib/wallet.js";

import { createProcess } from "../process.js";
import { evalProcess } from "../relay.js";
import {
  DeploymentResult,
  GuidedProcessCreation,
  GuidedProcessResult,
  HandlerDefinition,
  ProcessCodeResult,
  ProcessCreationResult,
  ProcessTemplate,
  ValidationResult,
} from "../types/guided-process.js";
import { RequirementAnalysis } from "../types/lua-workflow.js";
import { LuaWorkflowOrchestrationService } from "./LuaWorkflowOrchestrationService.js";
import { PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for guided process creation that integrates Story 7.1 components
 * with process creation and deployment capabilities.
 *
 * This service coordinates between:
 * - LuaWorkflowOrchestrationService for documentation-informed code generation
 * - Process creation functionality for spawning AO processes
 * - Process evaluation for code deployment and validation
 */
export class GuidedProcessCreationService implements GuidedProcessCreation {
  private readonly luaWorkflowService: LuaWorkflowOrchestrationService;

  constructor(luaWorkflowService?: LuaWorkflowOrchestrationService) {
    this.luaWorkflowService =
      luaWorkflowService ?? new LuaWorkflowOrchestrationService();
  }

  /**
   * Analyze user requirements using Story 7.1 requirement analysis
   */
  async analyzeRequirements(userRequest: string): Promise<RequirementAnalysis> {
    return await this.luaWorkflowService.analyzeRequirements(userRequest);
  }

  /**
   * Create guided process with full workflow (convenience method for tool commands)
   */
  async createGuidedProcess(
    keyPair: JWKInterface,
    userRequest: string,
  ): Promise<GuidedProcessResult> {
    try {
      // Step 1: Analyze requirements and get documentation
      const requirements = await this.analyzeRequirements(userRequest);
      const docs =
        await this.luaWorkflowService.queryRelevantDocs(requirements);

      // Step 2: Generate process code
      const processCode = await this.generateProcessCode(requirements, docs);

      // Step 3: Create process
      const processCreation = await this.createProcessInternal(keyPair);
      if (!processCreation.success || !processCreation.processId) {
        return {
          processCode,
          success: false,
        };
      }

      // Step 4: Deploy code
      const deploymentResult = await this.deployCodeInternal(
        keyPair,
        processCreation.processId,
        processCode,
      );

      // Step 5: Validate deployment
      const validationResults = await this.validateDeploymentInternal(
        keyPair,
        processCreation.processId,
        processCode.processStructure.handlers,
      );

      return {
        deploymentResult,
        processCode,
        processId: processCreation.processId,
        success: deploymentResult.success,
        validationResults,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during guided process creation";

      return {
        processCode: {
          bestPractices: [],
          deploymentInstructions: [],
          documentationSources: [],
          explanation: `Failed to generate process code: ${errorMessage}`,
          generatedCode: "",
          handlerPatterns: [],
          processStructure: {
            handlers: [],
            initializationCode: "",
            stateDefinition: "",
            utilityFunctions: [],
          },
          templateUsed: "custom" as const,
          testCases: [],
          usedTemplates: [],
        },
        success: false,
      };
    }
  }

  /**
   * Create a new AO process for deployment
   */
  async createProcess(): Promise<ProcessCreationResult> {
    // Note: This method signature matches the interface but requires keyPair
    // In actual usage, this will be called through the MCP tool command
    // which has access to the ToolContext containing the keyPair
    throw new Error(
      "createProcess requires keyPair - use through MCP tool command",
    );
  }

  /**
   * Create process with keyPair (internal method for use by tool commands)
   */
  async createProcessInternal(
    keyPair: JWKInterface,
  ): Promise<ProcessCreationResult> {
    try {
      const processId = await createProcess(keyPair);
      return {
        processId,
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  /**
   * Deploy generated code to AO process
   */
  async deployCode(
    processId: string,
    code: ProcessCodeResult,
  ): Promise<DeploymentResult> {
    // Note: This method signature matches the interface but requires keyPair
    // In actual usage, this will be called through the MCP tool command
    // which has access to the ToolContext containing the keyPair
    throw new Error(
      "deployCode requires keyPair - use through MCP tool command",
    );
  }

  /**
   * Deploy code with keyPair (internal method for use by tool commands)
   */
  async deployCodeInternal(
    keyPair: JWKInterface,
    processId: string,
    code: ProcessCodeResult,
  ): Promise<DeploymentResult> {
    try {
      // Deploy initialization code first
      if (code.processStructure.initializationCode) {
        await evalProcess(
          keyPair,
          code.processStructure.initializationCode,
          processId,
        );
      }

      // Deploy state definition
      if (code.processStructure.stateDefinition) {
        await evalProcess(
          keyPair,
          code.processStructure.stateDefinition,
          processId,
        );
      }

      // Deploy utility functions
      for (const utilityFunction of code.processStructure.utilityFunctions) {
        await evalProcess(keyPair, utilityFunction, processId);
      }

      // Deploy handlers
      for (const handler of code.processStructure.handlers) {
        const handlerCode = `
Handlers.add(
  "${handler.name}",
  ${handler.matchCriteria},
  ${handler.handleFunction}
)`;
        await evalProcess(keyPair, handlerCode, processId);
      }

      return {
        deployedHandlers: code.processStructure.handlers,
        processId,
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        deployedHandlers: [],
        error: error instanceof Error ? error.message : "Unknown error",
        processId,
        success: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Generate process code using Story 7.1 workflow with process-specific enhancements
   */
  async generateProcessCode(
    requirements: RequirementAnalysis,
    docs: PermawebDocsResult[],
  ): Promise<ProcessCodeResult> {
    // Use Story 7.1 code generation as base
    const baseCodeResult = await this.luaWorkflowService.generateLuaCode(
      docs,
      requirements,
    );

    // Enhance with process-specific structure
    const processStructure = this.extractProcessStructure(baseCodeResult);
    const templateUsed = this.determineTemplate(requirements);
    const testCases = this.generateTestCases(
      processStructure.handlers,
      templateUsed,
    );
    const deploymentInstructions =
      this.generateDeploymentInstructions(processStructure);

    return {
      ...baseCodeResult,
      deploymentInstructions,
      processStructure,
      templateUsed,
      testCases,
    };
  }

  /**
   * Validate deployment by testing handlers
   */
  async validateDeployment(
    processId: string,
    handlers: HandlerDefinition[],
  ): Promise<ValidationResult[]> {
    // Note: This method signature matches the interface but requires keyPair
    // In actual usage, this will be called through the MCP tool command
    // which has access to the ToolContext containing the keyPair
    throw new Error(
      "validateDeployment requires keyPair - use through MCP tool command",
    );
  }

  /**
   * Validate deployment with keyPair (internal method for use by tool commands)
   */
  async validateDeploymentInternal(
    keyPair: JWKInterface,
    processId: string,
    handlers: HandlerDefinition[],
  ): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];

    try {
      // Test each handler by checking if it's registered
      for (const handler of handlers) {
        try {
          const testCode = `
-- Check if handler is registered
local handlerFound = false
for _, h in ipairs(Handlers.list) do
  if h.name == "${handler.name}" then
    handlerFound = true
    break
  end
end
return handlerFound`;

          const result = await evalProcess(keyPair, testCode, processId);
          const handlerRegistered = result === "true" || result === true;

          validationResults.push({
            passed: handlerRegistered,
            testCase: `handler_registration_${handler.name}`,
            testResult: `Handler ${handler.name} ${handlerRegistered ? "registered successfully" : "not found"}`,
          });
        } catch (error) {
          validationResults.push({
            error: error instanceof Error ? error.message : "Unknown error",
            passed: false,
            testCase: `handler_validation_${handler.name}`,
          });
        }
      }

      // Test basic process functionality
      try {
        const basicTest = "return 'Process is responsive'";
        const result = await evalProcess(keyPair, basicTest, processId);

        validationResults.push({
          passed: result === "Process is responsive",
          testCase: "basic_responsiveness",
          testResult: `Process response: ${result}`,
        });
      } catch (error) {
        validationResults.push({
          error: error instanceof Error ? error.message : "Unknown error",
          passed: false,
          testCase: "basic_responsiveness",
        });
      }

      return validationResults;
    } catch (error) {
      return [
        {
          error: error instanceof Error ? error.message : "Unknown error",
          passed: false,
          testCase: "validation_framework_error",
        },
      ];
    }
  }

  /**
   * Determine template type based on requirements
   */
  private determineTemplate(requirements: RequirementAnalysis) {
    const patterns = requirements.detectedPatterns;
    const userRequest = requirements.userRequest.toLowerCase();

    if (patterns.includes("token-contract") || userRequest.includes("token")) {
      return "token" as const;
    }
    if (userRequest.includes("chat") || userRequest.includes("room")) {
      return "chatroom" as const;
    }
    if (userRequest.includes("bot") || userRequest.includes("agent")) {
      return "bot" as const;
    }
    if (userRequest.includes("game")) {
      return "game" as const;
    }

    return "custom" as const;
  }

  /**
   * Extract process structure from generated code
   */
  private extractProcessStructure(baseCode: { generatedCode?: string }) {
    // Parse the generated code to extract structure
    const handlers: HandlerDefinition[] = [];
    const generatedCode = baseCode.generatedCode || "";

    // Extract handlers using pattern matching
    const handlerMatches = generatedCode.matchAll(
      /Handlers\.add\(\s*"([^"]+)",\s*([^,]+),\s*(.+?)\)/gs,
    );

    for (const match of handlerMatches) {
      handlers.push({
        handleFunction: match[3].trim(),
        matchCriteria: match[2].trim(),
        name: match[1],
      });
    }

    // Extract initialization code (code before first handler)
    const firstHandlerIndex = generatedCode.indexOf("Handlers.add");
    const initializationCode =
      firstHandlerIndex > 0
        ? generatedCode.substring(0, firstHandlerIndex).trim()
        : "";

    return {
      handlers,
      initializationCode,
      stateDefinition: "local State = State or {}",
      utilityFunctions: [],
    };
  }

  /**
   * Generate deployment instructions
   */
  private generateDeploymentInstructions(processStructure: {
    handlers: HandlerDefinition[];
    initializationCode?: string;
    stateDefinition?: string;
    utilityFunctions: string[];
  }) {
    const instructions = [];

    if (processStructure.initializationCode) {
      instructions.push(
        "1. Deploy initialization code to set up process state",
      );
    }

    if (processStructure.stateDefinition) {
      instructions.push(
        "2. Deploy state definition to initialize process variables",
      );
    }

    if (processStructure.utilityFunctions.length > 0) {
      instructions.push("3. Deploy utility functions for process operations");
    }

    if (processStructure.handlers.length > 0) {
      instructions.push("4. Deploy message handlers for process communication");
    }

    instructions.push("5. Validate deployment by testing handler registration");

    return instructions;
  }

  /**
   * Generate test cases for handlers
   */
  private generateTestCases(
    handlers: HandlerDefinition[],
    templateUsed: ProcessTemplate,
  ) {
    const testCases = handlers.map((handler) => ({
      description: `Test ${handler.name} handler registration and basic functionality`,
      expectedBehavior: `Handler ${handler.name} should be registered and respond to matching messages`,
      testCode: `
-- Test handler registration
local handlerFound = false
for _, h in ipairs(Handlers.list) do
  if h.name == "${handler.name}" then
    handlerFound = true
    break
  end
end
assert(handlerFound, "Handler ${handler.name} not registered")`,
    }));

    // Add template-specific test cases
    if (templateUsed === "token") {
      testCases.push({
        description: `Test token state initialization`,
        expectedBehavior: `Token process should have proper state initialization`,
        testCode: `
-- Test token state initialization
assert(Balances ~= nil, "Balances table should be initialized")
assert(type(Balances) == "table", "Balances should be a table")`,
      });
    }

    return testCases;
  }
}
