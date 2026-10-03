import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173, host: true },
  build: {
    // Recharts y Supabase pesan; partirlos evita que la primera carga baje todo de golpe.
    rollupOptions: {
      output: {
        manualChunks: {
          graficas: ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
} as any);
