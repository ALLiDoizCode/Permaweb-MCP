import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { ExecuteProcessActionCommand } from "../../../../src/tools/process/commands/ExecuteProcessActionCommand.js";

// Mock the ProcessCommunicationService
vi.mock("../../../../src/services/ProcessCommunicationService.js", () => ({
  processCommunicationService: {
    executeProcessRequest: vi.fn(),
  },
}));

describe("ExecuteProcessActionCommand", () => {
  let command: ExecuteProcessActionCommand;
  let mockContext: ToolContext;
  let mockProcessCommunicationService: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      publicKey: "test-public-key",
    };

    // Get the mocked service
    const { processCommunicationService } = await import(
      "../../../../src/services/ProcessCommunicationService.js"
    );
    mockProcessCommunicationService = processCommunicationService;

    command = new ExecuteProcessActionCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(metadata.name).toBe("executeProcessAction");
      expect(metadata.title).toBe("Execute Process Action");
      expect(metadata.readOnlyHint).toBe(false);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Execute actions on AO processes using natural language",
      );
    });
  });

  describe("execute", () => {
    it("should execute process request successfully", async () => {
      const mockResult = {
        data: "Process executed successfully",
        success: true,
      };
      mockProcessCommunicationService.executeProcessRequest.mockResolvedValue(
        mockResult,
      );

      const args = {
        processId: "test-process-id",
        processMarkdown: "# Test Process\n\nHandles test actions",
        request: "Execute test action",
      };

      const result = await command.execute(args);

      expect(
        mockProcessCommunicationService.executeProcessRequest,
      ).toHaveBeenCalledWith(
        args.processMarkdown,
        args.processId,
        args.request,
        mockContext.keyPair,
      );
      expect(result).toBe(JSON.stringify(mockResult));
    });

    it("should handle process communication service errors", async () => {
      const mockError = new Error("Process communication failed");
      mockProcessCommunicationService.executeProcessRequest.mockRejectedValue(
        mockError,
      );

      const args = {
        processId: "test-process-id",
        processMarkdown: "# Test Process\n\nHandles test actions",
        request: "Execute test action",
      };

      const result = await command.execute(args);

      expect(result).toBe("Error: Error: Process communication failed");
    });

    it("should handle invalid process ID", async () => {
      const mockError = new Error("Invalid process ID");
      mockProcessCommunicationService.executeProcessRequest.mockRejectedValue(
        mockError,
      );

      const args = {
        processId: "invalid-process-id",
        processMarkdown: "# Test Process\n\nHandles test actions",
        request: "Execute test action",
      };

      const result = await command.execute(args);

      expect(result).toBe("Error: Error: Invalid process ID");
    });

    it("should pass keyPair from context to service", async () => {
      const mockResult = { success: true };
      mockProcessCommunicationService.executeProcessRequest.mockResolvedValue(
        mockResult,
      );

      const args = {
        processId: "test-process-id",
        processMarkdown: "# Test Process",
        request: "Test request",
      };

      await command.execute(args);

      expect(
        mockProcessCommunicationService.executeProcessRequest,
      ).toHaveBeenCalledWith(
        args.processMarkdown,
        args.processId,
        args.request,
        mockContext.keyPair,
      );
    });

    it("should handle natural language process interaction", async () => {
      const mockResult = {
        action: "transfer",
        processId: "test-process-id",
        result: "Transfer completed",
        success: true,
      };
      mockProcessCommunicationService.executeProcessRequest.mockResolvedValue(
        mockResult,
      );

      const args = {
        processId: "test-process-id",
        processMarkdown:
          "# Token Process\n\n## Transfer\nTransfer tokens between addresses",
        request: "Transfer 100 tokens to user123",
      };

      const result = await command.execute(args);

      expect(
        mockProcessCommunicationService.executeProcessRequest,
      ).toHaveBeenCalledWith(
        args.processMarkdown,
        args.processId,
        args.request,
        mockContext.keyPair,
      );
      expect(result).toBe(JSON.stringify(mockResult));
    });
  });
});
