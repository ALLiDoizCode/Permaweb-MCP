import { describe, expect, it } from "vitest";

import { HandlerRegistryProtocolService } from "../../src/services/HandlerRegistryProtocolService.js";
import {
  generateTokenLua,
  TokenConfig,
} from "../../src/services/TokenLuaService.js";

describe("Handler Registry Protocol Integration", () => {
  describe("Token Process Integration", () => {
    it("should generate token with AHRP-enhanced Info handler", () => {
      const config: TokenConfig = {
        adminAddress: "vh-admin-address",
        burnable: true,
        denomination: 12,
        description: "A token to test the Handler Registry Protocol",
        logo: "https://example.com/logo.png",
        mintingConfig: {
          buyToken: "wAR-token-address",
          maxMint: "1000000",
          multiplier: 1000,
        },
        mintingStrategy: "basic",
        name: "Test Protocol Token",
        ticker: "TPT",
        transferable: true,
      };

      const luaCode = generateTokenLua(config);

      // Verify AHRP structure is present
      expect(luaCode).toContain("protocolVersion");
      expect(luaCode).toContain("handlers");
      expect(luaCode).toContain("lastUpdated");
      expect(luaCode).toContain("capabilities");

      // Verify token info is included
      expect(luaCode).toContain("Test Protocol Token");
      expect(luaCode).toContain("TPT");

      // Verify handlers are documented
      expect(luaCode).toContain("Info");
      expect(luaCode).toContain("Balance");
      expect(luaCode).toContain("Transfer");
      expect(luaCode).toContain("Mint"); // Should be included due to minting strategy
      expect(luaCode).toContain("Burn"); // Should be included due to burnable: true

      // Verify handler parameters are documented
      expect(luaCode).toContain("Target");
      expect(luaCode).toContain("Quantity");
      expect(luaCode).toContain("address");
      expect(luaCode).toContain("required");
    });

    it("should handle non-mintable, non-burnable token", () => {
      const config: TokenConfig = {
        burnable: false,
        mintingStrategy: "none",
        name: "Simple Token",
        ticker: "SIM",
        transferable: true,
      };

      const luaCode = generateTokenLua(config);

      // Should not include Mint or Burn handlers
      expect(luaCode).not.toContain('"action": "Mint"');
      expect(luaCode).not.toContain('"action": "Burn"');

      // Should still include core handlers
      expect(luaCode).toContain('"action": "Info"');
      expect(luaCode).toContain('"action": "Balance"');
      expect(luaCode).toContain('"action": "Transfer"');
    });
  });

  describe("Handler Metadata Validation", () => {
    it("should validate token handler metadata structure", () => {
      const handlers = HandlerRegistryProtocolService.getTokenHandlerMetadata();

      // Test each handler has required fields
      handlers.forEach((handler) => {
        expect(handler.action).toBeDefined();
        expect(handler.pattern).toBeDefined();
        expect(handler.pattern.length).toBeGreaterThan(0);
        expect(handler.description).toBeDefined();
        expect(handler.category).toBeDefined();

        // Test parameters if they exist
        if (handler.parameters) {
          handler.parameters.forEach((param) => {
            expect(param.name).toBeDefined();
            expect(param.type).toBeDefined();
            expect(typeof param.required).toBe("boolean");
          });
        }
      });
    });

    it("should generate valid message tags for all token handlers", () => {
      const handlers = HandlerRegistryProtocolService.getTokenHandlerMetadata();

      handlers.forEach((handler) => {
        const mockParams: Record<string, any> = {};

        // Generate mock parameters based on handler requirements
        if (handler.parameters) {
          handler.parameters.forEach((param) => {
            if (param.required) {
              switch (param.type) {
                case "address":
                  mockParams[param.name] = "vh-mock-address-123";
                  break;
                case "boolean":
                  mockParams[param.name] = true;
                  break;
                case "number":
                  mockParams[param.name] = 100;
                  break;
                case "string":
                  mockParams[param.name] = "100";
                  break;
                default:
                  mockParams[param.name] = "mock-value";
              }
            }
          });
        }

        // Generate tags
        const tags = HandlerRegistryProtocolService.generateMessageTags(
          handler,
          mockParams,
        );

        // Should always include Action tag
        expect(
          tags.some(
            (tag) => tag.name === "Action" && tag.value === handler.action,
          ),
        ).toBe(true);

        // Should include parameter tags
        Object.entries(mockParams).forEach(([paramName, paramValue]) => {
          expect(
            tags.some(
              (tag) =>
                tag.name === paramName && tag.value === String(paramValue),
            ),
          ).toBe(true);
        });
      });
    });
  });

  describe("Process Discovery Simulation", () => {
    it("should simulate complete discovery workflow", () => {
      // Simulate what ProcessDiscoveryService would receive from an AHRP process
      const mockAhrpResponse = {
        capabilities: {
          supportsExamples: true,
          supportsHandlerRegistry: true,
          supportsParameterValidation: true,
        },
        Description: "A token for testing process discovery",
        handlers: HandlerRegistryProtocolService.getTokenHandlerMetadata(),
        lastUpdated: new Date().toISOString(),
        Name: "Discovery Test Token",
        protocolVersion: "1.0" as const,
        Ticker: "DTT",
      };

      // Test protocol parsing
      const parsed = HandlerRegistryProtocolService.parseInfoResponse(
        JSON.stringify(mockAhrpResponse),
      );

      expect(parsed).not.toBeNull();
      expect(parsed?.protocolVersion).toBe("1.0");
      expect(parsed?.handlers).toBeDefined();
      expect(parsed?.handlers?.length).toBeGreaterThan(0);

      // Test handler discovery
      const transferHandler = HandlerRegistryProtocolService.findHandler(
        parsed!,
        "Transfer",
      );

      expect(transferHandler).not.toBeNull();
      expect(transferHandler?.action).toBe("Transfer");
      expect(transferHandler?.parameters).toBeDefined();

      // Test parameter validation
      const validation = HandlerRegistryProtocolService.validateParameters(
        transferHandler!,
        {
          Quantity: "1000",
          Target: "vh-valid-address",
        },
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test invalid parameters
      const invalidValidation =
        HandlerRegistryProtocolService.validateParameters(transferHandler!, {
          // Missing required Target parameter
          Quantity: "1000",
        });

      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle legacy process responses gracefully", () => {
      const legacyResponse = {
        Logo: "https://example.com/legacy-logo.png",
        Name: "Legacy Token",
        Ticker: "LTK",
        TotalSupply: "1000000",
        // No protocolVersion or handlers
      };

      const parsed = HandlerRegistryProtocolService.parseInfoResponse(
        JSON.stringify(legacyResponse),
      );

      // Should return null for legacy responses
      expect(parsed).toBeNull();

      // Fallback logic would use embedded templates
      // This simulates how executeAction handles legacy processes
      const tokenHandlers =
        HandlerRegistryProtocolService.getTokenHandlerMetadata();
      expect(tokenHandlers.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed handler metadata gracefully", () => {
      const malformedResponse = {
        handlers: [
          {
            description: "Malformed handler",
            // Missing required action field
            pattern: ["Action"],
          },
        ],
        lastUpdated: new Date().toISOString(),
        protocolVersion: "1.0",
      };

      // Should fail schema validation
      expect(() => {
        HandlerRegistryProtocolService.parseInfoResponse(
          JSON.stringify(malformedResponse),
        );
      }).not.toThrow(); // parseInfoResponse catches errors and returns null

      const parsed = HandlerRegistryProtocolService.parseInfoResponse(
        JSON.stringify(malformedResponse),
      );
      expect(parsed).toBeNull();
    });

    it("should handle parameter validation edge cases", () => {
      const handler = {
        action: "EdgeCaseTest",
        parameters: [
          {
            description: "Optional parameter",
            name: "OptionalParam",
            required: false,
            type: "string" as const,
          },
          {
            description: "Required parameter",
            name: "RequiredParam",
            required: true,
            type: "number" as const,
          },
        ],
        pattern: ["Action"],
      };

      // Test with only required parameter
      const minimalValidation =
        HandlerRegistryProtocolService.validateParameters(handler, {
          RequiredParam: 42,
        });
      expect(minimalValidation.valid).toBe(true);

      // Test with empty parameters
      const emptyValidation = HandlerRegistryProtocolService.validateParameters(
        handler,
        {},
      );
      expect(emptyValidation.valid).toBe(false);
      expect(emptyValidation.errors).toContain(
        "Required parameter 'RequiredParam' is missing",
      );

      // Test with extra parameters (should be allowed)
      const extraValidation = HandlerRegistryProtocolService.validateParameters(
        handler,
        {
          ExtraParam: "should be ignored",
          OptionalParam: "test",
          RequiredParam: 42,
        },
      );
      expect(extraValidation.valid).toBe(true);
    });
  });
});
