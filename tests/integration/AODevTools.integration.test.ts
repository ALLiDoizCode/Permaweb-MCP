import { beforeEach, describe, expect, it } from "vitest";

import { TealProcessDefinition } from "../../src/models/TealProcess.js";
import { createAODevelopmentDocsService } from "../../src/services/AODevelopmentDocsService.js";
import { createAODevelopmentPipelineService } from "../../src/services/AODevelopmentPipelineService.js";
import { createAODevToolsCompatibilityService } from "../../src/services/AODevToolsCompatibilityService.js";
import { createAOLiteTestService } from "../../src/services/AOLiteTestService.js";
import { aoMessageService } from "../../src/services/AOMessageService.js";
import { permawebDocs } from "../../src/services/PermawebDocsService.js";
import { processCommunicationService } from "../../src/services/ProcessCommunicationService.js";
import { createTealCompilerService } from "../../src/services/TealCompilerService.js";
import { createTealWorkflowService } from "../../src/services/TealWorkflowService.js";
import { TokenProcessTemplateService } from "../../src/services/TokenProcessTemplateService.js";

describe("AO Development Tools Integration", () => {
  let tealCompilerService: ReturnType<typeof createTealCompilerService>;
  let aoLiteTestService: ReturnType<typeof createAOLiteTestService>;
  let tealWorkflowService: ReturnType<typeof createTealWorkflowService>;
  let aoDevDocsService: ReturnType<typeof createAODevelopmentDocsService>;
  let pipelineService: ReturnType<typeof createAODevelopmentPipelineService>;
  let compatibilityService: ReturnType<
    typeof createAODevToolsCompatibilityService
  >;
  let testProcessDefinition: TealProcessDefinition;

  beforeEach(() => {
    // Initialize services
    tealCompilerService = createTealCompilerService(
      processCommunicationService,
      TokenProcessTemplateService,
    );

    aoLiteTestService = createAOLiteTestService(
      aoMessageService,
      processCommunicationService,
    );

    tealWorkflowService = createTealWorkflowService(
      tealCompilerService,
      processCommunicationService,
      aoMessageService,
    );

    aoDevDocsService = createAODevelopmentDocsService(permawebDocs);

    pipelineService = createAODevelopmentPipelineService(
      aoDevDocsService,
      tealCompilerService,
      aoLiteTestService,
      {} as any, // Mock deploy service
      tealWorkflowService,
    );

    compatibilityService = createAODevToolsCompatibilityService(
      processCommunicationService,
      aoMessageService,
      tealCompilerService,
      aoLiteTestService,
      tealWorkflowService,
      pipelineService,
    );

    // Create test process definition
    testProcessDefinition = {
      compiledLua: "",
      dependencies: ["json"],
      id: "integration-test-process",
      metadata: {
        aoVersion: "2.0.0",
        author: "Integration Test",
        compileOptions: {
          strict: true,
          target: "lua53",
          warnings: true,
        },
        description: "Test process for integration testing",
        version: "1.0.0",
      },
      name: "Integration Test Process",
      source: `-- Integration Test Teal Process
local record State
  name: string
  counter: number
end

local state: State = {
  name = "Integration Test",
  counter = 0
}

local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode({
      name = state.name,
      counter = state.counter,
      processId = ao.id
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

local function increment(msg: AO.Message): AO.Response
  state.counter = state.counter + 1
  return {
    Output = json.encode({
      counter = state.counter,
      message = "Counter incremented"
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)
Handlers.add("increment", Handlers.utils.hasMatchingTag("Action", "Increment"), increment)`,
      typeDefinitions: [],
      version: "1.0.0",
    };
  });

  describe("End-to-End Workflow", () => {
    it("should complete the full development workflow", async () => {
      // Step 1: Compile Teal source
      const compileResult = await tealCompilerService.compileTealToLua(
        testProcessDefinition.source,
        testProcessDefinition.metadata.compileOptions,
      );

      expect(compileResult.success).toBe(true);
      expect(compileResult.compiledLua).toBeDefined();

      // Update process definition with compiled Lua
      testProcessDefinition.compiledLua = compileResult.compiledLua!;

      // Step 2: Create and execute test suite
      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        testProcessDefinition,
      );
      expect(testSuite.testCases.length).toBeGreaterThan(0);

      const testEnvironment = await aoLiteTestService.createTestEnvironment(
        testProcessDefinition,
      );
      expect(testEnvironment.isRunning).toBe(true);

      const testResults = await aoLiteTestService.executeTestSuite(
        testSuite,
        testEnvironment,
      );
      expect(testResults.status).toBe("passed");

      // Step 3: Create and execute pipeline
      const pipeline = await pipelineService.createPipeline(
        "Integration Test Pipeline",
        testProcessDefinition,
        {
          autoAdvance: true,
          parallelExecution: false,
          stopOnError: false,
          timeout: 60000,
        },
      );

      expect(pipeline.id).toBeDefined();
      expect(pipeline.stages.length).toBe(4);

      // Step 4: Validate compatibility
      const compatibilityResults =
        await compatibilityService.runCompatibilityTestSuite();
      expect(compatibilityResults.overall.isCompatible).toBe(true);

      // Step 5: Generate documentation
      const processDoc = await tealWorkflowService.generateProcessDocumentation(
        testProcessDefinition,
      );
      expect(processDoc).toContain("Integration Test Process");
      expect(processDoc).toContain("## Handlers");
    }, 30000); // 30 second timeout for full workflow

    it("should handle workflow errors gracefully", async () => {
      // Test with invalid Teal source
      const invalidProcessDefinition = {
        ...testProcessDefinition,
        source: "invalid teal syntax here",
      };

      const compileResult = await tealCompilerService.compileTealToLua(
        invalidProcessDefinition.source,
      );

      expect(compileResult.success).toBe(false);
      expect(compileResult.errors).toBeDefined();
      expect(compileResult.errors!.length).toBeGreaterThan(0);

      // Ensure other services handle the error gracefully
      const compatibilityResult =
        await compatibilityService.validateTealCompilerIntegration(
          invalidProcessDefinition.source,
        );
      expect(compatibilityResult.isCompatible).toBe(false);
    });
  });

  describe("Service Integration", () => {
    it("should integrate TealCompilerService with ProcessCommunicationService", async () => {
      const compileResult = await tealCompilerService.compileTealToLua(
        testProcessDefinition.source,
      );

      expect(compileResult.success).toBe(true);

      const integrationResult =
        await tealCompilerService.integrateWithAOServices(
          compileResult.compiledLua!,
          testProcessDefinition.id,
        );

      expect(integrationResult).toBeDefined();
      expect(integrationResult).toContain("Handlers.add");
    });

    it("should integrate AOLiteTestService with compiled processes", async () => {
      // First compile the process
      const compileResult = await tealCompilerService.compileTealToLua(
        testProcessDefinition.source,
      );
      testProcessDefinition.compiledLua = compileResult.compiledLua!;

      // Create test environment
      const environment = await aoLiteTestService.createTestEnvironment(
        testProcessDefinition,
      );
      expect(environment.isRunning).toBe(true);

      // Test message simulation
      const testMessage = {
        action: "Info",
        id: "test-msg",
        tags: [{ name: "Action", value: "Info" }],
      };

      const messageResult = await aoLiteTestService.simulateMessage(
        testMessage,
        environment,
      );
      expect(messageResult.status).toBe("sent");
      expect(messageResult.response).toBeDefined();
    });

    it("should integrate workflow services", async () => {
      const workflowResult = await tealWorkflowService.createTealWorkflow(
        "token",
        "Integration Token",
        {
          author: "Integration Test",
          description: "Integration test token",
          version: "1.0.0",
        },
      );

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.processDefinition).toBeDefined();
      expect(workflowResult.template).toBeDefined();
    });
  });

  describe("Template Integration", () => {
    it("should create and test token template", async () => {
      const tokenTemplate = await tealCompilerService.createTealTemplate(
        "token",
        "TestToken",
        {
          author: "Integration Test",
          description: "Integration test token",
          version: "1.0.0",
        },
      );

      expect(tokenTemplate.category).toBe("token");
      expect(tokenTemplate.source).toContain("TokenState");

      // Compile the template
      const compileResult = await tealCompilerService.compileTealToLua(
        tokenTemplate.source,
      );
      expect(compileResult.success).toBe(true);

      // Create process definition from template
      const processDefinition =
        await tealCompilerService.createProcessDefinition(
          tokenTemplate.source,
          {
            aoVersion: "2.0.0",
            author: "Integration Test",
            compileOptions: {
              strict: true,
              target: "lua53",
              warnings: true,
            },
            description: "Integration test token",
            version: "1.0.0",
          },
        );

      expect(processDefinition.id).toBeDefined();
      expect(processDefinition.compiledLua).toBeDefined();

      // Test the generated process
      const testSuite =
        await aoLiteTestService.createDefaultTestSuite(processDefinition);
      expect(testSuite.testCases.length).toBeGreaterThan(0);

      const environment =
        await aoLiteTestService.createTestEnvironment(processDefinition);
      const testResults = await aoLiteTestService.executeTestSuite(
        testSuite,
        environment,
      );
      expect(testResults.status).toBe("passed");
    });

    it("should create and test DAO template", async () => {
      const daoTemplate = await tealCompilerService.createTealTemplate(
        "dao",
        "TestDAO",
        {
          author: "Integration Test",
          description: "Integration test DAO",
          version: "1.0.0",
        },
      );

      expect(daoTemplate.category).toBe("dao");
      expect(daoTemplate.source).toContain("DAOState");

      // Compile and test the template
      const compileResult = await tealCompilerService.compileTealToLua(
        daoTemplate.source,
      );
      expect(compileResult.success).toBe(true);
    });
  });

  describe("Compatibility Validation", () => {
    it("should validate complete system compatibility", async () => {
      const results = await compatibilityService.runCompatibilityTestSuite();

      expect(results.overall.isCompatible).toBe(true);
      expect(results.overall.score).toBeGreaterThan(70);
      expect(results.processCommunication.isCompatible).toBe(true);
      expect(results.aoMessage.isCompatible).toBe(true);
      expect(results.tealCompiler.isCompatible).toBe(true);
      expect(results.aoLiteTest.isCompatible).toBe(true);
      expect(results.pipeline.isCompatible).toBe(true);
    });

    it("should generate compatibility report", async () => {
      const results = await compatibilityService.runCompatibilityTestSuite();
      const report =
        await compatibilityService.generateCompatibilityReport(results);

      expect(report).toBeDefined();
      expect(report).toContain("AO Development Tools Compatibility Report");
      expect(report).toContain("Overall Compatibility");
      expect(report).toContain("ProcessCommunicationService");
      expect(report).toContain("AOMessageService");
      expect(report).toContain("TealCompilerService");
      expect(report).toContain("AOLiteTestService");
    });
  });

  describe("Performance Testing", () => {
    it("should handle multiple concurrent operations", async () => {
      const operations = [];

      // Create multiple compilation operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          tealCompilerService.compileTealToLua(`-- Process ${i}
local function handler${i}(msg: AO.Message): AO.Response
  return {
    Output = json.encode({ id = ${i} }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("handler${i}", Handlers.utils.hasMatchingTag("Action", "Handler${i}"), handler${i})`),
        );
      }

      const results = await Promise.all(operations);

      expect(results.length).toBe(5);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should handle large test suites efficiently", async () => {
      // Create a process with many handlers
      const largeProcessSource = `-- Large Process
local record State
  counters: {string:number}
end

local state: State = {
  counters = {}
}

${Array.from(
  { length: 10 },
  (_, i) => `
local function handler${i}(msg: AO.Message): AO.Response
  state.counters["handler${i}"] = (state.counters["handler${i}"] or 0) + 1
  return {
    Output = json.encode({ handler = "handler${i}", count = state.counters["handler${i}"] }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

Handlers.add("handler${i}", Handlers.utils.hasMatchingTag("Action", "Handler${i}"), handler${i})`,
).join("\n")}`;

      const largeProcessDefinition = {
        ...testProcessDefinition,
        source: largeProcessSource,
      };

      const compileResult =
        await tealCompilerService.compileTealToLua(largeProcessSource);
      expect(compileResult.success).toBe(true);

      largeProcessDefinition.compiledLua = compileResult.compiledLua!;

      const testSuite = await aoLiteTestService.createDefaultTestSuite(
        largeProcessDefinition,
      );
      expect(testSuite.testCases.length).toBeGreaterThan(5);

      const environment = await aoLiteTestService.createTestEnvironment(
        largeProcessDefinition,
      );
      const testResults = await aoLiteTestService.executeTestSuite(
        testSuite,
        environment,
      );
      expect(testResults.status).toBe("passed");
      expect(testResults.totalTests).toBe(testSuite.testCases.length);
    });
  });
});
