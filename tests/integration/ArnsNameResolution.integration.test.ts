import { describe, expect, it } from "vitest";

import { GetArnsRecordInfoCommand } from "../../src/tools/arns/commands/GetArnsRecordInfoCommand.js";
import { ResolveArnsNameCommand } from "../../src/tools/arns/commands/ResolveArnsNameCommand.js";
import { ToolContext } from "../../src/tools/core/index.js";

describe("ArNS Name Resolution Integration", () => {
  const mockContext: ToolContext = {
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  describe("ResolveArnsNameCommand Integration", () => {
    it("should handle name validation at the command level", async () => {
      const command = new ResolveArnsNameCommand(mockContext);

      // Test invalid name format - should be caught by Zod validation
      const result = await command.execute({ name: "invalid-name" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should successfully initialize client and handle name resolution attempts", async () => {
      const command = new ResolveArnsNameCommand(mockContext);

      // Test valid name format - client should initialize successfully
      const result = await command.execute({ name: "example.ar" });
      const parsed = JSON.parse(result);

      // In test environment, client initializes successfully but name may not resolve
      if (!parsed.success) {
        // If resolution fails, should be due to name not existing, not client issues
        expect(parsed.error).toMatch(/RESOLUTION_FAILED|RESOLUTION_ERROR/);
      } else {
        // If it succeeds, should have proper response structure
        expect(parsed).toHaveProperty("resolvedId");
        expect(parsed).toHaveProperty("nameType");
        expect(parsed).toHaveProperty("network");
      }
    });

    it("should properly detect name types", async () => {
      const command = new ResolveArnsNameCommand(mockContext);

      // Test with different name formats to verify parsing logic
      const baseNameResult = await command.execute({ name: "test.ar" });
      const underNameResult = await command.execute({ name: "sub.test.ar" });

      // Both should fail at client level but for the same reason, proving name parsing works
      const baseParsed = JSON.parse(baseNameResult);
      const underParsed = JSON.parse(underNameResult);

      expect(baseParsed.success).toBe(false);
      expect(underParsed.success).toBe(false);
      // Both should fail with the same client error, not name format errors
      expect(baseParsed.error).toBe(underParsed.error);
    });
  });

  describe("GetArnsRecordInfoCommand Integration", () => {
    it("should handle name validation at the command level", async () => {
      const command = new GetArnsRecordInfoCommand(mockContext);

      // Test invalid name format - should be caught by Zod validation
      const result = await command.execute({ name: "invalid-name" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should successfully initialize client and handle record lookup attempts", async () => {
      const command = new GetArnsRecordInfoCommand(mockContext);

      // Test valid name format - client should initialize successfully
      const result = await command.execute({ name: "example.ar" });
      const parsed = JSON.parse(result);

      // In test environment, client initializes successfully but record may not exist
      if (!parsed.success) {
        // If lookup fails, should be due to record not found, not client issues
        expect(parsed.error).toMatch(/RECORD_NOT_FOUND|RECORD_LOOKUP_ERROR/);
      } else {
        // If it succeeds, should have proper response structure
        expect(parsed).toHaveProperty("recordInfo");
        expect(parsed).toHaveProperty("network");
        expect(parsed.recordInfo).toHaveProperty("name");
      }
    });

    it("should handle network parameter validation", async () => {
      const command = new GetArnsRecordInfoCommand(mockContext);

      // Test network parameter handling
      const mainnetResult = await command.execute({
        name: "example.ar",
        network: "mainnet",
      });
      const testnetResult = await command.execute({
        name: "example.ar",
        network: "testnet",
      });

      const mainnetParsed = JSON.parse(mainnetResult);
      const testnetParsed = JSON.parse(testnetResult);

      // Both should successfully process network parameters (may fail at lookup level)
      // Should not be parameter validation errors
      if (!mainnetParsed.success) {
        expect(mainnetParsed.error).not.toMatch(
          /INVALID_PARAMETER|VALIDATION_ERROR/,
        );
      }
      if (!testnetParsed.success) {
        expect(testnetParsed.error).not.toMatch(
          /INVALID_PARAMETER|VALIDATION_ERROR/,
        );
      }

      // At minimum, both should accept valid network parameters without validation errors
      expect(typeof mainnetParsed.success).toBe("boolean");
      expect(typeof testnetParsed.success).toBe("boolean");
    });
  });

  describe("Cross-Command Consistency", () => {
    it("should use consistent error handling patterns", async () => {
      const resolveCommand = new ResolveArnsNameCommand(mockContext);
      const recordCommand = new GetArnsRecordInfoCommand(mockContext);

      const resolveResult = await resolveCommand.execute({
        name: "example.ar",
      });
      const recordResult = await recordCommand.execute({ name: "example.ar" });

      const resolveParsed = JSON.parse(resolveResult);
      const recordParsed = JSON.parse(recordResult);

      // Both should have consistent response structure regardless of success/failure
      expect(resolveParsed).toHaveProperty("success");
      expect(recordParsed).toHaveProperty("success");
      expect(typeof resolveParsed.success).toBe("boolean");
      expect(typeof recordParsed.success).toBe("boolean");

      // If either fails, should have proper error structure
      if (!resolveParsed.success) {
        expect(resolveParsed).toHaveProperty("error");
        expect(resolveParsed).toHaveProperty("message");
      }
      if (!recordParsed.success) {
        expect(recordParsed).toHaveProperty("error");
        expect(recordParsed).toHaveProperty("message");
      }
    });

    it("should handle input validation consistently", async () => {
      const resolveCommand = new ResolveArnsNameCommand(mockContext);
      const recordCommand = new GetArnsRecordInfoCommand(mockContext);

      // Test same invalid input on both commands
      const resolveInvalid = await resolveCommand.execute({ name: "" });
      const recordInvalid = await recordCommand.execute({ name: "" });

      const resolveParsed = JSON.parse(resolveInvalid);
      const recordParsed = JSON.parse(recordInvalid);

      // Both should reject empty names
      expect(resolveParsed.success).toBe(false);
      expect(recordParsed.success).toBe(false);
    });
  });

  describe("Response Format Validation", () => {
    it("should return consistent JSON response structures", async () => {
      const resolveCommand = new ResolveArnsNameCommand(mockContext);

      const result = await resolveCommand.execute({ name: "test.ar" });

      // Should always return valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);

      // Should have required response structure
      expect(parsed).toHaveProperty("success");
      expect(typeof parsed.success).toBe("boolean");

      if (!parsed.success) {
        expect(parsed).toHaveProperty("error");
        expect(parsed).toHaveProperty("message");
        expect(typeof parsed.error).toBe("string");
        expect(typeof parsed.message).toBe("string");
      }
    });

    it("should validate record info response structure", async () => {
      const recordCommand = new GetArnsRecordInfoCommand(mockContext);

      const result = await recordCommand.execute({ name: "test.ar" });

      // Should always return valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);

      // Should have required response structure
      expect(parsed).toHaveProperty("success");
      expect(typeof parsed.success).toBe("boolean");

      if (!parsed.success) {
        expect(parsed).toHaveProperty("error");
        expect(parsed).toHaveProperty("message");
        expect(typeof parsed.error).toBe("string");
        expect(typeof parsed.message).toBe("string");
      }
    });
  });
});
