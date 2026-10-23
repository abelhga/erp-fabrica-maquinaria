import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { limpiarUuid, uuidValido } from "@/lib/cfdi";
import type { QueryKey } from "@tanstack/react-query";

export interface FacturaEditable { id: string; folio: string; uuid_sat: string | null; fecha: string; total: number }

/**
 * Corregir una factura ya registrada (agregarle el UUID, arreglar la fecha o el total) o
 * quitarla si se registró por error. Antes no había cómo, y la única salida era registrarla
 * otra vez: así quedó facturado dos veces el PED-26-784. Escribe finanzas nivel 2 (la base).
 */
export function EditarFactura({ factura, alCerrar, invalidar }: { factura: FacturaEditable | null; alCerrar: () => void; invalidar: QueryKey[] }) {
  const [f, setF] = useState({ folio: "", uuid: "", fecha: "", total: "" });
  const [quitar, setQuitar] = useState(false);
  useEffect(() => {
    if (factura) setF({ folio: factura.folio, uuid: factura.uuid_sat ?? "", fecha: factura.fecha, total: String(factura.total) });
    setQuitar(false);
  }, [factura]);
  const guardar = useAccion(() => q(supabase.from("facturas").update({
    folio: f.folio.trim(), uuid_sat: f.uuid.trim() || null, fecha: f.fecha, total: Number(f.total),
  }).eq("id", factura!.id)), { exito: `Factura ${f.folio} corregida`, invalidar, alTerminar: alCerrar });
  const borrar = useAccion(() => q(supabase.from("facturas").delete().eq("id", factura!.id)),
    { exito: `Factura ${factura?.folio ?? ""} quitada del pedido`, invalidar, alTerminar: alCerrar });
  return (
    <Dialogo abierto={!!factura} alCambiar={(v) => !v && alCerrar()} titulo={`Corregir factura ${factura?.folio ?? ""}`}
      descripcion="Para agregarle el UUID o arreglar un dato. Si se registró por error, quítala."
      pie={<>
        {quitar
          ? <Boton variante="peligro" onClick={() => borrar.mutate(undefined)} cargando={borrar.isPending}>Sí, quitarla</Boton>
          : <Boton variante="fantasma" className="mr-auto text-peligro" onClick={() => setQuitar(true)}><Trash2 className="h-4 w-4" />Quitar factura</Boton>}
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="editar-factura" cargando={guardar.isPending} disabled={!f.folio.trim() || !(Number(f.total) > 0)}>Guardar</Boton>
      </>}>
      <form id="editar-factura" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
        {quitar && <p className="sm:col-span-2 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">Se quita del pedido y deja de contar como facturado. Queda en la bitácora.</p>}
        <Campo etiqueta="Folio"><Entrada value={f.folio} onChange={(e) => setF({ ...f, folio: e.target.value })} required /></Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required /></Campo>
        <Campo etiqueta="UUID del SAT" className="sm:col-span-2" ayuda="Pégalo del XML o del PDF; los guiones y espacios raros se limpian solos."
          error={f.uuid && !uuidValido(f.uuid) ? "Son 36 caracteres: 8-4-4-4-12, números y letras A–F" : undefined}>
          <Entrada value={f.uuid} onChange={(e) => setF({ ...f, uuid: limpiarUuid(e.target.value) })} className="font-mono" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" />
        </Campo>
        <Campo etiqueta="Total con IVA">
          <Entrada type="number" step="0.01" min="0" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} className="cifra" required />
        </Campo>
      </form>
    </Dialogo>
  );
}
