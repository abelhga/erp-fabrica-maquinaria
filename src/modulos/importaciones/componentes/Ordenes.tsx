import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Link2, Printer, Unlink } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, numero } from "@/lib/formato";
import { InsigniaOC, type EstadoOC } from "@/modulos/compras/componentes/comun";
import { CLAVE_EMBARQUES, type Embarque } from "./comun";

interface OCLibre { id: string; folio: string; proveedor: string; estado: EstadoOC; moneda: string; total: number | null; es_importacion: boolean; fecha: string }

/**
 * Las órdenes que viajan en el embarque: un BL trae varias facturas y un
 * consolidado trae varios proveedores. De aquí sale lo que se le debe a cada uno
 * y, al imprimir, la orden y el contrato bilingües que pide el agente aduanal.
 */
export function Ordenes({ e }: { e: Embarque }) {
  const { puede } = useSesion();
  const captura = puede("importaciones", 2);
  const [elegida, setElegida] = useState("");
  const libres = useQuery({
    queryKey: ["oc_para_embarque"], enabled: captura,
    queryFn: () => q<OCLibre[]>(supabase.from("v_ordenes_compra").select("id, folio, proveedor, estado, moneda, total, es_importacion, fecha")
      .in("estado", ["borrador", "enviada", "parcial"]).order("fecha", { ascending: false }).limit(200)),
  });
  const invalidar = [CLAVE_EMBARQUES, ["embarque", e.id], ["v_embarque_dinero"], ["oc_para_embarque"]];
  const ligar = useAccion((oc: string) => q(supabase.from("embarque_oc").insert({ embarque_id: e.id, orden_compra_id: oc })),
    { exito: "Orden ligada al embarque. Si traía IVA quedó en 0: el IVA se paga en el pedimento.", invalidar, alTerminar: () => setElegida("") });
  const quitar = useAccion((oc: string) => q(supabase.from("embarque_oc").delete().eq("embarque_id", e.id).eq("orden_compra_id", oc)),
    { exito: "Orden quitada del embarque", invalidar });
  const cambiar = useAccion(({ oc, cambios }: { oc: string; cambios: Record<string, unknown> }) =>
    q(supabase.from("embarque_oc").update(cambios).eq("embarque_id", e.id).eq("orden_compra_id", oc)), { invalidar });

  const ya = new Set(e.ordenes.map((o) => o.id));
  const opciones = (libres.data ?? []).filter((o) => !ya.has(o.id))
    .sort((a, b) => Number(b.es_importacion || b.moneda !== "MXN") - Number(a.es_importacion || a.moneda !== "MXN"));
  const pideVolumen = e.modalidad === "consolidado" || e.ordenes.length > 1;

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Órdenes de compra" descripcion={pideVolumen
        ? "En un consolidado la logística se reparte por volumen: anota el que da el forwarder por proveedor (m³ o su %)."
        : "La orden con sus partidas es la base del costeo y del tope de pagos."} />
      {e.ordenes.length === 0 ? (
        <Vacio icono={ClipboardList} titulo="Sin órdenes ligadas" texto="Liga la orden de compra en USD del proveedor: de ella salen las partidas, lo que se debe y el costeo." className="py-8" />
      ) : (
        <ul className="divide-y divide-borde border-t border-borde">
          {e.ordenes.map((o) => (
            <li key={o.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                  <Link to={`/compras/ordenes/${o.id}`} className="hover:underline">{o.folio}</Link>
                  <InsigniaOC estado={o.estado as EstadoOC} />
                </p>
                <p className="text-xs text-tenue">{o.proveedor} · {o.moneda} · {fecha(o.fecha)}</p>
              </div>
              <label className="text-xs text-tenue flex items-center gap-2">Factura
                {captura ? <input className="campo h-8 w-36" defaultValue={o.factura ?? ""} key={o.factura ?? ""} placeholder="CI del proveedor"
                  onBlur={(ev) => ev.target.value.trim() !== (o.factura ?? "") && cambiar.mutate({ oc: o.id, cambios: { factura: ev.target.value.trim() || null } })}
                  onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()} />
                  : <span className="text-texto">{o.factura ?? "—"}</span>}
              </label>
              {pideVolumen && (
                <label className="text-xs text-tenue flex items-center gap-2">Volumen
                  {captura ? <input className="campo h-8 w-24 text-right cifra" inputMode="decimal" defaultValue={o.volumen_m3 ?? ""} key={String(o.volumen_m3)}
                    onBlur={(ev) => { const v = ev.target.value.trim() === "" ? null : Number(ev.target.value); if (v !== o.volumen_m3 && (v === null || !Number.isNaN(v))) cambiar.mutate({ oc: o.id, cambios: { volumen_m3: v } }); }}
                    onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()} />
                    : <span className="text-texto cifra">{o.volumen_m3 != null ? numero(o.volumen_m3) : "—"}</span>}
                </label>
              )}
              <div className="flex items-center gap-1 ml-auto">
                {puede("compras", 2) && (
                  <Boton asChild variante="secundario" tamano="sm">
                    <Link to={`/importaciones/oc/${o.id}/imprimir`} target="_blank"><Printer className="h-3.5 w-3.5" /> OC y contrato</Link>
                  </Boton>
                )}
                {captura && <Boton variante="fantasma" tamano="sm" onClick={() => quitar.mutate(o.id)} title="Quitar del embarque"><Unlink className="h-3.5 w-3.5" /></Boton>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {captura && (
        <div className="border-t border-borde px-5 py-3 flex flex-wrap items-center gap-2">
          <Link2 className="h-4 w-4 text-tenue" />
          <select className="campo h-9 max-w-md flex-1" value={elegida} onChange={(ev) => setElegida(ev.target.value)} aria-label="Orden de compra a ligar">
            <option value="">Ligar una orden de compra…</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>{o.folio} · {o.proveedor} · {o.total != null ? dinero(o.total, o.moneda === "USD" ? "USD" : "MXN") : o.moneda}{o.estado === "borrador" ? " (borrador)" : ""}</option>
            ))}
          </select>
          <Boton variante="secundario" disabled={!elegida} cargando={ligar.isPending} onClick={() => ligar.mutate(elegida)}>Ligar</Boton>
          <Boton asChild variante="fantasma"><Link to="/compras/ordenes/nueva">Nueva orden</Link></Boton>
        </div>
      )}
    </Tarjeta>
  );
}
