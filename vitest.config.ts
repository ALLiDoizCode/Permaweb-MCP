import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Bail on first test failure in CI for faster feedback
    bail: process.env.CI ? 1 : 0,
    coverage: {
      enabled: process.env.COVERAGE === "true", // Disable coverage by default
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "*.config.ts",
        "src/types/",
      ],
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
      thresholds: {
        branches: 75,
        functions: 90,
        lines: 85,
        statements: 85,
      },
    },
    env: {
      NODE_ENV: "test", // Explicitly set NODE_ENV for all tests to prevent mainnet endpoint usage
    },
    environment: "node",
    globals: true,
    // Optimized configurations for different test scenarios
    hookTimeout: process.env.CI ? 10000 : 20000, // Faster timeout for quicker failure detection
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: process.env.CI ? 4 : 8, // Increase parallel workers for better performance
        singleFork: false, // Enable parallel execution for faster test runs
      },
    },
    // Fix deprecated reporter configuration
    reporters: process.env.CI
      ? ["dot", "json", "junit"] // Minimal output for CI
      : [["default", { summary: true }]], // Detailed for local dev
    setupFiles: ["./tests/setup.ts"],
    testTimeout: process.env.CI ? 8000 : 15000, // Faster timeout in CI for quicker feedback
  },
});
