import {
  type AgentDetectionPattern,
  type AgentDetectionResult,
  type AgentRole,
  type ClaudeCodeHookContext,
  type BMadProjectConfig,
} from "../models/TeamAgent.js";
import { getCurrentUserState } from "../server.js";
import { AIMemoryService } from "./aiMemoryService.js";
import { TeamAgentService } from "./TeamAgentService.js";
import { FileSystemAgentService } from "./FileSystemAgentService.js";

export class ClaudeCodeAgentService {
  private detectionPatterns: AgentDetectionPattern[] = [
    // Development patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(implement|fix|debug|refactor|code|build|test)\b/i,
      agentRole: "developer",
      confidence: 0.8,
      contextRequirements: ["projectPath"],
    },
    // PM patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(plan|roadmap|requirements|milestone|timeline|epic|story)\b/i,
      agentRole: "pm",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
    },
    // UX patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(design|ui|ux|interface|user|wireframe|mockup)\b/i,
      agentRole: "ux-expert",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
    },
    // QA patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(test|quality|bug|validate|verify|check)\b/i,
      agentRole: "qa",
      confidence: 0.6,
      contextRequirements: ["projectPath"],
    },
    // Architecture patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(architect|design|system|structure|pattern|framework)\b/i,
      agentRole: "architect",
      confidence: 0.7,
      contextRequirements: ["projectPath"],
    },
    // BMAD patterns
    {
      hookType: "UserPromptSubmit",
      pattern: /\b(bmad|methodology|workflow|checklist|template)\b/i,
      agentRole: "bmad-master",
      confidence: 0.9,
      contextRequirements: ["projectPath"],
    },
  ];

  constructor(
    private memoryService: AIMemoryService,
    private teamAgentService: TeamAgentService,
    private fileSystemService: FileSystemAgentService,
  ) {}

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
        success: false,
        confidence: 0,
        context: {},
        error: {
          code: "AGENT_DETECTION_FAILED",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
      };
    }
  }

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
        projectPath,
        agentPreferences: agentPreferences?.agentPreferences || {
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
        defaultAgent: agentRole,
        gitIntegration: agentPreferences?.gitIntegration || {
          enabled: true,
          watchPaths: ["src/", "docs/", "tests/"],
          triggerPatterns: ["feat:", "fix:", "test:", "docs:"],
          excludePaths: ["node_modules/", ".git/", "dist/"],
        },
        memoryHubId: agentPreferences?.memoryHubId || "default",
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
          success: true,
          detectedAgent: (memory.context as any)?.agentRole as AgentRole,
          confidence: memory.importance || 0.5,
          context: (memory.context as Record<string, unknown>) || {},
        };
      }

      return {
        success: false,
        confidence: 0,
        context: {},
        error: {
          code: "NO_AGENT_STATE",
          message: "No active agent state found for session",
        },
      };
    } catch (error) {
      return {
        success: false,
        confidence: 0,
        context: {},
        error: {
          code: "STATE_RETRIEVAL_FAILED",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
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
      const { keyPair, hubId } = getCurrentUserState();
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
        fromAgent,
        toAgent,
        sessionId,
        transferredAt: new Date().toISOString(),
        contextCount: limitedMemories.length,
      };
      await this.memoryService.addEnhanced(keyPair, hubId, {
        content: `Agent handoff: ${fromAgent} → ${toAgent}`,
        memoryType: "context",
        importance: 0.9,
        context: {
          ...transferContext,
          transferredMemories: limitedMemories.map((m) => m.id),
        } as any,
      });

      return {
        success: true,
        detectedAgent: toAgent as AgentRole,
        confidence: 1.0,
        context: transferContext,
      };
    } catch (error) {
      return {
        success: false,
        confidence: 0,
        context: {},
        error: {
          code: "CONTEXT_TRANSFER_FAILED",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          details: error,
        },
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
        success: true,
        detectedAgent: bestMatch.agentRole,
        confidence: bestConfidence,
        context: {
          pattern: bestMatch.pattern.source,
          hookType: hookContext.eventType,
          userInput: userInput.substring(0, 200), // First 200 chars for context
          projectPath: hookContext.workingDirectory,
          defaultAgent: projectConfig?.defaultAgent,
        },
      };
    }

    // Fallback to default agent if configured
    if (projectConfig?.defaultAgent) {
      return {
        success: true,
        detectedAgent: projectConfig.defaultAgent,
        confidence: 0.3,
        context: {
          fallback: true,
          projectPath: hookContext.workingDirectory,
        },
      };
    }

    return {
      success: false,
      confidence: 0,
      context: {},
      error: {
        code: "NO_AGENT_DETECTED",
        message: "No suitable agent pattern matched the user input",
      },
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
    const { keyPair, hubId } = getCurrentUserState();
    await this.memoryService.addEnhanced(keyPair, hubId, {
      content: `Agent activated: ${detectionResult.detectedAgent}`,
      memoryType: "context",
      importance: detectionResult.confidence,
      context: {
        sessionId: hookContext.sessionId,
        agentRole: detectionResult.detectedAgent,
        hookType: hookContext.eventType,
        timestamp: hookContext.timestamp,
        workingDirectory: hookContext.workingDirectory,
        ...detectionResult.context,
      } as any,
    });
  }
}
