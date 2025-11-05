import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "*.config.ts",
        "src/types/",
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    env: {
      NODE_ENV: "test", // Explicitly set NODE_ENV for all tests to prevent mainnet endpoint usage
    },
    environment: "node",
    // Skip integration tests and all tool tests in CI
    // Tool tests can make network calls or have timeout testing scenarios
    exclude:
      process.env.CI === "true" || process.env.CI === true
        ? [
            "**/node_modules/**",
            "**/dist/**",
            "tests/integration/**/*.test.ts",
            "tests/unit/tools/**/*.test.ts",
          ]
        : ["**/node_modules/**", "**/dist/**"],
    globals: true,
    // Add stability configurations for CI environments
    hookTimeout: 30000,
    include: ["tests/**/*.test.ts"],
    // Use serial execution in CI to avoid process management issues
    ...((process.env.CI === "true" || process.env.CI === true) && {
      pool: "forks",
      poolOptions: {
        forks: {
          isolate: false,
          maxForks: 1,
          singleFork: true,
        },
      },
    }),
    ...(!(process.env.CI === "true" || process.env.CI === true) && {
      pool: "threads",
      poolOptions: {
        threads: {
          maxThreads: 1,
          singleThread: true,
        },
      },
    }),
    // Force sequential execution in CI
    sequence: {
      concurrent:
        process.env.CI === "true" || process.env.CI === true ? false : true,
    },
    // Add teardown timeout for CI stability
    teardownTimeout: 10000,
    testTimeout: 30000,
  },
});
