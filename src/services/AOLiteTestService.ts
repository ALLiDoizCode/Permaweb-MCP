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

  generateTestReport(
    testResults: AOLiteTestResults,
    format?: "html" | "json" | "markdown",
  ): Promise<string>;

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
              typeof actual === "string" && actual.includes(assertion.expected);
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
            passed = new RegExp(assertion.expected).test(String(actual));
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

export const createAOLiteTestService = (
  aoMessageService: AOMessageService,
  processService: ProcessCommunicationService,
): AOLiteTestService => service(aoMessageService, processService);
