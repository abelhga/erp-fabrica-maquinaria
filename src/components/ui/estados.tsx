import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utilidades";

export function Vacio({ icono: Icono, titulo, texto, accion, className }: {
  icono: LucideIcon; titulo: string; texto?: ReactNode; accion?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6", className)}>
      <div className="h-12 w-12 rounded-full bg-marca-suave text-marca flex items-center justify-center mb-3">
        <Icono className="h-6 w-6" />
      </div>
      <p className="font-medium">{titulo}</p>
      {texto && <p className="text-sm text-tenue mt-1 max-w-sm">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Cargando({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="h-8 rounded-md bg-fondo animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorCarga({ error }: { error: unknown }) {
  return (
    <div className="m-4 rounded-lg border border-peligro/30 bg-peligro-suave p-4 text-sm text-peligro flex gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{error instanceof Error ? error.message : "No se pudo cargar la información."}</span>
    </div>
  );
}
