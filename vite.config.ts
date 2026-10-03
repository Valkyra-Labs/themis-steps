import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from GitHub Pages under /themis-steps/.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/themis-steps/" : "/",
  plugins: [react()],
  // Stoa and the engine are linked from sibling repositories during
  // development and have their own node_modules: without dedupe the app would run two copies of
  // React and fail with "Invalid hook call".
  resolve: { dedupe: ["react", "react-dom", "react-aria-components"] },
  worker: { format: "es" },
  server: { fs: { allow: [".."] } },
});
