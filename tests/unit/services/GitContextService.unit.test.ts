import { exec } from "child_process";
import { promises as fs } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaudeCodeAgentService } from "../../../src/services/ClaudeCodeAgentService.js";
import { GitContextService } from "../../../src/services/GitContextService.js";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  promises: {
    watch: vi.fn(),
  },
}));

// Mock util
vi.mock("util", () => ({
  promisify: vi.fn((fn) => fn),
}));

// Mock agent service
vi.mock("../../../src/services/ClaudeCodeAgentService.js", () => ({
  ClaudeCodeAgentService: vi.fn().mockImplementation(() => ({})),
}));

describe("GitContextService", () => {
  let service: GitContextService;
  let mockAgentService: ClaudeCodeAgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService = new ClaudeCodeAgentService(
      {} as any,
      {} as any,
      {} as any,
    );
    service = new GitContextService(mockAgentService);
  });

  describe("analyzeRepository", () => {
    it("should analyze git repository successfully", async () => {
      const repoPath = "/test/repo";

      // Mock git commands
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }

        if (command === "git rev-parse --git-dir") {
          callback?.(null, { stderr: "", stdout: ".git" } as any);
        } else if (command === "git branch --show-current") {
          callback?.(null, { stderr: "", stdout: "main\n" } as any);
        } else if (command.includes("git log")) {
          callback?.(null, {
            stderr: "",
            stdout: "abc123|feat: add feature|John Doe|2024-01-01 12:00:00\n",
          } as any);
        } else if (command === "git status --porcelain") {
          callback?.(null, {
            stderr: "",
            stdout: "M src/file.ts\nA docs/readme.md\n",
          } as any);
        }

        return {} as any;
      });

      const result = await service.analyzeRepository(repoPath);

      expect(result.isRepository).toBe(true);
      expect(result.currentBranch).toBe("main");
      expect(result.recentCommits).toHaveLength(1);
      expect(result.recentCommits[0]).toEqual({
        author: "John Doe",
        hash: "abc123",
        message: "feat: add feature",
        timestamp: "2024-01-01 12:00:00",
      });
      expect(result.modifiedFiles).toEqual(["src/file.ts", "docs/readme.md"]);
      expect(result.projectStage).toBe("development");
    });

    it("should handle non-git repository", async () => {
      const repoPath = "/test/non-repo";

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }
        callback?.(new Error("Not a git repository"), {
          stderr: "",
          stdout: "",
        } as any);
        return {} as any;
      });

      const result = await service.analyzeRepository(repoPath);

      expect(result.isRepository).toBe(false);
      expect(result.currentBranch).toBe("");
      expect(result.recentCommits).toEqual([]);
      expect(result.modifiedFiles).toEqual([]);
      expect(result.projectStage).toBe("unknown");
    });

    it("should handle git command errors gracefully", async () => {
      const repoPath = "/test/repo";

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }

        if (command === "git rev-parse --git-dir") {
          callback?.(null, { stderr: "", stdout: ".git" } as any);
        } else {
          callback?.(new Error("Git command failed"), {
            stderr: "",
            stdout: "",
          } as any);
        }

        return {} as any;
      });

      const result = await service.analyzeRepository(repoPath);

      expect(result.isRepository).toBe(true);
      expect(result.currentBranch).toBe("unknown");
      expect(result.recentCommits).toEqual([]);
      expect(result.modifiedFiles).toEqual([]);
    });
  });

  describe("monitorFileChanges", () => {
    it("should monitor file changes successfully", async () => {
      const repoPath = "/test/repo";
      const callback = vi.fn();

      // Mock fs.watch
      const mockWatcher = { close: vi.fn() };
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      // Mock git status for file changes
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }
        callback?.(null, { stderr: "", stdout: "M src/file.ts\n" } as any);
        return {} as any;
      });

      await service.monitorFileChanges(repoPath, callback);

      expect(fs.watch).toHaveBeenCalledWith(
        repoPath,
        { recursive: true },
        expect.any(Function),
      );
    });
  });

  describe("detectAgentFromGitContext", () => {
    it("should detect developer agent from development patterns", async () => {
      const gitContext = {
        currentBranch: "feature/new-feature",
        isRepository: true,
        modifiedFiles: ["src/component.ts", "src/utils.js"],
        projectStage: "development" as const,
        recentCommits: [
          {
            author: "John Doe",
            hash: "abc123",
            message: "feat: implement new feature",
            timestamp: "2024-01-01",
          },
        ],
      };

      const result = await service.detectAgentFromGitContext(
        "/test/repo",
        gitContext,
      );

      expect(result).toBe("developer");
    });

    it("should detect PM agent from documentation patterns", async () => {
      const gitContext = {
        currentBranch: "docs/update-readme",
        isRepository: true,
        modifiedFiles: ["README.md", "docs/guide.md"],
        projectStage: "development" as const,
        recentCommits: [
          {
            author: "Jane Doe",
            hash: "def456",
            message: "docs: update project documentation",
            timestamp: "2024-01-01",
          },
        ],
      };

      const result = await service.detectAgentFromGitContext(
        "/test/repo",
        gitContext,
      );

      expect(result).toBe("pm");
    });

    it("should detect QA agent from test patterns", async () => {
      const gitContext = {
        currentBranch: "test/unit-tests",
        isRepository: true,
        modifiedFiles: ["tests/component.test.ts", "tests/utils.spec.js"],
        projectStage: "testing" as const,
        recentCommits: [
          {
            author: "Test Engineer",
            hash: "ghi789",
            message: "test: add unit tests for components",
            timestamp: "2024-01-01",
          },
        ],
      };

      const result = await service.detectAgentFromGitContext(
        "/test/repo",
        gitContext,
      );

      expect(result).toBe("qa");
    });

    it("should return null when no clear pattern matches", async () => {
      const gitContext = {
        currentBranch: "main",
        isRepository: true,
        modifiedFiles: ["random.txt"],
        projectStage: "unknown" as const,
        recentCommits: [
          {
            author: "Unknown",
            hash: "xyz999",
            message: "misc changes",
            timestamp: "2024-01-01",
          },
        ],
      };

      const result = await service.detectAgentFromGitContext(
        "/test/repo",
        gitContext,
      );

      expect(result).toBeNull();
    });
  });

  describe("getCommitPatternAnalysis", () => {
    it("should analyze commit patterns successfully", async () => {
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }
        callback?.(null, {
          stderr: "",
          stdout:
            "feat: add feature\nfix: fix bug\nfeat: another feature\ntest: add tests\n",
        } as any);
        return {} as any;
      });

      const result = await service.getCommitPatternAnalysis("/test/repo", 7);

      expect(result).toEqual({
        feat: 2,
        fix: 1,
        test: 1,
      });
    });

    it("should handle git command errors gracefully", async () => {
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }
        callback?.(new Error("Git error"), { stderr: "", stdout: "" } as any);
        return {} as any;
      });

      const result = await service.getCommitPatternAnalysis("/test/repo", 7);

      expect(result).toEqual({});
    });
  });

  describe("getBranchContext", () => {
    it("should get branch context successfully", async () => {
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof options === "function") {
          callback = options;
        }

        if (command === "git branch --show-current") {
          callback?.(null, {
            stderr: "",
            stdout: "feature/new-feature\n",
          } as any);
        } else if (command.includes("git branch --format")) {
          callback?.(null, {
            stderr: "",
            stdout: "main\nfeature/new-feature\ndev\n",
          } as any);
        } else if (command.includes("git branch -r")) {
          callback?.(null, {
            stderr: "",
            stdout: "origin/main\norigin/dev\n",
          } as any);
        }

        return {} as any;
      });

      const result = await service.getBranchContext("/test/repo");

      expect(result).toEqual({
        allBranches: ["main", "feature/new-feature", "dev"],
        currentBranch: "feature/new-feature",
        isFeatureBranch: true,
        isHotfixBranch: false,
        isMainBranch: false,
        remoteBranches: ["origin/main", "origin/dev"],
      });
    });
  });
});
