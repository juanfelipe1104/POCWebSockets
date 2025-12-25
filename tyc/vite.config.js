import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.js"),
      name: "SYEComponents",
      fileName: () => "sye-tyc.js",
      formats: ["es"]
    },
    sourcemap: false,
    minify: "esbuild",
    target: "es2019",
    emptyOutDir: true
  }
});
