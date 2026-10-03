import { CheckCircle2, CircleDashed, CircleDot, MinusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/utilidades";
import { fechaYHora } from "@/lib/formato";
import type { PasoValidacion } from "./datos";

const ESTILO: Record<PasoValidacion["estado"], { icono: typeof CheckCircle2; clase: string; texto: string }> = {
  hecho: { icono: CheckCircle2, clase: "text-ok", texto: "Hecho" },
  parcial: { icono: CircleDot, clase: "text-aviso", texto: "Con faltantes" },
  pendiente: { icono: CircleDashed, clase: "text-tenue", texto: "Pendiente" },
  no_aplica: { icono: MinusCircle, clase: "text-tenue", texto: "No hizo falta" },
};

export interface AccionPaso { texto: string; alClic: () => void; cargando?: boolean; deshabilitado?: string | false; secundaria?: boolean }

/**
 * Los pasos de la hoja de validación (técnico → almacén → compras → salida),
 * ahora con nombre y hora de quien los hizo. Cada rol ve el botón de su paso.
 */
export function PasosValidacion({ pasos, acciones }: { pasos: PasoValidacion[]; acciones: Partial<Record<PasoValidacion["paso"], AccionPaso | null>> }) {
  return (
    <ol className="grid gap-px rounded-xl overflow-hidden border border-borde bg-borde sm:grid-cols-2 lg:grid-cols-5">
      {pasos.map((p, i) => {
        const e = ESTILO[p.estado];
        const a = acciones[p.paso];
        return (
          <li key={p.paso} className="bg-superficie p-4 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0",
                p.estado === "hecho" ? "bg-ok text-white" : p.estado === "parcial" ? "bg-aviso text-white" : "bg-fondo text-tenue border border-borde")}>
                {i + 1}
              </span>
              <p className="font-medium text-sm leading-tight">{p.titulo}</p>
            </div>
            <p className={cn("flex items-center gap-1.5 text-sm", e.clase)}><e.icono className="h-4 w-4" />{e.texto}</p>
            <div className="text-xs text-tenue space-y-0.5 flex-1">
              {p.por && <p className="text-texto">{p.por}</p>}
              {p.en && <p className="cifra">{fechaYHora(p.en)}</p>}
              {p.detalle && <p>{p.detalle}</p>}
            </div>
            {a && (
              <Boton tamano="sm" variante={a.secundaria ? "secundario" : "primario"} onClick={a.alClic} cargando={a.cargando}
                     disabled={!!a.deshabilitado} title={a.deshabilitado || undefined} className="self-start">
                {a.texto}
              </Boton>
            )}
          </li>
        );
      })}
    </ol>
  );
}
