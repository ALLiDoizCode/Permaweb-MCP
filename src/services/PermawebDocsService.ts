// Removed unused import

export interface PermawebDocsQuery {
  domains?: PermawebDomain[];
  maxResults?: number;
  query: string;
}

export interface PermawebDocsResponse {
  results: PermawebDocsResult[];
  sources: PermawebDomain[];
  totalResults: number;
}

export interface PermawebDocsResult {
  content: string;
  domain: PermawebDomain;
  isFullDocument: boolean;
  relevanceScore: number;
  url: string;
}

export type PermawebDomain =
  | "ao"
  | "ario"
  | "arweave"
  | "hyperbeam"
  | "permaweb-glossary"
  | "wao";

interface CachedDoc {
  content: string;
  fetchedAt: Date;
}

interface DocSource {
  description: string;
  domain: PermawebDomain;
  keywords: {
    primary: string[];
    secondary: string[];
    technical: string[];
  };
  url: string;
}

const DOC_SOURCES: DocSource[] = [
  {
    description: "Arweave ecosystem development guides",
    domain: "arweave",
    keywords: {
      primary: [
        "arweave",
        "permaweb",
        "smartweave",
        "graphql",
        "transaction",
        "wallet",
        "bundling",
        "arfs",
        "arns",
      ],
      secondary: [
        "permanent",
        "storage",
        "blockchain",
        "decentralized",
        "ar",
        "winston",
        "pst",
        "profit sharing",
      ],
      technical: [
        "warp",
        "arweave-js",
        "ardrive",
        "arkb",
        "irys",
        "bundlr",
        "vouch",
        "smartweave contract",
      ],
    },
    url: "https://fuel_permawebllms.permagate.io/arweave-llms.txt",
  },
  {
    description: "AO computer system documentation",
    domain: "ao",
    keywords: {
      primary: [
        "ao",
        "process",
        "message",
        "lua",
        "aos",
        "spawn",
        "scheduler",
        "autonomous",
      ],
      secondary: [
        "actor",
        "hyper parallel",
        "computing",
        "decentralized",
        "holographic",
        "supercomputer",
      ],
      technical: [
        "aoconnect",
        "betteridea",
        "hyperbeam",
        "wasm",
        "module",
        "cron",
        "handler",
      ],
    },
    url: "https://fuel_permawebllms.permagate.io/ao-llms.txt",
  },
  {
    description: "AR.IO ecosystem infrastructure",
    domain: "ario",
    keywords: {
      primary: [
        "ar.io",
        "gateway",
        "arns",
        "wayfinder",
        "hosting",
        "deployment",
      ],
      secondary: [
        "permaweb",
        "decentralized",
        "web3",
        "infrastructure",
        "indexing",
        "resolver",
      ],
      technical: [
        "deploy",
        "archive",
        "content",
        "protocol",
        "node",
        "self-hosted",
        "configuration",
      ],
    },
    url: "https://fuel_permawebllms.permagate.io/ario-llms.txt",
  },
  {
    description: "HyperBEAM decentralized computing implementation",
    domain: "hyperbeam",
    keywords: {
      primary: [
        "hyperbeam",
        "device",
        "wasm",
        "erlang",
        "distributed",
        "computation",
      ],
      secondary: [
        "concurrent",
        "fault tolerant",
        "scalable",
        "trustless",
        "verifiable",
        "modular",
      ],
      technical: [
        "tee",
        "trusted execution",
        "pipeline",
        "http api",
        "composable",
        "performance",
      ],
    },
    url: "https://fuel_permawebllms.permagate.io/hyperbeam-llms.txt",
  },
  {
    description: "Comprehensive Permaweb glossary",
    domain: "permaweb-glossary",
    keywords: {
      primary: [
        "what is",
        "define",
        "definition",
        "explain",
        "glossary",
        "terminology",
        "meaning",
      ],
      secondary: [
        "concept",
        "understand",
        "basic",
        "introduction",
        "overview",
        "guide",
      ],
      technical: [
        "blockchain",
        "token",
        "economics",
        "cryptographic",
        "verification",
        "distributed",
      ],
    },
    url: "https://fuel_permawebllms.permagate.io/permaweb-glossary-llms.txt",
  },
  {
    description: "WAO documentation",
    domain: "wao",
    keywords: {
      primary: [
        "wao",
        "hyperbeam",
        "devices",
        "codec",
        "hashpath",
        "ao unit",
        "distributed computing",
        "message routing",
      ],
      secondary: [
        "encoding",
        "decoding",
        "tabm",
        "type annotated binary message",
        "testing framework",
        "in-memory",
        "verification",
        "provenance",
      ],
      technical: [
        "flat@1.0",
        "structured@1.0",
        "httpsig@1.0",
        "erlang",
        "wasm",
        "nif",
        "graphql",
        "javascript sdk",
        "memory forking",
        "custom device",
      ],
    },
    url: "https://permaweb-llm-fuel.vercel.app/wao-llms.txt",
  },
];

export class PermawebDocs {
  private cache = new Map<PermawebDomain, CachedDoc>();
  private readonly cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly chunkSize = parseInt(
    process.env.CONTEXT_CHUNK_SIZE || "2000",
    10,
  );
  private readonly debugMode = process.env.DEBUG === "true";
  private readonly defaultMaxResults = 20;
  private readonly fetchTimeoutMs = 30000; // 30 seconds
  private readonly relevanceThreshold = 2;
  private readonly tokensPerChar = 0.25; // Rough estimate: 4 chars ≈ 1 token

  /**
   * Helper for tests: extract unique domains from results
   */
  static extractDomains(results: PermawebDocsResult[]): PermawebDomain[] {
    return Array.from(new Set(results.map((r) => r.domain)));
  }

  /**
   * Clear cached documentation
   */
  clearCache(domain?: PermawebDomain): void {
    if (domain) {
      this.cache.delete(domain);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Estimate total response size in tokens for results
   */
  estimateResponseTokens(results: PermawebDocsResult[]): number {
    return results.reduce((total, result) => {
      return total + this.estimateTokens(result.content);
    }, 0);
  }

  /**
   * Estimate token count for text content
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }

  /**
   * Get available documentation domains
   */
  getAvailableDomains(): PermawebDomain[] {
    return DOC_SOURCES.map((source) => source.domain);
  }

  /**
   * Get cache status for all domains
   */
  getCacheStatus(): Record<PermawebDomain, { age?: number; loaded: boolean }> {
    const status: Record<string, { age?: number; loaded: boolean }> = {};

    for (const domain of this.getAvailableDomains()) {
      const cached = this.cache.get(domain);
      if (cached) {
        const age = Date.now() - cached.fetchedAt.getTime();
        status[domain] = { age, loaded: true };
      } else {
        status[domain] = { loaded: false };
      }
    }

    return status as Record<PermawebDomain, { age?: number; loaded: boolean }>;
  }

  /**
   * Check if documentation is loaded and fresh
   */
  isDocLoaded(domain: PermawebDomain): boolean {
    const cached = this.cache.get(domain);
    if (!cached) return false;

    const age = Date.now() - cached.fetchedAt.getTime();
    return age < this.cacheMaxAge;
  }

  /**
   * Preload documentation for specific domains
   * Handles loading failures gracefully - logs warnings for failed domains
   */
  async preload(
    domains: PermawebDomain[] = this.getAvailableDomains(),
  ): Promise<void> {
    // Use ensureDocsLoaded, which now handles failures gracefully
    await this.ensureDocsLoaded(domains);
  }

  /**
   * Query Permaweb documentation and return most relevant chunks.
   * Uses multiple search strategies to maximize result quality.
   * Handles domain loading failures gracefully - continues with available domains.
   */
  async query(
    query: string,
    requestedDomains?: string[],
    maxResults: number = this.defaultMaxResults,
  ): Promise<PermawebDocsResult[]> {
    // Strategy 1: Standard search with detected domains
    const results = await this.executeSearchStrategy(
      query,
      requestedDomains,
      maxResults,
      "standard",
    );

    if (results.length > 0) {
      return results;
    }

    // Strategy 2: Expanded query search (if no results from strategy 1)
    const expandedResults = await this.executeSearchStrategy(
      query,
      requestedDomains,
      maxResults,
      "expanded",
    );

    if (expandedResults.length > 0) {
      return expandedResults;
    }

    // Strategy 3: Broad domain search (search all available domains)
    const broadResults = await this.executeSearchStrategy(
      query,
      requestedDomains,
      maxResults,
      "broad",
    );

    if (broadResults.length > 0) {
      return broadResults;
    }

    // Strategy 4: Relaxed matching (lower threshold, partial word matching)
    const relaxedResults = await this.executeSearchStrategy(
      query,
      requestedDomains,
      maxResults,
      "relaxed",
    );

    return relaxedResults;
  }

  /**
   * Calculate relevance of a chunk for a query and domain.
   */
  private calculateChunkRelevance(
    query: string,
    chunk: string,
    domain: PermawebDomain,
  ): number {
    const source = DOC_SOURCES.find((s) => s.domain === domain)!;
    const content = chunk.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);
    let score = 0;
    for (const word of queryWords) {
      if (content.includes(word)) score += 2;
    }
    const allKeywords = [
      ...source.keywords.primary,
      ...source.keywords.secondary,
      ...source.keywords.technical,
    ];
    for (const keyword of allKeywords) {
      if (content.includes(keyword)) score += 1;
    }
    return score;
  }

  /**
   * Split content into size-constrained chunks while preserving semantic boundaries.
   * @param content The content to chunk
   * @returns Array of size-appropriate chunks
   */
  private chunkBySizeAndSemantics(content: string): string[] {
    if (content.length <= this.chunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > this.chunkSize) {
      // Try to find the best semantic boundary within chunk size
      const boundaries = [
        { pattern: /\n\n/g, priority: 1 }, // Paragraph breaks (highest priority)
        { pattern: /\. /g, priority: 2 }, // Sentence endings
        { pattern: / /g, priority: 3 }, // Word boundaries (lowest priority)
      ];

      let bestBoundary = -1;
      for (const { pattern } of boundaries) {
        pattern.lastIndex = 0; // Reset regex state
        const searchText = remaining.substring(0, this.chunkSize);
        let match;
        let lastMatch = -1;

        while ((match = pattern.exec(searchText)) !== null) {
          lastMatch = match.index + match[0].length;
          // Prevent infinite loops with zero-width matches
          if (match[0].length === 0) {
            pattern.lastIndex = match.index + 1;
          }
        }

        if (lastMatch > bestBoundary) {
          bestBoundary = lastMatch;
        }
      }

      // If no good boundary found, split at chunk size
      if (bestBoundary === -1) {
        bestBoundary = this.chunkSize;
      }

      // Extract chunk and update remaining content
      const chunk = remaining.substring(0, bestBoundary).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      remaining = remaining.substring(bestBoundary).trim();
    }

    // Add any remaining content
    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  /**
   * Split documentation content into logical chunks by domain with size constraints.
   * @param domain The documentation domain
   * @param content The full document content
   * @returns Array of chunked content strings
   */
  private chunkContent(domain: PermawebDomain, content: string): string[] {
    // First split by document structure delimiters
    let initialChunks: string[];
    if (domain === "permaweb-glossary") {
      // Split by double newlines (glossary entries)
      initialChunks = content
        .split(/\n\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Split by '---' delimiters (most llms.txt)
      initialChunks = content
        .split(/^---+$/m)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Further chunk by size if any chunks exceed the limit
    const finalChunks: string[] = [];
    for (const chunk of initialChunks) {
      if (chunk.length <= this.chunkSize) {
        finalChunks.push(chunk);
      } else {
        // Split large chunks while preserving semantic boundaries
        const subChunks = this.chunkBySizeAndSemantics(chunk);
        finalChunks.push(...subChunks);
      }
    }

    return finalChunks;
  }

  /**
   * Enhanced domain detection with robust ranking and fallback
   */
  private detectRelevantDomains(query: string): PermawebDomain[] {
    const domainScores = new Map<PermawebDomain, number>();
    const words = query.toLowerCase().split(/\s+/);

    // Score all domains - never filter to zero
    for (const source of DOC_SOURCES) {
      let score = 0;
      const allKeywords = [
        ...source.keywords.primary.map((k) => ({ keyword: k, weight: 3 })),
        ...source.keywords.secondary.map((k) => ({ keyword: k, weight: 2 })),
        ...source.keywords.technical.map((k) => ({ keyword: k, weight: 2 })),
      ];

      // Exact keyword matching
      for (const { keyword, weight } of allKeywords) {
        if (
          query.toLowerCase().includes(keyword.toLowerCase()) ||
          words.some((word) => keyword.toLowerCase().includes(word))
        ) {
          score += weight;
        }
      }

      // Fuzzy matching for partial word overlap
      for (const word of words) {
        if (word.length >= 3) {
          for (const { keyword, weight } of allKeywords) {
            if (keyword.toLowerCase().includes(word.substring(0, 3))) {
              score += weight * 0.3; // Reduced weight for fuzzy matches
            }
          }
        }
      }

      // Always give a base score to ensure no domain is completely excluded
      score += 0.1;
      domainScores.set(source.domain, score);
    }

    // Sort by score and return top domains
    const sortedDomains = Array.from(domainScores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([domain]) => domain);

    // Adaptive domain count based on confidence
    const maxScore = Math.max(...domainScores.values());
    const confidenceThreshold = 3; // Require at least primary keyword match for confidence

    if (maxScore >= confidenceThreshold) {
      // High confidence: return top 3 domains
      return sortedDomains.slice(0, 3);
    } else {
      // Low confidence: search more domains to avoid missing results
      return sortedDomains; // Search all domains
    }
  }

  /**
   * Enhanced document loading with retry logic
   * Handles partial failures gracefully - logs warnings but continues with successful domains
   */
  private async ensureDocsLoaded(domains: PermawebDomain[]): Promise<void> {
    const domainsToLoad = domains.filter((domain) => !this.isDocLoaded(domain));

    if (domainsToLoad.length === 0) {
      return; // All domains already loaded
    }

    const loadPromises = domainsToLoad.map((domain) =>
      this.loadDocumentationWithRetry(domain)
        .then(() => ({ domain, error: null, success: true }))
        .catch((error) => ({ domain, error, success: false })),
    );

    const results = await Promise.all(loadPromises);

    // Log warnings for failed domains but don't throw
    for (const result of results) {
      if (!result.success) {
        if (this.debugMode) {
          console.warn(
            `[PermawebDocs] Failed to load ${result.domain}: ${result.error?.message || "Unknown error"}`,
          );
        }
      }
    }
  }

  /**
   * Execute a specific search strategy
   */
  private async executeSearchStrategy(
    query: string,
    requestedDomains: string[] | undefined,
    maxResults: number,
    strategy: "broad" | "expanded" | "relaxed" | "standard",
  ): Promise<PermawebDocsResult[]> {
    let domains: PermawebDomain[];
    let searchQuery = query;
    let threshold = this.relevanceThreshold;

    // Configure strategy-specific parameters
    switch (strategy) {
      case "broad":
        // Search all available domains regardless of detection
        domains = this.getAvailableDomains();
        break;

      case "expanded":
        domains = this.getSearchDomains(query, requestedDomains);
        searchQuery = this.expandQuery(query);
        break;

      case "relaxed":
        domains = this.getAvailableDomains();
        threshold = Math.max(1, this.relevanceThreshold - 2); // Lower threshold
        break;

      case "standard":
        domains = this.getSearchDomains(query, requestedDomains);
        break;
    }

    if (this.debugMode) {
      console.log(
        `[PermawebDocs] Trying ${strategy} search strategy with domains: ${domains.join(", ")}`,
      );
    }

    // Load required documents
    await this.ensureDocsLoaded(domains);

    const results: PermawebDocsResult[] = [];

    for (const domain of domains) {
      let cached = this.cache.get(domain);

      // Fallback: use stale cached content if available and fresh loading failed
      if (!cached || !this.isDocLoaded(domain)) {
        cached = this.cache.get(domain); // Get potentially stale content
        if (!cached) continue;

        if (this.debugMode) {
          console.log(
            `[PermawebDocs] Using potentially stale cached content for ${domain}`,
          );
        }
      }

      const url = DOC_SOURCES.find((s) => s.domain === domain)!.url;
      const chunks = this.chunkContent(domain, cached.content);

      for (const chunk of chunks) {
        const relevanceScore = this.calculateChunkRelevance(
          searchQuery,
          chunk,
          domain,
        );

        // Adjust matching criteria based on strategy
        const queryWords = searchQuery.toLowerCase().split(/\s+/);
        let containsQueryWord: boolean;

        if (strategy === "relaxed") {
          // More flexible matching for relaxed strategy
          containsQueryWord = queryWords.some((word) => {
            if (word.length >= 3) {
              // Partial word matching
              return chunk
                .toLowerCase()
                .includes(word.substring(0, Math.min(word.length, 4)));
            }
            return chunk.toLowerCase().includes(word);
          });
        } else {
          // Standard exact word matching
          containsQueryWord = queryWords.some((word) =>
            chunk.toLowerCase().includes(word),
          );
        }

        if (relevanceScore >= threshold && containsQueryWord) {
          results.push({
            content: chunk,
            domain,
            isFullDocument: false,
            relevanceScore,
            url,
          });
        }
      }
    }

    // Sort by relevance and return results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Expand query with synonyms and related terms
   */
  private expandQuery(originalQuery: string): string {
    const expansions = new Map([
      ["ao", "ao computer autonomous objects processes"],
      ["architecture", "architecture design structure implementation"],
      ["ario", "ar.io gateway infrastructure hosting"],
      ["arweave", "arweave permaweb blockchain permanent storage"],
      ["benefits", "benefits advantages pros features capabilities"],

      ["codec", "codec encoding decoding tabm flat structured httpsig"],
      ["deployment", "deployment deploy hosting publishing"],
      ["development", "development dev building creating implementation"],
      // Technical computing terms
      ["devices", "devices codec hyperbeam wao modular computational"],
      ["encoding", "encoding decoding message codec tabm binary"],

      ["gateway", "gateway node infrastructure ar.io"],
      ["hashpath", "hashpath verification provenance chained hashes"],
      // Technology synonyms
      ["hyperbeam", "hyperbeam distributed computing wasm erlang"],
      // Concept expansions
      ["migrate", "migrate migration move transition switch"],

      ["nif", "nif erlang native implemented functions wasm"],
      ["process", "process autonomous object computation"],
      ["testing", "testing framework in-memory ao unit emulation"],
      // Common permaweb terms
      ["token", "token cryptocurrency digital asset pst"],
      ["wallet", "wallet arweave key management"],
      ["wao", "wao hyperbeam devices codec hashpath distributed computing"],
    ]);

    let expandedQuery = originalQuery;
    const queryWords = originalQuery.toLowerCase().split(/\s+/);

    for (const word of queryWords) {
      if (expansions.has(word)) {
        expandedQuery += " " + expansions.get(word);
      }
    }

    return expandedQuery;
  }

  /**
   * Get search domains based on query and requested domains
   */
  private getSearchDomains(
    query: string,
    requestedDomains?: string[],
  ): PermawebDomain[] {
    if (requestedDomains && requestedDomains.length > 0) {
      return requestedDomains.filter((d) =>
        this.getAvailableDomains().includes(d as PermawebDomain),
      ) as PermawebDomain[];
    }

    const domains = this.detectRelevantDomains(query);

    // Always include glossary for definition/what is queries
    if (
      /what is|define|definition|glossary|meaning|explain/i.test(query) &&
      !domains.includes("permaweb-glossary")
    ) {
      domains.push("permaweb-glossary");
    }

    return domains;
  }

  private async loadDocumentation(domain: PermawebDomain): Promise<void> {
    const source = DOC_SOURCES.find((s) => s.domain === domain);
    if (!source) {
      throw new Error(`Unknown domain: ${domain}`);
    }

    // Create AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.fetchTimeoutMs);

    try {
      const response = await fetch(source.url, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      if (!content || content.trim().length === 0) {
        throw new Error("Empty content received");
      }

      // Check content size and warn if extremely large
      const contentSizeMB = content.length / (1024 * 1024);
      if (this.debugMode && contentSizeMB > 5) {
        console.warn(
          `Large documentation file for ${domain}: ${contentSizeMB.toFixed(2)}MB`,
        );
      }

      // Validate content can be chunked without issues
      try {
        const testChunks = this.chunkContent(
          domain,
          content.substring(0, Math.min(content.length, 10000)),
        );
        if (testChunks.length === 0) {
          throw new Error("Content chunking produced no results");
        }
      } catch (chunkError) {
        throw new Error(
          `Content chunking failed: ${chunkError instanceof Error ? chunkError.message : "Unknown chunking error"}`,
        );
      }

      this.cache.set(domain, {
        content,
        fetchedAt: new Date(),
      });

      if (this.debugMode) {
        const chunkCount = this.chunkContent(domain, content).length;
        console.log(
          `Successfully loaded ${domain}: ${chunkCount} chunks from ${contentSizeMB.toFixed(2)}MB`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Failed to load ${domain} documentation: Request timed out after ${this.fetchTimeoutMs}ms`,
        );
      }
      throw new Error(
        `Failed to load ${domain} documentation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Load documentation with retry logic for better reliability
   */
  private async loadDocumentationWithRetry(
    domain: PermawebDomain,
    maxRetries: number = 2,
  ): Promise<void> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.loadDocumentation(domain);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on timeout or termination errors - they're likely to fail again
        const isTimeout = lastError.message.includes("timed out after");
        const isTerminated = lastError.message.includes("terminated");

        if (attempt < maxRetries && !isTimeout && !isTerminated) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          break;
        }
      }
    }

    throw new Error(
      `Failed to load ${domain} after ${maxRetries + 1} attempts: ${lastError.message}`,
    );
  }
}

export const permawebDocs = new PermawebDocs();
