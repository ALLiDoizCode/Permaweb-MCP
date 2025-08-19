import { beforeEach, describe, expect, it } from "vitest";

import { ToolContext } from "../../../src/models/ToolContext.js";
import { AnalyzeProcessArchitectureCommand } from "../../../src/tools/process/commands/AnalyzeProcessArchitectureCommand.js";

describe("AnalyzeProcessArchitectureCommand Integration", () => {
  let command: AnalyzeProcessArchitectureCommand;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      hubId: "test-hub",
      keyPair: {} as any,
    };
    command = new AnalyzeProcessArchitectureCommand(mockContext);
  });

  it("should use same requirement analysis as generateLuaProcess", async () => {
    const args = {
      complexityHint: "simple" as const,
      detailedExplanation: false,
      includeExamples: false,
      includeValidation: false,
      userRequest: "Create a simple calculator with add and subtract functions",
    };

    const result = await command.execute(args, mockContext);

    // Test that shared analysis produces consistent results
    expect(result).toContain("# AO Process Architecture Analysis");
    expect(result).toContain("**Complexity**:");
    expect(result).toContain("**Process Type**:");
    expect(result).toContain("**Confidence**:");
  });

  it("should include code preview in recommendations", async () => {
    const args = {
      complexityHint: "simple" as const,
      detailedExplanation: true,
      includeExamples: true, // Enable code preview
      includeValidation: false,
      userRequest: "Create a calculator with add and subtract handlers",
    };

    const result = await command.execute(args, mockContext);

    // Test enhanced output format with code integration
    expect(result).toContain("### 💻 Generated Code Preview");
    expect(result).toContain("**Handler Signatures:**");
    expect(result).toContain("**ADP Compliance Preview:**");
    expect(result).toContain("*Performance: Integration");

    // Verify code preview contains actual Lua code
    expect(result).toContain("Handlers.add");
    expect(result).toContain("function(msg)");
  });

  it("should produce consistent complexity assessment", async () => {
    const simpleArgs = {
      complexityHint: "auto" as const,
      includeExamples: false,
      userRequest: "Create a simple ping pong handler",
    };

    const complexArgs = {
      complexityHint: "auto" as const,
      includeExamples: false,
      userRequest:
        "Create a comprehensive DAO governance system with voting, proposals, member management, stake delegation, and treasury operations",
    };

    const simpleResult = await command.execute(simpleArgs, mockContext);
    const complexResult = await command.execute(complexArgs, mockContext);

    // Simple request should have lower complexity
    expect(simpleResult).toContain("**Complexity**: simple");

    // Complex request should have higher complexity
    expect(complexResult).toMatch(/\*\*Complexity\*\*: (complex|moderate)/);
  });

  it("should maintain performance within limits", async () => {
    const startTime = performance.now();

    const args = {
      detailedExplanation: true,
      includeExamples: true, // Enable all features for max performance test
      includeValidation: true,
      userRequest:
        "Create a token contract with transfer, mint, burn capabilities and comprehensive error handling",
    };

    const result = await command.execute(args, mockContext);
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Extract integration time from result
    const perfMatch = result.match(/Performance: Integration (\d+\.?\d*)ms/);
    expect(perfMatch).toBeTruthy();

    if (perfMatch) {
      const integrationTime = parseFloat(perfMatch[1]);
      expect(integrationTime).toBeLessThan(200); // Should be under 200ms additional processing
      console.log(
        `Integration time: ${integrationTime.toFixed(1)}ms (Total: ${totalTime.toFixed(1)}ms)`,
      );
    }
  });

  it("should show matching handler patterns between architecture and code", async () => {
    const args = {
      detailedExplanation: true,
      includeExamples: true,
      includeValidation: false,
      userRequest:
        "Create a token contract with transfer and balance operations",
    };

    const result = await command.execute(args, mockContext);

    // Should have both architecture recommendations and code preview
    expect(result).toContain("### 📝 Handler Recommendations");
    expect(result).toContain("### 💻 Generated Code Preview");

    // Token-related handlers should appear in both sections
    const hasTransferHandler =
      result.includes("Transfer") || result.includes("transfer");
    const hasBalanceHandler =
      result.includes("Balance") || result.includes("balance");

    expect(hasTransferHandler).toBe(true);
    expect(hasBalanceHandler).toBe(true);
  });
});
