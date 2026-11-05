import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { include: ["src/**"], reporter: ["text-summary"] },
    projects: [
      { test: { name: "unit", include: ["test/unit/**/*.test.ts"] } },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          globalSetup: ["test/integration/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 90_000,
        },
      },
    ],
  },
});
