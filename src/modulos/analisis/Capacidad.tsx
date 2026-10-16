import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { Cifra, MESES_CORTOS, TarjetaGrafica } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

interface DatosCapacidad {
  cuello: string | null; semanas_cola: number; vencido: number; sin_fecha: number; despues: number; al_dia: string | null;
  meses: { mes: string; prometido: number; capacidad: number }[];
  historia: { mes: string; entra: number; sale: number }[];
}

const nombreMes = (m: string) => { const [a, mm] = m.split("-").map(Number); return `${MESES_CORTOS[mm - 1]} ${String(a).slice(2)}`; };
const sem = (v: number) => `${numero(v)} sem`;

/**
 * ¿Prometemos más de lo que el taller saca? Todo en semanas de la etapa cuello de
 * botella (la que más trabajo tiene encima), para que se compare con el calendario.
 */
export default function Capacidad() {
  const datos = useQuery({ queryKey: ["analisis_capacidad"], queryFn: () => q<DatosCapacidad>(supabase.rpc("analisis_capacidad", { p_meses: 6 })) });
  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (!datos.data) return <Cargando filas={8} />;
  const d = datos.data;
  if (!d.cuello) return <div className="tarjeta"><Vacio icono={Gauge} titulo="El taller no tiene trabajo pendiente" texto="Cuando haya órdenes de producción abiertas, aquí verás lo prometido contra lo que cabe cada mes." /></div>;

  const cuello = d.cuello.toLowerCase();
  const prometidos = [
    ...(d.vencido > 0 ? [{ mes: "Ya vencido", Prometido: d.vencido, Capacidad: null as number | null }] : []),
    ...d.meses.map((m) => ({ mes: nombreMes(m.mes), Prometido: m.prometido, Capacidad: m.capacidad })),
  ];
  const historia = d.historia.map((h) => ({ mes: nombreMes(h.mes), Entra: h.entra, Sale: h.sale }));
  const hayHistoria = d.historia.some((h) => h.entra > 0 || h.sale > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra titulo={`Trabajo en fila (${cuello})`} explica={GLOSARIO.filaTaller} valor={sem(d.semanas_cola)}
          detalle={`La etapa más cargada; ${d.cuello} trabaja una semana por semana.`} />
        <Cifra titulo="Se pone al día" explica={GLOSARIO.alDiaTaller} valor={d.al_dia ? fecha(d.al_dia) : "—"} detalle="Si no entrara ningún pedido más" />
        <Cifra titulo="Ya vencido" valor={sem(d.vencido)} detalle="Trabajo cuya fecha compromiso ya pasó" />
        <Cifra titulo="Sin fecha compromiso" valor={sem(d.sin_fecha)} detalle="Va al final de la fila (stock, sin fecha)" />
      </div>

      <TarjetaGrafica titulo={`Prometido contra lo que cabe, en semanas de ${cuello}`} explica={GLOSARIO.prometidoVsCapacidad}
        descripcion="Barra: el trabajo de las órdenes que se prometieron para ese mes. Línea: las semanas que tiene el mes (lo que queda del actual)."
        tabla={<TablaSimple encabezados={["Mes", "Prometido", "Cabe"]} filas={prometidos.map((m) => [m.mes, sem(m.Prometido), m.Capacidad == null ? "—" : sem(m.Capacidad)])} />}
        pie={d.despues > 0 ? `Más adelante: ${sem(d.despues)} prometidas después de estos meses.` : undefined}>
        <div className="px-5"><Leyenda series={[{ nombre: "Prometido", color: SERIE(1) }, { nombre: "Cabe en el mes", color: SERIE(2) }]} /></div>
        <div className="h-72 px-2 pb-3 pt-2">
          <ResponsiveContainer>
            <ComposedChart data={prometidos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--rejilla)" />
              <XAxis dataKey="mes" {...ejeProps} />
              <YAxis {...ejeProps} width={44} tickFormatter={(v) => numero(v)} />
              <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(v) => sem(v)} />} />
              <Bar dataKey="Prometido" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              <Line dataKey="Capacidad" name="Cabe en el mes" stroke={SERIE(2)} strokeWidth={2} connectNulls={false}
                dot={{ r: 4, fill: SERIE(2), stroke: "hsl(var(--superficie))", strokeWidth: 2 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>

      <TarjetaGrafica titulo="Lo que entra y lo que sale del taller" explica={GLOSARIO.entraSaleTaller}
        descripcion={`Cada mes desde el arranque del ERP, en semanas de ${cuello}: si entra más de lo que sale, la fila crece.`}
        tabla={hayHistoria ? <TablaSimple encabezados={["Mes", "Entra", "Sale"]} filas={historia.map((h) => [h.mes, sem(h.Entra), sem(h.Sale)])} /> : undefined}>
        {!hayHistoria ? (
          <Vacio icono={Gauge} titulo="Se llena con el uso" texto="Cuenta las órdenes nuevas y las etapas que el taller marca terminadas en el ERP. Lo que ya estaba en la hoja de producción al arrancar no cuenta como entrada." className="py-10" />
        ) : (
          <>
            <div className="px-5"><Leyenda series={[{ nombre: "Entra", color: SERIE(1) }, { nombre: "Sale", color: SERIE(2) }]} /></div>
            <div className="h-64 px-2 pb-3 pt-2">
              <ResponsiveContainer>
                <BarChart data={historia} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} />
                  <YAxis {...ejeProps} width={44} tickFormatter={(v) => numero(v)} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(v) => sem(v)} />} />
                  <Bar dataKey="Entra" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  <Bar dataKey="Sale" fill={SERIE(2)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </TarjetaGrafica>
    </div>
  );
}

function TablaSimple({ encabezados, filas }: { encabezados: string[]; filas: string[][] }) {
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-tenue">{encabezados.map((e, i) => <th key={e} className={i ? "text-right py-1" : "py-1"}>{e}</th>)}</tr></thead>
        <tbody>{filas.map((f) => <tr key={f[0]} className="border-t border-borde">{f.map((c, i) => <td key={i} className={i ? "text-right cifra py-1" : "py-1"}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
