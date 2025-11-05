import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  perfectionist.configs["recommended-alphabetical"],
  eslintConfigPrettier,
  {
    ignores: ["**/*.js", "**/*.mjs", "dashboard/.svelte-kit/**/*"],
  },
  {
    files: [
      "src/services/**/*.ts",
      "src/tools/process/commands/*.ts",
      "src/tools/core/ContextHelpers.ts",
      "src/models/WorkflowMemory.ts",
      "tests/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-case-declarations": "warn",
      "no-control-regex": "warn",
    },
  },
);
