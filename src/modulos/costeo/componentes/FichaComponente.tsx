import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, ImageOff, Loader2, Store, Warehouse } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, fechaYHora, hace, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { esCostoViejo, leerNumero, useCategorias, useProveedores, type ArticuloCatalogo } from "./comun";
import { GraficaEscalonada } from "./Graficas";
import { FormulaEnPalabras, useDesglose } from "./CostoPrecio";
import { DondeSeUsa } from "./DondeSeUsa";

type Moneda = "MXN" | "USD" | "EUR";
const enMoneda = (v: number | null | undefined, m: Moneda | null | undefined) =>
  v == null ? "—" : !m || m === "MXN" ? dinero(Number(v)) : `${m} ${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/** Un campo que se guarda solo al salir de él (o al cambiar, si es lista o casilla). */
function useGuardarCampo(id: string) {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<"" | "guardando" | "ok">("");
  async function guardar(cambios: Partial<ArticuloCatalogo>) {
    setEstado("guardando");
    const { error } = await supabase.from("articulos").update(cambios).eq("id", id);
    if (error) { toast.error(mensajeError(error)); setEstado(""); return; }
    setEstado("ok");
    qc.invalidateQueries({ queryKey: ["costeo"] });
    setTimeout(() => setEstado(""), 1500);
  }
  return { guardar, estado };
}

function TextoAuto({ valor, alGuardar, numerico, multilinea, ...p }: {
  valor: string | number | null | undefined; alGuardar: (v: string | number | null) => void; numerico?: boolean; multilinea?: boolean;
  placeholder?: string; className?: string; "aria-label"?: string;
}) {
  const [t, setT] = useState(valor == null ? "" : String(valor));
  useEffect(() => setT(valor == null ? "" : String(valor)), [valor]);
  const salir = () => {
    const nuevo = numerico ? leerNumero(t) : t.trim() || null;
    const antes = valor == null || valor === "" ? null : numerico ? Number(valor) : String(valor);
    if (nuevo !== antes) alGuardar(nuevo);
  };
  return multilinea
    ? <AreaTexto value={t} onChange={(e) => setT(e.target.value)} onBlur={salir} rows={6} {...p} />
    : <Entrada value={t} onChange={(e) => setT(e.target.value)} onBlur={salir} inputMode={numerico ? "decimal" : undefined}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className={cn(numerico && "text-right cifra", p.className)} placeholder={p.placeholder} aria-label={p["aria-label"]} />;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div><dt className="text-xs text-tenue">{etiqueta}</dt><dd className="text-sm mt-0.5">{children}</dd></div>;
}

function DatosGenerales({ a }: { a: ArticuloCatalogo }) {
  const { puede } = useSesion();
  const editar = puede("costeo", 2) || puede("compras", 2);
  const verProveedor = puede("costos") || puede("compras");
  const cats = useCategorias();
  const provs = useProveedores(verProveedor);
  const { guardar, estado } = useGuardarCampo(a.id);

  const indicador = estado === "guardando" ? <span className="inline-flex items-center gap-1 text-xs text-tenue"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando</span>
    : estado === "ok" ? <span className="inline-flex items-center gap-1 text-xs text-ok"><Check className="h-3.5 w-3.5" /> Guardado</span> : null;

  if (!editar) {
    return (
      <Tarjeta>
        <EncabezadoTarjeta titulo="Datos generales" />
        <dl className="px-5 pb-5 grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Unidad">{a.unidad}</Dato>
          <Dato etiqueta="Categoría">{a.categoria ?? "—"}</Dato>
          <Dato etiqueta="Tiempo de entrega">{a.tiempo_entrega_dias != null ? `${a.tiempo_entrega_dias} días` : "—"}</Dato>
          <Dato etiqueta="Origen">{a.es_importado ? "Importado" : "Nacional"}</Dato>
          <Dato etiqueta="Se compra en múltiplos de">{numero(a.empaque)}</Dato>
          <Dato etiqueta="Peso">{a.kg_por_unidad ? `${numero(a.kg_por_unidad)} kg por ${a.unidad}` : "—"}</Dato>
          {a.descripcion && <div className="sm:col-span-3"><Dato etiqueta="Ficha técnica"><p className="whitespace-pre-line">{a.descripcion}</p></Dato></div>}
        </dl>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Datos generales" descripcion="Cada campo se guarda solo al salir de él." acciones={indicador} />
      <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" className="sm:col-span-2"><TextoAuto valor={a.nombre} alGuardar={(v) => v && guardar({ nombre: String(v) })} /></Campo>
        <Campo etiqueta="Unidad"><TextoAuto valor={a.unidad} alGuardar={(v) => v && guardar({ unidad: String(v) })} /></Campo>
        <Campo etiqueta="Categoría" ayuda={cats.data?.find((c) => c.id === a.categoria_id)?.politica_id ? "Esta categoría trae su propia política de precio." : undefined}>
          <Seleccion value={a.categoria_id ?? ""} onChange={(e) => guardar({ categoria_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin categoría</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Seleccion>
        </Campo>
        {verProveedor && (
          <Campo etiqueta="Proveedor principal">
            <Seleccion value={a.proveedor_id ?? ""} onChange={(e) => guardar({ proveedor_id: e.target.value || null })}>
              <option value="">Sin proveedor</option>
              {provs.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta="Tiempo de entrega (días)" ayuda="Si está vacío se usa el del proveedor.">
          <TextoAuto numerico valor={a.tiempo_entrega_dias} placeholder="—" alGuardar={(v) => guardar({ tiempo_entrega_dias: v == null ? null : Math.round(Number(v)) })} />
        </Campo>
        <label className="flex items-center gap-2 text-sm sm:pt-7">
          <input type="checkbox" checked={a.es_importado} onChange={(e) => guardar({ es_importado: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--marca))]" />
          <span>Importado <span className="block text-xs text-tenue">Pide 6 meses de cobertura en lugar de 1.</span></span>
        </label>
        <Campo etiqueta="Meses de cobertura" ayuda={`Vacío = ${a.es_importado ? 6 : 1} (${a.es_importado ? "importado" : "nacional"}).`}>
          <TextoAuto numerico valor={a.meses_cobertura} placeholder={a.es_importado ? "6" : "1"} alGuardar={(v) => guardar({ meses_cobertura: v == null || Number(v) <= 0 ? null : Number(v) })} />
        </Campo>
        <Campo etiqueta="Stock de seguridad" ayuda="Se suma al punto de reorden.">
          <TextoAuto numerico valor={a.stock_minimo_fijo} placeholder="—" alGuardar={(v) => guardar({ stock_minimo_fijo: v == null ? null : Number(v) })} />
        </Campo>
        <Campo etiqueta="Se compra en múltiplos de">
          <TextoAuto numerico valor={a.empaque} alGuardar={(v) => v != null && Number(v) > 0 && guardar({ empaque: Number(v) })} />
        </Campo>
        <Campo etiqueta={`Kilos por ${a.unidad}`} ayuda="Para reportar consumo de acero en kg.">
          <TextoAuto numerico valor={a.kg_por_unidad} placeholder="—" alGuardar={(v) => guardar({ kg_por_unidad: v == null ? null : Number(v) })} />
        </Campo>
        <Campo etiqueta="Imagen (URL)" className="sm:col-span-2">
          <div className="flex gap-3 items-start">
            <TextoAuto valor={a.imagen_url} placeholder="https://…" alGuardar={(v) => guardar({ imagen_url: v == null ? null : String(v) })} className="flex-1" />
            {a.imagen_url
              ? <img src={a.imagen_url} alt="Vista previa" className="h-16 w-16 rounded-lg object-cover border border-borde bg-fondo shrink-0"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              : <div className="h-16 w-16 rounded-lg border border-dashed border-borde flex items-center justify-center text-tenue shrink-0"><ImageOff className="h-5 w-5" /></div>}
          </div>
        </Campo>
        <Campo etiqueta="Descripción y ficha técnica" className="sm:col-span-2" ayuda="Sale en la cotización. Una viñeta por renglón.">
          <TextoAuto multilinea valor={a.descripcion} placeholder="• Medida…&#10;• Material…" alGuardar={(v) => guardar({ descripcion: v == null ? null : String(v) })} />
        </Campo>
      </div>
    </Tarjeta>
  );
}

interface CambioCosto { id: number; en: string; costo_anterior: number | null; costo_nuevo: number; moneda: Moneda; origen: string; referencia: string | null; proveedor: { nombre: string } | null }
const ORIGEN: Record<string, string> = { manual: "a mano", orden_compra: "orden de compra", importacion: "importación", cotizacion_proveedor: "cotización" };

function CostoComponente({ a }: { a: ArticuloCatalogo }) {
  const { puede } = useSesion();
  const qc = useQueryClient();
  const d = useDesglose(a.id);
  const [nuevo, setNuevo] = useState("");
  const [moneda, setMoneda] = useState<Moneda>((a.moneda_costo as Moneda) ?? "MXN");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setMoneda((a.moneda_costo as Moneda) ?? "MXN"), [a.moneda_costo]);

  async function actualizar(e: FormEvent) {
    e.preventDefault();
    const n = leerNumero(nuevo);
    if (n == null || n < 0) { toast.error("Escribe el costo nuevo."); return; }
    setGuardando(true);
    const { error } = await supabase.rpc("actualizar_costos", { p_cambios: [{ articulo_id: a.id, costo: n, moneda, proveedor_id: a.proveedor_id ?? "" }] });
    setGuardando(false);
    if (error) { toast.error(mensajeError(error)); return; }
    setNuevo("");
    toast.success("Costo actualizado. El precio y los equipos que lo usan ya se recalcularon.");
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }

  const viejo = esCostoViejo(a.costo_actualizado_en);
  return (
      <Tarjeta>
        <EncabezadoTarjeta titulo="Costo" descripcion={a.proveedor ? `Proveedor: ${a.proveedor}` : undefined} />
        <div className="px-5 pb-5 space-y-4">
          {a.costo_capturado ? (
            <div>
              <p className="text-3xl font-semibold cifra">{enMoneda(a.costo_capturado, a.moneda_costo)}</p>
              {a.moneda_costo && a.moneda_costo !== "MXN" && <p className="text-sm text-tenue cifra">≈ {dinero(a.costo_total)} al tipo de cambio de hoy</p>}
              <p className="text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-tenue">Actualizado el {fecha(a.costo_actualizado_en)}</span>
                {viejo && <Insignia tono="aviso" punto>{hace(a.costo_actualizado_en)}: conviene confirmarlo</Insignia>}
              </p>
            </div>
          ) : <p className="text-sm rounded-lg bg-peligro-suave text-peligro px-3 py-2">Sin costo capturado: cuenta como $0 en todos los equipos que lo usan y no tiene precio de lista.</p>}
          {puede("costos", 2) && (
            <form onSubmit={actualizar} className="flex gap-2">
              <Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className="w-24" aria-label="Moneda">
                <option>MXN</option><option>USD</option><option>EUR</option>
              </Seleccion>
              <Entrada value={nuevo} onChange={(e) => setNuevo(e.target.value)} inputMode="decimal" placeholder="Costo nuevo sin IVA" className="text-right cifra" aria-label="Costo nuevo" />
              <Boton type="submit" variante="secundario" cargando={guardando}>Actualizar</Boton>
            </form>
          )}
          {d.data && <div className="border-t border-borde pt-4"><FormulaEnPalabras d={d.data} /></div>}
        </div>
      </Tarjeta>
  );
}

function HistorialCosto({ a }: { a: ArticuloCatalogo }) {
  const historial = useQuery({
    queryKey: ["costeo", "historial-costos", a.id],
    queryFn: () => q<CambioCosto[]>(supabase.from("historial_costos").select("id, en, costo_anterior, costo_nuevo, moneda, origen, referencia, proveedor:proveedores(nombre)")
      .eq("articulo_id", a.id).order("en", { ascending: false }).limit(200) as unknown as PromiseLike<{ data: CambioCosto[] | null; error: { message: string } | null }>),
  });
  const monedaHist = historial.data?.[0]?.moneda ?? "MXN";
  return (
      <Tarjeta>
        <EncabezadoTarjeta titulo="Historial del costo" descripcion="Cada cambio queda registrado solo, con su origen (reemplaza la hoja ACTUALIZACIONES)." />
        <div className="px-5 pb-5 grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {(historial.data?.length ?? 0) >= 1
              ? <GraficaEscalonada moneda={monedaHist} puntos={(historial.data ?? []).filter((h) => h.moneda === monedaHist).map((h) => ({ en: h.en, costo: Number(h.costo_nuevo) }))} />
              : <p className="text-sm text-tenue py-8 text-center">Sin cambios registrados.</p>}
          </div>
          <div className="lg:col-span-2 overflow-y-auto max-h-56 border border-borde rounded-lg">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th className="text-right">Costo</th><th className="text-right">Cambio</th><th>Origen</th></tr></thead>
              <tbody>
                {(historial.data ?? []).map((h) => {
                  const cambio = h.costo_anterior ? Number(h.costo_nuevo) / Number(h.costo_anterior) - 1 : null;
                  return (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{fecha(h.en)}</td>
                      <td className="text-right cifra">{enMoneda(h.costo_nuevo, h.moneda)}</td>
                      <td className={cn("text-right cifra", cambio != null && cambio > 0 && "text-peligro", cambio != null && cambio < 0 && "text-ok")}>
                        {cambio == null ? "—" : `${cambio > 0 ? "+" : ""}${porcentaje(cambio)}`}
                      </td>
                      <td className="text-tenue text-xs whitespace-nowrap" title={h.referencia ?? undefined}>{ORIGEN[h.origen] ?? h.origen}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Tarjeta>
  );
}

function Existencias({ a }: { a: ArticuloCatalogo }) {
  const ex = useQuery({
    queryKey: ["costeo", "existencias", a.id],
    queryFn: () => q<{ cantidad: number; actualizado_en: string; almacen: { nombre: string; disponible_para_planta: boolean } }[]>(
      supabase.from("existencias").select("cantidad, actualizado_en, almacen:almacenes(nombre, disponible_para_planta)").eq("articulo_id", a.id) as never),
  });
  const filas = (ex.data ?? []).filter((e) => Number(e.cantidad) !== 0).sort((x, y) => Number(y.cantidad) - Number(x.cantidad));
  const planta = filas.filter((e) => e.almacen.disponible_para_planta).reduce((s, e) => s + Number(e.cantidad), 0);
  const ml = filas.filter((e) => !e.almacen.disponible_para_planta).reduce((s, e) => s + Number(e.cantidad), 0);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Existencias por almacén" descripcion={<>En planta <b className="text-texto cifra">{numero(planta)} {a.unidad}</b>{ml ? <> · en Full de Mercado Libre <b className="text-texto cifra">{numero(ml)}</b> (no cuenta para planta)</> : null}</>} />
      {filas.length === 0
        ? <Vacio icono={Warehouse} titulo="Sin existencia" texto="No hay piezas en ningún almacén." className="py-8" />
        : (
          <table className="tabla">
            <tbody>
              {filas.map((e) => (
                <tr key={e.almacen.nombre}>
                  <td>{e.almacen.nombre}{!e.almacen.disponible_para_planta && <Insignia className="ml-2">no cuenta para planta</Insignia>}</td>
                  <td className="text-right cifra font-medium">{numero(e.cantidad)}</td>
                  <td className="text-right text-xs text-tenue whitespace-nowrap">{hace(e.actualizado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </Tarjeta>
  );
}

interface Publicacion { id: string; canal: string; id_externo: string | null; titulo: string | null; url: string | null; precio: number | null; con_envio: boolean; piezas_por_paquete: number; stock_publicado: number | null; estado: string; actualizado_en: string }
interface PrecioCanal { canal: string; comision_pct: number; costo_envio: number; precio_sugerido: number | null; precio_con_envio: number | null }
const CANAL: Record<string, string> = { mercadolibre: "Mercado Libre", sitio_web: "Sitio web", amazon: "Amazon" };

function Publicaciones({ a }: { a: ArticuloCatalogo }) {
  const pubs = useQuery({
    queryKey: ["costeo", "publicaciones", a.id],
    queryFn: () => q<Publicacion[]>(supabase.from("publicaciones").select("*").eq("articulo_id", a.id).order("canal")),
  });
  const precios = useQuery({
    queryKey: ["costeo", "precios-canal", a.id, a.precio],
    queryFn: () => q<PrecioCanal[]>(supabase.rpc("precios_por_canal", { p_articulo: a.id })),
  });
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Canales en línea" descripcion="Precio sugerido con IVA a partir del de lista: comisión del canal, cuota fija y envío." />
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Canal</th><th className="text-right">Comisión</th><th className="text-right">Sugerido</th><th className="text-right">Con envío</th><th>Publicado</th></tr></thead>
          <tbody>
            {(precios.data ?? []).map((p) => {
              const suyas = (pubs.data ?? []).filter((x) => x.canal === p.canal);
              return (
                <tr key={p.canal} className="align-top">
                  <td className="font-medium whitespace-nowrap">{CANAL[p.canal] ?? p.canal}</td>
                  <td className="text-right cifra text-tenue">{porcentaje(Number(p.comision_pct))}</td>
                  <td className="text-right cifra">{dinero(p.precio_sugerido)}</td>
                  <td className="text-right cifra">{dinero(p.precio_con_envio)}</td>
                  <td className="min-w-[260px]">
                    {suyas.length === 0 ? <span className="text-tenue text-sm">No publicado</span> : suyas.map((x) => {
                      const ref = x.con_envio ? Number(p.precio_con_envio) * x.piezas_por_paquete : Number(p.precio_sugerido) * x.piezas_por_paquete;
                      const abajo = x.precio != null && ref > 0 && Number(x.precio) < ref - 0.5;
                      return (
                        <div key={x.id} className="flex items-center gap-2 py-0.5 text-sm">
                          {x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="truncate max-w-[260px] hover:underline inline-flex items-center gap-1">{x.titulo ?? x.id_externo}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                            : <span className="truncate max-w-[260px]">{x.titulo ?? x.id_externo}</span>}
                          <span className="cifra font-medium">{dinero(x.precio)}</span>
                          {x.piezas_por_paquete > 1 && <Insignia>paquete de {x.piezas_por_paquete}</Insignia>}
                          {x.estado !== "activa" && <Insignia tono="neutro">{x.estado}</Insignia>}
                          {abajo && <Insignia tono="aviso" punto>abajo del sugerido</Insignia>}
                        </div>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!precios.isLoading && !(precios.data ?? []).length && <p className="p-5 text-sm text-tenue flex items-center gap-2"><Store className="h-4 w-4" /> Sin precio de lista no hay precio sugerido por canal.</p>}
      </div>
      {pubs.data?.some((x) => x.actualizado_en) && (
        <p className="px-5 py-2 text-xs text-tenue border-t border-borde">Publicaciones actualizadas por última vez el {fechaYHora(pubs.data.map((x) => x.actualizado_en).sort().pop())}</p>
      )}
    </Tarjeta>
  );
}

/** Ficha de lo que se compra: datos, costo con su historia, existencias, canales y dónde se usa. */
export function FichaComponente({ articulo }: { articulo: ArticuloCatalogo }) {
  const { puede } = useSesion();
  const costos = puede("costos");
  const verExistencias = puede("inventario") || puede("ventas");
  const verCanales = puede("ventas") || puede("inventario");
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3"><DatosGenerales a={articulo} /></div>
      <div className="lg:col-span-2 space-y-4">
        {costos && <CostoComponente a={articulo} />}
        {verExistencias && <Existencias a={articulo} />}
      </div>
      {costos && <div className="lg:col-span-5"><HistorialCosto a={articulo} /></div>}
      {verCanales && <div className="lg:col-span-5"><Publicaciones a={articulo} /></div>}
      <div className="lg:col-span-5 space-y-2">
        <h3 className="font-semibold">Dónde se usa</h3>
        <DondeSeUsa id={articulo.id} unidad={articulo.unidad} />
      </div>
    </div>
  );
}
