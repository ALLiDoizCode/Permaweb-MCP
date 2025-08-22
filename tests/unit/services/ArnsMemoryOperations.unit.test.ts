import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aiMemoryService,
  MEMORY_KINDS,
} from "../../../src/services/aiMemoryService.js";

// Mock dependencies
vi.mock("../../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEventsVIP01: vi.fn(),
}));

// Get references to the mocked functions
const mockEvent = vi.mocked(await import("../../../src/relay.js")).event;
const mockFetchEventsVIP01 = vi.mocked(
  await import("../../../src/relay.js"),
).fetchEventsVIP01;

describe("ArNS Memory Operations", () => {
  const mockKeyPair = { test: "keypair" } as any;
  const mockHubId = "test-hub-id";
  const mockPublicKey = "test-public-key";

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent.mockReset();
    mockFetchEventsVIP01.mockReset();
  });

  describe("addArnsRecord", () => {
    it("should store ArNS registration record successfully", async () => {
      mockEvent.mockResolvedValue(["mock-tag-result"]);

      const result = await aiMemoryService.addArnsRecord(
        mockKeyPair,
        mockHubId,
        "example.ar",
        "abc123def456ghi789jkl012mno345pqr678stu901vwx",
        "registration",
        { type: "lease", years: 1 },
        mockPublicKey,
      );

      expect(result).toContain("ArNS record stored");
      expect(mockEvent).toHaveBeenCalledWith(
        mockKeyPair,
        mockHubId,
        expect.arrayContaining([
          { name: "Kind", value: MEMORY_KINDS.ARNS_MAPPING },
          {
            name: "Content",
            value: expect.stringContaining("ArNS registration: example.ar"),
          },
          { name: "p", value: mockPublicKey },
          { name: "arns_name", value: "example.ar" },
          {
            name: "arns_transaction",
            value: "abc123def456ghi789jkl012mno345pqr678stu901vwx",
          },
          { name: "arns_operation", value: "registration" },
          { name: "domain", value: "arns" },
          { name: "arns_type", value: "lease" },
          { name: "arns_years", value: "1" },
        ]),
      );
    });

    it("should store ArNS transfer record successfully", async () => {
      mockEvent.mockResolvedValue(["mock-tag-result"]);

      const result = await aiMemoryService.addArnsRecord(
        mockKeyPair,
        mockHubId,
        "example.ar",
        "def456ghi789jkl012mno345pqr678stu901vwxyzabc",
        "transfer",
        { newOwner: "xyz789def456ghi789jkl012mno345pqr678stu901abc" },
        mockPublicKey,
      );

      expect(result).toContain("ArNS record stored");
      expect(mockEvent).toHaveBeenCalledWith(
        mockKeyPair,
        mockHubId,
        expect.arrayContaining([
          { name: "arns_operation", value: "transfer" },
          {
            name: "arns_newOwner",
            value: "xyz789def456ghi789jkl012mno345pqr678stu901abc",
          },
        ]),
      );
    });

    it("should validate required fields", async () => {
      await expect(
        aiMemoryService.addArnsRecord(
          mockKeyPair,
          mockHubId,
          "",
          "transaction-id",
          "registration",
          {},
          mockPublicKey,
        ),
      ).rejects.toThrow("ArNS name is required");

      await expect(
        aiMemoryService.addArnsRecord(
          mockKeyPair,
          mockHubId,
          "example.ar",
          "",
          "registration",
          {},
          mockPublicKey,
        ),
      ).rejects.toThrow("Transaction ID is required");

      await expect(
        aiMemoryService.addArnsRecord(
          mockKeyPair,
          mockHubId,
          "example.ar",
          "transaction-id",
          "registration",
          {},
          "",
        ),
      ).rejects.toThrow("Public key p is required");
    });
  });

  describe("getArnsOperationHistory", () => {
    it("should retrieve ArNS operation history for specific name", async () => {
      mockFetchEventsVIP01.mockResolvedValue({
        events: [
          {
            arns_name: "example.ar",
            arns_operation: "registration",
            content: "ArNS registration: example.ar -> transaction1",
            id: "event1",
            timestamp: new Date().toISOString(),
          },
          {
            arns_name: "example.ar",
            arns_operation: "transfer",
            content: "ArNS transfer: example.ar -> transaction2",
            id: "event2",
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await aiMemoryService.getArnsOperationHistory(
        mockHubId,
        "example.ar",
      );

      expect(result).toHaveLength(2);
      expect(mockFetchEventsVIP01).toHaveBeenCalledWith(
        mockHubId,
        expect.objectContaining({
          kinds: [MEMORY_KINDS.ARNS_MAPPING],
          tags: { arns_name: ["example.ar"] },
        }),
      );
    });

    it("should filter by operation type", async () => {
      mockFetchEventsVIP01.mockResolvedValue({ events: [] });

      await aiMemoryService.getArnsOperationHistory(
        mockHubId,
        "example.ar",
        "transfer",
      );

      expect(mockFetchEventsVIP01).toHaveBeenCalledWith(
        mockHubId,
        expect.objectContaining({
          tags: {
            arns_name: ["example.ar"],
            arns_operation: ["transfer"],
          },
        }),
      );
    });
  });

  describe("searchArnsRecords", () => {
    it("should search ArNS records by query", async () => {
      mockFetchEventsVIP01.mockResolvedValue({
        events: [
          {
            content: "ArNS registration: example.ar -> transaction1",
            domain: "arns",
            id: "event1",
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await aiMemoryService.searchArnsRecords(
        mockHubId,
        "example",
      );

      expect(result).toHaveLength(1);
      expect(mockFetchEventsVIP01).toHaveBeenCalledWith(
        mockHubId,
        expect.objectContaining({
          kinds: [MEMORY_KINDS.ARNS_MAPPING],
          search: "example",
        }),
      );
    });

    it("should return all ArNS records when no query provided", async () => {
      mockFetchEventsVIP01.mockResolvedValue({ events: [] });

      await aiMemoryService.searchArnsRecords(mockHubId);

      expect(mockFetchEventsVIP01).toHaveBeenCalledWith(
        mockHubId,
        expect.objectContaining({
          kinds: [MEMORY_KINDS.ARNS_MAPPING],
          limit: 100,
        }),
      );
    });
  });

  describe("MEMORY_KINDS", () => {
    it("should have ARNS_MAPPING kind defined", () => {
      expect(MEMORY_KINDS.ARNS_MAPPING).toBe("35");
    });
  });
});
