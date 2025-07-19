import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AOLiteEnvironment,
  AOLiteTestCase,
  AOLiteTestConfiguration,
  AOLiteTestSuite,
} from "../models/AOLiteTest.js";
import { TealProcessDefinition } from "../models/TealProcess.js";
import { AOLiteTestService } from "./AOLiteTestService.js";
import { AOMessageService } from "./AOMessageService.js";
import { ProcessCommunicationService } from "./ProcessCommunicationService.js";

export interface AOLiteTestSuiteBuilder {
  addHandler(handlerName: string, testData?: any): AOLiteTestSuiteBuilder;
  addTestCase(testCase: AOLiteTestCase): AOLiteTestSuiteBuilder;
  build(): Promise<void>;
  withConfiguration(
    configuration: AOLiteTestConfiguration,
  ): AOLiteTestSuiteBuilder;
  withSetup(
    setup: (environment: AOLiteEnvironment) => Promise<void>,
  ): AOLiteTestSuiteBuilder;
  withTeardown(
    teardown: (environment: AOLiteEnvironment) => Promise<void>,
  ): AOLiteTestSuiteBuilder;
}

export interface AOLiteVitestIntegration {
  createAOLiteEnvironment(
    processDefinition: TealProcessDefinition,
    configuration?: AOLiteTestConfiguration,
  ): Promise<AOLiteEnvironment>;

  createTestSuite(
    name: string,
    processDefinition: TealProcessDefinition,
    configuration?: AOLiteTestConfiguration,
  ): AOLiteTestSuiteBuilder;

  runAOLiteTest(
    testName: string,
    testCase: AOLiteTestCase,
    environment: AOLiteEnvironment,
  ): Promise<void>;

  validateAOLiteCompatibility(
    processDefinition: TealProcessDefinition,
  ): Promise<boolean>;
}

class AOLiteTestSuiteBuilderImpl implements AOLiteTestSuiteBuilder {
  private configuration: AOLiteTestConfiguration = {};
  private environment?: AOLiteEnvironment;
  private setupFn?: (environment: AOLiteEnvironment) => Promise<void>;
  private teardownFn?: (environment: AOLiteEnvironment) => Promise<void>;
  private testCases: AOLiteTestCase[] = [];

  constructor(
    private name: string,
    private processDefinition: TealProcessDefinition,
    private aoLiteService: AOLiteTestService,
  ) {}

  addHandler(handlerName: string, testData?: any): AOLiteTestSuiteBuilder {
    const testCase: AOLiteTestCase = {
      assertions: [
        {
          expected: true,
          id: `assert-${handlerName}-${Date.now()}`,
          message: `${handlerName} should return output`,
          target: "Output",
          type: "exists",
        },
      ],
      description: `Automated test for ${handlerName} handler`,
      id: `test-${handlerName}-${Date.now()}`,
      messages: [
        {
          action: handlerName,
          data: testData,
          id: `msg-${handlerName}-${Date.now()}`,
          tags: [{ name: "Action", value: handlerName }],
        },
      ],
      name: `Test ${handlerName} Handler`,
      timeout: 10000,
    };

    this.testCases.push(testCase);
    return this;
  }

  addTestCase(testCase: AOLiteTestCase): AOLiteTestSuiteBuilder {
    this.testCases.push(testCase);
    return this;
  }

  async build(): Promise<void> {
    describe(this.name, () => {
      beforeEach(async () => {
        this.environment = await this.aoLiteService.createTestEnvironment(
          this.processDefinition,
          this.configuration,
        );

        if (this.setupFn) {
          await this.setupFn(this.environment);
        }
      });

      afterEach(async () => {
        if (this.teardownFn && this.environment) {
          await this.teardownFn(this.environment);
        }
      });

      for (const testCase of this.testCases) {
        it(testCase.name, async () => {
          if (!this.environment) {
            throw new Error("Test environment not initialized");
          }

          const result = await this.aoLiteService.executeTestCase(
            testCase,
            this.environment,
          );

          expect(result.status).toBe("passed");
          expect(result.error).toBeUndefined();

          // Validate all assertions passed
          for (const assertion of result.assertionResults) {
            expect(assertion.status).toBe("passed");
          }

          // Validate all messages were sent successfully
          for (const message of result.messageResults) {
            expect(message.status).toBe("sent");
          }
        });
      }
    });
  }

  withConfiguration(
    configuration: AOLiteTestConfiguration,
  ): AOLiteTestSuiteBuilder {
    this.configuration = { ...this.configuration, ...configuration };
    return this;
  }

  withSetup(
    setup: (environment: AOLiteEnvironment) => Promise<void>,
  ): AOLiteTestSuiteBuilder {
    this.setupFn = setup;
    return this;
  }

  withTeardown(
    teardown: (environment: AOLiteEnvironment) => Promise<void>,
  ): AOLiteTestSuiteBuilder {
    this.teardownFn = teardown;
    return this;
  }
}

const service = (
  aoLiteService: AOLiteTestService,
  aoMessageService: AOMessageService,
  processService: ProcessCommunicationService,
): AOLiteVitestIntegration => {
  return {
    createAOLiteEnvironment: async (
      processDefinition: TealProcessDefinition,
      configuration?: AOLiteTestConfiguration,
    ): Promise<AOLiteEnvironment> => {
      const environment = await aoLiteService.createTestEnvironment(
        processDefinition,
        configuration,
      );

      // Validate environment is properly initialized
      expect(environment.processId).toBe(processDefinition.id);
      expect(environment.processSource).toBe(processDefinition.compiledLua);
      expect(environment.isRunning).toBe(true);
      expect(environment.state).toBeDefined();

      return environment;
    },

    createTestSuite: (
      name: string,
      processDefinition: TealProcessDefinition,
      configuration?: AOLiteTestConfiguration,
    ): AOLiteTestSuiteBuilder => {
      return new AOLiteTestSuiteBuilderImpl(
        name,
        processDefinition,
        aoLiteService,
      ).withConfiguration(configuration || {});
    },

    runAOLiteTest: async (
      testName: string,
      testCase: AOLiteTestCase,
      environment: AOLiteEnvironment,
    ): Promise<void> => {
      describe(testName, () => {
        it(`should execute ${testCase.name}`, async () => {
          const result = await aoLiteService.executeTestCase(
            testCase,
            environment,
          );

          expect(result.status).toBe("passed");
          expect(result.error).toBeUndefined();

          // Validate all assertions
          for (const assertion of result.assertionResults) {
            expect(assertion.status).toBe("passed");

            if (assertion.message) {
              expect(assertion.actual).toBeDefined();
            }
          }

          // Validate all messages
          for (const message of result.messageResults) {
            expect(message.status).toBe("sent");
            expect(message.duration).toBeGreaterThan(0);
          }
        });
      });
    },

    validateAOLiteCompatibility: async (
      processDefinition: TealProcessDefinition,
    ): Promise<boolean> => {
      try {
        // Check if the process definition is compatible with AOLite
        const hasHandlers =
          processDefinition.compiledLua.includes("Handlers.add");
        const hasAOPatterns =
          processDefinition.compiledLua.includes("msg.") ||
          processDefinition.compiledLua.includes("ao.");

        if (!hasHandlers) {
          console.warn(
            "Process definition lacks handler patterns for AOLite testing",
          );
          return false;
        }

        if (!hasAOPatterns) {
          console.warn(
            "Process definition lacks AO message patterns for AOLite testing",
          );
          return false;
        }

        // Try to create a test environment
        const environment =
          await aoLiteService.createTestEnvironment(processDefinition);

        // Validate the environment was created successfully
        return environment.isRunning && environment.state !== null;
      } catch (error) {
        console.error("AOLite compatibility validation failed:", error);
        return false;
      }
    },
  };
};

// Helper functions for common AOLite test patterns
export const AOLiteTestHelpers = {
  createBalanceTest: (target?: string) => ({
    assertions: [
      {
        expected: "Balance",
        id: `assert-balance-${Date.now()}`,
        message: "Balance response should contain balance information",
        target: "Output",
        type: "contains" as const,
      },
    ],
    description: "Test balance query functionality",
    id: `balance-test-${Date.now()}`,
    messages: [
      {
        action: "Balance",
        id: `msg-balance-${Date.now()}`,
        tags: target
          ? [
              { name: "Action", value: "Balance" },
              { name: "Target", value: target },
            ]
          : [{ name: "Action", value: "Balance" }],
      },
    ],
    name: "Balance Test",
    timeout: 10000,
  }),

  createCustomAssertion: (
    id: string,
    type: "contains" | "custom" | "equals" | "exists" | "matches",
    target: string,
    expected: any,
    message?: string,
  ) => ({
    expected,
    id,
    message,
    target,
    type,
  }),

  createEnvironmentConfig: (
    concurrent = false,
    timeout = 30000,
    verbose = false,
    coverage = true,
  ): AOLiteTestConfiguration => ({
    concurrent,
    coverage,
    maxConcurrency: concurrent ? 4 : 1,
    retries: 3,
    timeout,
    verbose,
  }),

  createInfoTest: () => ({
    assertions: [
      {
        expected: true,
        id: `assert-info-${Date.now()}`,
        message: "Info should return process information",
        target: "Output",
        type: "exists" as const,
      },
    ],
    description: "Test process info functionality",
    id: `info-test-${Date.now()}`,
    messages: [
      {
        action: "Info",
        id: `msg-info-${Date.now()}`,
        tags: [{ name: "Action", value: "Info" }],
      },
    ],
    name: "Info Test",
    timeout: 10000,
  }),

  createTokenTest: (processId: string, action: string, data?: any) => ({
    assertions: [
      {
        expected: true,
        id: `assert-${action}-${Date.now()}`,
        message: `${action} should return output`,
        target: "Output",
        type: "exists" as const,
      },
    ],
    description: `Test token ${action} functionality`,
    id: `token-test-${action}-${Date.now()}`,
    messages: [
      {
        action,
        data,
        id: `msg-${action}-${Date.now()}`,
        tags: [{ name: "Action", value: action }],
      },
    ],
    name: `Token ${action} Test`,
    timeout: 10000,
  }),

  createTransferTest: (recipient: string, quantity: string) => ({
    assertions: [
      {
        expected: "Success",
        id: `assert-transfer-${Date.now()}`,
        message: "Transfer should succeed",
        target: "Output",
        type: "contains" as const,
      },
    ],
    description: "Test token transfer functionality",
    id: `transfer-test-${Date.now()}`,
    messages: [
      {
        action: "Transfer",
        id: `msg-transfer-${Date.now()}`,
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Recipient", value: recipient },
          { name: "Quantity", value: quantity },
        ],
      },
    ],
    name: "Transfer Test",
    timeout: 10000,
  }),
};

// Example usage patterns
export const AOLiteTestExamples = {
  createBasicTokenTests: async (
    processDefinition: TealProcessDefinition,
    aoLiteService: AOLiteTestService,
  ) => {
    const builder = new AOLiteTestSuiteBuilderImpl(
      "Basic Token Tests",
      processDefinition,
      aoLiteService,
    );

    return builder
      .withConfiguration(
        AOLiteTestHelpers.createEnvironmentConfig(false, 30000, true, true),
      )
      .addTestCase(AOLiteTestHelpers.createInfoTest())
      .addTestCase(AOLiteTestHelpers.createBalanceTest())
      .addTestCase(
        AOLiteTestHelpers.createTransferTest("test-recipient", "100"),
      )
      .withSetup(async (environment) => {
        // Initialize test data
        environment.state = {
          ...environment.state,
          testData: {
            initialBalance: 1000,
            testAccount: "test-account",
          },
        };
      })
      .withTeardown(async (environment) => {
        // Clean up test data
        environment.state = {
          ...environment.state,
          testData: null,
        };
      })
      .build();
  },

  createConcurrentTokenTests: async (
    processDefinition: TealProcessDefinition,
    aoLiteService: AOLiteTestService,
  ) => {
    const builder = new AOLiteTestSuiteBuilderImpl(
      "Concurrent Token Tests",
      processDefinition,
      aoLiteService,
    );

    return builder
      .withConfiguration(
        AOLiteTestHelpers.createEnvironmentConfig(true, 60000, false, true),
      )
      .addTestCase(AOLiteTestHelpers.createBalanceTest("account-1"))
      .addTestCase(AOLiteTestHelpers.createBalanceTest("account-2"))
      .addTestCase(AOLiteTestHelpers.createBalanceTest("account-3"))
      .addTestCase(AOLiteTestHelpers.createTransferTest("account-1", "50"))
      .addTestCase(AOLiteTestHelpers.createTransferTest("account-2", "75"))
      .addTestCase(AOLiteTestHelpers.createTransferTest("account-3", "25"))
      .build();
  },
};

export const createAOLiteVitestIntegration = (
  aoLiteService: AOLiteTestService,
  aoMessageService: AOMessageService,
  processService: ProcessCommunicationService,
): AOLiteVitestIntegration =>
  service(aoLiteService, aoMessageService, processService);
