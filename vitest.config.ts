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
    globals: true,
    // Add stability configurations for CI environments
    hookTimeout: 30000,
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30000,
  },
});
