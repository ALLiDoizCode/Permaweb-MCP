import { promises as fs } from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BMadProjectConfig } from "../../../src/models/TeamAgent.js";

import { FileSystemAgentService } from "../../../src/services/FileSystemAgentService.js";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    access: vi.fn(),
    appendFile: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    writeFile: vi.fn(),
  },
}));

describe("FileSystemAgentService", () => {
  let service: FileSystemAgentService;
  const mockProjectPath = "/test/project";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileSystemAgentService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initializeBMadStructure", () => {
    it("should create .bmad directory structure successfully", async () => {
      // Mock fs.access to throw (directory doesn't exist)
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await service.initializeBMadStructure(mockProjectPath);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, ".bmad"),
        { recursive: true },
      );

      // Verify subdirectories creation
      const subdirs = ["agents", "sessions", "logs", "cache"];
      for (const subdir of subdirs) {
        expect(fs.mkdir).toHaveBeenCalledWith(
          path.join(mockProjectPath, ".bmad", subdir),
          { recursive: true },
        );
      }

      // Verify .gitignore creation
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, ".bmad", ".gitignore"),
        expect.stringContaining("# BMAD Agent Data"),
      );

      // Verify config.json creation
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, ".bmad", "config.json"),
        expect.stringContaining(mockProjectPath),
      );
    });

    it("should skip initialization if .bmad directory exists", async () => {
      // Mock fs.access to succeed (directory exists)
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await service.initializeBMadStructure(mockProjectPath);

      // Should not create directories if they exist
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockRejectedValue(new Error("Permission denied"));

      await expect(
        service.initializeBMadStructure(mockProjectPath),
      ).rejects.toThrow("Failed to initialize BMAD structure");
    });
  });

  describe("persistAgentConfig", () => {
    it("should persist agent configuration successfully", async () => {
      const config: BMadProjectConfig = {
        agentPreferences: {
          collaboration: {
            feedbackStyle: "constructive",
            meetingPreference: "async",
            preferredTools: [],
          },
          communicationStyle: "technical",
          notifications: {
            enabled: true,
            frequency: "immediate",
            types: [],
          },
          workingHours: {
            end: "17:00",
            start: "09:00",
            timezone: "UTC",
          },
        },
        defaultAgent: "developer",
        gitIntegration: {
          enabled: true,
          excludePaths: [],
          triggerPatterns: [],
          watchPaths: [],
        },
        memoryHubId: "default",
        projectPath: mockProjectPath,
      };

      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await service.persistAgentConfig(mockProjectPath, config);

      // Verify atomic write
      const tempPath = path.join(mockProjectPath, ".bmad", "config.json.tmp");
      expect(fs.writeFile).toHaveBeenCalledWith(
        tempPath,
        JSON.stringify(config, null, 2),
      );
      expect(fs.rename).toHaveBeenCalledWith(
        tempPath,
        path.join(mockProjectPath, ".bmad", "config.json"),
      );
    });

    it("should validate path security", async () => {
      const config: BMadProjectConfig = {
        agentPreferences: {} as any,
        defaultAgent: "developer",
        gitIntegration: {} as any,
        memoryHubId: "default",
        projectPath: "../malicious/path",
      };

      await expect(
        service.persistAgentConfig(mockProjectPath, config),
      ).rejects.toThrow("Path traversal attempt detected");
    });
  });

  describe("loadAgentConfig", () => {
    it("should load agent configuration successfully", async () => {
      const mockConfig: BMadProjectConfig = {
        agentPreferences: {} as any,
        defaultAgent: "developer",
        gitIntegration: {} as any,
        memoryHubId: "default",
        projectPath: mockProjectPath,
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await service.loadAgentConfig(mockProjectPath);

      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, ".bmad", "config.json"),
        "utf-8",
      );
    });

    it("should throw error for missing configuration", async () => {
      const error = new Error("ENOENT") as { code: string } & Error;
      error.code = "ENOENT";
      vi.mocked(fs.access).mockRejectedValue(error);

      await expect(service.loadAgentConfig(mockProjectPath)).rejects.toThrow(
        "BMAD configuration not found",
      );
    });

    it("should validate configuration structure", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

      await expect(service.loadAgentConfig(mockProjectPath)).rejects.toThrow(
        "Invalid configuration: projectPath is required",
      );
    });
  });

  describe("persistAgentState", () => {
    it("should persist agent state successfully", async () => {
      const sessionId = "test-session";
      const state = {
        activeAgent: "developer",
        lastActivity: "2024-01-01T00:00:00Z",
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await service.persistAgentState(mockProjectPath, sessionId, state);

      const expectedState = {
        ...state,
        lastUpdated: expect.any(String),
        sessionId,
      };

      const tempPath = path.join(
        mockProjectPath,
        ".bmad",
        "sessions",
        `${sessionId}.json.tmp`,
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        tempPath,
        JSON.stringify(expectedState, null, 2),
      );
    });
  });

  describe("loadAgentState", () => {
    it("should load agent state successfully", async () => {
      const sessionId = "test-session";
      const mockState = { activeAgent: "developer" };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockState));

      const result = await service.loadAgentState(mockProjectPath, sessionId);

      expect(result).toEqual(mockState);
    });

    it("should return empty state for missing session", async () => {
      const error = new Error("ENOENT") as { code: string } & Error;
      error.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await service.loadAgentState(
        mockProjectPath,
        "missing-session",
      );

      expect(result).toEqual({});
    });
  });

  describe("cleanupOldSessions", () => {
    it("should cleanup old session files", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      vi.mocked(fs.readdir).mockResolvedValue([
        "session1.json",
        "session2.json",
        "other.txt",
      ] as any);
      vi.mocked(fs.stat).mockResolvedValue({ mtime: oldDate } as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const result = await service.cleanupOldSessions(mockProjectPath, 30);

      expect(result).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe("checkFilePermissions", () => {
    it("should check file permissions correctly", async () => {
      vi.mocked(fs.access).mockImplementation((filePath, mode) => {
        if (mode === fs.constants.F_OK) return Promise.resolve(undefined);
        if (mode === fs.constants.R_OK) return Promise.resolve(undefined);
        if (mode === fs.constants.W_OK) return Promise.resolve(undefined);
        return Promise.reject(new Error("No execute permission"));
      });

      const permissions = await service.checkFilePermissions("/test/file");

      expect(permissions).toEqual({
        execute: false,
        read: true,
        write: true,
      });
    });

    it("should throw error for non-existent file", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      await expect(
        service.checkFilePermissions("/nonexistent"),
      ).rejects.toThrow("File does not exist");
    });
  });
});
