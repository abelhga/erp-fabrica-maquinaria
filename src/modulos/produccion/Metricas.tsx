import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlarmClock, AlertTriangle, CheckCircle2, Clock, Factory, Gauge, Hourglass, Layers, Lightbulb, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { useRpc, useTiempoReal } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero, porcentaje, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { useSesion } from "@/lib/sesion";
import { folioCorto, horas } from "./componentes/util";
import { BotonLink } from "./componentes/BotonLink";
import {
  Cumplimiento, EdadTrabajo, EsperaTrabajo, FlujoAcumulado, HorasContraCosteo, HorasDetenidas, RegistroTerminal, type AnaliticaProd,
} from "./componentes/GraficasProduccion";

/**
 * Las métricas lean de la planta para la gerencia de producción y la ingeniería de procesos.
 * Todo lo calcula la base (metricas_produccion y produccion_analitica) con lo que se marca en la
 * terminal; aquí solo se muestra. Junto al cumplimiento va cuánto se marcó: sin eso, una eficiencia
 * de 95 % puede salir de dos etapas. Lo que se decide va primero; las tablas, al final.
 */

interface Etapa {
  etapa_id: number; etapa: string; terminadas: number; con_terminal: number; validas: number;
  horas_estimadas: number | null; horas_reales: number | null; espera_h: number | null; trabajo_h: number | null;
  en_proceso: number; pausas: number; problemas: number; reabiertas: number;
  costo_estimado: number | null; costo_real: number | null;
}
interface Persona { nombre: string; area: string | null; horas: number; etapas: number; ordenes: number }
interface Equipo { equipo: string; clave: string; terminados: number; completos: number; horas_estimadas: number | null; horas_reales: number | null; lead_time_dias: number | null }
interface Metricas {
  con_costos: boolean;
  resumen: {
    ordenes_terminadas: number; ordenes_de_la_hoja: number; ordenes_con_fecha: number; ordenes_a_tiempo: number; ordenes_vencidas_abiertas: number;
    pedidos_entregados: number; pedidos_a_tiempo: number;
    ordenes_con_tiempos: number; lead_time_dias: number | null; lead_time_mediana_dias: number | null; eficiencia_flujo: number | null;
    etapas_terminadas: number; etapas_con_terminal: number; etapas_validas: number; horas_estimadas: number | null; horas_reales: number | null;
    en_proceso: number; pausadas: number; ordenes_abiertas: number; pausas: number; problemas: number; reabiertas: number;
  };
  etapas: Etapa[]; personas: Persona[]; equipos: Equipo[];
  problemas: { en: string; tipo: string; nota: string | null; etapa: string | null; folio: string }[];
  mantenimiento: {
    fallas: number; fallas_que_paran: number; horas_fuera: number | null; mttr_h: number | null;
    preventivos_hechos: number; preventivos_a_tiempo: number; preventivos_vencidos: number;
  };
}

type Periodo = "30" | "90" | "180" | "365";
const PERIODOS: { valor: Periodo; texto: string; explica: string }[] = [
  { valor: "30", texto: "30 días", explica: GLOSARIO.periodoMetricas }, { valor: "90", texto: "90 días", explica: GLOSARIO.periodoMetricas },
  { valor: "180", texto: "6 meses", explica: GLOSARIO.periodoMetricas }, { valor: "365", texto: "12 meses", explica: GLOSARIO.periodoMetricas },
];
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const fraccion = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b : null);

export default function Metricas() {
  const [params, setParams] = useSearchParams();
  const periodo = (PERIODOS.some((p) => p.valor === params.get("periodo")) ? params.get("periodo") : "90") as Periodo;
  const hasta = hoyISO();
  const desde = useMemo(() => restarDias(hasta, Number(periodo) - 1), [hasta, periodo]);
  const m = useRpc<Metricas>("metricas_produccion", { p_desde: desde, p_hasta: hasta }, { clave: ["metricas_produccion", desde, hasta] });
  // Lo que cruza el plan, la edad de lo abierto y el flujo por día va aparte: no detiene los indicadores.
  const a = useRpc<AnaliticaProd>("produccion_analitica", { p_desde: desde, p_hasta: hasta }, { clave: ["produccion_analitica", desde, hasta] });
  useTiempoReal("op_operaciones", [["produccion_analitica"], ["metricas_produccion"]]);

  return (
    <Pagina titulo="Métricas de producción" ancho="max-w-[1500px]"
      descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · lo que se marca en la terminal de piso`}
      acciones={<Filtro opciones={PERIODOS} valor={periodo} alCambiar={(v) => setParams(v === "90" ? {} : { periodo: v }, { replace: true })} />}>
      {m.error ? <ErrorCarga error={m.error} /> : m.isLoading || !m.data ? <Cargando filas={8} /> : <Contenido m={m.data} a={a.data} errorA={a.error} />}
    </Pagina>
  );
}

function Contenido({ m, a, errorA }: { m: Metricas; a?: AnaliticaProd; errorA: Error | null }) {
  const r = m.resumen;
  // Las vencidas que siguen abiertas ya son tarde: cuentan en el denominador (como analisis_entregas).
  const juzgadas = r.ordenes_con_fecha + r.ordenes_vencidas_abiertas;
  const otd = fraccion(r.ordenes_a_tiempo, juzgadas);
  const realVsEst = fraccion(r.horas_reales, r.horas_estimadas);
  const sinLiberadas = r.ordenes_con_tiempos === 0;
  // Mejoras es de quien captura en producción; ingeniería solo ve las métricas.
  const { puede } = useSesion();
  const analitica = (hijo: (a: AnaliticaProd) => React.ReactNode) =>
    errorA ? <div className="px-5 pb-5"><ErrorCarga error={errorA} /></div> : a ? hijo(a) : <div className="px-5 pb-5"><Cargando filas={4} /></div>;

  const colEtapas: Columna<Etapa>[] = [
    { clave: "etapa", titulo: "Etapa", clase: "font-medium" },
    { clave: "terminadas", titulo: "Terminadas", alinear: "der", valor: (e) => e.terminadas, celda: (e) => <span className="cifra whitespace-nowrap">{numero(e.terminadas)}<span className="text-tenue text-xs"> · {numero(e.validas)} con tiempo</span></span>, explica: GLOSARIO.registroTerminal },
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
    { clave: "terminados", titulo: "Terminados", alinear: "der", valor: (e) => e.terminados, celda: (e) => <span className="cifra">{numero(e.terminados)}</span>, explica: GLOSARIO.equiposTerminados },
    { clave: "horas_reales", titulo: "Horas por equipo (real / estimada)", alinear: "der", valor: (e) => fraccion(e.horas_reales, e.horas_estimadas) ?? -1, explica: GLOSARIO.horasRealesVsEstimadas,
      // Las reales salen solo de los equipos con todas sus etapas marcadas desde el principio.
      celda: (e) => e.horas_reales == null ? <span className="text-tenue">Sin marcar completo · {horas(e.horas_estimadas)} est.</span>
        : <span className="cifra">{horas(e.horas_reales)} / {horas(e.horas_estimadas)} <ColorDesvio f={fraccion(e.horas_reales, e.horas_estimadas)} />
            {e.completos < e.terminados && <span className="text-tenue text-xs"> · de {numero(e.completos)}</span>}</span> },
    { clave: "lead_time_dias", titulo: "Lead time prom.", alinear: "der", valor: (e) => e.lead_time_dias ?? -1, celda: (e) => <span className="cifra">{e.lead_time_dias == null ? "—" : `${numero(e.lead_time_dias)} días`}</span>, explica: GLOSARIO.leadTime },
  ];

  return (
    <div className="space-y-4">
      {/* Seis en fila solo en pantalla ancha: los detalles dicen de dónde sale cada cifra y no caben en 180 px. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi titulo="Entregas a tiempo" valor={porcentaje(otd, 0)} icono={CheckCircle2} tono={otd == null ? "neutro" : otd >= 0.9 ? "ok" : otd >= 0.7 ? "aviso" : "peligro"}
          detalle={`${numero(r.ordenes_a_tiempo)} de ${numero(juzgadas)} órdenes${r.ordenes_vencidas_abiertas ? ` (${numero(r.ordenes_vencidas_abiertas)} vencidas sin terminar)` : ""} · pedidos ${porcentaje(fraccion(r.pedidos_a_tiempo, r.pedidos_entregados), 0)}`}
          explica={GLOSARIO.entregasATiempo} />
        <Kpi titulo="Equipos terminados" valor={numero(r.ordenes_terminadas)} icono={Factory} tono="marca"
          detalle={`${r.ordenes_de_la_hoja ? `${numero(r.ordenes_de_la_hoja)} venían de la hoja · ` : ""}${numero(r.ordenes_abiertas)} órdenes abiertas hoy`} explica={GLOSARIO.equiposTerminados} />
        <Kpi titulo="Lead time" valor={r.lead_time_dias == null ? "—" : `${numero(r.lead_time_dias)} días`} icono={Hourglass} tono="info"
          detalle={sinLiberadas ? "faltan órdenes liberadas en el ERP" : r.lead_time_mediana_dias == null ? "de liberada a terminada" : `mediana ${numero(r.lead_time_mediana_dias)} días · ${numero(r.ordenes_con_tiempos)} órdenes`}
          explica={GLOSARIO.leadTime} />
        <Kpi titulo="Eficiencia del flujo" valor={r.eficiencia_flujo == null ? "—" : `${numero(r.eficiencia_flujo)}%`} icono={Gauge} tono="info"
          detalle={sinLiberadas ? "faltan órdenes liberadas en el ERP" : "del tiempo en taller, cuánto se trabajó"} explica={GLOSARIO.eficienciaFlujo} />
        <Kpi titulo="Horas reales / estimadas" valor={porcentaje(realVsEst, 0)} icono={Clock}
          tono={realVsEst == null ? "neutro" : realVsEst <= 1.05 ? "ok" : realVsEst <= 1.2 ? "aviso" : "peligro"}
          detalle={realVsEst == null ? "ninguna etapa con tiempo completo" : `${horas(r.horas_reales)} de ${horas(r.horas_estimadas)} · ${numero(r.etapas_validas)} ${r.etapas_validas === 1 ? "etapa" : "etapas"}`}
          explica={GLOSARIO.horasRealesVsEstimadas} />
        <Kpi titulo="Trabajo en proceso" valor={numero(r.en_proceso)} icono={Layers} tono="neutro"
          detalle={`${numero(r.pausadas)} pausadas ahorita`} explica={GLOSARIO.trabajoEnProceso} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Tarjeta className="lg:col-span-3 min-w-0">
          <EncabezadoTarjeta titulo="Cumplimiento de la fecha compromiso" explica={GLOSARIO.diasContraCompromiso}
            descripcion="Días antes o después de su fecha: arriba lo que ya salió o ya se venció; abajo lo que viene según el plan del taller" />
          {analitica((x) => <Cumplimiento a={x} />)}
        </Tarjeta>
        <Tarjeta className="lg:col-span-2 min-w-0">
          <EncabezadoTarjeta titulo="Cuánto creerle a cada número" explica={GLOSARIO.registroTerminal}
            descripcion="De las etapas terminadas, cuántas pasaron por la terminal con su gente y sus horas" />
          {analitica((x) => <RegistroTerminal a={x} />)}
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Tarjeta className="lg:col-span-3 min-w-0">
          <EncabezadoTarjeta titulo="Dónde se atora, hoy" explica={GLOSARIO.edadTrabajo}
            descripcion="Cada punto es una etapa abierta y cuántas jornadas lleva en su estado; clic para abrir su orden" />
          {analitica((x) => <EdadTrabajo a={x} />)}
        </Tarjeta>
        <Tarjeta className="lg:col-span-2 min-w-0">
          <EncabezadoTarjeta titulo="Espera contra trabajo" explica={GLOSARIO.esperaVsTrabajo}
            descripcion="En promedio por área, en jornadas: cuánto esperó para empezar, cuánto se trabajó y cuánto estuvo detenida" />
          {analitica((x) => <EsperaTrabajo a={x} />)}
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Tarjeta className="lg:col-span-3 min-w-0">
          <EncabezadoTarjeta titulo="Horas reales contra las del costeo" explica={GLOSARIO.horasContraCosteo}
            descripcion="Cada punto es una etapa; 1× es lo estimado. Las que la terminal vio desde que empezaron." />
          {analitica((x) => <HorasContraCosteo a={x} />)}
        </Tarjeta>
        <Tarjeta className="lg:col-span-2 min-w-0">
          <EncabezadoTarjeta titulo="Horas detenidas por motivo" explica={GLOSARIO.horasDetenidas}
            descripcion="Qué detiene más al taller, del motivo que el piso elige al pausar" />
          {analitica((x) => <HorasDetenidas a={x} />)}
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Flujo acumulado por área" explica={GLOSARIO.flujoAcumulado}
          descripcion="Horas del costeo terminadas, en proceso y en cola, día por día: la franja de cola que se ensancha es trabajo que llega más rápido de lo que sale" />
        {analitica((x) => <FlujoAcumulado a={x} />)}
      </Tarjeta>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Por etapa" descripcion="Dónde se va el tiempo: cuánto espera cada etapa para empezar y cuánto se trabaja" explica={GLOSARIO.metricasPorEtapa} />
        <div className="px-3 pb-3">
          <TablaDatos filas={m.etapas} columnas={colEtapas} claveFila={(e) => String(e.etapa_id)} exportarComo="metricas-por-etapa" buscable={false} />
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Por equipo" descripcion="Horas por equipo terminado contra lo que dice el costeo" explica={GLOSARIO.metricasPorEquipo} />
          <div className="px-3 pb-3">
            <TablaDatos filas={m.equipos} columnas={colEquipos} claveFila={(e) => e.clave} exportarComo="metricas-por-equipo"
              vacio={{ icono: Factory, titulo: "Sin equipos terminados", texto: "Cuando el taller termine equipos en este periodo, aquí sale cuánto tardó cada uno." }} />
          </div>
        </Tarjeta>
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Por persona" descripcion="Horas hombre marcadas en la terminal en el periodo" explica={GLOSARIO.horasHombre} />
          <div className="px-3 pb-3">
            <TablaDatos filas={m.personas} columnas={colPersonas} claveFila={(p) => p.nombre} exportarComo="metricas-por-persona"
              vacio={{ icono: Clock, titulo: "Nadie marcado todavía", texto: "Al iniciar una etapa en la terminal se elige quién la trabaja; de ahí salen estas horas." }} />
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Problemas y retrabajo" descripcion="Lo que reportó el piso y las etapas que se reabrieron" explica={GLOSARIO.parosRetrabajo}
            acciones={puede("produccion", 2) ? <span className="inline-flex" data-explain={GLOSARIO.mejoraKaizen} data-explain-title="Ver mejoras">
              <BotonLink a="/produccion/mejoras"><Lightbulb className="h-4 w-4" />Ver mejoras</BotonLink></span> : undefined} />
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
        <Tarjeta className="min-w-0">
          <EncabezadoTarjeta titulo="Máquinas" descripcion="Fallas y preventivos del periodo" explica={GLOSARIO.mantenimientoMetricas}
            acciones={puede("mantenimiento", 1) ? <BotonLink a="/servicio/metricas"><Gauge className="h-4 w-4" />Métricas de mantenimiento</BotonLink> : undefined} />
          <dl className="px-5 pb-5 grid grid-cols-2 gap-4 text-sm" data-explain={GLOSARIO.mantenimientoMetricas} data-explain-title="Máquinas">
            <Dato icono={AlertTriangle} titulo="Fallas" valor={numero(m.mantenimiento.fallas)} detalle={`${numero(m.mantenimiento.fallas_que_paran)} pararon la máquina`} />
            <Dato icono={AlarmClock} titulo="Horas fuera de servicio" valor={horas(m.mantenimiento.horas_fuera ?? 0)} />
            <Dato icono={Wrench} titulo="Tiempo de reparación" valor={m.mantenimiento.mttr_h == null ? "—" : horas(m.mantenimiento.mttr_h)} detalle="promedio, de reporte a cierre" />
            <Dato icono={CheckCircle2} titulo="Preventivos a tiempo" valor={`${numero(m.mantenimiento.preventivos_a_tiempo)} de ${numero(m.mantenimiento.preventivos_hechos)}`}
              detalle={m.mantenimiento.preventivos_vencidos ? `${numero(m.mantenimiento.preventivos_vencidos)} vencidos sin hacer` : "ninguno vencido"} />
          </dl>
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
