// Gráficas de métricas de producción. Antes de creerle a una eficiencia hay que saber de cuántas
// etapas salió (RegistroTerminal); luego, lo que se decide: si cumplimos las fechas y lo que viene
// (Cumplimiento), dónde se atora el trabajo hoy y en el periodo (EdadTrabajo, EsperaTrabajo), qué
// horas del costeo recalibrar (HorasContraCosteo), qué detiene al piso (HorasDetenidas) y qué área
// recibe más de lo que saca (FlujoAcumulado). Todo lo calcula produccion_analitica(); aquí solo se
// dibuja. Una gráfica sin datos suficientes dice qué capturar en vez de dibujarse vacía.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Hourglass, PauseCircle, Timer, Waves } from "lucide-react";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { Vacio } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { dinero, fecha, numero, porcentaje } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { CAUSAS_ESPERA, MOTIVOS_PAUSA, folioCorto, horas } from "./util";

export interface AnaliticaProd {
  con_costos: boolean;
  jornada_h: number;
  registro: { etapa_id: number; etapa: string; terminadas: number; con_tiempo: number; sin_tiempo: number; sin_marcar: number }[];
  registro_extra: { tramos_largos: number; sin_iniciar: number };
  cumplimiento: {
    juzgadas: number; a_tiempo: number; vencidas: number; atraso_mediana: number | null; por_venir: number; por_venir_tarde: number;
    rangos: { rango: string; a_tiempo: boolean; terminadas: number; vencidas: number; plan: number; folios: string[]; folios_plan: string[] }[];
    meses: { mes: string; n: number; p: number; pbar: number; lcs: number; lci: number }[];
    meses_suficiente: boolean;
  };
  edad: {
    operacion_id: string; orden_id: string; folio: string; equipo: string; etapa_id: number; etapa: string;
    estado: "en_proceso" | "esperando" | "pausada"; dias: number; esperado_dias: number | null; desde_conocido: boolean; avance: number | null;
  }[];
  flujo: { etapa_id: number; etapa: string; n: number; suficiente: boolean; espera_d: number; trabajo_d: number; detenida_d: number; total_mediana_d: number }[];
  horas: {
    operacion_id: string; orden_id: string; folio: string; equipo: string; etapa_id: number; etapa: string; terminada: boolean; avance: number | null;
    estimadas: number; reales: number; proyectadas: number; razon: number; desvio_costo: number | null;
  }[];
  horas_etapas: { etapa_id: number; etapa: string; n: number; suficiente: boolean; p25: number; mediana: number; p75: number }[];
  sin_estimado: { orden_id: string; folio: string; etapa: string; reales: number }[];
  pausas: {
    motivos: { motivo: string; pausas: number; horas: number }[]; total: number; con_motivo: number; suficiente: boolean;
    en_espera: { causa: string; ordenes: number; dias: number | null }[];
  };
  acumulado: { etapa_id: number; etapa: string; dia: string; terminado: number; en_proceso: number; en_cola: number }[];
  acumulado_dias: number; acumulado_semanal: boolean; acumulado_suficiente: boolean;
}

const corta = (iso: string) => fecha(iso).replace(/ \d{4}$/, "");
const SUPERFICIE = "hsl(var(--superficie))";
const jornadas = (n: number | null | undefined) => (n == null ? "—" : `${numero(n)} ${n === 1 ? "jornada" : "jornadas"}`);
/** Dispersión vertical de los puntos de una misma fila, por su lugar en la fila: siempre igual, no al azar. */
const desfase = (i: number) => [0, -0.22, 0.22, -0.11, 0.11, -0.3, 0.3][i % 7];

function Falta({ icono, titulo, texto }: { icono: typeof Timer; titulo: string; texto: string }) {
  return <Vacio icono={icono} titulo={titulo} texto={texto} className="py-8" />;
}

// ------------------------------------------------------------------------- A. cuánto creerle
const CLASES = [
  { clave: "con_tiempo", nombre: "Con tiempo", color: "hsl(var(--ok))" },
  { clave: "sin_tiempo", nombre: "Marcada sin tiempo", color: "hsl(var(--aviso))" },
  { clave: "sin_marcar", nombre: "Cerrada sin marcar", color: "var(--serie-resto)" },
] as const;

/** Barras al 100 % por etapa, en el orden del taller (es un proceso, no un ranking). */
export function RegistroTerminal({ a }: { a: AnaliticaProd }) {
  const filas = a.registro.filter((r) => r.terminadas > 0).map((r) => ({
    ...r, etiqueta: `${numero(r.con_tiempo)} de ${numero(r.terminadas)}`,
    con_tiempo_p: r.con_tiempo / r.terminadas, sin_tiempo_p: r.sin_tiempo / r.terminadas, sin_marcar_p: r.sin_marcar / r.terminadas,
  }));
  if (!filas.length) return <Falta icono={Timer} titulo="Ninguna etapa terminada en el periodo" texto="Prueba con un periodo más largo; aquí sale cuántas se marcaron en la terminal." />;
  const total = filas.reduce((s, r) => s + r.terminadas, 0);
  const ct = filas.reduce((s, r) => s + r.con_tiempo, 0);
  // La que más pesa sin tiempo: la primera a capacitar.
  const peor = [...filas].filter((r) => r.con_tiempo === 0).sort((x, y) => y.terminadas - x.terminadas)[0];
  const x = a.registro_extra;
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm">
        {ct === 0 ? "Ninguna" : `Solo ${numero(ct)}`} de <b className="cifra">{numero(total)}</b> etapas terminadas ({porcentaje(ct / total, 0)}) {ct === 1 ? "tiene" : "tienen"} tiempo real
        {peor ? <>; {peor.etapa} marca <b className="cifra">0 de {numero(peor.terminadas)}</b></> : null}.
      </p>
      <div className="px-3" data-explain={GLOSARIO.registroTerminal} data-explain-title="Cómo se cerró cada etapa">
        <Leyenda series={CLASES.map((c) => ({ nombre: c.nombre, color: c.color }))} />
      </div>
      <div style={{ height: filas.length * 34 + 32 }} className="pt-1">
        <ResponsiveContainer>
          <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--rejilla)" />
            <XAxis type="number" {...ejeProps} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => porcentaje(v, 0)} />
            <YAxis yAxisId="e" type="category" dataKey="etapa" {...ejeProps} width={84} fontSize={11} />
            <YAxis yAxisId="n" type="category" dataKey="etiqueta" orientation="right" {...ejeProps} width={72} fontSize={11} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipRegistro />} />
            {CLASES.map((c, i) => (
              <Bar key={c.clave} yAxisId="e" dataKey={`${c.clave}_p`} name={c.nombre} stackId="r" fill={c.color} maxBarSize={24}
                stroke={SUPERFICIE} strokeWidth={2} radius={i === CLASES.length - 1 ? [0, 4, 4, 0] : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(x.tramos_largos > 0 || x.sin_iniciar > 0) && (
        <p className="px-3 pt-1 text-xs text-tenue">
          {x.sin_iniciar > 0 && <>{numero(x.sin_iniciar)} {x.sin_iniciar === 1 ? "etapa se terminó" : "etapas se terminaron"} en el periodo sin iniciarse en la terminal: sus horas no cuentan. </>}
          {/* Una etapa larga (Pailería de cientos de horas) puede seguir abierta semanas sin error: se avisa para revisar, no se acusa. */}
          {x.tramos_largos > 0 && <>{numero(x.tramos_largos)} {x.tramos_largos === 1 ? "tiempo lleva" : "tiempos llevan"} más de 5 jornadas abierto sin pausa: revisa que esa gente siga en la etapa; si ya no, que le den «Sale».</>}
        </p>
      )}
    </div>
  );
}

function TooltipRegistro({ active, payload }: { active?: boolean; payload?: { payload: AnaliticaProd["registro"][number] }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[190px] space-y-0.5">
      <p className="font-medium">{r.etapa} · {numero(r.terminadas)} terminadas</p>
      {CLASES.map((c) => (
        <p key={c.clave} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
          <span className="text-tenue">{c.nombre}</span><span className="ml-auto cifra font-medium">{numero(r[c.clave])}</span></p>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------ B. cumplimiento
/** Histograma en espejo: arriba lo juzgado, abajo lo que viene según el plan. Un solo eje Y. */
export function Cumplimiento({ a }: { a: AnaliticaProd }) {
  const c = a.cumplimiento;
  const datos = c.rangos.map((r) => ({ ...r, Terminadas: r.terminadas, "Vencidas sin terminar": r.vencidas, "Lo que viene": -r.plan }));
  if (!c.juzgadas && !c.por_venir) return <Falta icono={Hourglass} titulo="Ninguna orden con fecha compromiso en el periodo" texto="Cuando se terminen órdenes con fecha compromiso, aquí sale cuántos días antes o después salieron." />;
  const aTiempo = c.rangos.filter((r) => r.a_tiempo);
  // Eje simétrico con marcas enteras redondas (en valor absoluto, arriba y abajo).
  const alto = Math.max(1, ...datos.map((d) => d.terminadas + d.vencidas), ...datos.map((d) => d.plan));
  const paso = alto <= 4 ? 1 : alto <= 10 ? 2 : alto <= 25 ? 5 : 10;
  const max = Math.ceil(alto / paso) * paso;
  const marcas = Array.from({ length: (2 * max) / paso + 1 }, (_, i) => -max + i * paso);
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm">
        <b className="cifra">{numero(c.a_tiempo)} de {numero(c.juzgadas)}</b> a tiempo ({porcentaje(c.juzgadas ? c.a_tiempo / c.juzgadas : null, 0)}).
        {c.atraso_mediana != null && <> Las tarde se pasan <b className="cifra">{numero(c.atraso_mediana)} días</b> (mediana).</>}
        {c.por_venir > 0 && <> De las <b className="cifra">{numero(c.por_venir)}</b> que vienen, <b className="cifra">{numero(c.por_venir_tarde)}</b> van tarde según el plan.</>}
      </p>
      <div className="px-3 flex flex-wrap gap-x-4">
        <span data-explain={GLOSARIO.diasContraCompromiso} data-explain-title="Lo juzgado">
          <Leyenda series={[{ nombre: "Terminadas", color: SERIE(1) }, { nombre: "Vencidas sin terminar", color: SERIE(2) }]} /></span>
        <span data-explain={GLOSARIO.loQueViene} data-explain-title="Lo que viene"><Leyenda series={[{ nombre: "Lo que viene, según el plan", color: SERIE(3) }]} /></span>
      </div>
      <div className="h-64 pt-1">
        <ResponsiveContainer>
          <BarChart data={datos} stackOffset="sign" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            {aTiempo.length > 0 && <ReferenceArea x1={aTiempo[0].rango} x2={aTiempo[aTiempo.length - 1].rango} fill="hsl(var(--ok))" fillOpacity={0.06}
              label={{ value: "A tiempo", position: "insideTopLeft", fontSize: 11, fill: "var(--eje)" }} />}
            <XAxis dataKey="rango" {...ejeProps} fontSize={11} interval={0} height={36} tick={<TickRango />} />
            <YAxis {...ejeProps} width={32} allowDecimals={false} domain={[-max, max]} ticks={marcas} tickFormatter={(v) => numero(Math.abs(v))} />
            <ReferenceLine y={0} stroke="var(--eje)" />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipCumplimiento />} />
            <Bar dataKey="Terminadas" stackId="c" fill={SERIE(1)} stroke={SUPERFICIE} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="Vencidas sin terminar" stackId="c" fill={SERIE(2)} stroke={SUPERFICIE} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Lo que viene" stackId="c" fill={SERIE(3)} stroke={SUPERFICIE} strokeWidth={2} maxBarSize={24} radius={[0, 0, 4, 4]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <GraficaP c={c} />
    </div>
  );
}

/** El rango en dos renglones («1 a 7» / «tarde») para que quepan los siete sin inclinarse. */
function TickRango({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const t = payload?.value ?? "";
  const k = t.lastIndexOf(" ");
  const [l1, l2] = t === "El día" ? ["El día", ""] : [t.slice(0, k), t.slice(k + 1)];
  return (
    <text x={x} y={(y ?? 0) + 10} textAnchor="middle" fontSize={11} fill="var(--eje)">
      <tspan x={x} dy={0}>{l1}</tspan>{l2 && <tspan x={x} dy={13}>{l2}</tspan>}
    </text>
  );
}

function TooltipCumplimiento({ active, payload }: { active?: boolean; payload?: { payload: AnaliticaProd["cumplimiento"]["rangos"][number] }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const lista = (f: string[]) => f.slice(0, 8).map(folioCorto).join(", ") + (f.length > 8 ? ` y ${f.length - 8} más` : "");
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[200px] max-w-[280px] space-y-1">
      <p className="font-medium">{r.rango}{r.a_tiempo ? " · a tiempo" : ""}</p>
      {[["Terminadas", r.terminadas, SERIE(1)], ["Vencidas sin terminar", r.vencidas, SERIE(2)], ["Lo que viene", r.plan, SERIE(3)]].map(([n, v, col]) => (
        <p key={n as string} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: col as string }} />
          <span className="text-tenue">{n}</span><span className="ml-auto cifra font-medium">{numero(v as number)}</span></p>
      ))}
      {r.folios.length > 0 && <p className="text-tenue cifra">{lista(r.folios)}</p>}
      {r.folios_plan.length > 0 && <p className="text-tenue cifra">Vienen: {lista(r.folios_plan)}</p>}
    </div>
  );
}

/** Gráfica p mensual: solo con 6 meses de al menos 5 órdenes; antes, dice cuánto falta. */
function GraficaP({ c }: { c: AnaliticaProd["cumplimiento"] }) {
  if (!c.meses_suficiente) {
    const conN = c.meses.filter((m) => m.n >= 5).length;
    return (
      <p className="px-3 pt-1 text-xs text-tenue" data-explain={GLOSARIO.graficaPCumplimiento} data-explain-title="Gráfica de control por mes">
        La gráfica de control por mes sale con 6 meses de al menos 5 órdenes con fecha; en este periodo {conN === 1 ? "hay 1" : `hay ${numero(conN)}`}. Prueba con 12 meses.
      </p>
    );
  }
  const datos = c.meses.map((m) => ({ ...m, etiqueta: corta(m.mes) }));
  return (
    <div className="pt-3" data-explain={GLOSARIO.graficaPCumplimiento} data-explain-title="Gráfica de control por mes">
      <div className="px-3"><Leyenda series={[{ nombre: "A tiempo en el mes", color: SERIE(1) }, { nombre: "Promedio", color: "var(--eje)" }, { nombre: "Límites de control", color: "var(--serie-resto)" }]} /></div>
      <div className="h-40 pt-1">
        <ResponsiveContainer>
          <LineChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" />
            <YAxis {...ejeProps} width={44} domain={[0, 1]} tickFormatter={(v) => porcentaje(v, 0)} />
            <Tooltip content={<TooltipGrafica formato={(v) => porcentaje(v, 0)} />} />
            <ReferenceLine y={datos[0].pbar} stroke="var(--eje)" strokeDasharray="4 4" />
            <Line dataKey="lcs" name="Límite superior" stroke="var(--serie-resto)" strokeWidth={1.5} dot={false} type="step" isAnimationActive={false} />
            <Line dataKey="lci" name="Límite inferior" stroke="var(--serie-resto)" strokeWidth={1.5} dot={false} type="step" isAnimationActive={false} />
            <Line dataKey="p" name="A tiempo" stroke={SERIE(1)} strokeWidth={2} dot={{ r: 4, fill: SERIE(1), stroke: SUPERFICIE, strokeWidth: 2 }} type="linear" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- C. dónde se atora
const ESTADOS = [
  { clave: "en_proceso", nombre: "En proceso", color: SERIE(1) },
  { clave: "esperando", nombre: "Esperando", color: SERIE(2) },
  { clave: "pausada", nombre: "Pausada", color: SERIE(3) },
] as const;

/** Filas de etapa en el orden en que llegan (la base las manda en el orden del taller). */
function filasDeEtapa<T extends { etapa_id: number; etapa: string }>(xs: T[]) {
  const vistas = new Map<number, string>();
  for (const x of xs) if (!vistas.has(x.etapa_id)) vistas.set(x.etapa_id, x.etapa);
  return [...vistas.entries()].map(([id, nombre]) => ({ id, nombre }));
}

type PuntoEdad = AnaliticaProd["edad"][number] & { x: number; y: number; color: string; rotular: boolean };

/** Puntos por etapa: cuántas jornadas lleva cada etapa abierta en su estado. Hoy, no del periodo. */
export function EdadTrabajo({ a }: { a: AnaliticaProd }) {
  const ir = useNavigate();
  const etapas = useMemo(() => filasDeEtapa(a.edad), [a.edad]);
  const pts = useMemo(() => {
    const vistos = new Map<number, number>();
    return a.edad.map((e): PuntoEdad => {
      const fila = etapas.findIndex((x) => x.id === e.etapa_id);
      const k = vistos.get(e.etapa_id) ?? 0;
      vistos.set(e.etapa_id, k + 1);
      return { ...e, x: e.dias, y: fila + desfase(k), color: ESTADOS.find((s) => s.clave === e.estado)?.color ?? SERIE(1),
        rotular: e.esperado_dias != null && e.esperado_dias > 0 && e.dias > 1.5 * e.esperado_dias };
    });
  }, [a.edad, etapas]);
  if (!pts.length) return <Falta icono={Hourglass} titulo="Nada abierto en el taller" texto="Cuando haya órdenes liberadas, aquí sale cuánto lleva cada etapa esperando, en proceso o pausada." />;
  const cuenta = (s: string) => pts.filter((p) => p.estado === s).length;
  const viejo = pts.reduce((m, p) => (p.dias > m.dias ? p : m), pts[0]);
  const maxX = Math.max(5, Math.ceil(viejo.dias * 1.08));
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm">
        <b className="cifra">{numero(pts.length)}</b> etapas abiertas: {numero(cuenta("en_proceso"))} en proceso, {numero(cuenta("pausada"))} pausadas y {numero(cuenta("esperando"))} esperando.
        Lo más viejo: <b className="cifra">{folioCorto(viejo.folio)}</b> lleva <b className="cifra">{jornadas(viejo.dias)}</b> en {viejo.etapa}.
      </p>
      <div className="px-3 flex flex-wrap items-center gap-x-4 gap-y-1" data-explain={GLOSARIO.edadTrabajo} data-explain-title="Estado y punto hueco">
        <Leyenda series={ESTADOS.map((s) => ({ nombre: s.nombre, color: s.color }))} />
        <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><span className="h-2.5 w-2.5 rounded-full border-2 border-[color:var(--eje)]" />Desde que llegó al ERP (lleva al menos eso)</span>
      </div>
      <div style={{ height: etapas.length * 46 + 44 }} className="pt-1">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 24, left: 4, bottom: 16 }}>
            <CartesianGrid stroke="var(--rejilla)" />
            <XAxis type="number" dataKey="x" {...ejeProps} domain={[0, maxX]} allowDecimals={false}
              label={{ value: "Jornadas del taller", position: "insideBottom", offset: -10, fontSize: 11, fill: "var(--eje)" }} />
            <YAxis type="number" dataKey="y" {...ejeProps} domain={[-0.5, etapas.length - 0.5]} ticks={etapas.map((_, i) => i)} reversed
              tickFormatter={(v) => etapas[v]?.nombre ?? ""} width={84} fontSize={11} interval={0} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipEdad />} />
            <Scatter data={pts} isAnimationActive={false} cursor="pointer" shape={<PuntoEstado />}
              onClick={(p: { orden_id?: string }) => { if (p.orden_id) ir(`/produccion/ordenes/${p.orden_id}`); }}>
              <LabelList dataKey="folio" content={(p: { x?: number | string; y?: number | string; index?: number }) => {
                const d = pts[p.index ?? -1];
                if (!d?.rotular) return null;
                return <text x={Number(p.x) + 14} y={Number(p.y) + 4} fontSize={10} fill="var(--eje)">{folioCorto(d.folio)}</text>;
              }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Punto relleno con anillo de superficie; hueco cuando no se sabe desde cuándo cuenta. */
function PuntoEstado(p: { cx?: number; cy?: number; payload?: PuntoEdad | PuntoHoras }) {
  if (p.cx == null || p.cy == null || !p.payload) return <g />;
  const lleno = "desde_conocido" in p.payload ? p.payload.desde_conocido : p.payload.terminada;
  const color = p.payload.color;
  return lleno
    ? <circle cx={p.cx} cy={p.cy} r={5} fill={color} stroke={SUPERFICIE} strokeWidth={2} />
    : <circle cx={p.cx} cy={p.cy} r={4.5} fill={SUPERFICIE} stroke={color} strokeWidth={2} />;
}

function TooltipEdad({ active, payload }: { active?: boolean; payload?: { payload: PuntoEdad }[] }) {
  if (!active || !payload?.length) return null;
  const e = payload[0].payload;
  const estado = ESTADOS.find((s) => s.clave === e.estado)?.nombre;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[200px] max-w-[280px] space-y-0.5">
      <p className="font-medium cifra">{folioCorto(e.folio)} · {e.etapa}</p>
      <p className="text-tenue truncate">{e.equipo}</p>
      <p className="flex justify-between gap-3"><span className="text-tenue">{estado}</span><span className="cifra font-medium">{e.desde_conocido ? "" : "al menos "}{jornadas(e.dias)}</span></p>
      {e.esperado_dias != null && <p className="flex justify-between gap-3"><span className="text-tenue">Debería tardar con su gente</span><span className="cifra">{jornadas(e.esperado_dias)}</span></p>}
      {e.avance != null && <p className="flex justify-between gap-3"><span className="text-tenue">Avance que dio el piso</span><span className="cifra">{porcentaje(e.avance, 0)}</span></p>}
      <p className="text-tenue pt-0.5">Clic para abrir la orden</p>
    </div>
  );
}

const PARTES = [
  { clave: "espera_d", nombre: "Esperando", color: SERIE(2) },
  { clave: "trabajo_d", nombre: "Trabajo", color: SERIE(1) },
  { clave: "detenida_d", nombre: "Detenida", color: SERIE(3) },
] as const;

/** Espera + trabajo + detenida por área (promedios, para que sumen); con 5 etapas por área o más. */
export function EsperaTrabajo({ a }: { a: AnaliticaProd }) {
  const listas = a.flujo.filter((f) => f.suficiente);
  const faltan = a.flujo.filter((f) => !f.suficiente);
  if (!listas.length) {
    return (
      <div className="px-5 pb-4">
        <Falta icono={Timer} titulo="Todavía no alcanza"
          texto="Sale cuando un área junte 5 etapas que la terminal vio completas: iniciadas, con su gente y terminadas ahí mismo." />
        {faltan.length > 0 && (
          <ul className="text-sm divide-y divide-borde -mt-2">
            {faltan.map((f) => <li key={f.etapa_id} className="py-1.5 flex justify-between"><span>{f.etapa}</span><span className="text-tenue cifra">{numero(f.n)} de 5 · faltan {numero(5 - f.n)}</span></li>)}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="px-2 pb-3">
      <div className="px-3" data-explain={GLOSARIO.esperaVsTrabajo} data-explain-title="Espera contra trabajo"><Leyenda series={PARTES.map((s) => ({ nombre: s.nombre, color: s.color }))} /></div>
      <div style={{ height: listas.length * 34 + 36 }} className="pt-1">
        <ResponsiveContainer>
          <BarChart data={listas} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--rejilla)" />
            <XAxis type="number" {...ejeProps} tickFormatter={(v) => numero(v)} />
            <YAxis type="category" dataKey="etapa" {...ejeProps} width={84} fontSize={11} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipEspera />} />
            {PARTES.map((s, i) => (
              <Bar key={s.clave} dataKey={s.clave} name={s.nombre} stackId="f" fill={s.color} stroke={SUPERFICIE} strokeWidth={2} maxBarSize={24}
                radius={i === PARTES.length - 1 ? [0, 4, 4, 0] : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {faltan.length > 0 && <p className="px-3 text-xs text-tenue">Todavía sin suficientes: {faltan.map((f) => `${f.etapa} (faltan ${5 - f.n})`).join(", ")}.</p>}
    </div>
  );
}

function TooltipEspera({ active, payload }: { active?: boolean; payload?: { payload: AnaliticaProd["flujo"][number] }[] }) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[200px] space-y-0.5">
      <p className="font-medium">{f.etapa} · {numero(f.n)} etapas</p>
      {PARTES.map((s) => (
        <p key={s.clave} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          <span className="text-tenue">{s.nombre}</span><span className="ml-auto cifra font-medium">{jornadas(f[s.clave])}</span></p>
      ))}
      <p className="flex justify-between gap-3 border-t border-borde mt-1 pt-1"><span className="text-tenue">Total, la etapa típica (mediana)</span><span className="cifra">{jornadas(f.total_mediana_d)}</span></p>
    </div>
  );
}

// ------------------------------------------------------------- D. horas contra el costeo
const MIN_R = 0.25, MAX_R = 4;
const MARCAS = [0.25, 0.5, 1, 2, 4];
const TEXTO_MARCA: Record<number, string> = { 0.25: "¼×", 0.5: "½×", 1: "1×", 2: "2×", 4: "4×" };
const veces = (r: number) => `${numero(Math.round(r * 100) / 100)}×`;
type PuntoHoras = AnaliticaProd["horas"][number] & { x: number; y: number; color: string };

/** Puntos en escala log₂ (2× y ½× a la misma distancia de 1×), una fila por etapa. */
export function HorasContraCosteo({ a }: { a: AnaliticaProd }) {
  const ir = useNavigate();
  const etapas = useMemo(() => filasDeEtapa(a.horas), [a.horas]);
  const pts = useMemo(() => {
    const vistos = new Map<number, number>();
    return a.horas.map((h): PuntoHoras => {
      const k = vistos.get(h.etapa_id) ?? 0;
      vistos.set(h.etapa_id, k + 1);
      // Lo que se sale de ¼×–4× se pega al borde; el tooltip da el real.
      return { ...h, x: Math.min(MAX_R, Math.max(MIN_R, h.razon)), y: etapas.findIndex((e) => e.id === h.etapa_id) + desfase(k), color: SERIE(1) };
    });
  }, [a.horas, etapas]);
  const medianas = a.horas_etapas.filter((e) => e.suficiente).map((e) => ({ ...e, x: Math.min(MAX_R, Math.max(MIN_R, e.mediana)), y: etapas.findIndex((x) => x.id === e.etapa_id) }));
  const col: Columna<AnaliticaProd["horas"][number]>[] = [
    { clave: "equipo", titulo: "Equipo", celda: (h) => <div className="min-w-[160px] max-w-[260px]"><p className="truncate">{h.equipo}</p><p className="text-xs text-tenue cifra">{folioCorto(h.folio)} · {h.etapa}</p></div>,
      valor: (h) => `${h.equipo} ${h.folio} ${h.etapa}` },
    { clave: "estimadas", titulo: "Estimadas", alinear: "der", valor: (h) => h.estimadas, celda: (h) => <span className="cifra">{horas(h.estimadas)}</span> },
    { clave: "reales", titulo: "Reales", alinear: "der", valor: (h) => h.reales, celda: (h) => <span className="cifra">{horas(h.reales)}</span>, explica: GLOSARIO.horasHombre },
    { clave: "avance", titulo: "Avance", alinear: "der", valor: (h) => (h.terminada ? 1 : h.avance ?? 0),
      celda: (h) => <span className="cifra">{h.terminada ? "Terminada" : porcentaje(h.avance, 0)}</span> },
    { clave: "proyectadas", titulo: "Proyectadas", alinear: "der", valor: (h) => h.proyectadas, explica: GLOSARIO.horasProyectadas,
      celda: (h) => <span className="cifra">{h.terminada ? "—" : horas(h.proyectadas)}</span> },
    { clave: "razon", titulo: "Contra el costeo", alinear: "der", valor: (h) => h.razon, explica: GLOSARIO.horasContraCosteo,
      celda: (h) => <span className={h.razon > 1.25 ? "cifra font-medium text-peligro" : h.razon < 0.8 ? "cifra font-medium text-aviso" : "cifra"}>{veces(h.razon)}</span> },
    ...(a.con_costos ? [{ clave: "desvio_costo", titulo: "Costo de la diferencia", alinear: "der" as const, explica: GLOSARIO.costoDesperdicio,
      valor: (h: AnaliticaProd["horas"][number]) => h.desvio_costo ?? 0,
      celda: (h: AnaliticaProd["horas"][number]) => <span className="cifra">{h.desvio_costo == null ? "—" : dinero(h.desvio_costo)}</span> }] : []),
  ];
  if (!pts.length) {
    return <Falta icono={Timer} titulo="Ninguna etapa con horas completas"
      texto="Salen las etapas que el piso inició en la terminal con su gente desde el principio, y las que llevan al menos 10 % de avance." />;
  }
  return (
    <div className="px-2 pb-3">
      <div className="px-3 flex flex-wrap items-center gap-x-4 gap-y-1" data-explain={GLOSARIO.horasContraCosteo} data-explain-title="Relleno, hueco y mediana">
        <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIE(1) }} />Terminada</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: SERIE(1) }} />En proceso, proyectada</span>
        {medianas.length > 0 && <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><span className="h-3 w-0.5" style={{ background: "var(--eje)" }} />Mediana del área</span>}
        <span className="inline-flex items-center gap-1.5 text-xs text-tenue"><span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--rejilla)" }} />Normal (0.8× a 1.25×)</span>
      </div>
      <div style={{ height: etapas.length * 46 + 44 }} className="pt-1">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 24, left: 4, bottom: 16 }}>
            <CartesianGrid stroke="var(--rejilla)" />
            <ReferenceArea x1={0.8} x2={1.25} fill="var(--rejilla)" fillOpacity={0.7} />
            <XAxis type="number" dataKey="x" scale="log" domain={[MIN_R, MAX_R]} ticks={MARCAS} allowDataOverflow {...ejeProps}
              tickFormatter={(v) => TEXTO_MARCA[v] ?? veces(v)}
              label={{ value: "Horas reales ÷ horas del costeo", position: "insideBottom", offset: -10, fontSize: 11, fill: "var(--eje)" }} />
            <YAxis type="number" dataKey="y" {...ejeProps} domain={[-0.5, etapas.length - 0.5]} ticks={etapas.map((_, i) => i)} reversed
              tickFormatter={(v) => etapas[v]?.nombre ?? ""} width={84} fontSize={11} interval={0} />
            <ReferenceLine x={1} stroke="var(--eje)" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipHoras conCostos={a.con_costos} />} />
            {medianas.length > 0 && (
              <Scatter data={medianas} isAnimationActive={false} legendType="none"
                shape={(p: { cx?: number; cy?: number }) => p.cx == null || p.cy == null ? <g /> :
                  <line x1={p.cx} x2={p.cx} y1={p.cy - 14} y2={p.cy + 14} stroke="var(--eje)" strokeWidth={2} />} />
            )}
            <Scatter data={pts} isAnimationActive={false} cursor="pointer" shape={<PuntoEstado />}
              onClick={(p: { orden_id?: string }) => { if (p.orden_id) ir(`/produccion/ordenes/${p.orden_id}`); }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="px-1 pt-2">
        {/* Primero lo que más se aleja del costeo, para arriba o para abajo: es lo que hay que recalibrar. */}
        <TablaDatos filas={[...a.horas].sort((x, y) => Math.abs(Math.log2(y.razon)) - Math.abs(Math.log2(x.razon)))} columnas={col}
          claveFila={(h) => h.operacion_id} exportarComo="horas-contra-costeo" buscable={false} limite={8} compacta />
      </div>
      {a.sin_estimado.length > 0 && (
        <p className="px-3 pt-2 text-sm" data-explain={GLOSARIO.horasSinEstimado} data-explain-title="Horas sin costeo">
          <span className="font-medium">Horas marcadas sin horas en el costeo: </span>
          {a.sin_estimado.map((s) => `${s.etapa} de ${folioCorto(s.folio)} (${horas(s.reales)})`).join(" · ")}.
        </p>
      )}
    </div>
  );
}

function TooltipHoras({ active, payload, conCostos }: { active?: boolean; payload?: { payload: PuntoHoras }[]; conCostos: boolean }) {
  if (!active || !payload?.length || !("operacion_id" in payload[0].payload)) return null;
  const h = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[210px] max-w-[280px] space-y-0.5">
      <p className="font-medium cifra">{folioCorto(h.folio)} · {h.etapa}</p>
      <p className="text-tenue truncate">{h.equipo}</p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Estimadas</span><span className="cifra">{horas(h.estimadas)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Reales{h.terminada ? "" : ` (avance ${porcentaje(h.avance, 0)})`}</span><span className="cifra">{horas(h.reales)}</span></p>
      {!h.terminada && <p className="flex justify-between gap-3"><span className="text-tenue">Proyectadas</span><span className="cifra">{horas(h.proyectadas)}</span></p>}
      <p className="flex justify-between gap-3 font-medium"><span>Contra el costeo</span><span className="cifra">{veces(h.razon)}</span></p>
      {conCostos && h.desvio_costo != null && <p className="flex justify-between gap-3"><span className="text-tenue">Costo de la diferencia</span><span className="cifra">{dinero(h.desvio_costo)}</span></p>}
    </div>
  );
}

// ------------------------------------------------------------------ E. horas detenidas

// En el eje, una palabra; el texto completo va en el tooltip.
const CORTO: Record<string, string> = { material: "Material", etapa_anterior: "Otra etapa", maquina: "Máquina", ingenieria: "Ingeniería", calidad: "Calidad", otro: "Otro" };

/** El Pareto de ParetoParos con los motivos de pausa; mientras no haya 20 con motivo, dice qué capturar. */
export function HorasDetenidas({ a }: { a: AnaliticaProd }) {
  const p = a.pausas;
  const sinMotivo = p.motivos.find((m) => m.motivo === "sin_motivo");
  const prioridad = p.motivos.find((m) => m.motivo === "prioridad");
  const perdidas = p.motivos.filter((m) => m.motivo !== "sin_motivo" && m.motivo !== "prioridad" && m.horas > 0).sort((x, y) => y.horas - x.horas);
  const total = perdidas.reduce((s, m) => s + m.horas, 0);
  const espera = p.en_espera.length > 0 && (
    <p className="px-3 pt-2 text-xs text-tenue">
      En espera: {p.en_espera.map((e) => `${CAUSAS_ESPERA[e.causa] ?? e.causa} ${numero(e.ordenes)} ${e.ordenes === 1 ? "orden" : "órdenes"}${e.dias != null ? ` (la más vieja, ${numero(e.dias)} días)` : ""}`).join(" · ")}.
    </p>
  );
  if (!p.suficiente || !total) {
    const conM = perdidas.reduce((s, m) => s + m.pausas, 0);
    return (
      <div className="px-2 pb-3">
        <Falta icono={PauseCircle} titulo="Falta el motivo de las pausas"
          texto={`Al pausar en la terminal, el piso elige el motivo con un toque; con 20 pausas sale el Pareto. Llevas ${numero(conM)}${sinMotivo ? `; ${numero(sinMotivo.pausas)} del periodo no tienen motivo (${numero(sinMotivo.horas)} h detenidas)` : ""}.`} />
        {espera}
      </div>
    );
  }
  let acum = 0;
  const datos = perdidas.map((m) => { acum += m.horas; return { ...m, nombre: MOTIVOS_PAUSA[m.motivo] ?? m.motivo, corto: CORTO[m.motivo] ?? m.motivo, parte: m.horas / total, acumulado: acum / total }; });
  const vitales = datos.findIndex((x) => x.acumulado >= 0.8) + 1;
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm"><b className="cifra">{vitales}</b> {vitales === 1 ? "motivo junta" : "motivos juntan"} el 80 % de las <b className="cifra">{numero(total)}</b> h detenidas.
        {(sinMotivo || prioridad) && <span className="text-tenue"> Fuera del Pareto: {[sinMotivo && `${numero(sinMotivo.pausas)} sin motivo`, prioridad && `${numero(prioridad.pausas)} por cambio de orden (${numero(prioridad.horas)} h)`].filter(Boolean).join(" y ")}.</span>}
      </p>
      <div className="px-3" data-explain={GLOSARIO.horasDetenidas} data-explain-title="Pareto de horas detenidas">
        <Leyenda series={[{ nombre: "Parte de las horas detenidas", color: SERIE(1) }, { nombre: "Acumulado", color: SERIE(2) }]} /></div>
      <div className="h-60 pt-1">
        <ResponsiveContainer>
          <ComposedChart data={datos} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="corto" {...ejeProps} fontSize={10} interval={0} height={24} />
            <YAxis {...ejeProps} width={40} domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(v) => porcentaje(v, 0)} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipMotivo />} />
            <ReferenceLine y={0.8} stroke="var(--eje)" strokeDasharray="4 4" label={{ value: "80 %", position: "insideTopRight", fontSize: 11, fill: "var(--eje)" }} />
            <Bar dataKey="parte" name="Parte" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Line dataKey="acumulado" name="Acumulado" stroke={SERIE(2)} strokeWidth={2} dot={{ r: 4, fill: SERIE(2), stroke: SUPERFICIE, strokeWidth: 2 }} type="linear" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {espera}
    </div>
  );
}

function TooltipMotivo({ active, payload }: { active?: boolean; payload?: { payload: { nombre: string; pausas: number; horas: number; parte: number; acumulado: number } }[] }) {
  if (!active || !payload?.length) return null;
  const x = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[180px] space-y-0.5">
      <p className="font-medium">{x.nombre}</p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Pausas</span><span className="cifra">{numero(x.pausas)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Horas detenidas</span><span className="cifra font-medium">{numero(x.horas)} h</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Parte del total</span><span className="cifra">{porcentaje(x.parte, 0)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Acumulado</span><span className="cifra">{porcentaje(x.acumulado, 0)}</span></p>
    </div>
  );
}

// ------------------------------------------------------------------- F. flujo acumulado
// Los estados son ordinales (de cola a terminado): rampa secuencial de un tono.
const CAPAS = [
  { clave: "terminado", nombre: "Terminado (acumulado)", color: "var(--seq-6)" },
  { clave: "en_proceso", nombre: "En proceso", color: "var(--seq-4)" },
  { clave: "en_cola", nombre: "En cola", color: "var(--seq-2)" },
] as const;

/** Un flujo acumulado chico por área, con el mismo eje de días; cada uno con su escala de horas. */
export function FlujoAcumulado({ a }: { a: AnaliticaProd }) {
  const porEtapa = useMemo(() => {
    const m = new Map<number, { etapa: string; filas: (AnaliticaProd["acumulado"][number] & { etiqueta: string })[] }>();
    for (const x of a.acumulado) {
      if (!m.has(x.etapa_id)) m.set(x.etapa_id, { etapa: x.etapa, filas: [] });
      m.get(x.etapa_id)!.filas.push({ ...x, etiqueta: corta(x.dia) });
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).filter((e) => e.filas.some((f) => f.terminado + f.en_proceso + f.en_cola > 0));
  }, [a.acumulado]);
  if (!porEtapa.length) return <Falta icono={Waves} titulo="Sin flujo que mostrar" texto="Sale cuando el piso empiece y termine etapas en la terminal: cada día se apunta cuánto hay en cola, en proceso y terminado." />;
  return (
    <div className="px-2 pb-3">
      <div className="px-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span data-explain={GLOSARIO.flujoAcumulado} data-explain-title="Flujo acumulado"><Leyenda series={CAPAS.map((c) => ({ nombre: c.nombre, color: c.color }))} /></span>
        {!a.acumulado_suficiente && <span className="text-xs text-aviso">Pocos días: {numero(a.acumulado_dias)} hábiles con terminal. Se lee bien con 40 o más.</span>}
        {a.acumulado_semanal && <span className="text-xs text-tenue">Por semana (el viernes de cada una).</span>}
      </div>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-3 pt-2">
        {porEtapa.map((e) => (
          <div key={e.id}>
            <p className="px-3 text-xs font-medium">{e.etapa}</p>
            <div className="h-36">
              <ResponsiveContainer>
                <AreaChart data={e.filas} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} syncId="cfd">
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="etiqueta" {...ejeProps} fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...ejeProps} fontSize={10} width={52} tickFormatter={(v) => `${numero(v)} h`} />
                  <Tooltip content={<TooltipGrafica formato={(v) => `${numero(v)} h`} />} />
                  {CAPAS.map((c) => (
                    <Area key={c.clave} dataKey={c.clave} name={c.nombre} stackId="f" type="linear" fill={c.color} fillOpacity={1}
                      stroke={SUPERFICIE} strokeWidth={2} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
