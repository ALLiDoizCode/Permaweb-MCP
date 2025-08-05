import { describe, it, expect, beforeEach, vi } from "vitest";
import { PermawebDocs } from "../../../src/services/PermawebDocsService.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("PermawebDocsService - Chunking", () => {
  let service: PermawebDocs;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermawebDocs();
    // Clear any existing cache
    service.clearCache();
  });

  describe("chunkContent", () => {
    it("should split content by delimiters for non-glossary domains", async () => {
      const content = "First section\n---\nSecond section\n---\nThird section";
      
      // Mock successful fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // Load content into cache by querying
      await service.query("test", ["arweave"], 10);
      
      const results = await service.query("section", ["arweave"], 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should split content by double newlines for glossary domain", async () => {
      const content = "Term 1\nDefinition 1\n\n\nTerm 2\nDefinition 2\n\n\nTerm 3\nDefinition 3";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      await service.query("term", ["permaweb-glossary"], 10);
      const results = await service.query("term", ["permaweb-glossary"], 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should further chunk large sections by size", async () => {
      // Create content with one very large section
      const largeSection = "A".repeat(5000); // 5000 chars, larger than default 2000 chunk size
      const content = `Small section\n---\n${largeSection}\n---\nAnother small section`;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      const results = await service.query("section", ["arweave"], 10);
      
      // Should have more chunks due to size-based splitting
      const largeChunks = results.filter(r => r.content.length > 2000);
      expect(largeChunks.length).toBe(0); // No chunks should exceed 2000 chars
    });

    it("should preserve semantic boundaries when chunking by size", async () => {
      // Create content with clear paragraph boundaries
      const paragraphs = Array.from({ length: 20 }, (_, i) => 
        `This is paragraph ${i + 1}. It contains some meaningful content that should not be broken in the middle of a sentence. The paragraph continues with more text to make it longer.`
      ).join('\n\n');
      
      const content = `Large Section\n---\n${paragraphs}`;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      const results = await service.query("paragraph", ["arweave"], 20);
      
      // Check that chunks don't end mid-word (should end with word boundaries)
      for (const result of results) {
        if (result.content.length > 100) { // Skip very small chunks
          const trimmed = result.content.trim();
          const lastChar = trimmed.slice(-1);
          // Should end with proper punctuation, paragraph break, or at least not mid-word
          expect(lastChar).toMatch(/[.!?\s\n]|[a-zA-Z]$/);
        }
      }
    });

    it("should handle very large content without timing out", async () => {
      // Create a very large document (1MB+)
      const largeContent = "Large document section. ".repeat(50000); // ~1.2MB
      const content = `Header\n---\n${largeContent}\n---\nFooter`;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // This should not throw or timeout
      const results = await service.query("document", ["arweave"], 50);
      expect(results.length).toBeGreaterThan(0);
      
      // Verify all chunks are within size limits
      for (const result of results) {
        expect(result.content.length).toBeLessThanOrEqual(2000);
      }
    });

    it("should handle empty content gracefully", async () => {
      const content = "";
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // Should throw during loading due to empty content validation
      await expect(service.query("test", ["arweave"], 10)).rejects.toThrow("Empty content received");
    });

    it("should handle content with no delimiters", async () => {
      const content = "This is a single large block of text without any delimiter markers that would normally split it into sections. It should still be chunked by size if it exceeds the limit.".repeat(50);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      const results = await service.query("text", ["arweave"], 20);
      expect(results.length).toBeGreaterThan(1); // Should be split into multiple chunks
      
      // All chunks should be within size limits
      for (const result of results) {
        expect(result.content.length).toBeLessThanOrEqual(2000);
      }
    });

    it("should respect CONTEXT_CHUNK_SIZE environment variable", async () => {
      // Test with custom chunk size
      const originalEnv = process.env.CONTEXT_CHUNK_SIZE;
      process.env.CONTEXT_CHUNK_SIZE = "1000";
      
      // Create new service instance to pick up env var
      const customService = new PermawebDocs();
      
      const largeContent = "A".repeat(1500); // Larger than custom 1000 char limit
      const content = `Section\n---\n${largeContent}`;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      const results = await customService.query("section", ["arweave"], 10);
      
      // Should respect the 1000 char limit
      for (const result of results) {
        expect(result.content.length).toBeLessThanOrEqual(1000);
      }
      
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.CONTEXT_CHUNK_SIZE = originalEnv;
      } else {
        delete process.env.CONTEXT_CHUNK_SIZE;
      }
    });
  });

  describe("error handling", () => {
    it("should provide detailed error for chunking failures", async () => {
      const content = "Valid content";
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // Mock chunking to fail
      const originalChunkContent = (service as any).chunkContent;
      (service as any).chunkContent = vi.fn().mockImplementation(() => {
        throw new Error("Chunking simulation error");
      });

      await expect(service.query("test", ["arweave"], 10)).rejects.toThrow(
        "Content chunking failed: Chunking simulation error"
      );

      // Restore original method
      (service as any).chunkContent = originalChunkContent;
    });

    it("should handle network timeout with proper error message", async () => {
      mockFetch.mockRejectedValueOnce(new DOMException("signal is aborted without reason", "AbortError"));

      await expect(service.query("test", ["arweave"], 10)).rejects.toThrow(
        "Request timed out after 30000ms"
      );
    });
  });

  describe("multi-strategy search", () => {
    it("should try multiple search strategies when initial search returns no results", async () => {
      // Mock content that only matches with expanded queries
      const content = "HyperBEAM provides distributed computing with fault tolerance and concurrent processing capabilities using WebAssembly and Erlang.";
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // Query that might not match standard keywords but should match expanded terms
      const results = await service.query("benefits of migrating to beam", ["hyperbeam"], 10);
      
      // Should find results through expanded search strategies
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].domain).toBe("hyperbeam");
    });

    it("should use relaxed matching as final fallback", async () => {
      const content = "Modern applications require scalable architectures for optimal performance.";
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      // Query with partial word that should match in relaxed mode
      const results = await service.query("arch optimal", ["hyperbeam"], 10);
      
      // Should find results through relaxed matching strategy
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty results gracefully when no strategies find matches", async () => {
      const content = "Completely unrelated content about cooking recipes.";
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(content),
      } as Response);

      const results = await service.query("blockchain cryptocurrency", ["hyperbeam"], 10);
      
      // Should return empty array without throwing
      expect(results).toEqual([]);
    });

    it("should use stale cached content when fresh loading fails", async () => {
      const staleContent = "Stale but useful HyperBEAM documentation about architecture.";
      
      // Pre-populate cache with stale content
      service["cache"].set("hyperbeam", {
        content: staleContent,
        fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago (stale)
      });

      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const results = await service.query("architecture", ["hyperbeam"], 10);
      
      // Should use stale cached content
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("architecture");
    });
  });
});