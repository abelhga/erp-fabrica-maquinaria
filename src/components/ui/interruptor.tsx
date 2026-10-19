import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utilidades";

/**
 * Un sí/no que se cambia con un clic (o con espacio). Es un botón con role="switch" para
 * que el lector de pantalla diga "activado / desactivado". Quien no puede cambiarlo no
 * debería verlo deshabilitado: muéstrale el estado como texto o insignia.
 */
export const Interruptor = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  activo: boolean; alCambiar: (v: boolean) => void; cargando?: boolean;
}>(({ activo, alCambiar, cargando, className, onClick, ...p }, ref) => (
  <button ref={ref} type="button" role="switch" aria-checked={activo} aria-busy={cargando || undefined}
    onClick={(e) => { onClick?.(e); if (!e.defaultPrevented && !cargando) alCambiar(!activo); }}
    className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50", activo ? "bg-ok" : "bg-borde", cargando && "opacity-60", className)}
    {...p}>
    <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", activo ? "translate-x-4" : "translate-x-0")} />
  </button>
));
Interruptor.displayName = "Interruptor";
