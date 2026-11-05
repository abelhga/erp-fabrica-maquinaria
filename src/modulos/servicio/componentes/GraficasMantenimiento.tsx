// Gráficas de métricas de mantenimiento: disponibilidad semanal con su meta, Pareto de horas
// paradas, diagrama de dispersión fallas × MTTR (jack-knife), carga de preventivos que viene y
// antigüedad de lo abierto. Los números salen de metricas_mantenimiento y mantenimiento_analitica.
import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { fecha, numero, porcentaje } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

export interface Analitica {
  semanas: { semana: string; horas: number; fuera: number; disponibilidad: number | null; con_registro: boolean; fallas: number; prev_a_tiempo: number; prev_tarde: number }[];
  carga: { semana: string | null; alta: number; media: number; baja: number; horas: number }[];
  antiguedad: { rango: string; preventivo: number; falla: number; falla_parada: number }[];
}
export interface MaquinaGraf { id: string; numero: string; nombre: string; fallas: number; horas_fuera: number; mttr_h: number | null; criticidad: string | null; critica: boolean }

const META = 0.98;
const corta = (iso: string) => fecha(iso).replace(/ \d{4}$/, "");

/** Disponibilidad por semana con la meta, y debajo (mismo eje X) fallas y preventivos: dos gráficas, un solo eje cada una. */
export function DisponibilidadSemanal({ a }: { a: Analitica }) {
  const datos = a.semanas.filter((s) => s.con_registro).map((s) => ({ ...s, etiqueta: corta(s.semana) }));
  if (datos.length < 2) return <p className="px-5 pb-5 text-sm text-tenue">Todavía no hay suficientes semanas con registro de mantenimiento.</p>;
  // Eje desde un punto abajo de lo más bajo (o de la meta), en pasos redondos: 97, 98, 99, 100 %.
  const min = Math.min(...datos.map((d) => d.disponibilidad ?? 1), META);
  const paso = 1 - min > 0.05 ? 0.05 : 0.01;
  const piso = Math.max(0, Math.floor((min - paso / 2) / paso) * paso);
  const marcas = Array.from({ length: Math.round((1 - piso) / paso) + 1 }, (_, i) => Math.round((piso + i * paso) * 1000) / 1000);
  return (
    <div className="px-2 pb-3">
      <div className="px-3"><Leyenda series={[{ nombre: "Disponibilidad", color: SERIE(1) }, { nombre: `Meta ${porcentaje(META, 0)}`, color: "hsl(var(--ok))" }]} /></div>
      <div className="h-44 pt-1">
        <ResponsiveContainer>
          <LineChart data={datos} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} syncId="mant">
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="etiqueta" {...ejeProps} hide />
            <YAxis {...ejeProps} width={52} domain={[piso, 1]} ticks={marcas} tickFormatter={(v) => porcentaje(v, 0)} />
            <Tooltip content={<TooltipGrafica formato={(v) => porcentaje(v, 2)} />} />
            <ReferenceArea y1={piso} y2={META} fill="hsl(var(--aviso))" fillOpacity={0.06} />
            <ReferenceLine y={META} stroke="hsl(var(--ok))" strokeDasharray="4 4" />
            <Line dataKey="disponibilidad" name="Disponibilidad" stroke={SERIE(1)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} type="linear" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="px-3 pt-2" data-explain={GLOSARIO.cumplimientoPreventivo} data-explain-title="Preventivo a tiempo o tarde">
        <Leyenda series={[{ nombre: "Fallas", color: SERIE(2) }, { nombre: "Preventivo a tiempo", color: SERIE(3) }, { nombre: "Preventivo tarde", color: SERIE(4) }]} /></div>
      <div className="h-32 pt-1">
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 4, right: 16, left: 4, bottom: 0 }} syncId="mant" barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...ejeProps} width={52} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
            <Bar dataKey="fallas" name="Fallas" fill={SERIE(2)} maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="prev_a_tiempo" name="Preventivo a tiempo" stackId="p" fill={SERIE(3)} maxBarSize={14} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
            <Bar dataKey="prev_tarde" name="Preventivo tarde" stackId="p" fill={SERIE(4)} maxBarSize={14} radius={[3, 3, 0, 0]} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Pareto en un solo eje de %: cada barra es la parte de las horas paradas; la línea, lo acumulado. */
export function ParetoParos({ maquinas }: { maquinas: MaquinaGraf[] }) {
  const ir = useNavigate();
  const con = maquinas.filter((m) => m.horas_fuera > 0).sort((x, y) => y.horas_fuera - x.horas_fuera);
  const total = con.reduce((a, m) => a + m.horas_fuera, 0);
  if (!total) return <p className="px-5 py-6 text-center text-sm text-tenue">Ninguna máquina paró en el periodo.</p>;
  const N = 6;
  const top = con.slice(0, N);
  const resto = con.slice(N).reduce((a, m) => a + m.horas_fuera, 0);
  let acum = 0;
  const datos = [...top.map((m) => ({ id: m.id, nombre: m.numero, detalle: m.nombre, horas: m.horas_fuera })),
    ...(resto > 0 ? [{ id: "", nombre: "Resto", detalle: `${con.length - N} máquinas`, horas: resto }] : [])]
    .map((x) => { acum += x.horas; return { ...x, parte: x.horas / total, acumulado: acum / total }; });
  const vitales = datos.findIndex((x) => x.acumulado >= 0.8) + 1;
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm" data-explain={GLOSARIO.paretoFallas} data-explain-title="Regla 80/20"><b className="cifra">{vitales}</b> {vitales === 1 ? "máquina junta" : "máquinas juntan"} el 80 % de las <b className="cifra">{numero(total)}</b> horas paradas.</p>
      <div className="px-3"><Leyenda series={[{ nombre: "Parte de las horas paradas", color: SERIE(1) }, { nombre: "Acumulado", color: SERIE(2) }]} /></div>
      <div className="h-56 pt-1">
        <ResponsiveContainer>
          <ComposedChart data={datos} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="nombre" {...ejeProps} fontSize={10} interval={0} angle={-35} textAnchor="end" height={42} />
            <YAxis {...ejeProps} width={40} domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(v) => porcentaje(v, 0)} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipPareto />} />
            <ReferenceLine y={0.8} stroke="var(--eje)" strokeDasharray="4 4" label={{ value: "80 %", position: "insideTopRight", fontSize: 11, fill: "var(--eje)" }} />
            <Bar dataKey="parte" name="Parte" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} cursor="pointer"
              onClick={(x: { id?: string }) => { if (x.id) ir(`/servicio/maquinas/${x.id}`); }} />
            <Line dataKey="acumulado" name="Acumulado" stroke={SERIE(2)} strokeWidth={2} dot={{ r: 3, fill: SERIE(2) }} type="linear" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TooltipPareto({ active, payload }: { active?: boolean; payload?: { payload: { nombre: string; detalle: string; horas: number; parte: number; acumulado: number } }[] }) {
  if (!active || !payload?.length) return null;
  const x = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[180px] space-y-0.5">
      <p className="font-medium">{x.nombre} · {x.detalle}</p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Horas paradas</span><span className="cifra font-medium">{numero(x.horas)} h</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Parte del total</span><span className="cifra">{porcentaje(x.parte, 0)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Acumulado</span><span className="cifra">{porcentaje(x.acumulado, 0)}</span></p>
    </div>
  );
}

/**
 * Diagrama jack-knife: cuántas veces falla (X) contra cuánto tarda en volver (Y). Las líneas son los
 * promedios: arriba a la izquierda las agudas (pocas fallas, reparaciones largas: refacciones, proveedor),
 * abajo a la derecha las crónicas (fallan seguido: causa raíz, preventivo), arriba a la derecha las dos.
 * El tamaño del punto son las horas paradas.
 */
export function JackKnife({ maquinas }: { maquinas: MaquinaGraf[] }) {
  const ir = useNavigate();
  const pts = maquinas.filter((m) => m.fallas > 0 && m.mttr_h != null).map((m) => ({ ...m, x: m.fallas, y: m.mttr_h as number, z: Math.max(m.horas_fuera, 1) }));
  if (pts.length < 2) return <p className="px-5 py-6 text-center text-sm text-tenue">Hacen falta al menos dos máquinas con fallas cerradas en el periodo.</p>;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const maxX = Math.max(...pts.map((p) => p.x), 2) + 1;
  const maxY = Math.max(...pts.map((p) => p.y), my * 2) * 1.1;
  const unaCadaUna = pts.every((p) => p.x === 1);
  return (
    <div className="px-2 pb-3">
      {unaCadaUna && <p className="px-3 pb-2 text-xs text-tenue">Por ahora cada máquina tiene una sola falla en el periodo: se separan en crónicas y agudas conforme se acumule historia (prueba con 6 o 12 meses).</p>}
      <div className="h-64">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 16 }}>
            <CartesianGrid stroke="var(--rejilla)" />
            <XAxis type="number" dataKey="x" name="Fallas" {...ejeProps} domain={[0, maxX]} allowDecimals={false}
              label={{ value: "Fallas en el periodo", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--eje)" }} />
            <YAxis type="number" dataKey="y" name="MTTR" {...ejeProps} width={48} domain={[0, Math.ceil(maxY)]} tickFormatter={(v) => `${numero(v)} h`} />
            <ZAxis type="number" dataKey="z" range={[60, 600]} />
            <ReferenceLine x={mx} stroke="var(--eje)" strokeDasharray="4 4" />
            <ReferenceLine y={my} stroke="var(--eje)" strokeDasharray="4 4" />
            <ReferenceArea x1={0} x2={mx} y1={my} y2={Math.ceil(maxY)} fillOpacity={0} label={{ value: "Agudas", position: "insideTopLeft", fontSize: 11, fill: "var(--eje)" }} />
            <ReferenceArea x1={mx} x2={maxX} y1={0} y2={my} fillOpacity={0} label={{ value: "Crónicas", position: "insideBottomRight", fontSize: 11, fill: "var(--eje)" }} />
            <ReferenceArea x1={mx} x2={maxX} y1={my} y2={Math.ceil(maxY)} fill="hsl(var(--peligro))" fillOpacity={0.05}
              label={{ value: "Agudas y crónicas", position: "insideTopRight", fontSize: 11, fill: "var(--eje)" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipJack />} />
            <Scatter data={pts} fill={SERIE(1)} fillOpacity={0.75} stroke="hsl(var(--superficie))" strokeWidth={2} isAnimationActive={false} cursor="pointer"
              onClick={(p: { id?: string }) => { if (p.id) ir(`/servicio/maquinas/${p.id}`); }}>
              <LabelList dataKey="numero" position="right" fontSize={10} fill="var(--eje)" />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TooltipJack({ active, payload }: { active?: boolean; payload?: { payload: MaquinaGraf & { x: number; y: number } }[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[180px] space-y-0.5">
      <p className="font-medium">{m.numero} · {m.nombre}</p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Fallas</span><span className="cifra">{numero(m.fallas)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">MTTR</span><span className="cifra">{numero(m.y)} h</span></p>
      <p className="flex justify-between gap-3"><span className="text-tenue">Horas paradas</span><span className="cifra">{numero(m.horas_fuera)} h</span></p>
    </div>
  );
}

// Criticidad es ordinal: rampa secuencial de un tono (más oscuro = más crítica).
const CRIT = [{ clave: "alta", nombre: "Criticidad alta", color: "var(--seq-6)" }, { clave: "media", nombre: "Media", color: "var(--seq-4)" },
  { clave: "baja", nombre: "Baja o sin calificar", color: "var(--seq-2)" }] as const;

/** Preventivos que vienen en 8 semanas (proyectados de cada plan) y lo vencido al frente. */
export function CargaPreventivos({ a }: { a: Analitica }) {
  const datos = a.carga.map((c) => ({ ...c, etiqueta: c.semana ? corta(c.semana) : "Vencidos", total: c.alta + c.media + c.baja }));
  if (!datos.length) return <p className="px-5 py-6 text-center text-sm text-tenue">No hay planes de preventivo activos.</p>;
  const horas = datos.reduce((s, d) => s + d.horas, 0);
  const pico = datos.reduce((m, d) => (d.horas > m.horas ? d : m), datos[0]);
  return (
    <div className="px-2 pb-3">
      <p className="px-3 pb-2 text-sm"><b className="cifra">{numero(datos.reduce((s, d) => s + d.total, 0))}</b> preventivos en 8 semanas, unas <b className="cifra">{numero(horas)} h</b> de técnico. La semana más cargada es la del {pico.semana ? corta(pico.semana) : "—"} ({numero(pico.horas)} h).</p>
      <div className="px-3" data-explain={GLOSARIO.criticidadMaquina} data-explain-title="Colores por criticidad"><Leyenda series={CRIT.map((c) => ({ nombre: c.nombre, color: c.color }))} /></div>
      <div className="h-56 pt-1">
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" />
            <XAxis dataKey="etiqueta" {...ejeProps} fontSize={11} interval={0} />
            <YAxis {...ejeProps} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
            {CRIT.map((c, i) => (
              <Bar key={c.clave} dataKey={c.clave} name={c.nombre} stackId="c" fill={c.color} maxBarSize={30} stroke="hsl(var(--superficie))" strokeWidth={2}
                radius={i === CRIT.length - 1 ? [4, 4, 0, 0] : undefined} isAnimationActive={false}>
                {i === CRIT.length - 1 && (
                  <LabelList dataKey="horas" content={(p: { x?: number | string; y?: number | string; width?: number | string; value?: number | string }) => (
                    <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 5} textAnchor="middle" fontSize={10} fill="var(--eje)">{numero(Number(p.value))} h</text>
                  )} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const TIPOS = [{ clave: "preventivo", nombre: "Preventivo" }, { clave: "falla", nombre: "Falla" }, { clave: "falla_parada", nombre: "Falla con máquina parada" }] as const;

/** Lo abierto por antigüedad: si se acumula a la derecha, el taller no da abasto. */
export function AntiguedadAbierto({ a }: { a: Analitica }) {
  const datos = a.antiguedad.map((x) => ({ ...x, etiqueta: `${x.rango} días` }));
  if (!datos.some((x) => x.preventivo + x.falla + x.falla_parada > 0)) return null;
  return (
    <div className="px-2 pb-2">
      <div className="px-3" data-explain={GLOSARIO.antiguedadOrdenesMto} data-explain-title="Antigüedad de lo abierto"><Leyenda series={TIPOS.map((t, i) => ({ nombre: t.nombre, color: SERIE(i + 1) }))} /></div>
      <div className="h-40 pt-1">
        <ResponsiveContainer>
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap={4}>
            <XAxis type="number" {...ejeProps} allowDecimals={false} />
            <YAxis type="category" dataKey="etiqueta" {...ejeProps} width={64} fontSize={11} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
            {TIPOS.map((t, i) => (
              <Bar key={t.clave} dataKey={t.clave} name={t.nombre} stackId="a" fill={SERIE(i + 1)} stroke="hsl(var(--superficie))" strokeWidth={2}
                radius={i === TIPOS.length - 1 ? [0, 4, 4, 0] : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
