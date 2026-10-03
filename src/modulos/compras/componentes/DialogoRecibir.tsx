import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { nombreCorto, useAlmacenes } from "@/modulos/almacen/componentes/comun";
import type { LineaOC } from "./tipos";

/**
 * Recepción en almacén: cuánto llegó de cada partida y a qué almacén entra.
 * La base no deja recibir más de 10 % arriba de lo pedido, mete la entrada al
 * inventario con el costo de la orden y, si se marca, actualiza el costo del
 * artículo (queda en el historial como "por orden de compra").
 */
export function DialogoRecibir({ abierto, alCambiar, ocId, folio, lineas }: {
  abierto: boolean; alCambiar: (v: boolean) => void; ocId: string; folio: string; lineas: LineaOC[];
}) {
  const almacenes = useAlmacenes();
  const pendientes = lineas.filter((l) => Number(l.pendiente) > 0 && l.articulo_id);
  const [cant, setCant] = useState<Record<string, string>>({});
  const [alm, setAlm] = useState<Record<string, number>>({});
  const [factura, setFactura] = useState("");
  const [actualizar, setActualizar] = useState(true);

  // Al abrir: todo lo pendiente, al almacén preferido de cada artículo (o el primero).
  useEffect(() => {
    if (!abierto || !almacenes.data) return;
    const def = almacenes.data.find((a) => a.disponible_para_planta)?.id ?? almacenes.data[0]?.id;
    setCant(Object.fromEntries(pendientes.map((l) => [l.id, String(Number(l.pendiente))])));
    setAlm(Object.fromEntries(pendientes.map((l) => [l.id, l.almacen_preferido_id ?? def])));
    setFactura("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, almacenes.data]);

  const partidas = pendientes.map((l) => ({ l, n: Number((cant[l.id] ?? "").replace(",", ".")) || 0 })).filter((x) => x.n > 0);
  const recibir = useAccion(() => q(supabase.rpc("recibir_orden_compra", {
    p_oc: ocId, p_factura: factura.trim() || null, p_actualizar_costos: actualizar,
    p_lineas: partidas.map(({ l, n }) => ({ linea_id: l.id, cantidad: n, almacen_id: alm[l.id] })),
  })), {
    exito: `Entraron ${partidas.length} partida(s) de ${folio} al almacén`,
    invalidar: [["oc", ocId], ["oc_lineas", ocId], ["oc_recepciones", ocId], ["v_ordenes_compra"], ["v_existencias"], ["v_precios_compra"], ["reabasto_detalle"]],
    alTerminar: () => alCambiar(false),
  });

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-3xl" titulo={`Recibir ${folio}`}
      descripcion="Captura lo que de verdad llegó. Lo que falte se queda pendiente y la orden queda como recibida en parte."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => recibir.mutate(undefined)} disabled={!partidas.length} cargando={recibir.isPending}>
          <PackageCheck className="h-4 w-4" /> Dar entrada a {partidas.length} partida(s)
        </Boton>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Factura o remisión</span>
            <input className="campo" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="F-12345" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Todo entra a</span>
            <Seleccion value="" onChange={(e) => { const v = Number(e.target.value); if (v) setAlm(Object.fromEntries(pendientes.map((l) => [l.id, v]))); }}>
              <option value="">Elegir para todas…</option>
              {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Seleccion>
          </label>
        </div>

        <div className="rounded-lg border border-borde divide-y divide-borde">
          {pendientes.map((l) => {
            const n = Number((cant[l.id] ?? "").replace(",", ".")) || 0;
            const demas = n > Number(l.pendiente) * 1.1 + 0.0005;
            return (
              <div key={l.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_110px_150px] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={l.nombre}>{l.nombre}</p>
                  <p className="text-xs text-tenue">{l.clave} · pedido {numero(l.cantidad)} · ya llegó {numero(l.recibido)} · faltan <b>{numero(l.pendiente)}</b> {l.unidad}</p>
                  {demas && <p className="text-xs text-peligro">Más de 10 % arriba de lo pendiente: la base no lo deja pasar.</p>}
                </div>
                <input inputMode="decimal" aria-label={`Cantidad recibida de ${l.nombre}`} className={cn("campo text-right cifra", demas && "border-peligro")}
                  value={cant[l.id] ?? ""} onChange={(e) => setCant((c) => ({ ...c, [l.id]: e.target.value.replace(/[^\d.,]/g, "") }))} />
                <Seleccion aria-label="Almacén" value={alm[l.id] ?? ""} onChange={(e) => setAlm((a) => ({ ...a, [l.id]: Number(e.target.value) }))}>
                  {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{nombreCorto(a.nombre)}</option>)}
                </Seleccion>
              </div>
            );
          })}
          {pendientes.length === 0 && <p className="p-4 text-sm text-tenue">No queda nada pendiente de recibir.</p>}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[hsl(var(--marca))]" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />
          <span>
            Actualizar el costo de estos artículos con el precio de esta orden
            <span className="block text-xs text-tenue">Así el costeo de los equipos se mueve con lo que de verdad se pagó. Desmárcalo si el precio fue especial (remate, urgencia).</span>
          </span>
        </label>
      </div>
    </Dialogo>
  );
}
