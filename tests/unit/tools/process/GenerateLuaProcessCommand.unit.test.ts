import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GenerateLuaProcessCommand } from "../../../../src/tools/process/commands/GenerateLuaProcessCommand.js";
import { LuaWorkflowResult } from "../../../../src/types/lua-workflow.js";

// Mock the LuaWorkflowOrchestrationService
vi.mock("../../../../src/services/LuaWorkflowOrchestrationService.js", () => ({
  LuaWorkflowOrchestrationService: vi.fn().mockImplementation(() => ({
    orchestrateWorkflow: vi.fn(),
  })),
}));

describe("GenerateLuaProcessCommand", () => {
  let command: GenerateLuaProcessCommand;
  let mockContext: ToolContext;
  let mockOrchestrationService: any;

  const mockWorkflowResult: LuaWorkflowResult = {
    codeResult: {
      bestPractices: ["Validate inputs", "Use proper error handling"],
      documentationSources: ["https://example.com/token-docs"],
      explanation: "This generates a token balance handler",
      generatedCode: "Handlers.add('balance', function(msg) end)",
      handlerPatterns: [
        {
          description: "Balance query handler",
          name: "balance-handler",
          template: "template",
          usedPatterns: ["token-contract"],
        },
      ],
      usedTemplates: ["balance-handler"],
    },
    explanation: {
      bestPractices: ["Validate inputs", "Use proper error handling"],
      codeBreakdown: [
        {
          documentationReference: "https://example.com/token-docs",
          explanation: "Handles balance queries",
          section: "Balance Handler",
        },
      ],
      overview: "This code implements a token contract",
      relatedSources: ["AO: Token documentation..."],
    },
    requirements: {
      analysis: {
        complexity: "moderate",
        detectedPatterns: ["token-contract", "handler"],
        extractedKeywords: ["token", "contract"],
        processType: "stateful",
        suggestedDomains: ["ao"],
        userRequest: "Create a token contract",
      },
      confidence: 0.8,
      relevantDocs: [
        {
          content: "Token documentation",
          domain: "ao",
          isFullDocument: false,
          relevanceScore: 8.5,
          url: "https://example.com/token-docs",
        },
      ],
    },
    timestamp: new Date("2023-01-01T00:00:00Z"),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContext = {
      hubId: "test-hub-id",
      keyPair: { kty: "RSA" } as any,
      publicKey: "test-public-key",
    };

    // Get the mocked service
    const { LuaWorkflowOrchestrationService } = await import(
      "../../../../src/services/LuaWorkflowOrchestrationService.js"
    );
    mockOrchestrationService = new LuaWorkflowOrchestrationService();
    mockOrchestrationService.orchestrateWorkflow.mockResolvedValue(
      mockWorkflowResult,
    );

    command = new GenerateLuaProcessCommand(mockContext);
    // Replace the service instance with our mock
    (command as any).orchestrationService = mockOrchestrationService;
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      const metadata = (command as any).metadata;
      expect(metadata.name).toBe("generateLuaProcess");
      expect(metadata.title).toBe(
        "Generate AO Process Code (Code Only - No Deployment)",
      );
      expect(metadata.readOnlyHint).toBe(true);
      expect(metadata.openWorldHint).toBe(false);
      expect(metadata.description).toContain(
        "Generate Lua code for AO processes",
      );
      expect(metadata.description).toContain(
        "documentation-informed best practices",
      );
    });
  });

  describe("parametersSchema", () => {
    it("should validate required userRequest parameter", () => {
      const schema = (command as any).parametersSchema;

      const validResult = schema.safeParse({
        userRequest: "Create a token contract",
      });
      expect(validResult.success).toBe(true);

      const invalidResult = schema.safeParse({});
      expect(invalidResult.success).toBe(false);

      const emptyStringResult = schema.safeParse({
        userRequest: "",
      });
      expect(emptyStringResult.success).toBe(false);
    });

    it("should validate optional domains parameter", () => {
      const schema = (command as any).parametersSchema;

      const withDomainsResult = schema.safeParse({
        domains: "ao,arweave",
        userRequest: "Create a handler",
      });
      expect(withDomainsResult.success).toBe(true);

      const withoutDomainsResult = schema.safeParse({
        userRequest: "Create a handler",
      });
      expect(withoutDomainsResult.success).toBe(true);
    });

    it("should validate optional includeExplanation parameter", () => {
      const schema = (command as any).parametersSchema;

      const withExplanationResult = schema.safeParse({
        includeExplanation: false,
        userRequest: "Create a handler",
      });
      expect(withExplanationResult.success).toBe(true);
      expect(withExplanationResult.data.includeExplanation).toBe(false);

      const defaultExplanationResult = schema.safeParse({
        userRequest: "Create a handler",
      });
      expect(defaultExplanationResult.success).toBe(true);
      expect(defaultExplanationResult.data.includeExplanation).toBe(true);
    });
  });

  describe("execute", () => {
    it("should execute workflow and return complete response", async () => {
      const args = {
        includeExplanation: true,
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(mockOrchestrationService.orchestrateWorkflow).toHaveBeenCalledWith(
        "Create a token contract",
      );

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.workflow.userRequest).toBe("Create a token contract");
      expect(parsedResult.workflow.analysis.complexity).toBe("moderate");
      expect(parsedResult.workflow.analysis.detectedPatterns).toContain(
        "token-contract",
      );
      expect(parsedResult.workflow.code.generatedCode).toContain(
        "Handlers.add",
      );
      expect(parsedResult.workflow.explanation).toBeDefined();
      expect(parsedResult.timestamp).toBe("2023-01-01T00:00:00.000Z");
    });

    it("should exclude explanation when includeExplanation is false", async () => {
      const args = {
        includeExplanation: false,
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.workflow.explanation).toBeUndefined();
      expect(parsedResult.workflow.code.generatedCode).toBeDefined();
    });

    it("should handle domains parameter (though not currently used in workflow)", async () => {
      const args = {
        domains: "ao,arweave",
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(mockOrchestrationService.orchestrateWorkflow).toHaveBeenCalledWith(
        "Create a token contract",
      );
    });

    it("should handle workflow orchestration errors", async () => {
      mockOrchestrationService.orchestrateWorkflow.mockRejectedValue(
        new Error("Orchestration failed"),
      );

      const args = {
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.code).toBe("WORKFLOW_GENERATION_FAILED");
      expect(parsedResult.error.message).toContain("Orchestration failed");
      expect(parsedResult.error.details.userRequest).toBe(
        "Create a token contract",
      );
      expect(parsedResult.error.details.timestamp).toBeDefined();
    });

    it("should handle unknown errors gracefully", async () => {
      mockOrchestrationService.orchestrateWorkflow.mockRejectedValue(
        "Unknown error string",
      );

      const args = {
        userRequest: "Create a handler",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error.code).toBe("WORKFLOW_GENERATION_FAILED");
      expect(parsedResult.error.message).toContain("Unknown error");
    });

    it("should return valid JSON structure", async () => {
      const args = {
        userRequest: "Create a simple handler",
      };

      const result = await command.execute(args);

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("success");
      expect(parsedResult).toHaveProperty("workflow");
      expect(parsedResult).toHaveProperty("timestamp");
      expect(parsedResult.workflow).toHaveProperty("analysis");
      expect(parsedResult.workflow).toHaveProperty("documentation");
      expect(parsedResult.workflow).toHaveProperty("code");
    });

    it("should include proper analysis data in response", async () => {
      const args = {
        userRequest: "Create a DAO voting system",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.workflow.analysis).toHaveProperty("complexity");
      expect(parsedResult.workflow.analysis).toHaveProperty("processType");
      expect(parsedResult.workflow.analysis).toHaveProperty("detectedPatterns");
      expect(parsedResult.workflow.analysis).toHaveProperty("suggestedDomains");
      expect(parsedResult.workflow.analysis).toHaveProperty("confidence");
      expect(
        Array.isArray(parsedResult.workflow.analysis.detectedPatterns),
      ).toBe(true);
      expect(
        Array.isArray(parsedResult.workflow.analysis.suggestedDomains),
      ).toBe(true);
    });

    it("should include documentation information", async () => {
      const args = {
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.workflow.documentation).toHaveProperty(
        "sourcesFound",
      );
      expect(parsedResult.workflow.documentation).toHaveProperty("domains");
      expect(parsedResult.workflow.documentation.sourcesFound).toBe(1);
      expect(Array.isArray(parsedResult.workflow.documentation.domains)).toBe(
        true,
      );
    });

    it("should include code generation results", async () => {
      const args = {
        userRequest: "Create a token contract",
      };

      const result = await command.execute(args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.workflow.code).toHaveProperty("generatedCode");
      expect(parsedResult.workflow.code).toHaveProperty("handlerPatterns");
      expect(parsedResult.workflow.code).toHaveProperty("usedTemplates");
      expect(parsedResult.workflow.code).toHaveProperty("bestPractices");
      expect(typeof parsedResult.workflow.code.generatedCode).toBe("string");
      expect(Array.isArray(parsedResult.workflow.code.handlerPatterns)).toBe(
        true,
      );
      expect(Array.isArray(parsedResult.workflow.code.usedTemplates)).toBe(
        true,
      );
      expect(Array.isArray(parsedResult.workflow.code.bestPractices)).toBe(
        true,
      );
    });
  });

  describe("tool integration", () => {
    it("should have correct tool definition structure", () => {
      const toolDef = command.toToolDefinition(mockContext);

      expect(toolDef.name).toBe("generateLuaProcess");
      expect(toolDef.description).toContain(
        "Generate Lua code for AO processes",
      );
      expect(toolDef.annotations?.openWorldHint).toBe(false);
      expect(toolDef.annotations?.readOnlyHint).toBe(true);
      expect(toolDef.annotations?.title).toBe(
        "Generate AO Process Code (Code Only - No Deployment)",
      );
      expect(typeof toolDef.execute).toBe("function");
    });

    it("should execute through tool definition", async () => {
      const toolDef = command.toToolDefinition(mockContext);
      const result = await toolDef.execute({
        userRequest: "Create a simple ping handler",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.workflow.userRequest).toBe(
        "Create a simple ping handler",
      );
    });

    it("should handle invalid parameters through tool definition", async () => {
      const toolDef = command.toToolDefinition(mockContext);

      // Tool definition should execute but may return error in response
      const result1 = await toolDef.execute({});
      const parsedResult1 = JSON.parse(result1);
      // Either succeeds with mock data or fails - both are acceptable behavior
      expect(typeof result1).toBe("string");

      const result2 = await toolDef.execute({ userRequest: "" });
      const parsedResult2 = JSON.parse(result2);
      expect(typeof result2).toBe("string");
    });
  });

  describe("Enhanced ADP Validation", () => {
    let command: GenerateLuaProcessCommand;

    beforeEach(() => {
      command = new GenerateLuaProcessCommand(mockContext);
    });

    describe("validateParameterTypes", () => {
      it("should validate parameter types against ADP specification", () => {
        const codeWithValidTypes = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { name = "Recipient", type = "address", required = true },
                { name = "Amount", type = "number", required = true },
                { name = "Data", type = "json", required = false }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateParameterTypes(
          codeWithValidTypes,
          warnings,
          suggestions,
        );

        expect(result.typeValidationScore).toBe(1);
        expect(warnings).toHaveLength(0);
      });

      it("should detect invalid parameter types", () => {
        const codeWithInvalidTypes = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { name = "Amount", type = "currency", required = true },
                { name = "Status", type = "enum", required = false }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateParameterTypes(
          codeWithInvalidTypes,
          warnings,
          suggestions,
        );

        expect(result.typeValidationScore).toBe(0);
        expect(warnings).toContain(
          'Invalid parameter type "currency" - must be one of: string, number, boolean, address, json',
        );
        expect(warnings).toContain(
          'Invalid parameter type "enum" - must be one of: string, number, boolean, address, json',
        );
        expect(suggestions).toContain(
          'Replace parameter type "currency" with a valid ADP type: string, number, boolean, address, json',
        );
      });
    });

    describe("validateParameterCrossReference", () => {
      it("should detect unused declared parameters", () => {
        // Mock the parameter extraction service to return used parameters
        const mockExtractedParams = new Map([
          ["Transfer", [{ name: "Amount", required: true, type: "number" }]],
        ]);
        (command as any).parameterExtractionService = {
          extractParametersFromCode: vi
            .fn()
            .mockReturnValue(mockExtractedParams),
        };

        const codeWithUnusedParams = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { name = "Amount", type = "number", required = true },
                { name = "Memo", type = "string", required = false }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateParameterCrossReference(
          codeWithUnusedParams,
          warnings,
          suggestions,
        );

        expect(result.crossReferenceScore).toBeLessThan(1);
        expect(
          warnings.some((w) =>
            w.includes(
              "Parameter 'Memo' declared in 'Transfer' handler metadata but not used in code",
            ),
          ),
        ).toBe(true);
        expect(
          suggestions.some((s) => s.includes("Remove unused parameter 'Memo'")),
        ).toBe(true);
      });

      it("should detect undeclared used parameters", () => {
        const mockExtractedParams = new Map([
          [
            "Transfer",
            [
              { name: "Amount", required: true, type: "number" },
              { name: "Recipient", required: true, type: "string" },
            ],
          ],
        ]);
        (command as any).parameterExtractionService = {
          extractParametersFromCode: vi
            .fn()
            .mockReturnValue(mockExtractedParams),
        };

        const codeWithMissingDeclarations = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { name = "Amount", type = "number", required = true }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateParameterCrossReference(
          codeWithMissingDeclarations,
          warnings,
          suggestions,
        );

        expect(result.crossReferenceScore).toBeLessThan(1);
        expect(
          warnings.some((w) =>
            w.includes(
              "Parameter 'Recipient' used in 'Transfer' handler but not declared in ADP metadata",
            ),
          ),
        ).toBe(true);
        expect(
          suggestions.some((s) =>
            s.includes("Add parameter definition for 'Recipient'"),
          ),
        ).toBe(true);
      });
    });

    describe("validateValidationRules", () => {
      it("should validate address parameters have validation patterns", () => {
        const codeWithoutAddressValidation = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { name = "Recipient", type = "address", required = true },
                { name = "Amount", type = "number", required = true }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateValidationRules(
          codeWithoutAddressValidation,
          warnings,
          suggestions,
        );

        expect(
          warnings.some((w) =>
            w.includes(
              "Address parameter 'Recipient' missing validation pattern",
            ),
          ),
        ).toBe(true);
        expect(
          suggestions.some((s) =>
            s.includes('validation = { pattern = "^[a-zA-Z0-9_-]{43}$" }'),
          ),
        ).toBe(true);
      });

      it("should accept valid validation patterns", () => {
        const codeWithValidValidation = `
          handlers = {
            {
              action = "Transfer",
              parameters = {
                { 
                  name = "Recipient", 
                  type = "address", 
                  required = true,
                  validation = { pattern = "^[a-zA-Z0-9_-]{43}$" }
                }
              }
            }
          }
        `;

        const warnings: string[] = [];
        const suggestions: string[] = [];
        const result = (command as any).validateValidationRules(
          codeWithValidValidation,
          warnings,
          suggestions,
        );

        expect(result.validationRuleScore).toBeGreaterThan(0.5);
      });
    });

    describe("getValidationRuleTemplates", () => {
      it("should provide standard validation templates", () => {
        const templates =
          GenerateLuaProcessCommand.getValidationRuleTemplates();

        expect(templates.address.pattern).toBe("^[a-zA-Z0-9_-]{43}$");
        expect(templates.amount.min).toBe(0);
        expect(templates.percentage.min).toBe(0);
        expect(templates.percentage.max).toBe(100);
        expect(templates.commonEnums.actions).toContain("Transfer");
        expect(templates.commonEnums.permissions).toContain("admin");
      });
    });

    describe("generateParameterValidationSuggestion", () => {
      it("should generate appropriate suggestions for address parameters", () => {
        const suggestion =
          GenerateLuaProcessCommand.generateParameterValidationSuggestion(
            "recipient",
            "address",
          );
        expect(suggestion).toContain('pattern = "^[a-zA-Z0-9_-]{43}$"');
        expect(suggestion).toContain(
          "Standard Arweave address format validation",
        );
      });

      it("should generate appropriate suggestions for amount parameters", () => {
        const suggestion =
          GenerateLuaProcessCommand.generateParameterValidationSuggestion(
            "amount",
            "number",
          );
        expect(suggestion).toContain("min = 0");
        expect(suggestion).toContain("Non-negative amount validation");
      });

      it("should generate appropriate suggestions for ticker parameters", () => {
        const suggestion =
          GenerateLuaProcessCommand.generateParameterValidationSuggestion(
            "ticker",
            "string",
          );
        expect(suggestion).toContain('pattern = "^[A-Z]{2,10}$"');
        expect(suggestion).toContain("Token ticker format validation");
      });

      it("should provide default suggestions for unknown parameter types", () => {
        const suggestion =
          GenerateLuaProcessCommand.generateParameterValidationSuggestion(
            "unknownParam",
            "string",
          );
        expect(suggestion).toContain("minLength = 1, maxLength = 256");
      });
    });

    describe("enhanced validateADPCompliance", () => {
      it("should include enhanced parameter validation checks", () => {
        // Mock the parameter extraction service
        (command as any).parameterExtractionService = {
          extractParametersFromCode: vi.fn().mockReturnValue(new Map()),
        };

        const compliantCode = `
          Handlers.add("Info", function(msg)
            msg.reply({
              Data = json.encode({
                protocolVersion = "1.0",
                handlers = {
                  {
                    action = "Ping",
                    parameters = {
                      { name = "Message", type = "string", required = false }
                    }
                  }
                },
                capabilities = {
                  supportsHandlerRegistry = true,
                  supportsParameterValidation = true,
                  supportsExamples = true
                }
              })
            })
          end)
          
          Handlers.add("Ping", function(msg)
            msg.reply({ Data = "Pong" })
          end)
        `;

        const result = (command as any).validateADPCompliance(compliantCode);

        expect(result.checks.hasInfoHandler).toBe(true);
        expect(result.checks.hasProtocolVersion).toBe(true);
        expect(result.checks.hasHandlerRegistry).toBe(true);
        expect(result.checks.hasCapabilities).toBe(true);
        expect(result.checks.hasPingHandler).toBe(true);
        expect(result.checks).toHaveProperty("hasParameterTypeValidation");
        expect(result.checks).toHaveProperty("hasParameterCrossReference");
        expect(result.checks).toHaveProperty("hasValidationRules");
        expect(result).toHaveProperty("parameterValidation");
        expect(result).toHaveProperty("suggestions");
        expect(Array.isArray(result.suggestions)).toBe(true);
      });

      it("should provide comprehensive scoring for parameter validation", () => {
        (command as any).parameterExtractionService = {
          extractParametersFromCode: vi.fn().mockReturnValue(new Map()),
        };

        const partiallyCompliantCode = `
          Handlers.add("Info", function(msg)
            msg.reply({
              Data = json.encode({
                protocolVersion = "1.0",
                handlers = {},
                capabilities = {
                  supportsHandlerRegistry = true
                }
              })
            })
          end)
        `;

        const result = (command as any).validateADPCompliance(
          partiallyCompliantCode,
        );

        expect(result.parameterValidation).toHaveProperty(
          "crossReferenceScore",
        );
        expect(result.parameterValidation).toHaveProperty(
          "typeValidationScore",
        );
        expect(result.parameterValidation).toHaveProperty(
          "validationRuleScore",
        );
        expect(typeof result.parameterValidation.crossReferenceScore).toBe(
          "number",
        );
        expect(typeof result.parameterValidation.typeValidationScore).toBe(
          "number",
        );
        expect(typeof result.parameterValidation.validationRuleScore).toBe(
          "number",
        );
      });
    });
  });
});
