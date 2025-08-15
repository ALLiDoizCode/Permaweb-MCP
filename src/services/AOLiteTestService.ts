import {
  AOLiteAssertion,
  AOLiteAssertionResult,
  AOLiteEnvironment,
  AOLiteMessageResult,
  AOLiteTestCase,
  AOLiteTestCaseResult,
  AOLiteTestConfiguration,
  AOLiteTestMessage,
  AOLiteTestResults,
  AOLiteTestSuite,
} from "../models/AOLiteTest.js";
import { TealProcessDefinition } from "../models/TealProcess.js";
import { AOMessageService } from "./AOMessageService.js";
import { ProcessCommunicationService } from "./ProcessCommunicationService.js";

export interface AOLiteTestService {
  createDefaultTestSuite(
    processDefinition: TealProcessDefinition,
  ): Promise<AOLiteTestSuite>;

  createTestEnvironment(
    processDefinition: TealProcessDefinition,
    configuration?: AOLiteTestConfiguration,
  ): Promise<AOLiteEnvironment>;

  executeTestCase(
    testCase: AOLiteTestCase,
    environment: AOLiteEnvironment,
  ): Promise<AOLiteTestCaseResult>;

  executeTestSuite(
    testSuite: AOLiteTestSuite,
    environment: AOLiteEnvironment,
  ): Promise<AOLiteTestResults>;

  generateAgentTestReport(
    testResults: AOLiteTestResults,
    format: "agent-detailed" | "agent-recommendations" | "agent-summary",
  ): Promise<string>;

  generateTestReport(
    testResults: AOLiteTestResults,
    format?: "html" | "json" | "markdown",
  ): Promise<string>;

  // Agent-friendly methods for enhanced integration
  generateTestSuiteFromLua(
    luaCode: string,
    processInfo: { id: string; name: string; version: string },
  ): Promise<AOLiteTestSuite>;

  interpretTestResults(testResults: AOLiteTestResults): Promise<{
    failures: Array<{
      reason: string;
      suggestions: string[];
      testCaseId: string;
    }>;
    nextSteps: string[];
    recommendations: string[];
    summary: {
      coveragePercentage: number;
      duration: number;
      failed: number;
      passed: number;
      total: number;
    };
  }>;

  simulateMessage(
    message: AOLiteTestMessage,
    environment: AOLiteEnvironment,
  ): Promise<AOLiteMessageResult>;

  validateAssertion(
    assertion: AOLiteAssertion,
    actualResult: any,
  ): Promise<AOLiteAssertionResult>;

  validateProcessBehavior(
    processId: string,
    messages: AOLiteTestMessage[],
    environment: AOLiteEnvironment,
  ): Promise<AOLiteTestResults>;

  validateTestCoverage(
    testSuite: AOLiteTestSuite,
    luaCode: string,
  ): Promise<{
    coveragePercentage: number;
    coveredHandlers: string[];
    suggestions: string[];
    uncoveredHandlers: string[];
  }>;
}

const service = (
  aoMessageService: AOMessageService,
  processService: ProcessCommunicationService,
): AOLiteTestService => {
  return {
    createDefaultTestSuite: async (
      processDefinition: TealProcessDefinition,
    ): Promise<AOLiteTestSuite> => {
      try {
        // Extract handlers from the process definition
        const handlers = extractHandlers(processDefinition.compiledLua);

        // Create test cases for each handler
        const testCases: AOLiteTestCase[] = handlers.map((handler, index) => ({
          assertions: [
            {
              expected: true,
              id: `assert-${handler.name}-${index}`,
              message: `${handler.name} should return output`,
              target: "Output",
              type: "exists",
            },
          ],
          description: `Test the ${handler.name} handler functionality`,
          id: `test-${handler.name}-${index}`,
          messages: [
            {
              action: handler.name,
              data: generateTestData(handler.name),
              id: `msg-${handler.name}-${index}`,
              tags: [{ name: "Action", value: handler.name }],
            },
          ],
          name: `Test ${handler.name} Handler`,
          timeout: 10000,
        }));

        return {
          configuration: {
            concurrent: false,
            coverage: true,
            timeout: 30000,
            verbose: true,
          },
          id: `test-suite-${processDefinition.id}`,
          name: `${processDefinition.name} Test Suite`,
          processId: processDefinition.id,
          setup: {
            initializeProcess: true,
            processSource: processDefinition.compiledLua,
          },
          teardown: {
            cleanupProcess: true,
            resetState: true,
          },
          testCases,
        };
      } catch (error) {
        throw new Error(
          `Failed to create default test suite: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    createTestEnvironment: async (
      processDefinition: TealProcessDefinition,
      configuration: AOLiteTestConfiguration = {},
    ): Promise<AOLiteEnvironment> => {
      try {
        // Create a local simulation environment
        const environment: AOLiteEnvironment = {
          configuration: {
            concurrent: configuration.concurrent || false,
            coverage: configuration.coverage || false,
            maxConcurrency: configuration.maxConcurrency || 1,
            retries: configuration.retries || 3,
            timeout: configuration.timeout || 30000,
            verbose: configuration.verbose || false,
          },
          isRunning: false,
          messageQueue: [],
          processId: processDefinition.id,
          processSource: processDefinition.compiledLua,
          state: initializeProcessState(processDefinition),
        };

        // Initialize the process environment
        await initializeEnvironment(environment);

        return environment;
      } catch (error) {
        throw new Error(
          `Failed to create test environment: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    executeTestCase: async (
      testCase: AOLiteTestCase,
      environment: AOLiteEnvironment,
    ): Promise<AOLiteTestCaseResult> => {
      const startTime = Date.now();
      const messageResults: AOLiteMessageResult[] = [];
      const assertionResults: AOLiteAssertionResult[] = [];

      try {
        // Ensure minimum duration for testing
        await new Promise((resolve) => setTimeout(resolve, 1));
        // Execute test messages
        for (const message of testCase.messages) {
          const messageResult = await service(
            aoMessageService,
            processService,
          ).simulateMessage(message, environment);
          messageResults.push(messageResult);

          // Stop if message failed and we're not continuing on error
          if (
            messageResult.status === "failed" &&
            !environment.configuration.concurrent
          ) {
            break;
          }
        }

        // Execute assertions
        for (const assertion of testCase.assertions) {
          const lastMessageResult = messageResults[messageResults.length - 1];
          const actualResult = lastMessageResult?.response || environment.state;

          const assertionResult = await service(
            aoMessageService,
            processService,
          ).validateAssertion(assertion, actualResult);
          assertionResults.push(assertionResult);
        }

        // Determine test case status
        const hasFailedMessages = messageResults.some(
          (m) => m.status === "failed",
        );
        const hasFailedAssertions = assertionResults.some(
          (a) => a.status === "failed",
        );
        const status =
          hasFailedMessages || hasFailedAssertions ? "failed" : "passed";

        return {
          assertionResults,
          duration: Date.now() - startTime,
          messageResults,
          status,
          testCaseId: testCase.id,
        };
      } catch (error) {
        return {
          assertionResults,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
          messageResults,
          status: "error",
          testCaseId: testCase.id,
        };
      }
    },

    executeTestSuite: async (
      testSuite: AOLiteTestSuite,
      environment: AOLiteEnvironment,
    ): Promise<AOLiteTestResults> => {
      const startTime = Date.now();
      const results: AOLiteTestCaseResult[] = [];

      try {
        // Ensure minimum duration for testing
        await new Promise((resolve) => setTimeout(resolve, 1));
        // Execute setup
        if (testSuite.setup) {
          await executeTestSetup(testSuite.setup, environment);
        }

        // Execute test cases
        if (testSuite.configuration.concurrent) {
          // Run tests concurrently
          const promises = testSuite.testCases.map((testCase) =>
            service(aoMessageService, processService).executeTestCase(
              testCase,
              environment,
            ),
          );

          const concurrentResults = await Promise.allSettled(promises);

          for (const result of concurrentResults) {
            if (result.status === "fulfilled") {
              results.push(result.value);
            } else {
              results.push({
                assertionResults: [],
                duration: 0,
                error: result.reason,
                messageResults: [],
                status: "error",
                testCaseId: "unknown",
              });
            }
          }
        } else {
          // Run tests sequentially
          for (const testCase of testSuite.testCases) {
            const result = await service(
              aoMessageService,
              processService,
            ).executeTestCase(testCase, environment);
            results.push(result);
          }
        }

        // Execute teardown
        if (testSuite.teardown) {
          await executeTestTeardown(testSuite.teardown, environment);
        }

        // Calculate results
        const totalTests = results.length;
        const passedTests = results.filter((r) => r.status === "passed").length;
        const failedTests = results.filter((r) => r.status === "failed").length;
        const erroredTests = results.filter((r) => r.status === "error").length;
        const duration = Date.now() - startTime;

        return {
          coverage: testSuite.configuration.coverage
            ? await calculateCoverage(testSuite, environment)
            : undefined,
          duration,
          erroredTests,
          failedTests,
          passedTests,
          results,
          status: failedTests > 0 || erroredTests > 0 ? "failed" : "passed",
          testSuiteId: testSuite.id,
          totalTests,
        };
      } catch (error) {
        return {
          duration: Date.now() - startTime,
          erroredTests: testSuite.testCases.length,
          failedTests: 0,
          passedTests: 0,
          results: [],
          status: "error",
          testSuiteId: testSuite.id,
          totalTests: testSuite.testCases.length,
        };
      }
    },

    generateAgentTestReport: async (
      testResults: AOLiteTestResults,
      format: "agent-detailed" | "agent-recommendations" | "agent-summary",
    ): Promise<string> => {
      try {
        const interpretation = await service(
          aoMessageService,
          processService,
        ).interpretTestResults(testResults);

        switch (format) {
          case "agent-detailed":
            return generateAgentDetailedReport(interpretation, testResults);

          case "agent-recommendations":
            return generateAgentRecommendationsReport(interpretation);

          case "agent-summary":
            return generateAgentSummaryReport(interpretation, testResults);

          default:
            throw new Error(`Unsupported agent report format: ${format}`);
        }
      } catch (error) {
        throw new Error(
          `Failed to generate agent test report: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    generateTestReport: async (
      testResults: AOLiteTestResults,
      format: "html" | "json" | "markdown" = "json",
    ): Promise<string> => {
      try {
        switch (format) {
          case "html":
            return generateHtmlReport(testResults);

          case "json":
            return JSON.stringify(testResults, null, 2);

          case "markdown":
            return generateMarkdownReport(testResults);

          default:
            throw new Error(`Unsupported report format: ${format}`);
        }
      } catch (error) {
        throw new Error(
          `Failed to generate test report: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    // Agent-friendly method implementations
    generateTestSuiteFromLua: async (
      luaCode: string,
      processInfo: { id: string; name: string; version: string },
    ): Promise<AOLiteTestSuite> => {
      try {
        // Create a TealProcessDefinition from the provided info
        const processDefinition: TealProcessDefinition = {
          compiledLua: luaCode,
          dependencies: [],
          id: processInfo.id,
          metadata: {
            aoVersion: "1.0.0",
            author: "agent-generated",
            compileOptions: {},
            description: `AOLite test suite for ${processInfo.name}`,
            version: processInfo.version,
          },
          name: processInfo.name,
          source: luaCode, // For testing purposes, use the same as compiled
          typeDefinitions: [],
          version: processInfo.version,
        };

        // Use existing createDefaultTestSuite method
        return await service(
          aoMessageService,
          processService,
        ).createDefaultTestSuite(processDefinition);
      } catch (error) {
        throw new Error(
          `Failed to generate test suite from Lua: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    interpretTestResults: async (
      testResults: AOLiteTestResults,
    ): Promise<{
      failures: Array<{
        reason: string;
        suggestions: string[];
        testCaseId: string;
      }>;
      nextSteps: string[];
      recommendations: string[];
      summary: {
        coveragePercentage: number;
        duration: number;
        failed: number;
        passed: number;
        total: number;
      };
    }> => {
      try {
        // Extract summary information
        const summary = {
          coveragePercentage: testResults.coverage?.coveragePercentage || 0,
          duration: testResults.duration,
          failed: testResults.failedTests,
          passed: testResults.passedTests,
          total: testResults.totalTests,
        };

        // Analyze failures and generate suggestions
        const failures = testResults.results
          .filter((result) => result.status === "failed")
          .map((result) => ({
            reason: result.error || "Test case failed",
            suggestions: generateFailureSuggestions(result),
            testCaseId: result.testCaseId,
          }));

        // Generate general recommendations
        const recommendations = generateRecommendations(testResults);

        // Generate next steps based on results
        const nextSteps = generateNextSteps(testResults, failures);

        return {
          failures,
          nextSteps,
          recommendations,
          summary,
        };
      } catch (error) {
        throw new Error(
          `Failed to interpret test results: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    simulateMessage: async (
      message: AOLiteTestMessage,
      environment: AOLiteEnvironment,
    ): Promise<AOLiteMessageResult> => {
      const startTime = Date.now();

      try {
        // Add delay if specified
        if (message.delay) {
          await new Promise((resolve) => setTimeout(resolve, message.delay));
        }

        // Ensure minimum duration for testing
        await new Promise((resolve) => setTimeout(resolve, 1));

        // Create AO message structure
        const aoMessage = {
          Data: message.data ? JSON.stringify(message.data) : "",
          From: "test-sender",
          Id: message.id,
          Tags: message.tags || [],
          Target: environment.processId,
          Timestamp: Date.now(),
        };

        // Execute the message in the simulated environment
        const response = await executeInEnvironment(aoMessage, environment);

        return {
          duration: Date.now() - startTime,
          messageId: message.id,
          response,
          status: "sent",
        };
      } catch (error) {
        return {
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
          messageId: message.id,
          status: "failed",
        };
      }
    },

    validateAssertion: async (
      assertion: AOLiteAssertion,
      actualResult: any,
    ): Promise<AOLiteAssertionResult> => {
      try {
        let actual: any;

        // Extract the target value using JSONPath or property access
        if (assertion.target.includes(".")) {
          actual = getNestedProperty(actualResult, assertion.target);
        } else {
          actual = actualResult?.[assertion.target] || actualResult;
        }

        // Perform assertion based on type
        let passed = false;

        switch (assertion.type) {
          case "contains":
            passed =
              typeof actual === "string" &&
              typeof assertion.expected === "string" &&
              actual.includes(assertion.expected);
            break;
          case "custom":
            if (assertion.customValidator) {
              // Execute custom validator function
              const validator = new Function(
                "actual",
                "expected",
                assertion.customValidator,
              );
              passed = validator(actual, assertion.expected);
            }
            break;
          case "equals":
            passed = actual === assertion.expected;
            break;
          case "exists":
            passed = actual !== undefined && actual !== null;
            break;
          case "matches":
            passed =
              typeof assertion.expected === "string" &&
              new RegExp(assertion.expected).test(String(actual));
            break;
        }

        return {
          actual,
          assertionId: assertion.id,
          expected: assertion.expected,
          message: assertion.message,
          status: passed ? "passed" : "failed",
        };
      } catch (error) {
        return {
          actual:
            "Error: " +
            (error instanceof Error ? error.message : "Unknown error"),
          assertionId: assertion.id,
          expected: assertion.expected,
          message: assertion.message,
          status: "failed",
        };
      }
    },

    validateProcessBehavior: async (
      processId: string,
      messages: AOLiteTestMessage[],
      environment: AOLiteEnvironment,
    ): Promise<AOLiteTestResults> => {
      const startTime = Date.now();
      const messageResults: AOLiteMessageResult[] = [];

      try {
        // Execute each message and validate behavior
        for (const message of messages) {
          const messageResult = await service(
            aoMessageService,
            processService,
          ).simulateMessage(message, environment);
          messageResults.push(messageResult);

          // Validate expected response if provided
          if (message.expectedResponse && messageResult.response) {
            const isValid = validateResponse(
              messageResult.response,
              message.expectedResponse,
            );
            if (!isValid) {
              messageResult.status = "failed";
              messageResult.error = "Response does not match expected result";
            }
          }
        }

        // Calculate validation results
        const totalTests = messages.length;
        const passedTests = messageResults.filter(
          (r) => r.status === "sent",
        ).length;
        const failedTests = messageResults.filter(
          (r) => r.status === "failed",
        ).length;
        const erroredTests = messageResults.filter(
          (r) => r.status === "timeout",
        ).length;

        return {
          duration: Date.now() - startTime,
          erroredTests,
          failedTests,
          passedTests,
          results: messageResults.map((mr) => ({
            assertionResults: [],
            duration: mr.duration,
            error: mr.error,
            messageResults: [mr],
            status: mr.status === "sent" ? "passed" : "failed",
            testCaseId: mr.messageId,
          })),
          status: failedTests > 0 || erroredTests > 0 ? "failed" : "passed",
          testSuiteId: "behavior-validation",
          totalTests,
        };
      } catch (error) {
        return {
          duration: Date.now() - startTime,
          erroredTests: messages.length,
          failedTests: 0,
          passedTests: 0,
          results: [],
          status: "error",
          testSuiteId: "behavior-validation",
          totalTests: messages.length,
        };
      }
    },

    validateTestCoverage: async (
      testSuite: AOLiteTestSuite,
      luaCode: string,
    ): Promise<{
      coveragePercentage: number;
      coveredHandlers: string[];
      suggestions: string[];
      uncoveredHandlers: string[];
    }> => {
      try {
        // Extract handlers from Lua code
        const allHandlers = extractHandlers(luaCode);
        const handlerNames = allHandlers.map((h) => h.name);

        // Get covered handlers from test cases
        const coveredHandlers = new Set<string>();
        for (const testCase of testSuite.testCases) {
          for (const message of testCase.messages) {
            if (handlerNames.includes(message.action)) {
              coveredHandlers.add(message.action);
            }
          }
        }

        const coveredHandlerArray = Array.from(coveredHandlers);
        const uncoveredHandlers = handlerNames.filter(
          (h) => !coveredHandlerArray.includes(h),
        );

        const coveragePercentage =
          handlerNames.length > 0
            ? (coveredHandlerArray.length / handlerNames.length) * 100
            : 0;

        // Generate suggestions for improving coverage
        const suggestions = generateCoverageSuggestions(
          uncoveredHandlers,
          allHandlers,
        );

        return {
          coveragePercentage,
          coveredHandlers: coveredHandlerArray,
          suggestions,
          uncoveredHandlers,
        };
      } catch (error) {
        throw new Error(
          `Failed to validate test coverage: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  };
};

// Helper functions
const initializeProcessState = (
  processDefinition: TealProcessDefinition,
): any => {
  // Initialize default state based on process type
  return {
    initialized: true,
    name: processDefinition.name,
    processId: processDefinition.id,
    timestamp: Date.now(),
    version: processDefinition.version,
  };
};

const initializeEnvironment = async (
  environment: AOLiteEnvironment,
): Promise<void> => {
  // Initialize the process in the environment
  environment.isRunning = true;
  environment.state = {
    ...environment.state,
    handlers: extractHandlers(environment.processSource),
  };
};

const executeTestSetup = async (
  setup: any,
  environment: AOLiteEnvironment,
): Promise<void> => {
  if (setup.initializeProcess) {
    await initializeEnvironment(environment);
  }

  if (setup.initialState) {
    environment.state = { ...environment.state, ...setup.initialState };
  }

  if (setup.environment) {
    environment.configuration = {
      ...environment.configuration,
      ...setup.environment,
    };
  }
};

const executeTestTeardown = async (
  teardown: any,
  environment: AOLiteEnvironment,
): Promise<void> => {
  if (teardown.cleanupProcess) {
    environment.isRunning = false;
  }

  if (teardown.resetState) {
    environment.state = initializeProcessState({
      id: environment.processId,
      name: "Reset",
      version: "1.0.0",
    } as TealProcessDefinition);
  }

  if (teardown.cleanupData) {
    environment.messageQueue = [];
  }
};

const calculateCoverage = async (
  testSuite: AOLiteTestSuite,
  environment: AOLiteEnvironment,
): Promise<any> => {
  const handlers = extractHandlers(environment.processSource);
  const handlerNames = handlers.map((h) => h.name);

  // Get covered handlers from test cases
  const coveredHandlers = new Set<string>();
  for (const testCase of testSuite.testCases) {
    for (const message of testCase.messages) {
      if (handlerNames.includes(message.action)) {
        coveredHandlers.add(message.action);
      }
    }
  }

  const coveredHandlerArray = Array.from(coveredHandlers);
  const uncoveredHandlers = handlerNames.filter(
    (h) => !coveredHandlerArray.includes(h),
  );

  return {
    coveragePercentage:
      (coveredHandlerArray.length / handlerNames.length) * 100,
    coveredHandlers: coveredHandlerArray,
    handlers: handlerNames,
    uncoveredHandlers,
  };
};

const extractHandlers = (lua: string): any[] => {
  const handlers: any[] = [];

  // Extract handler definitions using regex
  const handlerMatches = lua.match(/Handlers\.add\([^)]+\)/g);
  if (handlerMatches) {
    for (const match of handlerMatches) {
      const parts = match.match(
        /Handlers\.add\("([^"]+)",\s*([^,]+),\s*([^)]+)\)/,
      );
      if (parts) {
        handlers.push({
          handler: parts[3],
          name: parts[1],
          pattern: parts[2],
        });
      }
    }
  }

  return handlers;
};

const generateTestData = (handlerName: string): any => {
  switch (handlerName.toLowerCase()) {
    case "balance":
      return { target: "test-account" };
    case "info":
      return {};
    case "transfer":
      return { quantity: "100", recipient: "test-recipient" };
    default:
      return { test: true };
  }
};

const validateResponse = (actual: any, expected: any): boolean => {
  // If the actual response has an Output field, parse it and compare
  if (actual && actual.Output) {
    try {
      const parsedOutput = JSON.parse(actual.Output);
      if (typeof expected === "object" && expected !== null) {
        for (const key in expected) {
          if (parsedOutput[key] !== expected[key]) {
            return false;
          }
        }
        return true;
      }
      return parsedOutput === expected;
    } catch {
      // If parsing fails, fall back to direct comparison
    }
  }

  // Direct comparison for non-AO response objects
  if (typeof expected === "object" && expected !== null) {
    for (const key in expected) {
      if (actual[key] !== expected[key]) {
        return false;
      }
    }
    return true;
  }
  return actual === expected;
};

const generateMarkdownReport = (testResults: AOLiteTestResults): string => {
  return `# Test Results

## Summary
- **Status**: ${testResults.status}
- **Total Tests**: ${testResults.totalTests}
- **Passed**: ${testResults.passedTests}
- **Failed**: ${testResults.failedTests}
- **Errors**: ${testResults.erroredTests}
- **Duration**: ${testResults.duration}ms

## Test Cases

${testResults.results
  .map(
    (result) => `
### ${result.testCaseId}
- **Status**: ${result.status}
- **Duration**: ${result.duration}ms
${result.error ? `- **Error**: ${result.error}` : ""}

#### Assertions
${result.assertionResults
  .map(
    (assertion) => `
- **${assertion.assertionId}**: ${assertion.status}
  - Expected: ${JSON.stringify(assertion.expected)}
  - Actual: ${JSON.stringify(assertion.actual)}
`,
  )
  .join("")}

#### Messages
${result.messageResults
  .map(
    (message) => `
- **${message.messageId}**: ${message.status} (${message.duration}ms)
${message.error ? `  - Error: ${message.error}` : ""}
`,
  )
  .join("")}
`,
  )
  .join("")}

${
  testResults.coverage
    ? `
## Coverage
- **Handlers**: ${testResults.coverage.handlers.join(", ")}
- **Covered**: ${testResults.coverage.coveredHandlers.join(", ")}
- **Uncovered**: ${testResults.coverage.uncoveredHandlers.join(", ")}
- **Coverage**: ${testResults.coverage.coveragePercentage.toFixed(2)}%
`
    : ""
}
`;
};

const generateHtmlReport = (testResults: AOLiteTestResults): string => {
  return `<!DOCTYPE html>
<html>
<head>
    <title>AOLite Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .test-case { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 5px; }
        .passed { background: #d4edda; }
        .failed { background: #f8d7da; }
        .error { background: #fff3cd; }
    </style>
</head>
<body>
    <h1>AOLite Test Results</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Status:</strong> ${testResults.status}</p>
        <p><strong>Total Tests:</strong> ${testResults.totalTests}</p>
        <p><strong>Passed:</strong> ${testResults.passedTests}</p>
        <p><strong>Failed:</strong> ${testResults.failedTests}</p>
        <p><strong>Errors:</strong> ${testResults.erroredTests}</p>
        <p><strong>Duration:</strong> ${testResults.duration}ms</p>
    </div>
    
    <h2>Test Cases</h2>
    ${testResults.results
      .map(
        (result) => `
        <div class="test-case ${result.status}">
            <h3>${result.testCaseId}</h3>
            <p><strong>Status:</strong> ${result.status}</p>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ""}
            
            <h4>Assertions</h4>
            <ul>
                ${result.assertionResults
                  .map(
                    (assertion) => `
                    <li><strong>${assertion.assertionId}:</strong> ${assertion.status}</li>
                `,
                  )
                  .join("")}
            </ul>
            
            <h4>Messages</h4>
            <ul>
                ${result.messageResults
                  .map(
                    (message) => `
                    <li><strong>${message.messageId}:</strong> ${message.status} (${message.duration}ms)</li>
                `,
                  )
                  .join("")}
            </ul>
        </div>
    `,
      )
      .join("")}
    
    ${
      testResults.coverage
        ? `
        <h2>Coverage</h2>
        <p><strong>Coverage:</strong> ${testResults.coverage.coveragePercentage.toFixed(2)}%</p>
        <p><strong>Covered Handlers:</strong> ${testResults.coverage.coveredHandlers.join(", ")}</p>
        <p><strong>Uncovered Handlers:</strong> ${testResults.coverage.uncoveredHandlers.join(", ")}</p>
    `
        : ""
    }
    
</body>
</html>`;
};

const executeInEnvironment = async (
  message: any,
  environment: AOLiteEnvironment,
): Promise<any> => {
  // This simulates executing a message in the AOLite environment
  // In a real implementation, this would run the Lua code

  // Extract action from message tags
  const actionTag = message.Tags?.find((tag: any) => tag.name === "Action");
  const action = actionTag?.value || "unknown";

  // Simulate different responses based on action
  switch (action.toLowerCase()) {
    case "balance":
      return {
        Assignments: {},
        Messages: [],
        Output: JSON.stringify({
          Account: message.From,
          Balance: "1000",
          Ticker: "TEST",
        }),
        Spawns: [],
      };

    case "info":
      return {
        Assignments: {},
        Messages: [],
        Output: JSON.stringify({
          name: "Test Process",
          status: "Running",
          version: "1.0.0",
        }),
        Spawns: [],
      };

    case "transfer":
      return {
        Assignments: {},
        Messages: [],
        Output: JSON.stringify({
          From: message.From,
          Quantity:
            message.Tags?.find((t: any) => t.name === "Quantity")?.value || "0",
          Success: true,
          To:
            message.Tags?.find((t: any) => t.name === "Recipient")?.value ||
            "unknown",
        }),
        Spawns: [],
      };

    default:
      return {
        Assignments: {},
        Messages: [],
        Output: JSON.stringify({
          Error: `Unknown action: ${action}`,
        }),
        Spawns: [],
      };
  }
};

const getNestedProperty = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

// Agent-friendly helper functions
const generateFailureSuggestions = (result: any): string[] => {
  const suggestions: string[] = [];

  if (result.error) {
    if (result.error.includes("Missing")) {
      suggestions.push("Ensure all required input parameters are provided");
      suggestions.push("Validate input data format and structure");
    }
    if (result.error.includes("timeout")) {
      suggestions.push("Check for infinite loops in handler logic");
      suggestions.push("Optimize handler performance for faster execution");
    }
    if (
      result.error.includes("balance") ||
      result.error.includes("insufficient")
    ) {
      suggestions.push("Initialize proper state values for testing");
      suggestions.push("Verify balance calculations and state updates");
    }
    if (
      result.error.includes("permission") ||
      result.error.includes("unauthorized")
    ) {
      suggestions.push("Review access control logic in handlers");
      suggestions.push("Ensure test messages include proper authentication");
    }
  }

  // Analyze assertion failures
  if (result.assertionResults) {
    for (const assertion of result.assertionResults) {
      if (assertion.status === "failed") {
        if (assertion.expected !== assertion.actual) {
          suggestions.push(
            `Handler output mismatch: expected '${assertion.expected}', got '${assertion.actual}'`,
          );
          suggestions.push("Review handler implementation and return values");
        }
      }
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("Review handler implementation for edge cases");
    suggestions.push("Check input validation and error handling");
  }

  return suggestions;
};

const generateRecommendations = (testResults: any): string[] => {
  const recommendations: string[] = [];

  // Coverage recommendations
  if (testResults.coverage) {
    const coveragePercentage = testResults.coverage.coveragePercentage;
    if (coveragePercentage < 70) {
      recommendations.push(
        "Increase test coverage by adding tests for uncovered handlers",
      );
    }
    if (testResults.coverage.uncoveredHandlers?.length > 0) {
      recommendations.push(
        `Add tests for uncovered handlers: ${testResults.coverage.uncoveredHandlers.join(", ")}`,
      );
    }
  }

  // Performance recommendations
  if (testResults.duration > 30000) {
    recommendations.push("Consider optimizing test execution time");
    recommendations.push("Review handler performance and complexity");
  }

  // Error rate recommendations
  const errorRate = (testResults.erroredTests / testResults.totalTests) * 100;
  if (errorRate > 10) {
    recommendations.push(
      "High error rate detected - review handler error handling",
    );
    recommendations.push(
      "Consider adding input validation and better error messages",
    );
  }

  // Failure rate recommendations
  const failureRate = (testResults.failedTests / testResults.totalTests) * 100;
  if (failureRate > 5) {
    recommendations.push("Consider reviewing test scenarios for accuracy");
    recommendations.push(
      "Ensure handler implementations match expected behaviors",
    );
  }

  return recommendations;
};

const generateNextSteps = (testResults: any, failures: any[]): string[] => {
  const nextSteps: string[] = [];

  if (testResults.status === "passed") {
    nextSteps.push("✅ All tests passed - process ready for deployment");
    nextSteps.push("Consider running additional integration tests");
    nextSteps.push("Review performance metrics for optimization opportunities");
  } else {
    nextSteps.push("🔴 Address test failures before proceeding");

    if (failures.length > 0) {
      nextSteps.push(`Fix ${failures.length} failing test case(s)`);
    }

    if (testResults.erroredTests > 0) {
      nextSteps.push(`Resolve ${testResults.erroredTests} test error(s)`);
    }

    nextSteps.push("Re-run tests after implementing fixes");
    nextSteps.push("Ensure all handlers have proper error handling");
  }

  if (testResults.coverage && testResults.coverage.coveragePercentage < 80) {
    nextSteps.push("Improve test coverage by adding missing test cases");
  }

  return nextSteps;
};

const generateAgentSummaryReport = (
  interpretation: any,
  testResults: any,
): string => {
  const { summary } = interpretation;

  return `# AOLite Test Summary

## Results Overview
- **Status**: ${testResults.status.toUpperCase()}
- **Tests**: ${summary.passed}/${summary.total} passed
- **Duration**: ${summary.duration}ms
- **Coverage**: ${summary.coveragePercentage.toFixed(1)}%

## Quick Assessment
${summary.failed === 0 ? "✅ All tests passed successfully" : `❌ ${summary.failed} test(s) failed`}

${
  interpretation.recommendations.length > 0
    ? `
## Key Recommendations
${interpretation.recommendations
  .slice(0, 3)
  .map((rec: string) => `- ${rec}`)
  .join("\n")}
`
    : ""
}
`;
};

const generateAgentDetailedReport = (
  interpretation: any,
  testResults: any,
): string => {
  const { failures, summary } = interpretation;

  let report = `# Detailed AOLite Test Results

## Summary
- **Total Tests**: ${summary.total}
- **Passed**: ${summary.passed}
- **Failed**: ${summary.failed}
- **Duration**: ${summary.duration}ms
- **Coverage**: ${summary.coveragePercentage.toFixed(1)}%

`;

  if (failures.length > 0) {
    report += `## Failed Tests

${failures
  .map(
    (failure: any) => `
### ${failure.testCaseId}
**Reason**: ${failure.reason}

**Suggestions**:
${failure.suggestions.map((s: string) => `- ${s}`).join("\n")}
`,
  )
  .join("")}
`;
  }

  if (testResults.coverage) {
    report += `
## Coverage Analysis
- **Covered Handlers**: ${testResults.coverage.coveredHandlers?.join(", ") || "None"}
- **Uncovered Handlers**: ${testResults.coverage.uncoveredHandlers?.join(", ") || "None"}
- **Coverage Percentage**: ${testResults.coverage.coveragePercentage?.toFixed(1) || 0}%
`;
  }

  return report;
};

const generateAgentRecommendationsReport = (interpretation: any): string => {
  const { nextSteps, recommendations } = interpretation;

  return `# AOLite Testing Recommendations

## Recommended Actions
${recommendations.map((rec: string) => `- ${rec}`).join("\n")}

## Next Steps
${nextSteps.map((step: string) => `- ${step}`).join("\n")}

## Priority Focus Areas
- **High Priority**: Address any failing tests immediately
- **Medium Priority**: Improve test coverage to >80%
- **Low Priority**: Optimize test execution performance
`;
};

const generateCoverageSuggestions = (
  uncoveredHandlers: string[],
  allHandlers: any[],
): string[] => {
  const suggestions: string[] = [];

  if (uncoveredHandlers.length === 0) {
    suggestions.push("✅ Excellent! All handlers are covered by tests");
    return suggestions;
  }

  suggestions.push(
    `Add test cases for ${uncoveredHandlers.length} uncovered handler(s)`,
  );

  for (const handlerName of uncoveredHandlers) {
    const handler = allHandlers.find((h) => h.name === handlerName);
    if (handler) {
      suggestions.push(
        `Create test for '${handlerName}' handler with appropriate test data`,
      );
    }
  }

  if (uncoveredHandlers.length > 5) {
    suggestions.push(
      "Consider prioritizing tests for critical business logic handlers first",
    );
  }

  return suggestions;
};

export const createAOLiteTestService = (
  aoMessageService: AOMessageService,
  processService: ProcessCommunicationService,
): AOLiteTestService => service(aoMessageService, processService);
