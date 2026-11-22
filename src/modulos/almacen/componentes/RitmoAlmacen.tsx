import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock, Flame, Repeat } from "lucide-react";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Filtro } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useRpc } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

interface Cuenta { salidas: number; entradas: number; ajustes: number }
interface Ritmo {
  resumen: Cuenta & { movimientos: number; dias_activos: number; primer_dia: string | null; ultimo_dia: string | null;
    del_historial: number; del_erp: number; sin_hora: number; erp_desde: string | null };
  por_dia_semana: (Cuenta & { dia: number; dias: number })[];
  por_hora: (Cuenta & { hora: number })[];
  calor: (Cuenta & { dia: number; hora: number })[];
  por_mes: (Cuenta & { mes: string; dias: number; origen: "erp" | "historial" | "ambos" })[];
  dias_pico: (Cuenta & { dia: string; movimientos: number })[];
}

export type PeriodoRitmo = "3" | "12" | "todo";
export const PERIODOS_RITMO: { valor: PeriodoRitmo; texto: string }[] = [
  { valor: "3", texto: "3 meses" }, { valor: "12", texto: "12 meses" }, { valor: "todo", texto: "Todo" },
];
type Que = "todo" | "salidas" | "entradas";
const QUE: { valor: Que; texto: string }[] = [{ valor: "todo", texto: "Todo" }, { valor: "salidas", texto: "Salidas" }, { valor: "entradas", texto: "Entradas" }];
const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const de = (c: Cuenta, q: Que) => (q === "salidas" ? c.salidas : q === "entradas" ? c.entradas : c.salidas + c.entradas + c.ajustes);
const hora = (h: number) => `${h}:00`;
const mesCorto = (iso: string) => fecha(iso).replace(/^\d+ /, "").replace(/ 20(\d\d)$/, " $1");
const uno = (n: number) => numero(Math.round(n * 10) / 10);

/**
 * Cuándo se mueve el almacén: por día de la semana, por hora y por mes. Junta los movimientos del
 * ERP con el historial del sistema anterior, si la empresa lo cargó; la base decide dónde corta
 * uno y empieza el otro. Se cuentan renglones (un movimiento de un artículo), no piezas.
 */
export function RitmoAlmacen({ desde }: { desde: string | null }) {
  const [que, setQue] = useState<Que>("todo");
  const r = useRpc<Ritmo>("almacen_ritmo", { p_desde: desde }, { clave: ["almacen_ritmo", desde] });
  const d = r.data;

  const semana = useMemo(() => (d?.por_dia_semana ?? []).filter((x) => x.dias > 0).map((x) => ({
    dia: DIAS[x.dia], n: x.dia, dias: x.dias, Salidas: x.salidas / x.dias, Entradas: x.entradas / x.dias, Ajustes: x.ajustes / x.dias,
    total: (x.salidas + x.entradas + x.ajustes) / x.dias,
  })), [d]);
  const meses = useMemo(() => (d?.por_mes ?? []).map((x) => ({ mes: mesCorto(x.mes), iso: x.mes, dias: x.dias, Salidas: x.salidas, Entradas: x.entradas, Ajustes: x.ajustes })), [d]);
  // El mapa solo enseña las horas y los días donde de verdad pasa algo: una captura suelta a las
  // 2 de la mañana no merece una columna.
  const mapa = useMemo(() => {
    const celdas = d?.calor ?? [];
    const total = celdas.reduce((a, c) => a + de(c, que), 0);
    const porHora = new Map<number, number>(), porDia = new Map<number, number>();
    for (const c of celdas) { porHora.set(c.hora, (porHora.get(c.hora) ?? 0) + de(c, que)); porDia.set(c.dia, (porDia.get(c.dia) ?? 0) + de(c, que)); }
    const horasVivas = [...porHora].filter(([, n]) => n >= total * 0.005).map(([h]) => h);
    const horas = horasVivas.length ? Array.from({ length: Math.max(...horasVivas) - Math.min(...horasVivas) + 1 }, (_, i) => Math.min(...horasVivas) + i) : [];
    const dias = [...porDia].filter(([, n]) => n >= total * 0.005).map(([x]) => x).sort((a, b) => a - b);
    const idx = new Map(celdas.map((c) => [`${c.dia}|${c.hora}`, c]));
    const visibles = celdas.filter((c) => horas.includes(c.hora) && dias.includes(c.dia)).map((c) => de(c, que)).filter((v) => v > 0);
    // De la celda más floja a la más cargada: si se midiera desde cero, todo el horario de trabajo
    // saldría del mismo azul y no se vería cuál hora pesa más.
    const max = Math.max(1, ...visibles), min = visibles.length ? Math.min(...visibles) : 0;
    const pico = [...celdas].sort((a, b) => de(b, que) - de(a, que))[0];
    const horaPico = [...porHora].sort((a, b) => b[1] - a[1])[0];
    return { horas, dias, idx, max, min, total, pico, horaPico };
  }, [d, que]);
  const [sobre, setSobre] = useState<{ dia: number; hora: number } | null>(null);

  if (r.error) return <ErrorCarga error={r.error} />;
  if (r.isLoading || !d) return <Cargando filas={8} />;
  const s = d.resumen;
  if (!s.movimientos) return <Vacio icono={Repeat} titulo="Todavía no hay movimientos en este periodo" texto="Conforme almacén registre entradas y salidas, aquí se va a ver qué días y a qué horas se mueve más." />;

  const masCargado = [...semana].sort((a, b) => b.Salidas - a.Salidas)[0];
  const record = d.dias_pico[0];
  const tono = (v: number) => (v <= 0 ? "hsl(var(--fondo))" : `color-mix(in oklab, var(--serie-1) ${Math.round(12 + 88 * Math.max(0, (v - mapa.min) / Math.max(1, mapa.max - mapa.min)))}%, hsl(var(--superficie)))`);
  const celdaSobre = sobre ? mapa.idx.get(`${sobre.dia}|${sobre.hora}`) : undefined;
  const mesErp = s.erp_desde && s.del_historial > 0 ? meses.find((m) => m.iso.slice(0, 7) === s.erp_desde!.slice(0, 7))?.mes : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Movimientos por día" icono={Repeat} explica={GLOSARIO.ritmoMovimientosPorDia}
          valor={uno(s.movimientos / Math.max(1, s.dias_activos))}
          detalle={`${numero(s.movimientos)} renglones en ${s.dias_activos === 1 ? "1 día" : `${numero(s.dias_activos)} días`} con actividad`} />
        <Kpi titulo="Día con más salidas" icono={CalendarDays} explica={GLOSARIO.ritmoDiaMasCargado}
          valor={masCargado?.dia ?? "—"} detalle={masCargado ? `${uno(masCargado.Salidas)} salidas en promedio` : undefined} />
        <Kpi titulo="Hora pico" icono={Clock} explica={GLOSARIO.ritmoHoraPico}
          valor={mapa.horaPico ? `${hora(mapa.horaPico[0])} a ${hora(mapa.horaPico[0] + 1)}` : "—"}
          detalle={mapa.horaPico && mapa.total ? `${Math.round((mapa.horaPico[1] / mapa.total) * 100)} % de lo del día cae en esa hora` : undefined} />
        <Kpi titulo="Día récord" icono={Flame} tono="aviso" explica={GLOSARIO.ritmoDiaRecord}
          valor={record ? fecha(record.dia) : "—"} detalle={record ? `${numero(record.movimientos)} renglones: ${numero(record.salidas)} salidas, ${numero(record.entradas)} entradas, ${numero(record.ajustes)} ajustes` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Por día de la semana" explica={GLOSARIO.ritmoPorDiaSemana}
            descripcion="Renglones en promedio por cada día que hubo actividad" />
          <div className="px-5"><Leyenda series={[{ nombre: "Salidas", color: SERIE(1) }, { nombre: "Entradas", color: SERIE(2) }, { nombre: "Ajustes", color: SERIE(3) }]} /></div>
          <div className="h-64 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <BarChart data={semana} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2} maxBarSize={28}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="dia" {...ejeProps} />
                <YAxis {...ejeProps} width={36} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={uno} />} />
                <Bar dataKey="Salidas" fill={SERIE(1)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Entradas" fill={SERIE(2)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Ajustes" fill={SERIE(3)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Día y hora" explica={GLOSARIO.ritmoMapaDiaHora} descripcion="Entre más oscuro, más renglones se capturan en esa hora" />
          <div className="px-5 pb-4 space-y-2">
            <Filtro opciones={QUE} valor={que} alCambiar={setQue} />
            <p className="text-xs text-tenue min-h-4">
              {sobre ? <><b className="text-texto">{DIAS[sobre.dia]}, de {hora(sobre.hora)} a {hora(sobre.hora + 1)}</b>: {celdaSobre
                  ? `${numero(celdaSobre.salidas)} salidas, ${numero(celdaSobre.entradas)} entradas, ${numero(celdaSobre.ajustes)} ajustes` : "sin movimientos"}</>
                : mapa.pico ? `Lo más cargado: ${DIAS[mapa.pico.dia].toLowerCase()} de ${hora(mapa.pico.hora)} a ${hora(mapa.pico.hora + 1)}. Pasa el mouse por un cuadro para ver su detalle.` : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="border-separate w-full" style={{ borderSpacing: 3 }} onMouseLeave={() => setSobre(null)}>
                <thead>
                  <tr><th />{mapa.horas.map((h) => <th key={h} className="text-[11px] font-normal text-tenue cifra">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {mapa.dias.map((dia) => (
                    <tr key={dia}>
                      <td className="pr-2 text-xs text-tenue whitespace-nowrap w-px">{DIAS[dia]}</td>
                      {mapa.horas.map((h) => (
                        <td key={h} className={cn("h-7 min-w-6 rounded-[4px] p-0", sobre?.dia === dia && sobre.hora === h && "ring-2 ring-texto/40")}
                          style={{ background: tono(de(mapa.idx.get(`${dia}|${h}`) ?? { salidas: 0, entradas: 0, ajustes: 0 }, que)) }}
                          onMouseEnter={() => setSobre({ dia, hora: h })} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-tenue">
              <span>Menos</span>{[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f} className="h-3 w-3 rounded-[3px]" style={{ background: tono(mapa.min + f * (mapa.max - mapa.min)) }} />)}<span>Más</span>
              {s.sin_hora > 0 && <span className="ml-auto">{numero(s.sin_hora)} renglones del historial no traen hora y no entran aquí.</span>}
            </div>
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2 min-w-0">
          <EncabezadoTarjeta titulo="Por mes" explica={GLOSARIO.ritmoPorMes}
            descripcion={mesErp ? `Renglones de cada mes. La línea marca cuando el almacén empezó a capturar en el ERP (${fecha(s.erp_desde!)}).` : "Renglones de cada mes"} />
          <div className="px-5"><Leyenda series={[{ nombre: "Salidas", color: SERIE(1) }, { nombre: "Entradas", color: SERIE(2) }, { nombre: "Ajustes", color: SERIE(3) }]} /></div>
          <div className="h-64 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <BarChart data={meses} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} maxBarSize={40}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="mes" {...ejeProps} interval="preserveStartEnd" minTickGap={12} />
                <YAxis {...ejeProps} width={44} allowDecimals={false} tickFormatter={(v) => numero(v)} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                {mesErp && <ReferenceLine x={mesErp} stroke="var(--eje)" strokeDasharray="4 4" />}
                <Bar dataKey="Salidas" stackId="m" fill={SERIE(1)} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
                <Bar dataKey="Entradas" stackId="m" fill={SERIE(2)} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
                <Bar dataKey="Ajustes" stackId="m" fill={SERIE(3)} stroke="hsl(var(--superficie))" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Los días más pesados" explica={GLOSARIO.ritmoDiasPico} descripcion="Renglones registrados en un solo día" />
          <ul className="px-5 pb-4 space-y-2">
            {d.dias_pico.map((x) => (
              <li key={x.dia} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{fecha(x.dia)} <span className="text-xs text-tenue">· {DIAS[((new Date(x.dia + "T12:00:00").getDay() + 6) % 7) + 1].toLowerCase()}</span></span>
                <span className="cifra text-right"><b>{numero(x.movimientos)}</b>
                  <span className="block text-xs text-tenue">{numero(x.salidas)} sal · {numero(x.entradas)} ent · {numero(x.ajustes)} aj</span></span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <p className="text-xs text-tenue">
        Del {s.primer_dia ? fecha(s.primer_dia) : "—"} al {s.ultimo_dia ? fecha(s.ultimo_dia) : "—"}. Se cuentan renglones (un movimiento de un artículo), no piezas.
        {s.del_historial > 0 && <> Incluye {numero(s.del_historial)} renglones del historial anterior al ERP{s.erp_desde ? <>; desde el {fecha(s.erp_desde)} cuenta lo capturado en el ERP</> : null}.</>}
        {" "}La hora es la de captura.
      </p>
    </div>
  );
}
