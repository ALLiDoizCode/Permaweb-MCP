import { describe, expect, it } from "vitest";

import { createMemoryTags } from "../../../../src/tools/memory/utils.js";

describe("Memory Utils", () => {
  describe("createMemoryTags", () => {
    it("should create correct memory tags", () => {
      const content = "Test memory content";
      const role = "user";
      const party = "test-public-key";

      const tags = createMemoryTags(content, role, party);

      expect(tags).toEqual([
        { name: "Kind", value: "10" },
        { name: "Content", value: content },
        { name: "r", value: role },
        { name: "p", value: party },
      ]);
    });

    it("should handle empty content", () => {
      const tags = createMemoryTags("", "user", "key");

      expect(tags).toEqual([
        { name: "Kind", value: "10" },
        { name: "Content", value: "" },
        { name: "r", value: "user" },
        { name: "p", value: "key" },
      ]);
    });
  });
});
