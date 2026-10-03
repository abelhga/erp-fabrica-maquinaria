import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utilidades";

/** Celda que guarda al salir o con Enter (como en la hoja de cálculo). Solo manda el cambio si cambió. */
export function CeldaTexto({ valor, alGuardar, tipo = "text", deshabilitado, className, paso, placeholder, ariaLabel }: {
  valor: string | number | null | undefined; alGuardar: (v: string) => void; tipo?: "text" | "number" | "color";
  deshabilitado?: boolean; className?: string; paso?: string; placeholder?: string; ariaLabel?: string;
}) {
  const [v, setV] = useState(valor == null ? "" : String(valor));
  useEffect(() => setV(valor == null ? "" : String(valor)), [valor]);
  const guardar = () => { if (v !== (valor == null ? "" : String(valor))) alGuardar(v); };
  if (tipo === "color") {
    return <input type="color" aria-label={ariaLabel} disabled={deshabilitado} value={v || "#64748b"}
      onChange={(e) => setV(e.target.value)} onBlur={guardar}
      className={cn("h-8 w-10 rounded-md border border-borde bg-superficie p-0.5 cursor-pointer disabled:cursor-default", className)} />;
  }
  return (
    <input type={tipo} step={paso} aria-label={ariaLabel} placeholder={placeholder} disabled={deshabilitado} value={v}
      onChange={(e) => setV(e.target.value)} onBlur={guardar}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setV(valor == null ? "" : String(valor)); }}
      className={cn("campo h-8 disabled:bg-transparent disabled:border-transparent disabled:opacity-100", tipo === "number" && "cifra text-right", className)} />
  );
}

export function CeldaCheck({ valor, alCambiar, deshabilitado, ariaLabel }: { valor: boolean; alCambiar: (v: boolean) => void; deshabilitado?: boolean; ariaLabel?: string }) {
  return <input type="checkbox" aria-label={ariaLabel} className="h-4 w-4 accent-[hsl(var(--marca))]" checked={valor} disabled={deshabilitado} onChange={(e) => alCambiar(e.target.checked)} />;
}

/** Aviso de solo lectura que dice quién sí puede cambiar la sección. */
export function SoloLectura({ quien }: { quien: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs text-tenue rounded-lg border border-borde bg-fondo px-3 py-2">
      <Lock className="h-3.5 w-3.5 shrink-0" /> Solo lectura: esto lo cambia {quien}.
    </p>
  );
}
