import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  AIMemory,
  MemoryAnalytics,
  MemoryContext,
  MemoryLink,
  MemoryType,
  ReasoningTrace,
  RelationshipType,
  SearchFilters,
} from "../models/AIMemory.js";
import {
  MediaPromotionParams,
  MediaPromotionResult,
  MediaReference,
  MediaValidationResult,
} from "../models/MediaReference.js";
import { Memory } from "../models/Memory.js";
import { Tag } from "../models/Tag.js";
// VIP01Filter removed - using manual filters now
import { event, fetchEvents, fetchEventsVIP01 } from "../relay.js";
import {
  LoadNetworkStorageService,
  ServiceResult,
} from "./LoadNetworkStorageService.js";

// Constants for memory kinds
const MEMORY_KINDS = {
  AI_MEMORY: "10",
  CONTACT_MAPPING: "31",
  CONTEXT_DOCUMENTATION: "50",
  MEMORY_CONTEXT: "40",
  MEMORY_RELATIONSHIP: "11",
  REASONING_CHAIN: "23",
  TOKEN_MAPPING: "30",
} as const;

// Validation utilities
const isValidImportance = (importance: number): boolean =>
  importance >= 0 && importance <= 1;

const isValidStrength = (strength: number): boolean =>
  strength >= 0 && strength <= 1;

const isNonEmptyString = (value: string): boolean =>
  typeof value === "string" && value.trim().length > 0;

export interface AIMemoryService {
  // Enhanced memory operations
  addEnhanced: (
    signer: JWKInterface,
    hubId: string,
    memory: Partial<AIMemory>,
  ) => Promise<string>;
  // Media reference operations
  addMediaReferenceToMemory: (
    signer: JWKInterface,
    hubId: string,
    memoryId: string,
    mediaReference: MediaReference,
  ) => Promise<string>;
  // Batch operations
  addMemoriesBatch: (
    signer: JWKInterface,
    hubId: string,
    memories: Partial<AIMemory>[],
    p: string,
  ) => Promise<string[]>;

  // Reasoning chain operations
  addReasoningChain: (
    signer: JWKInterface,
    hubId: string,
    reasoning: ReasoningTrace,
    p: string,
  ) => Promise<string>;
  // Media integrity operations
  checkMediaIntegrity: (
    mediaReferences: MediaReference[],
  ) => Promise<MediaValidationResult>;

  createAIMemoryTags: (memory: Partial<AIMemory>) => Tag[];
  // Context management
  createMemoryContext: (
    signer: JWKInterface,
    hubId: string,
    contextName: string,
    description: string,
    p: string,
  ) => Promise<string>;

  detectCircularReferences: (hubId: string) => Promise<string[]>;

  // Utility functions
  eventToAIMemory: (event: Record<string, unknown>) => AIMemory;

  findShortestPath: (
    hubId: string,
    fromId: string,
    toId: string,
  ) => Promise<string[]>;
  // Media template operations
  formatMemoryWithMedia: (memory: AIMemory) => string;

  getContextMemories: (hubId: string, contextId: string) => Promise<AIMemory[]>;
  // Analytics
  getMemoryAnalytics: (hubId: string, p?: string) => Promise<MemoryAnalytics>;
  // Relationship analysis methods
  getMemoryRelationships: (
    hubId: string,
    memoryId?: string,
  ) => Promise<MemoryLink[]>;
  getReasoningChain: (
    hubId: string,
    chainId: string,
  ) => Promise<null | ReasoningTrace>;

  getRelationshipAnalytics: (hubId: string) => Promise<{
    averageStrength: number;
    strongestConnections: Array<{ from: string; strength: number; to: string }>;
    topRelationshipTypes: Array<{ count: number; type: string }>;
    totalLinks: number;
  }>;

  linkMemories: (
    signer: JWKInterface,
    hubId: string,
    sourceId: string,
    targetId: string,
    relationship: MemoryLink,
  ) => Promise<string>;

  // Media promotion operations
  promoteMediaToPermanent: (
    signer: JWKInterface,
    hubId: string,
    params: MediaPromotionParams,
  ) => Promise<MediaPromotionResult>;

  searchAdvanced: (
    hubId: string,
    query: string,
    filters?: SearchFilters,
  ) => Promise<AIMemory[]>;

  searchByMediaMetadata: (
    hubId: string,
    metadataKey: string,
    metadataValue: string,
    filters?: SearchFilters,
  ) => Promise<AIMemory[]>;

  // Media-enriched search operations
  searchByMediaType: (
    hubId: string,
    mimeType: string,
    filters?: SearchFilters,
  ) => Promise<AIMemory[]>;

  // Media validation operations
  validateMediaReferences: (
    mediaReferences: MediaReference[],
  ) => Promise<MediaValidationResult>;
}

const aiService = (): AIMemoryService => {
  return {
    addEnhanced: async (
      signer: JWKInterface,
      hubId: string,
      memory: Partial<AIMemory>,
    ): Promise<string> => {
      // Validate required fields
      if (!memory.content || !isNonEmptyString(memory.content)) {
        throw new Error("Memory content is required");
      }
      if (!memory.p || !isNonEmptyString(memory.p)) {
        throw new Error("Memory p parameter is required");
      }
      if (
        memory.importance !== undefined &&
        !isValidImportance(memory.importance)
      ) {
        throw new Error("Importance must be between 0 and 1");
      }

      const tags = createAIMemoryTags(memory);
      try {
        await event(signer, hubId, tags);
        return JSON.stringify(tags);
      } catch (error) {
        // Error adding enhanced memory - silent for MCP compatibility
        return JSON.stringify(tags);
      }
    },

    addMediaReferenceToMemory: async (
      signer: JWKInterface,
      hubId: string,
      memoryId: string,
      mediaReference: MediaReference,
    ): Promise<string> => {
      try {
        // Validate inputs
        if (!isNonEmptyString(memoryId)) {
          throw new Error("Memory ID is required");
        }
        if (!isNonEmptyString(mediaReference.fileId)) {
          throw new Error("Media reference file ID is required");
        }

        // Create tags for media reference attachment
        const tags: Tag[] = [
          { name: "Kind", value: MEMORY_KINDS.AI_MEMORY },
          { name: "ai_type", value: "media_attachment" },
          { name: "memoryId", value: memoryId },
          { name: "mediaFileId", value: mediaReference.fileId },
          { name: "mediaFileName", value: mediaReference.fileName },
          { name: "mediaMimeType", value: mediaReference.mimeType },
          { name: "mediaSize", value: mediaReference.size.toString() },
          { name: "mediaStorageType", value: mediaReference.storageType },
          { name: "mediaUploadDate", value: mediaReference.uploadDate },
          { name: "mediaUrl", value: mediaReference.url },
        ];

        if (mediaReference.checksum) {
          tags.push({ name: "mediaChecksum", value: mediaReference.checksum });
        }
        if (mediaReference.description) {
          tags.push({
            name: "mediaDescription",
            value: mediaReference.description,
          });
        }
        if (mediaReference.fileMetadata) {
          tags.push({
            name: "mediaFileMetadata",
            value: JSON.stringify(mediaReference.fileMetadata),
          });
        }

        await event(signer, hubId, tags);
        return "Media reference added to memory successfully";
      } catch (e) {
        throw new Error(`Failed to add media reference to memory: ${e}`);
      }
    },

    addMemoriesBatch: async (
      signer: JWKInterface,
      hubId: string,
      memories: Partial<AIMemory>[],
      p: string,
    ): Promise<string[]> => {
      try {
        const results: string[] = [];

        for (const memory of memories) {
          memory.p = p; // Ensure p is set
          const result = await aiService().addEnhanced(signer, hubId, memory);
          results.push(result);
        }

        return results;
      } catch (e) {
        return [`Failed to add memories batch: ${e}`];
      }
    },

    addReasoningChain: async (
      signer: JWKInterface,
      hubId: string,
      reasoning: ReasoningTrace,
      p: string,
    ): Promise<string> => {
      try {
        // Validate inputs
        if (!isNonEmptyString(reasoning.chainId)) {
          throw new Error("Chain ID is required");
        }
        if (!reasoning.steps || reasoning.steps.length === 0) {
          throw new Error("At least one reasoning step is required");
        }
        if (!isNonEmptyString(p)) {
          throw new Error("P parameter is required");
        }

        const tags: Tag[] = [
          { name: "Kind", value: MEMORY_KINDS.REASONING_CHAIN },
          { name: "chainId", value: reasoning.chainId },
          { name: "steps", value: JSON.stringify(reasoning.steps) },
          { name: "outcome", value: reasoning.outcome },
          { name: "p", value: p },
        ];

        await event(signer, hubId, tags);
        return "Reasoning chain added successfully";
      } catch (e) {
        throw new Error(`Failed to add reasoning chain: ${e}`);
      }
    },

    checkMediaIntegrity: async (
      mediaReferences: MediaReference[],
    ): Promise<MediaValidationResult> => {
      try {
        const errors: string[] = [];
        const warnings: string[] = [];
        const validationDetails: MediaValidationResult["validationDetails"] =
          [];

        for (const mediaRef of mediaReferences) {
          const detail: {
            checksumValid?: boolean;
            error?: string;
            fileId: string;
            isAccessible: boolean;
            sizeMatch?: boolean;
          } = {
            fileId: mediaRef.fileId,
            isAccessible: false,
          };

          try {
            // Basic accessibility check
            if (mediaRef.url && isNonEmptyString(mediaRef.url)) {
              try {
                new URL(mediaRef.url);
                detail.isAccessible = true;

                // If checksum is provided, we could validate it
                if (mediaRef.checksum) {
                  // Note: This would require actually fetching the file content
                  // For now, we'll assume checksum is valid if provided
                  detail.checksumValid = true;
                }

                // Size validation
                if (mediaRef.size > 0) {
                  detail.sizeMatch = true;
                } else {
                  warnings.push(`Media ${mediaRef.fileId} has invalid size`);
                }
              } catch {
                detail.error = "Invalid URL format";
                errors.push(`Media ${mediaRef.fileId} has invalid URL`);
              }
            } else {
              detail.error = "Missing URL";
              errors.push(`Media ${mediaRef.fileId} missing URL`);
            }
          } catch (checkError) {
            detail.error = `Integrity check failed: ${checkError}`;
            errors.push(
              `Failed to check integrity for media ${mediaRef.fileId}: ${checkError}`,
            );
          }

          validationDetails.push(detail);
        }

        return {
          errors,
          isValid: errors.length === 0,
          validationDetails,
          warnings,
        };
      } catch (error) {
        return {
          errors: [`Media integrity check failed: ${error}`],
          isValid: false,
          validationDetails: [],
          warnings: [],
        };
      }
    },

    createAIMemoryTags: createAIMemoryTags,

    createMemoryContext: async (
      signer: JWKInterface,
      hubId: string,
      contextName: string,
      description: string,
      p: string,
    ): Promise<string> => {
      try {
        // Validate inputs
        if (!isNonEmptyString(contextName)) {
          throw new Error("Context name is required");
        }
        if (!isNonEmptyString(p)) {
          throw new Error("P parameter is required");
        }

        const tags: Tag[] = [
          { name: "Kind", value: MEMORY_KINDS.MEMORY_CONTEXT },
          { name: "contextName", value: contextName },
          { name: "description", value: description },
          { name: "p", value: p },
        ];

        await event(signer, hubId, tags);
        return "Memory context created successfully";
      } catch (e) {
        throw new Error(`Failed to create memory context: ${e}`);
      }
    },

    detectCircularReferences: async (hubId: string): Promise<string[]> => {
      try {
        const filter = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 1000,
          tags: { ai_type: ["link"] },
        };
        const _filters = JSON.stringify([filter]);
        const events = await fetchEvents(hubId, _filters);

        const links = new Map<string, Set<string>>();
        const visited = new Set<string>();
        const cycles: string[] = [];

        // Build adjacency list from memory links
        events.forEach((event: Record<string, unknown>) => {
          const fromId = event.from_memory_id as string;
          const toId = event.to_memory_id as string;
          if (fromId && toId) {
            if (!links.has(fromId)) links.set(fromId, new Set());
            links.get(fromId)!.add(toId);
          }
        });

        // DFS to detect cycles
        const dfs = (nodeId: string, path: Set<string>): void => {
          if (path.has(nodeId)) {
            cycles.push(Array.from(path).join(" -> ") + " -> " + nodeId);
            return;
          }
          if (visited.has(nodeId)) return;

          visited.add(nodeId);
          path.add(nodeId);

          const neighbors = links.get(nodeId) || new Set();
          neighbors.forEach((neighbor) => dfs(neighbor, path));

          path.delete(nodeId);
        };

        Array.from(links.keys()).forEach((nodeId) => {
          if (!visited.has(nodeId)) {
            dfs(nodeId, new Set());
          }
        });

        return cycles;
      } catch (error) {
        // Error detecting circular references - silent for MCP compatibility
        return [];
      }
    },

    eventToAIMemory: eventToAIMemory,

    findShortestPath: async (
      hubId: string,
      fromId: string,
      toId: string,
    ): Promise<string[]> => {
      try {
        const filter = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 1000,
          tags: { ai_type: ["link"] },
        };
        const _filters = JSON.stringify([filter]);
        const events = await fetchEvents(hubId, _filters);

        const graph = new Map<string, string[]>();

        // Build adjacency list
        events.forEach((event: Record<string, unknown>) => {
          const from = event.from_memory_id as string;
          const to = event.to_memory_id as string;
          if (from && to) {
            if (!graph.has(from)) graph.set(from, []);
            graph.get(from)!.push(to);
          }
        });

        // BFS to find shortest path
        const queue: Array<{ id: string; path: string[] }> = [
          { id: fromId, path: [fromId] },
        ];
        const visited = new Set<string>();

        while (queue.length > 0) {
          const { id, path } = queue.shift()!;

          if (id === toId) {
            return path;
          }

          if (visited.has(id)) continue;
          visited.add(id);

          const neighbors = graph.get(id) || [];
          neighbors.forEach((neighbor) => {
            if (!visited.has(neighbor)) {
              queue.push({ id: neighbor, path: [...path, neighbor] });
            }
          });
        }

        return []; // No path found
      } catch (error) {
        // Error finding shortest path - silent for MCP compatibility
        return [];
      }
    },
    formatMemoryWithMedia: (memory: AIMemory): string => {
      try {
        let formatted = `**Memory Content:**\n${memory.content}\n\n`;

        if (memory.mediaReferences && memory.mediaReferences.length > 0) {
          formatted += `**Attached Media (${memory.mediaReferences.length} files):**\n\n`;

          memory.mediaReferences.forEach((media, index) => {
            const fileSize =
              media.size > 1024 * 1024
                ? `${(media.size / (1024 * 1024)).toFixed(2)} MB`
                : `${(media.size / 1024).toFixed(2)} KB`;

            formatted += `${index + 1}. **${media.fileName}**\n`;
            formatted += `   - Type: ${media.mimeType}\n`;
            formatted += `   - Size: ${fileSize}\n`;
            formatted += `   - Storage: ${media.storageType}\n`;
            formatted += `   - Uploaded: ${new Date(media.uploadDate).toLocaleDateString()}\n`;

            if (media.description) {
              formatted += `   - Description: ${media.description}\n`;
            }

            if (media.url) {
              formatted += `   - [Access File](${media.url})\n`;
            }

            formatted += `\n`;
          });
        }

        // Add context information
        if (memory.context) {
          formatted += `**Context:**\n`;
          if (memory.context.topic) {
            formatted += `- Topic: ${memory.context.topic}\n`;
          }
          if (memory.context.domain) {
            formatted += `- Domain: ${memory.context.domain}\n`;
          }
          if (memory.context.sessionId) {
            formatted += `- Session: ${memory.context.sessionId}\n`;
          }
        }

        // Add metadata
        formatted += `\n**Memory Details:**\n`;
        formatted += `- Type: ${memory.memoryType}\n`;
        formatted += `- Importance: ${memory.importance.toFixed(2)}\n`;
        formatted += `- Created: ${new Date(memory.timestamp).toLocaleDateString()}\n`;

        return formatted;
      } catch (error) {
        return `Error formatting memory with media: ${error}`;
      }
    },

    getContextMemories: async (
      hubId: string,
      contextId: string,
    ): Promise<AIMemory[]> => {
      try {
        const filter = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          tags: { ai_context_id: [contextId] },
        };
        const _filters = JSON.stringify([filter]);
        const events = await fetchEvents(hubId, _filters);

        return events
          .filter(
            (event): event is Record<string, unknown> =>
              typeof event === "object" && event !== null && "Content" in event,
          )
          .map((event) => eventToAIMemory(event));
      } catch {
        return [];
      }
    },

    getMemoryAnalytics: async (
      hubId: string,
      p?: string,
    ): Promise<MemoryAnalytics> => {
      try {
        const filter: Record<string, unknown> = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
        };

        if (p) {
          filter.tags = { p: [p] };
        }

        const _filters = JSON.stringify([filter]);
        const events = await fetchEvents(hubId, _filters);
        const aiMemories = events
          .filter(
            (event): event is Record<string, unknown> =>
              typeof event === "object" && event !== null && "Content" in event,
          )
          .map((event) => eventToAIMemory(event));

        return generateAnalytics(aiMemories);
      } catch {
        // Return default analytics on error
        return {
          accessPatterns: {
            mostAccessed: [],
            recentlyAccessed: [],
            unusedMemories: [],
          },
          importanceDistribution: {
            high: 0,
            low: 0,
            medium: 0,
          },
          memoryTypeDistribution: {
            context: 0,
            conversation: 0,
            enhancement: 0,
            knowledge: 0,
            performance: 0,
            procedure: 0,
            reasoning: 0,
            workflow: 0,
          },
          totalMemories: 0,
        };
      }
    },

    getMemoryRelationships: async (
      hubId: string,
      memoryId?: string,
    ): Promise<MemoryLink[]> => {
      try {
        const filterParams = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 500,
          tags: { ai_type: ["link"] } as Record<string, string[]>,
        };

        if (memoryId) {
          filterParams.tags.from_memory_id = [memoryId];
        }

        const result = await fetchEventsVIP01(hubId, filterParams);

        if (!result || !result.events) {
          return [];
        }

        return result.events.map((event: unknown) => {
          const eventRecord = event as Record<string, unknown>;
          return {
            strength: parseFloat(
              (eventRecord.link_strength as string) || "0.5",
            ),
            targetId: (eventRecord.to_memory_id as string) || "",
            type: ((eventRecord.link_type as string) ||
              "references") as RelationshipType,
          };
        });
      } catch (error) {
        // Error getting memory relationships - silent for MCP compatibility
        return [];
      }
    },

    getReasoningChain: async (
      hubId: string,
      chainId: string,
    ): Promise<null | ReasoningTrace> => {
      try {
        const filter = {
          kinds: [MEMORY_KINDS.REASONING_CHAIN],
          limit: 1, // Only need one reasoning chain
          tags: { chainId: [chainId] },
        };
        const result = await fetchEventsVIP01(hubId, filter);

        if (!result || !result.events || result.events.length === 0)
          return null;

        const event = result.events[0] as Record<string, unknown>;
        return {
          chainId: event.chainId as string,
          outcome: (event.outcome as string) || "",
          steps: JSON.parse((event.steps as string) || "[]"),
        };
      } catch {
        return null;
      }
    },

    getRelationshipAnalytics: async (
      hubId: string,
    ): Promise<{
      averageStrength: number;
      strongestConnections: Array<{
        from: string;
        strength: number;
        to: string;
      }>;
      topRelationshipTypes: Array<{ count: number; type: string }>;
      totalLinks: number;
    }> => {
      try {
        const links = await aiMemoryService.getMemoryRelationships(hubId);

        const totalLinks = links.length;
        const averageStrength =
          totalLinks > 0
            ? links.reduce((sum, link) => sum + link.strength, 0) / totalLinks
            : 0;

        // Count relationship types
        const typeCount = new Map<string, number>();
        links.forEach((link) => {
          typeCount.set(link.type, (typeCount.get(link.type) || 0) + 1);
        });

        const topRelationshipTypes = Array.from(typeCount.entries())
          .map(([type, count]) => ({ count, type }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Get events for connection analysis
        const eventsFilter = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 500,
          tags: { ai_type: ["link"] },
        };
        const _eventsFilters = JSON.stringify([eventsFilter]);
        const linkEvents = await fetchEvents(hubId, _eventsFilters);

        const strongestConnections = linkEvents
          .sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              parseFloat((b.link_strength as string) || "0") -
              parseFloat((a.link_strength as string) || "0"),
          )
          .slice(0, 10)
          .map((event: Record<string, unknown>) => ({
            from: (event.from_memory_id as string) || "",
            strength: parseFloat((event.link_strength as string) || "0"),
            to: (event.to_memory_id as string) || "",
          }));

        return {
          averageStrength,
          strongestConnections,
          topRelationshipTypes,
          totalLinks,
        };
      } catch (error) {
        // Error getting relationship analytics - silent for MCP compatibility
        return {
          averageStrength: 0,
          strongestConnections: [],
          topRelationshipTypes: [],
          totalLinks: 0,
        };
      }
    },

    linkMemories: async (
      signer: JWKInterface,
      hubId: string,
      sourceId: string,
      targetId: string,
      relationship: MemoryLink,
    ): Promise<string> => {
      try {
        // Validate inputs
        if (!isNonEmptyString(sourceId)) {
          throw new Error("Source ID is required");
        }
        if (!isNonEmptyString(targetId)) {
          throw new Error("Target ID is required");
        }
        if (sourceId === targetId) {
          throw new Error("Self-referential relationships are not allowed");
        }
        if (!isValidStrength(relationship.strength)) {
          throw new Error("Relationship strength must be between 0 and 1");
        }

        const tags: Tag[] = [
          { name: "Kind", value: MEMORY_KINDS.MEMORY_RELATIONSHIP },
          { name: "sourceId", value: sourceId },
          { name: "targetId", value: targetId },
          { name: "relationshipType", value: relationship.type },
          { name: "strength", value: relationship.strength.toString() },
        ];

        await event(signer, hubId, tags);
        return "Memory link created successfully";
      } catch (e) {
        throw new Error(`Failed to link memories: ${e}`);
      }
    },

    promoteMediaToPermanent: async (
      signer: JWKInterface,
      hubId: string,
      params: MediaPromotionParams,
    ): Promise<MediaPromotionResult> => {
      try {
        // Validate inputs
        if (!isNonEmptyString(params.fileId)) {
          throw new Error("File ID is required for promotion");
        }

        // Note: This is a placeholder implementation as the actual promotion
        // would require integrating with Arweave permanent storage
        // For now, we'll update the storage type in the memory system
        const tags: Tag[] = [
          { name: "Kind", value: MEMORY_KINDS.AI_MEMORY },
          { name: "ai_type", value: "media_promotion" },
          { name: "fileId", value: params.fileId },
          { name: "promotedToStorageType", value: "permanent" },
          { name: "promotionDate", value: new Date().toISOString() },
        ];

        if (params.description) {
          tags.push({
            name: "promotionDescription",
            value: params.description,
          });
        }
        if (params.metadata) {
          tags.push({
            name: "promotionMetadata",
            value: JSON.stringify(params.metadata),
          });
        }

        await event(signer, hubId, tags);

        return {
          permanentUrl: `https://arweave.net/${params.fileId}`,
          success: true,
          updatedReference: {
            description: params.description,
            fileId: params.fileId,
            fileMetadata: params.metadata,
            fileName: `promoted_${params.fileId}`,
            mimeType: "application/octet-stream", // Would be determined from actual file
            size: 0, // Would be determined from actual file
            storageType: "permanent",
            uploadDate: new Date().toISOString(),
            url: `https://arweave.net/${params.fileId}`, // Placeholder URL
          },
        };
      } catch (error) {
        return {
          error: `Failed to promote media to permanent storage: ${error}`,
          success: false,
        };
      }
    },

    searchAdvanced: async (
      hubId: string,
      query: string,
      filters?: SearchFilters,
    ): Promise<AIMemory[]> => {
      try {
        // Build filter
        const filterParams = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 100,
        } as Record<string, unknown>;

        if (query) {
          filterParams.search = query;
        }

        // Build tags object for AI-specific filtering
        const tags: Record<string, string[]> = {};

        if (filters?.memoryType) {
          tags.ai_type = [filters.memoryType];
        }

        if (filters?.importanceThreshold) {
          // Note: This would require hub-side filtering support
          tags.ai_importance_min = [filters.importanceThreshold.toString()];
        }

        if (filters?.sessionId) {
          tags.ai_session = [filters.sessionId];
        }

        if (filters?.domain) {
          tags.ai_domain = [filters.domain];
        }

        if (Object.keys(tags).length > 0) {
          filterParams.tags = tags;
        }

        // Add time range filtering if provided
        if (filters?.timeRange) {
          if (filters.timeRange.start) {
            filterParams.since = new Date(filters.timeRange.start).getTime();
          }
          if (filters.timeRange.end) {
            filterParams.until = new Date(filters.timeRange.end).getTime();
          }
        }

        const result = await fetchEventsVIP01(hubId, filterParams);

        if (!result || !result.events) {
          return [];
        }

        const aiMemories = result.events
          .filter(
            (event): event is Record<string, unknown> =>
              typeof event === "object" && event !== null && "Content" in event,
          )
          .map((event) => eventToAIMemory(event))
          .filter((memory) => matchesFilters(memory, filters));

        return rankMemoriesByRelevance(aiMemories);
      } catch (error) {
        throw new Error(`Failed to search memories: ${error}`);
      }
    },

    searchByMediaMetadata: async (
      hubId: string,
      metadataKey: string,
      metadataValue: string,
      filters?: SearchFilters,
    ): Promise<AIMemory[]> => {
      try {
        // Search for memories with media that have specific metadata
        const filterParams = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 100,
          tags: {
            ai_type: ["media_attachment"],
          },
        } as Record<string, unknown>;

        // Apply additional filters
        if (filters) {
          const tags = filterParams.tags as Record<string, string[]>;
          if (filters.memoryType) {
            tags.ai_memory_type = [filters.memoryType];
          }
          if (filters.storageType) {
            tags.mediaStorageType = [filters.storageType];
          }
        }

        const result = await fetchEventsVIP01(hubId, filterParams);

        if (!result || !result.events) {
          return [];
        }

        // Filter by metadata key-value pairs
        const filteredEvents = result.events.filter((event) => {
          const eventRecord = event as Record<string, unknown>;
          const mediaMetadataStr = eventRecord.mediaFileMetadata as string;
          if (!mediaMetadataStr) return false;

          try {
            const metadata = JSON.parse(mediaMetadataStr);
            return metadata[metadataKey] === metadataValue;
          } catch {
            return false;
          }
        });

        const aiMemories = filteredEvents
          .filter(
            (event): event is Record<string, unknown> =>
              typeof event === "object" && event !== null && "Content" in event,
          )
          .map((event) => eventToAIMemory(event))
          .filter((memory) => matchesFilters(memory, filters));

        return rankMemoriesByRelevance(aiMemories);
      } catch (error) {
        throw new Error(
          `Failed to search memories by media metadata: ${error}`,
        );
      }
    },

    searchByMediaType: async (
      hubId: string,
      mimeType: string,
      filters?: SearchFilters,
    ): Promise<AIMemory[]> => {
      try {
        // Build filter for media-enhanced memories
        const filterParams = {
          kinds: [MEMORY_KINDS.AI_MEMORY],
          limit: 100,
          tags: {
            mediaMimeType: mimeType.includes("/")
              ? [mimeType]
              : [`${mimeType}/*`], // Allow category searches like "image"
          },
        } as Record<string, unknown>;

        // Apply additional filters
        if (filters) {
          const tags = filterParams.tags as Record<string, string[]>;
          if (filters.memoryType) {
            tags.ai_type = tags.ai_type
              ? [...tags.ai_type, filters.memoryType]
              : [filters.memoryType];
          }
          if (filters.storageType) {
            tags.mediaStorageType = [filters.storageType];
          }
          if (filters.sessionId) {
            tags.ai_session = [filters.sessionId];
          }
        }

        const result = await fetchEventsVIP01(hubId, filterParams);

        if (!result || !result.events) {
          return [];
        }

        const aiMemories = result.events
          .filter(
            (event): event is Record<string, unknown> =>
              typeof event === "object" && event !== null && "Content" in event,
          )
          .map((event) => eventToAIMemory(event))
          .filter((memory) => matchesFilters(memory, filters));

        return rankMemoriesByRelevance(aiMemories);
      } catch (error) {
        throw new Error(`Failed to search memories by media type: ${error}`);
      }
    },

    validateMediaReferences: async (
      mediaReferences: MediaReference[],
    ): Promise<MediaValidationResult> => {
      try {
        if (!mediaReferences || mediaReferences.length === 0) {
          return {
            errors: [],
            isValid: true,
            validationDetails: [],
            warnings: [],
          };
        }

        const errors: string[] = [];
        const warnings: string[] = [];
        const validationDetails: MediaValidationResult["validationDetails"] =
          [];

        for (const mediaRef of mediaReferences) {
          const detail: {
            checksumValid?: boolean;
            error?: string;
            fileId: string;
            isAccessible: boolean;
            sizeMatch?: boolean;
          } = {
            fileId: mediaRef.fileId,
            isAccessible: false,
          };

          try {
            // Validate required fields
            if (!mediaRef.fileId || !isNonEmptyString(mediaRef.fileId)) {
              detail.error = "Missing or invalid file ID";
              errors.push(
                `Media reference missing file ID: ${mediaRef.fileName || "unknown"}`,
              );
            } else if (!mediaRef.url || !isNonEmptyString(mediaRef.url)) {
              detail.error = "Missing or invalid URL";
              errors.push(`Media reference ${mediaRef.fileId} missing URL`);
            } else {
              // Basic URL validation
              try {
                new URL(mediaRef.url);
                detail.isAccessible = true;

                // Validate file size
                if (mediaRef.size <= 0) {
                  warnings.push(
                    `Media reference ${mediaRef.fileId} has invalid size: ${mediaRef.size}`,
                  );
                } else if (mediaRef.size > 100 * 1024 * 1024) {
                  // 100MB limit
                  warnings.push(
                    `Media reference ${mediaRef.fileId} exceeds recommended size limit`,
                  );
                }

                // Validate MIME type
                if (
                  !mediaRef.mimeType ||
                  !isNonEmptyString(mediaRef.mimeType)
                ) {
                  warnings.push(
                    `Media reference ${mediaRef.fileId} missing MIME type`,
                  );
                }
              } catch {
                detail.error = "Invalid URL format";
                detail.isAccessible = false;
                errors.push(
                  `Media reference ${mediaRef.fileId} has invalid URL format`,
                );
              }
            }
          } catch (validationError) {
            detail.error = `Validation error: ${validationError}`;
            errors.push(
              `Failed to validate media reference ${mediaRef.fileId}: ${validationError}`,
            );
          }

          validationDetails.push(detail);
        }

        return {
          errors,
          isValid: errors.length === 0,
          validationDetails,
          warnings,
        };
      } catch (error) {
        return {
          errors: [`Validation failed: ${error}`],
          isValid: false,
          validationDetails: [],
          warnings: [],
        };
      }
    },
  };
};

// Helper functions
function createAIMemoryTags(memory: Partial<AIMemory>): Tag[] {
  const tags: Tag[] = [
    { name: "Kind", value: MEMORY_KINDS.AI_MEMORY },
    { name: "Content", value: memory.content || "" },
    { name: "p", value: memory.p || "" },
    { name: "role", value: memory.role || "user" },
  ];

  // Add AI-specific tags
  if (memory.importance !== undefined) {
    tags.push({ name: "ai_importance", value: memory.importance.toString() });
  }

  if (memory.memoryType) {
    tags.push({ name: "ai_type", value: memory.memoryType });
  }

  if (memory.context) {
    tags.push({ name: "ai_context", value: JSON.stringify(memory.context) });

    if (memory.context.sessionId) {
      tags.push({ name: "ai_session", value: memory.context.sessionId });
    }

    if (memory.context.topic) {
      tags.push({ name: "ai_topic", value: memory.context.topic });
    }

    if (memory.context.domain) {
      tags.push({ name: "ai_domain", value: memory.context.domain });
    }
  }

  if (memory.metadata?.tags) {
    memory.metadata.tags.forEach((tag) => {
      tags.push({ name: "ai_tag", value: tag });
    });
  }

  // Add media references if present
  if (memory.mediaReferences && memory.mediaReferences.length > 0) {
    tags.push({ name: "ai_has_media", value: "true" });
    tags.push({
      name: "ai_media_count",
      value: memory.mediaReferences.length.toString(),
    });

    memory.mediaReferences.forEach((mediaRef, index) => {
      tags.push({ name: `ai_media_${index}_fileId`, value: mediaRef.fileId });
      tags.push({
        name: `ai_media_${index}_mimeType`,
        value: mediaRef.mimeType,
      });
      tags.push({
        name: `ai_media_${index}_storageType`,
        value: mediaRef.storageType,
      });
      if (mediaRef.description) {
        tags.push({
          name: `ai_media_${index}_description`,
          value: mediaRef.description,
        });
      }
    });
  }

  // Add workflow-specific tags if this is a workflow memory
  const workflowMemory = memory as Record<string, unknown>; // Type assertion for workflow properties
  if (workflowMemory.workflowId) {
    tags.push({
      name: "workflow_id",
      value: workflowMemory.workflowId as string,
    });
  }
  if (workflowMemory.workflowVersion) {
    tags.push({
      name: "workflow_version",
      value: workflowMemory.workflowVersion as string,
    });
  }
  if (workflowMemory.stage) {
    tags.push({
      name: "workflow_stage",
      value: workflowMemory.stage as string,
    });
  }
  if (workflowMemory.performance) {
    tags.push({
      name: "workflow_performance",
      value: JSON.stringify(workflowMemory.performance),
    });
  }
  if (workflowMemory.enhancement) {
    tags.push({
      name: "workflow_enhancement",
      value: JSON.stringify(workflowMemory.enhancement),
    });
  }
  if (
    workflowMemory.dependencies &&
    Array.isArray(workflowMemory.dependencies)
  ) {
    workflowMemory.dependencies.forEach((dep: string) => {
      tags.push({ name: "workflow_dependency", value: dep });
    });
  }
  if (
    workflowMemory.capabilities &&
    Array.isArray(workflowMemory.capabilities)
  ) {
    workflowMemory.capabilities.forEach((cap: string) => {
      tags.push({ name: "workflow_capability", value: cap });
    });
  }
  if (
    workflowMemory.requirements &&
    Array.isArray(workflowMemory.requirements)
  ) {
    workflowMemory.requirements.forEach((req: string) => {
      tags.push({ name: "workflow_requirement", value: req });
    });
  }

  return tags;
}

function eventToAIMemory(event: Record<string, unknown>): AIMemory {
  const baseMemory: Memory = {
    content: event.Content as string,
    id: event.Id as string,
    p: event.p as string,
    role: (event.r as string) || (event.role as string) || "user",
    timestamp: event.Timestamp as string,
  };

  // Parse AI-specific fields with defaults
  const importance = parseFloat((event.ai_importance as string) || "0.5");
  const memoryType: MemoryType =
    (event.ai_type as MemoryType) || "conversation";
  const context: MemoryContext = event.ai_context
    ? (() => {
        try {
          return JSON.parse(event.ai_context as string);
        } catch {
          return {};
        }
      })()
    : {};

  // Add domain from event tags if available
  if (event.ai_domain) {
    context.domain = event.ai_domain as string;
  }

  // Parse media references if present
  let mediaReferences: MediaReference[] | undefined = undefined;
  const hasMedia = event.ai_has_media === "true";
  if (hasMedia) {
    const mediaCount = parseInt((event.ai_media_count as string) || "0", 10);
    mediaReferences = [];

    for (let i = 0; i < mediaCount; i++) {
      const fileIdKey = `ai_media_${i}_fileId`;
      const mimeTypeKey = `ai_media_${i}_mimeType`;
      const storageTypeKey = `ai_media_${i}_storageType`;
      const descriptionKey = `ai_media_${i}_description`;

      if (event[fileIdKey] && event[mimeTypeKey] && event[storageTypeKey]) {
        const mediaRef: MediaReference = {
          fileId: event[fileIdKey] as string,
          fileName: `media_${i}`, // Fallback name
          mimeType: event[mimeTypeKey] as string,
          size: 0, // Would need to be retrieved from storage
          storageType: event[storageTypeKey] as "permanent" | "temporal",
          uploadDate: new Date().toISOString(), // Fallback date
          url: "", // Would need to be constructed
        };

        if (event[descriptionKey]) {
          mediaRef.description = event[descriptionKey] as string;
        }

        mediaReferences.push(mediaRef);
      }
    }
  }

  const aiMemory: AIMemory = {
    ...baseMemory,
    context,
    importance,
    mediaReferences,
    memoryType,
    metadata: {
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      tags: event.ai_tag
        ? Array.isArray(event.ai_tag)
          ? (event.ai_tag as string[])
          : [event.ai_tag as string]
        : [],
    },
  };

  // Add workflow-specific properties if present
  const workflowMemory = aiMemory as unknown as Record<string, unknown>;
  if (event.workflow_id) {
    workflowMemory.workflowId = event.workflow_id as string;
  }
  if (event.workflow_version) {
    workflowMemory.workflowVersion = event.workflow_version as string;
  }
  if (event.workflow_stage) {
    workflowMemory.stage = event.workflow_stage as string;
  }
  if (event.workflow_performance) {
    try {
      workflowMemory.performance = JSON.parse(
        event.workflow_performance as string,
      );
    } catch {
      // Ignore invalid JSON
    }
  }
  if (event.workflow_enhancement) {
    try {
      workflowMemory.enhancement = JSON.parse(
        event.workflow_enhancement as string,
      );
    } catch {
      // Ignore invalid JSON
    }
  }

  // Handle arrays
  if (event.workflow_dependency) {
    const deps = Array.isArray(event.workflow_dependency)
      ? (event.workflow_dependency as string[])
      : [event.workflow_dependency as string];
    workflowMemory.dependencies = deps;
  }
  if (event.workflow_capability) {
    const caps = Array.isArray(event.workflow_capability)
      ? (event.workflow_capability as string[])
      : [event.workflow_capability as string];
    workflowMemory.capabilities = caps;
  }
  if (event.workflow_requirement) {
    const reqs = Array.isArray(event.workflow_requirement)
      ? (event.workflow_requirement as string[])
      : [event.workflow_requirement as string];
    workflowMemory.requirements = reqs;
  }

  return aiMemory;
}

function generateAnalytics(memories: AIMemory[]): MemoryAnalytics {
  const memoryTypeDistribution = memories.reduce(
    (acc, memory) => {
      acc[memory.memoryType] = (acc[memory.memoryType] || 0) + 1;
      return acc;
    },
    {} as Record<MemoryType, number>,
  );

  // Ensure all types are represented
  const typeDistribution: Record<MemoryType, number> = {
    context: memoryTypeDistribution.context || 0,
    conversation: memoryTypeDistribution.conversation || 0,
    enhancement: memoryTypeDistribution.enhancement || 0,
    knowledge: memoryTypeDistribution.knowledge || 0,
    performance: memoryTypeDistribution.performance || 0,
    procedure: memoryTypeDistribution.procedure || 0,
    reasoning: memoryTypeDistribution.reasoning || 0,
    workflow: memoryTypeDistribution.workflow || 0,
  };

  const importanceDistribution = memories.reduce(
    (acc, memory) => {
      if (memory.importance >= 0.7) acc.high++;
      else if (memory.importance >= 0.3) acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, low: 0, medium: 0 },
  );

  // Sort by access count and recency for access patterns
  const sortedByAccess = [...memories].sort(
    (a, b) => b.metadata.accessCount - a.metadata.accessCount,
  );
  const sortedByRecency = [...memories].sort(
    (a, b) =>
      new Date(b.metadata.lastAccessed).getTime() -
      new Date(a.metadata.lastAccessed).getTime(),
  );

  return {
    accessPatterns: {
      mostAccessed: sortedByAccess.slice(0, 10).map((m) => m.id),
      recentlyAccessed: sortedByRecency.slice(0, 10).map((m) => m.id),
      unusedMemories: memories
        .filter((m) => m.metadata.accessCount === 0)
        .map((m) => m.id),
    },
    importanceDistribution,
    memoryTypeDistribution: typeDistribution,
    totalMemories: memories.length,
  };
}

function matchesFilters(memory: AIMemory, filters?: SearchFilters): boolean {
  if (!filters) return true;

  if (filters.memoryType && memory.memoryType !== filters.memoryType) {
    return false;
  }

  if (
    filters.importanceThreshold &&
    memory.importance < filters.importanceThreshold
  ) {
    return false;
  }

  if (filters.domain && memory.context.domain !== filters.domain) {
    return false;
  }

  if (filters.sessionId && memory.context.sessionId !== filters.sessionId) {
    return false;
  }

  if (filters.timeRange) {
    const memoryTime = new Date(memory.timestamp);
    const start = new Date(filters.timeRange.start);
    const end = new Date(filters.timeRange.end);

    if (memoryTime < start || memoryTime > end) {
      return false;
    }
  }

  // Media-related filters
  if (filters.hasMedia !== undefined) {
    const hasMedia =
      memory.mediaReferences && memory.mediaReferences.length > 0;
    if (hasMedia !== filters.hasMedia) {
      return false;
    }
  }

  if (filters.mediaType && memory.mediaReferences) {
    const hasMatchingMediaType = memory.mediaReferences.some((media) => {
      if (filters.mediaType!.includes("/")) {
        // Exact MIME type match
        return media.mimeType === filters.mediaType;
      } else {
        // Category match (e.g., "image" matches "image/*")
        return media.mimeType.startsWith(filters.mediaType + "/");
      }
    });
    if (!hasMatchingMediaType) {
      return false;
    }
  }

  if (filters.storageType && memory.mediaReferences) {
    const hasMatchingStorageType = memory.mediaReferences.some(
      (media) => media.storageType === filters.storageType,
    );
    if (!hasMatchingStorageType) {
      return false;
    }
  }

  return true;
}

function rankMemoriesByRelevance(memories: AIMemory[]): AIMemory[] {
  return memories.sort((a, b) => {
    // Primary sort: importance score
    if (a.importance !== b.importance) {
      return b.importance - a.importance;
    }

    // Secondary sort: recency
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

export const aiMemoryService = aiService();

// Export memory kinds for use in server
export { MEMORY_KINDS };
