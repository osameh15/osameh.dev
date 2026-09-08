import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend is the build root. Backend PHP is assembled into the same
// artifact afterwards by scripts/ensure-deploy-files.mjs, so the public runtime
// contract - dist/ mirrored into the document root - is unchanged.
export default defineConfig({
  root: "frontend",
  publicDir: "public",
  // Absolute root asset URLs are required for direct project routes such as
  // /projects/Mizekar, which are server-rendered for social crawlers.
  base: "/",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    cssMinify: true,
    reportCompressedSize: true,
  },
});
