import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultProcessService,
  DefaultProcessUtils,
} from "../../../src/services/DefaultProcessService.js";
import {
  DEFAULT_TOKEN_PROCESS,
  extractTokenOperation,
  getDefaultTokenProcess,
  isTokenProcess,
} from "../../../src/templates/defaultTokenProcess.js";

describe("Default Token Process Template", () => {
  describe("DEFAULT_TOKEN_PROCESS", () => {
    it("should have all required token handlers", () => {
      const requiredHandlers = [
        "Transfer",
        "Balance",
        "Mint",
        "Burn",
        "TotalSupply",
        "Name",
        "Symbol",
        "Decimals",
        "Owner",
        "Transfer-Ownership",
        "Approve",
        "Allowance",
        "TransferFrom",
      ];

      const handlerNames = DEFAULT_TOKEN_PROCESS.handlers.map((h) => h.action);

      for (const required of requiredHandlers) {
        expect(handlerNames).toContain(required);
      }
    });

    it("should correctly classify write and read operations", () => {
      const writeOperations = [
        "Transfer",
        "Mint",
        "Burn",
        "Transfer-Ownership",
        "Approve",
        "TransferFrom",
      ];
      const readOperations = [
        "Balance",
        "TotalSupply",
        "Name",
        "Symbol",
        "Decimals",
        "Owner",
        "Allowance",
      ];

      for (const handler of DEFAULT_TOKEN_PROCESS.handlers) {
        if (writeOperations.includes(handler.action)) {
          expect(handler.isWrite).toBe(true);
        } else if (readOperations.includes(handler.action)) {
          expect(handler.isWrite).toBe(false);
        }
      }
    });

    it("should have proper parameter definitions", () => {
      const transferHandler = DEFAULT_TOKEN_PROCESS.handlers.find(
        (h) => h.action === "Transfer",
      );
      expect(transferHandler).toBeDefined();
      expect(transferHandler!.parameters).toHaveLength(3);

      const recipientParam = transferHandler!.parameters.find(
        (p) => p.name === "recipient",
      );
      expect(recipientParam).toBeDefined();
      expect(recipientParam!.required).toBe(true);
      expect(recipientParam!.type).toBe("string");

      const amountParam = transferHandler!.parameters.find(
        (p) => p.name === "quantity",
      );
      expect(amountParam).toBeDefined();
      expect(amountParam!.required).toBe(true);
      expect(amountParam!.type).toBe("number");

      const memoParam = transferHandler!.parameters.find(
        (p) => p.name === "memo",
      );
      expect(memoParam).toBeDefined();
      expect(memoParam!.required).toBe(false);
      expect(memoParam!.type).toBe("string");
    });
  });

  describe("getDefaultTokenProcess", () => {
    it("should return token process with specified process ID", () => {
      const processId = "test-token-process-123";
      const tokenProcess = getDefaultTokenProcess(processId);

      expect(tokenProcess.processId).toBe(processId);
      expect(tokenProcess.name).toBe(DEFAULT_TOKEN_PROCESS.name);
      expect(tokenProcess.handlers).toEqual(DEFAULT_TOKEN_PROCESS.handlers);
    });
  });

  describe("isTokenProcess", () => {
    it("should identify token processes with core handlers", () => {
      const tokenHandlers = ["Transfer", "Balance", "Mint", "Burn"];
      expect(isTokenProcess(tokenHandlers)).toBe(true);
    });

    it("should identify token processes with sufficient handlers", () => {
      const tokenHandlers = ["Transfer", "Balance", "TotalSupply", "Name"];
      expect(isTokenProcess(tokenHandlers)).toBe(true);
    });

    it("should reject non-token processes", () => {
      const nonTokenHandlers = ["getData", "setConfig", "processOrder"];
      expect(isTokenProcess(nonTokenHandlers)).toBe(false);
    });

    it("should require minimum number of handlers when core handlers are missing", () => {
      const insufficientHandlers = ["Mint", "Burn"];
      expect(isTokenProcess(insufficientHandlers)).toBe(false);
    });
  });

  describe("extractTokenOperation", () => {
    it("should extract transfer operations", () => {
      const testCases = [
        {
          expected: {
            confidence: 0.9,
            operation: "transfer",
            parameters: { amount: 100, recipient: "alice" },
          },
          request: "Send 100 tokens to alice",
        },
        {
          expected: {
            confidence: 0.9,
            operation: "transfer",
            parameters: { amount: 50, recipient: "bob" },
          },
          request: "Transfer 50 tokens to bob with memo 'payment'",
        },
        {
          expected: {
            confidence: 0.9,
            operation: "transfer",
            parameters: { amount: 25, recipient: "charlie" },
          },
          request: "Give charlie 25 tokens",
        },
      ];

      for (const testCase of testCases) {
        const result = extractTokenOperation(testCase.request);
        expect(result).toBeDefined();
        expect(result!.operation).toBe(testCase.expected.operation);
        expect(result!.parameters.recipient).toBe(
          testCase.expected.parameters.recipient,
        );
        expect(result!.parameters.amount).toBe(
          testCase.expected.parameters.amount,
        );
        expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("should extract balance operations", () => {
      const testCases = [
        "Check my balance",
        "What's my token balance?",
        "Get balance for alice",
        "Balance for bob",
        "How many tokens do I have?",
      ];

      for (const request of testCases) {
        const result = extractTokenOperation(request);
        expect(result).toBeDefined();
        expect(result!.operation).toBe("balance");
        expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("should extract mint operations", () => {
      const testCases = [
        {
          expected: { amount: 1000, recipient: "alice" },
          request: "Mint 1000 tokens for alice",
        },
        {
          expected: { amount: 500, recipient: "bob" },
          request: "Create 500 new tokens for bob",
        },
      ];

      for (const testCase of testCases) {
        const result = extractTokenOperation(testCase.request);
        expect(result).toBeDefined();
        expect(result!.operation).toBe("mint");
        expect(result!.parameters.recipient).toBe(testCase.expected.recipient);
        expect(result!.parameters.amount).toBe(testCase.expected.amount);
      }
    });

    it("should extract burn operations", () => {
      const testCases = [
        "Burn 100 tokens",
        "Destroy 50 tokens",
        "Remove 25 tokens",
      ];

      for (const request of testCases) {
        const result = extractTokenOperation(request);
        expect(result).toBeDefined();
        expect(result!.operation).toBe("burn");
        expect(result!.parameters.amount).toBeGreaterThan(0);
      }
    });

    it("should return null for non-token operations", () => {
      const nonTokenRequests = [
        "Process this order",
        "Update configuration",
        "Delete user account",
        "Random text without token operations",
      ];

      for (const request of nonTokenRequests) {
        const result = extractTokenOperation(request);
        expect(result).toBeNull();
      }
    });
  });
});

describe("DefaultProcessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDefaultProcesses", () => {
    it("should return all available default processes", () => {
      const processes = defaultProcessService.getDefaultProcesses();
      expect(processes).toBeDefined();
      expect(processes.token).toBeDefined();
      expect(processes.token).toEqual(DEFAULT_TOKEN_PROCESS);
    });
  });

  describe("getDefaultProcess", () => {
    it("should return token process for token type", () => {
      const process = defaultProcessService.getDefaultProcess("token");
      expect(process).toBeDefined();
      expect(process).toEqual(DEFAULT_TOKEN_PROCESS);
    });

    it("should return token process with process ID", () => {
      const processId = "test-token-123";
      const process = defaultProcessService.getDefaultProcess(
        "token",
        processId,
      );
      expect(process).toBeDefined();
      expect(process!.processId).toBe(processId);
    });

    it("should handle case-insensitive type matching", () => {
      const testCases = [
        "TOKEN",
        "Token",
        "erc20",
        "ERC20",
        "fungible",
        "FUNGIBLE",
      ];

      for (const type of testCases) {
        const process = defaultProcessService.getDefaultProcess(type);
        expect(process).toBeDefined();
      }
    });

    it("should return null for unknown process types", () => {
      const process = defaultProcessService.getDefaultProcess("unknown");
      expect(process).toBeNull();
    });
  });

  describe("detectProcessType", () => {
    it("should detect token processes", () => {
      const tokenHandlers = [
        "Transfer",
        "Balance",
        "Mint",
        "Burn",
        "TotalSupply",
      ];
      const detection = defaultProcessService.detectProcessType(tokenHandlers);

      expect(detection).toBeDefined();
      expect(detection!.type).toBe("token");
      expect(detection!.confidence).toBeGreaterThan(0.4);
      expect(detection!.template).toEqual(DEFAULT_TOKEN_PROCESS);
      expect(detection!.suggestedHandlers).toContain("transfer");
      expect(detection!.suggestedHandlers).toContain("balance");
    });

    it("should calculate confidence based on handler overlap", () => {
      const fewHandlers = ["Transfer", "Balance"];
      const manyHandlers = [
        "Transfer",
        "Balance",
        "Mint",
        "Burn",
        "TotalSupply",
        "Name",
        "symbol",
      ];

      const detection1 = defaultProcessService.detectProcessType(fewHandlers);
      const detection2 = defaultProcessService.detectProcessType(manyHandlers);

      if (detection1 && detection2) {
        expect(detection2.confidence).toBeGreaterThan(detection1.confidence);
      }
    });

    it("should return null for non-token processes", () => {
      const nonTokenHandlers = ["getData", "setConfig", "processOrder"];
      const detection =
        defaultProcessService.detectProcessType(nonTokenHandlers);
      expect(detection).toBeNull();
    });
  });

  describe("processNaturalLanguage", () => {
    it("should process token requests with high confidence", () => {
      const request = "Send 100 tokens to alice";
      const processId = "test-token-123";

      const result = defaultProcessService.processNaturalLanguage(
        request,
        processId,
      );

      expect(result).toBeDefined();
      expect(result!.operation).toBe("transfer");
      expect(result!.parameters.recipient).toBe("alice");
      expect(result!.parameters.amount).toBe(100);
      expect(result!.processType).toBe("token");
      expect(result!.confidence).toBeGreaterThan(0.7);
      expect(result!.template.processId).toBe(processId);
    });

    it("should handle balance requests", () => {
      const request = "Check my balance";
      const result = defaultProcessService.processNaturalLanguage(request);

      expect(result).toBeDefined();
      expect(result!.operation).toBe("balance");
      expect(result!.processType).toBe("token");
    });

    it("should return null for non-processable requests", () => {
      const request = "This is not a token operation";
      const result = defaultProcessService.processNaturalLanguage(request);
      expect(result).toBeNull();
    });
  });

  describe("getSuggestedOperations", () => {
    it("should return token operations for token type", () => {
      const suggestions = defaultProcessService.getSuggestedOperations("token");
      expect(suggestions).toContain("Check balance");
      expect(suggestions).toContain("Transfer tokens");
      expect(suggestions).toContain("Get token info (name, symbol, supply)");
      expect(suggestions).toContain("Mint tokens (if owner)");
    });

    it("should return empty array for unknown types", () => {
      const suggestions =
        defaultProcessService.getSuggestedOperations("unknown");
      expect(suggestions).toEqual([]);
    });
  });

  describe("canHandleRequest", () => {
    it("should return true for token requests", () => {
      const tokenRequests = [
        "Send 100 tokens to alice",
        "Check my balance",
        "Mint 1000 tokens for bob",
        "Burn 50 tokens",
      ];

      for (const request of tokenRequests) {
        expect(defaultProcessService.canHandleRequest(request)).toBe(true);
      }
    });

    it("should return false for non-token requests", () => {
      const nonTokenRequests = [
        "Process this order",
        "Update user profile",
        "Delete account",
        "Random text",
      ];

      for (const request of nonTokenRequests) {
        expect(defaultProcessService.canHandleRequest(request)).toBe(false);
      }
    });
  });
});

describe("DefaultProcessUtils", () => {
  describe("getSupportedProcessTypes", () => {
    it("should return all supported process types", () => {
      const types = DefaultProcessUtils.getSupportedProcessTypes();
      expect(types).toContain("token");
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe("isTokenRequest", () => {
    it("should identify token requests", () => {
      const tokenRequests = [
        "Send 100 tokens to alice",
        "Check my balance",
        "Mint 1000 tokens for bob",
      ];

      for (const request of tokenRequests) {
        expect(DefaultProcessUtils.isTokenRequest(request)).toBe(true);
      }
    });

    it("should reject non-token requests", () => {
      const nonTokenRequests = [
        "Process order",
        "Update config",
        "Random text",
      ];

      for (const request of nonTokenRequests) {
        expect(DefaultProcessUtils.isTokenRequest(request)).toBe(false);
      }
    });
  });

  describe("getSmartSuggestions", () => {
    it("should suggest token operations for token-related partial requests", () => {
      const suggestions = DefaultProcessUtils.getSmartSuggestions("send");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes("tokens"))).toBe(true);
    });

    it("should suggest balance operations for balance-related requests", () => {
      const suggestions = DefaultProcessUtils.getSmartSuggestions("Balance");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes("balance"))).toBe(true);
    });

    it("should suggest mint operations for mint-related requests", () => {
      const suggestions =
        DefaultProcessUtils.getSmartSuggestions("mint tokens");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(
        suggestions.some((s) => s.includes("Mint") || s.includes("Mint")),
      ).toBe(true);
    });
  });
});

describe("Integration Tests", () => {
  describe("End-to-End Token Operation Flow", () => {
    it("should handle complete token transfer flow", () => {
      const request = "Send 100 tokens to alice with memo 'payment'";
      const processId = "test-token-123";

      // 1. Check if request can be handled
      expect(defaultProcessService.canHandleRequest(request)).toBe(true);

      // 2. Process natural language
      const nlsResult = defaultProcessService.processNaturalLanguage(
        request,
        processId,
      );
      expect(nlsResult).toBeDefined();
      expect(nlsResult!.operation).toBe("transfer");

      // 3. Get appropriate template
      const template = defaultProcessService.getDefaultProcess(
        "token",
        processId,
      );
      expect(template).toBeDefined();
      expect(template!.processId).toBe(processId);

      // 4. Verify handler exists
      const handler = template!.handlers.find((h) => h.action === "Transfer");
      expect(handler).toBeDefined();
      expect(handler!.isWrite).toBe(true);
    });

    it("should handle process type detection flow", () => {
      const handlers = ["Transfer", "Balance", "Mint", "Burn", "TotalSupply"];

      // 1. Detect process type
      const detection = defaultProcessService.detectProcessType(handlers);
      expect(detection).toBeDefined();
      expect(detection!.type).toBe("token");

      // 2. Get suggestions
      const suggestions = defaultProcessService.getSuggestedOperations(
        detection!.type,
      );
      expect(suggestions.length).toBeGreaterThan(0);

      // 3. Verify template
      expect(detection!.template).toEqual(DEFAULT_TOKEN_PROCESS);
    });
  });
});
