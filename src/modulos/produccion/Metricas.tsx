import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlarmClock, AlertTriangle, CheckCircle2, Clock, Factory, Gauge, Hourglass, Info, Layers, Lightbulb, Wrench,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useRpc } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero, porcentaje, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { folioCorto, horas } from "./componentes/util";

/**
 * Las métricas lean de la planta para la gerencia de producción y la ingeniería de procesos.
 * Todo lo calcula la base (metricas_produccion) con lo que se marca en la terminal; aquí solo
 * se muestra. Lo primero que se ve es cuánto se marcó: sin eso, una eficiencia de 95 % puede
 * salir de dos etapas.
 */

interface Etapa {
  etapa_id: number; etapa: string; color: string; terminadas: number; con_terminal: number;
  horas_estimadas: number | null; horas_reales: number | null; espera_h: number | null; trabajo_h: number | null;
  en_proceso: number; pausas: number; problemas: number; reabiertas: number;
  costo_estimado: number | null; costo_real: number | null;
}
interface Persona { nombre: string; area: string | null; horas: number; etapas: number; ordenes: number }
interface Equipo { equipo: string; clave: string; terminados: number; horas_estimadas: number | null; horas_reales: number | null; lead_time_dias: number | null }
interface Metricas {
  con_costos: boolean;
  resumen: {
    ordenes_terminadas: number; ordenes_con_fecha: number; ordenes_a_tiempo: number; pedidos_entregados: number; pedidos_a_tiempo: number;
    lead_time_dias: number | null; lead_time_mediana_dias: number | null; eficiencia_flujo: number | null;
    etapas_terminadas: number; etapas_con_terminal: number; horas_estimadas: number | null; horas_reales: number | null;
    en_proceso: number; pausadas: number; ordenes_abiertas: number; pausas: number; problemas: number; reabiertas: number;
  };
  semanas: { semana: string; a_tiempo: number; tarde: number; sin_fecha: number }[];
  etapas: Etapa[]; personas: Persona[]; equipos: Equipo[];
  problemas: { en: string; tipo: string; nota: string | null; etapa: string | null; folio: string }[];
  mantenimiento: {
    fallas: number; fallas_que_paran: number; horas_fuera: number | null; mttr_h: number | null;
    preventivos_hechos: number; preventivos_a_tiempo: number; preventivos_vencidos: number;
  };
}

type Periodo = "30" | "90" | "180" | "365";
const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "30", texto: "30 días" }, { valor: "90", texto: "90 días" }, { valor: "180", texto: "6 meses" }, { valor: "365", texto: "12 meses" },
];
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const fraccion = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b : null);

export default function Metricas() {
  const [params, setParams] = useSearchParams();
  const periodo = (PERIODOS.some((p) => p.valor === params.get("periodo")) ? params.get("periodo") : "90") as Periodo;
  const hasta = hoyISO();
  const desde = useMemo(() => restarDias(hasta, Number(periodo) - 1), [hasta, periodo]);
  const m = useRpc<Metricas>("metricas_produccion", { p_desde: desde, p_hasta: hasta }, { clave: ["metricas_produccion", desde, hasta] });

  return (
    <Pagina titulo="Métricas de producción" ancho="max-w-[1500px]"
      descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · lo que se marca en la terminal de piso`}
      acciones={<Filtro opciones={PERIODOS} valor={periodo} alCambiar={(v) => setParams(v === "90" ? {} : { periodo: v }, { replace: true })} />}>
      {m.error ? <ErrorCarga error={m.error} /> : m.isLoading || !m.data ? <Cargando filas={8} /> : <Contenido m={m.data} />}
    </Pagina>
  );
}

function Contenido({ m }: { m: Metricas }) {
  const r = m.resumen;
  const cobertura = fraccion(r.etapas_con_terminal, r.etapas_terminadas);
  const otd = fraccion(r.ordenes_a_tiempo, r.ordenes_con_fecha);
  const realVsEst = fraccion(r.horas_reales, r.horas_estimadas);
  const semanas = m.semanas.map((s) => ({ semana: fecha(s.semana).replace(/ \d{4}$/, ""), "A tiempo": s.a_tiempo, "Tarde": s.tarde, "Sin fecha": s.sin_fecha }));
  const hayTerminadas = r.ordenes_terminadas > 0;

  const colEtapas: Columna<Etapa>[] = [
    { clave: "etapa", titulo: "Etapa", celda: (e) => <span className="inline-flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />{e.etapa}</span> },
    { clave: "terminadas", titulo: "Terminadas", alinear: "der", valor: (e) => e.terminadas, celda: (e) => <span className="cifra">{numero(e.terminadas)}<span className="text-tenue text-xs"> · {numero(e.con_terminal)} marcadas</span></span>, explica: GLOSARIO.coberturaTerminal },
    { clave: "horas_reales", titulo: "Horas reales / estimadas", alinear: "der", valor: (e) => fraccion(e.horas_reales, e.horas_estimadas) ?? -1, explica: GLOSARIO.horasRealesVsEstimadas,
      celda: (e) => e.horas_reales == null ? <span className="text-tenue">Sin marcar</span>
        : <span className="cifra">{horas(e.horas_reales)} / {horas(e.horas_estimadas)} <ColorDesvio f={fraccion(e.horas_reales, e.horas_estimadas)} /></span> },
    { clave: "espera_h", titulo: "Espera prom.", alinear: "der", valor: (e) => e.espera_h ?? -1, celda: (e) => <span className="cifra">{horas(e.espera_h)}</span>, explica: GLOSARIO.esperaEtapa },
    { clave: "trabajo_h", titulo: "Trabajo prom.", alinear: "der", valor: (e) => e.trabajo_h ?? -1, celda: (e) => <span className="cifra">{horas(e.trabajo_h)}</span>, explica: GLOSARIO.trabajoEtapa },
    { clave: "en_proceso", titulo: "En proceso hoy", alinear: "der", valor: (e) => e.en_proceso, celda: (e) => <span className="cifra">{numero(e.en_proceso)}</span>, explica: GLOSARIO.trabajoEnProceso },
    { clave: "pausas", titulo: "Pausas · problemas · reabiertas", alinear: "der", valor: (e) => e.pausas + e.problemas + e.reabiertas, explica: GLOSARIO.parosRetrabajo,
      celda: (e) => <span className="cifra">{numero(e.pausas)} · {numero(e.problemas)} · <span className={cn(e.reabiertas > 0 && "text-aviso font-medium")}>{numero(e.reabiertas)}</span></span> },
    ...(m.con_costos ? [{
      clave: "costo_real", titulo: "Mano de obra real / estimada", alinear: "der" as const, valor: (e: Etapa) => (e.costo_real ?? 0) - (e.costo_estimado ?? 0), explica: GLOSARIO.costoDesperdicio,
      celda: (e: Etapa) => e.costo_real == null ? <span className="text-tenue">—</span>
        : <span className="cifra">{dinero(e.costo_real)} / {dinero(e.costo_estimado)}{(e.costo_real ?? 0) > (e.costo_estimado ?? 0) && <span className="text-peligro text-xs"> +{dinero((e.costo_real ?? 0) - (e.costo_estimado ?? 0))}</span>}</span>,
    }] : []),
  ];
  const colPersonas: Columna<Persona>[] = [
    { clave: "nombre", titulo: "Persona", clase: "font-medium" },
    { clave: "area", titulo: "Área", clase: "text-tenue", celda: (p) => p.area ?? "—" },
    { clave: "horas", titulo: "Horas hombre", alinear: "der", valor: (p) => p.horas, celda: (p) => <span className="cifra">{horas(p.horas)}</span>, explica: GLOSARIO.horasHombre },
    { clave: "etapas", titulo: "Etapas", alinear: "der", valor: (p) => p.etapas, celda: (p) => <span className="cifra">{numero(p.etapas)}</span> },
    { clave: "ordenes", titulo: "Órdenes", alinear: "der", valor: (p) => p.ordenes, celda: (p) => <span className="cifra">{numero(p.ordenes)}</span> },
  ];
  const colEquipos: Columna<Equipo>[] = [
    { clave: "equipo", titulo: "Equipo", celda: (e) => <div className="min-w-[220px]">{e.equipo}<p className="text-xs text-tenue cifra">{e.clave}</p></div> },
    { clave: "terminados", titulo: "Terminados", alinear: "der", valor: (e) => e.terminados, celda: (e) => <span className="cifra">{numero(e.terminados)}</span> },
    { clave: "horas_reales", titulo: "Horas por equipo (real / estimada)", alinear: "der", valor: (e) => fraccion(e.horas_reales, e.horas_estimadas) ?? -1, explica: GLOSARIO.horasRealesVsEstimadas,
      celda: (e) => e.horas_reales == null ? <span className="text-tenue">Sin marcar · {horas(e.horas_estimadas)} est.</span>
        : <span className="cifra">{horas(e.horas_reales)} / {horas(e.horas_estimadas)} <ColorDesvio f={fraccion(e.horas_reales, e.horas_estimadas)} /></span> },
    { clave: "lead_time_dias", titulo: "Lead time prom.", alinear: "der", valor: (e) => e.lead_time_dias ?? -1, celda: (e) => <span className="cifra">{e.lead_time_dias == null ? "—" : `${numero(e.lead_time_dias)} días`}</span>, explica: GLOSARIO.leadTime },
  ];

  return (
    <div className="space-y-4">
      {(cobertura == null || cobertura < 0.8) && (
        <div className="tarjeta p-4 flex gap-3 border-aviso/40 bg-aviso-suave" data-explain={GLOSARIO.coberturaTerminal} data-explain-title="Cuánto creerle a estos números">
          <Info className="h-5 w-5 text-aviso shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              {r.etapas_terminadas === 0 ? "Todavía no hay etapas terminadas en este periodo."
                : `Solo ${porcentaje(cobertura, 0)} de las etapas terminadas (${numero(r.etapas_con_terminal)} de ${numero(r.etapas_terminadas)}) se marcaron en la terminal con quién las trabajó.`}
            </p>
            <p className="text-tenue">Las horas, la eficiencia del flujo y los tiempos salen de lo que el piso marca: mientras más se use la terminal (iniciar, pausar, terminar y quién trabaja), más confiables son. Las entregas a tiempo y los terminados no dependen de eso.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Entregas a tiempo" valor={porcentaje(otd, 0)} icono={CheckCircle2} tono={otd == null ? "neutro" : otd >= 0.9 ? "ok" : otd >= 0.7 ? "aviso" : "peligro"}
          detalle={`${numero(r.ordenes_a_tiempo)} de ${numero(r.ordenes_con_fecha)} órdenes · pedidos ${porcentaje(fraccion(r.pedidos_a_tiempo, r.pedidos_entregados), 0)}`} explica={GLOSARIO.entregasATiempo} />
        <Kpi titulo="Equipos terminados" valor={numero(r.ordenes_terminadas)} icono={Factory} tono="marca"
          detalle={`${numero(r.ordenes_abiertas)} órdenes abiertas hoy`} explica={GLOSARIO.equiposTerminados} />
        <Kpi titulo="Lead time" valor={r.lead_time_dias == null ? "—" : `${numero(r.lead_time_dias)} días`} icono={Hourglass} tono="info"
          detalle={r.lead_time_mediana_dias == null ? "de liberada a terminada" : `mediana ${numero(r.lead_time_mediana_dias)} días`} explica={GLOSARIO.leadTime} />
        <Kpi titulo="Eficiencia del flujo" valor={r.eficiencia_flujo == null ? "—" : `${numero(r.eficiencia_flujo)}%`} icono={Gauge} tono="info"
          detalle="del tiempo en taller, cuánto se trabajó" explica={GLOSARIO.eficienciaFlujo} />
        <Kpi titulo="Horas reales / estimadas" valor={porcentaje(realVsEst, 0)} icono={Clock}
          tono={realVsEst == null ? "neutro" : realVsEst <= 1.05 ? "ok" : realVsEst <= 1.2 ? "aviso" : "peligro"}
          detalle={realVsEst == null ? "sin etapas marcadas" : `${horas(r.horas_reales)} de ${horas(r.horas_estimadas)}`} explica={GLOSARIO.horasRealesVsEstimadas} />
        <Kpi titulo="Trabajo en proceso" valor={numero(r.en_proceso)} icono={Layers} tono="neutro"
          detalle={`${numero(r.pausadas)} pausadas ahorita`} explica={GLOSARIO.trabajoEnProceso} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Equipos terminados por semana" descripcion="Contra su fecha compromiso" explica={GLOSARIO.entregasATiempo} />
          {hayTerminadas ? (
            <>
              <div className="px-5"><Leyenda series={[{ nombre: "A tiempo", color: SERIE(1) }, { nombre: "Tarde", color: SERIE(2) }, { nombre: "Sin fecha", color: SERIE(3) }]} /></div>
              <div className="h-60 px-2 pb-3 pt-2">
                <ResponsiveContainer>
                  <BarChart data={semanas} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                    <XAxis dataKey="semana" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...ejeProps} allowDecimals={false} width={32} />
                    <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => `${numero(v)} equipos`} />} />
                    {["A tiempo", "Tarde", "Sin fecha"].map((n, k) => (
                      <Bar key={n} dataKey={n} stackId="s" fill={SERIE(k + 1)} stroke="hsl(var(--superficie))" strokeWidth={2} radius={k === 2 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : <p className="px-5 pb-6 text-sm text-tenue">Ningún equipo se terminó en este periodo. Prueba con un periodo más largo.</p>}
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Máquinas" descripcion="Fallas y preventivos del periodo" explica={GLOSARIO.mantenimientoMetricas} />
          <dl className="px-5 pb-5 grid grid-cols-2 gap-4 text-sm">
            <Dato icono={AlertTriangle} titulo="Fallas" valor={numero(m.mantenimiento.fallas)} detalle={`${numero(m.mantenimiento.fallas_que_paran)} pararon la máquina`} />
            <Dato icono={AlarmClock} titulo="Horas fuera de servicio" valor={horas(m.mantenimiento.horas_fuera ?? 0)} />
            <Dato icono={Wrench} titulo="Tiempo de reparación" valor={m.mantenimiento.mttr_h == null ? "—" : horas(m.mantenimiento.mttr_h)} detalle="promedio, de reporte a cierre" />
            <Dato icono={CheckCircle2} titulo="Preventivos a tiempo" valor={`${numero(m.mantenimiento.preventivos_a_tiempo)} de ${numero(m.mantenimiento.preventivos_hechos)}`}
              detalle={m.mantenimiento.preventivos_vencidos ? `${numero(m.mantenimiento.preventivos_vencidos)} vencidos sin hacer` : "ninguno vencido"} />
          </dl>
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Por etapa" descripcion="Dónde se va el tiempo: cuánto espera cada etapa para empezar y cuánto se trabaja" />
        <div className="px-3 pb-3">
          <TablaDatos filas={m.etapas} columnas={colEtapas} claveFila={(e) => String(e.etapa_id)} exportarComo="metricas-por-etapa" buscable={false} />
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Por equipo" descripcion="Horas por equipo terminado contra lo que dice el costeo" />
          <div className="px-3 pb-3">
            <TablaDatos filas={m.equipos} columnas={colEquipos} claveFila={(e) => e.clave} exportarComo="metricas-por-equipo"
              vacio={{ icono: Factory, titulo: "Sin equipos terminados", texto: "Cuando el taller termine equipos en este periodo, aquí sale cuánto tardó cada uno." }} />
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Por persona" descripcion="Horas hombre marcadas en la terminal en el periodo" explica={GLOSARIO.horasHombre} />
          <div className="px-3 pb-3">
            <TablaDatos filas={m.personas} columnas={colPersonas} claveFila={(p) => p.nombre} exportarComo="metricas-por-persona"
              vacio={{ icono: Clock, titulo: "Nadie marcado todavía", texto: "Al iniciar una etapa en la terminal se elige quién la trabaja; de ahí salen estas horas." }} />
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Problemas y retrabajo" descripcion="Lo que reportó el piso y las etapas que se reabrieron" explica={GLOSARIO.parosRetrabajo} />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm">
            {m.problemas.length === 0 && <li className="py-6 text-center text-tenue">Sin problemas reportados en el periodo.</li>}
            {m.problemas.map((p, i) => (
              <li key={i} className="py-2 flex gap-3">
                <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", p.tipo === "reabierta" ? "text-aviso" : "text-peligro")} />
                <div className="min-w-0">
                  <p>{p.tipo === "reabierta" ? "Reabierta: " : ""}{p.nota ?? "Sin nota"}</p>
                  <p className="text-xs text-tenue cifra">{folioCorto(p.folio)}{p.etapa && ` · ${p.etapa}`} · {fechaYHora(p.en)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Herramientas lean" descripcion="Se irán habilitando conforme el equipo de ingeniería de procesos las use" />
          <div className="px-5 pb-5 text-sm space-y-2" data-explain={GLOSARIO.herramientasLean} data-explain-title="Herramientas lean">
            {[["5S", "auditorías por área con su calificación y fotos"], ["Kaizen", "registro de mejoras: problema, idea, responsable y resultado"],
              ["A3", "solución de problemas en una hoja, ligada a la orden o la máquina"], ["OEE", "disponibilidad, rendimiento y calidad del plasma y las máquinas clave"],
              ["SMED", "tiempos de cambio de modelo o de herramienta"]].map(([t, d]) => (
              <p key={t} className="flex gap-2"><Lightbulb className="h-4 w-4 text-tenue shrink-0 mt-0.5" /><span><b>{t}</b> <span className="text-tenue">· {d}</span></span></p>
            ))}
            <p className="text-tenue pt-1">Dile a sistemas cuál quieren empezar a usar.</p>
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

function ColorDesvio({ f }: { f: number | null }) {
  if (f == null) return null;
  return <span className={cn("text-xs font-medium", f <= 1.05 ? "text-ok" : f <= 1.2 ? "text-aviso" : "text-peligro")}>({porcentaje(f, 0)})</span>;
}

function Dato({ icono: Icono, titulo, valor, detalle }: { icono: typeof Clock; titulo: string; valor: string; detalle?: string }) {
  return (
    <div>
      <dt className="text-xs text-tenue flex items-center gap-1"><Icono className="h-3.5 w-3.5" />{titulo}</dt>
      <dd className="text-xl font-semibold cifra">{valor}</dd>
      {detalle && <dd className="text-xs text-tenue">{detalle}</dd>}
    </div>
  );
}
