import { beforeEach, describe, expect, it, vi } from "vitest";

import { SaveAddressMappingCommand } from "../../../../../src/tools/contact/commands/SaveAddressMappingCommand.js";

// Mock dependencies
vi.mock("../../../../../src/relay.js", () => ({
  event: vi.fn(),
}));

// Get a reference to the mocked function
const mockEvent = vi.mocked(await import("../../../../../src/relay.js")).event;

vi.mock("../../../../../src/tools/core/index.js", () => ({
  AutoSafeToolContext: {
    from: vi.fn(() => ({
      initializeAll: vi.fn().mockResolvedValue({
        hubId: "test-hub-id",
        keyPair: { test: "keypair" },
        publicKey: "test-public-key",
      }),
    })),
  },
  CommonSchemas: {
    addressOrArnsName: {
      describe: vi.fn(() => ({
        parse: vi.fn((value: string) => value),
        safeParse: vi.fn((value: string) => ({
          data: value,
          success: true,
        })),
      })),
    },
  },
  ToolCommand: class {
    protected metadata: any;
    protected parametersSchema: any;
  },
}));

describe("SaveAddressMappingCommand", () => {
  let command: SaveAddressMappingCommand;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent.mockReset();
    mockContext = {};
    command = new SaveAddressMappingCommand(mockContext);
  });

  describe("execute", () => {
    it("should handle event creation failure gracefully", async () => {
      mockEvent.mockRejectedValue(new Error("Network error"));

      const result = await command.execute({
        address: "test.ar",
        name: "TestUser",
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Failed to save contact mapping");
      expect(parsed.error).toContain("Network error");
    });

    it("should save direct address mapping successfully", async () => {
      const mockTags = ["mock-tag-result"];
      mockEvent.mockResolvedValue(mockTags);

      const result = await command.execute({
        address: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG", // 43-char address
        name: "Alice",
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.mapping.name).toBe("Alice");
      expect(parsed.mapping.address).toBe(
        "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
      );
      expect(parsed.message).toContain("Contact mapping saved");

      // Verify event was called with correct tags
      expect(mockEvent).toHaveBeenCalledWith(
        { test: "keypair" },
        "test-hub-id",
        expect.arrayContaining([
          { name: "Kind", value: "31" },
          { name: "contact_name", value: "Alice" },
          {
            name: "contact_address",
            value: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
          },
          { name: "address_type", value: "direct" },
          { name: "domain", value: "address-book" },
        ]),
      );
    });

    it("should save ArNS name mapping successfully", async () => {
      const mockTags = ["mock-tag-result"];
      mockEvent.mockResolvedValue(mockTags);

      const result = await command.execute({
        address: "example.ar",
        name: "Bob",
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.mapping.name).toBe("Bob");
      expect(parsed.mapping.address).toBe("example.ar");
      expect(parsed.message).toContain("Contact mapping saved");

      // Verify event was called with correct tags including ArNS type
      expect(mockEvent).toHaveBeenCalledWith(
        { test: "keypair" },
        "test-hub-id",
        expect.arrayContaining([
          { name: "Kind", value: "31" },
          { name: "contact_name", value: "Bob" },
          { name: "contact_address", value: "example.ar" },
          { name: "address_type", value: "arns" },
          { name: "domain", value: "address-book" },
        ]),
      );
    });

    it("should save undername mapping successfully", async () => {
      const mockTags = ["mock-tag-result"];
      mockEvent.mockResolvedValue(mockTags);

      const result = await command.execute({
        address: "sub.example.ar",
        name: "Charlie",
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.mapping.address).toBe("sub.example.ar");

      // Verify ArNS type is set for undernames
      expect(mockEvent).toHaveBeenCalledWith(
        { test: "keypair" },
        "test-hub-id",
        expect.arrayContaining([{ name: "address_type", value: "arns" }]),
      );
    });

    it("should include all required tags in the event", async () => {
      const mockTags = ["mock-result"];
      mockEvent.mockResolvedValue(mockTags);

      await command.execute({
        address: "direct-address-123456789012345678901234567890123",
        name: "TestContact",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.any(Object),
        "test-hub-id",
        expect.arrayContaining([
          { name: "Kind", value: "31" }, // MEMORY_KINDS.CONTACT_MAPPING
          {
            name: "Content",
            value: expect.stringContaining("Contact mapping"),
          },
          { name: "p", value: "test-public-key" },
          { name: "contact_name", value: "TestContact" },
          {
            name: "contact_address",
            value: "direct-address-123456789012345678901234567890123",
          },
          { name: "address_type", value: "direct" },
          { name: "domain", value: "address-book" },
        ]),
      );
    });

    it("should correctly identify address types", async () => {
      const mockTags = ["mock-result"];
      mockEvent.mockResolvedValue(mockTags);

      // Test direct address identification
      await command.execute({
        address: "abc123def456ghi789jkl012mno345pqr678stu901vwx",
        name: "DirectUser",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.arrayContaining([{ name: "address_type", value: "direct" }]),
      );

      // Clear previous calls
      mockEvent.mockClear();

      // Test ArNS name identification
      await command.execute({
        address: "myname.ar",
        name: "ArNSUser",
      });

      expect(mockEvent).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.arrayContaining([{ name: "address_type", value: "arns" }]),
      );
    });
  });
});
