import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, CalendarCheck, Gauge, RefreshCcw, Timer, TriangleAlert, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useRpc } from "@/lib/consultas";
import { dinero, fecha, numero, porcentaje, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Cómo anda el mantenimiento: si las máquinas están disponibles, cada cuánto fallan, cuánto
 * tardan en volver, si el preventivo se hace a tiempo y qué máquina conviene atender primero.
 * Todo lo calcula la base (metricas_mantenimiento) con lo que ya se captura en cada orden.
 */

interface Maquina {
  id: string; numero: string; nombre: string; categoria: string; area: string | null; criticidad: string | null; critica: boolean; estado: string;
  fallas: number; horas_fuera: number; disponibilidad: number; mtbf_h: number | null; mttr_h: number | null;
  prev_programados: number; prev_a_tiempo: number; costo: number | null;
}
interface Datos {
  con_costos: boolean;
  periodo: { horas: number };
  resumen: {
    maquinas: number; paradas_ahora: number; disponibilidad: number | null; disponibilidad_criticas: number | null; fallas: number | null;
    horas_fuera: number | null; mtbf_h: number | null; mttr_h: number | null; paro_por_falla_h: number | null;
    prev_programados: number | null; prev_a_tiempo: number | null; prev_tarde: number; prev_vencidos: number;
    horas_preventivo: number; horas_correctivo: number; abiertas: number; abiertas_dias: number | null; costo: number | null;
  };
  maquinas: Maquina[];
  reincidencias: { folio: string; maquina: string; reportada: string; falla: string | null; dias: number; anterior: string; anterior_falla: string | null }[];
  pendientes: { id: string; folio: string; maquina: string; tipo: string; estado: string; detiene: boolean; falla: string | null; vence: string | null; dias: number }[];
  tecnicos: { quien: string; horas: number; preventivas: number; correctivas: number }[];
  semanas: { semana: string; correctivas: number; preventivas: number }[];
}

type Periodo = "30" | "90" | "180" | "365";
const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "30", texto: "30 días" }, { valor: "90", texto: "90 días" }, { valor: "180", texto: "6 meses" }, { valor: "365", texto: "12 meses" },
];
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const CRITICIDAD: Record<string, string> = { muy_alta: "Muy alta", alta: "Alta", media: "Media", baja: "Baja", muy_baja: "Muy baja" };
const tonoDisp = (d: number | null | undefined) => (d == null ? "neutro" : d >= 0.98 ? "ok" : d >= 0.95 ? "aviso" : "peligro") as "neutro" | "ok" | "aviso" | "peligro";

export default function MetricasMantenimiento() {
  const [params, setParams] = useSearchParams();
  const periodo = (PERIODOS.some((p) => p.valor === params.get("periodo")) ? params.get("periodo") : "90") as Periodo;
  const hasta = hoyISO();
  const desde = useMemo(() => restarDias(hasta, Number(periodo) - 1), [hasta, periodo]);
  const m = useRpc<Datos>("metricas_mantenimiento", { p_desde: desde, p_hasta: hasta }, { clave: ["metricas_mantenimiento", desde, hasta] });
  return (
    <Pagina titulo="Métricas de mantenimiento" ancho="max-w-[1500px]" descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · máquinas y herramienta`}
      acciones={<Filtro opciones={PERIODOS} valor={periodo} alCambiar={(v) => setParams(v === "90" ? {} : { periodo: v }, { replace: true })} />}>
      {m.error ? <ErrorCarga error={m.error} /> : m.isLoading || !m.data ? <Cargando filas={8} /> : <Contenido d={m.data} />}
    </Pagina>
  );
}

function Contenido({ d }: { d: Datos }) {
  const r = d.resumen;
  const cumplimiento = r.prev_programados ? (r.prev_a_tiempo ?? 0) / r.prev_programados : null;
  const totalHoras = r.horas_preventivo + r.horas_correctivo;
  const pareto = d.maquinas.filter((x) => x.horas_fuera > 0 || x.fallas > 0).slice(0, 5);
  const semanas = d.semanas.map((s) => ({ semana: fecha(s.semana).replace(/ \d{4}$/, ""), Fallas: s.correctivas, "Preventivos hechos": s.preventivas }));

  const colMaq: Columna<Maquina>[] = [
    { clave: "numero", titulo: "Máquina", valor: (x) => `${x.numero} ${x.nombre} ${x.categoria}`,
      celda: (x) => <Link to={`/servicio/maquinas/${x.id}`} className="block min-w-[180px] hover:underline"><span className="font-medium cifra">{x.numero}</span> · {x.nombre}<p className="text-xs text-tenue">{x.categoria}{x.area ? ` · ${x.area}` : ""}</p></Link> },
    { clave: "criticidad", titulo: "Criticidad", valor: (x) => x.criticidad ?? "", explica: GLOSARIO.criticidadMaquina,
      celda: (x) => x.criticidad ? <Insignia tono={x.criticidad.includes("alta") ? "peligro" : "neutro"}>{CRITICIDAD[x.criticidad]}</Insignia> : <span className="text-tenue">—</span> },
    { clave: "disponibilidad", titulo: "Disponibilidad", alinear: "der", valor: (x) => x.disponibilidad, explica: GLOSARIO.disponibilidadMaquina,
      celda: (x) => <span className={cn("cifra font-medium", tonoDisp(x.disponibilidad) === "peligro" ? "text-peligro" : tonoDisp(x.disponibilidad) === "aviso" ? "text-aviso" : "")}>{porcentaje(x.disponibilidad, 1)}</span> },
    { clave: "fallas", titulo: "Fallas", alinear: "der", valor: (x) => x.fallas, celda: (x) => <span className="cifra">{numero(x.fallas)}</span> },
    { clave: "horas_fuera", titulo: "Horas parada", alinear: "der", valor: (x) => x.horas_fuera, celda: (x) => <span className="cifra">{numero(x.horas_fuera)}</span> },
    { clave: "mtbf_h", titulo: "MTBF", alinear: "der", valor: (x) => x.mtbf_h ?? Infinity, explica: GLOSARIO.mtbf, celda: (x) => <span className="cifra">{x.mtbf_h == null ? "Sin fallas" : `${numero(x.mtbf_h)} h`}</span> },
    { clave: "mttr_h", titulo: "MTTR", alinear: "der", valor: (x) => x.mttr_h ?? -1, explica: GLOSARIO.mttr, celda: (x) => <span className="cifra">{x.mttr_h == null ? "—" : `${numero(x.mttr_h)} h`}</span> },
    { clave: "prev_programados", titulo: "Preventivos a tiempo", alinear: "der", valor: (x) => x.prev_programados ? x.prev_a_tiempo / x.prev_programados : -1, explica: GLOSARIO.cumplimientoPreventivo,
      celda: (x) => x.prev_programados ? <span className="cifra">{numero(x.prev_a_tiempo)} de {numero(x.prev_programados)}</span> : <span className="text-tenue">—</span> },
    ...(d.con_costos ? [{ clave: "costo", titulo: "Costo", alinear: "der" as const, valor: (x: Maquina) => x.costo ?? 0, celda: (x: Maquina) => <span className="cifra">{x.costo ? dinero(x.costo) : "—"}</span> }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Disponibilidad" valor={porcentaje(r.disponibilidad, 1)} icono={Gauge} tono={tonoDisp(r.disponibilidad)}
          detalle={`críticas ${porcentaje(r.disponibilidad_criticas, 1)} · ${numero(r.paradas_ahora)} paradas ahorita`} explica={GLOSARIO.disponibilidadMaquina} />
        <Kpi titulo="MTBF" valor={r.mtbf_h == null ? "Sin fallas" : `${numero(r.mtbf_h)} h`} icono={Timer} tono="info"
          detalle={`${numero(r.fallas ?? 0)} fallas en el periodo`} explica={GLOSARIO.mtbf} />
        <Kpi titulo="MTTR" valor={r.mttr_h == null ? "—" : `${numero(r.mttr_h)} h`} icono={AlarmClock} tono="info"
          detalle={r.paro_por_falla_h == null ? "de reporte a cierre" : `paro promedio ${numero(r.paro_por_falla_h)} h`} explica={GLOSARIO.mttr} />
        <Kpi titulo="Preventivo a tiempo" valor={porcentaje(cumplimiento, 0)} icono={CalendarCheck}
          tono={cumplimiento == null ? "neutro" : cumplimiento >= 0.9 ? "ok" : cumplimiento >= 0.7 ? "aviso" : "peligro"}
          detalle={`${numero(r.prev_a_tiempo ?? 0)} de ${numero(r.prev_programados ?? 0)} · ${numero(r.prev_vencidos)} vencidos`} explica={GLOSARIO.cumplimientoPreventivo} />
        <Kpi titulo="Preventivo / correctivo" valor={totalHoras ? porcentaje(r.horas_preventivo / totalHoras, 0) : "—"} icono={Wrench}
          tono={!totalHoras ? "neutro" : r.horas_preventivo / totalHoras >= 0.6 ? "ok" : "aviso"}
          detalle={`${numero(r.horas_preventivo)} h preventivo · ${numero(r.horas_correctivo)} h correctivo`} explica={GLOSARIO.preventivoVsCorrectivo} />
        <Kpi titulo="Órdenes abiertas" valor={numero(r.abiertas)} icono={TriangleAlert} tono={r.abiertas ? "aviso" : "ok"}
          detalle={r.abiertas_dias == null ? "sin fallas abiertas" : `fallas abiertas: ${numero(r.abiertas_dias)} días en promedio`} explica={GLOSARIO.backlogMantenimiento} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Fallas y preventivos por semana" descripcion="Si el preventivo funciona, las fallas bajan" />
          <div className="px-5"><Leyenda series={[{ nombre: "Fallas", color: SERIE(1) }, { nombre: "Preventivos hechos", color: SERIE(2) }]} /></div>
          <div className="h-56 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <BarChart data={semanas} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="semana" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...ejeProps} allowDecimals={false} width={28} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                <Bar dataKey="Fallas" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Preventivos hechos" fill={SERIE(2)} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Las que más paran" descripcion="Pareto: dónde se va el tiempo de máquina" explica={GLOSARIO.paretoFallas} />
          <ul className="px-5 pb-5 space-y-3 text-sm">
            {pareto.length === 0 && <li className="text-tenue py-6 text-center">Ninguna máquina paró en el periodo.</li>}
            {pareto.map((x) => {
              const max = pareto[0].horas_fuera || 1;
              return (
                <li key={x.id}>
                  <div className="flex justify-between gap-2"><Link to={`/servicio/maquinas/${x.id}`} className="truncate hover:underline"><b className="cifra">{x.numero}</b> · {x.nombre}</Link>
                    <span className="cifra whitespace-nowrap">{numero(x.horas_fuera)} h · {numero(x.fallas)} falla{x.fallas === 1 ? "" : "s"}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-borde overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (x.horas_fuera / max) * 100)}%`, background: SERIE(1) }} /></div>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Por máquina" descripcion="Ordenadas por horas paradas; clic en una para abrir su ficha" />
        <div className="px-3 pb-3">
          <TablaDatos filas={d.maquinas} columnas={colMaq} claveFila={(x) => x.id} exportarComo="metricas-mantenimiento" placeholder="Buscar máquina…" />
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Vuelven a fallar" descripcion="Fallas a menos de 30 días de una reparación" explica={GLOSARIO.reincidencia} />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm">
            {d.reincidencias.length === 0 && <li className="py-6 text-center text-tenue">Ninguna en el periodo.</li>}
            {d.reincidencias.map((x) => (
              <li key={x.folio} className="py-2 flex gap-2">
                <RefreshCcw className="h-4 w-4 text-aviso shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{x.maquina}</p>
                  <p>{x.falla ?? "Sin descripción"}</p>
                  <p className="text-xs text-tenue">A los {numero(x.dias)} días de {x.anterior}{x.anterior_falla ? ` (${x.anterior_falla})` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Lo abierto" descripcion="Órdenes pendientes, de la más vieja a la más nueva" explica={GLOSARIO.backlogMantenimiento} />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm max-h-[340px] overflow-y-auto">
            {d.pendientes.length === 0 && <li className="py-6 text-center text-tenue">Nada abierto.</li>}
            {d.pendientes.map((x) => (
              <li key={x.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="truncate"><b className="cifra">{x.folio}</b> · {x.maquina}</span>
                  <span className={cn("cifra text-xs whitespace-nowrap", x.dias > 7 && "text-peligro font-medium")}>{numero(x.dias)} d</span>
                </div>
                <p className="text-xs text-tenue truncate">{x.tipo === "preventivo" ? `Preventivo${x.vence ? ` · vence ${fecha(x.vence)}` : ""}` : x.detiene ? "Falla · máquina parada" : "Falla"}{x.falla ? ` · ${x.falla}` : ""}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Horas del técnico" descripcion="Órdenes cerradas en el periodo, por quién las atendió" />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm">
            {d.tecnicos.length === 0 && <li className="py-6 text-center text-tenue">Sin órdenes cerradas en el periodo.</li>}
            {d.tecnicos.map((x) => (
              <li key={x.quien} className="py-2 flex justify-between gap-2">
                <span className="truncate">{x.quien}</span>
                <span className="cifra whitespace-nowrap">{numero(x.horas)} h <span className="text-tenue text-xs">· {numero(x.preventivas)} prev · {numero(x.correctivas)} fallas</span></span>
              </li>
            ))}
            {d.con_costos && r.costo != null && <li className="pt-3 flex justify-between font-medium"><span>Costo del periodo</span><span className="cifra">{dinero(r.costo)}</span></li>}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
