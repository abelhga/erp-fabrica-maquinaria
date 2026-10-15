import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utilidades";
import { useTutorial } from "./preferencia";

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
