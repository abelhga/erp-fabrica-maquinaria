import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Identifica cada publicación: la app compara la suya con /version.json para saber si hay una
// nueva (lib/instalada.ts). En Cloudflare es el commit; en local, la hora de la compilación.
const VERSION = process.env.CF_PAGES_COMMIT_SHA ?? String(Date.now());

export default defineConfig({
  plugins: [react(), {
    name: "version-json",
    generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: VERSION }) }); },
  }],
  define: { __VERSION__: JSON.stringify(VERSION) },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    host: true,
    // Las copias de trabajo de git (.claude/worktrees) viven dentro del proyecto:
    // sin esto Vite las vigila y las rastrea como entradas, y termina cargando
    // React dos veces ("Invalid hook call"). Solo la .claude de la raíz: con
    // "**/.claude/**", un Vite levantado DENTRO de una copia ignoraba todos sus
    // archivos (su ruta contiene .claude) y no recargaba nada al editar.
    watch: { ignored: [path.resolve(__dirname, ".claude") + "/**", "**/capturas/**"] },
  },
  optimizeDeps: { entries: ["index.html"] },
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
  test: { environment: "node", include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"] },
} as any);
