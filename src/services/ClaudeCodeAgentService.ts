import {
  type AgentDetectionPattern,
  type AgentDetectionResult,
  type AgentRole,
  type BMadProjectConfig,
  type ClaudeCodeHookContext,
} from "../models/TeamAgent.js";
import { getCurrentUserState } from "../server.js";
import { AIMemoryService } from "./aiMemoryService.js";
import { FileSystemAgentService } from "./FileSystemAgentService.js";
import { TeamAgentService } from "./TeamAgentService.js";

export class ClaudeCodeAgentService {
  private detectionPatterns: AgentDetectionPattern[] = [
    // Development patterns
    {
      agentRole: "developer",
      confidence: 0.8,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(implement|fix|debug|refactor|code|build|test)\b/i,
    },
    // PM patterns
    {
      agentRole: "pm",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(plan|roadmap|requirements|milestone|timeline|epic|story)\b/i,
    },
    // UX patterns
    {
      agentRole: "ux-expert",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(design|ui|ux|interface|user|wireframe|mockup)\b/i,
    },
    // QA patterns
    {
      agentRole: "qa",
      confidence: 0.6,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(test|quality|bug|validate|verify|check)\b/i,
    },
    // Architecture patterns
    {
      agentRole: "architect",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(architect|design|system|structure|pattern|framework)\b/i,
    },
    // BMAD patterns
    {
      agentRole: "bmad-master",
      confidence: 0.9,
      contextRequirements: ["projectPath"],
      hookType: "UserPromptSubmit",
      pattern: /\b(bmad|methodology|workflow|checklist|template)\b/i,
    },
  ];

  constructor(
    private memoryService: AIMemoryService,
    private teamAgentService: TeamAgentService,
    private fileSystemService: FileSystemAgentService,
  ) {}

  async configureProjectAgent(
    projectPath: string,
    agentRole: AgentRole,
    agentPreferences?: Partial<BMadProjectConfig>,
  ): Promise<void> {
    try {
      // Initialize .bmad structure if needed
      await this.fileSystemService.initializeBMadStructure(projectPath);

      // Create or update project configuration
      const config: BMadProjectConfig = {
        agentPreferences: agentPreferences?.agentPreferences || {
          collaboration: {
            feedbackStyle: "constructive",
            meetingPreference: "async",
            preferredTools: [],
          },
          communicationStyle: "technical",
          notifications: {
            enabled: true,
            frequency: "immediate",
            types: ["agent_activation", "handoff", "error"],
          },
          workingHours: {
            end: "17:00",
            start: "09:00",
            timezone: "UTC",
          },
        },
        defaultAgent: agentRole,
        gitIntegration: agentPreferences?.gitIntegration || {
          enabled: true,
          excludePaths: ["node_modules/", ".git/", "dist/"],
          triggerPatterns: ["feat:", "fix:", "test:", "docs:"],
          watchPaths: ["src/", "docs/", "tests/"],
        },
        memoryHubId: agentPreferences?.memoryHubId || "default",
        projectPath,
      };

      await this.fileSystemService.persistAgentConfig(projectPath, config);
    } catch (error) {
      throw new Error(
        `Failed to configure project agent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getAgentState(sessionId: string): Promise<AgentDetectionResult> {
    try {
      // Search for recent agent context in memory
      const { hubId } = getCurrentUserState();
      const memories = await this.memoryService.searchAdvanced(
        hubId,
        `session:${sessionId} agent_activation`,
        {
          memoryType: "context",
        },
      );

      // Take only the most recent memory
      const recentMemories = memories.slice(0, 1);

      if (recentMemories.length > 0) {
        const memory = recentMemories[0];
        return {
          confidence: memory.importance || 0.5,
          context: (memory.context as Record<string, unknown>) || {},
          detectedAgent: (memory.context as any)?.agentRole as AgentRole,
          success: true,
        };
      }

      return {
        confidence: 0,
        context: {},
        error: {
          code: "NO_AGENT_STATE",
          message: "No active agent state found for session",
        },
        success: false,
      };
    } catch (error) {
      return {
        confidence: 0,
        context: {},
        error: {
          code: "STATE_RETRIEVAL_FAILED",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }

  async handleHookEvent(
    hookContext: ClaudeCodeHookContext,
  ): Promise<AgentDetectionResult> {
    try {
      // Load project configuration if available
      const projectConfig = await this.loadProjectConfig(
        hookContext.workingDirectory,
      );

      // Analyze user input for agent patterns
      const detectionResult = await this.detectAgentFromContext(
        hookContext,
        projectConfig,
      );

      // Store context for future use
      if (detectionResult.success && detectionResult.detectedAgent) {
        await this.storeAgentContext(hookContext, detectionResult);
      }

      return detectionResult;
    } catch (error) {
      return {
        confidence: 0,
        context: {},
        error: {
          code: "AGENT_DETECTION_FAILED",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }

  async transferAgentContext(
    fromAgent: string,
    toAgent: string,
    sessionId: string,
  ): Promise<AgentDetectionResult> {
    try {
      // Retrieve context from source agent and setup for transfer
      const { hubId, keyPair } = getCurrentUserState();
      const sourceMemories = await this.memoryService.searchAdvanced(
        hubId,
        `agent:${fromAgent} session:${sessionId}`,
        {
          memoryType: "context",
        },
      );

      // Limit to 10 most recent memories for transfer
      const limitedMemories = sourceMemories.slice(0, 10);

      // Transfer context to target agent
      const transferContext = {
        contextCount: limitedMemories.length,
        fromAgent,
        sessionId,
        toAgent,
        transferredAt: new Date().toISOString(),
      };
      await this.memoryService.addEnhanced(keyPair, hubId, {
        content: `Agent handoff: ${fromAgent} → ${toAgent}`,
        context: {
          ...transferContext,
          transferredMemories: limitedMemories.map((m) => m.id),
        } as any,
        importance: 0.9,
        memoryType: "context",
      });

      return {
        confidence: 1.0,
        context: transferContext,
        detectedAgent: toAgent as AgentRole,
        success: true,
      };
    } catch (error) {
      return {
        confidence: 0,
        context: {},
        error: {
          code: "CONTEXT_TRANSFER_FAILED",
          details: error,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        success: false,
      };
    }
  }

  private async detectAgentFromContext(
    hookContext: ClaudeCodeHookContext,
    projectConfig?: BMadProjectConfig,
  ): Promise<AgentDetectionResult> {
    let bestMatch: AgentDetectionPattern | null = null;
    let bestConfidence = 0;

    // Get the user input from the transcript path if available
    const userInput = await this.extractUserInput(hookContext);

    for (const pattern of this.detectionPatterns) {
      if (pattern.hookType !== hookContext.eventType) continue;

      const match = pattern.pattern.test(userInput);
      if (match && pattern.confidence > bestConfidence) {
        bestMatch = pattern;
        bestConfidence = pattern.confidence;
      }
    }

    if (bestMatch) {
      return {
        confidence: bestConfidence,
        context: {
          defaultAgent: projectConfig?.defaultAgent,
          hookType: hookContext.eventType,
          pattern: bestMatch.pattern.source,
          projectPath: hookContext.workingDirectory,
          userInput: userInput.substring(0, 200), // First 200 chars for context
        },
        detectedAgent: bestMatch.agentRole,
        success: true,
      };
    }

    // Fallback to default agent if configured
    if (projectConfig?.defaultAgent) {
      return {
        confidence: 0.3,
        context: {
          fallback: true,
          projectPath: hookContext.workingDirectory,
        },
        detectedAgent: projectConfig.defaultAgent,
        success: true,
      };
    }

    return {
      confidence: 0,
      context: {},
      error: {
        code: "NO_AGENT_DETECTED",
        message: "No suitable agent pattern matched the user input",
      },
      success: false,
    };
  }

  private async extractUserInput(
    hookContext: ClaudeCodeHookContext,
  ): Promise<string> {
    try {
      // For now, we'll use a simple approach since transcript reading
      // would require additional file system operations
      // In a real implementation, this would parse the transcript file
      return hookContext.toolName || "";
    } catch (error) {
      return "";
    }
  }

  private async loadProjectConfig(
    projectPath: string,
  ): Promise<BMadProjectConfig | undefined> {
    try {
      return await this.fileSystemService.loadAgentConfig(projectPath);
    } catch (error) {
      // Config doesn't exist or can't be loaded
      return undefined;
    }
  }

  private async storeAgentContext(
    hookContext: ClaudeCodeHookContext,
    detectionResult: AgentDetectionResult,
  ): Promise<void> {
    const { hubId, keyPair } = getCurrentUserState();
    await this.memoryService.addEnhanced(keyPair, hubId, {
      content: `Agent activated: ${detectionResult.detectedAgent}`,
      context: {
        agentRole: detectionResult.detectedAgent,
        hookType: hookContext.eventType,
        sessionId: hookContext.sessionId,
        timestamp: hookContext.timestamp,
        workingDirectory: hookContext.workingDirectory,
        ...detectionResult.context,
      } as any,
      importance: detectionResult.confidence,
      memoryType: "context",
    });
  }
}
