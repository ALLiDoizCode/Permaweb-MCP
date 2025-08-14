import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowStateService } from "../../../src/services/WorkflowStateService.js";
import {
  WorkflowConfiguration,
  WorkflowSession,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowState,
} from "../../../src/types/workflow-orchestration.js";

describe("WorkflowStateService", () => {
  let service: WorkflowStateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkflowStateService();
  });

  describe("createWorkflowSession", () => {
    it("should create a new workflow session with initial state", async () => {
      const configuration: WorkflowConfiguration = {
        includeArchitectureAnalysis: true,
        mode: "guided",
      };
      const userRequest = "Create a token process";

      const session = await service.createWorkflowSession(
        configuration,
        userRequest,
      );

      expect(session.sessionId).toBeDefined();
      expect(session.isActive).toBe(true);
      expect(session.canResume).toBe(true);
      expect(session.isPaused).toBe(false);
      expect(session.errors).toHaveLength(0);
      expect(session.metadata.configuration).toEqual(configuration);
      expect(session.metadata.userRequest).toBe(userRequest);
      expect(session.state.sessionId).toBe(session.sessionId);
      expect(session.state.context.currentStage).toBe("initialization");
      expect(session.state.context.userRequest).toBe(userRequest);
      expect(session.state.checkpoints).toHaveLength(1);
      expect(session.state.checkpoints[0].stage).toBe("initialization");
    });

    it("should initialize session with unique session ID", async () => {
      const configuration: WorkflowConfiguration = { mode: "autonomous" };
      const userRequest = "Create a chatroom process";

      const session1 = await service.createWorkflowSession(
        configuration,
        userRequest,
      );
      const session2 = await service.createWorkflowSession(
        configuration,
        userRequest,
      );

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it("should set up proper initial state structure", async () => {
      const configuration: WorkflowConfiguration = {
        enableIterativeMode: true,
        mode: "guided",
        processType: "token",
      };
      const userRequest = "Create a simple token";

      const session = await service.createWorkflowSession(
        configuration,
        userRequest,
      );

      expect(session.state.version).toBe(1);
      expect(session.state.currentData).toEqual({});
      expect(session.state.stageResults).toEqual({});
      expect(session.state.context.stageHistory).toHaveLength(0);
      expect(session.state.context.configuration).toEqual(configuration);
      expect(session.state.lastUpdate).toBeInstanceOf(Date);
    });
  });

  describe("maintainWorkflowContext", () => {
    let session: WorkflowSession;

    beforeEach(async () => {
      const configuration: WorkflowConfiguration = { mode: "guided" };
      session = await service.createWorkflowSession(
        configuration,
        "Test request",
      );
    });

    it("should update context when stage completes successfully", async () => {
      const stageResult: WorkflowStageResult = {
        data: { requirements: "test requirements" },
        executionTime: 1000,
        metadata: { timestamp: new Date() },
        stage: "requirement-analysis",
        success: true,
        toolsUsed: ["RequirementAnalysisService"],
      };

      const updatedSession = await service.maintainWorkflowContext(
        session,
        stageResult,
      );

      expect(updatedSession.state.context.currentStage).toBe(
        "requirement-analysis",
      );
      expect(updatedSession.state.context.stageHistory).toContain(
        "requirement-analysis",
      );
      expect(updatedSession.state.stageResults["requirement-analysis"]).toEqual(
        stageResult,
      );
      expect(updatedSession.state.version).toBe(2);
      expect(updatedSession.state.checkpoints).toHaveLength(2);
      expect(updatedSession.state.currentData.requirements).toEqual({
        requirements: "test requirements",
      });
    });

    it("should handle stage failures appropriately", async () => {
      const stageResult: WorkflowStageResult = {
        data: null,
        error: {
          code: "DOCUMENTATION_FAILED",
          message: "Documentation query failed",
        },
        executionTime: 500,
        metadata: { error: true, timestamp: new Date() },
        stage: "documentation-query",
        success: false,
        toolsUsed: ["PermawebDocsService"],
      };

      const updatedSession = await service.maintainWorkflowContext(
        session,
        stageResult,
      );

      expect(updatedSession.errors).toHaveLength(1);
      expect(updatedSession.errors[0].stage).toBe("documentation-query");
      expect(updatedSession.errors[0].error).toBe("Documentation query failed");
      expect(updatedSession.isPaused).toBe(true); // documentation-query is recoverable
      expect(updatedSession.isActive).toBe(true);
      expect(updatedSession.canResume).toBe(true);
    });

    it("should handle non-recoverable stage failures", async () => {
      const stageResult: WorkflowStageResult = {
        data: null,
        error: {
          code: "REQUIREMENT_ANALYSIS_FAILED",
          message: "Requirement analysis failed",
        },
        executionTime: 500,
        metadata: { error: true, timestamp: new Date() },
        stage: "requirement-analysis",
        success: false,
        toolsUsed: ["RequirementAnalysisService"],
      };

      const updatedSession = await service.maintainWorkflowContext(
        session,
        stageResult,
      );

      expect(updatedSession.errors).toHaveLength(1);
      expect(updatedSession.isActive).toBe(false); // requirement-analysis is not recoverable
      expect(updatedSession.canResume).toBe(false);
    });

    it("should update current data based on stage type", async () => {
      const stages = [
        {
          data: { requirements: "token requirements" },
          stage: "requirement-analysis" as WorkflowStage,
        },
        {
          data: [{ content: "docs", title: "Token Docs" }],
          stage: "documentation-query" as WorkflowStage,
        },
        {
          data: { generatedCode: "-- Lua code" },
          stage: "code-generation" as WorkflowStage,
        },
        {
          data: { processId: "test-process" },
          stage: "process-creation" as WorkflowStage,
        },
      ];

      let currentSession = session;
      for (const stageData of stages) {
        const stageResult: WorkflowStageResult = {
          data: stageData.data,
          executionTime: 1000,
          metadata: { timestamp: new Date() },
          stage: stageData.stage,
          success: true,
          toolsUsed: ["TestService"],
        };

        currentSession = await service.maintainWorkflowContext(
          currentSession,
          stageResult,
        );
      }

      expect(currentSession.state.currentData.requirements).toEqual({
        requirements: "token requirements",
      });
      expect(currentSession.state.currentData.documentation).toEqual([
        { content: "docs", title: "Token Docs" },
      ]);
      expect(currentSession.state.currentData.codeResult).toEqual({
        generatedCode: "-- Lua code",
      });
      expect(currentSession.state.currentData.processResult).toEqual({
        processId: "test-process",
      });
    });

    it("should add checkpoints for each stage", async () => {
      const stageResult: WorkflowStageResult = {
        data: { test: "data" },
        executionTime: 1000,
        metadata: { timestamp: new Date() },
        stage: "testing",
        success: true,
        toolsUsed: ["TestService"],
      };

      const updatedSession = await service.maintainWorkflowContext(
        session,
        stageResult,
      );

      expect(updatedSession.state.checkpoints).toHaveLength(2); // initial + new stage
      const newCheckpoint = updatedSession.state.checkpoints[1];
      expect(newCheckpoint.stage).toBe("testing");
      expect(newCheckpoint.state.stageResult).toEqual(stageResult);
      expect(newCheckpoint.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("resumeWorkflowSession", () => {
    let session: WorkflowSession;

    beforeEach(async () => {
      const configuration: WorkflowConfiguration = { mode: "guided" };
      session = await service.createWorkflowSession(
        configuration,
        "Test request",
      );

      // Add some stage results to make it more realistic
      const stageResult: WorkflowStageResult = {
        data: { requirements: "test" },
        executionTime: 1000,
        metadata: { timestamp: new Date() },
        stage: "requirement-analysis",
        success: true,
        toolsUsed: ["RequirementAnalysisService"],
      };

      await service.maintainWorkflowContext(session, stageResult);
      await service.terminateSession(session.sessionId);
    });

    it("should resume workflow session from stored state", async () => {
      const resumedSession = await service.resumeWorkflowSession(
        session.sessionId,
      );

      expect(resumedSession.sessionId).toBe(session.sessionId);
      expect(resumedSession.isActive).toBe(true);
      expect(resumedSession.isPaused).toBe(false);
      expect(resumedSession.canResume).toBe(true);
      expect(resumedSession.metadata.resumeCount).toBe(1);
      expect(resumedSession.metadata.resumed).toBeInstanceOf(Date);
    });

    it("should throw error when trying to resume non-existent session", async () => {
      await expect(
        service.resumeWorkflowSession("non-existent-session"),
      ).rejects.toThrow(
        "No stored state found for session: non-existent-session",
      );
    });

    it("should throw error when trying to resume active session", async () => {
      // First resume the session
      await service.resumeWorkflowSession(session.sessionId);

      // Try to resume again while it's active
      await expect(
        service.resumeWorkflowSession(session.sessionId),
      ).rejects.toThrow("Session " + session.sessionId + " is already active");
    });

    it("should validate state before resumption", async () => {
      // Corrupt the stored state severely to make it non-recoverable
      const corruptedState = {
        checkpoints: [],
        context: null, // Missing context (error)
        currentData: {},
        lastUpdate: new Date(),
        sessionId: "", // Missing session ID (error)
        stageResults: {},
        version: -1, // Invalid version (error)
      } as WorkflowState;

      (service as any).stateStorage.set(session.sessionId, corruptedState);

      await expect(
        service.resumeWorkflowSession(session.sessionId),
      ).rejects.toThrow(
        "Cannot resume session " +
          session.sessionId +
          ": state validation failed",
      );
    });
  });

  describe("validateStateConsistency", () => {
    let validState: WorkflowState;

    beforeEach(async () => {
      const session = await service.createWorkflowSession(
        { mode: "guided" },
        "Test request",
      );
      validState = session.state;
    });

    it("should validate consistent state successfully", async () => {
      const result = await service.validateStateConsistency(validState);

      expect(result.isValid).toBe(true);
      expect(result.canRecover).toBe(true);
      expect(result.consistencyScore).toBeGreaterThanOrEqual(0.8); // May be reduced due to warnings
      expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(
        0,
      );
      expect(result.recoveryActions).toHaveLength(0);
    });

    it("should identify missing session ID", async () => {
      const invalidState = { ...validState, sessionId: "" };

      const result = await service.validateStateConsistency(invalidState);

      expect(result.isValid).toBe(false);
      expect(result.consistencyScore).toBeLessThan(1.0);
      expect(result.issues.some((issue) => issue.field === "sessionId")).toBe(
        true,
      );
      expect(result.issues.some((issue) => issue.severity === "error")).toBe(
        true,
      );
    });

    it("should identify missing context", async () => {
      const invalidState = { ...validState, context: null as any };

      const result = await service.validateStateConsistency(invalidState);

      expect(result.isValid).toBe(false);
      expect(result.consistencyScore).toBeLessThan(1.0);
      expect(result.issues.some((issue) => issue.field === "context")).toBe(
        true,
      );
      expect(result.issues.some((issue) => issue.severity === "error")).toBe(
        true,
      );
    });

    it("should identify context session ID mismatch", async () => {
      const invalidState = {
        ...validState,
        context: {
          ...validState.context,
          sessionId: "different-session-id",
        },
      };

      const result = await service.validateStateConsistency(invalidState);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) => issue.field === "context.sessionId"),
      ).toBe(true);
    });

    it("should identify invalid version", async () => {
      const invalidState = { ...validState, version: -1 };

      const result = await service.validateStateConsistency(invalidState);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((issue) => issue.field === "version")).toBe(
        true,
      );
    });

    it("should warn about missing checkpoints", async () => {
      const stateWithoutCheckpoints = { ...validState, checkpoints: [] };

      const result = await service.validateStateConsistency(
        stateWithoutCheckpoints,
      );

      expect(result.isValid).toBe(true); // Warning, not error
      expect(
        result.issues.some(
          (issue) =>
            issue.field === "checkpoints" && issue.severity === "warning",
        ),
      ).toBe(true);
    });

    it("should provide recovery actions for recoverable states", async () => {
      const recoverableState = {
        ...validState,
        checkpoints: [],
        context: {
          ...validState.context,
          sessionId: "different-id",
        },
      };

      const result = await service.validateStateConsistency(recoverableState);

      expect(result.canRecover).toBe(true);
      expect(result.recoveryActions.length).toBeGreaterThan(0);
      expect(
        result.recoveryActions.some((action) =>
          action.includes("Synchronize session IDs"),
        ),
      ).toBe(true);
      expect(
        result.recoveryActions.some((action) =>
          action.includes("Rebuild checkpoint history"),
        ),
      ).toBe(true);
    });
  });

  describe("validateSessionIntegrity", () => {
    let session: WorkflowSession;

    beforeEach(async () => {
      const configuration: WorkflowConfiguration = { mode: "guided" };
      session = await service.createWorkflowSession(
        configuration,
        "Test request",
      );
    });

    it("should validate healthy session", async () => {
      const result = await service.validateSessionIntegrity(session);

      expect(result.canContinue).toBe(true);
      expect(
        result.issues.filter((issue) => !issue.includes("stage history")),
      ).toHaveLength(0);
      expect(
        result.recommendations.filter((rec) => !rec.includes("stage tracking")),
      ).toHaveLength(0);
    });

    it("should identify missing session ID", async () => {
      const invalidSession = { ...session, sessionId: "" };

      const result = await service.validateSessionIntegrity(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("Session ID is missing");
    });

    it("should identify missing session state", async () => {
      const invalidSession = { ...session, state: null as any };

      const result = await service.validateSessionIntegrity(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.canContinue).toBe(false);
      expect(result.issues).toContain("Session state is missing");
      expect(result.recommendations).toContain("Create new session");
    });

    it("should identify stale sessions", async () => {
      const staleSession = {
        ...session,
        state: {
          ...session.state,
          lastUpdate: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        },
      };

      const result = await service.validateSessionIntegrity(staleSession);

      expect(result.issues.some((issue) => issue.includes("stale"))).toBe(true);
      expect(
        result.recommendations.some((rec) =>
          rec.includes("creating a new session"),
        ),
      ).toBe(true);
    });

    it("should identify excessive errors", async () => {
      const errorSession = {
        ...session,
        errors: Array.from({ length: 15 }, (_, i) => ({
          error: `Error ${i}`,
          stage: "test-stage" as WorkflowStage,
          timestamp: new Date(),
        })),
      };

      const result = await service.validateSessionIntegrity(errorSession);

      expect(
        result.issues.some((issue) => issue.includes("excessive error count")),
      ).toBe(true);
      expect(
        result.recommendations.some((rec) => rec.includes("session reset")),
      ).toBe(true);
    });

    it("should identify stage history inconsistencies", async () => {
      const inconsistentSession = {
        ...session,
        state: {
          ...session.state,
          context: {
            ...session.state.context,
            currentStage: "code-generation" as WorkflowStage,
            stageHistory: ["requirement-analysis"] as WorkflowStage[], // missing code-generation
          },
        },
      };

      const result =
        await service.validateSessionIntegrity(inconsistentSession);

      expect(
        result.issues.some((issue) =>
          issue.includes("Current stage not found in stage history"),
        ),
      ).toBe(true);
      expect(
        result.recommendations.some((rec) =>
          rec.includes("Synchronize stage tracking"),
        ),
      ).toBe(true);
    });
  });

  describe("persistWorkflowState", () => {
    let state: WorkflowState;

    beforeEach(async () => {
      const session = await service.createWorkflowSession(
        { mode: "guided" },
        "Test request",
      );
      state = session.state;
    });

    it("should persist state successfully", async () => {
      const result = await service.persistWorkflowState(state);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(state.sessionId);
      expect(result.version).toBe(state.version);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should update lastUpdate timestamp on persistence", async () => {
      const originalTimestamp = state.lastUpdate;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.persistWorkflowState(state);

      const persistedState = (service as any).stateStorage.get(state.sessionId);
      expect(persistedState.lastUpdate.getTime()).toBeGreaterThan(
        originalTimestamp.getTime(),
      );
    });
  });

  describe("session management", () => {
    it("should get active sessions", async () => {
      const config: WorkflowConfiguration = { mode: "guided" };
      const session1 = await service.createWorkflowSession(config, "Request 1");
      const session2 = await service.createWorkflowSession(config, "Request 2");

      // Terminate one session
      await service.terminateSession(session2.sessionId);

      const activeSessions = service.getActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe(session1.sessionId);
    });

    it("should get session by ID", async () => {
      const config: WorkflowConfiguration = { mode: "autonomous" };
      const session = await service.createWorkflowSession(
        config,
        "Test request",
      );

      const retrievedSession = service.getSession(session.sessionId);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.sessionId).toBe(session.sessionId);
    });

    it("should return undefined for non-existent session", () => {
      const retrievedSession = service.getSession("non-existent-id");

      expect(retrievedSession).toBeUndefined();
    });

    it("should pause session", async () => {
      const session = await service.createWorkflowSession(
        { mode: "guided" },
        "Test",
      );

      const result = await service.pauseSession(session.sessionId);

      expect(result).toBe(true);

      const pausedSession = service.getSession(session.sessionId);
      expect(pausedSession?.isPaused).toBe(true);
    });

    it("should return false when pausing non-existent session", async () => {
      const result = await service.pauseSession("non-existent-id");

      expect(result).toBe(false);
    });

    it("should terminate session", async () => {
      const session = await service.createWorkflowSession(
        { mode: "guided" },
        "Test",
      );

      const result = await service.terminateSession(session.sessionId);

      expect(result).toBe(true);

      const terminatedSession = service.getSession(session.sessionId);
      expect(terminatedSession?.isActive).toBe(false);
      expect(terminatedSession?.canResume).toBe(false);
    });

    it("should return false when terminating non-existent session", async () => {
      const result = await service.terminateSession("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("cleanupOldSessions", () => {
    it("should clean up old inactive sessions", async () => {
      const config: WorkflowConfiguration = { mode: "guided" };
      const session1 = await service.createWorkflowSession(
        config,
        "Old session",
      );
      const session2 = await service.createWorkflowSession(
        config,
        "Recent session",
      );

      // Make session1 old and inactive
      await service.terminateSession(session1.sessionId);
      const oldSession = service.getSession(session1.sessionId)!;
      oldSession.state.lastUpdate = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      ); // 8 days ago
      (service as any).activeSessions.set(session1.sessionId, oldSession);

      const cleanedCount = await service.cleanupOldSessions(7 * 24); // 7 days

      expect(cleanedCount).toBe(1);
      expect(service.getSession(session1.sessionId)).toBeUndefined();
      expect(service.getSession(session2.sessionId)).toBeDefined();
    });

    it("should not clean up active sessions even if old", async () => {
      const config: WorkflowConfiguration = { mode: "guided" };
      const session = await service.createWorkflowSession(
        config,
        "Active old session",
      );

      // Make session old but keep it active
      const activeSession = service.getSession(session.sessionId)!;
      activeSession.state.lastUpdate = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      ); // 8 days ago
      activeSession.isActive = true;
      (service as any).activeSessions.set(session.sessionId, activeSession);

      const cleanedCount = await service.cleanupOldSessions(7 * 24); // 7 days

      expect(cleanedCount).toBe(0);
      expect(service.getSession(session.sessionId)).toBeDefined();
    });
  });
});
