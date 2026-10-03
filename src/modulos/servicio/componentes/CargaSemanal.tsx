import { AlertTriangle, Gauge } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { cn } from "@/lib/utilidades";
import { horas, lunesDe, useCarga, type CargaSemana } from "../datos";

const fmtSemana = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" });
const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Holgura, justa o se pasa: el color acompaña al número y al ícono, nunca va solo. */
function estado(c: CargaSemana) {
  const o = c.ocupacion ?? 0;
  if (o > 1) return { clase: "bg-peligro-suave text-peligro", texto: "Se pasa" };
  if (o >= 0.85) return { clase: "bg-aviso-suave text-aviso", texto: "Justa" };
  return { clase: "bg-ok-suave/60 text-texto", texto: "Con holgura" };
}

/**
 * Carga del taller por semana y por área: producción (repartida entre hoy y la
 * fecha de compromiso) más las horas que su gente pasa en servicio, contra la
 * capacidad semanal. Es la vista que faltaba cuando "los servicios no
 * considerados" atrasaban al taller.
 */
export function CargaSemanal({ semanas = 6, className }: { semanas?: number; className?: string }) {
  const carga = useCarga(semanas);
  const filas = carga.data ?? [];
  const semanasLista = [...new Set(filas.map((f) => f.semana))].sort();
  const etapas = [...new Map(filas.map((f) => [f.etapa_id, f])).values()].sort((a, b) => a.orden - b.orden);
  const conAlgo = etapas.filter((e) => filas.some((f) => f.etapa_id === e.etapa_id && (f.carga > 0 || f.horas_planeadas > 0)));
  const sinNada = etapas.filter((e) => !conAlgo.includes(e));
  const esta = lunesDe(new Date());
  const servicioTotal = filas.reduce((s, f) => s + Number(f.horas_servicio), 0);

  return (
    <Tarjeta className={className}>
      <EncabezadoTarjeta
        titulo="Carga del taller por semana"
        descripcion={`Producción más horas de cuadrilla en servicio, contra la capacidad de cada área. Servicios: ${horas(servicioTotal)} en ${semanas} semanas.`}
      />
      {carga.error ? <ErrorCarga error={carga.error} /> : carga.isLoading ? <Cargando filas={4} /> : conAlgo.length === 0 ? (
        <Vacio icono={Gauge} titulo="El taller no tiene carga en estas semanas" texto="Cuando haya órdenes liberadas o servicios programados, aquí se ve qué área se satura." />
      ) : (
        <div className="px-5 pb-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr>
                  <th className="text-left font-medium text-tenue text-xs uppercase tracking-wide py-1.5 pr-3">Área</th>
                  {semanasLista.map((s) => (
                    <th key={s} className={cn("text-center font-medium text-xs py-1.5 px-1", s === esta ? "text-marca-texto" : "text-tenue")}>
                      {s === esta ? "Esta semana" : fmtSemana.format(new Date(s + "T12:00:00"))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conAlgo.map((e) => (
                  <tr key={e.etapa_id}>
                    <td className="py-1 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />{e.etapa}
                        <span className="text-[11px] text-tenue cifra">{horas(e.capacidad)}/sem</span>
                      </span>
                    </td>
                    {semanasLista.map((s) => {
                      const c = filas.find((f) => f.etapa_id === e.etapa_id && f.semana === s);
                      if (!c) return <td key={s} />;
                      const st = estado(c);
                      const detalle = [
                        `${c.etapa}, semana del ${fmtSemana.format(new Date(s + "T12:00:00"))}`,
                        `Capacidad ${horas(c.capacidad)} − ${horas(c.horas_servicio)} en servicio = ${horas(c.capacidad_disponible)} disponibles`,
                        `Producción liberada ${horas(c.horas_produccion)}${c.horas_planeadas > 0 ? ` (+${horas(c.horas_planeadas)} planeadas, sin liberar)` : ""}`,
                        `Saldo: ${horas(c.saldo)} · ${st.texto}`,
                        ...c.servicios.map((x) => `· ${x.folio}: ${horas(x.horas)} (${x.personas} ${x.personas === 1 ? "persona" : "personas"})`),
                      ].join("\n");
                      return (
                        <td key={s} className="p-0.5">
                          <div title={detalle} className={cn("rounded-md px-2 py-1.5 text-center leading-tight", st.clase)}>
                            <span className="cifra font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                              {(c.ocupacion ?? 0) > 1 && <AlertTriangle className="h-3.5 w-3.5" aria-label="Se pasa de la capacidad" />}
                              {c.ocupacion == null ? "—" : pct(c.ocupacion)}
                            </span>
                            <span className="block text-[11px] text-tenue cifra whitespace-nowrap">
                              {c.horas_servicio > 0 ? `−${horas(c.horas_servicio)} servicio` : c.horas_planeadas > 0 ? `+${horas(c.horas_planeadas)} plan.` : " "}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ok-suave border border-ok/30" />Con holgura (menos de 85 %)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-aviso-suave border border-aviso/30" />Justa (85 a 100 %)</span>
            <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-peligro" />Se pasa (más de 100 %)</span>
            <span>Las órdenes atrasadas cuentan completas en esta semana.</span>
          </div>
          {sinNada.length > 0 && <p className="text-xs text-tenue">Sin carga: {sinNada.map((e) => e.etapa).join(", ")}.</p>}
        </div>
      )}
    </Tarjeta>
  );
}
