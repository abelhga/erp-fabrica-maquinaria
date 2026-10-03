import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, Globe2, MapPinOff, PhoneCall, Snowflake } from "lucide-react";
import { MapaMexico, FUENTE_MAPAS } from "@/components/graficas/MapaMexico";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  BarraRanking, Cambio, Cifra, DIV, LeyendaEscala, TarjetaGrafica, VACIO, escalaCrecimiento, escalaCuantiles, usePeriodo, type Escala,
} from "./comun";

export interface RegionMapa {
  cve: string; nombre: string; monto: number; monto_anterior: number; clientes: number; clientes_anterior: number;
  operaciones: number; ticket: number | null; participacion: number | null; cambio: number | null; nuevo: boolean;
}
export interface DatosMapa {
  periodo: { desde: string; hasta: string; ant_desde: string; ant_hasta: string };
  nivel: "pais" | "estado"; cve_ent: string | null; nombre: string | null;
  total: number; total_anterior: number; cambio: number | null; clientes: number; operaciones: number;
  regiones_con_venta: number; concentracion_top3: number | null; regiones: RegionMapa[];
  sin_ubicar: { monto: number; monto_anterior: number; clientes: number } | null;
  sin_municipio: { monto: number; monto_anterior: number; clientes: number } | null;
  extranjero: { pais: string; monto: number; monto_anterior: number; clientes: number }[];
}
interface Zona {
  cve: string; nombre: string; cve_ent: string; monto: number; monto_anterior: number; perdido: number; cambio: number;
  clientes_perdidos: number; clientes: { id: string; nombre: string; vendedor: string | null; monto_anterior: number; ultima_compra: string }[];
}

type Metrica = "monto" | "clientes" | "ticket" | "cambio";
const METRICAS: { valor: Metrica; texto: string }[] = [
  { valor: "monto", texto: "Venta" },
  { valor: "clientes", texto: "Clientes que compraron" },
  { valor: "ticket", texto: "Ticket promedio" },
  { valor: "cambio", texto: "Crecimiento" },
];

const valorDe = (r: RegionMapa, m: Metrica): number | null =>
  m === "monto" ? r.monto : m === "clientes" ? r.clientes : m === "ticket" ? r.ticket : r.cambio;
const formatoDe = (m: Metrica) => (v: number | null | undefined) =>
  v == null ? "—" : m === "clientes" ? numero(v)
    : m === "cambio" ? (v >= 2 ? `×${numero(Math.round(1 + v))}` : `${v >= 0 ? "+" : "−"}${porcentaje(Math.abs(v), 0)}`) : dineroCompacto(v);

/** Texto corto del periodo de comparación: "1 ene–3 oct 2025". */
const tramo = (d: string, h: string) => `${fecha(d)} a ${fecha(h)}`;

export default function MapaVentas() {
  const ir = useNavigate();
  const { periodo, params, setParams } = usePeriodo();
  const estado = params.get("estado");
  const metrica = (METRICAS.some((m) => m.valor === params.get("m")) ? params.get("m") : "monto") as Metrica;
  const poner = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v == null) n.delete(k); else n.set(k, v);
    setParams(n, { replace: k === "m" });
  };

  const datos = useQuery({
    queryKey: ["analisis_mapa", periodo.desde, periodo.hasta, estado],
    queryFn: () => q<DatosMapa>(supabase.rpc("analisis_mapa", { p_desde: periodo.desde, p_hasta: periodo.hasta, p_cve_ent: estado })),
    placeholderData: keepPreviousData,
  });
  const frias = useQuery({
    queryKey: ["analisis_zonas_frias", periodo.desde, periodo.hasta, estado],
    queryFn: () => q<{ zonas: Zona[] }>(supabase.rpc("analisis_zonas_frias", { p_desde: periodo.desde, p_hasta: periodo.hasta, p_cve_ent: estado })),
    placeholderData: keepPreviousData,
  });

  const d = datos.data;
  const porCve = useMemo(() => new Map((d?.regiones ?? []).map((r) => [r.cve, r])), [d]);
  const escala: Escala = useMemo(() => metrica === "cambio" ? escalaCrecimiento()
    : escalaCuantiles((d?.regiones ?? []).map((r) => valorDe(r, metrica) ?? 0)), [d, metrica]);
  const fmt = formatoDe(metrica);

  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (!d) return <Cargando filas={8} />;

  const enEstado = d.nivel === "estado";
  const unidad = enEstado ? "municipios" : "estados";
  const colorDe = (cve: string) => {
    const r = porCve.get(cve);
    if (!r) return VACIO;
    if (metrica === "cambio") {
      if (r.nuevo) return DIV(7);
      if (r.cambio == null) return VACIO;
      return escala.colores[escala.claseDe(r.cambio)];
    }
    const v = valorDe(r, metrica) ?? 0;
    return v > 0 ? escala.colores[escala.claseDe(v)] : VACIO;
  };
  const abrir = (cve: string) => { if (!enEstado) poner("estado", cve); };

  const ranking = [...d.regiones]
    .filter((r) => metrica === "cambio" ? r.monto > 0 || r.monto_anterior > 0 : (valorDe(r, metrica) ?? 0) > 0)
    .sort((a, b) => metrica === "cambio"
      ? (b.nuevo ? Infinity : b.cambio ?? -Infinity) - (a.nuevo ? Infinity : a.cambio ?? -Infinity)
      : (valorDe(b, metrica) ?? 0) - (valorDe(a, metrica) ?? 0));
  const maxRank = Math.max(...ranking.map((r) => Math.abs(valorDe(r, metrica) ?? 0)), 1);
  const top3 = [...d.regiones].sort((a, b) => b.monto - a.monto).slice(0, 3);
  const perdidoTotal = (frias.data?.zonas ?? []).reduce((s, z) => s + z.perdido, 0);

  const columnas: Columna<RegionMapa>[] = [
    { clave: "nombre", titulo: enEstado ? "Municipio" : "Estado" },
    { clave: "monto", titulo: "Venta", alinear: "der", celda: (r) => dinero(r.monto), sinBusqueda: true },
    { clave: "participacion", titulo: "Participación", alinear: "der", valor: (r) => r.participacion, celda: (r) => porcentaje(r.participacion), sinBusqueda: true },
    { clave: "monto_anterior", titulo: "Periodo anterior", alinear: "der", celda: (r) => dinero(r.monto_anterior), sinBusqueda: true },
    { clave: "cambio", titulo: "Cambio", alinear: "der", valor: (r) => r.cambio, celda: (r) => <Cambio v={r.cambio} nuevo={r.nuevo} />, sinBusqueda: true },
    { clave: "clientes", titulo: "Clientes", alinear: "der", sinBusqueda: true },
    { clave: "operaciones", titulo: "Operaciones", alinear: "der", sinBusqueda: true },
    { clave: "ticket", titulo: "Ticket promedio", alinear: "der", valor: (r) => r.ticket, celda: (r) => dinero(r.ticket), sinBusqueda: true },
    { clave: "cve", titulo: "Clave INEGI", clase: "text-tenue" },
  ];

  return (
    <div className={cn("space-y-4 transition-opacity", datos.isFetching && datos.isPlaceholderData && "opacity-60")}>
      {/* Cifras de la vista */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Cifra titulo={enEstado ? `Venta en ${d.nombre}` : "Venta"} valor={dineroCompacto(d.total)}
          detalle={<>{numero(d.clientes)} clientes · {numero(d.operaciones)} operaciones</>} />
        <Cifra titulo="Crecimiento" valor={d.cambio == null ? "—" : `${d.cambio >= 0 ? "+" : "−"}${porcentaje(Math.abs(d.cambio), 0)}`}
          detalle={<>contra {dineroCompacto(d.total_anterior)} del {tramo(d.periodo.ant_desde, d.periodo.ant_hasta)}</>} />
        <Cifra titulo={enEstado ? "Municipios con venta" : "Estados con venta"} valor={enEstado ? numero(d.regiones_con_venta) : `${d.regiones_con_venta} de 32`}
          detalle={enEstado && d.sin_municipio ? <>{dineroCompacto(d.sin_municipio.monto)} sin municipio</>
            : !enEstado && d.sin_ubicar ? <>{dineroCompacto(d.sin_ubicar.monto)} de clientes sin ubicar</> : "Todo lo vendido tiene región"} />
        <Cifra titulo={`Peso de los 3 primeros ${unidad}`} valor={d.concentracion_top3 == null ? "—" : porcentaje(d.concentracion_top3, 0)}
          detalle={top3.map((r) => r.nombre).join(", ") || "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* El mapa */}
        <section className="tarjeta min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <nav className="flex items-center gap-1 text-sm font-semibold" aria-label="Dónde estás">
              {enEstado ? (
                <>
                  <button type="button" className="text-marca-texto hover:underline" onClick={() => poner("estado", null)}>México</button>
                  <ChevronRight className="h-4 w-4 text-tenue" />
                  <span>{d.nombre}</span>
                </>
              ) : <span>México</span>}
            </nav>
            <Filtro opciones={METRICAS} valor={metrica} alCambiar={(v) => poner("m", v)} />
          </div>
          <p className="px-5 pt-1 text-xs text-tenue">
            {METRICAS.find((m) => m.valor === metrica)!.texto} en {periodo.etiqueta}
            {metrica === "cambio" && <> contra {tramo(d.periodo.ant_desde, d.periodo.ant_hasta)}</>}
            {!enEstado && " · Clic en un estado para ver sus municipios"}
          </p>
          <div className="px-3 sm:px-5 pt-2">
            <MapaMexico estado={estado} color={colorDe} seleccion={null}
              alClic={enEstado ? undefined : (cve) => abrir(cve)}
              etiqueta={(cve, nombre) => {
                const r = porCve.get(cve);
                return r ? `${nombre}: ${dinero(r.monto)}, ${porcentaje(r.participacion)} del total` : `${nombre}: sin venta`;
              }}
              tooltip={(cve, nombre) => <TooltipRegion r={porCve.get(cve)} nombre={porCve.get(cve)?.nombre ?? nombre} metrica={metrica} fmt={fmt} enEstado={enEstado} />} />
          </div>
          <div className="px-5 pb-4 pt-2 space-y-2">
            <LeyendaEscala escala={escala} formato={(v) => fmt(v)} vacio={metrica === "cambio" ? "Sin venta en ninguno de los dos" : "Sin venta"} />
            <p className="text-xs text-tenue">{escala.explicacion}</p>
            {enEstado && d.sin_municipio && d.sin_municipio.monto > 0 && (
              <p className="text-xs flex items-center gap-1.5"><MapPinOff className="h-3.5 w-3.5 text-aviso" />
                <span><b className="cifra">{dinero(d.sin_municipio.monto)}</b> de {numero(d.sin_municipio.clientes)} clientes de {d.nombre} sin municipio (la ciudad no se reconoció).{" "}
                  <Link to="/analisis/ubicaciones" className="text-marca-texto hover:underline">Revisar ubicaciones</Link></span></p>
            )}
            {!enEstado && d.sin_ubicar && d.sin_ubicar.monto > 0 && (
              <p className="text-xs flex items-center gap-1.5"><MapPinOff className="h-3.5 w-3.5 text-aviso" />
                <span><b className="cifra">{dinero(d.sin_ubicar.monto)}</b> de {numero(d.sin_ubicar.clientes)} clientes sin estado: no salen en el mapa.{" "}
                  <Link to="/analisis/ubicaciones" className="text-marca-texto hover:underline">Revisar ubicaciones</Link></span></p>
            )}
            <p className="text-[11px] text-tenue">{FUENTE_MAPAS}.</p>
          </div>
        </section>

        {/* Ranking de la vista */}
        <TarjetaGrafica titulo={`${enEstado ? "Municipios" : "Estados"} por ${METRICAS.find((m) => m.valor === metrica)!.texto.toLowerCase()}`}
          descripcion={metrica === "cambio" ? "Del que más creció al que más cayó" : "Con su participación en la venta y el cambio contra el periodo anterior"}
          tabla={<TablaDatos filas={d.regiones} columnas={columnas} claveFila={(r) => r.cve} exportarComo={`ventas-por-${unidad}`} compacta limite={100}
                   alClicFila={enEstado ? undefined : (r) => abrir(r.cve)} />}>
          {ranking.length === 0 ? (
            <Vacio icono={Globe2} titulo="Sin ventas en este periodo" texto="Elige otro periodo arriba, o «Desde 2018» para ver todo." />
          ) : (
            <ol className="px-5 pb-4 space-y-2.5 max-h-[620px] overflow-y-auto">
              {ranking.slice(0, 40).map((r, i) => (
                <li key={r.cve}>
                  <button type="button" onClick={() => abrir(r.cve)} disabled={enEstado}
                    className="w-full text-left group disabled:cursor-default">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="w-5 text-right text-xs text-tenue cifra">{i + 1}</span>
                      <span className="truncate group-enabled:group-hover:text-marca-texto">{r.nombre}</span>
                      <span className="ml-auto cifra font-medium shrink-0">{fmt(valorDe(r, metrica))}</span>
                      <span className="w-12 text-right text-xs text-tenue cifra shrink-0">{porcentaje(r.participacion, 0)}</span>
                      <Cambio v={r.cambio} nuevo={r.nuevo} className="w-14 justify-center shrink-0" />
                    </div>
                    {metrica !== "cambio" && <BarraRanking valor={valorDe(r, metrica) ?? 0} max={maxRank} className="ml-7 mt-1" />}
                  </button>
                </li>
              ))}
              {ranking.length > 40 && <li className="text-xs text-tenue pl-7">Y {ranking.length - 40} más: cámbialo a tabla para verlos todos.</li>}
            </ol>
          )}
        </TarjetaGrafica>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Zonas que se enfriaron */}
        <section className="tarjeta min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Snowflake className="h-4 w-4 text-info" /> {enEstado ? "Municipios" : "Zonas"} que se enfriaron</h3>
              <p className="text-sm text-tenue mt-0.5">
                Compraban en {tramo(d.periodo.ant_desde, d.periodo.ant_hasta)} y cayeron 30 % o más (o dejaron de comprar).
                {perdidoTotal > 0 && <> Juntas son <b className="text-texto cifra">{dineroCompacto(perdidoTotal)}</b> menos.</>}
              </p>
            </div>
            <Boton variante="secundario" tamano="sm" onClick={() => ir("/ventas/para-llamar")}><PhoneCall className="h-4 w-4" /> A quién llamar hoy</Boton>
          </div>
          {!frias.data ? <Cargando filas={3} /> : frias.data.zonas.length === 0 ? (
            <Vacio icono={Snowflake} titulo="Ninguna zona se enfrió" texto="Ningún lugar que compraba cayó 30 % o más contra el periodo anterior." />
          ) : (
            <ul className="divide-y divide-borde">
              {frias.data.zonas.map((z) => (
                <li key={z.cve} className="px-5 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {enEstado ? <span className="font-medium">{z.nombre}</span> : (
                      <button type="button" className="font-medium hover:text-marca-texto" onClick={() => abrir(z.cve)}>{z.nombre}</button>
                    )}
                    <span className="text-sm cifra">{dineroCompacto(z.monto_anterior)} → {dineroCompacto(z.monto)}</span>
                    <Cambio v={z.cambio} />
                    <span className="ml-auto text-sm text-peligro cifra font-medium">−{dineroCompacto(z.perdido)}</span>
                  </div>
                  {z.clientes.length > 0 && (
                    <p className="text-xs text-tenue mt-1">
                      {z.clientes_perdidos === 1 ? "Dejó de comprar: " : `Dejaron de comprar ${z.clientes_perdidos}: `}
                      {z.clientes.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && " · "}
                          <Link to={`/ventas/clientes/${c.id}`} className="text-marca-texto hover:underline">{c.nombre}</Link>
                          <span className="cifra"> ({dineroCompacto(c.monto_anterior)}{c.vendedor ? `, de ${c.vendedor.split(" ")[0]}` : ""})</span>
                        </span>
                      ))}
                      {z.clientes_perdidos > z.clientes.length && <> y {z.clientes_perdidos - z.clientes.length} más</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Exportación */}
        {!enEstado && (
          <section className="tarjeta min-w-0">
            <div className="px-5 pt-4 pb-2">
              <h3 className="font-semibold flex items-center gap-2"><Globe2 className="h-4 w-4 text-marca" /> Exportación</h3>
              <p className="text-sm text-tenue mt-0.5">Clientes fuera de México en {periodo.etiqueta} contra el periodo anterior. Cuentan en la venta total, pero no salen en el mapa.</p>
            </div>
            {d.extranjero.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-tenue">Sin ventas al extranjero en este periodo.</p>
            ) : (
              <table className="tabla">
                <thead><tr><th>País</th><th className="text-right">Venta</th><th className="text-right">Clientes</th><th className="text-right">Cambio</th></tr></thead>
                <tbody>
                  {d.extranjero.map((x) => (
                    <tr key={x.pais}>
                      <td>{x.pais}</td>
                      <td className="text-right cifra">{x.monto > 0 ? dinero(x.monto) : <span className="text-tenue">sin venta (antes {dineroCompacto(x.monto_anterior)})</span>}</td>
                      <td className="text-right cifra">{numero(x.clientes)}</td>
                      <td className="text-right"><Cambio v={x.monto_anterior > 0 ? x.monto / x.monto_anterior - 1 : null} nuevo={x.monto_anterior === 0 && x.monto > 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function TooltipRegion({ r, nombre, metrica, fmt, enEstado }: {
  r: RegionMapa | undefined; nombre: string; metrica: Metrica; fmt: (v: number | null | undefined) => string; enEstado: boolean;
}) {
  if (!r) return (<><p className="font-medium">{nombre}</p><p className="text-tenue mt-0.5">Sin venta en el periodo ni en el anterior</p></>);
  return (
    <>
      <p className="font-medium mb-1">{nombre}</p>
      {metrica !== "monto" && (
        <div className="flex justify-between gap-3"><span className="text-tenue">{METRICAS.find((m) => m.valor === metrica)!.texto}</span><b className="cifra">{metrica === "cambio" && r.nuevo ? "nuevo" : fmt(valorDe(r, metrica))}</b></div>
      )}
      <div className="flex justify-between gap-3"><span className="text-tenue">Venta</span><b className="cifra">{dinero(r.monto)}</b></div>
      <div className="flex justify-between gap-3"><span className="text-tenue">Participación</span><span className="cifra">{porcentaje(r.participacion)}</span></div>
      <div className="flex justify-between gap-3 items-center"><span className="text-tenue">Contra el anterior</span><Cambio v={r.cambio} nuevo={r.nuevo} /></div>
      <div className="flex justify-between gap-3"><span className="text-tenue">Clientes</span><span className="cifra">{numero(r.clientes)}</span></div>
      {!enEstado && <p className="text-tenue mt-1 pt-1 border-t border-borde">Clic para ver sus municipios</p>}
    </>
  );
}
