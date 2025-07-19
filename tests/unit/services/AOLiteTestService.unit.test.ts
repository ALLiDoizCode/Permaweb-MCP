import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AOLiteTestCase,
  AOLiteTestSuite,
} from "../../../src/models/AOLiteTest.js";
import { TealProcessDefinition } from "../../../src/models/TealProcess.js";
import { createAOLiteTestService } from "../../../src/services/AOLiteTestService.js";
import { AOMessageService } from "../../../src/services/AOMessageService.js";
import { ProcessCommunicationService } from "../../../src/services/ProcessCommunicationService.js";

// Mock dependencies
vi.mock("../../../src/services/AOMessageService.js", () => ({
  AOMessageService: vi.fn(),
}));

vi.mock("../../../src/services/ProcessCommunicationService.js", () => ({
  ProcessCommunicationService: vi.fn(),
}));

describe("AOLiteTestService", () => {
  let aoLiteTestService: ReturnType<typeof createAOLiteTestService>;
  let mockAOMessageService: AOMessageService;
  let mockProcessService: ProcessCommunicationService;
  let mockProcessDefinition: TealProcessDefinition;

  beforeEach(() => {
    mockAOMessageService = {} as AOMessageService;
    mockProcessService = {} as ProcessCommunicationService;
    aoLiteTestService = createAOLiteTestService(
      mockAOMessageService,
      mockProcessService,
    );

    mockProcessDefinition = {
      compiledLua: `-- Test compiled Lua
local function info(msg)
  return {
    Output = json.encode({ name = "Test Process" }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,
      dependencies: ["json"],
      id: "test-process-id",
      metadata: {
        aoVersion: "2.0.0",
        author: "Test Author",
        compileOptions: {
          strict: true,
          target: "lua53",
          warnings: true,
        },
        description: "Test process for AOLite testing",
        version: "1.0.0",
      },
      name: "Test Process",
      source: `-- Test Teal source
local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode({ name = "Test Process" }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)`,
      typeDefinitions: [],
      version: "1.0.0",
    };
  });

  describe("createTestEnvironment", () => {
    it("should create a test environment", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      expect(environment.processId).toBe(mockProcessDefinition.id);
      expect(environment.processSource).toBe(mockProcessDefinition.compiledLua);
      expect(environment.isRunning).toBe(true);
      expect(environment.state).toBeDefined();
      expect(environment.messageQueue).toEqual([]);
    });

    it("should apply custom configuration", async () => {
      const config = {
        concurrent: true,
        coverage: false,
        timeout: 60000,
        verbose: true,
      };

      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
        config,
      );

      expect(environment.configuration.concurrent).toBe(true);
      expect(environment.configuration.timeout).toBe(60000);
      expect(environment.configuration.verbose).toBe(true);
      expect(environment.configuration.coverage).toBe(false);
    });
  });

  describe("createDefaultTestSuite", () => {
    it("should create a default test suite", async () => {
      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        mockProcessDefinition,
      );

      expect(testSuite.id).toBeDefined();
      expect(testSuite.name).toContain("Test Process");
      expect(testSuite.processId).toBe(mockProcessDefinition.id);
      expect(testSuite.testCases).toBeDefined();
      expect(testSuite.testCases.length).toBeGreaterThan(0);
    });

    it("should generate test cases for handlers", async () => {
      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        mockProcessDefinition,
      );

      const infoTestCase = testSuite.testCases.find((tc) =>
        tc.name.includes("info"),
      );
      expect(infoTestCase).toBeDefined();
      expect(infoTestCase!.messages).toBeDefined();
      expect(infoTestCase!.assertions).toBeDefined();
    });
  });

  describe("executeTestCase", () => {
    it("should execute a test case successfully", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      const testCase: AOLiteTestCase = {
        assertions: [
          {
            expected: true,
            id: "assert-1",
            message: "Should return output",
            target: "Output",
            type: "exists",
          },
        ],
        description: "Test the info handler",
        id: "test-case-1",
        messages: [
          {
            action: "Info",
            id: "msg-1",
            tags: [{ name: "Action", value: "Info" }],
          },
        ],
        name: "Test Info Handler",
        timeout: 10000,
      };

      const result = await aoLiteTestService.executeTestCase(
        testCase,
        environment,
      );

      expect(result.testCaseId).toBe(testCase.id);
      expect(result.status).toBe("passed");
      expect(result.duration).toBeGreaterThan(0);
      expect(result.messageResults).toBeDefined();
      expect(result.assertionResults).toBeDefined();
    });

    it("should handle test case failures", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      const testCase: AOLiteTestCase = {
        assertions: [
          {
            expected: "ExpectedValue",
            id: "assert-fail",
            message: "Should match expected value",
            target: "Output",
            type: "equals",
          },
        ],
        description: "Test case that should fail",
        id: "test-case-fail",
        messages: [
          {
            action: "NonExistentAction",
            id: "msg-fail",
            tags: [{ name: "Action", value: "NonExistentAction" }],
          },
        ],
        name: "Failing Test Case",
        timeout: 10000,
      };

      const result = await aoLiteTestService.executeTestCase(
        testCase,
        environment,
      );

      expect(result.testCaseId).toBe(testCase.id);
      expect(result.status).toBe("failed");
    });
  });

  describe("executeTestSuite", () => {
    it("should execute a complete test suite", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );
      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        mockProcessDefinition,
      );

      const results = await aoLiteTestService.executeTestSuite(
        testSuite,
        environment,
      );

      expect(results.testSuiteId).toBe(testSuite.id);
      expect(results.totalTests).toBe(testSuite.testCases.length);
      expect(results.duration).toBeGreaterThan(0);
      expect(results.results).toBeDefined();
      expect(results.results.length).toBe(testSuite.testCases.length);
    });

    it("should handle concurrent test execution", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );
      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        mockProcessDefinition,
      );

      // Enable concurrent execution
      testSuite.configuration.concurrent = true;

      const results = await aoLiteTestService.executeTestSuite(
        testSuite,
        environment,
      );

      expect(results.testSuiteId).toBe(testSuite.id);
      expect(results.totalTests).toBe(testSuite.testCases.length);
    });
  });

  describe("simulateMessage", () => {
    it("should simulate message execution", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      const message = {
        action: "Info",
        id: "test-message",
        tags: [{ name: "Action", value: "Info" }],
      };

      const result = await aoLiteTestService.simulateMessage(
        message,
        environment,
      );

      expect(result.messageId).toBe(message.id);
      expect(result.status).toBe("sent");
      expect(result.response).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should handle message simulation errors", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      const message = {
        action: "ErrorAction",
        id: "error-message",
        tags: [{ name: "Action", value: "ErrorAction" }],
      };

      const result = await aoLiteTestService.simulateMessage(
        message,
        environment,
      );

      expect(result.messageId).toBe(message.id);
      expect(result.status).toBe("sent"); // Should still send, but with error response
    });
  });

  describe("validateAssertion", () => {
    it("should validate equals assertion", async () => {
      const assertion = {
        expected: "test",
        id: "assert-equals",
        message: "Should equal test",
        target: "value",
        type: "equals" as const,
      };

      const actualResult = { value: "test" };

      const result = await aoLiteTestService.validateAssertion(
        assertion,
        actualResult,
      );

      expect(result.assertionId).toBe(assertion.id);
      expect(result.status).toBe("passed");
      expect(result.actual).toBe("test");
      expect(result.expected).toBe("test");
    });

    it("should validate contains assertion", async () => {
      const assertion = {
        expected: "Hello",
        id: "assert-contains",
        message: "Should contain Hello",
        target: "message",
        type: "contains" as const,
      };

      const actualResult = { message: "Hello World" };

      const result = await aoLiteTestService.validateAssertion(
        assertion,
        actualResult,
      );

      expect(result.assertionId).toBe(assertion.id);
      expect(result.status).toBe("passed");
    });

    it("should validate exists assertion", async () => {
      const assertion = {
        expected: true,
        id: "assert-exists",
        message: "Should exist",
        target: "data",
        type: "exists" as const,
      };

      const actualResult = { data: "some value" };

      const result = await aoLiteTestService.validateAssertion(
        assertion,
        actualResult,
      );

      expect(result.assertionId).toBe(assertion.id);
      expect(result.status).toBe("passed");
    });

    it("should handle failed assertions", async () => {
      const assertion = {
        expected: "expected",
        id: "assert-fail",
        message: "Should equal expected",
        target: "value",
        type: "equals" as const,
      };

      const actualResult = { value: "actual" };

      const result = await aoLiteTestService.validateAssertion(
        assertion,
        actualResult,
      );

      expect(result.assertionId).toBe(assertion.id);
      expect(result.status).toBe("failed");
      expect(result.actual).toBe("actual");
      expect(result.expected).toBe("expected");
    });
  });

  describe("generateTestReport", () => {
    it("should generate JSON report", async () => {
      const testResults = {
        duration: 1000,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 2,
        results: [],
        status: "passed" as const,
        testSuiteId: "test-suite",
        totalTests: 2,
      };

      const report = await aoLiteTestService.generateTestReport(
        testResults,
        "json",
      );

      expect(report).toBeDefined();
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it("should generate Markdown report", async () => {
      const testResults = {
        duration: 1000,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 2,
        results: [],
        status: "passed" as const,
        testSuiteId: "test-suite",
        totalTests: 2,
      };

      const report = await aoLiteTestService.generateTestReport(
        testResults,
        "markdown",
      );

      expect(report).toBeDefined();
      expect(report).toContain("# Test Results");
      expect(report).toContain("**Status**: passed");
    });

    it("should generate HTML report", async () => {
      const testResults = {
        duration: 1000,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 2,
        results: [],
        status: "passed" as const,
        testSuiteId: "test-suite",
        totalTests: 2,
      };

      const report = await aoLiteTestService.generateTestReport(
        testResults,
        "html",
      );

      expect(report).toBeDefined();
      expect(report).toContain("<html>");
      expect(report).toContain("AOLite Test Results");
    });
  });

  describe("validateProcessBehavior", () => {
    it("should validate process behavior", async () => {
      const environment = await aoLiteTestService.createTestEnvironment(
        mockProcessDefinition,
      );

      const messages = [
        {
          action: "Info",
          expectedResponse: { name: "Test Process" },
          id: "msg-1",
          tags: [{ name: "Action", value: "Info" }],
        },
      ];

      const results = await aoLiteTestService.validateProcessBehavior(
        mockProcessDefinition.id,
        messages,
        environment,
      );

      expect(results.testSuiteId).toBe("behavior-validation");
      expect(results.totalTests).toBe(1);
      expect(results.status).toBe("passed");
    });
  });
});
