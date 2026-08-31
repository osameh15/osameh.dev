import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs keep the production build portable and also allow
  // dist/index.html to load its JS/CSS when opened directly for a quick check.
  // On osameh.dev the app is still deployed at the domain root.
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    cssMinify: true,
    reportCompressedSize: true,
  },
});
