// "Nueva orden" desde la cotización del proveedor: compras sube el PDF (o la foto),
// Claude la lee y la base empareja proveedor y artículos (preparar_cotizacion). Nada
// se guarda hasta "Crear orden": ahí se crea en borrador con lo que compras revisó
// (crear_oc_desde_cotizacion) y la clave del proveedor de cada artículo queda
// recordada para la próxima cotización.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { leerDocumento } from "@/lib/asistente";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utilidades";
import { SelectorProveedor, type Moneda, type ProveedorBreve } from "./comun";
import { DialogoProveedor } from "./DialogoProveedor";

interface ArticuloBreve { id: string; clave: string; nombre: string; unidad: string | null }
type Origen = "recordado" | "clave" | "sugerido" | "manual" | null;
interface Linea { descripcion: string; clave: string | null; unidad: string | null; cantidad: string; precio: string; articulo: ArticuloBreve | null; origen: Origen }
interface Preparado { proveedor: ProveedorBreve | null; partidas: { i: number; articulo: ArticuloBreve | null; origen: Origen }[] }
export interface CotizacionLeida { archivo: File; campos: Record<string, unknown> }

const MONEDAS: Moneda[] = ["MXN", "USD", "EUR"];
const ORIGEN: Record<Exclude<Origen, null | "manual">, { texto: string; tono: "ok" | "aviso"; ayuda: string }> = {
  recordado: { texto: "Ya la conocemos", tono: "ok", ayuda: "Esta clave del proveedor ya se usó con este artículo" },
  clave: { texto: "Por su clave", tono: "ok", ayuda: "La clave del proveedor es la del catálogo o viene en el nombre del artículo" },
  sugerido: { texto: "Sugerido: revísalo", tono: "aviso", ayuda: "Por el parecido del nombre; confirma que sea el mismo" },
};

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const aNumero = (s: string) => { const n = Number(s.replace(/,/g, "")); return s.trim() !== "" && Number.isFinite(n) ? n : null; };
const monto = (n: number, m: Moneda) => `${m === "EUR" ? "€" : "$"}${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${m === "MXN" ? "" : ` ${m}`}`;
// "pza", "pz", "pieza", "pcs" son lo mismo; avisar solo cuando de verdad cambia la unidad.
const unidadNormal = (u: string | null) => {
  const t = (u ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return null;
  if (["pz", "pza", "pzas", "pieza", "piezas", "pc", "pcs", "pieces", "unidad", "unidades", "u", "ea"].includes(t)) return "pieza";
  if (["m", "mt", "mts", "metro", "metros"].includes(t)) return "m";
  if (["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"].includes(t)) return "kg";
  return t;
};

/** El recuadro de arriba de "Nueva orden": elegir el archivo y leerlo. */
export function SubirCotizacion({ alLeer }: { alLeer: (c: CotizacionLeida) => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const abortar = useRef<AbortController | null>(null);
  useEffect(() => () => abortar.current?.abort(), []);

  const leer = async (f: File) => {
    setError(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) { setError("Claude lee PDF, JPG o PNG. Si la cotización es de Excel, guárdala como PDF."); return; }
    if (f.size > 15 * 1024 * 1024) { setError("El archivo pesa más de 15 MB: sube solo las páginas que importan."); return; }
    setArchivo(f); setLeyendo(true);
    abortar.current = new AbortController();
    try {
      const r = await leerDocumento("cotizacion_proveedor", f, abortar.current.signal);
      // En modo demostración los datos son un ejemplo: no se arma una orden real con ellos.
      if (r.simulado) { setError("Falta conectar la llave de Claude: por ahora arma la orden a mano."); return; }
      alLeer({ archivo: f, campos: r.campos });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(mensajeError(e));
    } finally { setLeyendo(false); }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-borde bg-fondo/50 px-4 py-3"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !leyendo) leer(f); }}>
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 text-marca shrink-0" />
        <p className="text-sm flex-1 min-w-[200px]">
          <b>¿Tienes la cotización del proveedor?</b> Súbela y Claude arma la orden. <span className="text-tenue">PDF o foto.</span>
        </p>
        <Boton type="button" variante="secundario" onClick={() => entrada.current?.click()} cargando={leyendo}>
          {!leyendo && <FileUp className="h-4 w-4" />}{leyendo ? "Leyendo…" : "Subir cotización"}
        </Boton>
        <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" aria-label="Cotización del proveedor"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) leer(f); }} />
      </div>
      {leyendo && <p className="mt-2 text-sm text-tenue flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Claude está leyendo {archivo?.name}… (unos segundos)</p>}
      {error && <p className="mt-2 text-sm text-peligro flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}

/** Revisar lo leído y crear la orden en borrador. */
export function RevisarCotizacion({ leida, alQuitar, alCrear }: { leida: CotizacionLeida; alQuitar: () => void; alCrear: (id: string) => void }) {
  const { puede } = useSesion();
  const c = leida.campos;
  const partidasLeidas = useMemo(() => (Array.isArray(c.partidas) ? (c.partidas as Record<string, unknown>[]) : []), [c.partidas]);
  const [prov, setProv] = useState<ProveedorBreve | null>(null);
  const [buscado, setBuscado] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>((MONEDAS as string[]).includes(String(c.moneda)) ? (c.moneda as Moneda) : "MXN");
  const [condiciones, setCondiciones] = useState(texto(c.condiciones_pago) ?? "");
  const [dias, setDias] = useState(num(c.dias_entrega)?.toString() ?? "");
  const [notas, setNotas] = useState([texto(c.numero) && `Cotización ${texto(c.numero)}`, texto(c.fecha) && `del ${texto(c.fecha)}`,
    texto(c.vigencia) && `(vigente al ${texto(c.vigencia)})`].filter(Boolean).join(" "));
  const [lineas, setLineas] = useState<Linea[]>(() => partidasLeidas.map((p) => ({
    descripcion: texto(p.descripcion) ?? "", clave: texto(p.clave), unidad: texto(p.unidad),
    cantidad: num(p.cantidad)?.toString() ?? "", precio: num(p.precio_unitario)?.toString() ?? "", articulo: null, origen: null,
  })));
  const [recordar, setRecordar] = useState(true);
  const [costos, setCostos] = useState(false);
  const [alta, setAlta] = useState(false);
  const [buscando, setBuscando] = useState<number | null>(null);
  const vista = useMemo(() => URL.createObjectURL(leida.archivo), [leida.archivo]);
  useEffect(() => () => URL.revokeObjectURL(vista), [vista]);
  const advertencias = (c.advertencias as string[] | undefined) ?? [];

  // Emparejar: la primera vez busca también al proveedor (por RFC o nombre); al cambiar
  // de proveedor vuelve a emparejar, sin tocar lo que compras ya eligió a mano.
  const emparejar = async (proveedorId: string | null) => {
    try {
      const r = await q<Preparado>(supabase.rpc("preparar_cotizacion", {
        p_partidas: lineas.map((l) => ({ descripcion: l.descripcion, clave: l.clave })), p_proveedor: proveedorId,
        p_nombre: proveedorId ? null : texto(c.proveedor), p_rfc: proveedorId ? null : texto(c.rfc),
      }));
      if (!proveedorId && r.proveedor) {
        setProv(r.proveedor);
        if (!(MONEDAS as string[]).includes(String(c.moneda))) setMoneda(r.proveedor.moneda);
      }
      setLineas((ls) => ls.map((l, i) => {
        if (l.origen === "manual") return l;
        const m = r.partidas.find((x) => x.i === i);
        return m?.articulo ? { ...l, articulo: m.articulo, origen: m.origen } : { ...l, articulo: null, origen: null };
      }));
    } catch (e) { toast.error(mensajeError(e)); }
    finally { setBuscado(true); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { emparejar(null); }, []);
  const elegirProveedor = (p: ProveedorBreve) => { setProv(p); emparejar(p.id); };

  const poner = (i: number, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const subtotal = lineas.reduce((s, l) => s + (aNumero(l.cantidad) ?? 0) * (aNumero(l.precio) ?? 0), 0);
  const incompletas = lineas.filter((l) => !((aNumero(l.cantidad) ?? 0) > 0) || (aNumero(l.precio) ?? -1) < 0 || (!l.articulo && !l.descripcion.trim())).length;
  const conClave = lineas.some((l) => l.clave && l.articulo);
  const sinArticulo = lineas.filter((l) => !l.articulo).length;

  const crear = useAccion(() => q<string>(supabase.rpc("crear_oc_desde_cotizacion", {
    p_proveedor: prov!.id,
    p_partidas: lineas.map((l) => ({ articulo_id: l.articulo?.id ?? null, descripcion: l.descripcion, clave: l.clave,
      cantidad: aNumero(l.cantidad), costo_unitario: aNumero(l.precio) })),
    p_moneda: moneda, p_condiciones: condiciones || null, p_dias_entrega: aNumero(dias), p_notas: notas || null,
    p_recordar: recordar, p_actualizar_costos: costos,
  })), {
    exito: costos ? "Orden creada en borrador; los costos quedaron actualizados" : "Orden creada en borrador",
    invalidar: [["v_ordenes_compra"]], alTerminar: (id) => alCrear(id),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-marca/30 bg-marca-suave/40 px-4 py-3 space-y-2">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-marca shrink-0 mt-0.5" />
          <p className="text-sm flex-1 min-w-0">
            <b>Claude leyó {lineas.length} {lineas.length === 1 ? "partida" : "partidas"}</b> de <span className="text-tenue">{leida.archivo.name}</span>.
            {" "}Revisa proveedor, artículos, cantidades y precios: nada se guarda hasta crear la orden.
          </p>
          <a href={vista} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-marca-texto hover:underline">
            Ver archivo <ExternalLink className="h-3 w-3" />
          </a>
          <button type="button" onClick={alQuitar} className="shrink-0 p-1 rounded text-tenue hover:bg-fondo" aria-label="Descartar la cotización" title="Descartar y armar la orden a mano">
            <X className="h-4 w-4" />
          </button>
        </div>
        {advertencias.length > 0 && (
          <ul className="text-sm text-aviso space-y-1">
            {advertencias.map((a) => <li key={a} className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{a}</li>)}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Proveedor" className="sm:col-span-2"
          ayuda={!buscado ? "Buscándolo en el catálogo…" : prov ? undefined : texto(c.proveedor) ? `«${texto(c.proveedor)}» no está en el catálogo: elígelo o dalo de alta.` : "Elige al proveedor."}>
          <div className="flex gap-2">
            <SelectorProveedor valor={prov} alCambiar={elegirProveedor} className="flex-1 min-w-0" />
            {buscado && !prov && <Boton type="button" variante="secundario" onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Dar de alta</Boton>}
          </div>
        </Campo>
        <Campo etiqueta="Moneda">
          <Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Entrega (días hábiles)" ayuda={prov?.dias_entrega ? `Si lo dejas vacío: ${prov.dias_entrega}, lo de siempre con este proveedor.` : undefined}>
          <Entrada inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} placeholder={prov?.dias_entrega?.toString() ?? "7"} />
        </Campo>
        <Campo etiqueta="Condiciones de pago">
          <Entrada value={condiciones} onChange={(e) => setCondiciones(e.target.value)}
            placeholder={prov ? (prov.dias_credito > 0 ? `Crédito a ${prov.dias_credito} días` : "Contado") : "Contado"} />
        </Campo>
        <Campo etiqueta="Notas de la orden"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
      </div>

      <div className="tarjeta overflow-hidden">
        <ul className="divide-y divide-borde">
          {lineas.map((l, i) => {
            const o = l.origen && l.origen !== "manual" ? ORIGEN[l.origen] : null;
            const otraUnidad = l.articulo && unidadNormal(l.unidad) && unidadNormal(l.articulo.unidad) && unidadNormal(l.unidad) !== unidadNormal(l.articulo.unidad);
            const importe = (aNumero(l.cantidad) ?? 0) * (aNumero(l.precio) ?? 0);
            return (
              <li key={i} className="p-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{l.descripcion || <span className="text-tenue">Sin descripción</span>}</p>
                  <p className="text-xs text-tenue">{[l.clave && `Clave del proveedor: ${l.clave}`, l.unidad && `por ${l.unidad}`].filter(Boolean).join(" · ") || "Sin clave del proveedor"}</p>
                </div>
                <div className="min-w-0">
                  {l.articulo && buscando !== i ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm min-w-0"><span className="text-tenue cifra">{l.articulo.clave}</span> {l.articulo.nombre}</span>
                      {o && <span title={o.ayuda}><Insignia tono={o.tono}>{o.texto}</Insignia></span>}
                      <span className="flex gap-1">
                        <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setBuscando(i)}>Cambiar</Boton>
                        <Boton type="button" variante="fantasma" tamano="sm" title="Que quede como texto, sin artículo del catálogo"
                          onClick={() => poner(i, { articulo: null, origen: "manual" })}>Sin artículo</Boton>
                      </span>
                      {otraUnidad && <p className="w-full text-xs text-aviso">Cotizan por {l.unidad}; el artículo va por {l.articulo.unidad}. Ajusta cantidad y precio a la unidad del artículo.</p>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <BuscadorArticulo tipos={["componente", "materia_prima", "servicio"]} mostrarPrecio={false} autoFocus={buscando === i}
                        placeholder="Buscar el artículo del catálogo…"
                        alElegir={(a) => { poner(i, { articulo: { id: a.id, clave: a.clave, nombre: a.nombre, unidad: a.unidad }, origen: "manual" }); setBuscando(null); }} />
                      <p className="text-xs text-tenue">
                        {buscando === i ? <button type="button" className="hover:underline" onClick={() => setBuscando(null)}>Dejarlo como estaba</button>
                          : "Sin artículo, entra como texto (sirve para fletes y servicios; no mueve inventario al recibir)."}
                      </p>
                    </div>
                  )}
                </div>
                {/* En celular el importe baja de renglón: cantidad, precio e importe no caben en 326 px. */}
                <div className="flex flex-wrap items-end gap-2">
                  <Campo etiqueta="Cant." className="w-20"><Entrada inputMode="decimal" value={l.cantidad} onChange={(e) => poner(i, { cantidad: e.target.value })} className="cifra" /></Campo>
                  <Campo etiqueta="Precio unit." className="w-28"><Entrada inputMode="decimal" value={l.precio} onChange={(e) => poner(i, { precio: e.target.value })} className="cifra" /></Campo>
                  <p className="w-28 ml-auto lg:ml-0 text-right text-sm cifra pb-2">{monto(importe, moneda)}</p>
                  <button type="button" aria-label="Quitar la partida" title="Quitar la partida" disabled={lineas.length === 1}
                    onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
                    className="mb-1.5 p-1.5 rounded text-tenue hover:bg-fondo hover:text-peligro disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-4 py-3 border-t border-borde bg-fondo/50 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-tenue">
            {sinArticulo > 0 ? `${sinArticulo} ${sinArticulo === 1 ? "partida va" : "partidas van"} sin artículo del catálogo.` : "Todas las partidas con su artículo."}
            {num(c.total) !== null && ` La cotización dice total ${monto(num(c.total)!, moneda)}.`}
          </span>
          <span>Subtotal sin IVA <b className="cifra">{monto(subtotal, moneda)}</b></span>
        </div>
      </div>

      <div className="space-y-2">
        {conClave && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
            <span>Recordar las claves de este proveedor <span className="text-tenue">— la próxima cotización suya llega con los artículos ya emparejados.</span></span>
          </label>
        )}
        {puede("costos", 2) && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={costos} onChange={(e) => setCostos(e.target.checked)} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
            <span>Actualizar el costo de compra de los artículos con estos precios <span className="text-tenue">— queda en el historial como cotización del proveedor y se recalculan los precios.</span></span>
          </label>
        )}
      </div>

      <div className={cn("flex flex-wrap items-center gap-2", incompletas > 0 && "justify-between")}>
        {incompletas > 0 && <p className="text-sm text-aviso">{incompletas} {incompletas === 1 ? "partida necesita" : "partidas necesitan"} cantidad y precio.</p>}
        <div className="flex gap-2 ml-auto">
          <Boton variante="secundario" onClick={alQuitar}>Descartar</Boton>
          <Boton disabled={!prov || incompletas > 0 || lineas.length === 0} cargando={crear.isPending} onClick={() => crear.mutate(undefined)}>Crear orden en borrador</Boton>
        </div>
      </div>

      <DialogoProveedor abierto={alta} alCambiar={setAlta}
        inicial={{ nombre: texto(c.proveedor) ?? "", razon_social: texto(c.proveedor), rfc: texto(c.rfc), moneda }}
        alGuardar={async (id) => {
        const { data } = await supabase.from("proveedores").select("id, nombre, categoria, pais, es_importacion, moneda, dias_entrega, dias_credito").eq("id", id).maybeSingle();
        if (data) elegirProveedor(data as ProveedorBreve);
      }} />
    </div>
  );
}
