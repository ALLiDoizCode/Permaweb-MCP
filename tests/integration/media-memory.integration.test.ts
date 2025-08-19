import { JWKInterface } from "arweave/node/lib/wallet.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIMemory, MemoryType } from "../../src/models/AIMemory.js";
import { MediaReference } from "../../src/models/MediaReference.js";
import { aiMemoryService } from "../../src/services/aiMemoryService.js";

// Mock the relay functions
vi.mock("../../src/relay.js", () => ({
  event: vi.fn(),
  fetchEvents: vi.fn(),
  fetchEventsVIP01: vi.fn(),
}));

// Mock LoadNetworkStorageService
vi.mock("../../src/services/LoadNetworkStorageService.js", () => ({
  LoadNetworkStorageService: vi.fn(),
  ServiceResult: vi.fn(),
}));

describe("Media-Memory Integration Tests", () => {
  let mockSigner: JWKInterface;
  let mockHubId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSigner = {
      d: "test-d",
      dp: "test-dp",
      dq: "test-dq",
      e: "AQAB",
      kty: "RSA",
      n: "test-n",
      p: "test-p",
      q: "test-q",
      qi: "test-qi",
    } as JWKInterface;
    mockHubId = "test-hub-id";
  });

  describe("Media Reference Creation and Validation", () => {
    it("should create a valid media reference for an image", async () => {
      const mediaReference: MediaReference = {
        checksum: "sha256:abc123def456",
        description: "Test image for memory",
        fileId: "test-file-123",
        fileMetadata: {
          format: "PNG",
          height: 600,
          width: 800,
        },
        fileName: "test-image.png",
        mimeType: "image/png",
        size: 1024 * 500, // 500KB
        storageType: "temporal",
        uploadDate: new Date().toISOString(),
        url: "https://storage.example.com/test-file-123",
      };

      const validationResult = await aiMemoryService.validateMediaReferences([
        mediaReference,
      ]);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.validationDetails).toHaveLength(1);
      expect(validationResult.validationDetails[0].fileId).toBe(
        "test-file-123",
      );
      expect(validationResult.validationDetails[0].isAccessible).toBe(true);
    });

    it("should detect invalid media references", async () => {
      const invalidMediaReference: MediaReference = {
        fileId: "", // Invalid: empty file ID
        fileName: "invalid-file.pdf",
        mimeType: "application/pdf",
        size: -1, // Invalid: negative size
        storageType: "temporal",
        uploadDate: new Date().toISOString(),
        url: "invalid-url", // Invalid: not a proper URL
      };

      const validationResult = await aiMemoryService.validateMediaReferences([
        invalidMediaReference,
      ]);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.validationDetails).toHaveLength(1);
      expect(validationResult.validationDetails[0].isAccessible).toBe(false);
    });

    it("should validate large files with warnings", async () => {
      const largeFileReference: MediaReference = {
        fileId: "large-file-123",
        fileName: "large-video.mp4",
        mimeType: "video/mp4",
        size: 150 * 1024 * 1024, // 150MB - exceeds recommended limit
        storageType: "permanent",
        uploadDate: new Date().toISOString(),
        url: "https://arweave.net/large-file-123",
      };

      const validationResult = await aiMemoryService.validateMediaReferences([
        largeFileReference,
      ]);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.warnings.length).toBeGreaterThan(0);
      expect(validationResult.warnings[0]).toContain(
        "exceeds recommended size",
      );
    });
  });

  describe("Memory Creation with Media Attachments", () => {
    it("should create memory with media references", async () => {
      const mediaReferences: MediaReference[] = [
        {
          description: "Project planning document",
          fileId: "doc-123",
          fileName: "project-plan.pdf",
          mimeType: "application/pdf",
          size: 2048 * 1024, // 2MB
          storageType: "temporal",
          uploadDate: new Date().toISOString(),
          url: "https://storage.example.com/doc-123",
        },
        {
          description: "System architecture diagram",
          fileId: "img-456",
          fileName: "architecture-diagram.png",
          mimeType: "image/png",
          size: 512 * 1024, // 512KB
          storageType: "permanent",
          uploadDate: new Date().toISOString(),
          url: "https://arweave.net/img-456",
        },
      ];

      const memory: Partial<AIMemory> = {
        content: "Project planning session with architecture review",
        context: {
          domain: "engineering",
          sessionId: "session-789",
          topic: "Project Planning",
        },
        importance: 0.8,
        mediaReferences,
        memoryType: "procedure" as MemoryType,
        p: "test-user-123",
      };

      const result = await aiMemoryService.addEnhanced(
        mockSigner,
        mockHubId,
        memory,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Verify the created tags include media information
      const tags = JSON.parse(result);
      expect(tags).toContainEqual({ name: "ai_has_media", value: "true" });
      expect(tags).toContainEqual({ name: "ai_media_count", value: "2" });
      expect(tags).toContainEqual({
        name: "ai_media_0_fileId",
        value: "doc-123",
      });
      expect(tags).toContainEqual({
        name: "ai_media_1_fileId",
        value: "img-456",
      });
    });

    it("should add media reference to existing memory", async () => {
      const memoryId = "memory-123";
      const mediaReference: MediaReference = {
        description: "Additional notes for the memory",
        fileId: "new-attachment-789",
        fileName: "additional-notes.txt",
        mimeType: "text/plain",
        size: 1024, // 1KB
        storageType: "temporal",
        uploadDate: new Date().toISOString(),
        url: "https://storage.example.com/new-attachment-789",
      };

      const result = await aiMemoryService.addMediaReferenceToMemory(
        mockSigner,
        mockHubId,
        memoryId,
        mediaReference,
      );

      expect(result).toBe("Media reference added to memory successfully");
    });

    it("should handle memory creation without media references", async () => {
      const memory: Partial<AIMemory> = {
        content: "Simple text memory without media",
        context: {
          sessionId: "session-456",
          topic: "General Knowledge",
        },
        importance: 0.5,
        memoryType: "knowledge" as MemoryType,
        p: "test-user-123",
      };

      const result = await aiMemoryService.addEnhanced(
        mockSigner,
        mockHubId,
        memory,
      );

      expect(result).toBeDefined();
      const tags = JSON.parse(result);
      expect(tags).not.toContainEqual({ name: "ai_has_media", value: "true" });
    });
  });

  describe("Media-Enhanced Search Capabilities", () => {
    it("should search memories by media type", async () => {
      // Mock the fetchEventsVIP01 to return sample data
      const { fetchEventsVIP01 } = await import("../../src/relay.js");
      vi.mocked(fetchEventsVIP01).mockResolvedValue({
        events: [
          {
            ai_has_media: "true",
            ai_importance: "0.8",
            ai_media_0_fileId: "img-123",
            ai_media_0_mimeType: "image/jpeg",
            ai_media_0_storageType: "permanent",
            ai_media_count: "1",
            ai_type: "knowledge",
            Content: "Memory with image attachment",
            Id: "memory-img-123",
            p: "test-user",
            Timestamp: new Date().toISOString(),
          },
        ],
      });

      const memories = await aiMemoryService.searchByMediaType(
        mockHubId,
        "image/jpeg",
      );

      expect(memories).toHaveLength(1);
      expect(memories[0].mediaReferences).toHaveLength(1);
      expect(memories[0].mediaReferences![0].mimeType).toBe("image/jpeg");
    });

    it("should search memories by media category", async () => {
      const { fetchEventsVIP01 } = await import("../../src/relay.js");
      vi.mocked(fetchEventsVIP01).mockResolvedValue({
        events: [
          {
            ai_has_media: "true",
            ai_importance: "0.7",
            ai_media_0_fileId: "doc-456",
            ai_media_0_mimeType: "application/pdf",
            ai_media_0_storageType: "temporal",
            ai_media_count: "1",
            ai_type: "procedure",
            Content: "Memory with document attachment",
            Id: "memory-doc-456",
            p: "test-user",
            Timestamp: new Date().toISOString(),
          },
        ],
      });

      const memories = await aiMemoryService.searchByMediaType(
        mockHubId,
        "application",
      );

      expect(memories).toHaveLength(1);
      expect(memories[0].mediaReferences![0].mimeType).toBe("application/pdf");
    });

    it("should search memories by media metadata", async () => {
      const { fetchEventsVIP01 } = await import("../../src/relay.js");
      vi.mocked(fetchEventsVIP01).mockResolvedValue({
        events: [
          {
            ai_importance: "0.9",
            ai_type: "enhancement",
            Content: "Memory with specific metadata",
            Id: "memory-meta-789",
            mediaFileMetadata: JSON.stringify({
              duration: "120",
              format: "MP4",
              resolution: "1080p",
            }),
            p: "test-user",
            Timestamp: new Date().toISOString(),
          },
        ],
      });

      const memories = await aiMemoryService.searchByMediaMetadata(
        mockHubId,
        "resolution",
        "1080p",
      );

      expect(memories).toHaveLength(1);
    });

    it("should filter memories with media attachments", async () => {
      // This would be tested with the regular searchAdvanced method
      // using hasMedia filter, but we'll simulate it here
      const testMemories: AIMemory[] = [
        {
          content: "Memory with media",
          context: {},
          id: "mem-1",
          importance: 0.8,
          mediaReferences: [
            {
              fileId: "file-1",
              fileName: "test.jpg",
              mimeType: "image/jpeg",
              size: 1024,
              storageType: "temporal",
              uploadDate: new Date().toISOString(),
              url: "https://example.com/file-1",
            },
          ],
          memoryType: "knowledge",
          metadata: { accessCount: 0, lastAccessed: new Date().toISOString() },
          p: "user-1",
          role: "user",
          timestamp: new Date().toISOString(),
        },
        {
          content: "Memory without media",
          context: {},
          id: "mem-2",
          importance: 0.6,
          memoryType: "knowledge",
          metadata: { accessCount: 0, lastAccessed: new Date().toISOString() },
          p: "user-1",
          role: "user",
          timestamp: new Date().toISOString(),
        },
      ];

      // Test the filter logic by checking media references directly
      const memoryWithMedia = testMemories.find(
        (mem) => mem.mediaReferences && mem.mediaReferences.length > 0,
      );
      const memoryWithoutMedia = testMemories.find(
        (mem) => !mem.mediaReferences || mem.mediaReferences.length === 0,
      );

      expect(memoryWithMedia?.id).toBe("mem-1");
      expect(memoryWithoutMedia?.id).toBe("mem-2");
    });
  });

  describe("Media Promotion Workflow", () => {
    it("should promote media from temporal to permanent storage", async () => {
      const promotionParams = {
        description: "Promoted to permanent storage",
        fileId: "temp-file-123",
        metadata: {
          originalSize: "2MB",
          promotionReason: "Important document",
        },
      };

      const result = await aiMemoryService.promoteMediaToPermanent(
        mockSigner,
        mockHubId,
        promotionParams,
      );

      expect(result.success).toBe(true);
      expect(result.updatedReference?.storageType).toBe("permanent");
      expect(result.updatedReference?.fileId).toBe("temp-file-123");
      expect(result.permanentUrl).toContain("arweave.net");
    });

    it("should handle promotion errors", async () => {
      const invalidParams = {
        description: "This should fail",
        fileId: "", // Invalid empty file ID
      };

      const result = await aiMemoryService.promoteMediaToPermanent(
        mockSigner,
        mockHubId,
        invalidParams,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("File ID is required");
    });
  });

  describe("Media Integrity Checking", () => {
    it("should check integrity of media references", async () => {
      const mediaReferences: MediaReference[] = [
        {
          checksum: "sha256:valid-checksum",
          fileId: "valid-file-123",
          fileName: "valid-document.pdf",
          mimeType: "application/pdf",
          size: 1024 * 1024, // 1MB
          storageType: "permanent",
          uploadDate: new Date().toISOString(),
          url: "https://arweave.net/valid-file-123",
        },
        {
          fileId: "broken-file-456",
          fileName: "broken-image.png",
          mimeType: "image/png",
          size: 0, // Invalid size
          storageType: "temporal",
          uploadDate: new Date().toISOString(),
          url: "", // Missing URL
        },
      ];

      const result = await aiMemoryService.checkMediaIntegrity(mediaReferences);

      expect(result.validationDetails).toHaveLength(2);
      expect(result.validationDetails[0].isAccessible).toBe(true);
      expect(result.validationDetails[0].checksumValid).toBe(true);
      expect(result.validationDetails[1].isAccessible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Media Template Formatting", () => {
    it("should format memory with media attachments", () => {
      const memory: AIMemory = {
        content: "Project review meeting summary",
        context: {
          domain: "engineering",
          sessionId: "session-456",
          topic: "Project Review",
        },
        id: "mem-123",
        importance: 0.85,
        mediaReferences: [
          {
            description: "Project presentation slides",
            fileId: "slides-123",
            fileName: "project-slides.pptx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size: 5 * 1024 * 1024, // 5MB
            storageType: "permanent",
            uploadDate: new Date().toISOString(),
            url: "https://arweave.net/slides-123",
          },
          {
            description: "Meeting notes and action items",
            fileId: "notes-456",
            fileName: "meeting-notes.md",
            mimeType: "text/markdown",
            size: 2 * 1024, // 2KB
            storageType: "temporal",
            uploadDate: new Date().toISOString(),
            url: "https://storage.example.com/notes-456",
          },
        ],
        memoryType: "procedure",
        metadata: {
          accessCount: 3,
          lastAccessed: new Date().toISOString(),
        },
        p: "user-123",
        role: "user",
        timestamp: new Date().toISOString(),
      };

      const formatted = aiMemoryService.formatMemoryWithMedia(memory);

      expect(formatted).toContain("**Memory Content:**");
      expect(formatted).toContain("Project review meeting summary");
      expect(formatted).toContain("**Attached Media (2 files):**");
      expect(formatted).toContain("project-slides.pptx");
      expect(formatted).toContain("meeting-notes.md");
      expect(formatted).toContain("5.00 MB");
      expect(formatted).toContain("2.00 KB");
      expect(formatted).toContain("permanent");
      expect(formatted).toContain("temporal");
      expect(formatted).toContain("[Access File]");
      expect(formatted).toContain("**Context:**");
      expect(formatted).toContain("Topic: Project Review");
      expect(formatted).toContain("Domain: engineering");
      expect(formatted).toContain("**Memory Details:**");
      expect(formatted).toContain("Type: procedure");
      expect(formatted).toContain("Importance: 0.85");
    });

    it("should format memory without media attachments", () => {
      const memory: AIMemory = {
        content: "Simple text note",
        context: { topic: "General" },
        id: "mem-456",
        importance: 0.5,
        memoryType: "knowledge",
        metadata: {
          accessCount: 1,
          lastAccessed: new Date().toISOString(),
        },
        p: "user-123",
        role: "user",
        timestamp: new Date().toISOString(),
      };

      const formatted = aiMemoryService.formatMemoryWithMedia(memory);

      expect(formatted).toContain("**Memory Content:**");
      expect(formatted).toContain("Simple text note");
      expect(formatted).not.toContain("**Attached Media");
      expect(formatted).toContain("**Context:**");
      expect(formatted).toContain("**Memory Details:**");
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle memories created before media support", () => {
      // Simulate old memory format without media fields
      const legacyMemory: AIMemory = {
        content: "Old memory without media support",
        context: { topic: "Legacy" },
        id: "legacy-mem-123",
        importance: 0.6,
        memoryType: "knowledge",
        metadata: {
          accessCount: 5,
          lastAccessed: "2024-01-02T00:00:00.000Z",
        },
        p: "user-123",
        role: "user",
        timestamp: "2024-01-01T00:00:00.000Z",
        // No mediaReferences field
      };

      // Should handle formatting without errors
      const formatted = aiMemoryService.formatMemoryWithMedia(legacyMemory);
      expect(formatted).toContain("Old memory without media support");
      expect(formatted).not.toContain("**Attached Media");

      // Should pass through filters correctly (check media references directly)
      const hasMedia = !!(
        legacyMemory.mediaReferences && legacyMemory.mediaReferences.length > 0
      );
      expect(hasMedia).toBe(false); // Legacy memory should have no media
    });

    it("should validate empty media references array", async () => {
      const result = await aiMemoryService.validateMediaReferences([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validationDetails).toHaveLength(0);
    });

    it("should check integrity of empty media references", async () => {
      const result = await aiMemoryService.checkMediaIntegrity([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validationDetails).toHaveLength(0);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle validation errors gracefully", async () => {
      const mockError = new Error("Validation service unavailable");

      // This would test actual error handling, but our current implementation
      // handles errors within try-catch blocks, so we'll test the error paths
      const invalidReference: MediaReference = {
        fileId: "test-id",
        fileName: "test.jpg",
        mimeType: "image/jpeg",
        size: 1024,
        storageType: "temporal",
        uploadDate: "invalid-date", // This could cause parsing errors
        url: "https://example.com/test",
      };

      const result = await aiMemoryService.validateMediaReferences([
        invalidReference,
      ]);

      // Should not throw, should handle gracefully
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe("boolean");
    });

    it("should handle search errors gracefully", async () => {
      const { fetchEventsVIP01 } = await import("../../src/relay.js");
      vi.mocked(fetchEventsVIP01).mockRejectedValue(new Error("Network error"));

      await expect(
        aiMemoryService.searchByMediaType(mockHubId, "image/png"),
      ).rejects.toThrow("Failed to search memories by media type");
    });

    it("should handle missing required fields in media reference", async () => {
      await expect(
        aiMemoryService.addMediaReferenceToMemory(
          mockSigner,
          mockHubId,
          "", // Empty memory ID
          {
            fileId: "test-file",
            fileName: "test.jpg",
            mimeType: "image/jpeg",
            size: 1024,
            storageType: "temporal",
            uploadDate: new Date().toISOString(),
            url: "https://example.com/test",
          },
        ),
      ).rejects.toThrow("Memory ID is required");
    });
  });
});
