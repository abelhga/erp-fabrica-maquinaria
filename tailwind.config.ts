import type { Config } from "tailwindcss";

// Los colores viven como variables CSS en index.css para que el modo oscuro
// sea solo cambiar variables, sin duplicar clases en cada componente.
const v = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        fondo: v("fondo"),
        superficie: v("superficie"),
        borde: v("borde"),
        texto: v("texto"),
        tenue: v("tenue"),
        marca: { DEFAULT: v("marca"), suave: v("marca-suave"), texto: v("marca-texto") },
        ok: { DEFAULT: v("ok"), suave: v("ok-suave") },
        aviso: { DEFAULT: v("aviso"), suave: v("aviso-suave") },
        peligro: { DEFAULT: v("peligro"), suave: v("peligro-suave") },
        info: { DEFAULT: v("info"), suave: v("info-suave") },
      },
      borderRadius: { xl: "0.875rem" },
      boxShadow: {
        tarjeta: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
