import { describe, expect, it } from "vitest";

import { BMADYoloCommand } from "../../../../../src/tools/bmad/commands/BMADYoloCommand.js";
import { ToolContext } from "../../../../../src/tools/core/index.js";

describe("BMADYoloCommand", () => {
  const mockContext: ToolContext = {
    embeddedTemplates: new Map(),
    hubId: "test-hub-id",
    keyPair: {} as any,
    publicKey: "test-public-key",
  };

  const yoloCommand = new BMADYoloCommand(mockContext);

  it("should have correct metadata", () => {
    const metadata = yoloCommand.getMetadata();
    expect(metadata.name).toBe("bmad_yolo");
    expect(metadata.title).toBe("BMAD Quick Execution");
    expect(metadata.description).toBe(
      "Quick execution mode for common BMAD operations",
    );
    expect(metadata.readOnlyHint).toBe(false);
    expect(metadata.openWorldHint).toBe(false);
  });

  it("should execute status operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "status" },
      mockContext,
    );

    expect(result).toContain("# Quick Status Check");
    expect(result).toContain("**BMAD System:** ✅ Active");
    expect(result).toContain("**Resources:** ✅ Available");
    expect(result).toContain("**Cache:** ✅ Operational");
  });

  it("should execute setup operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "setup" },
      mockContext,
    );

    expect(result).toContain("# Quick Setup Complete");
    expect(result).toContain("**Environment:** ✅ Initialized");
    expect(result).toContain("**Resources:** ✅ Available");
    expect(result).toContain("**Configuration:** ✅ Loaded");
  });

  it("should execute validate operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "validate" },
      mockContext,
    );

    expect(result).toContain("# Quick Validation Results");
    expect(result).toContain("**Configuration:** ✅ Valid");
    expect(result).toContain("**Resources:** ✅ Accessible");
    expect(result).toContain("**Dependencies:** ✅ Available");
  });

  it("should execute test operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "test" },
      mockContext,
    );

    expect(result).toContain("# Quick Test Results");
    expect(result).toContain("**BMAD Core:** ✅ Functional");
    expect(result).toContain("**Resource Loading:** ✅ Working");
    expect(result).toContain("**Command Processing:** ✅ Operational");
  });

  it("should execute clean operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "clean" },
      mockContext,
    );

    expect(result).toContain("# Quick Clean Operation");
    expect(result).toContain("**Cache:** ✅ Cleared");
    expect(result).toContain("**Temp Files:** ✅ Removed");
    expect(result).toContain("**Status:** Cleanup completed");
  });

  it("should show not implemented message for deploy operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "deploy" },
      mockContext,
    );

    expect(result).toContain("# Quick Deploy Operation");
    expect(result).toContain("**Status:** ⚠️ Not Implemented");
    expect(result).toContain(
      "Quick deploy functionality is not yet implemented",
    );
  });

  it("should show not implemented message for build operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "build" },
      mockContext,
    );

    expect(result).toContain("# Quick Build Operation");
    expect(result).toContain("**Status:** ⚠️ Not Implemented");
    expect(result).toContain(
      "Quick build functionality is not yet implemented",
    );
  });

  it("should show not implemented message for backup operation", async () => {
    const result = await yoloCommand.execute(
      { operation: "backup" },
      mockContext,
    );

    expect(result).toContain("# Quick Backup Operation");
    expect(result).toContain("**Status:** ⚠️ Not Implemented");
    expect(result).toContain(
      "Quick backup functionality is not yet implemented",
    );
  });

  it("should handle unknown operations", async () => {
    const result = await yoloCommand.execute(
      { operation: "unknown" },
      mockContext,
    );

    expect(result).toContain("# Unknown Quick Operation: unknown");
    expect(result).toContain("## Available Quick Operations");
    expect(result).toContain("- **status**");
    expect(result).toContain("- **setup**");
    expect(result).toContain("- **validate**");
    expect(result).toContain("- **test**");
    expect(result).toContain("- **clean**");
  });

  it("should handle case insensitive operations", async () => {
    const result = await yoloCommand.execute(
      { operation: "STATUS" },
      mockContext,
    );

    expect(result).toContain("# Quick Status Check");
    expect(result).toContain("**BMAD System:** ✅ Active");
  });

  it("should accept parameters even if not used", async () => {
    const result = await yoloCommand.execute(
      {
        operation: "status",
        parameters: { param1: "value1" },
      },
      mockContext,
    );

    expect(result).toContain("# Quick Status Check");
    expect(result).toContain("**BMAD System:** ✅ Active");
  });
});
