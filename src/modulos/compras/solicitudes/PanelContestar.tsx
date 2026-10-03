import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Check, PackagePlus, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { SelectorProveedor, hace } from "../componentes/comun";
import { CLAVE, abierta, type Moneda, type Solicitud } from "./datos";
import { DetalleSolicitud, RespuestaVenta } from "./Componentes";

const UNIDADES = ["pieza", "metro", "kilo", "litro", "juego", "tramo", "m2", "caja", "rollo"];
const sumarDias = (n: number) => { const d = new Date(hoyISO() + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

interface CostoActual { costo: number | null; moneda: Moneda | null; proveedor_id: string | null; proveedor: string | null; actualizado_en: string | null }

/**
 * Contestar una solicitud: el artículo (del catálogo o de alta aquí mismo), quién lo
 * vende, cuánto cuesta y en cuánto llega. Enter guarda. El costo entra igual que en
 * "Actualizar precios" (con historial) y el precio de lista se recalcula solo; al
 * vendedor le llega el precio de lista y la entrega, no el costo.
 */
export function PanelContestar({ s, alCerrar }: { s: Solicitud; alCerrar: () => void }) {
  const [modo, setModo] = useState<"catalogo" | "nuevo">(s.articulo_id ? "catalogo" : "nuevo");
  const [articulo, setArticulo] = useState<{ id: string; clave: string; nombre: string } | null>(
    s.articulo_id ? { id: s.articulo_id, clave: s.clave ?? "", nombre: s.articulo ?? "" } : null);
  const [nuevo, setNuevo] = useState({ clave: "", nombre: [s.descripcion, s.marca, s.modelo].filter(Boolean).join(" ").slice(0, 120), unidad: s.unidad || "pieza" });
  const [proveedor, setProveedor] = useState<{ id: string; nombre: string } | null>(null);
  const [costo, setCosto] = useState<number | null>(null);
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [entrega, setEntrega] = useState<number | null>(null);
  const [vigencia, setVigencia] = useState(sumarDias(15));
  const [respuesta, setRespuesta] = useState("");
  const [sinPrecio, setSinPrecio] = useState(false);
  const [motivo, setMotivo] = useState("");
  const costoRef = useRef<HTMLInputElement>(null);
  const editable = abierta(s);

  // La clave del componente nuevo llega sugerida con el siguiente número (como en el alta de costeo).
  useEffect(() => {
    if (modo !== "nuevo" || nuevo.clave) return;
    supabase.rpc("sugerir_clave", { p_tipo: "componente" }).then(({ data }) => { if (data) setNuevo((n) => ({ ...n, clave: n.clave || String(data) })); });
  }, [modo, nuevo.clave]);

  // Lo que ya dice el catálogo de ese artículo: costo, proveedor y desde cuándo.
  const actual = useQuery({
    queryKey: ["v_precios_compra", "uno", articulo?.id], enabled: modo === "catalogo" && !!articulo?.id,
    queryFn: () => q<CostoActual | null>(supabase.from("v_precios_compra").select("costo, moneda, proveedor_id, proveedor, actualizado_en")
      .eq("articulo_id", articulo!.id).maybeSingle()),
  });
  const plazoArticulo = useQuery({
    queryKey: ["articulo_plazo", articulo?.id], enabled: modo === "catalogo" && !!articulo?.id,
    queryFn: () => q<{ tiempo_entrega_dias: number | null } | null>(supabase.from("articulos").select("tiempo_entrega_dias").eq("id", articulo!.id).maybeSingle()),
  });
  useEffect(() => {
    const a = actual.data;
    if (!a) return;
    if (!proveedor && a.proveedor_id) setProveedor({ id: a.proveedor_id, nombre: a.proveedor ?? "" });
    if (a.moneda && costo == null) setMoneda(a.moneda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual.data]);
  useEffect(() => {
    if (entrega == null && plazoArticulo.data?.tiempo_entrega_dias != null) setEntrega(plazoArticulo.data.tiempo_entrega_dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plazoArticulo.data]);

  // Cuánto quedará el precio de lista con ese costo (la misma fórmula del recálculo).
  const [estimarCon, setEstimarCon] = useState<{ a: string | null; c: number; m: Moneda } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setEstimarCon(costo && costo > 0 ? { a: modo === "catalogo" ? articulo?.id ?? null : null, c: costo, m: moneda } : null), 250);
    return () => clearTimeout(t);
  }, [costo, moneda, modo, articulo?.id]);
  const estimado = useQuery({
    queryKey: ["precio_lista_estimado", estimarCon], enabled: !!estimarCon,
    queryFn: () => q<number | null>(supabase.rpc("precio_lista_estimado", { p_articulo: estimarCon!.a, p_costo: estimarCon!.c, p_moneda: estimarCon!.m })),
  });

  const invalidar = [[...CLAVE], ["v_precios_compra"], ["v_historial_costos"], ["indicadores"]];
  const contestar = useAccion(
    async () => {
      if (modo === "catalogo" && !articulo) throw new Error("Elige el artículo del catálogo o cámbiate a “Dar de alta”.");
      if (modo === "nuevo" && nuevo.nombre.trim().length < 3) throw new Error("Escribe el nombre del artículo nuevo.");
      if (!costo || costo <= 0) throw new Error("Escribe el costo.");
      if (entrega == null) throw new Error("Escribe el tiempo de entrega en días hábiles.");
      return q<{ articulo_id: string; clave: string; precio_lista: number | null }>(supabase.rpc("contestar_solicitud_precio", {
        p_solicitud: s.id, p_costo: costo, p_moneda: moneda, p_proveedor: proveedor?.id ?? null, p_tiempo_entrega_dias: Math.round(entrega),
        p_vigencia_hasta: vigencia || null, p_respuesta: respuesta.trim() || null,
        p_articulo: modo === "catalogo" ? articulo!.id : null,
        p_nuevo: modo === "nuevo" ? { clave: nuevo.clave.trim(), nombre: nuevo.nombre.trim(), unidad: nuevo.unidad } : null,
      }));
    },
    {
      exito: (r) => `${s.folio} contestada: ${r.clave} queda en ${dinero(r.precio_lista)} de lista. ${s.solicitante.split(" ")[0]} ya lo ve.`,
      invalidar, alTerminar: alCerrar,
    },
  );
  const noSeConsigue = useAccion(
    () => q(supabase.rpc("marcar_no_se_consigue", { p_solicitud: s.id, p_motivo: motivo })),
    { exito: `${s.folio}: le avisamos que no se consigue`, invalidar, alTerminar: alCerrar },
  );

  function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (!contestar.isPending) contestar.mutate(undefined);
  }

  if (!editable) {
    return (
      <div className="space-y-5">
        <DetalleSolicitud s={s} />
        <RespuestaVenta s={s} />
        {s.costo != null && (
          <p className="text-sm text-tenue">Costo capturado: <b className="text-texto cifra">{dinero(Number(s.costo), s.moneda === "USD" ? "USD" : "MXN")}{s.moneda === "EUR" ? " EUR" : ""}</b>{s.proveedor ? ` · ${s.proveedor}` : ""}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DetalleSolicitud s={s} />

      <form onSubmit={enviar} className="tarjeta p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Respuesta</h3>
          <div className="flex rounded-lg border border-borde p-0.5 bg-fondo text-xs">
            {([["catalogo", "Está en el catálogo", Search], ["nuevo", "Dar de alta", PackagePlus]] as const).map(([v, t, I]) => (
              <button key={v} type="button" onClick={() => setModo(v)}
                className={cn("h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 font-medium", modo === v ? "bg-superficie shadow-sm text-texto" : "text-tenue hover:text-texto")}>
                <I className="h-3.5 w-3.5" />{t}
              </button>
            ))}
          </div>
        </div>

        {modo === "catalogo" ? (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Artículo</span>
            {articulo ? (
              <div className="campo h-auto py-2 flex items-center gap-2">
                <span className="min-w-0 flex-1"><span className="cifra text-xs text-tenue mr-2">{articulo.clave}</span>{articulo.nombre}</span>
                <button type="button" className="p-1 rounded text-tenue hover:bg-fondo" aria-label="Cambiar artículo" onClick={() => setArticulo(null)}><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <BuscadorArticulo autoFocus tipos={["componente", "materia_prima", "servicio"]} placeholder="Busca por clave o nombre y Enter…"
                alElegir={(a) => { setArticulo({ id: a.id, clave: a.clave, nombre: a.nombre }); setEntrega(a.tiempo_entrega_dias); costoRef.current?.focus(); }} />
            )}
            {actual.data?.costo != null && (
              <p className="text-xs text-tenue">
                Hoy en el catálogo: <b className="text-texto cifra">{dinero(Number(actual.data.costo), actual.data.moneda === "USD" ? "USD" : "MXN")}</b>
                {actual.data.moneda === "EUR" ? " EUR" : ""}{actual.data.proveedor ? ` · ${actual.data.proveedor}` : ""}{actual.data.actualizado_en ? ` · ${hace(actual.data.actualizado_en)}` : ""}
              </p>
            )}
            {articulo && actual.data && actual.data.costo == null && <p className="text-xs text-aviso">Este artículo no tiene costo: por eso no tenía precio de lista.</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)_110px]">
            <Campo etiqueta="Clave"><Entrada value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} className="cifra" /></Campo>
            <Campo etiqueta="Nombre en el catálogo"><Entrada value={nuevo.nombre} autoFocus onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Unidad">
              <Seleccion value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}>
                {[...new Set([nuevo.unidad, ...UNIDADES])].map((u) => <option key={u} value={u}>{u}</option>)}
              </Seleccion>
            </Campo>
            <p className="sm:col-span-3 -mt-1 text-xs text-tenue">Se da de alta como componente con este costo; la solicitud queda ligada y el vendedor ya lo encuentra en el buscador.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Proveedor</span>
          <SelectorProveedor valor={proveedor} alCambiar={(p) => { setProveedor(p); if (costo == null) setMoneda(p.moneda); if (entrega == null && p.dias_entrega != null) setEntrega(p.dias_entrega); }} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] gap-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Costo unitario</span>
            <CampoNumero ref={costoRef} valor={costo} alCambiar={setCosto} decimales={4} min={0} prefijo="$" vacioEsCero={false} etiqueta="Costo unitario"
              placeholder="0.00" alEnter={() => enviar()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Moneda</span>
            <Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </Seleccion>
          </label>
          <label className="space-y-1.5 col-span-2 sm:col-span-1">
            <span className="text-sm font-medium">Entrega (días hábiles)</span>
            <CampoNumero valor={entrega} alCambiar={(n) => setEntrega(Math.round(n))} decimales={0} min={0} vacioEsCero={false} etiqueta="Tiempo de entrega"
              placeholder="p. ej. 5" alEnter={() => enviar()} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Precio válido hasta" ayuda={vigencia ? `Vigencia del proveedor: ${fecha(vigencia)}` : "Sin vigencia"}>
            <Entrada type="date" value={vigencia} min={hoyISO()} onChange={(e) => setVigencia(e.target.value)} />
          </Campo>
          <Campo etiqueta="Nota para quien lo pidió" ayuda="La lee el vendedor: nada de costos aquí.">
            <Entrada value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Mínimo 10 piezas, llega por paquetería…" />
          </Campo>
        </div>

        <div className="rounded-lg bg-fondo px-3 py-2 text-sm flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-tenue">Precio de lista que verá el vendedor</span>
          <span className="font-semibold cifra">{estimarCon ? (estimado.isFetching ? "…" : estimado.data != null ? <>{dinero(Number(estimado.data))} <span className="text-xs font-normal text-tenue">+ IVA</span></> : "sin política de precio") : "—"}</span>
        </div>

        {sinPrecio ? (
          <div className="rounded-lg border border-peligro/30 bg-peligro-suave/50 p-3 space-y-2">
            <Campo etiqueta="¿Por qué no se consigue?" ayuda="El vendedor se lo explica al cliente con esto.">
              <AreaTexto autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px]"
                placeholder="Descontinuado; el equivalente es…" />
            </Campo>
            <div className="flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setSinPrecio(false)}>Regresar</Boton>
              <Boton type="button" variante="peligro" disabled={motivo.trim().length < 3} cargando={noSeConsigue.isPending}
                onClick={() => noSeConsigue.mutate(undefined)}><Ban className="h-4 w-4" />Avisar que no se consigue</Boton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Boton type="button" variante="fantasma" className="text-peligro" onClick={() => setSinPrecio(true)}><Ban className="h-4 w-4" />No se consigue…</Boton>
            <Boton type="submit" cargando={contestar.isPending}><Check className="h-4 w-4" />Contestar <kbd className="ml-1 text-[10px] opacity-75">Enter</kbd></Boton>
          </div>
        )}
      </form>
    </div>
  );
}
