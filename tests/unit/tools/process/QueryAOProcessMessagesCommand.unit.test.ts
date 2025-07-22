import { beforeEach, describe, expect, it, vi } from "vitest";

import { SortOrder } from "../../../../src/models/ArweaveGraphQL.js";
import { ToolContext } from "../../../../src/tools/core/index.js";
import { QueryAOProcessMessagesCommand } from "../../../../src/tools/process/commands/QueryAOProcessMessagesCommand.js";

// Mock the ArweaveGraphQLService
vi.mock("../../../../src/services/ArweaveGraphQLService.js", () => ({
  arweaveGraphQLService: {
    queryAOProcessMessages: vi.fn(),
  },
}));

describe("QueryAOProcessMessagesCommand", () => {
  let command: QueryAOProcessMessagesCommand;
  let mockContext: ToolContext;
  let mockArweaveGraphQLService: any;  

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,  
      publicKey: "test-public-key",
    };

    // Get the mocked service
    const { arweaveGraphQLService } = await import(
      "../../../../src/services/ArweaveGraphQLService.js"
    );
    mockArweaveGraphQLService = arweaveGraphQLService;

    command = new QueryAOProcessMessagesCommand(mockContext);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata;  
      expect(metadata.name).toBe("queryAOProcessMessages");
      expect(metadata.title).toBe("Query AO Process Messages");
      expect(metadata.readOnlyHint).toBe(true);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Query AO process messages and communication history",
      );
    });
  });

  describe("execute", () => {
    it("should query AO process messages successfully", async () => {
      const mockResult = {
        count: 2,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        transactions: [
          {
            block: { timestamp: "2024-01-01T12:00:00Z" },
            id: "tx1",
            owner: { address: "owner1" },
            tags: [
              { name: "Action", value: "Transfer" },
              { name: "App", value: "AO-Process" },
            ],
          },
          {
            block: { timestamp: "2024-01-01T11:30:00Z" },
            id: "tx2",
            owner: { address: "owner2" },
            tags: [
              { name: "Action", value: "Mint" },
              { name: "App", value: "AO-Process" },
            ],
          },
        ],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        action: "Transfer",
        first: 10,
        processId: "test-process-id",
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        action: "Transfer",
        first: 10,
        sort: "INGESTED_AT_DESC",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result.count).toBe(2);
      expect(parsedResult.result.transactions).toEqual(mockResult.transactions);
    });

    it("should handle GraphQL service errors", async () => {
      const mockError = new Error("GraphQL query failed");
      mockArweaveGraphQLService.queryAOProcessMessages.mockRejectedValue(
        mockError,
      );

      const args = {
        first: 10,
        processId: "test-process-id",
      };

      const result = await command.execute(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe(
        "Failed to query AO process messages: GraphQL query failed",
      );
    });

    it("should handle pagination parameters", async () => {
      const mockResult = {
        count: 1,
        pageInfo: { hasNextPage: true, hasPreviousPage: false },
        transactions: [],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        after: "cursor123",
        first: 5,
        processId: "test-process-id",
        sort: SortOrder.ASC,
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        after: "cursor123",
        first: 5,
        sort: "INGESTED_AT_DESC",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it("should handle message reference filtering", async () => {
      const mockResult = {
        count: 1,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        transactions: [],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        msgRefs: ["msg1", "msg2"],
        processId: "test-process-id",
        reference: "ref123",
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        first: 10,
        msgRefs: ["msg1", "msg2"],
        sort: "INGESTED_AT_DESC",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it("should handle process communication filtering", async () => {
      const mockResult = {
        count: 1,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        transactions: [],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        action: "Message",
        fromProcessId: "process1",
        toProcessId: "process2",
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        action: "Message",
        first: 10,
        fromProcessId: "process1",
        sort: "INGESTED_AT_DESC",
        toProcessId: "process2",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it("should handle empty results", async () => {
      const mockResult = {
        count: 0,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        transactions: [],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        processId: "nonexistent-process",
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        first: 10,
        sort: "INGESTED_AT_DESC",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.result.count).toBe(0);
    });

    it("should handle sort order parameters", async () => {
      const mockResult = {
        count: 1,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        transactions: [],
      };
      mockArweaveGraphQLService.queryAOProcessMessages.mockResolvedValue(
        mockResult,
      );

      const args = {
        before: "cursor456",
        last: 20,
        processId: "test-process-id",
        sort: SortOrder.DESC,
        sortOrder: SortOrder.DESC,
      };

      const result = await command.execute(args);

      expect(
        mockArweaveGraphQLService.queryAOProcessMessages,
      ).toHaveBeenCalledWith({
        first: 10,
        sort: "INGESTED_AT_DESC",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });
});
