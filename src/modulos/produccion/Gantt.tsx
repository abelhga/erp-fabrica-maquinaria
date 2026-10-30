import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { unoDe, usePreferencia } from "@/lib/preferencias";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock, CalendarCheck2, ChevronDown, ChevronUp, ChevronsUp, ExternalLink, GanttChart, GripVertical, Layers, Search, Timer,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Filtro } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, hoyISO, numero } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import {
  CLAVE, useAsignaciones, useCarga, useCuadrillas, useEspecialidades, useEtapas, usePersonalPiso, useProduccionEnVivo, useTablero,
  type Especialidad, type Etapa, type EstadoOperacion, type OrdenTablero,
} from "./componentes/datos";
import { ESTADO_OPERACION, abreviarEquipo, folioCorto, horas } from "./componentes/util";

/**
 * El Gantt del taller. Las fechas no salen de aquí: plan_produccion() simula el taller en la
 * base (capacidad de cada área, cuadrilla de cada etapa, el orden de la cola) y esta pantalla
 * solo lo dibuja. Así la TV, el calendario y esta pantalla dicen lo mismo, y cualquier cambio
 * en el piso (alguien termina, se pausa, la gerencia reacomoda) llega en vivo y las barras se
 * recorren solas.
 */

interface FilaPlan {
  operacion_id: string; orden_id: string; etapa_id: number; estado: EstadoOperacion; horas_estimadas: number;
  horas_restantes: number; gente: number; inicio_real: string | null; fin_real: string | null;
  inicio_plan: string | null; fin_plan: string | null; posicion: number | null;
  /** La especialidad del área que hace esta familia de equipo (la cuadrilla de cribadoras…). */
  especialidad_id: number | null;
}
interface Barra {
  id: string; orden_id: string; etapa: Etapa; estado: EstadoOperacion; desde: number | null; hasta: number | null; esp: number | null;
  horasEst: number; horasRest: number; inicioReal: string | null; finReal: string | null; inicioPlan: string | null; finPlan: string | null;
}
interface OrdenGantt {
  id: string; o: OrdenTablero; barras: Barra[]; posicion: number | null; enEspera: boolean;
  fin: number | null; compromiso: number | null; retraso: number;
}
type Item =
  | { tipo: "grupo"; clave: string; y: number; h: number; titulo: string; detalle: string; ordenes: OrdenGantt[]; espera?: boolean }
  | { tipo: "orden"; clave: string; y: number; h: number; g: OrdenGantt }
  | { tipo: "area"; clave: string; y: number; h: number; etapa: Etapa; semanas: number | null; carriles: { b: Barra; g: OrdenGantt; carril: number }[];
      /** Un área con especialidades va en un renglón por especialidad (y uno con lo que hace cualquiera). */
      sub: string | null; horasSemana: number };

type Zoom = "dia" | "semana" | "mes";
type Vista = "orden" | "pedido" | "area";
type Ver = "todas" | "tarde";

const PX: Record<Zoom, number> = { dia: 42, semana: 18, mes: 5 };
const ZOOMS: { valor: Zoom; texto: string }[] = [{ valor: "dia", texto: "Días" }, { valor: "semana", texto: "Semanas" }, { valor: "mes", texto: "Meses" }];
const ALTO_ORDEN = 56, ALTO_GRUPO = 36, ALTO_CARRIL = 28, ALTO_REGLA = 48;

// Días como números enteros (días desde 1970): restar fechas sin pelearse con zonas horarias.
const DIA = 86_400_000;
const aDia = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / DIA); };
const deDia = (n: number) => new Date(n * DIA).toISOString().slice(0, 10);
const diaMx = (ts: string) => aDia(new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }));
/** 0 = lunes … 6 = domingo. */
const diaSemana = (n: number) => (new Date(n * DIA).getUTCDay() + 6) % 7;
const diaDelMes = (n: number) => new Date(n * DIA).getUTCDate();
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesDe = (n: number) => new Date(n * DIA).getUTCMonth();
const anioDe = (n: number) => new Date(n * DIA).getUTCFullYear();
const fechaCorta = (n: number) => `${diaDelMes(n)} ${MESES[mesDe(n)].slice(0, 3)}`;
const nombreCorto = (n: string) => n.replace(/\s*\(.*\)\s*$/, "").split(/\s+/).slice(0, 2).join(" ");

/** Texto claro u oscuro según qué tan clara es la etapa (el amarillo de Eléctrico no aguanta blanco). */
function tinta(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#ffffff";
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? "#1f2937" : "#ffffff";
}

/** De qué día a qué día se dibuja una etapa: lo real para lo que pasó, el plan para lo que viene. */
function rango(f: FilaPlan, hoy: number): [number, number] | null {
  if (f.estado === "terminada") {
    const a = f.inicio_real ? diaMx(f.inicio_real) : f.fin_real ? diaMx(f.fin_real) : null;
    const b = f.fin_real ? diaMx(f.fin_real) : a;
    return a == null || b == null ? null : [Math.min(a, b), Math.max(a, b)];
  }
  if (f.estado === "en_proceso" || f.estado === "pausada") {
    const a = f.inicio_real ? diaMx(f.inicio_real) : f.inicio_plan ? aDia(f.inicio_plan) : null;
    if (a == null) return null;
    const b = f.fin_plan ? aDia(f.fin_plan) : Math.max(a, hoy);
    return [Math.min(a, b), Math.max(a, b)];
  }
  return f.inicio_plan && f.fin_plan ? [aDia(f.inicio_plan), aDia(f.fin_plan)] : null;
}

/**
 * Una etapa en paralelo (Torno) cae en los mismos días que otra de su orden: en el renglón de la
 * orden va en una segunda línea, si no las dos barras se encimaban con los nombres revueltos.
 * Una que empieza el día en que acaba la anterior se queda en la misma línea (como siempre).
 */
function lineasDeOrden(barras: Barra[]): { linea: Map<string, number>; total: number } {
  const fines: number[] = [];
  const linea = new Map<string, number>();
  const conFecha = barras.filter((b) => b.desde != null && b.hasta != null)
    .sort((a, b) => a.desde! - b.desde! || a.etapa.orden - b.etapa.orden);
  for (const b of conFecha) {
    let l = fines.findIndex((f) => f <= b.desde!);
    if (l < 0) { l = fines.length; fines.push(b.hasta!); } else fines[l] = b.hasta!;
    linea.set(b.id, l);
  }
  return { linea, total: Math.max(fines.length, 1) };
}

function armar(plan: FilaPlan[], ordenes: OrdenTablero[], etapas: Etapa[], hoy: number): OrdenGantt[] {
  const porId = new Map(ordenes.map((o) => [o.id, o]));
  const ets = new Map(etapas.map((e) => [e.id, e]));
  const m = new Map<string, OrdenGantt>();
  for (const f of plan) {
    const o = porId.get(f.orden_id);
    const etapa = ets.get(f.etapa_id);
    if (!o || !etapa) continue;
    let g = m.get(o.id);
    if (!g) {
      g = { id: o.id, o, barras: [], posicion: f.posicion, enEspera: !!o.en_espera_motivo, fin: null,
        compromiso: o.fecha_compromiso ? aDia(o.fecha_compromiso) : null, retraso: 0 };
      m.set(o.id, g);
    }
    const r = rango(f, hoy);
    g.barras.push({
      id: f.operacion_id, orden_id: o.id, etapa, estado: f.estado, desde: r?.[0] ?? null, hasta: r?.[1] ?? null, esp: f.especialidad_id ?? null,
      horasEst: Number(f.horas_estimadas), horasRest: Number(f.horas_restantes),
      inicioReal: f.inicio_real, finReal: f.fin_real, inicioPlan: f.inicio_plan, finPlan: f.fin_plan,
    });
  }
  for (const g of m.values()) {
    g.barras.sort((a, b) => a.etapa.orden - b.etapa.orden);
    const sinPlan = g.barras.some((b) => b.estado !== "terminada" && b.hasta == null);
    const hastas = g.barras.map((b) => b.hasta).filter((h): h is number => h != null);
    g.fin = g.enEspera || sinPlan || !hastas.length ? null : Math.max(...hastas);
    g.retraso = g.compromiso != null && g.fin != null && g.fin > g.compromiso ? g.fin - g.compromiso : 0;
  }
  return [...m.values()];
}

/** La cuadrilla de cada etapa: quien tiene su tiempo abierto, o si no ha empezado, la planeada. */
function useCuadrillaPorEtapa() {
  const personal = usePersonalPiso();
  const tramos = useCuadrillas();
  const asignaciones = useAsignaciones();
  return useMemo(() => {
    const nombres = new Map((personal.data ?? []).map((p) => [p.id, p.nombre]));
    const m = new Map<string, { nombres: string[]; trabajando: boolean }>();
    for (const t of tramos.data ?? []) {
      const c = m.get(t.operacion_id) ?? { nombres: [], trabajando: true };
      c.nombres.push(t.empleado_id ? nombreCorto(t.nombre) : `${t.personas} sin nombre`);
      m.set(t.operacion_id, c);
    }
    for (const a of asignaciones.data ?? []) {
      if (m.get(a.operacion_id)?.trabajando) continue;
      const c = m.get(a.operacion_id) ?? { nombres: [], trabajando: false };
      c.nombres.push(nombreCorto(nombres.get(a.empleado_id) ?? "—"));
      m.set(a.operacion_id, c);
    }
    return m;
  }, [personal.data, tramos.data, asignaciones.data]);
}

export default function Gantt() {
  const { puede } = useSesion();
  const gestionar = puede("produccion", 3);
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "op_operaciones", "op_tiempos", "op_asignaciones"]);
  const plan = useQuery({ queryKey: [...CLAVE, "plan"], queryFn: () => q<FilaPlan[]>(supabase.rpc("plan_produccion")) });
  const tablero = useTablero();
  const etapas = useEtapas();
  const carga = useCarga();
  const especialidades = useEspecialidades();
  const cuadrillas = useCuadrillaPorEtapa();
  const [params, setParams] = useSearchParams();
  // La vista y el zoom que cada quien deja se le recuerdan; la liga con ?vista= o ?zoom= manda.
  const [vistaGuardada, guardarVista] = usePreferencia<Vista>("gantt.vista", "orden", unoDe(["orden", "pedido", "area"] as const));
  const [zoomGuardado, guardarZoom] = usePreferencia<Zoom | null>("gantt.zoom", null,
    (v): v is Zoom | null => v === null || unoDe(["dia", "semana", "mes"] as const)(v));
  const zoom: Zoom = (["dia", "semana", "mes"] as const).find((z) => z === params.get("zoom")) ?? zoomGuardado ?? (window.innerWidth < 640 ? "semana" : "dia");
  const vista: Vista = (["orden", "pedido", "area"] as const).find((v) => v === params.get("vista")) ?? vistaGuardada;
  const ver: Ver = params.get("ver") === "tarde" ? "tarde" : "todas";
  const cambiar = (clave: string, valor: string, omision: string) => {
    const p = new URLSearchParams(params);
    if (valor === omision) p.delete(clave); else p.set(clave, valor);
    setParams(p, { replace: true });
  };
  const [buscar, setBuscar] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  // Mientras la base recalcula, la lista se queda como la dejó quien arrastró.
  const [manual, setManual] = useState<{ ids: string[]; desde: number } | null>(null);

  const hoyIso = hoyISO();
  const hoy = aDia(hoyIso);
  const ordenes = useMemo(
    () => armar(plan.data ?? [], tablero.data ?? [], etapas.data ?? [], hoy),
    [plan.data, tablero.data, etapas.data, hoy],
  );
  const manualVigente = manual && plan.dataUpdatedAt <= manual.desde ? manual.ids : null;
  const activas = useMemo(() => {
    const lista = ordenes.filter((g) => !g.enEspera);
    if (manualVigente) return lista.sort((a, b) => manualVigente.indexOf(a.id) - manualVigente.indexOf(b.id));
    return lista.sort((a, b) => (a.posicion ?? 9999) - (b.posicion ?? 9999) || a.o.folio.localeCompare(b.o.folio));
  }, [ordenes, manualVigente]);
  const enEspera = useMemo(() => ordenes.filter((g) => g.enEspera).sort((a, b) => a.o.folio.localeCompare(b.o.folio)), [ordenes]);

  const ordenarPlan = useAccion((ids: string[]) => q(supabase.rpc("ordenar_plan", { p_ordenes: ids })),
    { invalidar: [CLAVE], exito: "Listo: el plan se recalculó con el orden nuevo" });
  function reordenar(ids: string[]) {
    setManual({ ids, desde: plan.dataUpdatedAt });
    ordenarPlan.mutate(ids, { onError: () => setManual(null) });
  }
  function mover(id: string, a: "arriba" | "subir" | "bajar") {
    const ids = activas.map((g) => g.id);
    const i = ids.indexOf(id);
    if (i < 0) return;
    ids.splice(i, 1);
    ids.splice(a === "arriba" ? 0 : a === "subir" ? Math.max(i - 1, 0) : Math.min(i + 1, ids.length), 0, id);
    reordenar(ids);
  }

  const cargando = plan.isLoading || tablero.isLoading || etapas.isLoading;
  const error = plan.error ?? tablero.error ?? etapas.error;
  const tarde = activas.filter((g) => g.retraso > 0);
  const conFecha = activas.filter((g) => g.compromiso != null && g.fin != null);
  const finTaller = activas.reduce<number | null>((m, g) => (g.fin != null && (m == null || g.fin > m) ? g.fin : m), null);
  const cuello = useMemo(() => {
    const filas = (carga.data ?? []).filter((c) => c.capacidad_horas_semana > 0)
      .map((c) => ({ nombre: c.nombre, semanas: (Number(c.horas_pendientes) + Number(c.horas_planeadas)) / Number(c.capacidad_horas_semana) }));
    return filas.sort((a, b) => b.semanas - a.semanas)[0] ?? null;
  }, [carga.data]);
  const porHacer = activas.reduce((s, g) => s + g.barras.filter((b) => b.estado !== "terminada").length, 0);
  const seleccion = ordenes.find((g) => g.id === abierta) ?? null;

  return (
    <Pagina titulo="Gantt de producción" ancho="max-w-[1800px]"
      descripcion="Cuándo empieza y termina cada etapa de cada orden, con la capacidad de cada área y su cuadrilla. Se recalcula solo con cada cambio del taller."
      acciones={<div className="flex flex-wrap gap-2">
        <Filtro opciones={[
          { valor: "orden" as Vista, texto: "Por orden", explica: GLOSARIO.ganttPorOrden },
          { valor: "pedido" as Vista, texto: "Por pedido" },
          { valor: "area" as Vista, texto: "Por área", explica: GLOSARIO.ganttPorArea },
        ]} valor={vista} alCambiar={(v) => { guardarVista(v); cambiar("vista", v, "orden"); }} />
        <Filtro opciones={ZOOMS} valor={zoom} alCambiar={(v) => { guardarZoom(v); cambiar("zoom", v, window.innerWidth < 640 ? "semana" : "dia"); }} />
      </div>}>
      {error ? <ErrorCarga error={error} /> : cargando ? <Cargando filas={8} /> : !ordenes.length ? (
        <Vacio icono={GanttChart} titulo="No hay órdenes abiertas en el taller"
          texto="Cuando haya órdenes planeadas o liberadas, aquí verás cuándo empieza y termina cada etapa."
          accion={<Boton asChild variante="secundario"><Link to="/produccion/ordenes">Ir a Órdenes y material</Link></Boton>} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi titulo="En el plan" valor={numero(activas.length)} icono={Layers} explica={GLOSARIO.planTaller}
              detalle={`${numero(porHacer)} etapas por hacer${enEspera.length ? ` · ${enEspera.length} en espera` : ""}`} />
            <Kpi titulo="Van tarde según el plan" valor={numero(tarde.length)} icono={AlarmClock} tono={tarde.length ? "peligro" : "ok"}
              explica={GLOSARIO.tardeSegunPlan} detalle={`de ${numero(conFecha.length)} con fecha compromiso`}
              alClic={tarde.length ? () => cambiar("ver", ver === "tarde" ? "todas" : "tarde", "todas") : undefined} />
            <Kpi titulo="El taller acaba lo que tiene" valor={finTaller != null ? `${fechaCorta(finTaller)}${anioDe(finTaller) !== anioDe(hoy) ? ` ${anioDe(finTaller)}` : ""}` : "—"} icono={CalendarCheck2} tono="info"
              explica={GLOSARIO.finDelPlan}
              detalle={finTaller != null ? `en ${numero(Math.max(Math.round((finTaller - hoy) / 7 * 10) / 10, 0))} semanas, si no entra nada nuevo` : undefined} />
            <Kpi titulo="Área más cargada" valor={cuello?.nombre ?? "—"} icono={Timer} tono="aviso" explica={GLOSARIO.filaTaller}
              detalle={cuello ? `≈ ${numero(Math.round(cuello.semanas * 10) / 10)} semanas de trabajo en fila` : undefined} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tenue" />
              <Entrada value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Orden, equipo, cliente o pedido" className="pl-8 h-8 text-sm" />
            </div>
            <Filtro opciones={[{ valor: "todas" as Ver, texto: "Todas" }, { valor: "tarde" as Ver, texto: "Van tarde", cuenta: tarde.length, explica: GLOSARIO.tardeSegunPlan }]}
              valor={ver} alCambiar={(v) => cambiar("ver", v, "todas")} />
            <Leyenda />
            <EnVivo recalculando={plan.isFetching} />
          </div>

          <Diagrama zoom={zoom} vista={vista} hoy={hoy} activas={activas} enEspera={enEspera} etapas={etapas.data ?? []}
            carga={carga.data ?? []} especialidades={especialidades.data ?? []} buscar={buscar} ver={ver} cuadrillas={cuadrillas}
            arrastrable={gestionar && vista === "orden" && !buscar && ver === "todas"}
            alAbrir={setAbierta} alReordenar={reordenar} />
          {gestionar && vista === "orden" && (
            <p className="text-xs text-tenue">Arrastra una orden por su asa para cambiar su lugar en la fila: el plan se recalcula y la cola de Cuadrillas y de la terminal queda en ese orden.</p>
          )}
        </>
      )}

      {seleccion && (
        <DetalleOrdenPlan g={seleccion} hoy={hoy} cuadrillas={cuadrillas} lugar={activas.findIndex((x) => x.id === seleccion.id)} total={activas.length}
          gestionar={gestionar} ocupado={ordenarPlan.isPending} alMover={(a) => mover(seleccion.id, a)} alCerrar={() => setAbierta(null)} />
      )}
    </Pagina>
  );
}

function EnVivo({ recalculando }: { recalculando: boolean }) {
  return (
    <span className="ml-auto inline-flex items-center gap-2 text-xs text-tenue" data-explain={GLOSARIO.planTaller} data-explain-title="Plan en vivo">
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inline-flex h-full w-full rounded-full bg-ok opacity-60", recalculando ? "animate-ping" : "gantt-latido")} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      {recalculando ? "Recalculando…" : "En vivo"}
    </span>
  );
}

function Leyenda() {
  const c = "#64748b";
  const muestra = (estado: EstadoOperacion) => (
    <span className="relative inline-block h-3 w-6 rounded-[4px] overflow-hidden" style={estiloBarra(estado, c, 0, 24, estado === "en_proceso" ? 14 : 0)}>
      {estado === "en_proceso" && <span className="gantt-vivo absolute inset-y-0 left-0 w-[14px]" />}
    </span>
  );
  const pieza = (cont: React.ReactNode, texto: string, explica: string) => (
    <span className="inline-flex items-center gap-1.5" data-explain={explica} data-explain-title={texto}>{cont}{texto}</span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tenue">
      {pieza(muestra("terminada"), "Hecho", GLOSARIO.ganttHecho)}
      {pieza(muestra("en_proceso"), "Trabajándose", GLOSARIO.ganttTrabajandose)}
      {pieza(muestra("pausada"), "Pausada", GLOSARIO.etapaPausada)}
      {pieza(muestra("pendiente"), "Planeado", GLOSARIO.ganttPlaneado)}
      {pieza(<span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-ok" />, "Compromiso", GLOSARIO.fechaCompromiso)}
      {pieza(<span className="h-3 w-5 rounded-[3px] gantt-retraso" />, "Retraso", GLOSARIO.tardeSegunPlan)}
    </div>
  );
}

/** Cómo se pinta una etapa: lo hecho se apaga, lo que se trabaja va lleno hasta hoy, lo planeado es translúcido. */
function estiloBarra(estado: EstadoOperacion, c: string, x: number, ancho: number, xHoy: number): CSSProperties {
  const suave = `color-mix(in srgb, ${c} 20%, transparent)`;
  switch (estado) {
    case "terminada":
      return { background: `color-mix(in srgb, ${c} 45%, hsl(var(--superficie)))`, color: "hsl(var(--texto))" };
    case "en_proceso": {
      const corte = Math.max(0, Math.min(ancho, xHoy - x));
      return { background: `linear-gradient(90deg, ${c} ${corte}px, ${suave} ${corte}px)`, boxShadow: `inset 0 0 0 1.5px ${c}`,
        color: corte > ancho * 0.6 ? tinta(c) : "hsl(var(--texto))" };
    }
    case "pausada":
      return { background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${c} 50%, transparent) 0 4px, ${suave} 4px 9px)`,
        boxShadow: `inset 0 0 0 1.5px ${c}`, color: "hsl(var(--texto))" };
    default:
      return { background: suave, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 60%, transparent), inset 3px 0 0 ${c}`, color: "hsl(var(--texto))" };
  }
}

interface PropsDiagrama {
  zoom: Zoom; vista: Vista; hoy: number; activas: OrdenGantt[]; enEspera: OrdenGantt[]; etapas: Etapa[];
  carga: { etapa_id: number; capacidad_horas_semana: number; horas_pendientes: number; horas_planeadas: number }[];
  buscar: string; ver: Ver; cuadrillas: Map<string, { nombres: string[]; trabajando: boolean }>;
  arrastrable: boolean; alAbrir: (id: string) => void; alReordenar: (ids: string[]) => void;
  /** Para partir las áreas en sus especialidades en la vista por área. */
  especialidades?: Especialidad[];
  /** En la ficha de un pedido u orden: alto según los renglones, sin la fila. */
  compacto?: boolean;
  /** Horas y cuadrilla en el globo: solo para la planta (el vendedor ve fechas). */
  detalleTaller?: boolean;
  /** Px por día a la medida de la ficha, en lugar de los del zoom. */
  pxDia?: number;
}

function Diagrama({ zoom, vista, hoy, activas, enEspera, etapas, carga, buscar, ver, cuadrillas, arrastrable, alAbrir, alReordenar,
  compacto = false, detalleTaller = true, pxDia, especialidades = [] }: PropsDiagrama) {
  const px = pxDia ?? PX[zoom];
  const caja = useRef<HTMLDivElement>(null);
  const [sobre, setSobre] = useState<{ b: Barra; g: OrdenGantt; x: number; y: number } | null>(null);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [destino, setDestino] = useState<{ id: string; antes: boolean } | null>(null);

  const pasa = (g: OrdenGantt) => (ver === "todas" || g.retraso > 0)
    && (!buscar || coincide(`${g.o.folio} ${g.o.equipo} ${g.o.cliente ?? "para stock"} ${g.o.pedido_folio ?? ""} ${g.o.numero_serie ?? ""}`, buscar));
  const visibles = activas.filter(pasa);
  const esperaVisibles = ver === "todas" ? enEspera.filter(pasa) : [];

  // El rango: desde unos días antes de hoy (lo hecho hace mucho se corta) hasta lo último del plan.
  const todas = [...visibles, ...esperaVisibles];
  const desdes = todas.flatMap((g) => g.barras.map((b) => b.desde)).filter((d): d is number => d != null);
  const hastas = todas.flatMap((g) => [...g.barras.map((b) => b.hasta), g.compromiso]).filter((d): d is number => d != null);
  // En una ficha cabe poco: sin el colchón de semanas vacías que trae el Gantt completo.
  let ini = Math.max(Math.min(hoy - (compacto ? 3 : 7), ...desdes), hoy - (compacto ? 21 : zoom === "mes" ? 120 : 42));
  ini = zoom === "mes" && !compacto ? aDia(deDia(ini).slice(0, 8) + "01") : ini - diaSemana(ini);
  const fin = compacto ? Math.min(Math.max(hoy + 7, ...hastas) + 5, hoy + 760)
    : Math.min(Math.max(hoy + (zoom === "dia" ? 42 : zoom === "semana" ? 120 : 330), ...hastas) + 10, hoy + 760);
  const ancho = (fin - ini + 1) * px;
  const xDe = (d: number) => (d - ini) * px;
  const ahoraMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const xHoy = xDe(hoy) + ((ahoraMx.getHours() + ahoraMx.getMinutes() / 60) / 24) * px;

  const items = useMemo<Item[]>(() => {
    const lista: Item[] = [];
    let y = 0;
    const fila = (g: OrdenGantt) => { lista.push({ tipo: "orden", clave: g.id, y, h: ALTO_ORDEN, g }); y += ALTO_ORDEN; };
    const grupo = (clave: string, titulo: string, detalle: string, ordenes: OrdenGantt[], espera = false) => {
      lista.push({ tipo: "grupo", clave, y, h: ALTO_GRUPO, titulo, detalle, ordenes, espera }); y += ALTO_GRUPO;
    };
    if (vista === "area") {
      for (const e of etapas.filter((x) => x.capacidad_horas_semana > 0)) {
        const deArea = visibles.flatMap((g) => g.barras.filter((b) => b.etapa.id === e.id).map((b) => ({ b, g })));
        // Con especialidades, un renglón por cada una con lo de sus equipos, y uno con lo demás
        // (lo que hace quien no tiene especialidad, o cualquiera). Las horas son las de su gente.
        const esps = especialidades.filter((x) => x.etapa_id === e.id);
        const partes = esps.length === 0
          ? [{ clave: `a${e.id}`, sub: null as string | null, cap: Number(e.capacidad_horas_semana), lista: deArea }]
          : [
            ...esps.map((x) => ({ clave: `a${e.id}-${x.id}`, sub: x.nombre, cap: Number(x.horas_semana), lista: deArea.filter(({ b }) => b.esp === x.id) })),
            { clave: `a${e.id}-resto`, sub: "Lo demás", cap: Math.max(Number(e.capacidad_horas_semana) - esps.reduce((s, x) => s + Number(x.horas_semana), 0), 0),
              lista: deArea.filter(({ b }) => !esps.some((x) => x.id === b.esp)) },
          ];
        for (const parte of partes) {
          const barras = parte.lista.filter(({ b }) => b.desde != null && b.hasta != null)
            .sort((a, b) => a.b.desde! - b.b.desde! || a.b.hasta! - b.b.hasta!);
          // Carriles: cada etapa en el primero donde ya terminó la anterior (se ve cuántas van a la vez).
          const finCarril: number[] = [];
          const carriles = barras.map(({ b, g }) => {
            let c = finCarril.findIndex((h) => h < b.desde!);
            if (c < 0) { c = finCarril.length; finCarril.push(b.hasta!); } else finCarril[c] = b.hasta!;
            return { b, g, carril: c };
          });
          let semanas: number | null;
          if (parte.sub == null) {
            const k = carga.find((c) => c.etapa_id === e.id);
            semanas = k && k.capacidad_horas_semana > 0 ? (Number(k.horas_pendientes) + Number(k.horas_planeadas)) / Number(k.capacidad_horas_semana) : null;
          } else {
            // La fila de la especialidad: lo que le falta a sus etapas entre las horas de su gente.
            const resta = parte.lista.reduce((s, { b }) => s + (b.estado === "terminada" ? 0 : Number(b.horasRest) || 0), 0);
            semanas = parte.cap > 0 && resta > 0 ? resta / parte.cap : null;
          }
          const h = Math.max(finCarril.length, 1) * ALTO_CARRIL + 16;
          lista.push({ tipo: "area", clave: parte.clave, y, h, etapa: e, semanas, carriles, sub: parte.sub, horasSemana: parte.cap });
          y += h;
        }
      }
      return lista;
    }
    if (vista === "pedido") {
      const grupos = new Map<string, OrdenGantt[]>();
      for (const g of visibles) { const k = g.o.pedido_id ?? "stock"; grupos.set(k, [...(grupos.get(k) ?? []), g]); }
      for (const [k, gs] of grupos) {
        const o = gs[0].o;
        const finG = gs.some((g) => g.fin == null) ? null : Math.max(...gs.map((g) => g.fin!));
        const atraso = Math.max(...gs.map((g) => g.retraso));
        grupo(`p${k}`, k === "stock" ? "Para stock" : `${o.pedido_folio ?? "Pedido"} · ${o.cliente ?? ""}`,
          `${gs.length} ${gs.length === 1 ? "equipo" : "equipos"}${finG != null ? ` · termina ${fechaCorta(finG)}` : ""}${atraso ? ` · ${atraso} ${atraso === 1 ? "día" : "días"} tarde` : ""}`, gs);
        gs.forEach(fila);
      }
    } else {
      visibles.forEach(fila);
    }
    if (esperaVisibles.length) {
      grupo("espera", "En espera", "No entran al plan hasta que se reanudan", esperaVisibles, true);
      esperaVisibles.forEach(fila);
    }
    return lista;
  }, [vista, visibles, esperaVisibles, etapas, carga, especialidades]);
  const alto = items.reduce((s, it) => Math.max(s, it.y + it.h), 0);

  // Al abrir y al cambiar el zoom, hoy queda cerca de la orilla izquierda (lo de atrás se ve con desplazar).
  const ajustado = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || ajustado.current === zoom) return;
    ajustado.current = zoom;
    // Hoy a una cuarta parte de lo visible: en el celular la columna de órdenes se come casi la mitad.
    const izq = el.querySelector<HTMLElement>("[data-izq]")?.offsetWidth ?? 150;
    el.scrollLeft = Math.max(0, xHoy - (el.clientWidth - izq) / 4);
  });

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    if (!arrastrando || !destino || arrastrando === destino.id) { setArrastrando(null); setDestino(null); return; }
    const ids = activas.map((g) => g.id).filter((id) => id !== arrastrando);
    const i = ids.indexOf(destino.id);
    if (i >= 0) { ids.splice(destino.antes ? i : i + 1, 0, arrastrando); alReordenar(ids); }
    setArrastrando(null); setDestino(null);
  }

  if (!items.length) {
    return <div className="tarjeta"><Vacio icono={Search} titulo="Ninguna orden coincide" texto="Prueba con otra búsqueda o quita el filtro de «Van tarde»." /></div>;
  }

  const barra = (b: Barra, g: OrdenGantt, top: number, alto: number, etiqueta: string, corta: string, i: number) => {
    if (b.desde == null || b.hasta == null || b.hasta < ini) return null;
    const desde = Math.max(b.desde, ini);
    const x = xDe(desde);
    const w = Math.max((b.hasta - desde + 1) * px - 2, 4);
    const cortada = b.desde < ini;
    const texto = w >= 70 ? etiqueta : w >= 30 ? corta : "";
    const apagada = resaltada != null && resaltada !== g.id;
    return (
      <button key={b.id} type="button"
        aria-label={`${b.etapa.nombre} de ${folioCorto(g.o.folio)}: ${ESTADO_OPERACION[b.estado].texto}`}
        onClick={() => alAbrir(g.id)}
        onMouseMove={(e: MouseEvent) => setSobre({ b, g, x: e.clientX, y: e.clientY })}
        onMouseEnter={() => vista === "area" && setResaltada(g.id)}
        onMouseLeave={() => { setSobre(null); setResaltada(null); }}
        onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSobre({ b, g, x: r.left, y: r.bottom }); }}
        onBlur={() => setSobre(null)}
        className={cn("gantt-barra absolute z-10 overflow-hidden rounded-md text-left text-[11px] font-medium leading-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-1 hover:brightness-110 hover:z-20",
          apagada && "opacity-25", cortada && "rounded-l-none gantt-cortada")}
        style={{ left: x + 1, width: w, top, height: alto, animationDelay: `${Math.min(i, 40) * 18}ms`, ...estiloBarra(b.estado, b.etapa.color, x, w, xHoy) }}>
        {b.estado === "en_proceso" && <span className="gantt-vivo absolute inset-y-0 left-0" style={{ width: Math.max(0, Math.min(w, xHoy - x)) }} />}
        <span className="relative flex h-full items-center truncate px-1.5">{texto}</span>
      </button>
    );
  };

  return (
    <div ref={caja} onDragOver={(e) => arrastrando && e.preventDefault()} onDrop={alSoltar}
      className={cn("relative overflow-auto rounded-xl border border-borde bg-superficie shadow-tarjeta [--izq:9.5rem]",
        compacto ? "sm:[--izq:13rem] max-h-[28rem]" : "sm:[--izq:17rem] max-h-[calc(100vh-17rem)] min-h-[420px]")}>
      <div className="relative" style={{ width: `calc(var(--izq) + ${ancho}px)` }}>
        <div className="sticky top-0 z-30 flex border-b border-borde bg-superficie/95 backdrop-blur" style={{ height: ALTO_REGLA }}>
          <div data-izq className="sticky left-0 z-10 w-[var(--izq)] shrink-0 border-r border-borde bg-superficie px-3 flex items-end pb-2 text-xs font-medium text-tenue">
            {vista === "area" ? "Área" : vista === "pedido" ? "Pedido y orden" : compacto ? "Orden" : "Orden (en el orden de la fila)"}
          </div>
          <Regla zoom={zoom} ini={ini} fin={fin} px={px} hoy={hoy} xHoy={xHoy} />
        </div>

        <div className="relative" style={{ height: alto }}>
          <Fondo zoom={zoom} ini={ini} fin={fin} px={px} xHoy={xHoy} />
          {items.map((it, i) => {
            if (it.tipo === "grupo") {
              const desdesG = it.ordenes.flatMap((g) => g.barras.map((b) => b.desde)).filter((d): d is number => d != null);
              const hastasG = it.ordenes.flatMap((g) => g.barras.map((b) => b.hasta)).filter((d): d is number => d != null);
              const a = desdesG.length ? Math.max(Math.min(...desdesG), ini) : null;
              const z = hastasG.length ? Math.max(...hastasG) : null;
              return (
                <div key={it.clave} className="absolute inset-x-0 flex transition-[top] duration-500 ease-out" style={{ top: it.y, height: it.h }}>
                  <div className={cn("sticky left-0 z-20 w-[var(--izq)] shrink-0 border-r border-b border-borde px-3 flex flex-col justify-center min-w-0",
                    it.espera ? "bg-aviso-suave" : "bg-fondo")}>
                    <p className="text-xs font-semibold truncate">{it.titulo}</p>
                    <p className="text-[11px] text-tenue truncate">{it.detalle}</p>
                  </div>
                  <div className={cn("relative shrink-0 border-b border-borde", it.espera ? "bg-aviso-suave/50" : "bg-fondo/60")} style={{ width: ancho }}>
                    {a != null && z != null && !it.espera && (
                      <span className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-tenue/40 transition-all duration-500" style={{ left: xDe(a), width: (z - a + 1) * px }} />
                    )}
                  </div>
                </div>
              );
            }
            if (it.tipo === "area") {
              return (
                <div key={it.clave} className="absolute inset-x-0 flex transition-[top] duration-500 ease-out" style={{ top: it.y, height: it.h }}>
                  <div className="sticky left-0 z-20 w-[var(--izq)] shrink-0 border-r border-b border-borde bg-superficie px-3 flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: it.etapa.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{it.etapa.nombre}{it.sub && <span className="font-normal" data-explain={GLOSARIO.especialidad} data-explain-title="Especialidad"> · {it.sub}</span>}</p>
                      <p className="text-[11px] text-tenue truncate">
                        {it.semanas != null ? `≈ ${numero(Math.round(it.semanas * 10) / 10)} sem. de fila · ` : ""}{numero(Math.round(it.horasSemana))} h/sem
                      </p>
                    </div>
                  </div>
                  <div className="relative shrink-0 border-b border-borde" style={{ width: ancho }}>
                    {it.carriles.map(({ b, g, carril }, j) => barra(b, g, 8 + carril * ALTO_CARRIL, ALTO_CARRIL - 6, folioCorto(g.o.folio), String(Number(g.o.folio.replace(/\D/g, "").slice(-5))), i + j))}
                  </div>
                </div>
              );
            }
            const g = it.g;
            const o = g.o;
            const xComp = g.compromiso != null && g.compromiso >= ini ? xDe(g.compromiso) + px / 2 : null;
            const xFin = g.fin != null ? xDe(g.fin + 1) : null;
            const marca = destino?.id === g.id && arrastrando && arrastrando !== g.id;
            return (
              <div key={it.clave} className={cn("group absolute inset-x-0 flex transition-[top] duration-500 ease-out", arrastrando === g.id && "opacity-50")}
                style={{ top: it.y, height: it.h }}
                onDragOver={(e) => {
                  if (!arrastrando || g.enEspera) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setDestino({ id: g.id, antes: e.clientY < r.top + r.height / 2 });
                }}>
                {marca && <span className={cn("absolute inset-x-0 z-40 h-0.5 bg-marca", destino!.antes ? "top-0" : "bottom-0")} />}
                <div draggable={arrastrable && !g.enEspera}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", g.id); setArrastrando(g.id); }}
                  onDragEnd={() => { setArrastrando(null); setDestino(null); }}
                  className={cn("sticky left-0 z-20 w-[var(--izq)] shrink-0 border-r border-b border-borde bg-superficie group-hover:bg-fondo flex items-center gap-1 pr-2 min-w-0",
                    arrastrable && !g.enEspera ? "pl-0.5" : "pl-3", g.enEspera && "opacity-70")}>
                  {arrastrable && !g.enEspera && <GripVertical className="h-4 w-4 shrink-0 text-tenue/60 cursor-grab group-hover:text-tenue" />}
                  <button type="button" onClick={() => alAbrir(g.id)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca rounded">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
                      {o.prioridad === 1 && <span className="h-1.5 w-1.5 rounded-full bg-peligro shrink-0" data-explain={GLOSARIO.prioridadOrden} data-explain-title="Urgente" />}
                      <span className="truncate">{folioCorto(o.folio)}</span>
                      {g.retraso > 0 && <span className="ml-auto shrink-0 rounded-full bg-peligro-suave px-1.5 text-[10px] font-semibold text-peligro cifra">+{g.retraso} d</span>}
                      {g.enEspera && <span className="ml-auto shrink-0 rounded-full bg-aviso-suave px-1.5 text-[10px] font-semibold text-aviso">En espera</span>}
                    </p>
                    <p className="text-xs truncate leading-tight mt-0.5">{abreviarEquipo(o.equipo)}</p>
                    <p className="hidden sm:block text-[11px] text-tenue truncate leading-tight mt-0.5">
                      {o.pedido_folio ? `${o.pedido_folio} · ${o.cliente ?? ""}` : "Para stock"}
                    </p>
                  </button>
                </div>
                <div className="relative shrink-0 border-b border-borde group-hover:bg-marca/[0.03]" style={{ width: ancho }}>
                  {g.retraso > 0 && xComp != null && xFin != null && (
                    <span className="gantt-retraso absolute top-2 bottom-2 rounded-r-md transition-all duration-500" style={{ left: xComp + px / 2, width: Math.max(xFin - xComp - px / 2, 2) }} />
                  )}
                  {(() => {
                    const { linea, total } = lineasDeOrden(g.barras);
                    const alto = total === 1 ? 24 : Math.floor((ALTO_ORDEN - 12) / total) - 2;
                    return g.barras.map((b, j) => {
                      const top = total === 1 ? 15 : 6 + (linea.get(b.id) ?? 0) * (alto + 2);
                      return barra(b, g, top, alto, b.etapa.nombre, b.etapa.nombre.slice(0, 3), i + j);
                    });
                  })()}
                  {xComp != null && (
                    // Una raya punteada de arriba abajo y el rombo arriba: no tapa el nombre de la etapa de ese día.
                    <span title={`Compromiso: ${fecha(o.fecha_compromiso)}`} className="absolute inset-y-1 z-[5] transition-all duration-500" style={{ left: xComp }}>
                      <span className={cn("absolute inset-y-0 border-l-2 border-dashed -ml-px", g.retraso > 0 ? "border-peligro/60" : "border-ok/60")} />
                      <span className={cn("absolute top-0 z-20 h-2.5 w-2.5 -ml-[5px] rotate-45 rounded-[2px] ring-2 ring-superficie", g.retraso > 0 ? "bg-peligro" : "bg-ok")} />
                    </span>
                  )}
                  {xFin != null && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium cifra transition-all duration-500",
                      g.retraso > 0 ? "text-peligro" : "text-tenue")} style={{ left: Math.max(xFin, xComp ?? 0) + 8 }}>
                      {g.retraso > 0 ? `${g.retraso} ${g.retraso === 1 ? "día" : "días"} tarde` : zoom !== "mes" ? fechaCorta(g.fin!) : ""}
                    </span>
                  )}
                  {g.enEspera && (
                    <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs italic text-aviso" style={{ left: xHoy + 10 }}>
                      En espera: {o.en_espera_motivo}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {sobre && <Globo b={sobre.b} g={sobre.g} x={sobre.x} y={sobre.y} hoy={hoy} cuadrilla={cuadrillas.get(sobre.b.id)} detalleTaller={detalleTaller} />}
    </div>
  );
}

function Regla({ zoom, ini, fin, px, hoy, xHoy }: { zoom: Zoom; ini: number; fin: number; px: number; hoy: number; xHoy: number }) {
  const arriba: { x: number; w: number; texto: string }[] = [];
  const abajo: { x: number; texto: string; finde?: boolean; hoy?: boolean; w?: number }[] = [];
  for (let d = ini; d <= fin; d++) {
    const primero = d === ini;
    if (zoom === "mes") {
      if (primero || (mesDe(d) === 0 && diaDelMes(d) === 1)) arriba.push({ x: (d - ini) * px, w: 0, texto: String(anioDe(d)) });
      if (diaDelMes(d) === 1) abajo.push({ x: (d - ini) * px, texto: MESES[mesDe(d)].slice(0, 3) });
    } else {
      if (primero || diaDelMes(d) === 1) arriba.push({ x: (d - ini) * px, w: 0, texto: `${MESES[mesDe(d)]} ${anioDe(d)}` });
      if (zoom === "dia") abajo.push({ x: (d - ini) * px, w: px, texto: `${"LMMJVSD"[diaSemana(d)]} ${diaDelMes(d)}`, finde: diaSemana(d) >= 5, hoy: d === hoy });
      else if (diaSemana(d) === 0) abajo.push({ x: (d - ini) * px, texto: fechaCorta(d) });
    }
  }
  arriba.forEach((a, i) => { a.w = (arriba[i + 1]?.x ?? (fin - ini + 1) * px) - a.x; });
  return (
    <div className="relative shrink-0" style={{ width: (fin - ini + 1) * px }}>
      {arriba.map((a) => (
        <div key={a.x} className="absolute top-0 h-6 border-l border-borde" style={{ left: a.x, width: a.w }}>
          <span className="sticky left-[calc(var(--izq)+0.5rem)] inline-block px-2 pt-1 text-xs font-semibold capitalize whitespace-nowrap">{a.texto}</span>
        </div>
      ))}
      {abajo.map((a) => (
        <div key={a.x} className={cn("absolute bottom-0 h-6 flex items-center text-[11px] whitespace-nowrap cifra",
          a.w ? "justify-center" : "border-l border-borde/70 pl-1.5", a.finde ? "text-tenue/60" : "text-tenue")}
          style={{ left: a.x, width: a.w }}>
          <span className={cn(a.hoy && "rounded-full bg-marca px-1.5 py-0.5 font-semibold text-white")}>{a.texto}</span>
        </div>
      ))}
      {zoom !== "dia" && (
        <span className="absolute bottom-1 -translate-x-1/2 rounded-full bg-marca px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ left: xHoy }}>Hoy</span>
      )}
    </div>
  );
}

function Fondo({ zoom, ini, fin, px, xHoy }: { zoom: Zoom; ini: number; fin: number; px: number; xHoy: number }) {
  const piezas: React.ReactNode[] = [];
  for (let d = ini; d <= fin; d++) {
    const x = (d - ini) * px;
    if (zoom !== "mes" && diaSemana(d) === 5) piezas.push(<span key={`f${d}`} className="absolute inset-y-0 bg-tenue/[0.07]" style={{ left: x, width: 2 * px }} />);
    if (diaDelMes(d) === 1) piezas.push(<span key={`m${d}`} className="absolute inset-y-0 border-l border-borde" style={{ left: x }} />);
    else if (zoom === "dia" && diaSemana(d) === 0) piezas.push(<span key={`s${d}`} className="absolute inset-y-0 border-l border-borde/50" style={{ left: x }} />);
  }
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: "var(--izq)", width: (fin - ini + 1) * px }}>
      {piezas}
      <span className="absolute inset-y-0 z-[15] w-0.5 -ml-px bg-marca/80 shadow-[0_0_8px_hsl(var(--marca)/0.6)]" style={{ left: xHoy }} />
    </div>
  );
}

/** Lo que dice una etapa al pasarle el mouse: qué es, cuándo, cuánto falta y quién la trabaja. */
function Globo({ b, g, x, y, hoy, cuadrilla, detalleTaller }: {
  b: Barra; g: OrdenGantt; x: number; y: number; hoy: number; cuadrilla?: { nombres: string[]; trabajando: boolean }; detalleTaller: boolean;
}) {
  const ancho = 290;
  const izquierda = x + 16 + ancho > window.innerWidth ? x - ancho - 12 : x + 16;
  const arriba = Math.min(y + 16, window.innerHeight - 190);
  const dias = b.desde != null && b.hasta != null ? b.hasta - b.desde + 1 : null;
  let cuando: string;
  if (b.estado === "terminada") cuando = `Se hizo del ${fecha(b.inicioReal ?? b.finReal)} al ${fecha(b.finReal)}`;
  else if (b.estado === "pendiente") cuando = !b.inicioPlan ? "Sin plan mientras la orden esté en espera"
    : b.inicioPlan === b.finPlan ? `Plan: el ${fecha(b.inicioPlan)}` : `Plan: del ${fecha(b.inicioPlan)} al ${fecha(b.finPlan)}`;
  else cuando = `Empezó el ${fecha(b.inicioReal ?? b.inicioPlan)}${b.finPlan ? ` · según el plan termina el ${fecha(b.finPlan)}` : ""}`;
  return (
    <div className="pointer-events-none fixed z-50 rounded-xl border border-borde bg-superficie/95 p-3 text-xs shadow-2xl backdrop-blur gantt-globo"
      style={{ left: Math.max(8, izquierda), top: arriba, width: ancho }}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.etapa.color }} />
        {b.etapa.nombre}
        <span className="ml-auto text-xs font-medium text-tenue">{ESTADO_OPERACION[b.estado].texto}</span>
      </p>
      <p className="mt-1 truncate">{folioCorto(g.o.folio)} · {abreviarEquipo(g.o.equipo)}</p>
      <p className="truncate text-tenue">{g.o.pedido_folio ? `${g.o.pedido_folio} · ${g.o.cliente ?? ""}` : "Para stock"}</p>
      <div className="mt-2 space-y-0.5">
        <p>{cuando}{dias != null && b.estado !== "terminada" ? ` (${dias} ${dias === 1 ? "día" : "días"})` : ""}</p>
        {b.estado !== "terminada" && b.horasEst > 0 && (
          <p className="cifra">Faltan ≈ {horas(b.horasRest)} de {horas(b.horasEst)}</p>
        )}
        {b.estado !== "terminada" && detalleTaller && (
          <p>{cuadrilla?.nombres.length
            ? `${cuadrilla.trabajando ? "Trabajando" : "Cuadrilla planeada"}: ${cuadrilla.nombres.join(", ")}`
            : "Sin cuadrilla: el plan cuenta 2 personas"}</p>
        )}
        {g.compromiso != null && (
          <p className={g.retraso > 0 ? "text-peligro font-medium" : "text-ok font-medium"}>
            Compromiso {fecha(g.o.fecha_compromiso)}{g.retraso > 0 ? ` · el plan acaba ${g.retraso} ${g.retraso === 1 ? "día" : "días"} después` : g.fin != null ? " · llega a tiempo" : ""}
          </p>
        )}
        {b.estado === "pendiente" && b.desde != null && b.desde < hoy && <p className="text-aviso">Ya debió empezar</p>}
      </div>
    </div>
  );
}

function DetalleOrdenPlan({ g, hoy, cuadrillas, lugar, total, gestionar, ocupado, alMover, alCerrar }: {
  g: OrdenGantt; hoy: number; cuadrillas: Map<string, { nombres: string[]; trabajando: boolean }>; lugar: number; total: number;
  gestionar: boolean; ocupado: boolean; alMover: (a: "arriba" | "subir" | "bajar") => void; alCerrar: () => void;
}) {
  const o = g.o;
  const veredicto = g.enEspera ? { texto: "En espera", tono: "aviso" as const }
    : g.fin == null ? { texto: "Sin plan", tono: "neutro" as const }
    : g.compromiso == null ? { texto: "Sin fecha compromiso", tono: "neutro" as const }
    : g.retraso > 0 ? { texto: `${g.retraso} ${g.retraso === 1 ? "día" : "días"} tarde`, tono: "peligro" as const }
    : { texto: `A tiempo (${g.compromiso - g.fin} ${g.compromiso - g.fin === 1 ? "día" : "días"} de holgura)`, tono: "ok" as const };
  return (
    <Lateral abierto alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={`${folioCorto(o.folio)} · ${abreviarEquipo(o.equipo)}`}
      subtitulo={o.pedido_folio ? `${o.pedido_folio} · ${o.cliente ?? ""}` : "Para stock"}
      acciones={<Boton asChild variante="secundario"><Link to={`/produccion/ordenes/${o.id}`}>Abrir la orden <ExternalLink className="h-4 w-4" /></Link></Boton>}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Dato titulo="Compromiso" valor={fecha(o.fecha_compromiso)} explica={GLOSARIO.fechaCompromiso} />
          <Dato titulo="Termina según el plan" valor={g.fin != null ? fecha(deDia(g.fin)) : "—"} explica={GLOSARIO.planTaller} />
          <div className="rounded-lg border border-borde p-2.5" data-explain={GLOSARIO.tardeSegunPlan} data-explain-title="Cómo va">
            <p className="text-[11px] text-tenue">Cómo va</p>
            <Insignia tono={veredicto.tono} className="mt-1">{veredicto.texto}</Insignia>
          </div>
        </div>
        {g.enEspera && <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm text-aviso">En espera: {o.en_espera_motivo}. No entra al plan hasta que se reanude.</p>}
        {gestionar && !g.enEspera && lugar >= 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde p-3">
            <p className="text-sm mr-auto">Lugar en la fila: <span className="font-semibold cifra">{lugar + 1}</span> de <span className="cifra">{total}</span></p>
            <Boton variante="secundario" tamano="sm" disabled={lugar === 0 || ocupado} onClick={() => alMover("arriba")}><ChevronsUp className="h-4 w-4" />Hasta arriba</Boton>
            <Boton variante="secundario" tamano="sm" disabled={lugar === 0 || ocupado} onClick={() => alMover("subir")}><ChevronUp className="h-4 w-4" />Subir</Boton>
            <Boton variante="secundario" tamano="sm" disabled={lugar === total - 1 || ocupado} onClick={() => alMover("bajar")}><ChevronDown className="h-4 w-4" />Bajar</Boton>
          </div>
        )}
        <ol className="space-y-2">
          {g.barras.map((b) => {
            const c = cuadrillas.get(b.id);
            return (
              <li key={b.id} className="flex gap-3 rounded-lg border border-borde p-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: b.etapa.color }} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex items-center gap-2 font-medium">{b.etapa.nombre}
                    <Insignia tono={ESTADO_OPERACION[b.estado].tono} className="ml-auto">{ESTADO_OPERACION[b.estado].texto}</Insignia>
                  </p>
                  <p className="text-xs text-tenue mt-0.5">
                    {b.estado === "terminada" ? `Del ${fecha(b.inicioReal ?? b.finReal)} al ${fecha(b.finReal)}`
                      : b.estado !== "pendiente" ? `Empezó el ${fecha(b.inicioReal ?? b.inicioPlan)}${b.finPlan ? ` · según el plan termina el ${fecha(b.finPlan)}` : ""}`
                      : !b.inicioPlan ? "Sin plan"
                      : b.inicioPlan === b.finPlan ? `Plan: el ${fecha(b.inicioPlan)}` : `Plan: del ${fecha(b.inicioPlan)} al ${fecha(b.finPlan)}`}
                    {b.estado !== "terminada" && b.horasEst > 0 && ` · faltan ≈ ${horas(b.horasRest)} de ${horas(b.horasEst)}`}
                  </p>
                  {b.estado !== "terminada" && (
                    <p className="text-xs mt-0.5">{c?.nombres.length ? `${c.trabajando ? "Trabajando" : "Cuadrilla planeada"}: ${c.nombres.join(", ")}` : <span className="text-tenue">Sin cuadrilla (el plan cuenta 2 personas)</span>}</p>
                  )}
                  {b.estado === "pendiente" && b.desde != null && b.desde < hoy && <p className="text-xs text-aviso mt-0.5">Ya debió empezar según el plan</p>}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-tenue">
          El plan sale de las horas estimadas de cada etapa, lo que da su cuadrilla al día y lo que puede trabajar cada área, en el orden de la fila. Si algo se atrasa o se adelanta en el piso, el plan se mueve solo.
        </p>
      </div>
    </Lateral>
  );
}

function Dato({ titulo, valor, explica }: { titulo: string; valor: string; explica: string }) {
  return (
    <div className="rounded-lg border border-borde p-2.5" data-explain={explica} data-explain-title={titulo}>
      <p className="text-[11px] text-tenue">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold cifra">{valor}</p>
    </div>
  );
}

/**
 * El Gantt de unas cuantas órdenes, para la ficha de un pedido o de una orden. El mismo plan
 * (la misma consulta que el Gantt completo): el vendedor ve fechas; la planta, también horas
 * y cuadrilla.
 */
export function GanttCompacto({ ordenes, alAbrir }: { ordenes: string[]; alAbrir?: (id: string) => void }) {
  const { puede } = useSesion();
  return puede("produccion", 2) ? <GanttCompactoTaller ordenes={ordenes} alAbrir={alAbrir} /> : <GanttCompactoBase ordenes={ordenes} alAbrir={alAbrir} />;
}
function GanttCompactoTaller(p: { ordenes: string[]; alAbrir?: (id: string) => void }) {
  return <GanttCompactoBase {...p} cuadrillas={useCuadrillaPorEtapa()} detalleTaller />;
}
function GanttCompactoBase({ ordenes, alAbrir, cuadrillas, detalleTaller = false }: {
  ordenes: string[]; alAbrir?: (id: string) => void; cuadrillas?: Map<string, { nombres: string[]; trabajando: boolean }>; detalleTaller?: boolean;
}) {
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "op_operaciones"]);
  const plan = useQuery({ queryKey: [...CLAVE, "plan"], queryFn: () => q<FilaPlan[]>(supabase.rpc("plan_produccion")) });
  const tablero = useTablero();
  const etapas = useEtapas();
  const hoy = aDia(hoyISO());
  const todas = useMemo(() => armar(plan.data ?? [], tablero.data ?? [], etapas.data ?? [], hoy), [plan.data, tablero.data, etapas.data, hoy]);
  const ids = new Set(ordenes);
  const mias = todas.filter((g) => ids.has(g.id)).sort((a, b) => (a.posicion ?? 9999) - (b.posicion ?? 9999) || a.o.folio.localeCompare(b.o.folio));
  // El zoom que deja ver todo sin recorrer: hasta la última etapa y la fecha compromiso.
  const caja = useRef<HTMLDivElement>(null);
  const [anchoCaja, setAnchoCaja] = useState(0);
  useLayoutEffect(() => {
    if (!caja.current) return;
    const ro = new ResizeObserver(([e]) => setAnchoCaja(e.contentRect.width));
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, []);
  // Todo a la vista sin recorrer: el mismo rango que arma el diagrama compacto, repartido en
  // el ancho de la ficha; la regla dice días, semanas o meses según lo que quepa.
  const desdes = mias.flatMap((g) => g.barras.map((b) => b.desde)).filter((d): d is number => d != null);
  const hastas = mias.flatMap((g) => [...g.barras.map((b) => b.hasta), g.compromiso]).filter((d): d is number => d != null);
  const ini0 = Math.max(Math.min(hoy - 3, ...desdes), hoy - 21);
  const dias = Math.min(Math.max(hoy + 7, ...hastas) + 5, hoy + 760) - (ini0 - diaSemana(ini0)) + 1;
  const cabe = anchoCaja - (window.innerWidth >= 640 ? 208 : 152) - 2;
  const pxDia = Math.min(42, Math.max(6, Math.floor((cabe / dias) * 10) / 10));
  const zoom: Zoom = pxDia >= 34 ? "dia" : pxDia >= 9 ? "semana" : "mes";
  // Un solo contenedor medido, cargue o no: el observador se queda pegado al mismo elemento.
  return (
    <div ref={caja}>
      {plan.error ? <ErrorCarga error={plan.error} />
      : plan.isLoading || tablero.isLoading || etapas.isLoading || !anchoCaja ? <Cargando filas={2} />
      : !mias.length ? <p className="px-1 text-sm text-tenue">Sin etapas por planear: las órdenes de aquí ya se terminaron o se cancelaron.</p>
      : <Diagrama zoom={zoom} vista="orden" hoy={hoy}
          activas={mias.filter((g) => !g.enEspera)} enEspera={mias.filter((g) => g.enEspera)} etapas={etapas.data ?? []}
          carga={[]} buscar="" ver="todas" cuadrillas={cuadrillas ?? new Map()} arrastrable={false}
          alAbrir={alAbrir ?? (() => {})} alReordenar={() => {}} compacto detalleTaller={detalleTaller} pxDia={pxDia} />}
    </div>
  );
}
