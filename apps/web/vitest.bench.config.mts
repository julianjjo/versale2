import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import codspeedPlugin from "@codspeed/vitest-plugin";
import path from "path";

// Benchmarks live in their own config so the unit-test run stays untouched:
// `npm test` keeps using vitest.config.ts, `npm run bench` uses this one.
export default defineConfig({
  plugins: [react(), codspeedPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [],
    benchmark: {
      include: ["bench/**/*.bench.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
