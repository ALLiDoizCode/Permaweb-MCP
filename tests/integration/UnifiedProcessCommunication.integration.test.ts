import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProcessCacheService } from "../../src/services/ProcessCacheService.js";
import { processCommunicationService } from "../../src/services/ProcessCommunicationService.js";
import { ToolContext } from "../../src/tools/core/index.js";
import { AOProcessCommunicateCommand } from "../../src/tools/process/commands/AOProcessCommunicateCommand.js";

// Mock dependencies
vi.mock("../../src/services/ProcessCacheService.js");
vi.mock("../../src/tools/core/index.js", () => ({
  AutoSafeToolContext: {
    from: vi.fn(),
  },
  CommonSchemas: {
    processId: {
      describe: vi.fn().mockReturnValue({
        describe: vi.fn(),
      }),
    },
  },
  ToolCommand: class {
    constructor() {}
  },
  ToolContext: class {
    constructor() {}
  },
  ToolMetadata: {},
}));

describe("UnifiedProcessCommunication Integration Tests", () => {
  let command: AOProcessCommunicateCommand;
  let mockContext: ToolContext;
  let mockKeyPair: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockKeyPair = { mockKey: "test-key" };
    mockContext = {
      embeddedTemplates: new Map(),
    } as any;

    // Mock AutoSafeToolContext
    const mockSafeContext = {
      getKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
    };

    const { AutoSafeToolContext } = await import(
      "../../src/tools/core/index.js"
    );
    vi.mocked(AutoSafeToolContext.from).mockReturnValue(mockSafeContext);

    command = new AOProcessCommunicateCommand(mockContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("End-to-end unified communication", () => {
    it("should handle complete workflow from request to response", async () => {
      const args = {
        mode: "auto" as const,
        processId: "test-process-123",
        request: "get balance for alice",
      };

      // Mock process cache response
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: [
          {
            action: "Balance",
            description: "Get token balance",
            examples: [],
            isWrite: false,
            parameters: [],
          },
        ],
        processMarkdown:
          "# Token Process\n## Balance\nGet token balance\n- Target: address (optional)",
        success: true,
      });

      // Mock ProcessCommunicationService
      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        data: {
          account: "alice",
          balance: "1000",
          ticker: "TEST",
        },
        handlerUsed: "Balance",
        parameters: { Target: "alice" },
        success: true,
      });

      // Replace the actual service method
      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("read");
      expect(parsed.handlerUsed).toBe("Balance");
      expect(parsed.result.details.balance).toBe("1000");
      expect(parsed.result.summary).toBe("Operation completed successfully");
      expect(mockExecuteProcessRequest).toHaveBeenCalledWith(
        expect.stringContaining("Token Process"),
        "test-process-123",
        "get balance for alice",
        mockKeyPair,
      );
    });

    it("should handle write operations with transaction info", async () => {
      const args = {
        mode: "auto" as const,
        processId: "test-token-456",
        request: "transfer 100 tokens to bob",
      };

      // Mock process cache with token process info
      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: [
          {
            action: "Transfer",
            description: "Transfer tokens",
            examples: [],
            isWrite: true,
            parameters: [
              { name: "Target", required: true, type: "address" },
              { name: "Quantity", required: true, type: "string" },
            ],
          },
        ],
        processMarkdown:
          "# Token Process\n## Transfer\nTransfer tokens\n- Target: recipient\n- Quantity: amount",
        success: true,
      });

      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        data: {
          from: "sender-address",
          to: "bob",
          transactionId: "tx-789",
          transferred: "100",
        },
        handlerUsed: "Transfer",
        parameters: { Quantity: "100", Target: "bob" },
        success: true,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("write");
      expect(parsed.handlerUsed).toBe("Transfer");
      expect(parsed.transaction).toBeDefined();
      expect(parsed.transaction?.status).toBe("pending");
      expect(parsed.result.details.transferred).toBe("100");
    });

    it("should handle validation mode without execution", async () => {
      const args = {
        processId: "test-process-789",
        request: "mint 500 tokens",
        validateOnly: true,
      };

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operation).toBe("validate");
      expect(parsed.result.details.validationStatus).toBe("completed");

      // Should not call ProcessCacheService when in validateOnly mode
      expect(ProcessCacheService.getProcessInfo).not.toHaveBeenCalled();
    });
  });

  describe("Tool factory integration", () => {
    it("should be properly registered in ProcessToolFactory", async () => {
      // Test that AOProcessCommunicateCommand can be instantiated and has correct metadata
      const unifiedCommand = new AOProcessCommunicateCommand(mockContext);
      const metadata = (unifiedCommand as any).metadata;

      expect(metadata).toBeDefined();
      expect(metadata.name).toBe("aoProcessCommunicate");
      expect(metadata.title).toBe("Unified AO Process Communication");
      expect(metadata.description).toContain("Single intelligent tool");
    });
  });

  describe("Migration compatibility", () => {
    it("should work alongside existing executeAction tool during migration", async () => {
      const { ExecuteActionCommand } = await import(
        "../../src/tools/process/commands/ExecuteActionCommand.js"
      );

      const executeActionCommand = new ExecuteActionCommand(mockContext);
      const unifiedCommand = new AOProcessCommunicateCommand(mockContext);

      // Both should be available
      expect(executeActionCommand).toBeDefined();
      expect(unifiedCommand).toBeDefined();

      // ExecuteActionCommand should show deprecation warning
      const executeActionMetadata = (executeActionCommand as any).metadata;
      expect(executeActionMetadata.description).toContain("DEPRECATED");
      expect(executeActionMetadata.description).toContain(
        "aoProcessCommunicate",
      );
    });

    it("should work alongside existing sendMessage tool during migration", async () => {
      const { SendMessageCommand } = await import(
        "../../src/tools/process/commands/SendMessageCommand.js"
      );

      const sendMessageCommand = new SendMessageCommand(mockContext);
      const unifiedCommand = new AOProcessCommunicateCommand(mockContext);

      // Both should be available
      expect(sendMessageCommand).toBeDefined();
      expect(unifiedCommand).toBeDefined();

      // SendMessageCommand should show deprecation warning
      const sendMessageMetadata = (sendMessageCommand as any).metadata;
      expect(sendMessageMetadata.description).toContain("DEPRECATED");
      expect(sendMessageMetadata.description).toContain("aoProcessCommunicate");
    });
  });

  describe("Error handling and resilience", () => {
    it("should gracefully handle process cache failures", async () => {
      const args = {
        processId: "failing-process-123",
        request: "get info",
      };

      // Mock ProcessCacheService to throw error
      vi.mocked(ProcessCacheService.getProcessInfo).mockRejectedValue(
        new Error("Process cache unavailable"),
      );

      // Mock ProcessCommunicationService to also fail when no process info
      const mockExecuteSmartRequest = vi
        .fn()
        .mockRejectedValue(new Error("Unable to execute without process info"));
      vi.spyOn(
        processCommunicationService,
        "executeSmartRequest",
      ).mockImplementation(mockExecuteSmartRequest);

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.result.details.error).toBe(
        "Unable to execute without process info",
      );
      expect(parsed.operation).toBe("unknown");
    });

    it("should handle malformed process markdown gracefully", async () => {
      const args = {
        processId: "test-process-456",
        request: "test action",
      };

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: [],
        processMarkdown: "Invalid markdown without proper headers",
        success: true,
      });

      const mockExecuteProcessRequest = vi.fn().mockResolvedValue({
        error: "Could not match request to any available handler",
        success: false,
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.result.summary).toContain("Could not match request");
    });
  });

  describe("Performance and formatting", () => {
    it("should track execution time accurately", async () => {
      const args = {
        processId: "test-process-789",
        request: "get balance",
      };

      vi.mocked(ProcessCacheService.getProcessInfo).mockResolvedValue({
        handlers: [],
        processMarkdown: "# Test\n## Balance\nGet balance",
        success: true,
      });

      const mockExecuteProcessRequest = vi.fn().mockImplementation(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          data: { balance: "100" },
          handlerUsed: "Balance",
          success: true,
        };
      });

      vi.spyOn(
        processCommunicationService,
        "executeProcessRequest",
      ).mockImplementation(mockExecuteProcessRequest);

      const result = await command.execute(args);
      const parsed = JSON.parse(result);

      expect(parsed.executionTime).toBeGreaterThan(0);
      expect(parsed.executionTime).toBeLessThan(1000); // Should be reasonable
    });

    it("should format responses according to formatting parameter", async () => {
      const compactArgs = {
        formatting: "compact" as const,
        processId: "test-process",
        request: "test",
        validateOnly: true,
      };

      const detailedArgs = {
        ...compactArgs,
        formatting: "detailed" as const,
      };

      const compactResult = await command.execute(compactArgs);
      const detailedResult = await command.execute(detailedArgs);

      // Compact should have no pretty-printing
      expect(compactResult).not.toContain("  ");

      // Detailed should have pretty-printing
      expect(detailedResult).toContain("  ");
    });
  });
});
