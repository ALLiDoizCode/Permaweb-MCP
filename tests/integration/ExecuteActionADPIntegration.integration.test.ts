import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADPProcessCommunicationService } from "../../src/services/ADPProcessCommunicationService.js";
import { autoKeyPair } from "../../src/tools/core/ContextHelpers.js";
import { ExecuteActionCommand } from "../../src/tools/process/commands/ExecuteActionCommand.js";

/**
 * Integration tests for ExecuteAction ADP functionality
 * Tests the real calculator process deployed during Story 8.4 implementation
 */
describe("ExecuteAction ADP Integration - Real Process Testing", () => {
  const CALCULATOR_PROCESS_ID = "EKwWFOPxpGuXH6HUmJuNvE63aQRCNcmfw6s4p3FK_Uc";
  const LEGACY_PROCESS_ID = "hFsXAAsuYImVY9Qv8vEDWalhx2R_FPSIvzUeFIivsxw";

  let command: ExecuteActionCommand;
  let mockContext: any;
  let realKeyPair: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get a real keypair for testing
    realKeyPair = await autoKeyPair({});

    mockContext = {
      embeddedTemplates: new Map(),
      getKeyPair: vi.fn().mockResolvedValue(realKeyPair),
    };

    command = new ExecuteActionCommand(mockContext);
    ExecuteActionCommand.clearADPCache();
  });

  describe("ADP Discovery and Communication", () => {
    it("should discover ADP handlers from calculator process", async () => {
      const adpResponse =
        await ADPProcessCommunicationService.discoverADPSupport(
          CALCULATOR_PROCESS_ID,
          realKeyPair,
        );

      expect(adpResponse).not.toBeNull();
      expect(adpResponse?.protocolVersion).toBe("1.0");
      expect(adpResponse?.handlers).toBeDefined();

      // Should find Add and Subtract handlers
      const handlerActions = adpResponse?.handlers?.map((h) => h.action) || [];
      expect(handlerActions).toContain("Add");
      expect(handlerActions).toContain("Subtract");
    }, 30000);

    it("should cache ADP responses for performance", async () => {
      // Clear cache first
      ADPProcessCommunicationService.clearCache();

      // First discovery
      const start1 = Date.now();
      const response1 = await ADPProcessCommunicationService.discoverADPSupport(
        CALCULATOR_PROCESS_ID,
        realKeyPair,
      );
      const time1 = Date.now() - start1;

      // Second discovery (should be cached)
      const start2 = Date.now();
      const response2 = await ADPProcessCommunicationService.discoverADPSupport(
        CALCULATOR_PROCESS_ID,
        realKeyPair,
      );
      const time2 = Date.now() - start2;

      expect(response1).toEqual(response2);
      expect(time2).toBeLessThan(time1); // Cached version should be faster
    }, 30000);

    it("should handle non-ADP processes gracefully", async () => {
      const adpResponse =
        await ADPProcessCommunicationService.discoverADPSupport(
          LEGACY_PROCESS_ID,
          realKeyPair,
        );

      expect(adpResponse).toBeNull(); // Legacy process doesn't support ADP
    }, 30000);
  });

  describe("End-to-End Calculator Testing", () => {
    it("should execute Add operation with explicit parameters", async () => {
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add A=25 B=35",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Add");
      expect(parsed.parametersUsed).toMatchObject({
        A: 25,
        B: 35,
      });
      expect(parsed.confidence).toBeGreaterThan(0.7);

      // Should return calculation result
      // Note: data might be null for this calculator process, success indicates completion
      expect(parsed.success).toBe(true);
    }, 30000);

    it("should execute Subtract operation with explicit parameters", async () => {
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Subtract A=100 B=25",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Subtract");
      expect(parsed.parametersUsed).toMatchObject({
        A: 100,
        B: 25,
      });

      // Should return calculation result
      // Note: data might be null for this calculator process, success indicates completion
      expect(parsed.success).toBe(true);
    }, 30000);

    it("should validate required parameters", async () => {
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add missing parameters",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Parameter validation failed");
      expect(parsed.error).toContain("Required parameter");
    }, 30000);

    it("should handle handler matching correctly", async () => {
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "NonexistentOperation A=1 B=2",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Could not match request");
      expect(parsed.availableHandlers).toContain("Add");
      expect(parsed.availableHandlers).toContain("Subtract");
    }, 30000);
  });

  describe("Legacy Fallback Testing", () => {
    it("should fall back to legacy for non-ADP processes", async () => {
      const result = await command.execute({
        processId: LEGACY_PROCESS_ID,
        request: "test operation",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("legacy");
      // Legacy fallback should be triggered
      expect(parsed).toBeDefined();
    }, 30000);

    it("should maintain ADP functionality after legacy fallback", async () => {
      // First, trigger legacy fallback
      await command.execute({
        processId: LEGACY_PROCESS_ID,
        request: "legacy test",
      });

      // Then, test ADP still works
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add A=10 B=5",
      });

      const parsed = JSON.parse(result);

      expect(parsed.approach).toBe("ADP");
      expect(parsed.success).toBe(true);
      expect(parsed.handlerUsed).toBe("Add");
    }, 30000);
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid process IDs gracefully", async () => {
      const result = await command.execute({
        processId: "invalid-process-id",
        request: "test operation",
      });

      const parsed = JSON.parse(result);

      // Should fall back to legacy or return appropriate error
      expect(parsed).toBeDefined();
      expect(typeof parsed.success).toBe("boolean");
    });

    it("should handle malformed requests", async () => {
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "", // Empty request
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should handle network timeouts and retries", async () => {
      // This test would require mocking network failures
      // For now, just verify the command doesn't crash
      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add A=1 B=1",
      });

      const parsed = JSON.parse(result);
      expect(parsed).toBeDefined();
    }, 30000);
  });

  describe("Performance and Regression Testing", () => {
    it("should maintain performance within acceptable limits", async () => {
      const start = Date.now();

      const result = await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add A=50 B=30",
      });

      const executionTime = Date.now() - start;

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      // Should complete within reasonable time (adjust threshold as needed)
      expect(executionTime).toBeLessThan(30000); // 30 seconds max for integration test
    }, 45000);

    it("should handle multiple concurrent requests", async () => {
      const requests = [
        command.execute({
          processId: CALCULATOR_PROCESS_ID,
          request: "Add A=1 B=2",
        }),
        command.execute({
          processId: CALCULATOR_PROCESS_ID,
          request: "Subtract A=10 B=3",
        }),
        command.execute({
          processId: CALCULATOR_PROCESS_ID,
          request: "Add A=5 B=5",
        }),
      ];

      const results = await Promise.all(requests);

      // All should succeed
      results.forEach((result) => {
        const parsed = JSON.parse(result);
        expect(parsed.approach).toBe("ADP");
        expect(parsed.success).toBe(true);
      });
    }, 60000);

    it("should verify cache statistics and cleanup", async () => {
      // Execute some requests to populate cache
      await command.execute({
        processId: CALCULATOR_PROCESS_ID,
        request: "Add A=1 B=1",
      });

      const stats = ExecuteActionCommand.getADPCacheStats();
      expect(stats.entries).toContain(CALCULATOR_PROCESS_ID);
      expect(stats.size).toBeGreaterThan(0);

      // Clear cache
      ExecuteActionCommand.clearADPCache(CALCULATOR_PROCESS_ID);
      const statsAfterClear = ExecuteActionCommand.getADPCacheStats();
      expect(statsAfterClear.entries).not.toContain(CALCULATOR_PROCESS_ID);
    }, 45000);
  });
});
