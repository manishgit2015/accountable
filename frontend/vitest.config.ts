// Frontend unit and component tests: jsdom and Testing Library (spec 13.1, 13.2).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    // NFR-15, V-U01: a unit test over 1 second fails (src/test/setup.ts checks synchronous ones too).
    testTimeout: 1000,
    // Measured over every source file, not only the ones a test imports (`npm run check`, ENG-7).
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx"],
      reporter: ["text-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
