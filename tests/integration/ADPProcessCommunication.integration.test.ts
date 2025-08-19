import { beforeEach, describe, expect, it, vi } from "vitest";

import { aoMessageService } from "../../src/services/AOMessageService.js";
import { DocumentationProtocolService } from "../../src/services/DocumentationProtocolService.js";
import { ExecuteActionCommand } from "../../src/tools/process/commands/ExecuteActionCommand.js";

// Mock external dependencies but allow DocumentationProtocolService to work
vi.mock("../../src/services/AOMessageService.js", () => ({
  aoMessageService: {
    executeMessage: vi.fn(),
  },
}));

describe("ADP Process Communication Integration", () => {
  let command: ExecuteActionCommand;
  let mockContext: any;
  let mockKeyPair: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKeyPair = { mock: "keypair" };
    mockContext = {
      embeddedTemplates: new Map(),
      getKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
    };

    command = new ExecuteActionCommand(mockContext);
    ExecuteActionCommand.clearADPCache();
  });

  describe("End-to-End ADP Communication", () => {
    it("should perform complete ADP workflow with token process", async () => {
      // Mock ADP-compliant token process response
      const tokenAdpResponse = {
        capabilities: {
          supportsExamples: true,
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
          supportsTagValidation: true,
        },
        handlers: [
          {
            action: "Info",
            category: "core" as const,
            description: "Get token information",
            pattern: ["Action"],
          },
          {
            action: "Balance",
            category: "core" as const,
            description: "Get token balance for address",
            parameters: [
              {
                description: "Address to check balance for",
                examples: ["user-address-123"],
                name: "Target",
                required: false,
                type: "address" as const,
              },
            ],
            pattern: ["Action"],
          },
          {
            action: "Transfer",
            category: "core" as const,
            description: "Transfer tokens to another address",
            parameters: [
              {
                description: "Recipient address",
                examples: ["recipient-address-456"],
                name: "Target",
                required: true,
                type: "address" as const,
              },
              {
                description: "Amount to transfer",
                examples: ["100", "1000"],
                name: "Quantity",
                required: true,
                type: "string" as const,
                validation: {
                  pattern: "^[0-9]+$",
                },
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        Name: "Test Token",
        protocolVersion: "1.0",
        Ticker: "TEST",
      };

      // Mock Info request (ADP discovery)
      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(tokenAdpResponse) },
          success: true,
        })
        // Mock Transfer execution
        .mockResolvedValueOnce({
          data: {
            Data: JSON.stringify({
              From: "sender-123",
              Message: "Transfer completed",
              Quantity: "100",
              Status: "Success",
              To: "alice-456",
            }),
          },
          success: true,
        });

      const result = await command.execute({
        processId: "token-process-123",
        request: "transfer 100 tokens to alice-456",
      });

      const parsed = JSON.parse(result);

      // Verify ADP approach was used
      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Transfer");
      expect(parsed.confidence).toBeGreaterThan(0);

      // Verify parameters were extracted correctly
      expect(parsed.parametersUsed).toMatchObject({
        Quantity: "100",
        Target: "alice-456",
      });

      // Verify ADP discovery and execution calls
      expect(vi.mocked(aoMessageService.executeMessage)).toHaveBeenCalledTimes(
        2,
      );

      // First call should be Info request
      expect(
        vi.mocked(aoMessageService.executeMessage),
      ).toHaveBeenNthCalledWith(1, mockKeyPair, {
        isWrite: false,
        processId: "token-process-123",
        tags: [{ name: "Action", value: "Info" }],
      });

      // Second call should be Transfer with proper tags
      expect(
        vi.mocked(aoMessageService.executeMessage),
      ).toHaveBeenNthCalledWith(2, mockKeyPair, {
        isWrite: true,
        processId: "token-process-123",
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Target", value: "alice-456" },
          { name: "Quantity", value: "100" },
        ],
      });
    });

    it("should handle complex DAO process with validation", async () => {
      const daoAdpResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          {
            action: "Propose",
            category: "core" as const,
            description: "Create a new proposal",
            parameters: [
              {
                description: "Proposal title",
                name: "Title",
                required: true,
                type: "string" as const,
              },
              {
                description: "Detailed proposal description",
                name: "Description",
                required: true,
                type: "string" as const,
              },
              {
                description: "Voting duration in blocks",
                name: "Duration",
                required: false,
                type: "number" as const,
                validation: {
                  max: 100000,
                  min: 1,
                },
              },
            ],
            pattern: ["Action"],
          },
          {
            action: "Vote",
            category: "core" as const,
            description: "Vote on a proposal",
            parameters: [
              {
                description: "ID of proposal to vote on",
                name: "ProposalId",
                required: true,
                type: "string" as const,
              },
              {
                description: "Vote choice",
                name: "Choice",
                required: true,
                type: "string" as const,
                validation: {
                  enum: ["yes", "no", "abstain"],
                },
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        Name: "Test DAO",
        protocolVersion: "1.0",
      };

      // Mock ADP discovery and successful vote
      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(daoAdpResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: {
            Data: JSON.stringify({
              ProposalId: "prop-123",
              Status: "Success",
              Vote: "yes",
              Voter: "voter-456",
            }),
          },
          success: true,
        });

      const result = await command.execute({
        processId: "dao-process-789",
        request: "vote yes on prop-123",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Vote");
      expect(parsed.parametersUsed).toMatchObject({
        Choice: "yes",
        ProposalId: "prop-123",
      });
    });

    it("should perform graceful fallback for non-ADP processes", async () => {
      // Mock legacy process response (no ADP metadata)
      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: "Token Name: Legacy Token" },
        success: true,
      });

      const result = await command.execute({
        processId: "legacy-process-456",
        processMarkdown: `
# Legacy Token

## Info
Get token information

## Balance
Get token balance
        `,
        request: "get info",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("legacy");
      // Should still work with legacy system
      expect(parsed).toBeDefined();
    });
  });

  describe("Performance and Caching Integration", () => {
    it("should cache ADP responses and reuse across requests", async () => {
      const tokenAdpResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          {
            action: "Balance",
            category: "core" as const,
            description: "Get token balance",
            pattern: ["Action"],
          },
          {
            action: "Transfer",
            category: "core" as const,
            description: "Transfer tokens",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address" as const,
              },
              {
                description: "Amount to transfer",
                name: "Quantity",
                required: true,
                type: "string" as const,
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        Name: "Cached Token",
        protocolVersion: "1.0",
      };

      // Mock Info response only once (should be cached after first call)
      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(tokenAdpResponse) },
          success: true,
        })
        .mockResolvedValue({
          data: { Data: "Balance: 500" },
          success: true,
        });

      // First request - should trigger ADP discovery
      const result1 = await command.execute({
        processId: "cached-process",
        request: "check balance",
      });

      // Second request - should use cached ADP data
      const result2 = await command.execute({
        processId: "cached-process",
        request: "get balance",
      });

      const parsed1 = JSON.parse(result1);
      const parsed2 = JSON.parse(result2);

      expect(parsed1.approach).toBe("ADP");
      expect(parsed2.approach).toBe("ADP");
      expect(parsed1.handlerUsed).toBe("Balance");
      expect(parsed2.handlerUsed).toBe("Balance");

      // Verify Info was called only once (cached on second request)
      // Total calls should be: 1 Info + 1 Balance + 1 Balance = 3
      expect(vi.mocked(aoMessageService.executeMessage)).toHaveBeenCalledTimes(
        3,
      );
    });

    it("should handle multiple processes with separate cache entries", async () => {
      const tokenResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          { action: "Balance", category: "core" as const, pattern: ["Action"] },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        Name: "Token A",
        protocolVersion: "1.0",
      };

      const daoResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          { action: "Vote", category: "core" as const, pattern: ["Action"] },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        Name: "DAO B",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(tokenResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: { Data: "Balance: 100" },
          success: true,
        })
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(daoResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          data: { Data: "Vote recorded" },
          success: true,
        });

      // Request to token process
      const tokenResult = await command.execute({
        processId: "token-process",
        request: "balance",
      });

      // Request to DAO process
      const daoResult = await command.execute({
        processId: "dao-process",
        request: "vote",
      });

      const tokenParsed = JSON.parse(tokenResult);
      const daoParsed = JSON.parse(daoResult);

      expect(tokenParsed.handlerUsed).toBe("Balance");
      expect(daoParsed.handlerUsed).toBe("Vote");

      // Verify cache stats
      const cacheStats = ExecuteActionCommand.getADPCacheStats();
      expect(cacheStats.size).toBe(2);
      expect(cacheStats.entries).toContain("token-process");
      expect(cacheStats.entries).toContain("dao-process");
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle network failures during ADP discovery", async () => {
      vi.mocked(aoMessageService.executeMessage).mockRejectedValue(
        new Error("Network timeout"),
      );

      const result = await command.execute({
        processId: "unreachable-process",
        processMarkdown: "# Fallback\n## Test\nTest handler",
        request: "test request",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("legacy");
    });

    it("should handle process execution failures gracefully", async () => {
      const adpResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          {
            action: "FailingAction",
            category: "core" as const,
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage)
        .mockResolvedValueOnce({
          data: { Data: JSON.stringify(adpResponse) },
          success: true,
        })
        .mockResolvedValueOnce({
          error: "Process execution failed",
          success: false,
        });

      const result = await command.execute({
        processId: "failing-process",
        request: "failing action",
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Process execution failed");
    });
  });

  describe("Parameter Validation Integration", () => {
    it("should validate required parameters and fail appropriately", async () => {
      const strictAdpResponse = {
        capabilities: {
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          {
            action: "StrictTransfer",
            category: "core" as const,
            description: "Strict transfer requiring exact parameters",
            parameters: [
              {
                description: "Recipient address",
                name: "Target",
                required: true,
                type: "address" as const,
                validation: {
                  pattern: "^[a-zA-Z0-9_-]{43}$",
                },
              },
              {
                description: "Amount to transfer",
                name: "Quantity",
                required: true,
                type: "string" as const,
                validation: {
                  pattern: "^[0-9]+$",
                },
              },
            ],
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00Z",
        protocolVersion: "1.0",
      };

      vi.mocked(aoMessageService.executeMessage).mockResolvedValue({
        data: { Data: JSON.stringify(strictAdpResponse) },
        success: true,
      });

      // Test with missing required parameter
      const result = await command.execute({
        processId: "strict-process",
        request: "transfer tokens", // Missing target and quantity
      });

      const parsed = JSON.parse(result);
      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Parameter validation failed");
    });
  });
});
