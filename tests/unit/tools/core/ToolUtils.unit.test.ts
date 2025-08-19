import { beforeEach, describe, expect, it } from "vitest";

import {
  clearInitializationPending,
  getCurrentInitializationTool,
  getInitializationDuration,
  getInitializationState,
  isInitializationPending,
  isInitializationTool,
  markInitializationComplete,
  markInitializationPending,
} from "../../../../src/tools/core/ToolUtils.js";

describe("ToolUtils - Sequential Execution", () => {
  beforeEach(() => {
    // Clear any pending state before each test
    clearInitializationPending("generateKeypair");
    clearInitializationPending("createHub");
    clearInitializationPending("initializeHub");
  });

  describe("isInitializationTool", () => {
    it("should identify initialization tools correctly", () => {
      expect(isInitializationTool("generateKeypair")).toBe(true);
      expect(isInitializationTool("createHub")).toBe(true);
      expect(isInitializationTool("initializeHub")).toBe(true);
    });

    it("should return false for non-initialization tools", () => {
      expect(isInitializationTool("addMemory")).toBe(false);
      expect(isInitializationTool("createProcess")).toBe(false);
      expect(isInitializationTool("queryMessages")).toBe(false);
    });
  });

  describe("initialization state management", () => {
    it("should start with no pending initialization", () => {
      const state = getInitializationState();
      expect(state.pending).toBe(false);
      expect(state.currentTool).toBeUndefined();
      expect(state.startTime).toBeUndefined();
    });

    it("should mark initialization as pending", () => {
      markInitializationPending("generateKeypair");

      const state = getInitializationState();
      expect(state.pending).toBe(true);
      expect(state.currentTool).toBe("generateKeypair");
      expect(state.startTime).toBeDefined();
    });

    it("should not mark non-initialization tools as pending", () => {
      markInitializationPending("addMemory");

      const state = getInitializationState();
      expect(state.pending).toBe(false);
    });

    it("should mark initialization as complete", () => {
      markInitializationPending("createHub");
      expect(getInitializationState().pending).toBe(true);

      markInitializationComplete("createHub");
      expect(getInitializationState().pending).toBe(false);
    });

    it("should only complete the current tool", () => {
      markInitializationPending("generateKeypair");
      expect(getInitializationState().currentTool).toBe("generateKeypair");

      // Trying to complete a different tool should not clear the state
      markInitializationComplete("createHub");
      expect(getInitializationState().pending).toBe(true);
      expect(getInitializationState().currentTool).toBe("generateKeypair");

      // Completing the correct tool should clear the state
      markInitializationComplete("generateKeypair");
      expect(getInitializationState().pending).toBe(false);
    });

    it("should clear pending initialization", () => {
      markInitializationPending("initializeHub");
      expect(getInitializationState().pending).toBe(true);

      clearInitializationPending("initializeHub");
      expect(getInitializationState().pending).toBe(false);
    });

    it("should only clear the current tool", () => {
      markInitializationPending("generateKeypair");
      expect(getInitializationState().pending).toBe(true);

      // Trying to clear a different tool should not affect the state
      clearInitializationPending("createHub");
      expect(getInitializationState().pending).toBe(true);

      // Clearing the correct tool should work
      clearInitializationPending("generateKeypair");
      expect(getInitializationState().pending).toBe(false);
    });
  });

  describe("helper functions", () => {
    it("should check if initialization is pending", () => {
      expect(isInitializationPending()).toBe(false);

      markInitializationPending("createHub");
      expect(isInitializationPending()).toBe(true);

      markInitializationComplete("createHub");
      expect(isInitializationPending()).toBe(false);
    });

    it("should get current initialization tool", () => {
      expect(getCurrentInitializationTool()).toBeUndefined();

      markInitializationPending("initializeHub");
      expect(getCurrentInitializationTool()).toBe("initializeHub");

      markInitializationComplete("initializeHub");
      expect(getCurrentInitializationTool()).toBeUndefined();
    });

    it("should calculate initialization duration", () => {
      expect(getInitializationDuration()).toBeUndefined();

      const startTime = Date.now();
      markInitializationPending("generateKeypair");

      // Wait a small amount
      setTimeout(() => {
        const duration = getInitializationDuration();
        expect(duration).toBeDefined();
        expect(duration!).toBeGreaterThanOrEqual(0);
      }, 10);

      markInitializationComplete("generateKeypair");
      expect(getInitializationDuration()).toBeUndefined();
    });
  });

  describe("sequential execution flow", () => {
    it("should handle complete initialization lifecycle", () => {
      // Start with clean state
      expect(isInitializationPending()).toBe(false);

      // Mark as pending
      markInitializationPending("generateKeypair");
      expect(isInitializationPending()).toBe(true);
      expect(getCurrentInitializationTool()).toBe("generateKeypair");

      // Complete successfully
      markInitializationComplete("generateKeypair");
      expect(isInitializationPending()).toBe(false);
      expect(getCurrentInitializationTool()).toBeUndefined();
    });

    it("should handle error during initialization", () => {
      // Start initialization
      markInitializationPending("createHub");
      expect(isInitializationPending()).toBe(true);

      // Simulate error by clearing instead of completing
      clearInitializationPending("createHub");
      expect(isInitializationPending()).toBe(false);
      expect(getCurrentInitializationTool()).toBeUndefined();
    });
  });
});
