import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADPProcessCommunicationService } from "../../../src/services/ADPProcessCommunicationService.js";
import { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";

// Mock the process.ts module
vi.mock("../../../src/process.js", () => ({
  read: vi.fn(),
  send: vi.fn(),
}));

// Mock DocumentationProtocolService
vi.mock("../../../src/services/DocumentationProtocolService.js", () => ({
  DocumentationProtocolService: {
    generateMessageTags: vi.fn(),
    parseInfoResponse: vi.fn(),
    validateParameters: vi.fn(),
  },
}));

describe("ADPProcessCommunicationService Fallback Mechanisms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any cached data
    ADPProcessCommunicationService.clearCache();
  });

  describe("generateDataFieldParameters", () => {
    it("should generate JSON string from simple parameters", () => {
      const params = { A: 5, B: 3 };
      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(params);

      expect(result).toBe('{"A":5,"B":3}');
    });

    it("should handle complex nested structures", () => {
      const params = {
        config: { enabled: true, settings: { timeout: 5000 } },
        items: [1, 2, 3],
        user: { age: 30, name: "john" },
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(params);
      const parsed = JSON.parse(result);

      expect(parsed.user.name).toBe("john");
      expect(parsed.items).toEqual([1, 2, 3]);
      expect(parsed.config.settings.timeout).toBe(5000);
    });

    it("should remove internal metadata fields", () => {
      const params = {
        _extractionErrors: ["some error"],
        A: 5,
        B: 3,
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(params);
      const parsed = JSON.parse(result);

      expect(parsed._extractionErrors).toBeUndefined();
      expect(parsed.A).toBe(5);
      expect(parsed.B).toBe(3);
    });

    it("should throw error for non-serializable objects", () => {
      const circular: any = {};
      circular.self = circular;

      expect(() => {
        ADPProcessCommunicationService.generateDataFieldParameters({
          circular,
        });
      }).toThrow("Failed to generate data field parameters");
    });
  });

  describe("parseDirectParameterFormat", () => {
    it("should parse A=5 B=3 format", () => {
      const result =
        ADPProcessCommunicationService.parseDirectParameterFormat("A=5 B=3");

      expect(result).toEqual({ A: 5, B: 3 });
    });

    it("should parse A:5,B:3 format", () => {
      const result =
        ADPProcessCommunicationService.parseDirectParameterFormat("A:5,B:3");

      expect(result).toEqual({ A: 5, B: 3 });
    });

    it("should parse JSON format", () => {
      const result =
        ADPProcessCommunicationService.parseDirectParameterFormat(
          '{"A": 15, "B": 25}',
        );

      expect(result).toEqual({ A: 15, B: 25 });
    });

    it("should handle quoted strings", () => {
      const result = ADPProcessCommunicationService.parseDirectParameterFormat(
        'name="john doe" age=30',
      );

      expect(result).toEqual({ age: 30, name: "john doe" });
    });

    it("should handle boolean values", () => {
      const result = ADPProcessCommunicationService.parseDirectParameterFormat(
        "enabled=true disabled=false",
      );

      expect(result).toEqual({ disabled: false, enabled: true });
    });

    it("should return null for invalid format", () => {
      const result =
        ADPProcessCommunicationService.parseDirectParameterFormat(
          "just some text",
        );

      expect(result).toBeNull();
    });
  });

  describe("parseComplexParameterStructures", () => {
    it("should parse array assignments", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          "items=[1,2,3]",
        );

      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it("should parse string array assignments", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          'tags=["a","b","c"]',
        );

      expect(result).toEqual({ tags: ["a", "b", "c"] });
    });

    it("should parse object assignments", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          'user={"name":"john","age":30}',
        );

      expect(result).toEqual({ user: { age: 30, name: "john" } });
    });

    it("should parse nested JSON objects", () => {
      const complexJson =
        '{"user":{"name":"john","settings":{"theme":"dark"}},"count":5}';
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          complexJson,
        );

      expect(result).toEqual({
        count: 5,
        user: { name: "john", settings: { theme: "dark" } },
      });
    });

    it("should handle multiple array assignments", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          'numbers=[1,2,3] strings=["a","b"]',
        );

      expect(result).toEqual({
        numbers: [1, 2, 3],
        strings: ["a", "b"],
      });
    });

    it("should return null for invalid structures", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          "just plain text",
        );

      expect(result).toBeNull();
    });
  });

  describe("detectParameterFormat", () => {
    it("should detect natural language format", () => {
      const result =
        ADPProcessCommunicationService.detectParameterFormat("add 5 and 3");

      expect(result).toBe("natural");
    });

    it("should detect direct parameter format", () => {
      const result =
        ADPProcessCommunicationService.detectParameterFormat("A=5 B=3");

      expect(result).toBe("direct");
    });

    it("should detect JSON format", () => {
      const result =
        ADPProcessCommunicationService.detectParameterFormat(
          '{"A": 5, "B": 3}',
        );

      expect(result).toBe("json");
    });

    it("should detect complex JSON structures", () => {
      const result = ADPProcessCommunicationService.detectParameterFormat(
        'items=[1,2,3] config={"enabled":true}',
      );

      expect(result).toBe("json");
    });

    it("should detect nested objects as JSON", () => {
      const result = ADPProcessCommunicationService.detectParameterFormat(
        '{"user":{"name":"john"}}',
      );

      expect(result).toBe("json");
    });
  });

  describe("getFallbackStrategy", () => {
    it("should return tags for mathematical operations", () => {
      const handler: HandlerMetadata = {
        action: "Add",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
        ],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "test-process",
        handler,
      );

      expect(result).toBe("tags");
    });

    it("should return data for complex parameter structures", () => {
      const handler: HandlerMetadata = {
        action: "ComplexOperation",
        parameters: [
          { name: "A", required: true, type: "number" },
          { name: "B", required: true, type: "number" },
          { name: "C", required: true, type: "string" },
          { name: "D", required: true, type: "boolean" },
          { name: "E", required: false, type: "string" },
        ],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "test-process",
        handler,
      );

      expect(result).toBe("data");
    });

    it("should return data for token operations with many parameters", () => {
      const handler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "recipient", required: true, type: "address" },
          { name: "amount", required: true, type: "number" },
          { name: "memo", required: false, type: "string" },
        ],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "test-process",
        handler,
      );

      expect(result).toBe("data");
    });

    it("should return hybrid as default", () => {
      const handler: HandlerMetadata = {
        action: "GenericOperation",
        parameters: [{ name: "param1", required: true, type: "string" }],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "test-process",
        handler,
      );

      expect(result).toBe("hybrid");
    });

    it("should use process-specific optimizations for calculator", () => {
      const handler: HandlerMetadata = {
        action: "GenericOperation",
        parameters: [{ name: "param1", required: true, type: "string" }],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "calculator-process",
        handler,
      );

      expect(result).toBe("tags");
    });

    it("should use process-specific optimizations for token", () => {
      const handler: HandlerMetadata = {
        action: "GenericOperation",
        parameters: [{ name: "param1", required: true, type: "string" }],
      };

      const result = ADPProcessCommunicationService.getFallbackStrategy(
        "token-process",
        handler,
      );

      expect(result).toBe("data");
    });
  });

  describe("generateInteractiveGuidance", () => {
    const testHandler: HandlerMetadata = {
      action: "Add",
      parameters: [
        { name: "A", required: true, type: "number" },
        { name: "B", required: true, type: "number" },
      ],
    };

    it("should generate guidance with examples", () => {
      const result = ADPProcessCommunicationService.generateInteractiveGuidance(
        testHandler,
        "invalid request",
        ["Parameter extraction failed"],
        [],
      );

      expect(result.primarySuggestion).toContain("Direct format");
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.troubleshooting).toContain(
        "Parameter extraction failed - try being more explicit",
      );
      expect(result.examples).toContain("Working examples:");
    });

    it("should provide type-specific guidance", () => {
      const result = ADPProcessCommunicationService.generateInteractiveGuidance(
        testHandler,
        "invalid request",
        [],
        ["Parameter validation failed: expected number"],
      );

      expect(result.troubleshooting).toContain(
        "Parameter validation failed - check types and values",
      );
      expect(result.troubleshooting).toContain(
        "Ensure numeric parameters are valid numbers",
      );
    });

    it("should suggest extraction alternatives for extraction errors", () => {
      const result = ADPProcessCommunicationService.generateInteractiveGuidance(
        testHandler,
        "invalid request",
        ["Required parameter 'A' could not be extracted"],
        [],
      );

      expect(result.primarySuggestion).toContain("Direct format");
      expect(result.troubleshooting).toContain(
        "Use parameter names directly (A=5, B=3)",
      );
    });
  });

  describe("Complex Structure Validation", () => {
    it("should validate serializable complex structures", () => {
      const complexParams = {
        config: { enabled: true, settings: { timeout: 5000 } },
        items: [
          { id: 1, name: "item1" },
          { id: 2, name: "item2" },
        ],
        user: { age: 30, name: "john" },
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(
          complexParams,
        );
      const parsed = JSON.parse(result);

      expect(parsed.user.name).toBe("john");
      expect(parsed.items).toHaveLength(2);
      expect(parsed.config.settings.timeout).toBe(5000);
    });

    it("should handle deeply nested structures", () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: "deep value",
              },
            },
          },
        },
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(
          deeplyNested,
        );
      const parsed = JSON.parse(result);

      expect(parsed.level1.level2.level3.level4.value).toBe("deep value");
    });

    it("should handle mixed arrays and objects", () => {
      const mixed = {
        config: {
          features: ["feature1", "feature2"],
          permissions: { read: true, write: false },
        },
        users: [
          { name: "john", roles: ["admin", "user"] },
          { name: "jane", roles: ["user"] },
        ],
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(mixed);
      const parsed = JSON.parse(result);

      expect(parsed.users).toHaveLength(2);
      expect(parsed.users[0].roles).toEqual(["admin", "user"]);
      expect(parsed.config.permissions.read).toBe(true);
      expect(parsed.config.features).toEqual(["feature1", "feature2"]);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle empty parameter objects", () => {
      const result = ADPProcessCommunicationService.generateDataFieldParameters(
        {},
      );

      expect(result).toBe("{}");
    });

    it("should handle null and undefined values", () => {
      const params = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: "test",
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(params);
      const parsed = JSON.parse(result);

      expect(parsed.nullValue).toBeNull();
      expect(parsed.undefinedValue).toBeUndefined();
      expect(parsed.validValue).toBe("test");
    });

    it("should handle special characters in strings", () => {
      const params = {
        specialChars: "quotes\"and'apostrophes\\backslashes\nnewlines\ttabs",
      };

      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(params);
      const parsed = JSON.parse(result);

      expect(parsed.specialChars).toBe(
        "quotes\"and'apostrophes\\backslashes\nnewlines\ttabs",
      );
    });

    it("should detect invalid JSON in complex structures", () => {
      const result =
        ADPProcessCommunicationService.parseComplexParameterStructures(
          "invalid={not valid json}",
        );

      expect(result).toEqual({ invalid: {} }); // Should fall back to simple object parsing
    });
  });

  describe("Performance and Caching", () => {
    it("should cache process format preferences", () => {
      const handler: HandlerMetadata = {
        action: "Test",
        parameters: [{ name: "A", required: true, type: "number" }],
      };

      // First call
      const result1 = ADPProcessCommunicationService.getFallbackStrategy(
        "calculator-test",
        handler,
      );

      // Second call should use cache (we can't directly test this, but it should return the same result)
      const result2 = ADPProcessCommunicationService.getFallbackStrategy(
        "calculator-test",
        handler,
      );

      expect(result1).toBe(result2);
      expect(result1).toBe("tags"); // Calculator processes prefer tags
    });

    it("should handle large parameter structures efficiently", () => {
      const largeStructure: Record<string, any> = {};

      // Create a structure with many properties
      for (let i = 0; i < 100; i++) {
        largeStructure[`param${i}`] = {
          data: `value${i}`,
          id: i,
          nested: {
            items: Array.from({ length: 10 }, (_, j) => ({
              id: j,
              value: `item${j}`,
            })),
          },
        };
      }

      const startTime = Date.now();
      const result =
        ADPProcessCommunicationService.generateDataFieldParameters(
          largeStructure,
        );
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify structure is preserved
      const parsed = JSON.parse(result);
      expect(Object.keys(parsed)).toHaveLength(100);
      expect(parsed.param0.nested.items).toHaveLength(10);
    });
  });
});
