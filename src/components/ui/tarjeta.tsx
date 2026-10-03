import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("tarjeta", className)}>{children}</div>;
}

export function EncabezadoTarjeta({ titulo, descripcion, acciones, className }: {
  titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="font-semibold leading-tight">{titulo}</h3>
        {descripcion && <p className="text-sm text-tenue mt-0.5">{descripcion}</p>}
      </div>
      {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
    </div>
  );
}
