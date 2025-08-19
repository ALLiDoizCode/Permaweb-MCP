import { JWKInterface } from "arweave/node/lib/wallet.js";

import { evalProcess } from "../relay.js";
import {
  HandlerDefinition,
  ProcessCodeResult,
  ValidationResult,
} from "../types/guided-process.js";
import { processCommunicationService } from "./ProcessCommunicationService.js";

/**
 * Service for validating AO process deployments and testing functionality.
 *
 * This service provides comprehensive validation capabilities:
 * - Handler registration testing
 * - Basic process responsiveness
 * - Handler functionality testing
 * - State validation
 */
export class ProcessValidationService {
  /**
   * Full deployment verification combining all validation methods
   */
  async performFullDeploymentVerification(
    keyPair: JWKInterface,
    processId: string,
    processCode: ProcessCodeResult,
  ): Promise<ValidationResult[]> {
    const allResults: ValidationResult[] = [];

    // Standard process validation
    const processResults = await this.validateProcess(
      keyPair,
      processId,
      processCode,
    );
    allResults.push(...processResults);

    // Message-based deployment verification
    const verificationResults = await this.verifyDeploymentWithMessages(
      keyPair,
      processId,
      processCode,
    );
    allResults.push(...verificationResults);

    // Health check
    const healthResults = await this.performHealthCheck(keyPair, processId);
    allResults.push(...healthResults);

    return allResults;
  }

  /**
   * Comprehensive process health check
   */
  async performHealthCheck(
    keyPair: JWKInterface,
    processId: string,
  ): Promise<ValidationResult[]> {
    const healthResults: ValidationResult[] = [];

    // Basic responsiveness
    const responsivenessResult = await this.validateResponsiveness(
      keyPair,
      processId,
    );
    healthResults.push(responsivenessResult);

    // State validation
    const stateResult = await this.validateState(keyPair, processId);
    healthResults.push(stateResult);

    // Performance check
    const performanceResult = await this.validatePerformance(
      keyPair,
      processId,
    );
    healthResults.push(performanceResult);

    return healthResults;
  }

  /**
   * Run custom test cases defined in process code
   */
  async runTestCases(
    keyPair: JWKInterface,
    processId: string,
    testCases: Array<{ description: string; testCode: string }>,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        const result = await evalProcess(keyPair, testCase.testCode, processId);

        // Consider test passed if it doesn't throw an error and returns a truthy result
        const passed = result !== null && result !== undefined && result !== "";

        results.push({
          passed,
          testCase: `custom_test_${i + 1}`,
          testResult: `${testCase.description}: ${result || "No result"}`,
        });
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : "Unknown error",
          passed: false,
          testCase: `custom_test_${i + 1}`,
        });
      }
    }

    return results;
  }

  /**
   * Validate specific handler functionality with mock messages
   */
  async validateHandlerFunctionality(
    keyPair: JWKInterface,
    processId: string,
    handler: HandlerDefinition,
    testMessage: any,
  ): Promise<ValidationResult> {
    try {
      const testCode = `
-- Test handler functionality with mock message
local testMsg = ${JSON.stringify(testMessage)}
local matchFunc = ${handler.matchCriteria}
local shouldMatch = matchFunc(testMsg)

if shouldMatch then
  -- Handler should process this message
  local handleFunc = ${handler.handleFunction}
  local success, result = pcall(handleFunc, testMsg)
  return "Handler test: match=" .. tostring(shouldMatch) .. ", success=" .. tostring(success) .. ", result=" .. tostring(result)
else
  return "Handler test: message does not match criteria"
end`;

      const result = await evalProcess(keyPair, testCode, processId);
      const testPassed = result && result.includes("success=true");

      return {
        passed: testPassed,
        testCase: `handler_functionality_${handler.name}`,
        testResult: result || "No test result",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: `handler_functionality_${handler.name}`,
      };
    }
  }

  /**
   * Validate handler registration and basic functionality
   */
  async validateHandlers(
    keyPair: JWKInterface,
    processId: string,
    handlers: HandlerDefinition[],
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const handler of handlers) {
      try {
        // Test 1: Check if handler is registered
        const registrationTestCode = `
-- Check if handler is registered
local handlerFound = false
for _, h in ipairs(Handlers.list) do
  if h.name == "${handler.name}" then
    handlerFound = true
    break
  end
end
return handlerFound`;

        const registrationResult = await evalProcess(
          keyPair,
          registrationTestCode,
          processId,
        );
        const isRegistered =
          registrationResult === "true" || registrationResult === true;

        results.push({
          passed: isRegistered,
          testCase: `handler_registration_${handler.name}`,
          testResult: `Handler ${handler.name} ${isRegistered ? "registered successfully" : "not found in handler list"}`,
        });

        // Test 2: Check handler match criteria syntax
        if (isRegistered) {
          const matchTestCode = `
-- Test match criteria syntax
local success, result = pcall(function()
  local testMsg = { Action = "Test" }
  local matchFunc = ${handler.matchCriteria}
  return type(matchFunc) == "function"
end)
return success`;

          const matchResult = await evalProcess(
            keyPair,
            matchTestCode,
            processId,
          );
          const validMatch = matchResult === "true" || matchResult === true;

          results.push({
            passed: validMatch,
            testCase: `handler_match_${handler.name}`,
            testResult: `Handler ${handler.name} match criteria ${validMatch ? "valid" : "has syntax errors"}`,
          });
        }
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : "Unknown error",
          passed: false,
          testCase: `handler_validation_error_${handler.name}`,
        });
      }
    }

    return results;
  }

  /**
   * Validate process memory usage and performance
   */
  async validatePerformance(
    keyPair: JWKInterface,
    processId: string,
  ): Promise<ValidationResult> {
    try {
      const testCode = `
-- Basic performance check
local memoryUsage = collectgarbage("count")
local handlerCount = #Handlers.list
return "Memory: " .. memoryUsage .. "KB, Handlers: " .. handlerCount`;

      const result = await evalProcess(keyPair, testCode, processId);

      // Simple heuristic: consider performance good if memory usage is reasonable
      const memoryMatch = result?.match(/Memory: ([\d.]+)/);
      const memoryUsage = memoryMatch ? parseFloat(memoryMatch[1]) : 0;
      const performanceGood = memoryUsage < 1000; // Less than 1MB

      return {
        passed: performanceGood,
        testCase: "performance_check",
        testResult: result || "No performance data",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "performance_check",
      };
    }
  }

  /**
   * Validate complete process deployment
   */
  async validateProcess(
    keyPair: JWKInterface,
    processId: string,
    processCode: ProcessCodeResult,
  ): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];

    // Validate handler registration
    const handlerResults = await this.validateHandlers(
      keyPair,
      processId,
      processCode.processStructure.handlers,
    );
    validationResults.push(...handlerResults);

    // Validate basic process responsiveness
    const responsivenessResult = await this.validateResponsiveness(
      keyPair,
      processId,
    );
    validationResults.push(responsivenessResult);

    // Validate state initialization
    const stateResult = await this.validateState(keyPair, processId);
    validationResults.push(stateResult);

    // Run custom test cases if provided
    if (processCode.testCases && processCode.testCases.length > 0) {
      const testCaseResults = await this.runTestCases(
        keyPair,
        processId,
        processCode.testCases,
      );
      validationResults.push(...testCaseResults);
    }

    return validationResults;
  }

  /**
   * Validate basic process responsiveness
   */
  async validateResponsiveness(
    keyPair: JWKInterface,
    processId: string,
  ): Promise<ValidationResult> {
    try {
      const testCode = `
-- Basic responsiveness test
local startTime = os.time and os.time() or 0
return "Process is responsive at time " .. startTime`;

      const result = await evalProcess(keyPair, testCode, processId);
      const isResponsive = result && result.includes("Process is responsive");

      return {
        passed: isResponsive,
        testCase: "basic_responsiveness",
        testResult: `Process response: ${result || "No response"}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "basic_responsiveness",
      };
    }
  }

  /**
   * Validate process state initialization
   */
  async validateState(
    keyPair: JWKInterface,
    processId: string,
  ): Promise<ValidationResult> {
    try {
      const testCode = `
-- Check if State is initialized
local stateExists = State ~= nil
local stateType = type(State)
return "State exists: " .. tostring(stateExists) .. ", Type: " .. stateType`;

      const result = await evalProcess(keyPair, testCode, processId);
      const stateInitialized = result && result.includes("State exists: true");

      return {
        passed: stateInitialized,
        testCase: "state_initialization",
        testResult: result || "No state information",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "state_initialization",
      };
    }
  }

  /**
   * Verify deployment using message-based communication tests
   * This integrates ExecuteActionCommand functionality for real message testing
   */
  async verifyDeploymentWithMessages(
    keyPair: JWKInterface,
    processId: string,
    processCode: ProcessCodeResult,
  ): Promise<ValidationResult[]> {
    const verificationResults: ValidationResult[] = [];

    try {
      // Generate process documentation for communication
      const processMarkdown = this.generateProcessMarkdown(processCode);

      // Test basic process info request
      const infoResult = await this.testProcessInfo(
        keyPair,
        processId,
        processMarkdown,
      );
      verificationResults.push(infoResult);

      // Test template-specific functionality
      const templateResults = await this.testTemplateSpecificFunctionality(
        keyPair,
        processId,
        processCode,
        processMarkdown,
      );
      verificationResults.push(...templateResults);

      return verificationResults;
    } catch (error) {
      return [
        {
          error: error instanceof Error ? error.message : "Unknown error",
          passed: false,
          testCase: "deployment_verification_error",
        },
      ];
    }
  }

  /**
   * Generate process documentation in markdown format for communication testing
   */
  private generateProcessMarkdown(processCode: ProcessCodeResult): string {
    let markdown = `# Generated AO Process

Process generated from template: ${processCode.templateUsed}

## Handlers

`;

    for (const handler of processCode.processStructure.handlers) {
      markdown += `### ${handler.name}

Handler for processing messages with specific criteria.

**Match Criteria:** ${handler.matchCriteria}

`;
    }

    return markdown;
  }

  /**
   * Test basic ping functionality for custom processes
   */
  private async testBasicPingFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Send a ping message",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "basic_ping_test",
        testResult: success
          ? "Basic ping functionality successful"
          : `Basic functionality test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "basic_ping_test",
      };
    }
  }

  /**
   * Test bot process functionality
   */
  private async testBotFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Execute help command",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "bot_command_test",
        testResult: success
          ? "Bot command functionality successful"
          : `Bot functionality test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "bot_command_test",
      };
    }
  }

  /**
   * Test chatroom process functionality
   */
  private async testChatroomFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Join the chatroom with username TestUser",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "chatroom_join_test",
        testResult: success
          ? "Chatroom join functionality successful"
          : `Chatroom functionality test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "chatroom_join_test",
      };
    }
  }

  /**
   * Test game process functionality
   */
  private async testGameFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Join the game as Player1",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "game_join_test",
        testResult: success
          ? "Game join functionality successful"
          : `Game functionality test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "game_join_test",
      };
    }
  }

  /**
   * Test basic process info functionality
   */
  private async testProcessInfo(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      // Send an Info request to test basic responsiveness
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Get process information",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "process_info_message_test",
        testResult: success
          ? "Process responded successfully to info request"
          : `Process info test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "process_info_message_test",
      };
    }
  }

  /**
   * Test template-specific functionality using message communication
   */
  private async testTemplateSpecificFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processCode: ProcessCodeResult,
    processMarkdown: string,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    switch (processCode.templateUsed) {
      case "bot":
        results.push(
          await this.testBotFunctionality(keyPair, processId, processMarkdown),
        );
        break;

      case "chatroom":
        results.push(
          await this.testChatroomFunctionality(
            keyPair,
            processId,
            processMarkdown,
          ),
        );
        break;

      case "game":
        results.push(
          await this.testGameFunctionality(keyPair, processId, processMarkdown),
        );
        break;

      case "token":
        results.push(
          await this.testTokenFunctionality(
            keyPair,
            processId,
            processMarkdown,
          ),
        );
        break;

      default:
        results.push(
          await this.testBasicPingFunctionality(
            keyPair,
            processId,
            processMarkdown,
          ),
        );
        break;
    }

    return results;
  }

  /**
   * Test token process functionality
   */
  private async testTokenFunctionality(
    keyPair: JWKInterface,
    processId: string,
    processMarkdown: string,
  ): Promise<ValidationResult> {
    try {
      const result = await processCommunicationService.executeSmartRequest(
        processId,
        "Check my token balance",
        keyPair,
        processMarkdown,
        undefined,
      );

      const success = result.success && !result.error;
      return {
        passed: success,
        testCase: "token_balance_test",
        testResult: success
          ? "Token balance query successful"
          : `Token functionality test failed: ${result.error}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        passed: false,
        testCase: "token_balance_test",
      };
    }
  }
}
