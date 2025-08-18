import { describe, expect, it } from "vitest";

import { ToolContext } from "../../../../src/tools/core/index.js";
import { GenerateLuaProcessCommand } from "../../../../src/tools/process/commands/GenerateLuaProcessCommand.js";
import { SpawnProcessCommand } from "../../../../src/tools/process/commands/SpawnProcessCommand.js";

describe("Process Tool Routing", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: undefined,
    keyPair: undefined,
    publicKey: undefined,
  };

  describe("GenerateLuaProcessCommand Metadata", () => {
    it("should contain keywords for AO process creation", () => {
      const command = new GenerateLuaProcessCommand(mockContext);
      const metadata = command.getMetadata();

      // Should contain explicit creation keywords
      expect(metadata.description).toContain("create AO process");
      expect(metadata.description).toContain("build AO process");
      expect(metadata.description).toContain("generate AO process");
      expect(metadata.description).toContain("make AO process");
      expect(metadata.description).toContain("develop process handlers");
      expect(metadata.description).toContain("implement AO logic");
    });

    it("should indicate priority for process creation requests", () => {
      const command = new GenerateLuaProcessCommand(mockContext);
      const metadata = command.getMetadata();

      expect(metadata.description).toContain(
        "Prioritized for all AO process creation",
      );
    });

    it("should have updated title reflecting creation capability", () => {
      const command = new GenerateLuaProcessCommand(mockContext);
      const metadata = command.getMetadata();

      expect(metadata.title).toBe("Create/Generate AO Process Code");
    });
  });

  describe("SpawnProcessCommand Metadata", () => {
    it("should clarify it creates empty processes without code", () => {
      const command = new SpawnProcessCommand(mockContext);
      const metadata = command.getMetadata();

      expect(metadata.description).toContain("empty AO process container");
      expect(metadata.description).toContain("no code");
      expect(metadata.description).toContain("spawn empty process");
    });

    it("should redirect to generateLuaProcess for code generation", () => {
      const command = new SpawnProcessCommand(mockContext);
      const metadata = command.getMetadata();

      expect(metadata.description).toContain(
        "For creating processes WITH Lua code, use generateLuaProcess",
      );
    });

    it("should have updated title indicating empty process creation", () => {
      const command = new SpawnProcessCommand(mockContext);
      const metadata = command.getMetadata();

      expect(metadata.title).toBe("Spawn Empty AO Process");
    });
  });

  describe("Tool Differentiation", () => {
    it("should have different purposes reflected in descriptions", () => {
      const generateCommand = new GenerateLuaProcessCommand(mockContext);
      const spawnCommand = new SpawnProcessCommand(mockContext);

      const generateMeta = generateCommand.getMetadata();
      const spawnMeta = spawnCommand.getMetadata();

      // GenerateCommand should focus on code creation
      expect(generateMeta.description).toContain("Lua code");
      expect(generateMeta.description).toContain("documentation-informed");
      expect(generateMeta.description).not.toContain("empty");

      // SpawnCommand should focus on empty process creation
      expect(spawnMeta.description).toContain("empty");
      expect(spawnMeta.description).toContain("no code");
      // SpawnCommand mentions "Lua code" when redirecting to generateLuaProcess
      expect(spawnMeta.description).toContain(
        "WITH Lua code, use generateLuaProcess",
      );
    });

    it("should have readOnlyHint differences", () => {
      const generateCommand = new GenerateLuaProcessCommand(mockContext);
      const spawnCommand = new SpawnProcessCommand(mockContext);

      const generateMeta = generateCommand.getMetadata();
      const spawnMeta = spawnCommand.getMetadata();

      // GenerateCommand is read-only (generates code, doesn't create processes)
      expect(generateMeta.readOnlyHint).toBe(true);

      // SpawnCommand modifies state (creates actual processes)
      expect(spawnMeta.readOnlyHint).toBe(false);
    });
  });

  describe("Tool Naming", () => {
    it("should have descriptive tool names", () => {
      const generateCommand = new GenerateLuaProcessCommand(mockContext);
      const spawnCommand = new SpawnProcessCommand(mockContext);

      expect(generateCommand.getMetadata().name).toBe("generateLuaProcess");
      expect(spawnCommand.getMetadata().name).toBe("spawnProcess");
    });
  });
});
