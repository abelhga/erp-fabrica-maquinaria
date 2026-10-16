import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { Boton } from "@/components/ui/boton";
import { GLOSARIO } from "@/tutorial/glosario";

export interface Estimacion {
  equipos: number; dias_estandar: number | null; fecha_estandar: string | null; sin_dias: string[];
  dias_carga: number | null; fecha_carga: string | null; cuello: string | null; semanas_cola: number; cuello_cola: string | null;
  dias_propuestos: number | null; fecha_propuesta: string | null;
  etapas: { etapa: string; semanas_cola: number; semanas: number }[];
}

/**
 * La fecha realista de lo que se fabrica: su tiempo estándar o lo que tarda la fila
 * del taller con este equipo al final, lo que sea más tarde. La calcula la base.
 */
export function useEstimacionEntrega(partidas: { articulo_id: string | null; cantidad: number; opcional?: boolean }[], activo = true) {
  const lineas = partidas.filter((p) => p.articulo_id && !p.opcional).map((p) => ({ articulo_id: p.articulo_id, cantidad: Number(p.cantidad) || 1 }));
  const llave = lineas.map((l) => `${l.articulo_id}:${l.cantidad}`).sort().join(",");
  return useQuery({
    queryKey: ["estimar_entrega", llave],
    enabled: activo,
    staleTime: 5 * 60_000,
    queryFn: () => q<Estimacion>(supabase.rpc("estimar_entrega", { p_lineas: lineas })),
  });
}

/** Lo que promete el texto de la cotización ("45 días hábiles…"), en días hábiles. */
export function diasPrometidos(texto: string | null | undefined) {
  const m = texto?.match(/(\d+)\s*d[ií]as?\s*(h[áa]biles)?/i);
  if (!m) return null;
  return m[2] ? Number(m[1]) : Math.floor(Number(m[1]) * 5 / 7);
}

/** Debajo de "Tiempo de entrega" en la cotización: lo realista hoy, y un clic para usarlo. */
export function EntregaRealista({ e, prometido, editable, alUsar }: {
  e: Estimacion | undefined; prometido: string | null; editable: boolean; alUsar: (texto: string) => void;
}) {
  if (!e || !e.equipos || !e.dias_propuestos) return null;
  const dias = diasPrometidos(prometido);
  const corto = dias != null && dias < e.dias_propuestos;
  const porFila = (e.dias_carga ?? 0) > (e.dias_estandar ?? 0);
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm space-y-1.5 ${corto ? "border-aviso/40 bg-aviso-suave" : "border-borde bg-fondo"}`}
      data-explain={GLOSARIO.entregaRealista} data-explain-title="Entrega realista">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CalendarClock className="h-4 w-4 text-tenue shrink-0" />
        <span>Con el taller como está hoy sale el <b>{fecha(e.fecha_propuesta)}</b> <span className="text-tenue">({e.dias_propuestos} días hábiles)</span>.</span>
        {editable && !(dias === e.dias_propuestos) && (
          <Boton tamano="sm" variante="secundario" className="h-7 ml-auto" onClick={() => alUsar(`${e.dias_propuestos} días hábiles`)}>
            Usar {e.dias_propuestos} días hábiles
          </Boton>
        )}
      </p>
      <p className="text-xs text-tenue">
        {porFila
          ? <>El taller trae {numero(e.semanas_cola)} semanas de trabajo en {e.cuello?.toLowerCase()}; este pedido entra al final de la fila.</>
          : <>El taller tiene lugar: manda el tiempo de fabricación del equipo{e.dias_estandar ? ` (${e.dias_estandar} días hábiles)` : ""}.</>}
        {e.sin_dias.length > 0 && <> Sin tiempo de fabricación capturado: {e.sin_dias.join(", ")}.</>}
      </p>
      {corto && <p className="text-xs font-medium text-aviso">Estás prometiendo {dias} días hábiles: con la carga de hoy no sale a tiempo.</p>}
    </div>
  );
}
