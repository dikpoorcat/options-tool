import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/2_options_calc/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/2_options_calc/api": {
        target: "http://127.0.0.1:8787",
        rewrite: (path) => path.replace(/^\/2_options_calc\/api/, "/api")
      },
      "/api": "http://127.0.0.1:8787"
    }
  }
});
