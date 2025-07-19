import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProcessCommunicationService } from "../../../src/services/ProcessCommunicationService.js";
import { createTealCompilerService } from "../../../src/services/TealCompilerService.js";
import { TokenProcessTemplateService } from "../../../src/services/TokenProcessTemplateService.js";

// Mock dependencies
vi.mock("../../../src/services/ProcessCommunicationService.js", () => ({
  ProcessCommunicationService: vi.fn(),
}));

vi.mock("../../../src/services/TokenProcessTemplateService.js", () => ({
  TokenProcessTemplateService: vi.fn(),
}));

describe("TealCompilerService", () => {
  let tealCompilerService: ReturnType<typeof createTealCompilerService>;
  let mockProcessService: ProcessCommunicationService;
  let mockTemplateService: TokenProcessTemplateService;

  beforeEach(() => {
    mockProcessService = {} as ProcessCommunicationService;
    mockTemplateService = {} as TokenProcessTemplateService;
    tealCompilerService = createTealCompilerService(
      mockProcessService,
      mockTemplateService,
    );
  });

  describe("compileTealToLua", () => {
    it("should compile valid Teal code to Lua", async () => {
      const tealSource = `
        local function hello(msg: AO.Message): AO.Response
          return {
            Output = json.encode({ message = "Hello" }),
            Messages = {},
            Spawns = {},
            Assignments = {}
          }
        end
      `;

      const result = await tealCompilerService.compileTealToLua(tealSource);

      expect(result.success).toBe(true);
      expect(result.compiledLua).toBeDefined();
      expect(result.compiledLua).toContain("function hello");
    });

    it("should return errors for invalid Teal syntax", async () => {
      const invalidTealSource = "invalid teal syntax";

      const result =
        await tealCompilerService.compileTealToLua(invalidTealSource);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should handle compilation options", async () => {
      const tealSource = `
        local function test(): string
          return "test"
        end
      `;

      const options = {
        strict: true,
        target: "lua53" as const,
        warnings: true,
      };

      const result = await tealCompilerService.compileTealToLua(
        tealSource,
        options,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("validateTealTypes", () => {
    it("should validate correct type definitions", async () => {
      const tealSource = `
        local record TestRecord
          name: string
          value: number
        end
        
        local function test(record: TestRecord): string
          return record.name
        end
      `;

      const result = await tealCompilerService.validateTealTypes(tealSource);

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should detect type errors", async () => {
      const tealSource = `
        local function test(param): string
          return param
        end
      `;

      const result = await tealCompilerService.validateTealTypes(tealSource);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("generateTypeDefinitions", () => {
    it("should generate type definitions for AO patterns", async () => {
      const patterns = ["token", "dao"];

      const result =
        await tealCompilerService.generateTypeDefinitions(patterns);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((def) => def.name === "TokenState")).toBe(true);
      expect(result.some((def) => def.name === "DAOState")).toBe(true);
    });

    it("should include AO core types", async () => {
      const patterns = ["token"];

      const result =
        await tealCompilerService.generateTypeDefinitions(patterns);

      expect(result.some((def) => def.name === "AO")).toBe(true);
    });
  });

  describe("createTealTemplate", () => {
    it("should create a token template", async () => {
      const template = await tealCompilerService.createTealTemplate(
        "token",
        "TestToken",
        {
          author: "Test Author",
          description: "Test token description",
          version: "1.0.0",
        },
      );

      expect(template.name).toBe("TestToken");
      expect(template.category).toBe("token");
      expect(template.source).toContain("TokenState");
      expect(template.source).toContain("TestToken");
    });

    it("should create a DAO template", async () => {
      const template = await tealCompilerService.createTealTemplate(
        "dao",
        "TestDAO",
        {
          author: "Test Author",
          description: "Test DAO description",
        },
      );

      expect(template.name).toBe("TestDAO");
      expect(template.category).toBe("dao");
      expect(template.source).toContain("DAOState");
    });

    it("should create a game template", async () => {
      const template = await tealCompilerService.createTealTemplate(
        "game",
        "TestGame",
        {
          author: "Test Author",
        },
      );

      expect(template.name).toBe("TestGame");
      expect(template.category).toBe("game");
      expect(template.source).toContain("GameState");
    });

    it("should create a generic template", async () => {
      const template = await tealCompilerService.createTealTemplate(
        "generic",
        "TestProcess",
        {
          author: "Test Author",
        },
      );

      expect(template.name).toBe("TestProcess");
      expect(template.category).toBe("generic");
      expect(template.source).toContain("ProcessState");
    });

    it("should throw error for unknown template type", async () => {
      await expect(
        tealCompilerService.createTealTemplate("unknown" as any, "Test", {}),
      ).rejects.toThrow("Unknown template type: unknown");
    });
  });

  describe("integrateWithAOServices", () => {
    it("should integrate valid Lua with AO services", async () => {
      const validLua = `
        local function handler(msg)
          return {
            Output = json.encode({ message = "Hello from " .. msg.From }),
            Messages = {},
            Spawns = {},
            Assignments = {}
          }
        end
        
        Handlers.add("test", Handlers.utils.hasMatchingTag("Action", "Test"), handler)
      `;

      const result = await tealCompilerService.integrateWithAOServices(
        validLua,
        "test-process",
      );

      expect(result).toBeDefined();
      expect(result).toContain("Handlers.add");
    });

    it("should reject Lua without AO patterns", async () => {
      const invalidLua = `
        local function test()
          return "hello"
        end
      `;

      await expect(
        tealCompilerService.integrateWithAOServices(invalidLua, "test-process"),
      ).rejects.toThrow("AO compatibility error");
    });
  });

  describe("createProcessDefinition", () => {
    it("should create a complete process definition", async () => {
      const tealSource = `
        local function info(msg: AO.Message): AO.Response
          return {
            Output = json.encode({ name = "Test Process" }),
            Messages = {},
            Spawns = {},
            Assignments = {}
          }
        end
        
        Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)
      `;

      const metadata = {
        aoVersion: "2.0.0",
        author: "Test Author",
        compileOptions: {
          strict: true,
          target: "lua53" as const,
          warnings: true,
        },
        description: "Test Process",
        version: "1.0.0",
      };

      const result = await tealCompilerService.createProcessDefinition(
        tealSource,
        metadata,
      );

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Test Process");
      expect(result.version).toBe("1.0.0");
      expect(result.source).toBe(tealSource);
      expect(result.compiledLua).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });

    it("should throw error for invalid Teal source", async () => {
      const invalidSource = "invalid teal";
      const metadata = {
        aoVersion: "2.0.0",
        author: "Test",
        compileOptions: {},
        description: "Test",
        version: "1.0.0",
      };

      await expect(
        tealCompilerService.createProcessDefinition(invalidSource, metadata),
      ).rejects.toThrow("Teal compilation failed");
    });
  });
});
