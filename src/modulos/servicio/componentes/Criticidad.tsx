import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { CLAVE, CRITICIDAD, IMPACTO_PRODUCCION, RIESGO_SEGURIDAD, type FactoresCriticidad, type Maquina } from "../datos";
import { GLOSARIO } from "@/tutorial/glosario";

// Escalones sin montos: la tarjeta la ve el taller, que no ve lo que cuestan las reparaciones.
const COSTO = { minimo: "Casi nada", bajo: "Bajo", medio: "Medio", alto: "Alto" } as const;

/**
 * Por qué la máquina tiene la criticidad que tiene: cada factor con sus puntos. Lo calcula la base
 * (criticidad_factores); el costo llega como escalón para que quien no ve costos no vea el monto.
 */
export function TarjetaCriticidad({ m, alEditar }: { m: Maquina; alEditar?: () => void }) {
  const f = useQuery({
    queryKey: [...CLAVE, "maquina", m.id, "criticidad", m.criticidad_puntos, m.impacto_produccion, m.riesgo_seguridad, m.fallas_12m],
    queryFn: () => q<FactoresCriticidad>(supabase.rpc("criticidad_factores", { p_maquina: m.id })),
  });
  const d = f.data;
  const factor = <K extends FactoresCriticidad["factores"][number]["clave"]>(k: K) =>
    d?.factores.find((x) => x.clave === k) as Extract<FactoresCriticidad["factores"][number], { clave: K }> | undefined;
  const imp = factor("impacto"), seg = factor("seguridad"), fal = factor("fallas"), cos = factor("costo"), res = factor("respaldo"), ref = factor("refaccion");

  const fila = (titulo: string, explica: string, texto: React.ReactNode, puntos?: number, maximo?: number) => (
    <li className="py-2 flex items-center gap-3" data-explain={explica} data-explain-title={titulo}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-tenue">{texto}</p>
      </div>
      {maximo != null && (
        <div className="w-24 shrink-0">
          <div className="h-1.5 rounded-full bg-fondo overflow-hidden"><div className="h-full rounded-full bg-marca" style={{ width: `${((puntos ?? 0) / maximo) * 100}%` }} /></div>
          <p className="text-[11px] text-tenue text-right cifra mt-0.5">{puntos} de {maximo}</p>
        </div>
      )}
    </li>
  );

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Criticidad" explica={GLOSARIO.criticidadMaquina}
        descripcion={d?.completa ? `${d.puntos} de ${d.maximo} puntos · se calcula sola` : "Falta calificar si se para y el riesgo"}
        acciones={<div className="flex items-center gap-2">
          {m.criticidad && <Insignia tono={CRITICIDAD[m.criticidad].tono}>{CRITICIDAD[m.criticidad].texto}</Insignia>}
          {alEditar && <Boton variante="fantasma" tamano="sm" onClick={alEditar} aria-label="Calificar"><Pencil className="h-3.5 w-3.5" /></Boton>}
        </div>} />
      <div className="px-5 pb-4">
        {f.isLoading || !d ? <Cargando filas={3} /> : (
          <>
            {!d.completa && (
              <p className="mb-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm">
                {m.criticidad ? `Mientras, se queda la de la hoja (${CRITICIDAD[m.criticidad].texto.toLowerCase()}). ` : ""}
                Califica qué pasa si se para y su riesgo de seguridad{alEditar ? " con el lápiz" : ""}, y desde ahí se calcula sola.
              </p>
            )}
            <ul className={cn("divide-y divide-borde/60", !d.completa && "opacity-80")}>
              {fila("Si se para", GLOSARIO.impactoProduccion,
                imp?.valor == null ? "Sin calificar" : <>{IMPACTO_PRODUCCION[imp.valor]}{res?.valor && imp.valor > 0 ? " · con respaldo cuenta un escalón menos" : ""}</>,
                imp?.puntos, imp?.maximo)}
              {fila("Riesgo de seguridad", GLOSARIO.riesgoSeguridad, seg?.valor == null ? "Sin calificar" : RIESGO_SEGURIDAD[seg.valor], seg?.puntos, seg?.maximo)}
              {fila("Fallas en el último año", GLOSARIO.fallasUltimoAnio, fal ? `${fal.valor} ${fal.valor === 1 ? "falla" : "fallas"}` : "—", fal?.puntos, fal?.maximo)}
              {fila("Costo de reparación del año", GLOSARIO.costoReparacionCriticidad, cos ? COSTO[cos.valor] : "—", cos?.puntos, cos?.maximo)}
              {fila("Tiempo para conseguir refacción", GLOSARIO.diasRefaccion,
                ref?.valor == null ? "Sin dato (sin refacciones registradas)" : `${ref.valor} ${ref.valor === 1 ? "día" : "días"}${ref.de === "refacciones" ? " · de sus refacciones" : ""}`,
                ref?.puntos, ref?.maximo)}
              {fila("Respaldo", GLOSARIO.respaldoMaquina,
                res?.valor ? `Sí${res.con ? `: ${res.con} en la misma área` : ""}` : `No${res?.de === "calculado" ? " hay otra igual en su área" : ""}`)}
            </ul>
          </>
        )}
      </div>
    </Tarjeta>
  );
}
