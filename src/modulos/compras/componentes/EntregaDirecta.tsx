import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import type { LineaOC } from "./tipos";

/**
 * Partida que el proveedor manda directo al cliente (casi siempre Transbelt). No entra al almacén:
 * al llegar se registra «Entregado directo», que recibe la OC y entrega el pedido en un paso.
 */
export function ControlDirecto({ l, ocId, activa }: { l: LineaOC; ocId: string; activa: boolean }) {
  const { puede } = useSesion();
  const [eligiendo, setEligiendo] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const invalidar = [["oc", ocId], ["oc_lineas", ocId], ["v_ordenes_compra"], ["pedidos_por_surtir"]];
  const quitar = useAccion(() => q(supabase.rpc("oc_linea_directa", { p_linea: l.id, p_pedido_linea: null })), {
    exito: "Ya no va directo al cliente: se recibe en almacén", invalidar,
  });
  const compra = puede("compras", 2);

  if (l.directo_a) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-marca-suave px-2 py-0.5 text-marca-texto"
          data-explain={GLOSARIO.entregaDirectaCliente} data-explain-title="Directo al cliente">
          <Truck className="h-3.5 w-3.5" /> Directo a {l.directo_a}
        </span>
        {activa && puede("inventario", 2) && Number(l.pendiente) > 0 && (
          <Boton tamano="sm" variante="secundario" onClick={() => setEntregando(true)}
            data-explain={GLOSARIO.botonEntregadoDirecto} data-explain-title="Entregado directo">Entregado directo</Boton>
        )}
        {compra && Number(l.recibido) === 0 && (
          <button type="button" className="text-tenue hover:text-peligro" onClick={() => quitar.mutate(undefined)} aria-label="Ya no va directo">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <DialogoEntregado abierto={entregando} alCambiar={setEntregando} l={l} invalidar={invalidar} />
      </div>
    );
  }
  if (!activa || !compra || !l.articulo_id || Number(l.recibido) > 0) return null;
  return (
    <>
      <button type="button" className="mt-1 text-xs text-marca-texto hover:underline" onClick={() => setEligiendo(true)}
        data-explain={GLOSARIO.entregaDirectaCliente} data-explain-title="Va directo a un cliente">
        Va directo a un cliente…
      </button>
      <DialogoElegirPedido abierto={eligiendo} alCambiar={setEligiendo} l={l} invalidar={invalidar} />
    </>
  );
}

function DialogoElegirPedido({ abierto, alCambiar, l, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; l: LineaOC; invalidar: string[][] }) {
  const opciones = useQuery({
    queryKey: ["pedidos_para_directo", l.articulo_id], enabled: abierto,
    queryFn: () => q<{ pedido_linea_id: string; folio: string; cliente: string | null; pendiente: number; fecha_compromiso: string | null }[]>(
      supabase.rpc("pedidos_para_directo", { p_articulo: l.articulo_id })),
  });
  const marcar = useAccion((pl: string) => q(supabase.rpc("oc_linea_directa", { p_linea: l.id, p_pedido_linea: pl })), {
    exito: "Listo: cuando el proveedor entregue, usa «Entregado directo»", invalidar, alTerminar: () => alCambiar(false),
  });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="¿A qué pedido va directo?"
      descripcion={`${l.nombre}: el proveedor lo entrega al cliente y no entra al almacén.`}>
      {opciones.isLoading ? <p className="text-sm text-tenue">Buscando pedidos…</p>
        : !opciones.data?.length ? <p className="text-sm text-tenue">No hay pedidos abiertos con este artículo por entregar.</p>
        : (
          <div className="space-y-2">
            {opciones.data.map((o) => (
              <button key={o.pedido_linea_id} type="button" onClick={() => marcar.mutate(o.pedido_linea_id)}
                className={cn("w-full rounded-lg border border-borde px-3 py-2 text-left hover:bg-fondo")}>
                <p className="text-sm font-medium cifra">{o.folio} <span className="font-normal text-tenue">· {o.cliente}</span></p>
                <p className="text-xs text-tenue">Faltan {numero(o.pendiente)} · {o.fecha_compromiso ? `compromiso ${fecha(o.fecha_compromiso)}` : "sin fecha"}</p>
              </button>
            ))}
          </div>
        )}
    </Dialogo>
  );
}

function DialogoEntregado({ abierto, alCambiar, l, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; l: LineaOC; invalidar: string[][] }) {
  const [cant, setCant] = useState(String(Number(l.pendiente)));
  const [recibio, setRecibio] = useState("");
  const [nota, setNota] = useState("");
  const n = Number(cant.replace(",", "."));
  const listo = n > 0 && recibio.trim().length >= 3;
  const registrar = useAccion(() => q(supabase.rpc("entregado_directo", { p_linea: l.id, p_cantidad: n, p_recibio: recibio.trim(), p_nota: nota.trim() || null })), {
    exito: "Entregado: la orden quedó recibida y el pedido entregado, sin mover el inventario",
    invalidar: [...invalidar, ["v_existencias"], ["oc_recepciones"]], alTerminar: () => alCambiar(false),
  });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Entregado directo al cliente"
      descripcion={`${l.nombre} → ${l.directo_a}. Se recibe la orden y se entrega el pedido en un paso; el inventario no cambia.`}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton form="entregado-directo" type="submit" disabled={!listo} cargando={registrar.isPending}>Registrar entrega</Boton>
      </>}>
      <form id="entregado-directo" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) registrar.mutate(undefined); }}>
        <Campo etiqueta={`Cantidad (${l.unidad})`}><Entrada inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} /></Campo>
        <Campo etiqueta="Quién recibió con el cliente"><Entrada autoFocus value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder="Nombre de quien recibió" /></Campo>
        <Campo etiqueta="Nota (opcional)"><Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Guía, factura del proveedor…" /></Campo>
      </form>
    </Dialogo>
  );
}
