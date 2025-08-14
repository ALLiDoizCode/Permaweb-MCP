import {
  SessionValidationResult,
  StatePersistenceResult,
  StateValidationResult,
  WorkflowConfiguration,
  WorkflowSession,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowState,
} from "../types/workflow-orchestration.js";

/**
 * Service for workflow state management and persistence.
 *
 * This service provides:
 * - Comprehensive context preservation across all workflow stages
 * - State persistence mechanisms for workflow resumption and continuation
 * - State validation and consistency checking
 * - Recovery mechanisms for interrupted or failed workflow stages
 * - Session management for concurrent workflow executions
 */
export class WorkflowStateService {
  private readonly activeSessions: Map<string, WorkflowSession>;
  private readonly stateStorage: Map<string, WorkflowState>;

  constructor() {
    this.activeSessions = new Map();
    this.stateStorage = new Map();
  }

  /**
   * Clean up old sessions and states
   */
  async cleanupOldSessions(maxAgeHours = 168): Promise<number> {
    // 7 days default
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions) {
      if (session.state.lastUpdate < cutoffTime && !session.isActive) {
        this.activeSessions.delete(sessionId);
        this.stateStorage.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Create a new workflow session with initial state
   */
  async createWorkflowSession(
    configuration: WorkflowConfiguration,
    userRequest: string,
  ): Promise<WorkflowSession> {
    const sessionId = this.generateSessionId();
    const timestamp = new Date();

    const initialState: WorkflowState = {
      checkpoints: [
        {
          stage: "initialization",
          state: {
            configuration,
            userRequest,
          },
          timestamp,
        },
      ],
      context: {
        configuration,
        currentStage: "initialization",
        metadata: {
          created: timestamp,
          version: 1,
        },
        sessionId,
        stageHistory: [],
        timestamp,
        userRequest,
      },
      currentData: {},
      lastUpdate: timestamp,
      sessionId,
      stageResults: {} as Record<WorkflowStage, WorkflowStageResult>,
      version: 1,
    };

    const session: WorkflowSession = {
      canResume: true,
      errors: [],
      isActive: true,
      isPaused: false,
      metadata: {
        configuration,
        created: timestamp,
        userRequest,
      },
      sessionId,
      state: initialState,
    };

    this.activeSessions.set(sessionId, session);
    this.stateStorage.set(sessionId, initialState);

    return session;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WorkflowSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.isActive);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): undefined | WorkflowSession {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Maintain workflow context as stages progress
   */
  async maintainWorkflowContext(
    session: WorkflowSession,
    stageResult: WorkflowStageResult,
  ): Promise<WorkflowSession> {
    const updatedState = { ...session.state };

    // Update context with stage progression
    updatedState.context.currentStage = stageResult.stage;
    updatedState.context.stageHistory.push(stageResult.stage);
    updatedState.context.metadata = {
      ...updatedState.context.metadata,
      lastStage: stageResult.stage,
      lastUpdate: new Date(),
    };

    // Store stage result
    updatedState.stageResults[stageResult.stage] = stageResult;

    // Update current data based on stage result
    if (stageResult.success && stageResult.data) {
      this.updateCurrentDataFromStage(updatedState, stageResult);
    }

    // Add checkpoint
    updatedState.checkpoints.push({
      stage: stageResult.stage,
      state: {
        context: updatedState.context,
        currentData: updatedState.currentData,
        stageResult,
      },
      timestamp: new Date(),
    });

    // Update version and timestamp
    updatedState.version += 1;
    updatedState.lastUpdate = new Date();

    // Handle errors
    if (!stageResult.success && stageResult.error) {
      session.errors.push({
        error: stageResult.error.message,
        stage: stageResult.stage,
        timestamp: new Date(),
      });

      // Determine if session should be paused for recovery
      if (this.isStageRecoverable(stageResult.stage)) {
        session.isPaused = true;
      } else {
        session.isActive = false;
        session.canResume = false;
      }
    }

    // Update session
    const updatedSession: WorkflowSession = {
      ...session,
      state: updatedState,
    };

    this.activeSessions.set(session.sessionId, updatedSession);
    await this.persistWorkflowState(updatedState);

    return updatedSession;
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isPaused = true;
    await this.persistWorkflowState(session.state);
    return true;
  }

  /**
   * Persist workflow state for durability
   */
  async persistWorkflowState(
    state: WorkflowState,
  ): Promise<StatePersistenceResult> {
    try {
      // In a real implementation, this would persist to a database or file system
      // For now, we use in-memory storage
      this.stateStorage.set(state.sessionId, {
        ...state,
        lastUpdate: new Date(),
      });

      return {
        sessionId: state.sessionId,
        success: true,
        timestamp: new Date(),
        version: state.version,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Unknown persistence error",
        sessionId: state.sessionId,
        success: false,
        timestamp: new Date(),
        version: state.version,
      };
    }
  }

  /**
   * Resume workflow session from saved state
   */
  async resumeWorkflowSession(sessionId: string): Promise<WorkflowSession> {
    const storedState = this.stateStorage.get(sessionId);
    if (!storedState) {
      throw new Error(`No stored state found for session: ${sessionId}`);
    }

    const existingSession = this.activeSessions.get(sessionId);
    if (existingSession && existingSession.isActive) {
      throw new Error(`Session ${sessionId} is already active`);
    }

    // Validate state before resumption
    const validationResult = await this.validateStateConsistency(storedState);
    if (!validationResult.isValid && !validationResult.canRecover) {
      throw new Error(
        `Cannot resume session ${sessionId}: state validation failed`,
      );
    }

    // Create resumed session
    const resumedSession: WorkflowSession = {
      canResume: true,
      errors: existingSession?.errors || [],
      isActive: true,
      isPaused: false,
      metadata: {
        ...existingSession?.metadata,
        resumeCount:
          ((existingSession?.metadata.resumeCount as number) || 0) + 1,
        resumed: new Date(),
      },
      sessionId,
      state: storedState,
    };

    this.activeSessions.set(sessionId, resumedSession);

    return resumedSession;
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;
    session.canResume = false;
    await this.persistWorkflowState(session.state);

    // Keep session for historical purposes but mark as inactive
    return true;
  }

  /**
   * Validate session integrity and consistency
   */
  async validateSessionIntegrity(
    session: WorkflowSession,
  ): Promise<SessionValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check basic session properties
    if (!session.sessionId) {
      issues.push("Session ID is missing");
    }

    if (!session.state) {
      issues.push("Session state is missing");
      return {
        canContinue: false,
        issues,
        isValid: false,
        recommendations: ["Create new session"],
      };
    }

    // Validate state consistency
    const stateValidation = await this.validateStateConsistency(session.state);
    if (!stateValidation.isValid) {
      issues.push(...stateValidation.issues.map((i) => i.message));
      if (stateValidation.canRecover) {
        recommendations.push(...stateValidation.recoveryActions);
      }
    }

    // Check for stale sessions
    const now = new Date();
    const lastUpdate = session.state.lastUpdate;
    const stalenessThreshold = 24 * 60 * 60 * 1000; // 24 hours

    if (now.getTime() - lastUpdate.getTime() > stalenessThreshold) {
      issues.push("Session is stale (last update > 24 hours ago)");
      recommendations.push(
        "Consider creating a new session or refreshing state",
      );
    }

    // Check for excessive errors
    if (session.errors.length > 10) {
      issues.push("Session has excessive error count");
      recommendations.push("Review error patterns and consider session reset");
    }

    // Validate context integrity
    const context = session.state.context;
    if (
      context.currentStage &&
      !context.stageHistory.includes(context.currentStage)
    ) {
      issues.push("Current stage not found in stage history");
      recommendations.push("Synchronize stage tracking");
    }

    const isValid = issues.length === 0;
    const canContinue =
      isValid || (issues.length < 3 && stateValidation.canRecover);

    return {
      canContinue,
      issues,
      isValid,
      recommendations,
    };
  }

  /**
   * Validate state consistency and integrity
   */
  async validateStateConsistency(
    state: WorkflowState,
  ): Promise<StateValidationResult> {
    const issues: Array<{
      field?: string;
      message: string;
      severity: "error" | "warning";
      stage?: WorkflowStage;
    }> = [];

    let consistencyScore = 1.0;

    // Check required fields
    if (!state.sessionId) {
      issues.push({
        field: "sessionId",
        message: "Session ID is missing",
        severity: "error",
      });
      consistencyScore -= 0.3;
    }

    if (!state.context) {
      issues.push({
        field: "context",
        message: "Workflow context is missing",
        severity: "error",
      });
      consistencyScore -= 0.3;
    } else {
      // Validate context consistency
      if (state.context.sessionId !== state.sessionId) {
        issues.push({
          field: "context.sessionId",
          message: "Context session ID mismatch",
          severity: "error",
        });
        consistencyScore -= 0.2;
      }

      if (state.context.stageHistory.length === 0) {
        issues.push({
          field: "context.stageHistory",
          message: "No stage history recorded",
          severity: "warning",
        });
        consistencyScore -= 0.1;
      }
    }

    // Check version consistency
    if (state.version < 1) {
      issues.push({
        field: "version",
        message: "Invalid state version",
        severity: "error",
      });
      consistencyScore -= 0.2;
    }

    // Check checkpoint consistency
    if (state.checkpoints.length === 0) {
      issues.push({
        field: "checkpoints",
        message: "No checkpoints recorded",
        severity: "warning",
      });
      consistencyScore -= 0.1;
    } else {
      const lastCheckpoint = state.checkpoints[state.checkpoints.length - 1];
      if (
        state.context &&
        lastCheckpoint.stage !== state.context.currentStage
      ) {
        issues.push({
          message: "Last checkpoint stage doesn't match current stage",
          severity: "warning",
          stage: state.context.currentStage,
        });
        consistencyScore -= 0.1;
      }
    }

    // Check data integrity
    const stageResults = Object.keys(state.stageResults);
    if (stageResults.length > 0 && !state.currentData) {
      issues.push({
        field: "currentData",
        message: "Stage results exist but current data is empty",
        severity: "warning",
      });
      consistencyScore -= 0.1;
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const isValid = errorCount === 0;
    const canRecover = errorCount <= 2 && consistencyScore > 0.3;

    const recoveryActions: string[] = [];
    if (!isValid && canRecover) {
      if (issues.some((i) => i.field === "context.sessionId")) {
        recoveryActions.push("Synchronize session IDs");
      }
      if (issues.some((i) => i.field === "checkpoints")) {
        recoveryActions.push("Rebuild checkpoint history");
      }
      if (issues.some((i) => i.field === "currentData")) {
        recoveryActions.push("Reconstruct current data from stage results");
      }
    }

    return {
      canRecover,
      consistencyScore,
      issues,
      isValid,
      recoveryActions,
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine if a stage failure is recoverable
   */
  private isStageRecoverable(stage: WorkflowStage): boolean {
    const recoverableStages: WorkflowStage[] = [
      "documentation-query",
      "architecture-analysis",
      "code-evaluation",
      "testing",
      "validation",
    ];

    return recoverableStages.includes(stage);
  }

  /**
   * Update current data based on stage result
   */
  private updateCurrentDataFromStage(
    state: WorkflowState,
    stageResult: WorkflowStageResult,
  ): void {
    switch (stageResult.stage) {
      case "code-generation":
        state.currentData.codeResult = stageResult.data as any;
        break;
      case "documentation-query":
        state.currentData.documentation = stageResult.data as any;
        break;
      case "process-creation":
        state.currentData.processResult = stageResult.data as any;
        break;
      case "requirement-analysis":
        state.currentData.requirements = stageResult.data as any;
        break;
      default:
        // Store in metadata for less common stages
        state.context.metadata[stageResult.stage] = stageResult.data;
        break;
    }
  }
}
