import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { promisify } from "util";

import type {
  AgentRole,
  FileChanges,
  GitCommit,
  GitContext,
} from "../models/TeamAgent.js";

// ClaudeCodeAgentService removed - BMAD functionality

const execAsync = promisify(exec);

export class GitContextService {
  constructor() {
    // Agent service removed - BMAD functionality
  }

  async analyzeRepository(repoPath: string): Promise<GitContext> {
    try {
      const isRepository = await this.isGitRepository(repoPath);

      if (!isRepository) {
        return {
          currentBranch: "",
          isRepository: false,
          modifiedFiles: [],
          projectStage: "unknown",
          recentCommits: [],
        };
      }

      const [currentBranch, recentCommits, modifiedFiles] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getRecentCommits(repoPath),
        this.getModifiedFiles(repoPath),
      ]);

      const projectStage = this.determineProjectStage(
        recentCommits,
        modifiedFiles,
      );

      return {
        currentBranch,
        isRepository: true,
        modifiedFiles,
        projectStage,
        recentCommits,
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze repository: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async detectAgentFromGitContext(
    repoPath: string,
    gitContext: GitContext,
  ): Promise<AgentRole | null> {
    try {
      // Analyze recent commits for patterns
      const commitMessages = gitContext.recentCommits
        .map((commit) => commit.message)
        .join(" ");

      // Analyze modified files for patterns
      const fileExtensions = gitContext.modifiedFiles
        .map((file) => path.extname(file))
        .filter((ext) => ext);

      // Development context indicators
      if (
        commitMessages.match(/\b(feat|fix|refactor|perf)\b/i) ||
        fileExtensions.some((ext) =>
          [".go", ".java", ".js", ".py", ".ts"].includes(ext),
        )
      ) {
        return "developer";
      }

      // Documentation context indicators
      if (
        commitMessages.match(/\b(docs|readme|documentation)\b/i) ||
        fileExtensions.some((ext) => [".md", ".rst", ".txt"].includes(ext))
      ) {
        return "pm"; // PM often handles documentation
      }

      // Test context indicators
      if (
        commitMessages.match(/\b(test|spec|coverage)\b/i) ||
        gitContext.modifiedFiles.some((file) => file.includes("test"))
      ) {
        return "qa";
      }

      // Architecture context indicators
      if (
        commitMessages.match(/\b(architect|design|structure)\b/i) ||
        gitContext.modifiedFiles.some((file) => file.includes("architecture"))
      ) {
        return "architect";
      }

      return null;
    } catch (error) {
      console.warn(`Error detecting agent from git context: ${error}`);
      return null;
    }
  }

  async getBranchContext(repoPath: string): Promise<Record<string, unknown>> {
    try {
      const [currentBranch, allBranches, remoteBranches] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getAllBranches(repoPath),
        this.getRemoteBranches(repoPath),
      ]);

      return {
        allBranches,
        currentBranch,
        isFeatureBranch:
          currentBranch.startsWith("feature/") ||
          currentBranch.startsWith("feat/"),
        isHotfixBranch:
          currentBranch.startsWith("hotfix/") ||
          currentBranch.startsWith("fix/"),
        isMainBranch: ["develop", "main", "master"].includes(currentBranch),
        remoteBranches,
      };
    } catch (error) {
      return {};
    }
  }

  async getCommitPatternAnalysis(
    repoPath: string,
    days: number = 7,
  ): Promise<Record<string, number>> {
    try {
      const { stdout } = await execAsync(
        `git log --since="${days} days ago" --pretty=format:"%s" --no-merges`,
        { cwd: repoPath },
      );

      const commits = stdout.split("\n").filter((line) => line.trim());
      const patterns: Record<string, number> = {};

      for (const commit of commits) {
        // Extract conventional commit prefixes
        const match = commit.match(/^(\w+)(\(.+\))?\s*:/);
        if (match) {
          const prefix = match[1].toLowerCase();
          patterns[prefix] = (patterns[prefix] || 0) + 1;
        }
      }

      return patterns;
    } catch (error) {
      return {};
    }
  }

  async monitorFileChanges(
    repoPath: string,
    callback: (changes: FileChanges) => void,
  ): Promise<void> {
    try {
      // Simple file monitoring implementation
      // Note: In a real implementation, this would use fs.watch properly
      // For now, we'll implement a polling-based approach
      const pollInterval = setInterval(async () => {
        try {
          const changes = await this.getFileChanges(repoPath);
          if (
            changes.added.length > 0 ||
            changes.modified.length > 0 ||
            changes.deleted.length > 0 ||
            changes.renamed.length > 0
          ) {
            callback(changes);
          }
        } catch (error) {
          console.warn(`Error monitoring file changes: ${error}`);
        }
      }, 2000); // Poll every 2 seconds

      // Store interval for potential cleanup (not implemented here)
      // In a real implementation, you'd want to return a cleanup function
    } catch (error) {
      throw new Error(
        `Failed to monitor file changes: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private determineProjectStage(
    commits: GitCommit[],
    modifiedFiles: string[],
  ): "deployment" | "development" | "testing" | "unknown" {
    const recentMessages = commits
      .map((c) => c.message.toLowerCase())
      .join(" ");

    // Check for deployment indicators
    if (
      recentMessages.includes("deploy") ||
      recentMessages.includes("release") ||
      recentMessages.includes("production")
    ) {
      return "deployment";
    }

    // Check for testing indicators
    if (
      recentMessages.includes("test") ||
      recentMessages.includes("spec") ||
      modifiedFiles.some((file) => file.includes("test"))
    ) {
      return "testing";
    }

    // Check for development indicators
    if (
      recentMessages.includes("feat") ||
      recentMessages.includes("feature") ||
      recentMessages.includes("implement")
    ) {
      return "development";
    }

    return "unknown";
  }

  private async getAllBranches(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "git branch --format='%(refname:short)'",
        {
          cwd: repoPath,
        },
      );
      return stdout.split("\n").filter((branch) => branch.trim());
    } catch {
      return [];
    }
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync("git branch --show-current", {
        cwd: repoPath,
      });
      return stdout.trim();
    } catch {
      return "unknown";
    }
  }

  private async getFileChanges(repoPath: string): Promise<FileChanges> {
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: repoPath,
      });

      const changes: FileChanges = {
        added: [],
        deleted: [],
        modified: [],
        renamed: [],
      };

      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;

        const status = line.substring(0, 2);
        const filename = line.substring(3);

        switch (status.trim()) {
          case "A":
            changes.added.push(filename);
            break;
          case "D":
            changes.deleted.push(filename);
            break;
          case "M":
            changes.modified.push(filename);
            break;
          case "R":
            // Renamed files have format "R  old -> new"
            const [oldName, newName] = filename.split(" -> ");
            if (oldName && newName) {
              changes.renamed.push({ from: oldName, to: newName });
            }
            break;
        }
      }

      return changes;
    } catch {
      return {
        added: [],
        deleted: [],
        modified: [],
        renamed: [],
      };
    }
  }

  private async getModifiedFiles(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: repoPath,
      });

      return stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.substring(3)); // Remove status prefix
    } catch {
      return [];
    }
  }

  private async getRecentCommits(
    repoPath: string,
    count: number = 10,
  ): Promise<GitCommit[]> {
    try {
      const { stdout } = await execAsync(
        `git log --oneline -n ${count} --pretty=format:"%H|%s|%an|%ai"`,
        { cwd: repoPath },
      );

      return stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, message, author, timestamp] = line.split("|");
          return {
            author,
            hash: hash.substring(0, 8), // Short hash
            message,
            timestamp,
          };
        });
    } catch {
      return [];
    }
  }

  private async getRemoteBranches(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "git branch -r --format='%(refname:short)'",
        {
          cwd: repoPath,
        },
      );
      return stdout.split("\n").filter((branch) => branch.trim());
    } catch {
      return [];
    }
  }

  private async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      await execAsync("git rev-parse --git-dir", { cwd: repoPath });
      return true;
    } catch {
      return false;
    }
  }

  private shouldIgnoreFile(filename: string): boolean {
    const ignorePaths = [
      ".git/",
      "node_modules/",
      ".vscode/",
      ".idea/",
      "dist/",
      "build/",
      ".next/",
      ".nuxt/",
      ".tmp/",
      ".temp/",
    ];

    return ignorePaths.some((ignorePath) => filename.includes(ignorePath));
  }
}
