import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIE, ejeProps, Leyenda } from "@/components/graficas/comunes";
import { Filtro } from "@/components/datos/TablaDatos";
import { dinero, dineroCompacto, fecha, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (t: number) => { const d = new Date(t); return `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
/** Eje en pesos: abajo de $10 k en pesos completos; "$1.2 k" repetía la misma etiqueta en cinco renglones
 *  cuando una chumacera pasa de $1,117 a $1,200. */
const ejePesos = (v: number) => (Math.abs(v) < 10_000 ? "$" + v.toLocaleString("es-MX", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }) : dineroCompacto(v));

type Rango = "12m" | "36m" | "todo";
const RANGOS: { valor: Rango; texto: string }[] = [
  { valor: "12m", texto: "12 meses" }, { valor: "36m", texto: "3 años" }, { valor: "todo", texto: "Todo" },
];
function desdeRango(r: Rango) {
  if (r === "todo") return -Infinity;
  const d = new Date(); d.setMonth(d.getMonth() - (r === "12m" ? 12 : 36));
  return d.getTime();
}

export interface PuntoCosteo {
  en: string; costo: number | null; precio_real: number | null; precio_constante: number | null; reconstruido: boolean;
  utilidad?: number | null;
}

interface Fila {
  t: number; estimado: boolean; utilidad: number | null;
  costo: number | null; costoEst: number | null; real: number | null; constante: number | null; constanteEst: number | null;
}

/** Tooltip con tinta de texto y la muestra de color al lado (el de comunes suma un "Total" que aquí no tiene sentido). */
function TooltipCosteo({ active, payload }: { active?: boolean; payload?: { payload: Fila }[] }) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  const filas = [
    { nombre: "Costo", color: SERIE(1), v: f.costo ?? f.costoEst },
    { nombre: "Precio de lista real", color: SERIE(2), v: f.real },
    { nombre: "Precio a utilidad de hoy", color: SERIE(3), v: f.constante ?? f.constanteEst },
  ];
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[220px]">
      <p className="font-medium mb-1">
        {fecha(new Date(f.t))}
        {f.estimado && <span className="ml-1.5 font-normal text-tenue">· estimado</span>}
      </p>
      {filas.map((p) => (
        <div key={p.nombre} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-tenue">{p.nombre}</span>
          <span className="ml-auto cifra font-medium">{p.v == null ? "—" : dinero(p.v)}</span>
        </div>
      ))}
      {f.utilidad != null && <p className="mt-1 pt-1 border-t border-borde text-tenue">Utilidad vigente: <b className="text-texto">{porcentaje(f.utilidad, 0)}</b></p>}
      {f.estimado && <p className="mt-1 pt-1 border-t border-borde text-tenue max-w-[240px]">Reconstruido con la lista de materiales de hoy y los costos de ese mes.</p>}
    </div>
  );
}

/**
 * Costo, precio real y precio a utilidad constante en el tiempo (un solo eje en pesos).
 * Lo reconstruido hacia atrás va punteado y solo se muestra antes de la primera
 * foto real: cuando hay foto, la estimación sobra.
 */
export function GraficaCosteo({ puntos }: { puntos: PuntoCosteo[] }) {
  const [rango, setRango] = useState<Rango>("todo");
  const [verTabla, setVerTabla] = useState(false);

  const filas = useMemo<Fila[]>(() => {
    const validos = puntos.filter((p) => (p.costo ?? 0) > 0).sort((a, b) => a.en.localeCompare(b.en));
    const primeraReal = validos.find((p) => !p.reconstruido);
    const usados = validos.filter((p) => !p.reconstruido || !primeraReal || p.en < primeraReal.en);
    const desde = desdeRango(rango);
    return usados
      .map((p) => {
        const t = new Date(p.en).getTime();
        const est = p.reconstruido;
        const unir = p === primeraReal; // el trazo punteado llega hasta la primera foto real
        return {
          t, estimado: est, utilidad: p.utilidad ?? null,
          costo: est ? null : p.costo, costoEst: est || unir ? p.costo : null,
          real: est ? null : p.precio_real,
          constante: est ? null : p.precio_constante, constanteEst: est || unir ? p.precio_constante : null,
        };
      })
      .filter((f) => f.t >= desde);
  }, [puntos, rango]);

  // Lectura en una línea: cuánto del alza del precio vino de costos y cuánto de utilidad.
  const resumen = useMemo(() => {
    const reales = filas.filter((f) => !f.estimado && f.real != null && f.constante != null);
    const todos = filas.filter((f) => (f.costo ?? f.costoEst) != null);
    if (todos.length < 2) return null;
    const c0 = todos[0].costo ?? todos[0].costoEst!, c1 = todos[todos.length - 1].costo ?? todos[todos.length - 1].costoEst!;
    // Con menos de dos meses de fotos reales la comparación engaña (dos fotos del mismo día durante una importación).
    const lapso = reales.length >= 2 ? reales[reales.length - 1].t - reales[0].t : 0;
    const r = reales.length >= 2 && lapso >= 60 * 86_400_000 ? {
      desde: reales[0].t,
      real: reales[reales.length - 1].real! / reales[0].real! - 1,
      constante: reales[reales.length - 1].constante! / reales[0].constante! - 1,
    } : null;
    return { desde: todos[0].t, costo: c1 / c0 - 1, r, primeraReal: reales[0]?.t ?? null };
  }, [filas]);

  const hayEstimado = filas.some((f) => f.estimado);
  const signo = (n: number) => `${n >= 0 ? "+" : "−"}${porcentaje(Math.abs(n))}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Leyenda series={[
          { nombre: "Costo", color: SERIE(1) },
          { nombre: "Precio de lista real", color: SERIE(2) },
          { nombre: "Precio a utilidad de hoy", color: SERIE(3) },
        ]} />
        <div className="flex items-center gap-3">
          <Filtro opciones={RANGOS} valor={rango} alCambiar={setRango} />
          <button className="text-xs text-marca-texto hover:underline" onClick={() => setVerTabla((v) => !v)}>
            {verTabla ? "Ver gráfica" : "Ver tabla"}
          </button>
        </div>
      </div>

      {resumen && (
        <p className="text-sm text-tenue">
          Desde {fecha(new Date(resumen.desde))} el costo cambió <b className="text-texto cifra">{signo(resumen.costo)}</b>.
          {!resumen.r && resumen.primeraReal != null && (
            <> El precio de lista real se guarda desde {fecha(new Date(resumen.primeraReal))}; con unos meses de fotos aquí se verá cuánto de su alza vino de la utilidad y cuánto de los costos.</>
          )}
          {resumen.r && (
            <> Desde {fecha(new Date(resumen.r.desde))} el precio de lista cambió <b className="text-texto cifra">{signo(resumen.r.real)}</b>;
              con la utilidad de hoy todo el tiempo habría cambiado <b className="text-texto cifra">{signo(resumen.r.constante)}</b>
              {Math.abs(resumen.r.real - resumen.r.constante) >= 0.001
                ? <>: <b className="text-texto cifra">{(Math.abs(resumen.r.real - resumen.r.constante) * 100).toFixed(1)} puntos</b> vienen de {resumen.r.real > resumen.r.constante ? "subir" : "bajar"} la utilidad, el resto de los costos.</>
                : <>: todo el cambio vino de los costos.</>}
            </>
          )}
        </p>
      )}

      {verTabla ? (
        <div className="overflow-x-auto max-h-[360px] border border-borde rounded-lg">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th className="text-right">Costo</th><th className="text-right">Precio real</th>
              <th className="text-right">A utilidad de hoy</th><th className="text-right">Utilidad</th><th></th></tr></thead>
            <tbody>
              {[...filas].reverse().map((f) => (
                <tr key={f.t}>
                  <td>{fecha(new Date(f.t))}</td>
                  <td className="text-right cifra">{dinero(f.costo ?? f.costoEst)}</td>
                  <td className="text-right cifra">{dinero(f.real)}</td>
                  <td className="text-right cifra">{dinero(f.constante ?? f.constanteEst)}</td>
                  <td className="text-right cifra">{f.utilidad == null ? "—" : porcentaje(f.utilidad, 0)}</td>
                  <td className="text-xs text-tenue">{f.estimado ? "estimado" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={filas} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--rejilla)" />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={mesCorto} {...ejeProps} minTickGap={24} />
              <YAxis {...ejeProps} tickFormatter={ejePesos} width={64} domain={["auto", "auto"]} />
              <Tooltip content={<TooltipCosteo />} cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} />
              {/* Estimación: mismo color, punteado */}
              <Line dataKey="costoEst" type="stepAfter" stroke={SERIE(1)} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="constanteEst" type="stepAfter" stroke={SERIE(3)} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="costo" name="Costo" type="stepAfter" stroke={SERIE(1)} strokeWidth={2} dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--superficie))" }} isAnimationActive={false} connectNulls />
              <Line dataKey="constante" name="Precio a utilidad de hoy" type="stepAfter" stroke={SERIE(3)} strokeWidth={2} dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--superficie))" }} isAnimationActive={false} connectNulls />
              <Line dataKey="real" name="Precio de lista real" type="stepAfter" stroke={SERIE(2)} strokeWidth={2} dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--superficie))" }} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className={cn("text-xs text-tenue", !hayEstimado && "hidden")}>
        <span className="inline-block w-5 border-t-2 border-dashed border-tenue align-middle mr-1.5" />
        Punteado: estimación hacia atrás con la lista de materiales de hoy y el costo de cada componente en ese mes (antes de que el ERP guardara fotos).
      </p>
    </div>
  );
}

/** Historial escalonado del costo de un componente: el costo vale lo mismo hasta el siguiente cambio. */
export function GraficaEscalonada({ puntos, moneda }: { puntos: { en: string; costo: number }[]; moneda: "MXN" | "USD" | "EUR" }) {
  const datos = useMemo(() => {
    const ord = [...puntos].sort((a, b) => a.en.localeCompare(b.en)).map((p) => ({ t: new Date(p.en).getTime(), costo: Number(p.costo) }));
    // Se extiende hasta hoy para que el último escalón se vea.
    if (ord.length) ord.push({ t: Date.now(), costo: ord[ord.length - 1].costo });
    return ord;
  }, [puntos]);
  const fmt = (v: number) => (moneda === "MXN" ? dinero(v) : `${moneda} ${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={mesCorto} {...ejeProps} minTickGap={24} />
          <YAxis {...ejeProps} width={64} domain={["auto", "auto"]}
            tickFormatter={(v) => (moneda === "MXN" ? ejePesos(v) : `${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`)} />
          <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { t: number; costo: number };
            return (
              <div className="tarjeta px-3 py-2 text-xs shadow-lg">
                <p className="font-medium">{fecha(new Date(p.t))}</p>
                <p className="flex items-center gap-2 mt-0.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE(1) }} />
                  <span className="text-tenue">Costo</span><span className="ml-auto cifra font-medium">{fmt(p.costo)}</span></p>
              </div>
            );
          }} />
          <Line dataKey="costo" type="stepAfter" stroke={SERIE(1)} strokeWidth={2} isAnimationActive={false}
            dot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--superficie))", fill: SERIE(1) }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--superficie))" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
