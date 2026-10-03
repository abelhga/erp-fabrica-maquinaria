import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Users } from "lucide-react";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hace, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { BarraRanking, Cifra, NOMBRE_SEGMENTO, SEQ, SEQ_TINTA, TarjetaGrafica, usePeriodo } from "./comun";

interface DatosClientes {
  resumen: { clientes: number; monto: number; operaciones: number; clientes_80: number | null; pct_clientes_80: number | null; top10_participacion: number | null; nuevos: number };
  pareto: { pct_clientes: number; pct_venta: number }[];
  top: { id: string; nombre: string; monto: number; participacion: number; acumulado: number }[];
  por_anio: { anio: number; nuevos: number; recurrentes: number; monto_nuevos: number; monto_recurrentes: number }[];
  cohortes: { cohorte: number; clientes: number; anios: { k: number; clientes: number }[] | null }[];
  segmentos: { segmento: string; clientes: number; monto_3a: number; monto_total: number }[];
  corte: string;
}
interface ClienteSegmento {
  cliente_id: string; nombre: string; vendedor: string | null; cve_ent: string | null; estado: string | null; municipio: string | null;
  primera: string; ultima: string; compras_3a: number; monto_3a: number; monto_total: number; segmento: string;
}

/** Retención en clases fijas (no cuantiles): 30 % se lee igual en cualquier periodo. */
const CORTES_RETENCION = [0.05, 0.1, 0.15, 0.2, 0.3, 0.45];
const tonoRetencion = (p: number) => { let i = 0; while (i < CORTES_RETENCION.length && p > CORTES_RETENCION[i]) i++; return i + 1; };

export default function ClientesAnalisis() {
  const ir = useNavigate();
  const { periodo, params, setParams } = usePeriodo();
  const segmento = params.get("segmento") ?? "en_riesgo";
  const c = useQuery({
    queryKey: ["analisis_clientes", periodo.desde, periodo.hasta],
    queryFn: () => q<DatosClientes>(supabase.rpc("analisis_clientes", { p_desde: periodo.desde, p_hasta: periodo.hasta })),
    placeholderData: keepPreviousData,
  });
  const lista = useQuery({
    queryKey: ["analisis_segmento_clientes", segmento, periodo.hasta],
    queryFn: () => q<ClienteSegmento[]>(supabase.rpc("analisis_segmento_clientes", { p_segmento: segmento, p_corte: periodo.hasta })),
    placeholderData: keepPreviousData,
  });
  const [verTop, setVerTop] = useState(10);

  const d = c.data;
  const pareto = useMemo(() => (d?.pareto ?? []).map((p) => ({ x: Number(p.pct_clientes), y: Number(p.pct_venta) })), [d]);
  const porAnio = useMemo(() => (d?.por_anio ?? []).map((a) => ({ ...a, anio: String(a.anio), Nuevos: a.nuevos, Recurrentes: a.recurrentes })), [d]);
  const maxK = Math.max(0, ...(d?.cohortes ?? []).flatMap((x) => (x.anios ?? []).map((a) => a.k)));

  if (c.error) return <ErrorCarga error={c.error} />;
  if (!d) return <Cargando filas={8} />;
  const r = d.resumen;
  const punto80 = r.pct_clientes_80 != null ? { x: Number(r.pct_clientes_80), y: 0.8 } : null;
  const maxTop = Math.max(...d.top.map((t) => t.monto), 1);

  const columnas: Columna<ClienteSegmento>[] = [
    { clave: "nombre", titulo: "Cliente", celda: (x) => <Link to={`/ventas/clientes/${x.cliente_id}`} className="text-marca-texto hover:underline" onClick={(e) => e.stopPropagation()}>{x.nombre}</Link> },
    { clave: "vendedor", titulo: "Vendedor", valor: (x) => x.vendedor ?? "Sin vendedor" },
    { clave: "estado", titulo: "Dónde", valor: (x) => [x.municipio, x.estado].filter(Boolean).join(", ") || "Sin ubicar" },
    { clave: "ultima", titulo: "Última compra", valor: (x) => x.ultima, celda: (x) => <span title={fecha(x.ultima)}>{hace(x.ultima)}</span> },
    { clave: "compras_3a", titulo: "Compras (3 años)", alinear: "der", sinBusqueda: true },
    { clave: "monto_3a", titulo: "Venta (3 años)", alinear: "der", celda: (x) => dinero(x.monto_3a), sinBusqueda: true },
    { clave: "monto_total", titulo: "Venta desde 2018", alinear: "der", celda: (x) => dinero(x.monto_total), sinBusqueda: true },
    { clave: "primera", titulo: "Cliente desde", valor: (x) => x.primera, celda: (x) => fecha(x.primera) },
  ];

  return (
    <div className={cn("space-y-4 transition-opacity", c.isFetching && c.isPlaceholderData && "opacity-60")}>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Clientes que compraron" valor={numero(r.clientes)} detalle={<>{numero(r.operaciones)} operaciones en {periodo.etiqueta}</>} />
        <Cifra titulo="Hacen el 80 % de la venta" valor={r.clientes_80 == null ? "—" : `${numero(r.clientes_80)} clientes`}
          detalle={r.pct_clientes_80 == null ? "—" : <>el {porcentaje(r.pct_clientes_80, 0)} de los que compraron</>} />
        <Cifra titulo="Los 10 más grandes pesan" valor={porcentaje(r.top10_participacion, 0)} detalle="de la venta del periodo" />
        <Cifra titulo="Clientes nuevos" valor={numero(r.nuevos)} detalle={<>su primera compra fue en {periodo.etiqueta}</>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TarjetaGrafica titulo="Concentración de la venta (Pareto)"
          descripcion="Clientes ordenados del que más compró al que menos: qué parte de la venta juntan."
          tabla={<div className="overflow-y-auto max-h-[300px] px-1 pb-2"><table className="tabla text-xs">
            <thead><tr><th>% de clientes</th><th className="text-right">% de la venta</th></tr></thead>
            <tbody>{pareto.filter((p) => Math.round(p.x * 100) % 5 === 0).map((p) => <tr key={p.x}><td className="cifra">{porcentaje(p.x, 0)}</td><td className="text-right cifra">{porcentaje(p.y, 1)}</td></tr>)}</tbody>
          </table></div>}>
          <div className="h-[340px] px-2 pb-3">
            <ResponsiveContainer>
              <AreaChart data={pareto} margin={{ top: 12, right: 20, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="x" type="number" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} {...ejeProps} tickFormatter={(x) => porcentaje(x, 0)} />
                <YAxis {...ejeProps} width={44} domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(x) => porcentaje(x, 0)} />
                <ReferenceLine y={0.8} stroke="var(--eje)" strokeWidth={1} />
                <Tooltip cursor={{ stroke: "var(--eje)", strokeWidth: 1 }} content={({ active, payload }) => active && payload?.length ? (
                  <div className="tarjeta px-3 py-2 text-xs shadow-lg">
                    <p className="text-sm font-semibold cifra">{porcentaje(Number(payload[0].payload.y), 1)} de la venta</p>
                    <p className="text-tenue">la junta el {porcentaje(Number(payload[0].payload.x), 0)} de los clientes</p>
                  </div>) : null} />
                <Area dataKey="y" stroke={SERIE(1)} strokeWidth={2} fill={SERIE(1)} fillOpacity={0.1} isAnimationActive={false} />
                {punto80 && <ReferenceDot x={punto80.x} y={0.8} r={5} fill={SERIE(1)} stroke="hsl(var(--superficie))" strokeWidth={2}
                  label={{ value: `${porcentaje(punto80.x, 0)} de los clientes`, position: "bottom", offset: 10, fontSize: 12, fill: "hsl(var(--texto))" }} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>

        <TarjetaGrafica titulo={`Los clientes que más compraron en ${periodo.etiqueta}`}
          descripcion="Con lo que pesa cada uno y lo que llevan juntos."
          acciones={d.top.length > 10 && <button type="button" className="text-sm text-marca-texto" onClick={() => setVerTop(verTop === 10 ? 15 : 10)}>{verTop === 10 ? "Ver 15" : "Ver 10"}</button>}>
          <ol className="px-5 pb-4 space-y-2.5">
            {d.top.slice(0, verTop).map((t, i) => (
              <li key={t.id}>
                <button type="button" className="w-full text-left group" onClick={() => ir(`/ventas/clientes/${t.id}`)}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="w-5 text-right text-xs text-tenue cifra">{i + 1}</span>
                    <span className="truncate group-hover:text-marca-texto">{t.nombre}</span>
                    <span className="ml-auto cifra font-medium shrink-0">{dineroCompacto(t.monto)}</span>
                    <span className="w-12 text-right text-xs text-tenue cifra shrink-0">{porcentaje(t.participacion, 1)}</span>
                    <span className="w-12 text-right text-xs text-tenue cifra shrink-0" title="Acumulado">{porcentaje(t.acumulado, 0)}</span>
                  </div>
                  <BarraRanking valor={t.monto} max={maxTop} className="ml-7 mt-1" />
                </button>
              </li>
            ))}
          </ol>
        </TarjetaGrafica>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TarjetaGrafica titulo="Clientes nuevos y recurrentes por año"
          descripcion="Nuevo: su primera compra fue ese año. Recurrente: ya había comprado antes."
          tabla={<div className="overflow-x-auto px-1 pb-2"><table className="tabla text-xs">
            <thead><tr><th>Año</th><th className="text-right">Nuevos</th><th className="text-right">Venta nuevos</th><th className="text-right">Recurrentes</th><th className="text-right">Venta recurrentes</th></tr></thead>
            <tbody>{d.por_anio.map((a) => <tr key={a.anio}><td>{a.anio}</td><td className="text-right cifra">{numero(a.nuevos)}</td><td className="text-right cifra">{dinero(a.monto_nuevos)}</td><td className="text-right cifra">{numero(a.recurrentes)}</td><td className="text-right cifra">{dinero(a.monto_recurrentes)}</td></tr>)}</tbody>
          </table></div>}>
          <div className="px-5"><Leyenda series={[{ nombre: "Nuevos", color: SERIE(1) }, { nombre: "Recurrentes", color: SERIE(2) }]} /></div>
          <div className="h-64 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <BarChart data={porAnio} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="anio" {...ejeProps} />
                <YAxis {...ejeProps} width={40} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.35 }} content={<TooltipGrafica formato={(v) => `${numero(v)} clientes`} />} />
                <Bar dataKey="Nuevos" stackId="a" fill={SERIE(1)} maxBarSize={24} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
                <Bar dataKey="Recurrentes" stackId="a" fill={SERIE(2)} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="hsl(var(--superficie))" strokeWidth={1} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="¿Cuántos vuelven a comprar? (cohortes)"
          descripcion="Clientes por año de su primera compra, y qué parte volvió a comprar 1, 2, 3… años después.">
          <div className="px-5 pb-4 overflow-x-auto">
            <table className="w-full text-xs border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="text-left font-medium text-tenue">Primera compra</th>
                  <th className="text-right font-medium text-tenue pr-1">Clientes</th>
                  {Array.from({ length: maxK }, (_, k) => <th key={k} className="font-medium text-tenue">+{k + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.cohortes.map((co) => (
                  <tr key={co.cohorte}>
                    <th className="text-left font-medium cifra">{co.cohorte}</th>
                    <td className="text-right cifra pr-1">{numero(co.clientes)}</td>
                    {Array.from({ length: maxK }, (_, k) => {
                      const a = (co.anios ?? []).find((x) => x.k === k + 1);
                      const llegado = co.cohorte + k + 1 <= Number(d.corte.slice(0, 4));
                      if (!llegado) return <td key={k} />;
                      const p = a ? a.clientes / co.clientes : 0;
                      const t = tonoRetencion(p);
                      return (
                        <td key={k} className="h-7 min-w-[40px] rounded-[3px] text-center cifra"
                          title={`${a?.clientes ?? 0} de ${co.clientes} clientes de ${co.cohorte} compraron en ${co.cohorte + k + 1}`}
                          style={{ background: p > 0 ? SEQ(t) : "var(--mapa-vacio)", color: p > 0 ? SEQ_TINTA(t) : undefined }}>
                          {porcentaje(p, 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-tenue mt-2">2018 junta a todos los que ya compraban (el libro de ventas empieza ahí). El año en curso cuenta solo lo que va. Tonos fijos: 5, 10, 15, 20, 30 y 45 %.</p>
          </div>
        </TarjetaGrafica>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Segmentos de clientes al {fecha(d.corte)}</h3>
          <p className="text-sm text-tenue">Por qué tan reciente fue su última compra, qué tan seguido compran y cuánto. Elige uno para ver quiénes son.</p>
        </div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
          {d.segmentos.map((s) => (
            <button key={s.segmento} type="button" onClick={() => { const n = new URLSearchParams(params); n.set("segmento", s.segmento); setParams(n, { replace: true }); }}
              aria-pressed={segmento === s.segmento} title={NOMBRE_SEGMENTO[s.segmento]?.texto}
              className={cn("tarjeta text-left px-3 py-2.5 transition", segmento === s.segmento ? "border-marca ring-2 ring-marca/30" : "hover:border-marca/40")}>
              <p className="text-sm font-medium">{NOMBRE_SEGMENTO[s.segmento]?.nombre ?? s.segmento}</p>
              <p className="text-xl font-semibold">{numero(s.clientes)}</p>
              <p className="text-xs text-tenue cifra">{dineroCompacto(s.monto_3a)} en 3 años</p>
            </button>
          ))}
        </div>
        <p className="text-sm text-tenue">{NOMBRE_SEGMENTO[segmento]?.texto}</p>
        <TablaDatos filas={lista.data} cargando={lista.isLoading} error={lista.error} columnas={columnas} claveFila={(x) => x.cliente_id}
          alClicFila={(x) => ir(`/ventas/clientes/${x.cliente_id}`)} exportarComo={`clientes-${segmento}`} limite={100}
          placeholder="Buscar cliente, vendedor o lugar…"
          vacio={{ icono: Users, titulo: "Nadie en este segmento", texto: "Elige otro segmento arriba." }} />
      </section>
    </div>
  );
}
