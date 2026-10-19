import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

export const Pestanas = T.Root;
export const ContenidoPestana = T.Content;

export function ListaPestanas({ opciones, className }: {
  /** `explica`: qué hay en esa pestaña, para el modo tutorial. */
  opciones: { valor: string; texto: ReactNode; cuenta?: number; explica?: string }[]; className?: string;
}) {
  // shrink-0: sin él, Safari encoge las pestañas cuando no caben y los textos se enciman
  // ("Por empacar 0 H… En cami…") en lugar de dejar que la fila se desplace.
  return (
    <T.List className={cn("flex gap-1 border-b border-borde overflow-x-auto", className)}>
      {opciones.map((o) => (
        <T.Trigger
          key={o.valor}
          value={o.valor}
          data-explain={o.explica}
          className="shrink-0 px-3 py-2 text-sm font-medium text-tenue border-b-2 border-transparent -mb-px whitespace-nowrap data-[state=active]:text-marca-texto data-[state=active]:border-marca hover:text-texto"
        >
          {o.texto}
          {o.cuenta != null && <span className="ml-1.5 rounded-full bg-fondo px-1.5 text-xs cifra">{o.cuenta}</span>}
        </T.Trigger>
      ))}
    </T.List>
  );
}
