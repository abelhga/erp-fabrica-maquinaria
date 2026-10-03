import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Goal, Save } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Cifra, MESES_CORTOS, MESES_LARGOS, TarjetaGrafica } from "./comun";

interface MesPlan { mes: number; estacionalidad: number; meta: number | null; real: number | null; meta_acumulada: number | null; real_acumulado: number | null }
interface DatosPlan {
  anio: number; hoy: string; meta: number | null; notas: string | null; actualizado_en: string | null;
  meta_propuesta: number | null; crecimiento: number | null; meta_usada: number | null; anio_anterior: number;
  base_estacionalidad: [number, number]; meses: MesPlan[];
  avance: { real: number; meta_a_la_fecha: number | null; pct: number | null; faltante: number | null; meses_restantes: number;
    ritmo_necesario: number | null; ritmo_actual: number | null; proyeccion: number | null; anio_anterior_misma_fecha: number };
  estados: { cve: string; nombre: string; participacion: number; meta_sugerida: number | null; meta: number | null; real: number }[];
}

/** "12,345,678" o "12.3 M" → número. Acepta lo que la gente teclea en una hoja. */
function leerMonto(t: string): number | null {
  const s = t.replace(/[$\s,]/g, "").toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)(m|mdp|millones)?$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] ? 1_000_000 : 1);
}

export default function Planeacion() {
  const { puede } = useSesion();
  const esDireccion = puede("analisis", 3);
  const [anio, setAnio] = useState(Number(hoyISO().slice(0, 4)));
  const [crec, setCrec] = useState("10");
  const crecimiento = Number.isFinite(Number(crec)) ? Number(crec) / 100 : 0;

  const p = useQuery({
    queryKey: ["analisis_planeacion", anio, crecimiento],
    queryFn: () => q<DatosPlan>(supabase.rpc("analisis_planeacion", { p_anio: anio, p_crecimiento: crecimiento })),
    placeholderData: keepPreviousData,
  });
  const d = p.data;
  const [meta, setMeta] = useState("");
  const [notas, setNotas] = useState("");
  useEffect(() => { setMeta(d?.meta != null ? numero(d.meta) : ""); setNotas(d?.notas ?? ""); }, [d?.meta, d?.notas, d?.anio]);

  const guardar = useAccion((v: number) => q(supabase.rpc("guardar_meta_anual", { p_anio: anio, p_meta: v, p_notas: notas || null })),
    { exito: "Meta guardada", invalidar: [["analisis_planeacion"]] });
  const guardarEstado = useAccion((a: { cve: string; meta: number | null }) => q(supabase.rpc("guardar_meta_estado", { p_anio: anio, p_cve_ent: a.cve, p_meta: a.meta })),
    { exito: "Meta del estado guardada", invalidar: [["analisis_planeacion"]] });

  if (p.error) return <ErrorCarga error={p.error} />;
  if (!d) return <Cargando filas={8} />;

  const a = d.avance;
  const hayMeta = d.meta != null;
  const mesActual = d.hoy.slice(0, 4) === String(anio) ? Number(d.hoy.slice(5, 7)) : null;
  const serie = d.meses.map((m) => ({
    mes: MESES_CORTOS[m.mes - 1], "Vendido": m.real, "Meta del mes": m.meta,
    "Vendido acumulado": m.real_acumulado, "Meta acumulada": m.meta_acumulada,
  }));
  const metaValida = leerMonto(meta);
  const tono = a.ritmo_necesario != null && a.ritmo_actual ? a.ritmo_necesario / a.ritmo_actual : null;

  return (
    <div className={cn("space-y-4 transition-opacity", p.isFetching && p.isPlaceholderData && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Boton variante="secundario" tamano="icono" aria-label="Año anterior" onClick={() => setAnio(anio - 1)} disabled={anio <= 2019}><ChevronLeft className="h-4 w-4" /></Boton>
          <span className="text-lg font-semibold px-2 cifra">{anio}</span>
          <Boton variante="secundario" tamano="icono" aria-label="Año siguiente" onClick={() => setAnio(anio + 1)} disabled={anio >= Number(hoyISO().slice(0, 4)) + 1}><ChevronRight className="h-4 w-4" /></Boton>
        </div>
        <span className="text-sm text-tenue">
          {anio - 1} cerró en <b className="text-texto cifra">{dineroCompacto(d.anio_anterior)}</b>. La meta se reparte por mes con lo que pesó cada mes en {d.base_estacionalidad[0]}–{d.base_estacionalidad[1]}.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="tarjeta p-5 space-y-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Goal className="h-4 w-4 text-marca" /> Meta de venta {anio}</h3>
            <p className="text-sm text-tenue mt-0.5">Importe con IVA, la misma unidad que el tablero de inicio.</p>
          </div>
          {esDireccion ? (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (metaValida && metaValida > 0) guardar.mutate(metaValida); }}>
              <div className="flex gap-2">
                <Entrada className="text-lg font-semibold cifra" inputMode="decimal" placeholder="p. ej. 32,000,000 o 32 M" value={meta}
                  onChange={(e) => setMeta(e.target.value)} aria-label="Meta anual" />
                <Boton type="submit" cargando={guardar.isPending} disabled={!metaValida}><Save className="h-4 w-4" /> Guardar</Boton>
              </div>
              <Entrada placeholder="Notas (de dónde sale la meta)" value={notas} onChange={(e) => setNotas(e.target.value)} aria-label="Notas" />
              {metaValida != null && <p className="text-xs text-tenue">{dinero(metaValida)}{d.anio_anterior > 0 && <> · {metaValida >= d.anio_anterior ? "+" : "−"}{porcentaje(Math.abs(metaValida / d.anio_anterior - 1), 1)} contra {anio - 1}</>}</p>}
              {d.actualizado_en && <p className="text-xs text-tenue">Capturada el {fecha(d.actualizado_en)}.</p>}
            </form>
          ) : (
            <div>
              <p className="text-3xl font-semibold">{hayMeta ? dinero(d.meta) : "Sin meta"}</p>
              {d.notas && <p className="text-sm text-tenue mt-1">{d.notas}</p>}
              {!hayMeta && <p className="text-sm text-tenue mt-1">Dirección todavía no captura la meta de {anio}; abajo se ve el escenario.</p>}
            </div>
          )}
          <div className="border-t border-borde pt-3 space-y-2">
            <p className="text-sm font-medium">Escenario</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Crecer</span>
              <Entrada className="w-20 cifra" type="number" step="1" value={crec} onChange={(e) => setCrec(e.target.value)} aria-label="Crecimiento en porcentaje" />
              <span>% sobre {anio - 1} =</span>
              <b className="cifra">{dinero(d.meta_propuesta)}</b>
              {esDireccion && d.meta_propuesta != null && d.meta_propuesta > 0 && (
                <Boton tamano="sm" variante="secundario" onClick={() => setMeta(numero(d.meta_propuesta))}>Usar como meta</Boton>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-3 grid-cols-2 content-start">
          <Cifra titulo={`Vendido en ${anio}`} valor={dineroCompacto(a.real)}
            detalle={a.pct != null ? <>{porcentaje(a.pct, 0)} de la meta · a la fecha tocaba {dineroCompacto(a.meta_a_la_fecha)}</> : "Sin meta para comparar"} />
          <Cifra titulo="Falta para la meta" valor={a.faltante == null ? "—" : dineroCompacto(a.faltante)}
            detalle={a.meses_restantes > 0 ? <>en {a.meses_restantes} {a.meses_restantes === 1 ? "mes" : "meses"} ({mesActual ? MESES_LARGOS.slice(mesActual - 1).join(", ") : "todo el año"})</> : "El año ya cerró"} />
          <Cifra titulo="Hay que vender al mes" valor={a.ritmo_necesario == null ? "—" : dineroCompacto(a.ritmo_necesario)}
            extra={tono != null && tono > 1.15 ? <span className={cn("mb-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", tono > 1.4 ? "bg-peligro-suave text-peligro" : "bg-aviso-suave text-aviso")}>×{numero(Math.round(tono * 10) / 10)} el ritmo</span> : null}
            detalle={a.ritmo_actual != null ? <>el promedio del año va en {dineroCompacto(a.ritmo_actual)} al mes</> : "—"} />
          <Cifra titulo="Cierre a este ritmo" valor={a.proyeccion == null ? "—" : dineroCompacto(a.proyeccion)}
            detalle={<>Si sigue {a.anio_anterior_misma_fecha > 0 ? `${a.real >= a.anio_anterior_misma_fecha ? "arriba" : "abajo"} de ${anio - 1} como va` : "como va"} (igual que el tablero)</>} />
        </div>
      </div>

      {!d.meta_usada ? (
        <div className="tarjeta"><Vacio icono={Goal} titulo={`Sin meta para ${anio}`} texto={esDireccion ? "Captura la meta arriba (o usa el escenario) para repartirla por mes." : "Cuando dirección la capture, aquí se verá real contra meta por mes."} /></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <TarjetaGrafica titulo="Por mes: vendido contra meta" descripcion={hayMeta ? "La meta de cada mes sale de la estacionalidad de los últimos 3 años." : `Con el escenario de +${crec} % (todavía no hay meta capturada).`}
            tabla={<TablaMeses meses={d.meses} />}>
            <div className="px-5"><Leyenda series={[{ nombre: "Vendido", color: SERIE(1) }, { nombre: "Meta del mes", color: SERIE(2) }]} /></div>
            <div className="h-72 px-2 pb-3 pt-2">
              <ResponsiveContainer>
                <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} />
                  <YAxis {...ejeProps} width={58} tickFormatter={(x) => dineroCompacto(x)} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                  <Bar dataKey="Vendido" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  <Line dataKey="Meta del mes" stroke={SERIE(2)} strokeWidth={2} dot={{ r: 4, fill: SERIE(2), stroke: "hsl(var(--superficie))", strokeWidth: 2 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Acumulado del año" descripcion="Dónde va lo vendido contra dónde debería ir."
            tabla={<TablaMeses meses={d.meses} acumulado />}>
            <div className="px-5"><Leyenda series={[{ nombre: "Vendido acumulado", color: SERIE(1) }, { nombre: "Meta acumulada", color: SERIE(2) }]} /></div>
            <div className="h-72 px-2 pb-3 pt-2">
              <ResponsiveContainer>
                <LineChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                  <XAxis dataKey="mes" {...ejeProps} />
                  <YAxis {...ejeProps} width={58} tickFormatter={(x) => dineroCompacto(x)} />
                  <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                  <Line dataKey="Meta acumulada" stroke={SERIE(2)} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line dataKey="Vendido acumulado" stroke={SERIE(1)} strokeWidth={2} connectNulls={false}
                    dot={{ r: 4, fill: SERIE(1), stroke: "hsl(var(--superficie))", strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TarjetaGrafica>
        </div>
      )}

      <section className="tarjeta overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h3 className="font-semibold">Meta por estado</h3>
          <p className="text-sm text-tenue mt-0.5">
            La sugerida reparte la meta con lo que pesó cada estado en {d.base_estacionalidad[0]}–{d.base_estacionalidad[1]}.
            {esDireccion ? " Escribe otra y Enter para guardarla; vacía para volver a la sugerida." : ""}
          </p>
        </div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="tabla">
            <thead><tr><th>Estado</th><th className="text-right">Peso (3 años)</th><th className="text-right">Sugerida</th><th className="text-right">Meta</th><th className="text-right">Vendido {anio}</th><th className="text-right">Avance</th></tr></thead>
            <tbody>
              {d.estados.map((e) => {
                const metaE = e.meta ?? e.meta_sugerida;
                return (
                  <tr key={e.cve}>
                    <td>{e.nombre}</td>
                    <td className="text-right cifra">{porcentaje(e.participacion, 1)}</td>
                    <td className="text-right cifra text-tenue">{dineroCompacto(e.meta_sugerida)}</td>
                    <td className="text-right">
                      {esDireccion && hayMeta ? (
                        <MetaEstado valor={e.meta} alGuardar={(v) => guardarEstado.mutate({ cve: e.cve, meta: v })} />
                      ) : <span className="cifra">{e.meta != null ? dineroCompacto(e.meta) : "—"}</span>}
                    </td>
                    <td className="text-right cifra">{dineroCompacto(e.real)}</td>
                    <td className="text-right cifra">{metaE ? porcentaje(e.real / metaE, 0) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetaEstado({ valor, alGuardar }: { valor: number | null; alGuardar: (v: number | null) => void }) {
  const [t, setT] = useState(valor != null ? numero(valor) : "");
  useEffect(() => setT(valor != null ? numero(valor) : ""), [valor]);
  const guardar = () => {
    const v = t.trim() === "" ? null : leerMonto(t);
    if (t.trim() !== "" && v == null) return;
    if (v !== valor) alGuardar(v);
  };
  return (
    <input className="campo h-8 w-32 text-right cifra ml-auto" inputMode="decimal" value={t} placeholder="sugerida"
      onChange={(e) => setT(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } }} aria-label="Meta del estado" />
  );
}

function TablaMeses({ meses, acumulado }: { meses: MesPlan[]; acumulado?: boolean }) {
  return (
    <div className="overflow-x-auto px-1 pb-2">
      <table className="tabla text-xs">
        <thead><tr><th>Mes</th><th className="text-right">Peso</th><th className="text-right">{acumulado ? "Meta acumulada" : "Meta"}</th><th className="text-right">{acumulado ? "Vendido acumulado" : "Vendido"}</th><th className="text-right">Diferencia</th></tr></thead>
        <tbody>
          {meses.map((m) => {
            const meta = acumulado ? m.meta_acumulada : m.meta;
            const real = acumulado ? m.real_acumulado : m.real;
            return (
              <tr key={m.mes}>
                <td className="capitalize">{MESES_LARGOS[m.mes - 1]}</td>
                <td className="text-right cifra">{porcentaje(m.estacionalidad, 1)}</td>
                <td className="text-right cifra">{dinero(meta)}</td>
                <td className="text-right cifra">{real == null ? "—" : dinero(real)}</td>
                <td className={cn("text-right cifra", real != null && meta != null && real < meta ? "text-peligro" : "")}>{real == null || meta == null ? "—" : dinero(real - meta)}</td>
              </tr>
            );
          })}
          <tr className="font-medium"><td>Total</td><td className="text-right cifra">100%</td>
            <td className="text-right cifra">{dinero(meses.reduce((s, m) => s + Number(m.meta ?? 0), 0))}</td>
            <td className="text-right cifra">{dinero(meses.reduce((s, m) => s + Number(m.real ?? 0), 0))}</td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}
