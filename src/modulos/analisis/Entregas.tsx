import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero, porcentaje } from "@/lib/formato";
import { BarraRanking, Cifra, MESES_CORTOS, TarjetaGrafica, usePeriodo } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

interface Grupo { juzgados?: number; juzgadas?: number; a_tiempo: number; dias_atraso: number | null }
interface DatosEntregas {
  pedidos: { juzgados: number; a_tiempo: number; tarde: number; vencidos_abiertos: number; dias_atraso: number | null };
  por_mes: ({ mes: string } & Grupo)[];
  por_vendedor: ({ vendedor: string } & Grupo)[];
  por_familia: ({ familia: string } & Grupo)[];
  taller: { juzgadas: number; a_tiempo: number };
}
export interface Promesa {
  orden_id: string; orden: string; equipo: string; pedido_id: string | null; pedido: string | null; cliente: string | null; vendedor: string | null;
  compromiso: string; estimada: string; dias: number; estado: string; cuello: string | null;
}

export function usePromesas() {
  return useQuery({ queryKey: ["analisis_promesas"], queryFn: () => q<Promesa[]>(supabase.rpc("analisis_promesas")) });
}

const pct = (g: Grupo) => {
  const n = g.juzgados ?? g.juzgadas ?? 0;
  return n ? g.a_tiempo / n : null;
};

/**
 * ¿Cumplimos lo que prometemos? Lo entregado (y lo vencido sin entregar) del periodo,
 * y lo que viene: cada orden del taller en la fila, con la fecha a la que sale de verdad.
 */
export default function Entregas() {
  const { periodo } = usePeriodo();
  const navegar = useNavigate();
  const [vista, setVista] = useState<"riesgo" | "todas">("riesgo");
  const datos = useQuery({
    queryKey: ["analisis_entregas", periodo.desde, periodo.hasta],
    queryFn: () => q<DatosEntregas>(supabase.rpc("analisis_entregas", { p_desde: periodo.desde, p_hasta: periodo.hasta })),
    placeholderData: keepPreviousData,
  });
  const promesas = usePromesas();

  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (!datos.data) return <Cargando filas={8} />;
  const d = datos.data;
  const p = d.pedidos;
  const enRiesgo = (promesas.data ?? []).filter((x) => x.dias > 0);
  const filas = vista === "riesgo" ? enRiesgo : promesas.data ?? [];
  const serie = d.por_mes.map((m) => {
    const [a, mm] = m.mes.split("-").map(Number);
    return { mes: `${MESES_CORTOS[mm - 1]} ${String(a).slice(2)}`, "A tiempo": m.a_tiempo, "Tarde": (m.juzgados ?? 0) - m.a_tiempo };
  });

  const columnas: Columna<Promesa>[] = [
    { clave: "pedido", titulo: "Pedido", valor: (x) => x.pedido ?? "stock", celda: (x) => <span className="cifra">{x.pedido ?? <span className="text-tenue">stock</span>}</span> },
    { clave: "equipo", titulo: "Equipo", clase: "min-w-[220px] max-w-[360px]", celda: (x) => <span className="line-clamp-2">{x.equipo}<span className="block text-xs text-tenue cifra">{x.orden}</span></span> },
    { clave: "cliente", titulo: "Cliente", valor: (x) => x.cliente ?? "", celda: (x) => x.cliente ?? <span className="text-tenue">—</span> },
    { clave: "vendedor", titulo: "Vendedor", valor: (x) => x.vendedor ?? "" },
    { clave: "compromiso", titulo: "Prometida", alinear: "der", sinBusqueda: true, valor: (x) => x.compromiso, celda: (x) => <span className="cifra">{fecha(x.compromiso)}</span> },
    { clave: "estimada", titulo: "Sale hacia", alinear: "der", sinBusqueda: true, explica: GLOSARIO.promesaEnRiesgo, valor: (x) => x.estimada,
      celda: (x) => <span className="cifra">{fecha(x.estimada)}</span> },
    { clave: "dias", titulo: "Diferencia", alinear: "der", sinBusqueda: true, valor: (x) => x.dias,
      celda: (x) => x.dias > 0
        ? <Insignia tono="peligro">{x.dias} días tarde</Insignia>
        : <span className="text-xs text-ok">{-x.dias} días de holgura</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Pedidos a tiempo" explica={GLOSARIO.aTiempo}
          valor={p.juzgados ? porcentaje(p.a_tiempo / p.juzgados, 0) : "—"}
          detalle={p.juzgados ? `${numero(p.a_tiempo)} de ${numero(p.juzgados)} con compromiso en el periodo` : "Todavía no hay entregas que juzgar en el periodo"} />
        <Cifra titulo="Atraso promedio" explica={GLOSARIO.diasAtraso}
          valor={p.dias_atraso != null ? `${numero(p.dias_atraso)} días` : "—"} detalle={`${numero(p.tarde)} pedidos tarde`} />
        <Cifra titulo="Vencidos sin entregar" valor={numero(p.vencidos_abiertos)} detalle="Ya pasó su fecha y siguen abiertos" />
        <Cifra titulo="Promesas en riesgo" explica={GLOSARIO.promesaEnRiesgo}
          valor={promesas.data ? <span className={enRiesgo.length ? "text-peligro" : ""}>{numero(enRiesgo.length)}</span> : "…"}
          detalle={promesas.data ? `de ${numero(promesas.data.length)} órdenes abiertas con fecha` : undefined} />
      </div>

      <TarjetaGrafica titulo="Lo que viene: cada orden en la fila del taller" explica={GLOSARIO.promesaEnRiesgo}
        descripcion="Por fecha compromiso: cada orden sale cuando el taller acaba lo prometido antes que ella y lo suyo.">
        <div className="px-3 pb-3">
          <TablaDatos filas={filas} columnas={columnas} cargando={promesas.isLoading} error={promesas.error} claveFila={(x) => x.orden_id}
            alClicFila={(x) => navegar(x.pedido_id ? `/ventas/pedidos/${x.pedido_id}` : `/produccion/ordenes/${x.orden_id}`)}
            exportarComo="promesas-de-entrega" placeholder="Buscar pedido, equipo, cliente…" compacta
            filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
              { valor: "riesgo", texto: "En riesgo", cuenta: enRiesgo.length }, { valor: "todas", texto: "Todas", cuenta: promesas.data?.length }]} />}
            vacio={{ icono: CalendarCheck, titulo: vista === "riesgo" ? "Ninguna promesa en riesgo" : "Sin órdenes abiertas con fecha",
              texto: vista === "riesgo" ? "Con la fila de hoy, todo lo prometido sale a tiempo." : "Las órdenes de producción con fecha compromiso aparecen aquí." }} />
        </div>
      </TarjetaGrafica>

      <div className="grid gap-4 xl:grid-cols-2">
        <TarjetaGrafica titulo="Entregas por mes" explica={GLOSARIO.aTiempo} descripcion="Pedidos con fecha compromiso en el mes: a tiempo y tarde (incluye los vencidos sin entregar)."
          tabla={<TablaMeses filas={d.por_mes} />}>
          {serie.length === 0 ? (
            <Vacio icono={CalendarClock} titulo="Aún no hay entregas que juzgar" texto="Se llena sola conforme se entregan pedidos con fecha compromiso o se vencen sin entregar." className="py-10" />
          ) : (
            <>
              <div className="px-5"><Leyenda series={[{ nombre: "A tiempo", color: SERIE(1) }, { nombre: "Tarde", color: SERIE(2) }]} /></div>
              <div className="h-64 px-2 pb-3 pt-2">
                <ResponsiveContainer>
                  <BarChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                    <XAxis dataKey="mes" {...ejeProps} />
                    <YAxis {...ejeProps} width={36} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(v) => `${numero(v)} pedidos`} />} />
                    <Bar dataKey="A tiempo" stackId="a" fill={SERIE(1)} maxBarSize={28} isAnimationActive={false} />
                    <Bar dataKey="Tarde" stackId="a" fill={SERIE(2)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}
                      stroke="hsl(var(--superficie))" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </TarjetaGrafica>

        <div className="grid gap-4">
          <Ranking titulo="Por vendedor" descripcion="Pedidos con compromiso en el periodo." filas={d.por_vendedor.map((v) => ({ nombre: v.vendedor, g: v }))} />
          <Ranking titulo="Por familia (órdenes del taller)" descripcion={`Las órdenes de producción con compromiso en el periodo: ${d.taller.juzgadas ? porcentaje(d.taller.a_tiempo / d.taller.juzgadas, 0) : "—"} a tiempo.`}
            filas={d.por_familia.map((f) => ({ nombre: f.familia, g: f }))} />
        </div>
      </div>
    </div>
  );
}

function Ranking({ titulo, descripcion, filas }: { titulo: string; descripcion: string; filas: { nombre: string; g: Grupo }[] }) {
  return (
    <section className="tarjeta px-5 py-4">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="text-sm text-tenue mb-3">{descripcion}</p>
      {filas.length === 0 ? <p className="text-sm text-tenue">Sin datos en el periodo.</p> : (
        <ul className="space-y-2.5">
          {filas.map((f) => {
            const v = pct(f.g);
            return (
              <li key={f.nombre} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate">{f.nombre}</span>
                <BarraRanking valor={v ?? 0} max={1} />
                <span className="cifra text-right whitespace-nowrap">{v == null ? "—" : porcentaje(v, 0)}
                  <span className="text-xs text-tenue"> · {numero(f.g.juzgados ?? f.g.juzgadas ?? 0)}{f.g.dias_atraso != null ? ` · ${numero(f.g.dias_atraso)} d` : ""}</span></span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TablaMeses({ filas }: { filas: ({ mes: string } & Grupo)[] }) {
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-tenue"><th className="py-1">Mes</th><th className="text-right">Juzgados</th><th className="text-right">A tiempo</th><th className="text-right">Atraso prom.</th></tr></thead>
        <tbody>
          {filas.map((m) => (
            <tr key={m.mes} className="border-t border-borde">
              <td className="py-1">{fecha(m.mes).slice(3)}</td><td className="text-right cifra">{numero(m.juzgados ?? 0)}</td>
              <td className="text-right cifra">{pct(m) == null ? "—" : porcentaje(pct(m)!, 0)}</td>
              <td className="text-right cifra">{m.dias_atraso == null ? "—" : `${numero(m.dias_atraso)} d`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
