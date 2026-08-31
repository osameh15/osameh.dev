import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Absolute root asset URLs are required for direct project routes such as
  // /projects/Mizekar, which are server-rendered for social crawlers.
  base: "/",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    cssMinify: true,
    reportCompressedSize: true,
  },
});
