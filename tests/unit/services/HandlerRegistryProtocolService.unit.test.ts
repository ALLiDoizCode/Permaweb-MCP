import { describe, expect, it } from "vitest";

import {
  ExtendedInfoResponseSchema,
  HandlerMetadata,
  HandlerRegistryProtocolService,
} from "../../../src/services/HandlerRegistryProtocolService.js";

describe("HandlerRegistryProtocolService", () => {
  describe("generateEnhancedInfoHandler", () => {
    it("should generate valid Lua code for enhanced Info handler", () => {
      const standardInfo = {
        Description: "A test token",
        Name: "Test Token",
        Ticker: "TTK",
      };

      const handlers: HandlerMetadata[] = [
        {
          action: "Info",
          category: "core",
          description: "Get token information",
          pattern: ["Action"],
        },
        {
          action: "Balance",
          category: "core",
          description: "Get balance",
          parameters: [
            {
              description: "Address to check",
              name: "Target",
              required: false,
              type: "address",
            },
          ],
          pattern: ["Action"],
        },
      ];

      const luaCode =
        HandlerRegistryProtocolService.generateEnhancedInfoHandler(
          standardInfo,
          handlers,
        );

      expect(luaCode).toContain("Handlers.add('Info'");
      expect(luaCode).toContain("protocolVersion");
      expect(luaCode).toContain("handlers");
      expect(luaCode).toContain("Test Token");
      expect(luaCode).toContain("TTK");
    });
  });

  describe("parseInfoResponse", () => {
    it("should parse valid AHRP response", () => {
      const validResponse = {
        handlers: [
          {
            action: "Info",
            description: "Get info",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00.000Z",
        Name: "Test Token",
        protocolVersion: "1.0",
        Ticker: "TTK",
      };

      const parsed = HandlerRegistryProtocolService.parseInfoResponse(
        JSON.stringify(validResponse),
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.protocolVersion).toBe("1.0");
      expect(parsed?.handlers).toHaveLength(1);
      expect(parsed?.handlers?.[0].action).toBe("Info");
    });

    it("should return null for legacy response", () => {
      const legacyResponse = {
        Name: "Legacy Token",
        Ticker: "LTK",
        // No protocolVersion or handlers
      };

      const parsed = HandlerRegistryProtocolService.parseInfoResponse(
        JSON.stringify(legacyResponse),
      );

      expect(parsed).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      const parsed =
        HandlerRegistryProtocolService.parseInfoResponse("invalid json");

      expect(parsed).toBeNull();
    });
  });

  describe("findHandler", () => {
    it("should find handler by action name", () => {
      const infoResponse = {
        handlers: [
          {
            action: "Info",
            description: "Get info",
            pattern: ["Action"],
          },
          {
            action: "Balance",
            description: "Get balance",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00.000Z",
        protocolVersion: "1.0" as const,
      };

      const handler = HandlerRegistryProtocolService.findHandler(
        infoResponse,
        "Balance",
      );

      expect(handler).not.toBeNull();
      expect(handler?.action).toBe("Balance");
    });

    it("should return null for non-existent handler", () => {
      const infoResponse = {
        handlers: [
          {
            action: "Info",
            description: "Get info",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00.000Z",
        protocolVersion: "1.0" as const,
      };

      const handler = HandlerRegistryProtocolService.findHandler(
        infoResponse,
        "NonExistent",
      );

      expect(handler).toBeNull();
    });
  });

  describe("generateMessageTags", () => {
    it("should generate correct message tags", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          {
            description: "Recipient address",
            name: "Target",
            required: true,
            type: "address",
          },
          {
            description: "Amount to transfer",
            name: "Quantity",
            required: true,
            type: "string",
          },
        ],
        pattern: ["Action"],
      };

      const parameters = {
        Quantity: "100",
        Target: "vh-abc123",
      };

      const tags = HandlerRegistryProtocolService.generateMessageTags(
        handler,
        parameters,
      );

      expect(tags).toHaveLength(3);
      expect(tags).toContainEqual({ name: "Action", value: "Transfer" });
      expect(tags).toContainEqual({ name: "Target", value: "vh-abc123" });
      expect(tags).toContainEqual({ name: "Quantity", value: "100" });
    });
  });

  describe("validateParameters", () => {
    it("should validate required parameters", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          {
            description: "Recipient address",
            name: "Target",
            required: true,
            type: "address",
          },
          {
            description: "Amount to transfer",
            name: "Quantity",
            required: true,
            type: "string",
            validation: {
              pattern: "^[0-9]+$",
            },
          },
        ],
        pattern: ["Action"],
      };

      // Valid parameters
      const validResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Quantity: "100", Target: "vh-abc123" },
      );
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Missing required parameter
      const missingResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Target: "vh-abc123" },
      );
      expect(missingResult.valid).toBe(false);
      expect(missingResult.errors).toContain(
        "Required parameter 'Quantity' is missing",
      );

      // Invalid pattern
      const patternResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Quantity: "invalid", Target: "vh-abc123" },
      );
      expect(patternResult.valid).toBe(false);
      expect(patternResult.errors).toContain(
        "Parameter 'Quantity' does not match required pattern",
      );
    });

    it("should validate number parameters", () => {
      const handler: HandlerMetadata = {
        action: "SetPrice",
        parameters: [
          {
            description: "Token price",
            name: "Price",
            required: true,
            type: "number",
          },
        ],
        pattern: ["Action"],
      };

      // Valid number
      const validResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Price: 100 },
      );
      expect(validResult.valid).toBe(true);

      // Invalid number
      const invalidResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Price: "not-a-number" },
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain(
        "Parameter 'Price' must be a number",
      );
    });

    it("should validate enum parameters", () => {
      const handler: HandlerMetadata = {
        action: "SetStatus",
        parameters: [
          {
            description: "Process status",
            name: "Status",
            required: true,
            type: "string",
            validation: {
              enum: ["active", "inactive", "paused"],
            },
          },
        ],
        pattern: ["Action"],
      };

      // Valid enum value
      const validResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Status: "active" },
      );
      expect(validResult.valid).toBe(true);

      // Invalid enum value
      const invalidResult = HandlerRegistryProtocolService.validateParameters(
        handler,
        { Status: "unknown" },
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain(
        "Parameter 'Status' must be one of: active, inactive, paused",
      );
    });
  });

  describe("getTokenHandlerMetadata", () => {
    it("should return standard token handlers", () => {
      const handlers = HandlerRegistryProtocolService.getTokenHandlerMetadata();

      expect(handlers.length).toBeGreaterThan(0);

      const actionNames = handlers.map((h) => h.action);
      expect(actionNames).toContain("Info");
      expect(actionNames).toContain("Balance");
      expect(actionNames).toContain("Transfer");
      expect(actionNames).toContain("Balances");

      const transferHandler = handlers.find((h) => h.action === "Transfer");
      expect(transferHandler).toBeDefined();
      expect(transferHandler?.parameters).toBeDefined();
      expect(transferHandler?.parameters?.length).toBeGreaterThan(0);
    });
  });

  describe("Schema validation", () => {
    it("should validate ExtendedInfoResponse schema", () => {
      const validResponse = {
        capabilities: {
          supportsExamples: true,
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        handlers: [
          {
            action: "Info",
            description: "Get info",
            pattern: ["Action"],
          },
        ],
        lastUpdated: "2024-01-01T00:00:00.000Z",
        Name: "Test Token",
        protocolVersion: "1.0" as const,
        Ticker: "TTK",
      };

      const result = ExtendedInfoResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("should reject invalid schema", () => {
      const invalidResponse = {
        // Missing required protocolVersion
        lastUpdated: "2024-01-01T00:00:00.000Z",
        Name: "Test Token",
      };

      const result = ExtendedInfoResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
