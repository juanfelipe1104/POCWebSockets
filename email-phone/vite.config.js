import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/sye-email-phone.js",
      name: "SYE_EMAIL_PHONE",
      fileName: (format) => `sye-email-phone.${format}.js`,
      formats: ["es", "umd"]
    },
    sourcemap: true
  }
});
