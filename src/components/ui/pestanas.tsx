import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

export const Pestanas = T.Root;
export const ContenidoPestana = T.Content;

export function ListaPestanas({ opciones, className }: {
  opciones: { valor: string; texto: ReactNode; cuenta?: number }[]; className?: string;
}) {
  return (
    <T.List className={cn("flex gap-1 border-b border-borde overflow-x-auto", className)}>
      {opciones.map((o) => (
        <T.Trigger
          key={o.valor}
          value={o.valor}
          className="px-3 py-2 text-sm font-medium text-tenue border-b-2 border-transparent -mb-px whitespace-nowrap data-[state=active]:text-marca-texto data-[state=active]:border-marca hover:text-texto"
        >
          {o.texto}
          {o.cuenta != null && <span className="ml-1.5 rounded-full bg-fondo px-1.5 text-xs cifra">{o.cuenta}</span>}
        </T.Trigger>
      ))}
    </T.List>
  );
}
