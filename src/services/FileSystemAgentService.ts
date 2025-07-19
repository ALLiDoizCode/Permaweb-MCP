import { promises as fs } from "fs";
import * as path from "path";
import type {
  BMadProjectConfig,
  FilePermissions,
} from "../models/TeamAgent.js";

export class FileSystemAgentService {
  private readonly BMAD_DIR = ".bmad";
  private readonly CONFIG_FILE = "config.json";
  private readonly STATE_FILE = "state.json";
  private readonly AGENT_LOG_FILE = "agent.log";

  async initializeBMadStructure(projectPath: string): Promise<void> {
    try {
      const bmadPath = path.join(projectPath, this.BMAD_DIR);

      // Check if .bmad directory already exists
      try {
        await fs.access(bmadPath);
        return; // Directory already exists
      } catch {
        // Directory doesn't exist, create it
      }

      // Create .bmad directory structure
      await fs.mkdir(bmadPath, { recursive: true });

      // Create subdirectories
      const subdirs = ["agents", "sessions", "logs", "cache"];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(bmadPath, subdir), { recursive: true });
      }

      // Create .gitignore to exclude sensitive data
      const gitignoreContent = `# BMAD Agent Data
sessions/
logs/
cache/
*.log
state.json
`;
      await fs.writeFile(path.join(bmadPath, ".gitignore"), gitignoreContent);

      // Create initial config template
      const initialConfig: Partial<BMadProjectConfig> = {
        projectPath,
        agentPreferences: {
          communicationStyle: "technical",
          collaboration: {
            feedbackStyle: "constructive",
            meetingPreference: "async",
            preferredTools: [],
          },
          notifications: {
            enabled: true,
            frequency: "immediate",
            types: ["agent_activation", "handoff", "error"],
          },
          workingHours: {
            start: "09:00",
            end: "17:00",
            timezone: "UTC",
          },
        },
        gitIntegration: {
          enabled: true,
          watchPaths: ["src/", "docs/", "tests/"],
          triggerPatterns: ["feat:", "fix:", "test:", "docs:"],
          excludePaths: ["node_modules/", ".git/", "dist/"],
        },
        memoryHubId: "default",
      };

      await fs.writeFile(
        path.join(bmadPath, this.CONFIG_FILE),
        JSON.stringify(initialConfig, null, 2),
      );

      // Log initialization
      await this.logAgentActivity(
        projectPath,
        "BMAD structure initialized",
        "system",
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize BMAD structure: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async persistAgentConfig(
    projectPath: string,
    config: BMadProjectConfig,
  ): Promise<void> {
    try {
      const configPath = path.join(
        projectPath,
        this.BMAD_DIR,
        this.CONFIG_FILE,
      );

      // Validate path security
      this.validatePath(configPath, projectPath);

      // Create backup of existing config
      await this.createConfigBackup(configPath);

      // Write new configuration atomically
      const tempPath = `${configPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(config, null, 2));
      await fs.rename(tempPath, configPath);

      // Log configuration update
      await this.logAgentActivity(
        projectPath,
        `Agent configuration updated: ${config.defaultAgent}`,
        "system",
      );
    } catch (error) {
      throw new Error(
        `Failed to persist agent config: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadAgentConfig(projectPath: string): Promise<BMadProjectConfig> {
    try {
      const configPath = path.join(
        projectPath,
        this.BMAD_DIR,
        this.CONFIG_FILE,
      );

      // Validate path security
      this.validatePath(configPath, projectPath);

      // Check if config exists
      await fs.access(configPath);

      // Read and parse configuration
      const configData = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configData) as BMadProjectConfig;

      // Validate configuration structure
      this.validateConfig(config);

      return config;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(
          "BMAD configuration not found. Run initialization first.",
        );
      }
      throw new Error(
        `Failed to load agent config: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async persistAgentState(
    projectPath: string,
    sessionId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    try {
      const statePath = path.join(
        projectPath,
        this.BMAD_DIR,
        "sessions",
        `${sessionId}.json`,
      );

      // Validate path security
      this.validatePath(statePath, projectPath);

      // Ensure sessions directory exists
      await fs.mkdir(path.dirname(statePath), { recursive: true });

      // Add timestamp to state
      const timestampedState = {
        ...state,
        lastUpdated: new Date().toISOString(),
        sessionId,
      };

      // Write state atomically
      const tempPath = `${statePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(timestampedState, null, 2));
      await fs.rename(tempPath, statePath);
    } catch (error) {
      throw new Error(
        `Failed to persist agent state: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadAgentState(
    projectPath: string,
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const statePath = path.join(
        projectPath,
        this.BMAD_DIR,
        "sessions",
        `${sessionId}.json`,
      );

      // Validate path security
      this.validatePath(statePath, projectPath);

      // Read and parse state
      const stateData = await fs.readFile(statePath, "utf-8");
      return JSON.parse(stateData) as Record<string, unknown>;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return {}; // Return empty state if file doesn't exist
      }
      throw new Error(
        `Failed to load agent state: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async cleanupOldSessions(
    projectPath: string,
    olderThanDays: number = 30,
  ): Promise<number> {
    try {
      const sessionsPath = path.join(projectPath, this.BMAD_DIR, "sessions");
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const files = await fs.readdir(sessionsPath);
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(sessionsPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await this.logAgentActivity(
          projectPath,
          `Cleaned up ${cleanedCount} old session files`,
          "system",
        );
      }

      return cleanedCount;
    } catch (error) {
      throw new Error(
        `Failed to cleanup old sessions: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async checkFilePermissions(filePath: string): Promise<FilePermissions> {
    try {
      await fs.access(filePath, fs.constants.F_OK);

      const permissions: FilePermissions = {
        read: false,
        write: false,
        execute: false,
      };

      try {
        await fs.access(filePath, fs.constants.R_OK);
        permissions.read = true;
      } catch {
        // No read permission
      }

      try {
        await fs.access(filePath, fs.constants.W_OK);
        permissions.write = true;
      } catch {
        // No write permission
      }

      try {
        await fs.access(filePath, fs.constants.X_OK);
        permissions.execute = true;
      } catch {
        // No execute permission
      }

      return permissions;
    } catch {
      throw new Error(`File does not exist: ${filePath}`);
    }
  }

  private async logAgentActivity(
    projectPath: string,
    message: string,
    source: string,
  ): Promise<void> {
    try {
      const logPath = path.join(
        projectPath,
        this.BMAD_DIR,
        "logs",
        this.AGENT_LOG_FILE,
      );

      // Ensure logs directory exists
      await fs.mkdir(path.dirname(logPath), { recursive: true });

      const logEntry = {
        timestamp: new Date().toISOString(),
        source,
        message,
      };

      const logLine = `${JSON.stringify(logEntry)}\n`;
      await fs.appendFile(logPath, logLine);
    } catch (error) {
      // Don't throw on logging errors, just continue
      console.warn(`Failed to log agent activity: ${error}`);
    }
  }

  private async createConfigBackup(configPath: string): Promise<void> {
    try {
      await fs.access(configPath);
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copyFile(configPath, backupPath);

      // Keep only the 5 most recent backups
      const backupDir = path.dirname(configPath);
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith(path.basename(configPath) + ".backup."))
        .sort()
        .reverse();

      // Remove excess backups
      for (let i = 5; i < backupFiles.length; i++) {
        await fs.unlink(path.join(backupDir, backupFiles[i]));
      }
    } catch {
      // If backup fails, continue with the operation
    }
  }

  private validatePath(filePath: string, basePath: string): void {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(basePath);

    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error("Path traversal attempt detected");
    }
  }

  private validateConfig(config: BMadProjectConfig): void {
    if (!config.projectPath || typeof config.projectPath !== "string") {
      throw new Error("Invalid configuration: projectPath is required");
    }

    if (!config.defaultAgent || typeof config.defaultAgent !== "string") {
      throw new Error("Invalid configuration: defaultAgent is required");
    }

    if (!config.memoryHubId || typeof config.memoryHubId !== "string") {
      throw new Error("Invalid configuration: memoryHubId is required");
    }
  }
}
