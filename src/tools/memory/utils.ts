import { Tag } from "../../models/Tag.js";
import { MEMORY_KIND, MEMORY_TAGS } from "./constants.js";

/**
 * Memory utility functions
 */

/**
 * Creates the standard memory tags for storage
 */
export function createMemoryTags(
  content: string,
  role: string,
  party: string,
): Tag[] {
  return [
    {
      name: MEMORY_TAGS.KIND,
      value: MEMORY_KIND,
    },
    {
      name: MEMORY_TAGS.CONTENT,
      value: content,
    },
    {
      name: MEMORY_TAGS.ROLE,
      value: role,
    },
    {
      name: MEMORY_TAGS.PARTY,
      value: party,
    },
  ];
}
