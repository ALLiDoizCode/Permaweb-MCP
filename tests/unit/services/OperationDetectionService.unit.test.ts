import { describe, expect, it } from "vitest";

import type { HandlerMetadata } from "../../../src/services/DocumentationProtocolService.js";

import { OperationDetectionService } from "../../../src/services/OperationDetectionService.js";

describe("OperationDetectionService", () => {
  describe("detectOperationType", () => {
    describe("Input Validation", () => {
      it("should handle empty request", () => {
        const result = OperationDetectionService.detectOperationType("");
        expect(result.operationType).toBe("unknown");
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBe("fallback");
        expect(result.reasoning).toContain("Invalid or empty request");
        expect(result.riskLevel).toBe("low");
      });

      it("should handle null/undefined request", () => {
        const result = OperationDetectionService.detectOperationType(
          null as any,
        );
        expect(result.operationType).toBe("unknown");
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBe("fallback");
        expect(result.reasoning).toContain("Invalid or empty request");
      });

      it("should handle whitespace-only request", () => {
        const result = OperationDetectionService.detectOperationType("   ");
        expect(result.operationType).toBe("unknown");
        expect(result.confidence).toBe(0);
        expect(result.reasoning).toContain("Invalid or empty request");
      });
    });

    describe("Explicit Mode Validation", () => {
      it("should handle valid explicit modes", () => {
        const validModes = ["read", "write", "validate"];
        for (const mode of validModes) {
          const result = OperationDetectionService.detectOperationType(
            "test request",
            undefined,
            mode,
          );
          expect(result.operationType).toBe(mode);
          expect(result.confidence).toBe(1.0);
          expect(result.detectionMethod).toBe("adp");
          expect(result.reasoning).toContain(
            `Explicit mode specified: ${mode}`,
          );
        }
      });

      it("should handle invalid explicit mode", () => {
        const result = OperationDetectionService.detectOperationType(
          "test request",
          undefined,
          "invalid",
        );
        expect(result.operationType).toBe("unknown");
        expect(result.confidence).toBe(0.5);
        expect(result.detectionMethod).toBe("fallback");
        expect(result.reasoning).toContain("Invalid explicit mode");
      });

      it("should handle auto mode by proceeding with detection", () => {
        const result = OperationDetectionService.detectOperationType(
          "get balance",
          undefined,
          "auto",
        );
        expect(result.detectionMethod).not.toBe("adp");
        expect(result.operationType).toBe("read");
      });

      it("should set appropriate risk level for write mode", () => {
        const result = OperationDetectionService.detectOperationType(
          "test request",
          undefined,
          "write",
        );
        expect(result.riskLevel).toBe("medium");
      });

      it("should set low risk for read mode", () => {
        const result = OperationDetectionService.detectOperationType(
          "test request",
          undefined,
          "read",
        );
        expect(result.riskLevel).toBe("low");
      });
    });

    describe("ADP Handler Metadata Detection", () => {
      const mockHandlers: HandlerMetadata[] = [
        {
          action: "Transfer",
          description: "Transfer tokens to another address",
          examples: ["Transfer 100 tokens to alice"],
          isWrite: true,
          parameters: [
            { name: "target", required: true, type: "string" },
            { name: "quantity", required: true, type: "number" },
          ],
        },
        {
          action: "Balance",
          description: "Get token balance for address",
          examples: ["Check balance for alice"],
          isWrite: false,
          parameters: [{ name: "target", required: false, type: "string" }],
        },
        {
          action: "Burn",
          description: "Burn tokens permanently",
          examples: ["Burn 50 tokens"],
          isWrite: true,
          parameters: [{ name: "quantity", required: true, type: "number" }],
        },
      ];

      it("should detect write operation from ADP metadata", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer 100 tokens to alice",
          mockHandlers,
        );
        expect(result.operationType).toBe("write");
        expect(result.detectionMethod).toBe("adp");
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.reasoning).toContain("Transfer");
        expect(result.reasoning).toContain("isWrite flag");
      });

      it("should detect read operation from ADP metadata", () => {
        const result = OperationDetectionService.detectOperationType(
          "check balance for alice",
          mockHandlers,
        );
        expect(result.operationType).toBe("read");
        expect(result.detectionMethod).toBe("adp");
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.reasoning).toContain("Balance");
      });

      it("should extract parameters from matched handler", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer 100 to alice",
          mockHandlers,
        );
        expect(result.suggestedParameters).toBeDefined();
        expect(result.suggestedParameters!.target).toBe("alice");
        expect(result.suggestedParameters!.quantity).toBe(100);
      });

      it("should assess risk level for high-risk operations", () => {
        const result = OperationDetectionService.detectOperationType(
          "burn 50 tokens",
          mockHandlers,
        );
        expect(result.operationType).toBe("write");
        expect(result.riskLevel).toBe("high");
      });

      it("should handle medium risk transfer operations", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer 100 to alice",
          mockHandlers,
        );
        expect(result.riskLevel).toBe("medium");
      });

      it("should handle low confidence handler matches", () => {
        const result = OperationDetectionService.detectOperationType(
          "some unrelated request",
          mockHandlers,
        );
        expect(result.detectionMethod).not.toBe("adp");
      });

      it("should fall back when no handlers match", () => {
        const result = OperationDetectionService.detectOperationType(
          "completely unrelated request",
          mockHandlers,
        );
        expect(result.confidence).toBeLessThan(0.7);
        expect(result.detectionMethod).not.toBe("adp");
      });
    });

    describe("NLP Intent Detection", () => {
      it("should detect write intent from strong write verbs", () => {
        const writeRequests = [
          "send 100 tokens",
          "transfer money",
          "create new account",
          "mint 50 tokens",
          "burn tokens",
          "delete record",
        ];

        for (const request of writeRequests) {
          const result = OperationDetectionService.detectOperationType(request);
          expect(result.operationType).toBe("write");
          expect(result.detectionMethod).toBe("nlp");
          expect(result.confidence).toBeGreaterThan(0.6);
          expect(result.reasoning).toContain("write intent");
        }
      });

      it("should detect read intent from strong read verbs", () => {
        const readRequests = [
          "get balance",
          "check status",
          "show information",
          "fetch data",
          "view account",
          "query records",
        ];

        for (const request of readRequests) {
          const result = OperationDetectionService.detectOperationType(request);
          expect(result.operationType).toBe("read");
          expect(result.detectionMethod).toBe("nlp");
          expect(result.confidence).toBeGreaterThan(0.6);
          expect(result.reasoning).toContain("read intent");
        }
      });

      it("should set appropriate risk levels for NLP detection", () => {
        const highRiskWrite =
          OperationDetectionService.detectOperationType("burn all tokens");
        expect(highRiskWrite.riskLevel).toBe("medium");

        const lowRiskWrite =
          OperationDetectionService.detectOperationType("create account");
        expect(lowRiskWrite.riskLevel).toBe("low");

        const readOp =
          OperationDetectionService.detectOperationType("get balance");
        expect(readOp.riskLevel).toBe("low");
      });

      it("should handle ambiguous NLP results", () => {
        const result =
          OperationDetectionService.detectOperationType("maybe do something");
        expect(result.operationType).toBe("unknown");
        expect(result.reasoning).toContain("Ambiguous NLP analysis");
      });

      it("should prioritize strongest intent when multiple present", () => {
        const result = OperationDetectionService.detectOperationType(
          "check balance and transfer tokens",
        );
        // Transfer (0.9) should beat check (0.8)
        expect(result.operationType).toBe("write");
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    describe("Pattern Matching Detection", () => {
      it("should detect write patterns", () => {
        const writePatterns = [
          "send 100",
          "transfer 50",
          "create account",
          "delete user",
          "update name to john",
          "mint 25",
          "burn 10",
          "100 tokens to alice",
        ];

        for (const pattern of writePatterns) {
          const result = OperationDetectionService.detectOperationType(pattern);
          expect(result.operationType).toBe("write");
          expect(result.detectionMethod).toBe("pattern");
          expect(result.confidence).toBe(0.7);
          expect(result.reasoning).toContain("write pattern");
          expect(result.riskLevel).toBe("medium");
        }
      });

      it("should detect read patterns", () => {
        const readPatterns = [
          "get balance",
          "check balance",
          "show account",
          "what is my balance",
          "balance of alice",
          "info about token",
          "status of process",
        ];

        for (const pattern of readPatterns) {
          const result = OperationDetectionService.detectOperationType(pattern);
          expect(result.operationType).toBe("read");
          expect(result.detectionMethod).toBe("pattern");
          expect(result.confidence).toBe(0.7);
          expect(result.reasoning).toContain("read pattern");
          expect(result.riskLevel).toBe("low");
        }
      });

      it("should fallback to read when no patterns match", () => {
        const result = OperationDetectionService.detectOperationType(
          "random unmatched text",
        );
        expect(result.operationType).toBe("read");
        expect(result.detectionMethod).toBe("fallback");
        expect(result.confidence).toBe(0.3);
        expect(result.reasoning).toContain("defaulting to read");
        expect(result.riskLevel).toBe("low");
      });
    });

    describe("Multi-Layer Detection Prioritization", () => {
      const mockHandlers: HandlerMetadata[] = [
        {
          action: "Transfer",
          description: "Transfer tokens",
          isWrite: true,
          parameters: [
            { name: "target", required: true, type: "string" },
            { name: "quantity", required: true, type: "number" },
          ],
        },
      ];

      it("should prioritize ADP over NLP when ADP confidence is high", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer 100 to alice", // Should match both ADP and NLP
          mockHandlers,
        );
        expect(result.detectionMethod).toBe("adp");
        expect(result.confidence).toBeGreaterThan(0.7);
      });

      it("should fall back to NLP when ADP confidence is low", () => {
        const result = OperationDetectionService.detectOperationType(
          "send money", // Should not strongly match ADP handler
          mockHandlers,
        );
        expect(result.detectionMethod).toBe("nlp");
      });

      it("should fall back to pattern matching when both ADP and NLP fail", () => {
        const result = OperationDetectionService.detectOperationType(
          "get something", // Should match read pattern
          mockHandlers,
        );
        expect(result.detectionMethod).toBe("pattern");
      });
    });

    describe("Error Handling", () => {
      it("should handle detection errors gracefully", () => {
        // Force an error by providing malformed handlers
        const badHandlers = [
          {
            action: "Test",
            parameters: [{ name: null }], // This could cause errors
          },
        ] as any;

        const result = OperationDetectionService.detectOperationType(
          "test request",
          badHandlers,
        );

        // Should not throw, should return safe fallback
        expect(result.operationType).toBeDefined();
        expect(result.confidence).toBeDefined();
        expect(result.detectionMethod).toBeDefined();
        expect(result.reasoning).toBeDefined();
        expect(result.riskLevel).toBeDefined();
      });
    });

    describe("Parameter Extraction", () => {
      const mockHandler: HandlerMetadata = {
        action: "Transfer",
        description: "Transfer tokens",
        parameters: [
          { name: "target", required: true, type: "string" },
          { name: "quantity", required: true, type: "number" },
          { name: "message", required: false, type: "string" },
        ],
      };

      it("should extract direct parameter patterns", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer target=alice quantity=100",
          [mockHandler],
        );
        expect(result.suggestedParameters?.target).toBe("alice");
        expect(result.suggestedParameters?.quantity).toBe(100);
      });

      it("should extract contextual parameters", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer 100 to alice",
          [mockHandler],
        );
        expect(result.suggestedParameters?.target).toBe("alice");
        expect(result.suggestedParameters?.quantity).toBe(100);
      });

      it("should handle type conversions", () => {
        const mockBoolHandler: HandlerMetadata = {
          action: "Set",
          parameters: [{ name: "enabled", required: true, type: "boolean" }],
        };

        const result = OperationDetectionService.detectOperationType(
          "set enabled=true",
          [mockBoolHandler],
        );
        expect(result.suggestedParameters?.enabled).toBe(true);
      });

      it("should handle missing parameters gracefully", () => {
        const result = OperationDetectionService.detectOperationType(
          "transfer something",
          [mockHandler],
        );
        expect(result.suggestedParameters).toBeDefined();
        // Should extract what it can, leave rest undefined
      });
    });
  });
});
