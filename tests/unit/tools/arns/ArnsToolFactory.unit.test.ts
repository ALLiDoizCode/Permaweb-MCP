import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolContext } from "../../../../src/tools/core/index.js";

import { ArnsToolFactory } from "../../../../src/tools/arns/ArnsToolFactory.js";

describe("ArnsToolFactory", () => {
  let factory: ArnsToolFactory;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      embeddedTemplates: new Map(),
      hubId: undefined,
      keyPair: undefined,
      publicKey: undefined,
    };

    factory = new ArnsToolFactory({
      categoryDescription:
        "ArNS name system operations for decentralized domains",
      categoryName: "ArNS",
      context: mockContext,
    });
  });

  describe("initialization", () => {
    it("should create factory instance", () => {
      expect(factory).toBeDefined();
      expect(factory).toBeInstanceOf(ArnsToolFactory);
    });

    it("should extend BaseToolFactory", () => {
      expect(factory.registerTools).toBeDefined();
      expect(typeof factory.registerTools).toBe("function");
    });
  });

  describe("getToolClasses", () => {
    it("should return ArNS command classes", () => {
      // Access protected method through type assertion for testing
      const toolClasses = (factory as any).getToolClasses();
      expect(Array.isArray(toolClasses)).toBe(true);
      expect(toolClasses).toHaveLength(3); // ResolveArnsNameCommand, GetArnsRecordInfoCommand, GetArnsTokenCostCommand
      expect(toolClasses[0].name).toBe("ResolveArnsNameCommand");
      expect(toolClasses[1].name).toBe("GetArnsRecordInfoCommand");
      expect(toolClasses[2].name).toBe("GetArnsTokenCostCommand");
    });
  });

  describe("tool registration", () => {
    it("should register without errors", () => {
      const mockToolRegistry = {
        clear: () => {},
        getAllTools: () => [],
        getCategories: () => [],
        getTool: () => undefined,
        hasCategory: () => false,
        hasTool: () => false,
        register: vi.fn(),
        registerCategory: vi.fn(),
      };

      expect(() => {
        factory.registerTools(mockToolRegistry as any);
      }).not.toThrow();

      expect(mockToolRegistry.registerCategory).toHaveBeenCalledWith(
        "ArNS",
        "ArNS name system operations for decentralized domains",
        expect.any(Array),
      );

      // Verify that the registered array contains command instances
      const registeredCommands =
        mockToolRegistry.registerCategory.mock.calls[0][2];
      expect(registeredCommands).toHaveLength(3);
      expect(registeredCommands[0].constructor.name).toBe(
        "ResolveArnsNameCommand",
      );
      expect(registeredCommands[1].constructor.name).toBe(
        "GetArnsRecordInfoCommand",
      );
      expect(registeredCommands[2].constructor.name).toBe(
        "GetArnsTokenCostCommand",
      );
    });
  });
});
