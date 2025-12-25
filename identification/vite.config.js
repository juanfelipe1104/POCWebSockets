import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      name: "SYEIdentificationComponent",
      formats: ["iife"],
      fileName: () => "sye-identification.min.js"
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      format: { comments: false }
    }
  }
});
