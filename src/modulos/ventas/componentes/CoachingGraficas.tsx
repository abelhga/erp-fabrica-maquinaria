import { useMemo, type ReactNode } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { SERIE, Leyenda } from "@/components/graficas/comunes";
import { TarjetaGrafica } from "@/modulos/analisis/comun";
import { numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Las gráficas del coaching: en qué criterio flojea cada quien (radar), cuándo mejoró o se cayó
 * (criterio × semana), si un fallo se sigue repitiendo (fallo × semana) y, para la gerencia, quién
 * necesita qué (persona × criterio). Todo sale de coaching_graficas, con la misma regla de quién ve
 * qué que el resto de la pantalla; el promedio del equipo solo llega si son 3 personas o más.
 *
 * Las notas van de 0 a 10 y se leen contra «Correcta» (7): los mapas de calor usan la escala
 * divergente del ERP (rojo abajo de 7, gris alrededor, azul arriba), validada para daltonismo.
 */

export interface Graficas {
  criterios_semana: { semana: string; clave: string; nombre: string; n: number; promedio: number }[];
  fallos_semana: { semana: string; clave: string; nombre: string; n: number }[];
  llamadas_semana: { semana: string; n: number }[];
  personas_equipo: number;
  radar_equipo: { clave: string; nombre: string; promedio: number }[] | null;
  equipo_criterios: { perfil_id: string; nombre: string; clave: string; n: number; promedio: number }[] | null;
}
interface CriterioResumen { clave: string; nombre: string; peso: number | null; n: number; promedio: number }

const CORRECTA = 7;
const diaMes = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" });
const semanaCorta = (iso: string) => diaMes.format(new Date(iso + "T12:00:00-06:00"));
const diaSolo = new Intl.DateTimeFormat("es-MX", { day: "2-digit", timeZone: "America/Mexico_City" });
const mesSolo = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "America/Mexico_City" });
/** «17» arriba y «ago» abajo: en un renglón, la fecha hacía cada columna más ancha que su número. */
const semanaEnDos = (iso: string) => {
  const d = new Date(iso + "T12:00:00-06:00");
  return <span className="leading-tight">{diaSolo.format(d)}<br />{mesSolo.format(d).replace(".", "")}</span>;
};

/** Nota 0–10 → escalón de la escala divergente, centrada en «Correcta». */
const CORTES = [3, 5, 6.5, 7.5, 8.5, 9.5];
const ETIQUETAS = ["menos de 3", "3 a 5", "5 a 6.5", "6.5 a 7.5 (correcta)", "7.5 a 8.5", "8.5 a 9.5", "9.5 o más"];
const escalon = (v: number) => CORTES.filter((c) => v >= c).length + 1;   // 1..7
const fondoNota = (v: number) => `var(--div-${escalon(v)})`;
const tintaNota = (v: number) => `var(--div-tinta-${escalon(v)})`;

/**
 * Proporción 0–1 → escalón de la escala secuencial (claro = poco). Los fallos se pintan por la parte
 * de las llamadas de esa semana, no por el conteo: 2 de 2 llamadas es peor que 3 de 20, y con el
 * conteo crudo una semana floja salía igual de oscura que una mala.
 */
const escalonParte = (p: number) => Math.max(1, Math.min(7, Math.ceil(p * 7)));
const fondoParte = (p: number) => `var(--seq-${escalonParte(p)})`;
const tintaParte = (p: number) => `var(--seq-tinta-${escalonParte(p)})`;

function LeyendaNotas() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tenue" data-explain={GLOSARIO.mapaCalorCoaching}>
      {ETIQUETAS.map((t, i) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border border-borde/60" style={{ background: `var(--div-${i + 1})` }} />
          <span className="cifra">{t}</span>
        </span>
      ))}
    </div>
  );
}

/** Mapa de calor genérico: filas × columnas, cada celda con su número. */
function MapaCalor({ filas, columnas, celda, etiquetaColumna }: {
  filas: { clave: string; nombre: string }[]; columnas: string[];
  celda: (fila: string, col: string) => { fondo: string; tinta: string; texto: string; titulo: string } | null;
  etiquetaColumna: (c: string) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto px-5 pb-3">
      <table className="w-full text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {columnas.map((c) => <th key={c} className="font-normal text-tenue px-0.5 pb-1 align-bottom">{etiquetaColumna(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <th scope="row" className="font-normal text-left pr-3 w-[150px] min-w-[110px] leading-tight">{f.nombre}</th>
              {columnas.map((c) => {
                const x = celda(f.clave, c);
                return (
                  <td key={c} title={x?.titulo} className="cifra text-center rounded-[4px] h-8 min-w-[34px] px-1 font-medium"
                    style={x ? { background: x.fondo, color: x.tinta } : { background: "hsl(var(--fondo))" }}>
                    {x?.texto ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Etiqueta de un eje del radar en dos renglones: «Siguiente paso con fecha» no cabe en uno y se cortaba. */
function EtiquetaEje({ x, y, textAnchor, payload }: { x?: number; y?: number; textAnchor?: "start" | "middle" | "end" | "inherit"; payload?: { value: string } }) {
  const palabras = (payload?.value ?? "").split(" ");
  const renglones: string[] = [];
  for (const p of palabras) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo && (ultimo + " " + p).length <= 14) renglones[renglones.length - 1] = ultimo + " " + p;
    else renglones.push(p);
  }
  const dy = -((renglones.length - 1) * 12) / 2;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={11} fill="var(--eje)">
      {renglones.map((r, i) => <tspan key={i} x={x} dy={i === 0 ? dy + 4 : 12}>{r}</tspan>)}
    </text>
  );
}

function TooltipRadar({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-borde bg-superficie px-3 py-2 text-xs shadow-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-tenue">{p.name}</span>
          <span className="ml-auto cifra font-medium">{numero(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * El radar: cada criterio de la rúbrica, de 0 a 10. Contra «Correcta» siempre y contra el equipo
 * solo si la base lo mandó (3 personas o más). `quien`: «Tú», el nombre de la persona o «El equipo».
 */
export function RadarCriterios({ criterios, g, quien }: { criterios: CriterioResumen[]; g: Graficas | undefined; quien: string }) {
  const equipo = quien !== "El equipo" ? g?.radar_equipo ?? null : null;
  const datos = useMemo(() => criterios.map((c) => ({
    criterio: c.nombre, [quien]: c.promedio, Correcta: CORRECTA,
    ...(equipo ? { Equipo: equipo.find((e) => e.clave === c.clave)?.promedio ?? null } : {}),
  })), [criterios, equipo, quien]);
  if (criterios.length < 3) return null;   // con menos de tres ejes un radar no dice nada
  const series = [
    { nombre: quien, color: SERIE(1) },
    ...(equipo ? [{ nombre: `Equipo (${numero(g!.personas_equipo)} personas)`, color: SERIE(2) }] : []),
    { nombre: "Correcta (7)", color: "var(--eje)" },
  ];
  return (
    <TarjetaGrafica titulo="Cómo vas en cada criterio" explica={GLOSARIO.radarCoaching}
      descripcion={equipo ? "Tu promedio contra lo correcto y contra el promedio del equipo" : "El promedio de cada criterio contra lo correcto (7)"}
      tabla={
        <table className="w-full text-sm">
          <thead><tr className="text-tenue text-left"><th className="px-5 py-2 font-normal">Criterio</th><th className="font-normal text-right">{quien}</th>{equipo && <th className="font-normal text-right px-5">Equipo</th>}</tr></thead>
          <tbody>{criterios.map((c) => (
            <tr key={c.clave} className="border-t border-borde"><td className="px-5 py-1.5">{c.nombre}</td><td className="text-right cifra">{numero(c.promedio)}</td>
              {equipo && <td className="text-right cifra px-5">{numero(equipo.find((e) => e.clave === c.clave)?.promedio ?? NaN)}</td>}</tr>))}</tbody>
        </table>
      }>
      <div className="h-[380px] px-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="68%">
            <PolarGrid stroke="var(--rejilla)" />
            <PolarAngleAxis dataKey="criterio" tick={<EtiquetaEje />} />
            <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 10, fill: "var(--eje)" }} axisLine={false} angle={90 - 180 / criterios.length} />
            <Radar name="Correcta (7)" dataKey="Correcta" stroke="var(--eje)" strokeDasharray="4 4" strokeWidth={1.5} fill="none" isAnimationActive={false} />
            {equipo && <Radar name="Equipo" dataKey="Equipo" stroke={SERIE(2)} strokeWidth={2} fill={SERIE(2)} fillOpacity={0.08} dot={{ r: 3 }} isAnimationActive={false} />}
            <Radar name={quien} dataKey={quien} stroke={SERIE(1)} strokeWidth={2} fill={SERIE(1)} fillOpacity={0.18} dot={{ r: 4 }} isAnimationActive={false} />
            <Tooltip content={<TooltipRadar />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-4"><Leyenda series={series} /></div>
    </TarjetaGrafica>
  );
}

/** Criterio × semana: en qué semana mejoró o se cayó cada uno. */
export function CriteriosPorSemana({ g, criterios }: { g: Graficas; criterios: CriterioResumen[] }) {
  const semanas = useMemo(() => [...new Set(g.criterios_semana.map((x) => x.semana))].sort(), [g]);
  if (semanas.length < 2) return null;
  const mapa = new Map(g.criterios_semana.map((x) => [`${x.clave}|${x.semana}`, x]));
  return (
    <TarjetaGrafica titulo="Cada criterio, semana a semana" explica={GLOSARIO.mapaCalorCoaching}
      descripcion="El promedio de cada criterio en cada semana: rojo, abajo de lo correcto; azul, arriba">
      <MapaCalor filas={criterios} columnas={semanas.slice(-12)} etiquetaColumna={semanaEnDos}
        celda={(f, c) => {
          const x = mapa.get(`${f}|${c}`);
          return x ? { fondo: fondoNota(x.promedio), tinta: tintaNota(x.promedio), texto: numero(x.promedio), titulo: `${x.nombre}, semana del ${semanaCorta(c)}: ${numero(x.promedio)} en ${numero(x.n)} llamada(s)` } : null;
        }} />
      <div className="px-5 pb-4"><LeyendaNotas /></div>
    </TarjetaGrafica>
  );
}

const CALIFICADAS = "__calificadas";

/** Fallo × semana: si un fallo se sigue repitiendo o ya se corrigió. */
export function FallosPorSemana({ g }: { g: Graficas }) {
  const semanas = useMemo(() => [...new Set(g.llamadas_semana.map((x) => x.semana))].sort().slice(-12), [g]);
  const fallos = useMemo(() => {
    const total = new Map<string, { clave: string; nombre: string; n: number }>();
    for (const x of g.fallos_semana) {
      const t = total.get(x.clave) ?? { clave: x.clave, nombre: x.nombre, n: 0 };
      t.n += x.n; total.set(x.clave, t);
    }
    return [...total.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [g]);
  if (semanas.length < 2 || !fallos.length) return null;
  const mapa = new Map(g.fallos_semana.map((x) => [`${x.clave}|${x.semana}`, x.n]));
  const llamadas = new Map(g.llamadas_semana.map((x) => [x.semana, x.n]));
  return (
    <TarjetaGrafica titulo="Los fallos, semana a semana" explica={GLOSARIO.fallosPorSemana}
      descripcion="En cuántas llamadas de cada semana salió cada fallo; más oscuro, en más de las de esa semana">
      <MapaCalor filas={[{ clave: CALIFICADAS, nombre: "Llamadas calificadas" }, ...fallos]} columnas={semanas} etiquetaColumna={semanaEnDos}
        celda={(f, c) => {
          if (f === CALIFICADAS) {
            const t = llamadas.get(c) ?? 0;
            return { fondo: "transparent", tinta: "hsl(var(--tenue))", texto: numero(t), titulo: `${t} llamada(s) calificada(s) la semana del ${semanaCorta(c)}` };
          }
          const n = mapa.get(`${f}|${c}`);
          if (!n) return null;
          const total = llamadas.get(c) ?? 0;
          const parte = total > 0 ? n / total : 1;
          return { fondo: fondoParte(parte), tinta: tintaParte(parte), texto: numero(n), titulo: `${n} de ${total} llamada(s) de la semana del ${semanaCorta(c)}` };
        }} />
    </TarjetaGrafica>
  );
}

/** Persona × criterio: para la gerencia, quién necesita qué. */
export function EquipoPorCriterio({ g, criterios }: { g: Graficas; criterios: CriterioResumen[] }) {
  const filas = useMemo(() => {
    const m = new Map<string, { clave: string; nombre: string }>();
    for (const x of g.equipo_criterios ?? []) m.set(x.perfil_id, { clave: x.perfil_id, nombre: x.nombre });
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [g]);
  if (!g.equipo_criterios || filas.length < 2) return null;
  const mapa = new Map(g.equipo_criterios.map((x) => [`${x.perfil_id}|${x.clave}`, x]));
  const nombres = new Map(criterios.map((c) => [c.clave, c.nombre]));
  return (
    <TarjetaGrafica titulo="Quién necesita qué" explica={GLOSARIO.equipoPorCriterio}
      descripcion="El promedio de cada persona en cada criterio: lo rojo es lo que hay que trabajar con ella">
      <MapaCalor filas={filas} columnas={criterios.map((c) => c.clave)} etiquetaColumna={(c) => nombres.get(c) ?? c}
        celda={(f, c) => {
          const x = mapa.get(`${f}|${c}`);
          return x ? { fondo: fondoNota(x.promedio), tinta: tintaNota(x.promedio), texto: numero(x.promedio), titulo: `${x.nombre} · ${nombres.get(c) ?? c}: ${numero(x.promedio)} en ${numero(x.n)} llamada(s)` } : null;
        }} />
      <div className="px-5 pb-4"><LeyendaNotas /></div>
    </TarjetaGrafica>
  );
}
