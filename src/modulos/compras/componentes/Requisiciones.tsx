import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Factory, ShoppingCart, TrendingDown, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { SelectorProveedor, useTiposCambio, type Moneda, type ProveedorBreve, hace } from "./comun";

interface LineaReq {
  id: string; requisicion_id: string; folio: string; origen: "manual" | "reabasto" | "produccion"; necesaria_para: string | null;
  notas_requisicion: string | null; creado_en: string; solicitante: string | null; articulo_id: string; clave: string; nombre: string;
  unidad: string; es_importado: boolean; cantidad: number; estado: string; op_folio: string | null; proveedor_id: string | null;
  proveedor: string | null; costo: number | null; moneda: Moneda | null; oc_folio: string | null; en_planta: number | null;
}
interface Resultado { ordenes: { id: string; folio: string; proveedor: string }[]; sin_proveedor: { id: string; clave: string; nombre: string }[] }

const ORIGEN = {
  produccion: { texto: "Producción", icono: Factory, tono: "marca" },
  reabasto: { texto: "Reabasto", icono: TrendingDown, tono: "info" },
  manual: { texto: "Manual", icono: ClipboardList, tono: "neutro" },
} as const;

/**
 * Lo que producción y almacén le piden a compras. Se eligen partidas y se
 * convierten en órdenes en borrador, una por proveedor (la base las agrupa y
 * suma el mismo artículo pedido por varias requisiciones).
 */
export function Requisiciones() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const compra = puede("compras", 2);
  const verCostos = puede("costos", 1);
  const tc = useTiposCambio();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [elegirProveedor, setElegirProveedor] = useState(false);
  const [proveedor, setProveedor] = useState<ProveedorBreve | null>(null);

  const datos = useQuery({
    queryKey: ["v_requisicion_lineas", "pendientes"],
    queryFn: () => q<LineaReq[]>(supabase.from("v_requisicion_lineas").select("*").eq("estado", "pendiente")
      .order("necesaria_para", { ascending: true, nullsFirst: false }).order("creado_en").limit(1000)),
  });
  const grupos = useMemo(() => {
    const m = new Map<string, LineaReq[]>();
    for (const l of datos.data ?? []) m.set(l.requisicion_id, [...(m.get(l.requisicion_id) ?? []), l]);
    return [...m.values()];
  }, [datos.data]);

  const elegidas = (datos.data ?? []).filter((l) => sel.has(l.id));
  const sinProv = elegidas.filter((l) => !l.proveedor_id);
  const importe = (l: LineaReq) => (l.costo == null || !tc.data ? 0 : Number(l.costo) * Number(l.cantidad) * tc.data[l.moneda ?? "MXN"]);
  const alternar = (ids: string[], on: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  const crear = useAccion((p: string | null) => q<Resultado>(supabase.rpc("ordenes_desde_requisiciones", { p_lineas: [...sel], p_proveedor: p })), {
    invalidar: [["v_requisicion_lineas"], ["v_ordenes_compra"], ["requisiciones_pendientes_cuenta"], ["indicadores"]],
    alTerminar: (r) => {
      setSel(new Set()); setElegirProveedor(false); setProveedor(null);
      if (r.sin_proveedor.length) toast.warning(`${r.sin_proveedor.length} partida(s) sin proveedor se quedaron pendientes`);
      if (r.ordenes.length === 1) { toast.success(`Se creó ${r.ordenes[0].folio} para ${r.ordenes[0].proveedor}`); ir(`/compras/ordenes/${r.ordenes[0].id}`); }
      else if (r.ordenes.length > 1) { toast.success(`Se crearon ${r.ordenes.length} órdenes en borrador`); ir(`/compras/ordenes?creadas=${r.ordenes.map((o) => o.id).join(",")}`); }
    },
  });
  const cancelar = useAccion((id: string) => q(supabase.from("requisicion_lineas").update({ estado: "cancelada" }).eq("id", id).select("id").single()), {
    exito: "Partida cancelada", invalidar: [["v_requisicion_lineas"], ["requisiciones_pendientes_cuenta"]],
  });

  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (datos.isLoading) return <Cargando />;
  if (!grupos.length) {
    return <div className="tarjeta"><Vacio icono={ClipboardList} titulo="No hay requisiciones pendientes"
      texto="Aquí llegan los faltantes de las órdenes de producción y lo que almacén pide desde el reabasto." /></div>;
  }

  return (
    <div className="space-y-4">
      {sel.size > 0 && (
        <div className="sticky top-2 z-20 tarjeta shadow-lg px-4 py-3 flex flex-wrap items-center gap-3 border-marca/40">
          <p className="text-sm">
            <b className="cifra">{sel.size}</b> partida(s) · {new Set(elegidas.map((l) => l.proveedor_id ?? "—")).size} proveedor(es)
            {verCostos && <> · <span className="cifra">{dinero(elegidas.reduce((s, l) => s + importe(l), 0))}</span> aprox.</>}
            {sinProv.length > 0 && <span className="text-aviso"> · {sinProv.length} sin proveedor</span>}
          </p>
          <div className="ml-auto flex gap-2">
            <Boton variante="fantasma" tamano="sm" onClick={() => setSel(new Set())}>Quitar selección</Boton>
            {compra && <Boton tamano="sm" cargando={crear.isPending} onClick={() => (sinProv.length ? setElegirProveedor(true) : crear.mutate(null))}>
              <ShoppingCart className="h-4 w-4" /> Crear órdenes de compra
            </Boton>}
          </div>
        </div>
      )}

      {grupos.map((g) => {
        const r = g[0];
        const O = ORIGEN[r.origen];
        const todas = g.every((l) => sel.has(l.id));
        const urgente = r.necesaria_para && new Date(r.necesaria_para + "T12:00:00").getTime() - Date.now() < 7 * 86_400_000;
        return (
          <Tarjeta key={r.requisicion_id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b border-borde bg-fondo/50">
              {compra && <input type="checkbox" className="accent-[hsl(var(--marca))]" checked={todas} aria-label={`Elegir ${r.folio}`}
                onChange={(e) => alternar(g.map((l) => l.id), e.target.checked)} />}
              <p className="font-semibold">{r.folio}</p>
              <Insignia tono={O.tono}><O.icono className="h-3 w-3" /> {O.texto}</Insignia>
              {r.notas_requisicion && <p className="text-sm text-tenue truncate max-w-[420px]">{r.notas_requisicion}</p>}
              <p className="ml-auto text-xs text-tenue">
                {r.solicitante ?? "—"} · {hace(r.creado_en)}
                {r.necesaria_para && <> · <span className={cn(urgente && "text-peligro font-medium")}>para el {fecha(r.necesaria_para)}</span></>}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    {compra && <th className="w-8" />}<th>Artículo</th><th className="text-right">Cantidad</th><th className="text-right">En planta</th>
                    <th>Proveedor</th>{verCostos && <th className="text-right">Costo vigente</th>}<th>Para</th>{compra && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {g.map((l) => (
                    <tr key={l.id} className={cn(sel.has(l.id) && "bg-marca-suave/50")}>
                      {compra && <td><input type="checkbox" className="accent-[hsl(var(--marca))]" checked={sel.has(l.id)} aria-label={`Elegir ${l.nombre}`}
                        onChange={(e) => alternar([l.id], e.target.checked)} /></td>}
                      <td className="max-w-[320px]"><p className="truncate" title={l.nombre}>{l.nombre}</p><p className="text-xs text-tenue">{l.clave}{l.es_importado && " · importado"}</p></td>
                      <td className="text-right cifra font-medium whitespace-nowrap">{numero(l.cantidad)} <span className="text-xs text-tenue font-normal">{l.unidad}</span></td>
                      <td className="text-right cifra text-tenue">{numero(l.en_planta ?? 0)}</td>
                      <td className="max-w-[220px]">{l.proveedor ? <p className="truncate text-sm">{l.proveedor}</p>
                        : <span className="inline-flex items-center gap-1 text-xs text-aviso"><AlertTriangle className="h-3.5 w-3.5" /> sin proveedor</span>}</td>
                      {verCostos && <td className="text-right cifra whitespace-nowrap">{l.costo == null ? <span className="text-tenue">—</span> : dinero(l.costo, l.moneda === "USD" ? "USD" : "MXN")}</td>}
                      <td className="text-xs whitespace-nowrap">{l.op_folio ?? <span className="text-tenue">{r.origen === "reabasto" ? "stock" : "—"}</span>}</td>
                      {compra && <td><button className="p-1 rounded text-tenue hover:bg-fondo hover:text-peligro" title="Cancelar esta partida (ya no se necesita)"
                        onClick={() => { if (confirm(`¿Cancelar ${l.nombre} de ${r.folio}? Ya no se comprará.`)) cancelar.mutate(l.id); }}><X className="h-4 w-4" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        );
      })}

      <Dialogo abierto={elegirProveedor} alCambiar={setElegirProveedor} titulo="Partidas sin proveedor"
        descripcion="Ni su costo ni el catálogo dicen a quién se le compran. Elige uno para estas partidas o créalas sin ellas (se quedan pendientes)."
        pie={<>
          <Boton variante="secundario" onClick={() => crear.mutate(null)} cargando={crear.isPending && !proveedor}>Crear sin ellas</Boton>
          <Boton disabled={!proveedor} onClick={() => crear.mutate(proveedor!.id)} cargando={crear.isPending && !!proveedor}>Comprárselas a este proveedor</Boton>
        </>}>
        <ul className="text-sm list-disc pl-5 mb-4">{sinProv.map((l) => <li key={l.id}>{l.nombre} <span className="text-tenue">({numero(l.cantidad)} {l.unidad})</span></li>)}</ul>
        <SelectorProveedor valor={proveedor} alCambiar={setProveedor} />
      </Dialogo>
    </div>
  );
}
