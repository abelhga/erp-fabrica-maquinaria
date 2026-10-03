import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, History, Save, Search, Tags, Undo2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Filtro } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { dinero, fecha, numero, porcentaje } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { useTiposCambio, type Moneda, hace } from "./componentes/comun";

interface Precio {
  articulo_id: string; clave: string; nombre: string; unidad: string; tipo: string; es_importado: boolean;
  proveedor_id: string | null; proveedor: string | null; costo: number | null; moneda: Moneda | null; actualizado_en: string | null;
  actualizado_por: string | null; dias_sin_actualizar: number | null; costo_anterior: number | null; usado_en: number;
}
interface Cambio { costo: string; moneda: Moneda }
interface CambioHistorial {
  id: number; en: string; clave: string; nombre: string; costo_anterior: number | null; costo_nuevo: number; moneda: Moneda;
  cambio: number | null; origen: string; usuario: string | null; proveedor: string | null;
}
type Vista = "todos" | "viejos" | "sin_costo" | "cambios";

const VIEJO = 180;
const ORIGEN: Record<string, string> = { manual: "a mano", orden_compra: "por orden de compra", importacion: "importado de la hoja", cotizacion_proveedor: "cotización" };
const POR_PAGINA = 300;

/**
 * Actualizar precios: reemplaza la hoja ACTUALIZACIONES. El comprador escribe el
 * costo nuevo y Enter lo guarda y baja a la siguiente fila; el historial (quién,
 * cuándo, de cuánto a cuánto) lo anota la base sola, y el costeo de los equipos
 * que lo usan se recalcula en ese momento.
 */
export default function Precios() {
  const { puede, perfil } = useSesion();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const vista = (params.get("filtro") as Vista) || "todos";
  const proveedor = params.get("proveedor") ?? "";
  const [busqueda, setBusqueda] = useState(params.get("q") ?? "");
  const [cambios, setCambios] = useState<Record<string, Cambio>>({});
  const [guardados, setGuardados] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const entradas = useRef(new Map<string, HTMLInputElement>());
  const edita = puede("costos", 2);
  const tc = useTiposCambio();

  const datos = useQuery({
    queryKey: ["v_precios_compra"],
    queryFn: () => todasLasFilas<Precio>((d, h) => supabase.from("v_precios_compra")
      .select("articulo_id, clave, nombre, unidad, tipo, es_importado, proveedor_id, proveedor, costo, moneda, actualizado_en, actualizado_por, dias_sin_actualizar, costo_anterior, usado_en")
      .order("nombre").order("articulo_id").range(d, h)),
  });
  const historial = useQuery({
    queryKey: ["v_historial_costos", "recientes"],
    queryFn: () => q<CambioHistorial[]>(supabase.from("v_historial_costos")
      .select("id, en, clave, nombre, costo_anterior, costo_nuevo, moneda, cambio, origen, usuario, proveedor")
      .order("en", { ascending: false }).order("id", { ascending: false }).limit(40)),
  });

  const filas = datos.data ?? [];
  const viejo = (p: Precio) => p.costo != null && (p.dias_sin_actualizar ?? 0) > VIEJO;
  const sinCosto = (p: Precio) => p.costo == null || Number(p.costo) === 0;
  const pendientes = Object.keys(cambios).filter((id) => cambioValido(filas.find((f) => f.articulo_id === id), cambios[id]));
  const proveedores = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const f of filas) if (f.proveedor_id) m.set(f.proveedor_id, { nombre: f.proveedor ?? "", n: (m.get(f.proveedor_id)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, "es"));
  }, [filas]);

  const visibles = useMemo(() => filas.filter((f) => {
    if (proveedor && f.proveedor_id !== proveedor) return false;
    if (vista === "viejos" && !viejo(f)) return false;
    if (vista === "sin_costo" && !sinCosto(f)) return false;
    if (vista === "cambios" && !cambios[f.articulo_id]) return false;
    if (busqueda.trim() && !coincide(`${f.clave} ${f.nombre} ${f.proveedor ?? ""}`, busqueda)) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filas, proveedor, vista, busqueda, vista === "cambios" ? cambios : null]);
  const mostradas = visibles.slice(0, mostrar);

  function cambioValido(f: Precio | undefined, c: Cambio | undefined) {
    if (!f || !c) return false;
    const n = Number(c.costo.replace(/,/g, ""));
    if (c.costo.trim() === "") return c.moneda !== (f.moneda ?? "MXN") && f.costo != null;
    return !Number.isNaN(n) && n >= 0 && (n !== Number(f.costo) || c.moneda !== (f.moneda ?? "MXN"));
  }
  function cambioPct(f: Precio, c: Cambio | undefined) {
    if (!c || f.costo == null || Number(f.costo) === 0 || !tc.data) return null;
    const nuevo = c.costo.trim() === "" ? Number(f.costo) : Number(c.costo.replace(/,/g, ""));
    if (Number.isNaN(nuevo)) return null;
    return (nuevo * tc.data[c.moneda]) / (Number(f.costo) * tc.data[f.moneda ?? "MXN"]) - 1;
  }
  const poner = (f: Precio, parcial: Partial<Cambio>) => setCambios((cs) => ({
    ...cs, [f.articulo_id]: { costo: cs[f.articulo_id]?.costo ?? "", moneda: cs[f.articulo_id]?.moneda ?? f.moneda ?? "MXN", ...parcial },
  }));
  const quitar = (ids: string[]) => setCambios((cs) => { const n = { ...cs }; ids.forEach((id) => delete n[id]); return n; });

  async function guardar(ids: string[]) {
    const lote = ids.map((id) => ({ f: filas.find((x) => x.articulo_id === id)!, c: cambios[id] })).filter(({ f, c }) => cambioValido(f, c));
    if (!lote.length) return;
    setGuardando(true);
    try {
      const enviados = lote.map(({ f, c }) => ({
        articulo_id: f.articulo_id, moneda: c.moneda, proveedor_id: "",
        costo: c.costo.trim() === "" ? Number(f.costo) : Number(c.costo.replace(/,/g, "")),
      }));
      await q(supabase.rpc("actualizar_costos", { p_cambios: enviados }));
      // La tabla tiene miles de filas: se corrige en memoria en vez de volver a bajarla toda.
      const hoy = new Date().toLocaleDateString("en-CA");
      qc.setQueryData<Precio[]>(["v_precios_compra"], (viejas) => viejas?.map((f) => {
        const e = enviados.find((x) => x.articulo_id === f.articulo_id);
        return e ? { ...f, costo_anterior: f.costo, costo: e.costo, moneda: e.moneda, actualizado_en: hoy, dias_sin_actualizar: 0, actualizado_por: perfil?.nombre ?? null } : f;
      }));
      quitar(enviados.map((e) => e.articulo_id));
      qc.invalidateQueries({ queryKey: ["v_historial_costos"] });
      qc.invalidateQueries({ queryKey: ["indicadores"] });
      const impacto = await q<{ equipos: number; subensambles: number }>(supabase.rpc("impacto_costos", { p_articulos: enviados.map((e) => e.articulo_id) }));
      const efecto = impacto.equipos || impacto.subensambles
        ? `cambia el precio de ${impacto.equipos} equipo(s)${impacto.subensambles ? ` y ${impacto.subensambles} subensamble(s)` : ""}`
        : "no está en ningún equipo";
      setGuardados((g) => ({ ...g, ...Object.fromEntries(enviados.map((e) => [e.articulo_id, efecto])) }));
      toast.success(enviados.length === 1 ? `Costo guardado · ${efecto}` : `${enviados.length} costos guardados · ${efecto}`);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const irA = (i: number) => { const f = mostradas[i]; if (!f) return; const e = entradas.current.get(f.articulo_id); e?.focus(); e?.select(); };
  const cambiarParam = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); setMostrar(POR_PAGINA); };

  return (
    <Pagina
      titulo="Actualizar precios"
      descripcion="Escribe el costo nuevo y Enter: se guarda, queda en el historial con tu nombre y los precios de los equipos que lo usan se recalculan."
      ancho="max-w-[1500px]"
      acciones={edita && (
        <>
          {pendientes.length > 0 && <Boton variante="fantasma" onClick={() => setCambios({})}><Undo2 className="h-4 w-4" /> Descartar</Boton>}
          <Boton onClick={() => guardar(pendientes)} disabled={!pendientes.length} cargando={guardando}>
            <Save className="h-4 w-4" /> Guardar {pendientes.length || ""} {pendientes.length === 1 ? "cambio" : "cambios"}
          </Boton>
        </>
      )}
    >
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <Tarjeta className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-borde">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="campo pl-9" placeholder="Clave, nombre o proveedor…" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setMostrar(POR_PAGINA); }} />
            </div>
            <Filtro<Vista> valor={vista} alCambiar={(v) => cambiarParam("filtro", v === "todos" ? "" : v)} opciones={[
              { valor: "todos", texto: "Todos" },
              { valor: "viejos", texto: "Más de 6 meses", cuenta: filas.filter(viejo).length },
              { valor: "sin_costo", texto: "Sin costo", cuenta: filas.filter(sinCosto).length },
              ...(pendientes.length ? [{ valor: "cambios" as Vista, texto: "Sin guardar", cuenta: pendientes.length }] : []),
            ]} />
            <Seleccion className="w-auto max-w-[240px] h-8 text-xs" value={proveedor} onChange={(e) => cambiarParam("proveedor", e.target.value)} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              {proveedores.map(([id, p]) => <option key={id} value={id}>{p.nombre} ({p.n})</option>)}
            </Seleccion>
            <span className="ml-auto text-sm text-tenue cifra">{numero(visibles.length)} artículos</span>
          </div>

          {datos.error ? <ErrorCarga error={datos.error} /> : datos.isLoading ? <Cargando filas={8} /> : visibles.length === 0 ? (
            <Vacio icono={Tags} titulo={vista === "viejos" ? "Ningún costo tiene más de 6 meses" : "Nada con este filtro"}
              texto="Cambia el filtro, el proveedor o la búsqueda." />
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="px-2">Clave</th><th>Artículo</th><th className="hidden xl:table-cell px-2">Proveedor</th>
                    <th className="text-right px-2">Costo actual</th><th className="px-2">Actualizado</th>
                    <th className="text-right w-32 px-2">Nuevo costo</th><th className="px-1">Moneda</th><th className="text-right px-2">Cambio</th>
                    <th className="text-right hidden 2xl:table-cell" title="Equipos y subensambles que lo usan directamente">Usado en</th>
                  </tr>
                </thead>
                <tbody>
                  {mostradas.map((f, i) => {
                    const c = cambios[f.articulo_id];
                    const pct = cambioPct(f, c);
                    const pendiente = cambioValido(f, c);
                    return (
                      <tr key={f.articulo_id} className={cn(pendiente && "bg-aviso-suave/50", guardados[f.articulo_id] && !pendiente && "bg-ok-suave/40")}>
                        <td className="px-2 text-xs text-tenue whitespace-nowrap">{f.clave}</td>
                        <td className="max-w-[280px]">
                          <p className="truncate" title={f.nombre}>{f.nombre}</p>
                          <p className="text-xs text-tenue">{f.unidad}{f.es_importado && <span className="text-info"> · importado</span>}
                            {guardados[f.articulo_id] && !pendiente && <span className="text-ok"> · guardado, {guardados[f.articulo_id]}</span>}</p>
                        </td>
                        <td className="hidden xl:table-cell px-2 text-xs text-tenue max-w-[160px] truncate" title={f.proveedor ?? ""}>{f.proveedor ?? "—"}</td>
                        <td className="text-right whitespace-nowrap cifra px-2">
                          {f.costo == null ? <span className="text-peligro text-xs">sin costo</span> : dinero(f.costo, f.moneda === "USD" ? "USD" : "MXN")}
                        </td>
                        <td className="whitespace-nowrap text-xs px-2">
                          {f.actualizado_en ? (
                            <span className={cn("inline-flex items-center gap-1", viejo(f) ? "text-aviso" : "text-tenue")} title={`${fecha(f.actualizado_en)}${f.actualizado_por ? ` · ${f.actualizado_por}` : ""}`}>
                              {viejo(f) && <Clock className="h-3.5 w-3.5" />}{hace(f.actualizado_en)}
                            </span>
                          ) : <span className="text-tenue">—</span>}
                        </td>
                        <td className="text-right px-2">
                          <input
                            ref={(e) => { if (e) entradas.current.set(f.articulo_id, e); else entradas.current.delete(f.articulo_id); }}
                            inputMode="decimal" disabled={!edita} aria-label={`Nuevo costo de ${f.nombre}`}
                            className={cn("campo h-8 text-right cifra", pendiente && "border-aviso")}
                            placeholder={f.costo == null ? "0.00" : String(Number(f.costo))}
                            value={c?.costo ?? ""}
                            onChange={(e) => poner(f, { costo: e.target.value.replace(/[^\d.,]/g, "") })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); if (pendiente) guardar([f.articulo_id]); irA(i + 1); }
                              else if (e.key === "ArrowDown") { e.preventDefault(); irA(i + 1); }
                              else if (e.key === "ArrowUp") { e.preventDefault(); irA(i - 1); }
                              else if (e.key === "Escape") quitar([f.articulo_id]);
                            }}
                          />
                        </td>
                        <td className="px-1">
                          <select className="campo h-8 w-[76px] pl-2 pr-1 text-xs" disabled={!edita} aria-label="Moneda"
                            value={c?.moneda ?? f.moneda ?? "MXN"} onChange={(e) => poner(f, { moneda: e.target.value as Moneda })}>
                            <option value="MXN">MXN</option><option value="USD">USD</option>
                          </select>
                        </td>
                        <td className="text-right whitespace-nowrap px-2">
                          {pct != null && pendiente ? (
                            <span className={cn("cifra text-sm font-medium inline-flex items-center gap-1",
                              pct > 0.1 ? "text-peligro" : pct > 0 ? "text-aviso" : pct < 0 ? "text-ok" : "text-tenue")}
                              title={Math.abs(pct) > 0.5 ? "Cambio de más de 50 %: revisa que la unidad y la moneda sean las mismas" : undefined}>
                              {Math.abs(pct) > 0.5 && <AlertTriangle className="h-3.5 w-3.5" />}
                              {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {porcentaje(Math.abs(pct))}
                            </span>
                          ) : f.costo_anterior && f.costo ? (
                            <span className="text-xs text-tenue cifra" title="Último cambio registrado">
                              {Number(f.costo) >= Number(f.costo_anterior) ? "▲" : "▼"} {porcentaje(Math.abs(Number(f.costo) / Number(f.costo_anterior) - 1))}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-right hidden 2xl:table-cell text-tenue cifra">{f.usado_en || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibles.length > mostradas.length && (
                <button onClick={() => setMostrar((m) => m + POR_PAGINA)} className="w-full py-3 text-sm text-marca-texto hover:bg-fondo">
                  Mostrar {Math.min(POR_PAGINA, visibles.length - mostradas.length)} más de {numero(visibles.length - mostradas.length)} restantes
                </button>
              )}
            </div>
          )}
          <div className="border-t border-borde px-3 py-2 text-xs text-tenue">
            <b>Enter</b> guarda la fila y baja · <b>↑ ↓</b> se mueven sin guardar (lo escrito queda pendiente para "Guardar cambios") · <b>Esc</b> deshace la fila.
            El cambio en % compara en pesos (dólares al tipo de cambio de hoy{tc.data ? `: ${dinero(tc.data.USD)}` : ""}).
          </div>
        </Tarjeta>

        <Tarjeta className="2xl:sticky 2xl:top-4">
          <EncabezadoTarjeta titulo={<span className="flex items-center gap-2"><History className="h-4 w-4 text-tenue" /> Últimos cambios</span>}
            descripcion="Quién movió qué costo y cuándo" />
          {historial.isLoading ? <Cargando filas={5} /> : (historial.data?.length ?? 0) === 0 ? (
            <p className="px-5 pb-5 text-sm text-tenue">Todavía no hay cambios registrados.</p>
          ) : (
            <ul className="grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1 max-h-[70vh] 2xl:max-h-[calc(100vh-220px)] overflow-y-auto">
              {historial.data!.map((h) => (
                <li key={h.id} className="px-5 py-2.5 border-b border-borde">
                  <p className="text-sm truncate" title={h.nombre}>{h.nombre}</p>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-tenue cifra">
                      {h.costo_anterior != null ? `${numero(h.costo_anterior)} → ` : "Alta: "}<b className="text-texto">{numero(h.costo_nuevo)}</b> {h.moneda}
                    </p>
                    {h.cambio != null && (
                      <span className={cn("text-xs font-medium cifra", h.cambio > 0.1 ? "text-peligro" : h.cambio > 0 ? "text-aviso" : h.cambio < 0 ? "text-ok" : "text-tenue")}>
                        {h.cambio > 0 ? "▲" : h.cambio < 0 ? "▼" : ""} {porcentaje(Math.abs(h.cambio))}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-tenue">{h.usuario ?? "—"} · {hace(h.en)} · {ORIGEN[h.origen] ?? h.origen}</p>
                </li>
              ))}
            </ul>
          )}
          {pendientes.length > 0 && (
            <div className="border-t border-borde px-5 py-3 text-sm flex items-center gap-2 text-aviso">
              <AlertTriangle className="h-4 w-4" /> {pendientes.length} cambio(s) sin guardar
            </div>
          )}
          {pendientes.length === 0 && Object.keys(guardados).length > 0 && (
            <div className="border-t border-borde px-5 py-3 text-sm flex items-center gap-2 text-ok">
              <CheckCircle2 className="h-4 w-4" /> {Object.keys(guardados).length} guardado(s) en esta sesión
            </div>
          )}
        </Tarjeta>
      </div>
    </Pagina>
  );
}
