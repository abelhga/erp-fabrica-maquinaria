import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardCheck, Flame, HardHat, PackageOpen, Scale, TriangleAlert } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useRpc } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero, porcentaje, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Cómo anda el almacén: lo que se surte a las órdenes, lo que sale fuera de su lista (para
 * preguntar por qué), cuánto consumible se lleva cada persona y si cuadra con las recetas,
 * los ajustes y qué tan exactos salen los conteos. Todo lo calcula la base (metricas_almacen).
 */

interface FueraLista {
  id: number; en: string; orden_id: string | null; op: string | null; articulo: string; clave: string; categoria: string; unidad: string;
  cantidad: number; recibio: string; motivo: string | null; usuario: string | null; consumible: boolean; valor: number | null;
}
interface Receta { id: string; clave: string; nombre: string; unidad: string; categoria: string; real: number; previsto: number; valor: number | null }
interface Ajuste {
  id: string; folio: string; articulo: string; clave: string; unidad: string; almacen: string; diferencia: number; motivo: string; estado: string;
  de_conteo: boolean; solicito: string | null; resolvio: string | null; en: string; valor: number | null;
}
interface Datos {
  con_costos: boolean; consumibles_taller: boolean;
  resumen: {
    partidas_orden: number; ordenes: number; fuera_lista: number; fuera_lista_valor: number | null;
    consumo_lineas: number; consumo_personas: number; consumo_sin_anotar: number; consumo_valor: number | null;
    arriba_receta: number; con_receta: number; sin_receta: number;
    ajustes: number; ajustes_pendientes: number; ajustes_valor: number | null;
    conteos: number; lineas_contadas: number; lineas_con_diferencia: number;
    esperando: number; esperando_en_proceso: number;
  };
  semanas: { semana: string; lista: number; fuera: number; consumo: number }[];
  fuera_lista: FueraLista[];
  personas: { recibio: string; categoria: string; lineas: number; cantidad: number; valor: number | null }[];
  receta: Receta[];
  ajustes_lista: Ajuste[];
  conteos_lista: { id: string; nombre: string; almacen: string; cerrado_en: string; lineas: number; con_diferencia: number }[];
  quien: { usuario: string; surtidos: number; consumos: number; ventas: number; entradas: number; ajustes: number; traspasos: number }[];
  esperando: { id: string; folio: string; estado: string; equipo: string; partidas: number }[];
}

type Periodo = "30" | "90" | "180" | "365";
const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "30", texto: "30 días" }, { valor: "90", texto: "90 días" }, { valor: "180", texto: "6 meses" }, { valor: "365", texto: "12 meses" },
];
const restarDias = (iso: string, d: number) => { const x = new Date(iso + "T12:00:00-06:00"); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
/** «1 partida», «3 partidas»: los textos de los indicadores leen mejor sin el «(s)». */
const cuantos = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
const SERIES = [{ clave: "lista", nombre: "De la lista" }, { clave: "fuera", nombre: "Fuera de lista" }, { clave: "consumo", nombre: "Consumo del taller" }] as const;

export default function MetricasAlmacen() {
  const [params, setParams] = useSearchParams();
  const periodo = (PERIODOS.some((p) => p.valor === params.get("periodo")) ? params.get("periodo") : "30") as Periodo;
  const hasta = hoyISO();
  const desde = useMemo(() => restarDias(hasta, Number(periodo) - 1), [hasta, periodo]);
  const m = useRpc<Datos>("metricas_almacen", { p_desde: desde, p_hasta: hasta }, { clave: ["metricas_almacen", desde, hasta] });
  return (
    <Pagina titulo="Métricas de almacén" ancho="max-w-[1500px]" descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · surtido, consumo, ajustes y conteos`}
      acciones={<Filtro opciones={PERIODOS} valor={periodo} alCambiar={(v) => setParams(v === "30" ? {} : { periodo: v }, { replace: true })} />}>
      {m.error ? <ErrorCarga error={m.error} /> : m.isLoading || !m.data ? <Cargando filas={8} /> : <Contenido d={m.data} />}
    </Pagina>
  );
}

function Contenido({ d }: { d: Datos }) {
  const r = d.resumen;
  const pctFuera = r.partidas_orden ? r.fuera_lista / r.partidas_orden : null;
  const exactitud = r.lineas_contadas ? 1 - r.lineas_con_diferencia / r.lineas_contadas : null;
  const semanas = d.semanas.map((s) => ({ semana: fecha(s.semana).replace(/ \d{4}$/, ""), "De la lista": s.lista, "Fuera de lista": s.fuera, "Consumo del taller": s.consumo }));

  const colFuera: Columna<FueraLista>[] = [
    { clave: "en", titulo: "Fecha", clase: "whitespace-nowrap text-xs text-tenue", valor: (x) => x.en, celda: (x) => fechaYHora(x.en) },
    { clave: "op", titulo: "Orden", clase: "whitespace-nowrap", valor: (x) => x.op ?? "",
      celda: (x) => x.orden_id ? <Link to={`/produccion/ordenes/${x.orden_id}`} className="cifra hover:underline">{x.op}</Link> : "—" },
    { clave: "articulo", titulo: "Artículo", clase: "min-w-[220px]", valor: (x) => `${x.articulo} ${x.clave} ${x.categoria}`,
      celda: (x) => <div><p>{x.articulo}</p><p className="text-xs text-tenue">{x.clave} · {x.categoria}{x.consumible && " · consumible"}</p></div> },
    { clave: "cantidad", titulo: "Cantidad", alinear: "der", sinBusqueda: true, valor: (x) => x.cantidad,
      celda: (x) => <span className="cifra whitespace-nowrap">{numero(x.cantidad)} <span className="text-xs text-tenue">{x.unidad}</span></span> },
    { clave: "recibio", titulo: "Recibió", clase: "whitespace-nowrap text-xs", explica: GLOSARIO.quienRecibe },
    { clave: "motivo", titulo: "Motivo", clase: "max-w-[260px] text-xs text-tenue", celda: (x) => <span className="line-clamp-2" title={x.motivo ?? ""}>{x.motivo ?? "—"}</span> },
    { clave: "usuario", titulo: "Registró", clase: "whitespace-nowrap text-xs", valor: (x) => x.usuario ?? "" },
    ...(d.con_costos ? [{ clave: "valor", titulo: "Valor", alinear: "der" as const, sinBusqueda: true, valor: (x: FueraLista) => x.valor ?? 0,
      celda: (x: FueraLista) => <span className="cifra">{x.valor ? dinero(x.valor) : "—"}</span> }] : []),
  ];

  const colReceta: Columna<Receta>[] = [
    { clave: "nombre", titulo: "Consumible", clase: "min-w-[200px]", valor: (x) => `${x.nombre} ${x.clave} ${x.categoria}`,
      celda: (x) => <div><p>{x.nombre}</p><p className="text-xs text-tenue">{x.clave} · {x.categoria}</p></div> },
    { clave: "real", titulo: "Salió", alinear: "der", sinBusqueda: true, valor: (x) => x.real,
      celda: (x) => <span className="cifra whitespace-nowrap">{numero(x.real)} <span className="text-xs text-tenue">{x.unidad}</span></span> },
    { clave: "previsto", titulo: "Receta", alinear: "der", sinBusqueda: true, valor: (x) => x.previsto, explica: GLOSARIO.consumoVsReceta,
      celda: (x) => x.previsto > 0 ? <span className="cifra">{numero(x.previsto)}</span> : <span className="text-xs text-tenue">No viene</span> },
    { clave: "dif", titulo: "Contra receta", alinear: "der", sinBusqueda: true, valor: (x) => (x.previsto > 0 ? x.real / x.previsto : -1),
      celda: (x) => {
        if (x.previsto <= 0) return <span className="text-tenue">—</span>;
        const k = x.real / x.previsto;
        return <span className={cn("cifra font-medium", k > 1.2 ? "text-peligro" : k < 0.8 ? "text-tenue" : "text-ok")}>{porcentaje(k, 0)}</span>;
      } },
    ...(d.con_costos ? [{ clave: "valor", titulo: "Valor", alinear: "der" as const, sinBusqueda: true, valor: (x: Receta) => x.valor ?? 0,
      celda: (x: Receta) => <span className="cifra">{x.valor ? dinero(x.valor) : "—"}</span> }] : []),
  ];

  // Personas × categorías: las categorías que más salieron, en columnas.
  const pivote = useMemo(() => {
    const totalCat = new Map<string, number>();
    for (const p of d.personas) totalCat.set(p.categoria, (totalCat.get(p.categoria) ?? 0) + p.lineas);
    const cats = [...totalCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    const filas = new Map<string, { recibio: string; lineas: number; valor: number; por: Record<string, number> }>();
    for (const p of d.personas) {
      const f = filas.get(p.recibio) ?? { recibio: p.recibio, lineas: 0, valor: 0, por: {} };
      f.lineas += p.lineas; f.valor += p.valor ?? 0;
      f.por[p.categoria] = (f.por[p.categoria] ?? 0) + p.cantidad;
      filas.set(p.recibio, f);
    }
    return { cats, filas: [...filas.values()].sort((a, b) => b.lineas - a.lineas) };
  }, [d.personas]);

  return (
    <div className="space-y-4">
      {!d.consumibles_taller && (
        <p className="rounded-lg border border-aviso/30 bg-aviso-suave px-4 py-2.5 text-sm">
          «Consumibles del taller» está apagado: los discos, la soldadura y el EPP que salen para una orden se cargan a la orden y cuentan como fuera de lista.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Surtido a órdenes" valor={numero(r.partidas_orden)} icono={PackageOpen} tono="info"
          detalle={`partidas a ${cuantos(r.ordenes, "orden", "órdenes")}`} explica={GLOSARIO.surtidoOrdenes} />
        <Kpi titulo="Fuera de lista" valor={porcentaje(pctFuera, 0)} icono={TriangleAlert}
          tono={pctFuera == null ? "neutro" : pctFuera <= 0.05 ? "ok" : pctFuera <= 0.15 ? "aviso" : "peligro"}
          detalle={`${cuantos(r.fuera_lista, "partida", "partidas")}${r.fuera_lista_valor != null ? ` · ${dinero(r.fuera_lista_valor)}` : ""}`} explica={GLOSARIO.fueraDeLista} />
        <Kpi titulo="Consumo del taller" valor={numero(r.consumo_lineas)} icono={HardHat} tono="info"
          detalle={`${cuantos(r.consumo_personas, "persona", "personas")} · ${numero(r.consumo_sin_anotar)} sin anotar${r.consumo_valor != null ? ` · ${dinero(r.consumo_valor)}` : ""}`}
          explica={GLOSARIO.consumoTaller} />
        <Kpi titulo="Arriba de la receta" valor={`${numero(r.arriba_receta)} de ${numero(r.con_receta)}`} icono={Flame}
          tono={!r.con_receta ? "neutro" : r.arriba_receta === 0 ? "ok" : "aviso"}
          detalle={`consumibles · ${numero(r.sin_receta)} no vienen en recetas`} explica={GLOSARIO.consumoVsReceta} />
        <Kpi titulo="Exactitud de conteos" valor={porcentaje(exactitud, 0)} icono={ClipboardCheck}
          tono={exactitud == null ? "neutro" : exactitud >= 0.95 ? "ok" : exactitud >= 0.85 ? "aviso" : "peligro"}
          detalle={r.lineas_contadas ? `${cuantos(r.lineas_contadas, "renglón", "renglones")} en ${cuantos(r.conteos, "conteo", "conteos")}` : "sin conteos cerrados"} explica={GLOSARIO.exactitudConteo} />
        <Kpi titulo="Ajustes" valor={numero(r.ajustes)} icono={Scale} tono={r.ajustes_pendientes ? "aviso" : "neutro"}
          detalle={`${numero(r.ajustes_pendientes)} por autorizar${r.ajustes_valor != null ? ` · neto ${dinero(r.ajustes_valor)}` : ""}`} explica={GLOSARIO.ajusteInventario} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Partidas por semana" descripcion="Lo que salió a órdenes (de su lista y fuera de ella) y a consumo del taller" />
          <div className="px-5"><Leyenda series={SERIES.map((s, i) => ({ nombre: s.nombre, color: SERIE(i + 1) }))} /></div>
          <div className="h-56 px-2 pb-3 pt-2">
            <ResponsiveContainer>
              <BarChart data={semanas} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="semana" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...ejeProps} allowDecimals={false} width={32} />
                <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => numero(v)} />} />
                {SERIES.map((s, i) => (
                  <Bar key={s.clave} dataKey={s.nombre} stackId="p" fill={SERIE(i + 1)} maxBarSize={22} stroke="hsl(var(--superficie))" strokeWidth={2}
                    radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : undefined} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Esperando material" explica={GLOSARIO.esperandoMaterial}
            descripcion={`${cuantos(r.esperando, "orden", "órdenes")} con partidas por surtir · ${numero(r.esperando_en_proceso)} ya en proceso`} />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm max-h-[260px] overflow-y-auto">
            {d.esperando.length === 0 && <li className="py-6 text-center text-tenue">Ninguna orden abierta espera material.</li>}
            {d.esperando.map((x) => (
              <li key={x.id} className="py-2 flex justify-between gap-2">
                <Link to={`/produccion/ordenes/${x.id}`} className="min-w-0 truncate hover:underline"><b className="cifra">{x.folio}</b> · {x.equipo}</Link>
                <span className="whitespace-nowrap text-xs">
                  {x.estado === "en_proceso" && <Insignia tono="aviso">En proceso</Insignia>} <span className="cifra">{numero(x.partidas)}</span> por surtir
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Fuera de lista" explica={GLOSARIO.fueraDeLista}
          descripcion="Cada partida que salió a una orden sin estar en su lista, con quién la recibió y el motivo. Para preguntar por qué y, si hace falta, corregir la lista." />
        <div className="px-3 pb-3">
          <TablaDatos filas={d.fuera_lista} columnas={colFuera} claveFila={(x) => String(x.id)} exportarComo="fuera-de-lista" compacta
            placeholder="Buscar orden, artículo, persona o motivo…"
            vacio={{ icono: TriangleAlert, titulo: "Nada fuera de lista en el periodo", texto: "Todo lo que salió a las órdenes venía en su lista. Amplía el periodo para ver lo anterior." }} />
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Consumibles por persona" explica={GLOSARIO.consumoTaller}
            descripcion="Lo que se llevó cada quien de las categorías consumibles (piezas o la unidad de cada artículo)" />
          <div className="overflow-x-auto pb-3">
            {pivote.filas.length === 0 ? <p className="px-5 py-6 text-center text-sm text-tenue">No salieron consumibles en el periodo.</p> : (
              <table className="tabla">
                <thead><tr><th>Quién lo recibió</th>{pivote.cats.map((c) => <th key={c} className="text-right">{c}</th>)}<th className="text-right">Renglones</th>
                  {d.con_costos && <th className="text-right">Valor</th>}</tr></thead>
                <tbody>
                  {pivote.filas.map((f) => (
                    <tr key={f.recibio}>
                      <td className={cn("whitespace-nowrap", f.recibio === "Sin anotar" && "text-tenue italic")}>{f.recibio}</td>
                      {pivote.cats.map((c) => <td key={c} className="text-right cifra">{f.por[c] ? numero(f.por[c]) : <span className="text-tenue">·</span>}</td>)}
                      <td className="text-right cifra">{numero(f.lineas)}</td>
                      {d.con_costos && <td className="text-right cifra">{dinero(f.valor)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Consumibles contra receta" explica={GLOSARIO.consumoVsReceta}
            descripcion="Lo que salió contra lo que prevén las recetas de las órdenes terminadas en el periodo" />
          <div className="px-3 pb-3">
            <TablaDatos filas={d.receta} columnas={colReceta} claveFila={(x) => x.id} exportarComo="consumibles-contra-receta" compacta placeholder="Buscar consumible…"
              vacio={{ icono: Flame, titulo: "Sin consumibles en el periodo", texto: "No salió ningún consumible ni se terminó una orden que los trajera en su receta." }} />
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Ajustes" explica={GLOSARIO.ajusteInventario} descripcion="Los del periodo y los que esperan autorización" />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm max-h-[380px] overflow-y-auto">
            {d.ajustes_lista.length === 0 && <li className="py-6 text-center text-tenue">Sin ajustes en el periodo.</li>}
            {d.ajustes_lista.map((x) => (
              <li key={x.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate"><b className="cifra">{x.folio}</b> · {x.articulo}</span>
                  <span className={cn("cifra whitespace-nowrap font-medium", x.diferencia < 0 ? "text-peligro" : "text-ok")}>{x.diferencia > 0 ? "+" : ""}{numero(x.diferencia)} {x.unidad}</span>
                </div>
                <p className="text-xs text-tenue truncate" title={x.motivo}>
                  {x.estado === "pendiente" ? <Insignia tono="aviso">Por autorizar</Insignia> : x.estado === "rechazado" ? <Insignia tono="neutro">Rechazado</Insignia> : null}{" "}
                  {x.almacen} · pidió {x.solicito ?? "—"}{x.resolvio ? ` · ${x.estado === "rechazado" ? "rechazó" : "autorizó"} ${x.resolvio}` : ""}{x.de_conteo ? " · de un conteo" : ""} · {x.motivo}
                  {x.valor != null && ` · ${dinero(x.valor)}`}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Conteos cerrados" explica={GLOSARIO.exactitudConteo} descripcion="Renglones contados y cuántos no coincidieron con el sistema" />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm max-h-[380px] overflow-y-auto">
            {d.conteos_lista.length === 0 && <li className="py-6 text-center text-tenue">Ningún conteo se cerró en el periodo. Ábrelo en Entradas y salidas → Conteos físicos.</li>}
            {d.conteos_lista.map((x) => (
              <li key={x.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <Link to={`/almacen/movimientos?vista=conteos&conteo=${x.id}`} className="min-w-0 truncate hover:underline">{x.nombre}</Link>
                  <span className="cifra whitespace-nowrap">{x.lineas ? porcentaje(1 - x.con_diferencia / x.lineas, 0) : "—"}</span>
                </div>
                <p className="text-xs text-tenue">{x.almacen} · {fecha(x.cerrado_en)} · {numero(x.lineas)} renglones, {numero(x.con_diferencia)} con diferencia</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <EncabezadoTarjeta titulo="Quién registra" explica={GLOSARIO.quienRegistra} descripcion="Movimientos capturados en el periodo, por persona" />
          <ul className="px-5 pb-4 divide-y divide-borde text-sm">
            {d.quien.length === 0 && <li className="py-6 text-center text-tenue">Sin movimientos en el periodo.</li>}
            {d.quien.map((x) => (
              <li key={x.usuario} className="py-2">
                <p className="font-medium truncate">{x.usuario}</p>
                <p className="text-xs text-tenue cifra">
                  {[[x.surtidos, "surtidos"], [x.consumos, "consumos"], [x.ventas, "ventas"], [x.entradas, "entradas"], [x.traspasos, "traspasos"], [x.ajustes, "ajustes"]]
                    .filter(([n]) => Number(n) > 0).map(([n, t]) => `${numero(Number(n))} ${t}`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
