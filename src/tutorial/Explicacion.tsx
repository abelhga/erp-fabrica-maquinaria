import { useState, type ReactNode } from "react";
import { ChevronDown, GraduationCap, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utilidades";
import { useTutorial } from "./preferencia";
import { normalizarAyuda, type AyudaPantalla } from "./pantallas";

// Lo que cada quien ya leyó y cerró, por pantalla y por navegador: al volver ve una línea, no el recuadro.
const VISTO = "tutorial_visto:";
const leerVisto = (ruta: string) => { try { return localStorage.getItem(VISTO + ruta) === "si"; } catch { return false; } };
const guardarVisto = (ruta: string, v: boolean) => {
  try { if (v) localStorage.setItem(VISTO + ruta, "si"); else localStorage.removeItem(VISTO + ruta); } catch { /* modo privado */ }
};

/**
 * El recuadro de arriba de cada pantalla: una frase, hasta tres pasos y «Ver más» con el detalle.
 * Corto a propósito: lo demás se explica en el globo de cada cosa. «Ya entendí» lo deja en una línea
 * para esa pantalla (en este navegador) y se vuelve a abrir con un clic.
 */
export function AyudaDePantalla({ ayuda, ruta, className }: { ayuda: AyudaPantalla; ruta: string; className?: string }) {
  const { activo } = useTutorial();
  const [visto, setVisto] = useState(() => leerVisto(ruta));
  const [mas, setMas] = useState(false);
  if (!activo) return null;
  const a = normalizarAyuda(ayuda);
  if (visto) {
    return (
      <button type="button" onClick={() => { setVisto(false); guardarVisto(ruta, false); }}
        className={cn("no-imprimir inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info-suave px-3 py-1 text-xs text-info hover:border-info", className)}>
        <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />¿Cómo se usa esta pantalla?
      </button>
    );
  }
  return (
    <div className={cn("no-imprimir relative flex gap-3 rounded-xl border border-info/30 border-l-[3px] border-l-info bg-info-suave px-4 py-3 text-sm text-texto/85", className)}
         data-testid="explicacion">
      <GraduationCap className="h-4 w-4 mt-0.5 shrink-0 text-info" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2 pr-6">
        <p className="font-medium text-texto">{a.resumen}</p>
        {a.pasos && a.pasos.length > 0 && (
          <ol className="grid gap-1.5 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
            {a.pasos.map((p, i) => (
              <li key={p} className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info text-[11px] font-semibold text-white">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        )}
        {mas && a.detalle?.map((p) => <p key={p}>{p}</p>)}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {a.detalle && a.detalle.length > 0 && (
            <button type="button" onClick={() => setMas(!mas)} className="inline-flex items-center gap-1 font-medium text-info hover:underline" aria-expanded={mas}>
              {mas ? "Ver menos" : "Ver más"}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", mas && "rotate-180")} />
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-tenue"><HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />Lo marcado con ? se explica al pasar el mouse o al tocarlo.</span>
        </div>
      </div>
      <button type="button" onClick={() => { setVisto(true); guardarVisto(ruta, true); }} title="Ya entendí: dejarlo en una línea"
        aria-label="Ya entendí" className="absolute right-2 top-2 rounded-md p-1 text-tenue hover:bg-info/10 hover:text-texto">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Recuadro del modo tutorial: para qué sirve esto y cómo se usa, para quien va empezando. Solo se
 * dibuja con el modo encendido; apagado no deja ni un hueco. `Pagina` lo pone sola con el texto
 * de `pantallas/`; dentro de una pantalla sirve para explicar una sección o un diálogo.
 */
export function Explicacion({ children, className }: { children: ReactNode; className?: string }) {
  const { activo } = useTutorial();
  if (!activo) return null;
  return (
    <div className={cn("no-imprimir flex gap-3 rounded-xl border border-info/30 border-l-[3px] border-l-info bg-info-suave px-4 py-3 text-sm text-texto/85", className)}
         data-testid="explicacion">
      <GraduationCap className="h-4 w-4 mt-0.5 shrink-0 text-info" aria-hidden="true" />
      <div className="space-y-1.5 min-w-0">{children}</div>
    </div>
  );
}

/** Botón del encabezado: prende y apaga el modo tutorial en este navegador. */
export function BotonTutorial() {
  const { activo, cambiar } = useTutorial();
  return (
    <button
      type="button"
      onClick={() => cambiar(!activo)}
      aria-pressed={activo}
      className={cn("p-2 rounded-lg", activo ? "bg-info-suave text-info" : "hover:bg-fondo text-tenue")}
      aria-label={activo ? "Apagar modo tutorial" : "Encender modo tutorial"}
      title={activo
        ? "Modo tutorial encendido: cada pantalla dice para qué sirve y lo marcado con ? se explica al pasar el mouse. Clic para apagarlo."
        : "Modo tutorial: explica cada pantalla y cada dato al pasar el mouse."}
    >
      <GraduationCap className="h-5 w-5" />
    </button>
  );
}
