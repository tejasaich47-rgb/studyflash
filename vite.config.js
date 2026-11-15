import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only ever talks to /api/*, which Vite forwards to the small
// Express server. The LLM API key lives in that server's environment and
// never reaches the browser bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
