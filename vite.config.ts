import { defineConfig, loadEnv } from "vite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Identifica cada publicación: la app compara la suya con /version.json para saber si hay una
// nueva (lib/instalada.ts). En Cloudflare es el commit; en local, la hora de la compilación.
const VERSION = process.env.CF_PAGES_COMMIT_SHA ?? String(Date.now());

export default defineConfig(({ mode }) => {
// Construido para otra empresa (VITE_EMPRESA, ver src/lib/marca.ts), el título de la pestaña y el
// nombre de la app instalada dicen el suyo: index.html y los manifiestos traen "Hegamex" escrito.
const EMPRESA = loadEnv(mode, process.cwd(), "VITE_").VITE_EMPRESA?.trim();
const conEmpresa = (texto: string) => (EMPRESA ? texto.replace(/Hegamex/g, EMPRESA) : texto);

return {
  plugins: [react(), {
    name: "version-json",
    generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: VERSION }) }); },
  }, {
    name: "marca",
    transformIndexHtml: conEmpresa,
    writeBundle(opciones) {
      if (!EMPRESA) return;
      for (const m of ["manifest.webmanifest", "manifest-terminal.webmanifest"]) {
        const ruta = path.join(opciones.dir ?? "dist", m);
        if (existsSync(ruta)) writeFileSync(ruta, conEmpresa(readFileSync(ruta, "utf8")));
      }
    },
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
} as any;
});
