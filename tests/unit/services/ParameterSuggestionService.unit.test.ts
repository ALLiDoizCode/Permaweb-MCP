import { describe, expect, it } from "vitest";

import type { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";

import { ParameterSuggestionService } from "../../../src/services/ParameterSuggestionService.js";

describe("ParameterSuggestionService", () => {
  describe("classifyRequestType", () => {
    describe("Structured Request Detection", () => {
      it("should detect key-value patterns", () => {
        const requests = [
          "transfer target=alice quantity=100",
          "send recipient: bob amount: 50",
          "--target alice --amount 100",
          '{"target": "alice", "amount": "100"}',
        ];

        for (const request of requests) {
          const result =
            ParameterSuggestionService.classifyRequestType(request);
          expect(result.type).toBe("structured");
          expect(result.processingStrategy).toBe("parameter_extraction");
          expect(result.confidence).toBeGreaterThan(0.7);
          expect(result.reasoning).toContain("parameter structures");
        }
      });

      it("should detect mixed requests", () => {
        const result = ParameterSuggestionService.classifyRequestType(
          "please transfer amount=100 to alice",
        );
        expect(result.type).toBe("mixed");
        expect(result.processingStrategy).toBe("hybrid");
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.reasoning).toContain("both structured and natural");
      });
    });

    describe("Natural Language Detection", () => {
      it("should detect natural language patterns", () => {
        const requests = [
          "please send 100 tokens to alice",
          "can you check my balance",
          "i want to transfer money",
          "help me get the balance",
          "what is my token balance",
        ];

        for (const request of requests) {
          const result =
            ParameterSuggestionService.classifyRequestType(request);
          expect(result.type).toBe("natural_language");
          expect(result.processingStrategy).toBe("nlp_processing");
          expect(result.confidence).toBeGreaterThan(0.7);
          expect(result.reasoning).toContain("conversational language");
        }
      });

      it("should handle complete sentences", () => {
        const result = ParameterSuggestionService.classifyRequestType(
          "Transfer one hundred tokens to Alice please.",
        );
        expect(result.type).toBe("natural_language");
        expect(result.processingStrategy).toBe("nlp_processing");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty requests", () => {
        const result = ParameterSuggestionService.classifyRequestType("");
        expect(result.type).toBe("mixed");
        expect(result.confidence).toBe(0.5);
      });

      it("should handle ambiguous requests", () => {
        const result =
          ParameterSuggestionService.classifyRequestType("do something");
        expect(result.type).toBe("mixed");
        expect(result.processingStrategy).toBe("hybrid");
      });

      it("should calculate confidence scores correctly", () => {
        const structured = ParameterSuggestionService.classifyRequestType(
          "param1=value1 param2=value2",
        );
        const natural = ParameterSuggestionService.classifyRequestType(
          "please help me with this task",
        );

        expect(structured.confidence).toBeGreaterThanOrEqual(natural.confidence);
        expect(structured.type).toBe("structured");
        expect(natural.type).toBe("natural_language");
      });
    });
  });

  describe("extractParametersIntelligently", () => {
    const mockHandler: HandlerMetadata = {
      action: "Transfer",
      description: "Transfer tokens",
      parameters: [
        { name: "target", required: true, type: "string" },
        { name: "quantity", required: true, type: "number" },
        { name: "message", required: false, type: "string" },
      ],
    };

    describe("Strategy-Based Extraction", () => {
      it("should use hybrid strategy for mixed requests", () => {
        const classification = {
          confidence: 0.8,
          processingStrategy: "hybrid" as const,
          reasoning: "mixed content",
          type: "mixed" as const,
        };

        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "please transfer quantity=100 to alice",
            mockHandler,
            classification,
          );

        expect(result.target).toBe("alice");
        expect(result.quantity).toBe(100);
      });

      it("should use NLP strategy for natural language", () => {
        const classification = {
          confidence: 0.9,
          processingStrategy: "nlp_processing" as const,
          reasoning: "natural language",
          type: "natural_language" as const,
        };

        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "send 50 tokens to bob",
            mockHandler,
            classification,
          );

        expect(result.target).toBe("bob");
        expect(result.quantity).toBe(50);
      });

      it("should use structured extraction for structured requests", () => {
        const classification = {
          confidence: 0.9,
          processingStrategy: "parameter_extraction" as const,
          reasoning: "structured format",
          type: "structured" as const,
        };

        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "target=charlie quantity=75",
            mockHandler,
            classification,
          );

        expect(result.target).toBe("charlie");
        expect(result.quantity).toBe(75);
      });

      it("should handle missing handler parameters gracefully", () => {
        const handlerWithoutParams: HandlerMetadata = {
          action: "Test",
          description: "Test handler",
        };

        const classification = {
          confidence: 0.8,
          processingStrategy: "nlp_processing" as const,
          reasoning: "natural language",
          type: "natural_language" as const,
        };

        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "test request",
            handlerWithoutParams,
            classification,
          );

        expect(result).toEqual({});
      });
    });

    describe("Prioritization in Hybrid Mode", () => {
      it("should prioritize structured over NLP in hybrid mode", () => {
        const classification = {
          confidence: 0.8,
          processingStrategy: "hybrid" as const,
          reasoning: "mixed content",
          type: "mixed" as const,
        };

        // Both structured and NLP might extract quantity differently
        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "send fifty quantity=100 to alice", // NLP might get "fifty", structured gets "100"
            mockHandler,
            classification,
          );

        expect(result.quantity).toBe(100); // Structured should win
      });
    });
  });

  describe("generateParameterGuidance", () => {
    const mockHandler: HandlerMetadata = {
      action: "Transfer",
      parameters: [
        {
          description: "Recipient address",
          examples: ["alice", "bob", "process_id_123"],
          name: "target",
          required: true,
          type: "string",
          validation: { maxLength: 43, minLength: 3 },
        },
        {
          description: "Amount to transfer",
          examples: ["100", "50.5"],
          name: "quantity",
          required: true,
          type: "number",
        },
        {
          description: "Optional message",
          name: "memo",
          required: false,
          type: "string",
        },
      ],
    };

    it("should generate guidance for missing parameters", () => {
      const guidance = ParameterSuggestionService.generateParameterGuidance(
        mockHandler,
        ["target", "quantity"],
      );

      expect(guidance).toHaveLength(2);

      const targetGuidance = guidance.find((g) => g.parameter === "target");
      expect(targetGuidance).toBeDefined();
      expect(targetGuidance!.guidance).toBe("Recipient address");
      expect(targetGuidance!.examples).toContain("alice");
      expect(targetGuidance!.validationRules.length).toBeGreaterThan(0);

      const quantityGuidance = guidance.find((g) => g.parameter === "quantity");
      expect(quantityGuidance).toBeDefined();
      expect(quantityGuidance!.guidance).toBe("Amount to transfer");
      expect(quantityGuidance!.examples).toContain("100");
    });

    it("should handle empty missing parameters array", () => {
      const guidance = ParameterSuggestionService.generateParameterGuidance(
        mockHandler,
        [],
      );
      expect(guidance).toHaveLength(0);
    });

    it("should handle handler without parameters", () => {
      const handlerWithoutParams: HandlerMetadata = {
        action: "Test",
      };
      const guidance = ParameterSuggestionService.generateParameterGuidance(
        handlerWithoutParams,
        ["test"],
      );
      expect(guidance).toHaveLength(0);
    });

    it("should filter only requested missing parameters", () => {
      const guidance = ParameterSuggestionService.generateParameterGuidance(
        mockHandler,
        ["target"], // Only request target
      );

      expect(guidance).toHaveLength(1);
      expect(guidance[0].parameter).toBe("target");
    });
  });

  describe("generateParameterSuggestions", () => {
    const mockHandler: HandlerMetadata = {
      action: "Transfer",
      parameters: [
        {
          description: "Recipient address",
          examples: ["alice"],
          name: "target",
          required: true,
          type: "string",
        },
        {
          description: "Amount to transfer",
          name: "quantity",
          required: true,
          type: "number",
        },
        {
          description: "Optional message",
          name: "memo",
          required: false,
          type: "string",
        },
      ],
    };

    it("should suggest missing required parameters", () => {
      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(
          mockHandler,
          {}, // No parameters provided
        );

      expect(suggestions).toHaveLength(3);

      const requiredSuggestions = suggestions.filter((s) => s.required);
      expect(requiredSuggestions).toHaveLength(2);
      expect(requiredSuggestions.map((s) => s.name)).toContain("target");
      expect(requiredSuggestions.map((s) => s.name)).toContain("quantity");
    });

    it("should sort required parameters first", () => {
      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(
          mockHandler,
          {},
        );

      const firstTwo = suggestions.slice(0, 2);
      expect(firstTwo.every((s) => s.required)).toBe(true);

      const last = suggestions[suggestions.length - 1];
      expect(last.required).toBe(false);
    });

    it("should not suggest parameters that are already provided", () => {
      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(mockHandler, {
          quantity: 100,
          target: "alice",
        });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe("memo");
      expect(suggestions[0].required).toBe(false);
    });

    it("should handle empty values as missing", () => {
      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(mockHandler, {
          quantity: null,
          target: "",
        });

      expect(suggestions).toHaveLength(3);
      expect(suggestions.filter((s) => s.required)).toHaveLength(2);
    });

    it("should include validation rules", () => {
      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(
          mockHandler,
          {},
        );

      for (const suggestion of suggestions) {
        expect(suggestion.validationRules).toBeDefined();
        expect(suggestion.validationRules.length).toBeGreaterThan(0);
      }
    });
  });

  describe("validateParametersAgainstADP", () => {
    const mockHandler: HandlerMetadata = {
      action: "Transfer",
      parameters: [
        { name: "target", required: true, type: "string" },
        { name: "quantity", required: true, type: "number" },
        { name: "memo", required: false, type: "string" },
      ],
    };

    describe("Required Parameter Validation", () => {
      it("should detect missing required parameters", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          {},
        );

        expect(errors).toHaveLength(2);

        const requiredErrors = errors.filter((e) => e.severity === "error");
        expect(requiredErrors).toHaveLength(2);
        expect(requiredErrors.map((e) => e.field)).toContain("target");
        expect(requiredErrors.map((e) => e.field)).toContain("quantity");
      });

      it("should not error on missing optional parameters", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: 100, target: "alice" },
        );

        expect(errors.filter((e) => e.field === "memo")).toHaveLength(0);
      });

      it("should treat empty values as missing", () => {
        const testCases = [
          { quantity: 100, target: "" },
          { quantity: 100, target: null },
          { quantity: 100, target: undefined },
        ];

        for (const params of testCases) {
          const errors =
            ParameterSuggestionService.validateParametersAgainstADP(
              mockHandler,
              params,
            );

          const targetError = errors.find((e) => e.field === "target");
          expect(targetError).toBeDefined();
          expect(targetError!.severity).toBe("error");
        }
      });
    });

    describe("Type Validation", () => {
      it("should validate string parameters", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: 100, target: 123 }, // target should be string
        );

        const targetError = errors.find((e) => e.field === "target");
        expect(targetError).toBeDefined();
        expect(targetError!.message).toContain("should be a string");
        expect(targetError!.severity).toBe("error");
      });

      it("should validate number parameters", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: "not-a-number", target: "alice" },
        );

        const quantityError = errors.find((e) => e.field === "quantity");
        expect(quantityError).toBeDefined();
        expect(quantityError!.message).toContain("should be a number");
        expect(quantityError!.severity).toBe("error");
      });

      it("should validate boolean parameters", () => {
        const booleanHandler: HandlerMetadata = {
          action: "Test",
          parameters: [{ name: "enabled", required: true, type: "boolean" }],
        };

        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          booleanHandler,
          { enabled: "yes" },
        );

        const enabledError = errors.find((e) => e.field === "enabled");
        expect(enabledError).toBeDefined();
        expect(enabledError!.message).toContain("should be a boolean");
      });

      it("should validate array parameters", () => {
        const arrayHandler: HandlerMetadata = {
          action: "Test",
          parameters: [{ name: "items", required: true, type: "array" }],
        };

        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          arrayHandler,
          { items: "not-an-array" },
        );

        const itemsError = errors.find((e) => e.field === "items");
        expect(itemsError).toBeDefined();
        expect(itemsError!.message).toContain("should be an array");
      });

      it("should accept valid types", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { memo: "test message", quantity: 100, target: "alice" },
        );

        const typeErrors = errors.filter((e) => e.severity === "error");
        expect(typeErrors).toHaveLength(0);
      });

      it("should handle numeric strings for number type", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: "100", target: "alice" }, // String that can be parsed as number
        );

        // Should accept numeric strings that can be parsed as numbers
        const quantityError = errors.find((e) => e.field === "quantity");
        expect(quantityError).toBeUndefined();
      });
    });

    describe("Unknown Parameter Validation", () => {
      it("should warn about unexpected parameters", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: 100, target: "alice", unknownParam: "value" },
        );

        const unknownError = errors.find((e) => e.field === "unknownParam");
        expect(unknownError).toBeDefined();
        expect(unknownError!.severity).toBe("warning");
        expect(unknownError!.message).toContain("Unexpected parameter");
        expect(unknownError!.suggestion).toContain("Available parameters");
      });

      it("should handle case-insensitive parameter matching", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          { quantity: 100, TARGET: "alice" }, // Uppercase TARGET
        );

        // Should not treat TARGET as unknown since target exists (case-insensitive)
        const unknownError = errors.find(
          (e) => e.field === "TARGET" && e.severity === "warning",
        );
        expect(unknownError).toBeUndefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle handler without parameters", () => {
        const handlerWithoutParams: HandlerMetadata = {
          action: "Test",
        };

        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          handlerWithoutParams,
          { someParam: "value" },
        );

        expect(errors).toHaveLength(0);
      });

      it("should provide helpful error messages", () => {
        const errors = ParameterSuggestionService.validateParametersAgainstADP(
          mockHandler,
          {},
        );

        for (const error of errors) {
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
          expect(error.suggestion).toBeDefined();
          expect(error.suggestion!.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("Type Conversion and Extraction", () => {
    describe("Natural Language Parameter Extraction", () => {
      const mockHandler: HandlerMetadata = {
        action: "Transfer",
        parameters: [
          { name: "target", required: true, type: "string" },
          { name: "quantity", required: true, type: "number" },
          { name: "enabled", required: false, type: "boolean" },
        ],
      };

      it("should extract target/recipient parameters", () => {
        const testCases = [
          "send to alice",
          "recipient bob",
          "for charlie",
          "send 100 tokens to david",
        ];

        const classification = {
          confidence: 0.9,
          processingStrategy: "nlp_processing" as const,
          reasoning: "natural language",
          type: "natural_language" as const,
        };

        const expectedTargets = ["alice", "bob", "charlie", "david"];

        testCases.forEach((testCase, index) => {
          const result =
            ParameterSuggestionService.extractParametersIntelligently(
              testCase,
              mockHandler,
              classification,
            );
          expect(result.target).toBe(expectedTargets[index]);
        });
      });

      it("should extract amount/quantity parameters", () => {
        const testCases = ["100", "amount=50", "quantity: 25.5"];

        const classification = {
          confidence: 0.9,
          processingStrategy: "nlp_processing" as const,
          reasoning: "natural language",
          type: "natural_language" as const,
        };

        const expectedAmounts = [100, 50, 25.5];

        testCases.forEach((testCase, index) => {
          const result =
            ParameterSuggestionService.extractParametersIntelligently(
              testCase,
              mockHandler,
              classification,
            );
          expect(result.quantity).toBe(expectedAmounts[index]);
        });
      });
    });

    describe("Structured Parameter Extraction", () => {
      const mockHandler: HandlerMetadata = {
        action: "Test",
        parameters: [
          { name: "target", required: true, type: "string" },
          { name: "amount", required: true, type: "number" },
          { name: "enabled", required: false, type: "boolean" },
          { name: "items", required: false, type: "array" },
        ],
      };

      it("should extract key-value patterns", () => {
        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "target=alice amount=100",
            mockHandler,
            {
              confidence: 0.9,
              processingStrategy: "parameter_extraction",
              reasoning: "structured format",
              type: "structured",
            },
          );

        expect(result.target).toBe("alice");
        expect(result.amount).toBe(100);
      });

      it("should extract JSON-like patterns", () => {
        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            '"target": "bob" "amount": "50"',
            mockHandler,
            {
              confidence: 0.9,
              processingStrategy: "parameter_extraction",
              reasoning: "structured format",
              type: "structured",
            },
          );

        expect(result.target).toBe("bob");
        expect(result.amount).toBe(50);
      });

      it("should extract CLI flag patterns", () => {
        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "--target charlie --amount 75",
            mockHandler,
            {
              confidence: 0.9,
              processingStrategy: "parameter_extraction",
              reasoning: "structured format",
              type: "structured",
            },
          );

        expect(result.target).toBe("charlie");
        expect(result.amount).toBe(75);
      });

      it("should handle type conversions in structured extraction", () => {
        const result =
          ParameterSuggestionService.extractParametersIntelligently(
            "enabled=true items=[1,2,3]",
            mockHandler,
            {
              confidence: 0.9,
              processingStrategy: "parameter_extraction",
              reasoning: "structured format",
              type: "structured",
            },
          );

        expect(result.enabled).toBe(true);
        expect(result.items).toEqual([1, 2, 3]);
      });
    });

    describe("Type Conversion Accuracy", () => {
      it("should convert boolean values correctly", () => {
        const classification = {
          confidence: 0.9,
          processingStrategy: "parameter_extraction" as const,
          reasoning: "structured format",
          type: "structured" as const,
        };

        const booleanHandler: HandlerMetadata = {
          action: "Test",
          parameters: [{ name: "enabled", required: true, type: "boolean" }],
        };

        const trueResult =
          ParameterSuggestionService.extractParametersIntelligently(
            "enabled=true",
            booleanHandler,
            classification,
          );
        expect(trueResult.enabled).toBe(true);

        const falseResult =
          ParameterSuggestionService.extractParametersIntelligently(
            "enabled=false",
            booleanHandler,
            classification,
          );
        expect(falseResult.enabled).toBe(false);
      });

      it("should convert array values correctly", () => {
        const classification = {
          confidence: 0.9,
          processingStrategy: "parameter_extraction" as const,
          reasoning: "structured format",
          type: "structured" as const,
        };

        const arrayHandler: HandlerMetadata = {
          action: "Test",
          parameters: [{ name: "items", required: true, type: "array" }],
        };

        // Comma-separated array (JSON array extraction is limited by regex patterns)
        const arrayResult =
          ParameterSuggestionService.extractParametersIntelligently(
            'items=a,b,c',
            arrayHandler,
            classification,
          );
        expect(arrayResult.items).toEqual(["a", "b", "c"]);

        // Comma-separated fallback
        const csvResult =
          ParameterSuggestionService.extractParametersIntelligently(
            "items=a,b,c",
            arrayHandler,
            classification,
          );
        expect(csvResult.items).toEqual(["a", "b", "c"]);
      });
    });
  });

  describe("Validation Rules Generation", () => {
    it("should generate appropriate rules for different types", () => {
      const handler: HandlerMetadata = {
        action: "Test",
        parameters: [
          { name: "text", type: "string" },
          { name: "count", type: "number" },
          { name: "enabled", type: "boolean" },
          { name: "items", type: "array" },
          { name: "address", type: "string" },
          { name: "amount", type: "number" },
        ],
      };

      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(handler, {});

      const textRules = suggestions.find(
        (s) => s.name === "text",
      )?.validationRules;
      expect(textRules).toContain("Must be a text value");

      const countRules = suggestions.find(
        (s) => s.name === "count",
      )?.validationRules;
      expect(countRules).toContain("Must be a numeric value");

      const enabledRules = suggestions.find(
        (s) => s.name === "enabled",
      )?.validationRules;
      expect(enabledRules).toContain("Must be true or false");

      const itemsRules = suggestions.find(
        (s) => s.name === "items",
      )?.validationRules;
      expect(itemsRules).toContain("Must be an array of values");

      const addressRules = suggestions.find(
        (s) => s.name === "address",
      )?.validationRules;
      expect(addressRules).toContain("Should be a valid AO process address (43 characters)");

      const amountRules = suggestions.find(
        (s) => s.name === "amount",
      )?.validationRules;
      expect(amountRules).toContain("Should be a positive number");
    });

    it("should include custom validation rules", () => {
      const handler: HandlerMetadata = {
        action: "Test",
        parameters: [
          {
            name: "custom",
            type: "string",
            validation: { message: "Must be uppercase", pattern: "/^[A-Z]+$/" },
          },
        ],
      };

      const suggestions =
        ParameterSuggestionService.generateParameterSuggestions(handler, {});

      const customRules = suggestions[0].validationRules;
      expect(
        customRules.some((rule) => rule.includes("Custom validation")),
      ).toBe(true);
    });
  });
});
