import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Gauge, ImageOff, RefreshCw, ShieldAlert, Store } from "lucide-react";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { dinero, fechaYHora, hace, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { llamarML } from "@/lib/mercadolibre";
import { GLOSARIO } from "@/tutorial/glosario";

export interface FilaTablero {
  item_id: string; titulo: string; estado: string | null; logistica: string | null; envio_gratis: boolean | null; permalink: string | null;
  fotos: number | null; tipo_publicacion: string | null; precio_ml: number | null; stock_ml: number | null; vendidas_total: number | null;
  visitas_30d: number | null; articulo_id: string | null; clave: string | null; articulo: string | null; imagen_url: string | null;
  piezas: number | null; precio_sugerido: number | null; libre_planta: number | null; stock_sugerido: number | null;
  preguntas_30d: number; sin_contestar: number; ventas_30d: number; unidades_30d: number; actualizado_en: string;
}

/** Lo que conviene revisar de una publicación. Las mismas reglas para la tabla y para los filtros. */
export function senales(f: FilaTablero) {
  const s: { clave: string; texto: string; tono: "peligro" | "aviso" | "info" }[] = [];
  if (!f.articulo_id) s.push({ clave: "sin_ligar", texto: "Sin ligar", tono: "aviso" });
  if (f.precio_ml != null && f.precio_sugerido != null && Math.abs(f.precio_ml / f.precio_sugerido - 1) >= 0.02)
    s.push({ clave: "precio", texto: f.precio_ml < f.precio_sugerido ? "Más barato que el sugerido" : "Más caro que el sugerido", tono: f.precio_ml < f.precio_sugerido ? "peligro" : "aviso" });
  if (f.stock_ml != null && f.stock_sugerido != null && f.stock_ml > f.stock_sugerido) s.push({ clave: "stock", texto: "Publica más de lo que hay", tono: "peligro" });
  if ((f.fotos ?? 0) < 3) s.push({ clave: "fotos", texto: `${f.fotos ?? 0} foto${f.fotos === 1 ? "" : "s"}`, tono: "aviso" });
  if ((f.visitas_30d ?? 0) >= 50 && f.ventas_30d === 0) s.push({ clave: "no_vende", texto: "Visitas sin ventas", tono: "info" });
  if (f.estado === "paused") s.push({ clave: "pausada", texto: "Pausada", tono: "info" });
  return s;
}

const LOGISTICA: Record<string, string> = { fulfillment: "Full", xd_drop_off: "Colecta / punto", cross_docking: "Colecta", drop_off: "Punto de entrega", self_service: "Envío propio" };

type FiltroT = "todas" | "revisar" | "precio" | "stock" | "fotos" | "no_vende" | "sin_ligar";

/** Cada publicación con lo que dice ML y lo que dice el ERP: precio, existencia, visitas, preguntas y ventas de 30 días. */
export function TableroPublicaciones({ puedeActualizar }: { puedeActualizar: boolean }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroT>("revisar");
  const [trayendo, setTrayendo] = useState(false);
  const datos = useQuery({ queryKey: ["ml_tablero"], queryFn: () => q<FilaTablero[]>(supabase.rpc("ml_tablero")) });

  async function traer() {
    setTrayendo(true);
    try {
      const r = await llamarML<{ publicaciones: number }>("publicaciones");
      toast.success(`${numero(r.publicaciones)} publicaciones al día con Mercado Libre`);
      qc.invalidateQueries({ queryKey: ["ml_tablero"] });
      qc.invalidateQueries({ queryKey: ["ml_reputacion"] });
    } catch (e) { toast.error(mensajeError(e)); } finally { setTrayendo(false); }
  }

  const filas = useMemo(() => {
    const f = datos.data ?? [];
    if (filtro === "todas") return f;
    if (filtro === "revisar") return f.filter((x) => senales(x).some((s) => s.tono !== "info") || senales(x).some((s) => s.clave === "no_vende"));
    return f.filter((x) => senales(x).some((s) => s.clave === filtro));
  }, [datos.data, filtro]);
  const cuenta = (c: string) => datos.data?.filter((x) => senales(x).some((s) => s.clave === c)).length;
  const opciones: { valor: FiltroT; texto: string; cuenta?: number; explica?: string }[] = [
    { valor: "revisar", texto: "Por revisar", explica: GLOSARIO.senalesPublicacionML },
    { valor: "precio", texto: "Precio", cuenta: cuenta("precio"), explica: GLOSARIO.precioSugeridoML },
    { valor: "stock", texto: "Existencia", cuenta: cuenta("stock"), explica: GLOSARIO.existenciaPublicableML },
    { valor: "fotos", texto: "Pocas fotos", cuenta: cuenta("fotos") },
    { valor: "no_vende", texto: "Visitas sin ventas", cuenta: cuenta("no_vende") },
    { valor: "sin_ligar", texto: "Sin ligar", cuenta: cuenta("sin_ligar") },
    { valor: "todas", texto: "Todas", cuenta: datos.data?.length },
  ];
  const ultima = datos.data?.reduce<string | null>((m, x) => (!m || x.actualizado_en > m ? x.actualizado_en : m), null);

  const columnas: Columna<FilaTablero>[] = [
    {
      clave: "titulo", titulo: "Publicación",
      celda: (f) => (
        <div className="min-w-[240px] max-w-[340px]">
          <p className="flex items-center gap-1.5">
            {f.imagen_url ? <img src={f.imagen_url} alt="" className="h-8 w-8 rounded object-contain border border-borde bg-fondo shrink-0" loading="lazy" />
              : <span className="h-8 w-8 rounded border border-borde bg-fondo flex items-center justify-center shrink-0"><ImageOff className="h-3.5 w-3.5 text-tenue" /></span>}
            <span className="truncate">{f.titulo}</span>
            {f.permalink && <a href={f.permalink} target="_blank" rel="noreferrer" className="text-tenue hover:text-marca-texto shrink-0" aria-label="Ver en Mercado Libre"><ExternalLink className="h-3.5 w-3.5" /></a>}
          </p>
          <p className="text-xs text-tenue truncate">{f.item_id}{f.clave ? ` · ${f.clave}` : ""}{f.piezas && Number(f.piezas) !== 1 ? ` · ${numero(Number(f.piezas))} por venta` : ""}
            {f.logistica ? ` · ${LOGISTICA[f.logistica] ?? f.logistica}` : ""}{f.envio_gratis ? " · envío gratis" : ""}</p>
          <div className="mt-1 flex flex-wrap gap-1">{senales(f).map((s) => <Insignia key={s.clave} tono={s.tono}>{s.texto}</Insignia>)}</div>
        </div>
      ),
      valor: (f) => `${f.titulo} ${f.item_id} ${f.clave ?? ""} ${f.articulo ?? ""}`,
    },
    {
      clave: "precio_ml", titulo: "Precio", alinear: "der", sinBusqueda: true, valor: (f) => f.precio_ml, explica: GLOSARIO.precioSugeridoML,
      celda: (f) => (
        <div className="whitespace-nowrap">
          <p className="cifra">{f.precio_ml != null ? dinero(f.precio_ml) : "—"}</p>
          {f.precio_sugerido != null && <p className={cn("text-xs cifra", senales(f).some((s) => s.clave === "precio") ? "text-aviso" : "text-tenue")}>sugerido {dinero(f.precio_sugerido)}</p>}
        </div>
      ),
    },
    {
      clave: "stock_ml", titulo: "Existencia", alinear: "der", sinBusqueda: true, valor: (f) => f.stock_ml, explica: GLOSARIO.existenciaPublicableML,
      celda: (f) => (
        <div className="whitespace-nowrap">
          <p className="cifra">{f.stock_ml ?? "—"} <span className="text-xs text-tenue">en ML</span></p>
          {f.logistica === "fulfillment" ? <p className="text-xs text-tenue">la maneja Full</p>
            : f.stock_sugerido != null && <p className={cn("text-xs cifra", senales(f).some((s) => s.clave === "stock") ? "text-peligro" : "text-tenue")}>{numero(f.stock_sugerido)} libres en planta</p>}
        </div>
      ),
    },
    { clave: "visitas_30d", titulo: "Visitas", alinear: "der", sinBusqueda: true, valor: (f) => f.visitas_30d ?? 0, explica: GLOSARIO.visitasML,
      celda: (f) => <span className="cifra">{f.visitas_30d != null ? numero(f.visitas_30d) : "—"}</span> },
    { clave: "preguntas_30d", titulo: "Preguntas", alinear: "der", sinBusqueda: true, valor: (f) => f.preguntas_30d,
      celda: (f) => <span className="cifra whitespace-nowrap">{numero(f.preguntas_30d)}{f.sin_contestar > 0 && <span className="text-aviso"> · {f.sin_contestar} sin contestar</span>}</span> },
    { clave: "ventas_30d", titulo: "Ventas", alinear: "der", sinBusqueda: true, valor: (f) => f.ventas_30d,
      celda: (f) => <span className="cifra whitespace-nowrap">{numero(f.ventas_30d)}{Number(f.unidades_30d) > f.ventas_30d && <span className="text-xs text-tenue"> · {numero(Number(f.unidades_30d))} u.</span>}</span> },
    { clave: "conversion", titulo: "Conversión", alinear: "der", sinBusqueda: true, explica: GLOSARIO.conversionML,
      valor: (f) => (f.visitas_30d ? f.ventas_30d / f.visitas_30d : -1),
      celda: (f) => <span className="cifra">{f.visitas_30d ? porcentaje(f.ventas_30d / f.visitas_30d) : "—"}</span> },
  ];

  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (datos.isLoading) return <Cargando filas={5} />;
  if (!datos.data?.length) {
    return (
      <div className="tarjeta">
        <Vacio icono={Store} titulo="Todavía no se han traído las publicaciones" texto="«Traer de Mercado Libre» lee cada publicación (precio, existencia, visitas y fotos) y la cruza con el catálogo. No cambia nada en Mercado Libre."
          accion={puedeActualizar ? <Boton onClick={traer} cargando={trayendo}><RefreshCw className="h-4 w-4" /> Traer de Mercado Libre</Boton> : undefined} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-tenue">
        <span>Últimos 30 días{ultima && ` · actualizado ${hace(ultima)}`}. Solo lee de Mercado Libre: no cambia nada allá.</span>
        {puedeActualizar && <Boton variante="secundario" tamano="sm" onClick={traer} cargando={trayendo}><RefreshCw className="h-3.5 w-3.5" /> Traer de Mercado Libre</Boton>}
      </div>
      <TablaDatos filas={filas} columnas={columnas} claveFila={(f) => f.item_id} exportarComo="publicaciones-ml"
        placeholder="Buscar publicación, clave o artículo…"
        filtros={<Filtro opciones={opciones} valor={filtro} alCambiar={setFiltro} />}
        vacio={{ icono: Store, titulo: filtro === "revisar" ? "Nada que revisar" : "Nada con este filtro", texto: filtro === "revisar" ? "Precios, existencias y fotos cuadran con el catálogo." : "Prueba con otro filtro." }} />
    </div>
  );
}

// -----------------------------------------------------------------------------
interface Reputacion {
  level_id?: string; power_seller_status?: string | null;
  transactions?: { total?: number; completed?: number; canceled?: number; ratings?: { positive?: number; negative?: number; neutral?: number } };
  metrics?: Record<string, { period?: string; rate?: number; value?: number }>;
}
interface Reclamo {
  id: string; folio: string; tipo: string; estado: string; motivo: string; fecha_limite: string | null; responsable: string | null;
  pedido: string; venta_ml: string | null; publicacion: string | null; abierto_en: string;
}

const COLOR: Record<string, { texto: string; clase: string }> = {
  "5_green": { texto: "Verde", clase: "bg-ok" }, "4_light_green": { texto: "Verde claro", clase: "bg-ok/70" },
  "3_yellow": { texto: "Amarillo", clase: "bg-aviso" }, "2_orange": { texto: "Naranja", clase: "bg-aviso/80" }, "1_red": { texto: "Rojo", clase: "bg-peligro" },
};
const LIDER: Record<string, string> = { platinum: "MercadoLíder Platinum", gold: "MercadoLíder Gold", silver: "MercadoLíder" };
const METRICA: Record<string, string> = { claims: "Reclamos", delayed_handling_time: "Despachos con demora", cancellations: "Cancelaciones por ti", sales: "Ventas del periodo" };

/** El termómetro de ML y los reclamos que siguen abiertos (sin montos). */
export function ReputacionML() {
  const rep = useQuery({ queryKey: ["ml_reputacion"], queryFn: () => q<{ datos: Reputacion; actualizado_en: string } | null>(supabase.from("ml_reputacion").select("datos, actualizado_en").maybeSingle()) });
  const reclamos = useQuery({ queryKey: ["ml_reclamos_abiertos"], queryFn: () => q<Reclamo[]>(supabase.rpc("ml_reclamos_abiertos")) });
  if (rep.error) return <ErrorCarga error={rep.error} />;
  if (rep.isLoading) return <Cargando filas={3} />;
  const d = rep.data?.datos;
  const nivel = d?.level_id ? COLOR[d.level_id] : null;
  const r = d?.transactions?.ratings;
  return (
    <div className="space-y-5">
      {!d ? (
        <div className="tarjeta"><Vacio icono={Gauge} titulo="Sin reputación todavía" texto="Se trae junto con las publicaciones: en «Publicaciones», «Traer de Mercado Libre»." /></div>
      ) : (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Reputación en Mercado Libre" descripcion={`Como la reporta ML · actualizada ${hace(rep.data!.actualizado_en)}`} explica={GLOSARIO.reputacionML} />
          <div className="px-5 pb-5 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-1" aria-label={`Termómetro ${nivel?.texto ?? "sin dato"}`}>
                {["1_red", "2_orange", "3_yellow", "4_light_green", "5_green"].map((k) => (
                  <span key={k} className={cn("h-3 w-10 rounded-full", d.level_id === k ? COLOR[k].clase : "bg-borde")} />
                ))}
              </div>
              <p className="font-semibold">{nivel?.texto ?? "Sin termómetro"}{d.power_seller_status ? ` · ${LIDER[d.power_seller_status] ?? d.power_seller_status}` : ""}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-4">
              {Object.entries(d.metrics ?? {}).filter(([k]) => k in METRICA).map(([k, m]) => (
                <div key={k} className="rounded-lg border border-borde p-3">
                  <dt className="text-xs text-tenue">{METRICA[k]}{m.period ? ` · ${m.period.replace("days", "días").replace("months", "meses")}` : ""}</dt>
                  <dd className="text-lg font-semibold cifra">{k === "sales" ? numero(m.value ?? 0) : porcentaje(m.rate ?? 0)}
                    {k !== "sales" && m.value != null && <span className="text-xs font-normal text-tenue"> · {numero(m.value)}</span>}</dd>
                </div>
              ))}
              {r && <div className="rounded-lg border border-borde p-3">
                <dt className="text-xs text-tenue">Calificaciones</dt>
                <dd className="text-sm"><span className="text-ok">{porcentaje(r.positive ?? 0)} buenas</span> · <span className="text-peligro">{porcentaje(r.negative ?? 0)} malas</span></dd>
              </div>}
            </dl>
          </div>
        </Tarjeta>
      )}
      <Tarjeta className="overflow-hidden">
        <EncabezadoTarjeta titulo="Reclamos y devoluciones abiertos" descripcion="Lo que puede bajar la reputación: responde antes de la fecha límite" explica={GLOSARIO.reclamoML} />
        {reclamos.error ? <div className="p-5"><ErrorCarga error={reclamos.error} /></div> : !reclamos.data?.length ? (
          <p className="px-5 pb-5 text-sm text-tenue">No hay reclamos abiertos.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {reclamos.data.map((c) => {
              const vence = c.fecha_limite ? (new Date(c.fecha_limite).getTime() - Date.now()) / 3600_000 : null;
              return (
                <li key={c.id} className="px-5 py-3 text-sm flex flex-wrap items-start gap-x-3 gap-y-1">
                  {vence != null && vence < 24 ? <AlertTriangle className="h-4 w-4 text-peligro mt-0.5" /> : <ShieldAlert className="h-4 w-4 text-tenue mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.folio} · {c.tipo === "reclamo" ? "Reclamo" : c.tipo === "devolucion" ? "Devolución" : "Cancelación"} · {c.motivo}</p>
                    <p className="text-xs text-tenue">{c.publicacion ?? "—"} · venta {c.venta_ml ?? c.pedido}{c.responsable ? ` · atiende ${c.responsable}` : ""}</p>
                  </div>
                  {c.fecha_limite && <Insignia tono={vence! < 0 ? "peligro" : vence! < 24 ? "aviso" : "neutro"}>{vence! < 0 ? "venció" : "vence"} {fechaYHora(c.fecha_limite)}</Insignia>}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
