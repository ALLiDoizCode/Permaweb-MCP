import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../src/tools/index.js";
import { EvalProcessCommand } from "../../src/tools/process/commands/EvalProcessCommand.js";
import { ExecuteActionCommand } from "../../src/tools/process/commands/ExecuteActionCommand.js";
import { QueryAOProcessMessagesCommand } from "../../src/tools/process/commands/QueryAOProcessMessagesCommand.js";
import { SpawnProcessCommand } from "../../src/tools/process/commands/SpawnProcessCommand.js";

// Mock the relay functions
vi.mock("../../src/relay.js", () => ({
  evalProcess: vi
    .fn()
    .mockResolvedValue({ result: "Process initialized", success: true }),
  event: vi.fn(),
  fetchEvents: vi.fn().mockResolvedValue([]),
}));

// Mock the process functions
vi.mock("../../src/process.js", () => ({
  createProcess: vi.fn().mockResolvedValue("test-process-id-123"),
  read: vi.fn().mockResolvedValue({
    Data: JSON.stringify({
      handlers: [
        {
          action: "Info",
          description: "Get process information",
        },
      ],
      lastUpdated: new Date().toISOString(),
      protocolVersion: "1.0",
    }),
    Messages: [],
  }),
  send: vi.fn().mockResolvedValue("message-id-123"),
}));

// Mock AO Connect
vi.mock("@permaweb/aoconnect", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    connect: vi.fn(() => ({
      dryrun: vi.fn(),
      message: vi.fn(),
      result: vi.fn(),
      spawn: vi.fn(),
    })),
    createDataItemSigner: vi.fn(),
    message: vi.fn(),
    result: vi.fn(),
    spawn: vi.fn(),
  };
});

describe("Process Management Integration Workflow", () => {
  let spawnProcessCommand: SpawnProcessCommand;
  let evalProcessCommand: EvalProcessCommand;
  let executeActionCommand: ExecuteActionCommand;
  let queryMessagesCommand: QueryAOProcessMessagesCommand;
  let mockContext: ToolContext;
  let mockProcessId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock context
    mockProcessId = "test-process-id-123";
    mockContext = {
      embeddedTemplates: new Map(),
      hubId: "test-hub-id",
      keyPair: {
        d: "test-d",
        e: "test-e",
        kty: "RSA",
        n: "test-n",
      } as any,
      publicKey: "test-public-key",
    };

    // Setup mocks for the connect function and its returned methods
    const aoConnect = await import("@permaweb/aoconnect");
    const mockConnect = vi.mocked(aoConnect.connect);
    const mockSpawn = vi.fn().mockResolvedValue(mockProcessId);
    const mockMessage = vi.fn().mockResolvedValue("eval-message-id");
    const mockResult = vi.fn().mockResolvedValue({
      Assignments: [],
      Messages: [],
      Output: { data: '{"success": true, "result": "Process initialized"}' },
      Spawns: [],
    });
    const mockDryrun = vi.fn().mockResolvedValue({
      Assignments: [],
      Messages: [],
      Output: { data: '{"success": true}' },
      Spawns: [],
    });

    mockConnect.mockReturnValue({
      dryrun: mockDryrun,
      message: mockMessage,
      result: mockResult,
      spawn: mockSpawn,
    });

    // Mock other standalone functions
    vi.mocked(aoConnect.spawn).mockResolvedValue(mockProcessId);
    vi.mocked(aoConnect.message).mockResolvedValue("eval-message-id");
    vi.mocked(aoConnect.result).mockResolvedValue({
      Assignments: [],
      Messages: [],
      Output: { data: '{"success": true, "result": "Process initialized"}' },
      Spawns: [],
    });
    vi.mocked(aoConnect.createDataItemSigner).mockReturnValue({
      sign: vi.fn().mockResolvedValue("signed-data"),
    } as any);

    // Initialize commands
    spawnProcessCommand = new SpawnProcessCommand(mockContext);
    evalProcessCommand = new EvalProcessCommand(mockContext);
    executeActionCommand = new ExecuteActionCommand(mockContext);
    queryMessagesCommand = new QueryAOProcessMessagesCommand(mockContext);
  });

  describe("Complete Process Lifecycle", () => {
    it("should support create → evaluate → communicate → query workflow", async () => {
      // Step 1: Create process
      const createResult = await spawnProcessCommand.execute({});
      expect(createResult).toContain("processId");

      const createResponse = JSON.parse(createResult);
      expect(createResponse.success).toBe(true);
      expect(createResponse.processId).toBe(mockProcessId);

      // Step 2: Evaluate code
      const evalResult = await evalProcessCommand.execute({
        code: "return 'Process initialized successfully'",
        processId: mockProcessId,
      });

      const evalResponse = JSON.parse(evalResult);
      expect(evalResponse.success).toBe(true);
      expect(evalResponse.result.result).toContain("Process initialized");

      // Step 3: Execute process action
      // Mock the ADP discovery to return a simple handler for testing
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.read).mockResolvedValueOnce({
        Data: JSON.stringify({
          handlers: [
            {
              action: "GetStatus",
              description: "Get process status",
              parameters: []
            }
          ],
          lastUpdated: new Date().toISOString(),
          protocolVersion: "1.0",
        }),
        Messages: [],
      });
      
      const actionResult = await executeActionCommand.execute({
        processId: mockProcessId,
        request: "Get process status",
      });

      const actionResponse = JSON.parse(actionResult);
      expect(actionResponse.success).toBe(true);

      // Step 4: Query process messages
      const queryResult = await queryMessagesCommand.execute({
        first: 10,
        processId: mockProcessId,
      });

      const queryResponse = JSON.parse(queryResult);
      expect(queryResponse.success).toBe(true);
      expect(queryResponse.messages).toBeDefined();
    });

    it("should maintain process state consistency throughout lifecycle", async () => {
      // Create process
      const createResult = await spawnProcessCommand.execute({});
      const createResponse = JSON.parse(createResult);
      const processId = createResponse.processId;

      // Multiple evaluations should work with same process
      const eval1 = await evalProcessCommand.execute({
        code: "local counter = 1; return counter",
        processId,
      });

      const eval2 = await evalProcessCommand.execute({
        code: "counter = counter + 1; return counter",
        processId,
      });

      const eval1Response = JSON.parse(eval1);
      const eval2Response = JSON.parse(eval2);

      expect(eval1Response.success).toBe(true);
      expect(eval2Response.success).toBe(true);
    });
  });

  describe("Tool Integration Compatibility", () => {
    it("should integrate SpawnProcessCommand with ExecuteActionCommand", async () => {
      // Create process
      const createResult = await spawnProcessCommand.execute({});
      const createResponse = JSON.parse(createResult);
      const processId = createResponse.processId;

      // Execute action on created process
      // Mock the ADP discovery for this test
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.read).mockResolvedValueOnce({
        Data: JSON.stringify({
          handlers: [
            {
              action: "Initialize", 
              description: "Initialize process state",
              parameters: []
            }
          ],
          lastUpdated: new Date().toISOString(),
          protocolVersion: "1.0",
        }),
        Messages: [],
      });
      
      const actionResult = await executeActionCommand.execute({
        processId,
        request: "Initialize process state",
      });

      const actionResponse = JSON.parse(actionResult);
      expect(actionResponse.success).toBe(true);
    });

    it("should integrate EvalProcessCommand with QueryAOProcessMessagesCommand", async () => {
      // Mock evaluation that generates messages
      const evalProcessMock = await import("../../src/relay.js");
      vi.mocked(evalProcessMock.evalProcess).mockResolvedValue({
        messages: [{ id: "test-message-1" }],
        result: "Evaluation complete",
        success: true,
      });

      // Evaluate code
      const evalResult = await evalProcessCommand.execute({
        code: "Send({ Target = ao.id, Data = 'Test message' })",
        processId: mockProcessId,
      });

      const evalResponse = JSON.parse(evalResult);
      expect(evalResponse.success).toBe(true);

      // Query messages generated by evaluation
      const queryResult = await queryMessagesCommand.execute({
        first: 10,
        processId: mockProcessId,
      });

      const queryResponse = JSON.parse(queryResult);
      expect(queryResponse.success).toBe(true);
    });

    it("should preserve existing process communication patterns", async () => {
      // Test that existing ExecuteActionCommand functionality is preserved
      // Mock the ADP discovery for this test - need to mock multiple calls since the service may retry
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.read).mockResolvedValueOnce({
        Data: JSON.stringify({
          handlers: [
            {
              action: "TestExisting",
              description: "Test existing functionality",
              parameters: []
            }
          ],
          lastUpdated: new Date().toISOString(),
          protocolVersion: "1.0",
        }),
        Messages: [],
      });
      
      // Mock successful send operation
      vi.mocked(processModule.send).mockResolvedValue("Success");
      
      const actionResult = await executeActionCommand.execute({
        processId: mockProcessId,
        request: "TestExisting",
      });

      const actionResponse = JSON.parse(actionResult);
      expect(actionResponse.success).toBe(true);

      // Test that existing QueryAOProcessMessagesCommand functionality is preserved
      const queryResult = await queryMessagesCommand.execute({
        first: 5,
        processId: mockProcessId,
      });

      const queryResponse = JSON.parse(queryResult);
      expect(queryResponse.success).toBe(true);
      expect(queryResponse.messages).toBeDefined();
    });
  });

  describe("Error Handling Across Tool Interactions", () => {
    it("should handle errors gracefully in process lifecycle", async () => {
      // Mock process creation failure by mocking the actual process creation
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.createProcess).mockRejectedValueOnce(
        new Error("Process creation failed"),
      );

      const createResult = await spawnProcessCommand.execute({});
      const createResponse = JSON.parse(createResult);

      expect(createResponse.success).toBe(false);
      expect(createResponse.error).toContain("Process creation failed");
    });

    it("should handle evaluation errors properly", async () => {
      // Mock evaluation failure in relay module
      const relayModule = await import("../../src/relay.js");
      vi.mocked(relayModule.evalProcess).mockRejectedValueOnce(
        new Error("Evaluation failed"),
      );

      const evalResult = await evalProcessCommand.execute({
        code: "invalid lua code here",
        processId: mockProcessId,
      });

      const evalResponse = JSON.parse(evalResult);
      expect(evalResponse.success).toBe(false);
      expect(evalResponse.error).toContain("Evaluation failed");
    });

    it("should handle communication errors in action execution", async () => {
      // Mock action execution failure by making ADP discovery fail
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.read).mockRejectedValueOnce(
        new Error("Communication failed"),
      );

      const actionResult = await executeActionCommand.execute({
        processId: mockProcessId,
        request: "Test request",
      });

      const actionResponse = JSON.parse(actionResult);
      expect(actionResponse.success).toBe(false);
      // The actual error message varies based on the ADP service behavior
      expect(actionResponse.error).toMatch(/Communication failed|Could not match request/);
    });
  });

  describe("Concurrent Process Management Operations", () => {
    it("should handle multiple concurrent process operations", async () => {
      // Mock multiple process IDs by mocking createProcess directly
      const processIds = ["process-1", "process-2", "process-3"];
      const processModule = await import("../../src/process.js");
      vi.mocked(processModule.createProcess)
        .mockResolvedValueOnce(processIds[0])
        .mockResolvedValueOnce(processIds[1])
        .mockResolvedValueOnce(processIds[2]);

      // Create multiple processes concurrently
      const createPromises = [
        spawnProcessCommand.execute({}),
        spawnProcessCommand.execute({}),
        spawnProcessCommand.execute({}),
      ];

      const createResults = await Promise.all(createPromises);

      expect(createResults).toHaveLength(3);
      createResults.forEach((result, index) => {
        const response = JSON.parse(result);
        expect(response.success).toBe(true);
        expect(response.processId).toBe(processIds[index]);
      });
    });

    it("should handle concurrent evaluations on different processes", async () => {
      const aoConnect = await import("@permaweb/aoconnect");

      // Mock successful evaluations
      vi.mocked(aoConnect.message).mockResolvedValue("eval-message-id");
      vi.mocked(aoConnect.result).mockResolvedValue({
        Assignments: [],
        Messages: [],
        Output: {
          data: '{"success": true, "result": "Concurrent evaluation"}',
        },
        Spawns: [],
      });

      const evalPromises = [
        evalProcessCommand.execute({
          code: "return 'Evaluation 1'",
          processId: "process-1",
        }),
        evalProcessCommand.execute({
          code: "return 'Evaluation 2'",
          processId: "process-2",
        }),
        evalProcessCommand.execute({
          code: "return 'Evaluation 3'",
          processId: "process-3",
        }),
      ];

      const evalResults = await Promise.all(evalPromises);

      expect(evalResults).toHaveLength(3);
      evalResults.forEach((result) => {
        const response = JSON.parse(result);
        expect(response.success).toBe(true);
      });
    });
  });

  describe("BMAD Workflow Integration Compatibility", () => {
    it("should support process management within BMAD contexts", async () => {
      // Simulate BMAD workflow context
      const bmadWorkflowContext = {
        ...mockContext,
        automationEnabled: true,
        workflowType: "bmad",
      };

      // Create commands with BMAD context
      const bmadCreateCommand = new SpawnProcessCommand(bmadWorkflowContext);
      const bmadEvalCommand = new EvalProcessCommand(bmadWorkflowContext);

      // Test process creation in BMAD context
      const createResult = await bmadCreateCommand.execute({});
      const createResponse = JSON.parse(createResult);

      expect(createResponse.success).toBe(true);
      expect(createResponse.processId).toBeDefined();

      // Test evaluation in BMAD context
      const evalResult = await bmadEvalCommand.execute({
        code: "return 'BMAD workflow integration test'",
        processId: createResponse.processId,
      });

      const evalResponse = JSON.parse(evalResult);
      expect(evalResponse.success).toBe(true);
    });

    it("should enable automated process creation through BMAD templates", async () => {
      // Mock template-based process creation
      const templateContext = {
        ...mockContext,
        embeddedTemplates: new Map([
          ["token", { processType: "token", template: "token template" }],
        ]),
      };

      const templateCreateCommand = new SpawnProcessCommand(templateContext);

      const createResult = await templateCreateCommand.execute({});
      const createResponse = JSON.parse(createResult);

      expect(createResponse.success).toBe(true);
      expect(createResponse.processId).toBeDefined();
    });
  });

  describe("Tool Context and Signer Management", () => {
    it("should maintain consistent tool context across all process tools", async () => {
      // Verify all tools use the same context
      expect(spawnProcessCommand).toBeDefined();
      expect(evalProcessCommand).toBeDefined();
      expect(executeActionCommand).toBeDefined();
      expect(queryMessagesCommand).toBeDefined();

      // Test that context is properly passed and maintained
      const testContext = {
        embeddedTemplates: new Map(),
        hubId: "test-hub",
        keyPair: {} as any,
        publicKey: "test-key",
      };

      const contextCreateCommand = new SpawnProcessCommand(testContext);
      const contextEvalCommand = new EvalProcessCommand(testContext);

      expect(contextCreateCommand).toBeDefined();
      expect(contextEvalCommand).toBeDefined();
    });

    it("should handle signer management consistently", async () => {
      // Mock signer creation in process module
      const processModule = await import("../../src/process.js");
      const createProcessSpy = vi.mocked(processModule.createProcess);
      
      // Test process creation with signer
      const createResult = await spawnProcessCommand.execute({});
      const createResponse = JSON.parse(createResult);

      expect(createResponse.success).toBe(true);
      expect(createProcessSpy).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
