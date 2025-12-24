import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/device-fingerprint.js",
      name: "SYEFingerprint",
      formats: ["es"],
      fileName: () => "device-fingerprint.min.js"
    },
    sourcemap: false,      // false = más pequeño
    minify: "esbuild",     // rápido y buen minify
    target: "es2020",      // ajusta si necesitas soportar navegadores más viejos
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // fuerza un único chunk
        inlineDynamicImports: true
      }
    }
  }
});
