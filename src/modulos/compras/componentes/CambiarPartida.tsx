import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History } from "lucide-react";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fechaYHora, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import type { LineaOC } from "./tipos";

/**
 * Cambiar una partida de una orden ya enviada (el proveedor y producción acordaron otro artículo,
 * otra cantidad u otro precio). Mismo folio, la orden sube de revisión y queda el antes y el después.
 */
export function DialogoCambiarPartida({ linea, folio, moneda, alCerrar }: {
  linea: LineaOC; folio: string; moneda: "MXN" | "USD"; alCerrar: () => void;
}) {
  const [art, setArt] = useState<{ id: string; clave: string | null; nombre: string } | null>(
    linea.articulo_id ? { id: linea.articulo_id, clave: linea.clave, nombre: linea.nombre } : null);
  const [cantidad, setCantidad] = useState(String(Number(linea.cantidad)));
  const [costo, setCosto] = useState(String(Number(linea.costo_unitario ?? 0)));
  const [motivo, setMotivo] = useState("");
  const cambiar = useAccion(() => q<number>(supabase.rpc("cambiar_partida_oc", {
    p_linea: linea.id, p_articulo: art!.id, p_cantidad: Number(cantidad), p_costo: Number(costo), p_motivo: motivo,
  })), {
    exito: (rev) => `${folio} quedó en la revisión ${rev}: imprímela y mándasela al proveedor`,
    invalidar: [["oc", linea.orden_compra_id], ["oc_lineas", linea.orden_compra_id], ["oc_cambios", linea.orden_compra_id], ["v_ordenes_compra"]],
    alTerminar: alCerrar,
  });
  const valido = art && Number(cantidad) > 0 && Number(costo) >= 0 && costo.trim() !== "" && motivo.trim() !== "";
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Cambiar partida de ${folio}`}
      descripcion="Para lo que ya se acordó con el proveedor. El folio no cambia: la orden sube de revisión y queda el antes y el después."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton form="cambiar-partida" type="submit" disabled={!valido} cargando={cambiar.isPending}>Guardar cambio</Boton>
      </>}>
      <form id="cambiar-partida" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) cambiar.mutate(undefined); }}>
        <p className="text-sm text-tenue">Antes: {numero(linea.cantidad)} × {linea.clave ? `${linea.clave} · ` : ""}{linea.nombre} a {dinero(linea.costo_unitario, moneda)}</p>
        <Campo etiqueta="Artículo">
          <div className="space-y-2">
            {art && <p className="text-sm font-medium">{art.clave ? `${art.clave} · ` : ""}{art.nombre}</p>}
            <BuscadorArticulo placeholder="Cambiar por otro artículo…" mostrarPrecio={false} tipos={["componente", "materia_prima", "servicio"]}
              alElegir={(a) => setArt({ id: a.id, clave: a.clave, nombre: a.nombre })} />
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cantidad"><Entrada type="number" min="0" step="any" className="cifra" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Campo>
          <Campo etiqueta={`Costo unitario (${moneda})`}><Entrada type="number" min="0" step="any" className="cifra" value={costo} onChange={(e) => setCosto(e.target.value)} /></Campo>
        </div>
        <Campo etiqueta="¿Por qué cambia?" ayuda="Quién lo acordó y con quién. Queda en el historial de la orden.">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Producción y el proveedor acordaron el de 30:1…" />
        </Campo>
      </form>
    </Dialogo>
  );
}

interface Cambio {
  id: string; revision: number; motivo: string; en: string; usuario: { nombre: string } | null;
  antes: { clave: string | null; nombre: string; cantidad: number; costo_unitario: number };
  despues: { clave: string | null; nombre: string; cantidad: number; costo_unitario: number };
}

/** Lo que cambió en una orden después de enviarla, revisión por revisión. */
export function HistorialCambiosOC({ ocId, moneda }: { ocId: string; moneda: "MXN" | "USD" }) {
  const cambios = useQuery({
    queryKey: ["oc_cambios", ocId],
    queryFn: () => q<Cambio[]>(supabase.from("oc_cambios").select("id, revision, motivo, en, antes, despues, usuario:perfiles(nombre)")
      .eq("orden_compra_id", ocId).order("en", { ascending: false }).returns<Cambio[]>()),
  });
  if (!cambios.data?.length) return null;
  const parte = (x: Cambio["antes"]) => `${numero(x.cantidad)} × ${x.clave ? `${x.clave} · ` : ""}${x.nombre} a ${dinero(x.costo_unitario, moneda)}`;
  return (
    <Tarjeta className="overflow-hidden">
      <EncabezadoTarjeta titulo="Cambios después de enviarla" descripcion="Cada revisión, con quién la hizo y por qué" explica={GLOSARIO.revisionOC} />
      <ul className="divide-y divide-borde text-sm">
        {cambios.data.map((c) => (
          <li key={c.id} className="px-5 py-3 space-y-1">
            <p className="flex flex-wrap items-center gap-2"><History className="h-3.5 w-3.5 text-tenue" /><b>Rev. {c.revision}</b>
              <span className="text-xs text-tenue">{fechaYHora(c.en)}{c.usuario && ` · ${c.usuario.nombre}`}</span></p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs"><span className="text-tenue line-through">{parte(c.antes)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-tenue" /><span>{parte(c.despues)}</span></p>
            <p className="text-xs text-tenue">{c.motivo}</p>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
