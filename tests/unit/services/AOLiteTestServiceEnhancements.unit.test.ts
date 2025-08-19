import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAOLiteTestService } from "../../../src/services/AOLiteTestService.js";
import { AOMessageService } from "../../../src/services/AOMessageService.js";
import { ProcessCommunicationService } from "../../../src/services/ProcessCommunicationService.js";

describe("AOLiteTestService Agent Enhancements", () => {
  let service: ReturnType<typeof createAOLiteTestService>;
  let mockAOMessageService: AOMessageService;
  let mockProcessService: ProcessCommunicationService;

  beforeEach(() => {
    mockAOMessageService = {} as AOMessageService;
    mockProcessService = {} as ProcessCommunicationService;
    service = createAOLiteTestService(mockAOMessageService, mockProcessService);
  });

  describe("generateTestSuiteFromLua", () => {
    it("should generate test suite from Lua code and process info", async () => {
      const luaCode = `
        Handlers.add("Balance", "Action == 'Balance'", function(msg)
          ao.send({Target = msg.From, Data = "1000"})
        end)
        
        Handlers.add("Transfer", "Action == 'Transfer'", function(msg)
          ao.send({Target = msg.From, Data = "Transfer complete"})
        end)
      `;

      const processInfo = {
        id: "test-process-123",
        name: "Test Token Process",
        version: "1.0.0",
      };

      const result = await service.generateTestSuiteFromLua(
        luaCode,
        processInfo,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe("test-suite-test-process-123");
      expect(result.name).toBe("Test Token Process Test Suite");
      expect(result.processId).toBe("test-process-123");
      expect(result.testCases).toHaveLength(2);
      expect(result.testCases[0].name).toContain("Balance");
      expect(result.testCases[1].name).toContain("Transfer");
    });

    it("should handle empty Lua code gracefully", async () => {
      const luaCode = "";
      const processInfo = {
        id: "empty-process",
        name: "Empty Process",
        version: "1.0.0",
      };

      const result = await service.generateTestSuiteFromLua(
        luaCode,
        processInfo,
      );

      expect(result).toBeDefined();
      expect(result.testCases).toHaveLength(0);
    });
  });

  describe("interpretTestResults", () => {
    it("should interpret successful test results correctly", async () => {
      const testResults = {
        coverage: {
          coveragePercentage: 85,
          coveredHandlers: ["Balance", "Transfer"],
          handlers: ["Balance", "Transfer", "Info"],
          uncoveredHandlers: ["Info"],
        },
        duration: 1500,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 3,
        results: [
          {
            assertionResults: [],
            duration: 500,
            messageResults: [],
            status: "passed" as const,
            testCaseId: "test-1",
          },
          {
            assertionResults: [],
            duration: 600,
            messageResults: [],
            status: "passed" as const,
            testCaseId: "test-2",
          },
          {
            assertionResults: [],
            duration: 400,
            messageResults: [],
            status: "passed" as const,
            testCaseId: "test-3",
          },
        ],
        status: "passed" as const,
        testSuiteId: "test-suite-1",
        totalTests: 3,
      };

      const result = await service.interpretTestResults(testResults);

      expect(result.summary.total).toBe(3);
      expect(result.summary.passed).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.duration).toBe(1500);
      expect(result.summary.coveragePercentage).toBe(85);
      expect(result.failures).toHaveLength(0);
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Add tests for uncovered handlers: Info"),
        ]),
      );
      expect(result.nextSteps).toEqual(
        expect.arrayContaining([
          "✅ All tests passed - process ready for deployment",
        ]),
      );
    });

    it("should interpret failed test results with detailed analysis", async () => {
      const testResults = {
        coverage: {
          coveragePercentage: 100,
          coveredHandlers: ["Balance", "Transfer"],
          handlers: ["Balance", "Transfer"],
          uncoveredHandlers: [],
        },
        duration: 2000,
        erroredTests: 0,
        failedTests: 1,
        passedTests: 1,
        results: [
          {
            assertionResults: [],
            duration: 800,
            messageResults: [],
            status: "passed" as const,
            testCaseId: "test-balance",
          },
          {
            assertionResults: [
              {
                actual: "Error: Insufficient balance",
                assertionId: "assert-transfer-1",
                expected: "Transfer complete",
                message: "Transfer should succeed",
                status: "failed" as const,
              },
            ],
            duration: 1200,
            error: "Insufficient balance for transfer",
            messageResults: [],
            status: "failed" as const,
            testCaseId: "test-transfer",
          },
        ],
        status: "failed" as const,
        testSuiteId: "test-suite-1",
        totalTests: 2,
      };

      const result = await service.interpretTestResults(testResults);

      expect(result.summary.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].testCaseId).toBe("test-transfer");
      expect(result.failures[0].reason).toBe(
        "Insufficient balance for transfer",
      );
      expect(result.failures[0].suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Initialize proper state values"),
          expect.stringContaining("balance calculations"),
        ]),
      );
      expect(result.nextSteps).toEqual(
        expect.arrayContaining(["🔴 Address test failures before proceeding"]),
      );
    });
  });

  describe("generateAgentTestReport", () => {
    it("should generate agent summary report", async () => {
      const testResults = {
        coverage: {
          coveragePercentage: 90,
          coveredHandlers: ["Balance", "Transfer"],
          handlers: ["Balance", "Transfer"],
          uncoveredHandlers: [],
        },
        duration: 1000,
        erroredTests: 0,
        failedTests: 0,
        passedTests: 2,
        results: [],
        status: "passed" as const,
        testSuiteId: "test-suite-1",
        totalTests: 2,
      };

      const result = await service.generateAgentTestReport(
        testResults,
        "agent-summary",
      );

      expect(result).toContain("AOLite Test Summary");
      expect(result).toContain("Status**: PASSED");
      expect(result).toContain("Tests**: 2/2 passed");
      expect(result).toContain("Duration**: 1000ms");
      expect(result).toContain("Coverage**: 90.0%");
      expect(result).toContain("✅ All tests passed successfully");
    });

    it("should generate agent detailed report", async () => {
      const testResults = {
        coverage: {
          coveragePercentage: 75,
          coveredHandlers: ["Balance"],
          handlers: ["Balance", "Transfer"],
          uncoveredHandlers: ["Transfer"],
        },
        duration: 1500,
        erroredTests: 0,
        failedTests: 1,
        passedTests: 1,
        results: [],
        status: "failed" as const,
        testSuiteId: "test-suite-1",
        totalTests: 2,
      };

      const result = await service.generateAgentTestReport(
        testResults,
        "agent-detailed",
      );

      expect(result).toContain("Detailed AOLite Test Results");
      expect(result).toContain("Total Tests**: 2");
      expect(result).toContain("Coverage Analysis");
      expect(result).toContain("Covered Handlers**: Balance");
      expect(result).toContain("Uncovered Handlers**: Transfer");
    });

    it("should generate agent recommendations report", async () => {
      const testResults = {
        coverage: {
          coveragePercentage: 50,
          coveredHandlers: ["Balance"],
          handlers: ["Balance", "Transfer", "Info"],
          uncoveredHandlers: ["Transfer", "Info"],
        },
        duration: 800,
        erroredTests: 0,
        failedTests: 1,
        passedTests: 0,
        results: [],
        status: "failed" as const,
        testSuiteId: "test-suite-1",
        totalTests: 1,
      };

      const result = await service.generateAgentTestReport(
        testResults,
        "agent-recommendations",
      );

      expect(result).toContain("AOLite Testing Recommendations");
      expect(result).toContain("Recommended Actions");
      expect(result).toContain("Next Steps");
      expect(result).toContain("Priority Focus Areas");
      expect(result).toContain("High Priority");
      expect(result).toContain("Medium Priority");
      expect(result).toContain("Low Priority");
    });
  });

  describe("validateTestCoverage", () => {
    it("should validate complete test coverage", async () => {
      const testSuite = {
        configuration: {
          concurrent: false,
          coverage: true,
          timeout: 30000,
          verbose: true,
        },
        id: "suite-1",
        name: "Test Suite",
        processId: "process-1",
        setup: {},
        teardown: {},
        testCases: [
          {
            assertions: [],
            description: "Test balance handler",
            id: "test-1",
            messages: [{ action: "Balance", id: "msg-1", tags: [] }],
            name: "Test Balance",
            timeout: 10000,
          },
          {
            assertions: [],
            description: "Test transfer handler",
            id: "test-2",
            messages: [{ action: "Transfer", id: "msg-2", tags: [] }],
            name: "Test Transfer",
            timeout: 10000,
          },
        ],
      };

      const luaCode = `
        Handlers.add("Balance", "Action == 'Balance'", function(msg) end)
        Handlers.add("Transfer", "Action == 'Transfer'", function(msg) end)
      `;

      const result = await service.validateTestCoverage(testSuite, luaCode);

      expect(result.coveragePercentage).toBe(100);
      expect(result.coveredHandlers).toEqual(["Balance", "Transfer"]);
      expect(result.uncoveredHandlers).toEqual([]);
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          "✅ Excellent! All handlers are covered by tests",
        ]),
      );
    });

    it("should identify missing test coverage", async () => {
      const testSuite = {
        configuration: {
          concurrent: false,
          coverage: true,
          timeout: 30000,
          verbose: true,
        },
        id: "suite-1",
        name: "Test Suite",
        processId: "process-1",
        setup: {},
        teardown: {},
        testCases: [
          {
            assertions: [],
            description: "Test balance handler",
            id: "test-1",
            messages: [{ action: "Balance", id: "msg-1", tags: [] }],
            name: "Test Balance",
            timeout: 10000,
          },
        ],
      };

      const luaCode = `
        Handlers.add("Balance", "Action == 'Balance'", function(msg) end)
        Handlers.add("Transfer", "Action == 'Transfer'", function(msg) end)
        Handlers.add("Info", "Action == 'Info'", function(msg) end)
      `;

      const result = await service.validateTestCoverage(testSuite, luaCode);

      expect(result.coveragePercentage).toBeCloseTo(33.33, 1);
      expect(result.coveredHandlers).toEqual(["Balance"]);
      expect(result.uncoveredHandlers).toEqual(["Transfer", "Info"]);
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          "Add test cases for 2 uncovered handler(s)",
          "Create test for 'Transfer' handler with appropriate test data",
          "Create test for 'Info' handler with appropriate test data",
        ]),
      );
    });
  });

  describe("error handling", () => {
    it("should handle generateTestSuiteFromLua with invalid Lua gracefully", async () => {
      const invalidLuaCode = "invalid lua syntax !!!";
      const processInfo = {
        id: "invalid-process",
        name: "Invalid Process",
        version: "1.0.0",
      };

      // The service should handle invalid Lua gracefully by creating an empty test suite
      const result = await service.generateTestSuiteFromLua(
        invalidLuaCode,
        processInfo,
      );

      expect(result).toBeDefined();
      expect(result.testCases).toHaveLength(0);
      expect(result.processId).toBe("invalid-process");
    });

    it("should handle interpretTestResults errors with malformed data", async () => {
      const malformedResults = null as any;

      await expect(
        service.interpretTestResults(malformedResults),
      ).rejects.toThrow("Failed to interpret test results");
    });

    it("should handle generateAgentTestReport errors", async () => {
      const invalidResults = null as any;

      await expect(
        service.generateAgentTestReport(invalidResults, "agent-summary"),
      ).rejects.toThrow("Failed to generate agent test report");
    });

    it("should handle validateTestCoverage errors", async () => {
      const invalidTestSuite = null as any;
      const validLuaCode = "-- valid lua";

      await expect(
        service.validateTestCoverage(invalidTestSuite, validLuaCode),
      ).rejects.toThrow("Failed to validate test coverage");
    });
  });
});
