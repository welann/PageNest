import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@app": resolve(__dirname, "src/app"),
      "@components": resolve(__dirname, "src/components"),
      "@features": resolve(__dirname, "src/features"),
      "@modules": resolve(__dirname, "src/modules"),
      "@server": resolve(__dirname, "src/server"),
      "@services": resolve(__dirname, "src/services"),
      "@shared": resolve(__dirname, "src/shared")
    }
  }
});
