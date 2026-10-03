import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import { CLAVE, CONCEPTOS, type Costo } from "../datos";

const RAPIDOS = ["Hospedaje", "Comidas", "Gasolina y casetas", "Pasajes"];
const EJEMPLO: Record<Costo["concepto"], string> = {
  viaticos: "Hospedaje 2 noches × 3 personas", material: "", servicio_externo: "Rebobinado del motor en taller externo",
  mano_obra: "Técnico externo, 6 h", otro: "Descripción",
};

/**
 * Viáticos y costos de un servicio u orden de mantenimiento. La tabla tiene su
 * propia RLS: ventas, el taller y almacén no reciben ninguna fila; la gerencia ve
 * y captura viáticos y servicios externos; el costo de las refacciones de almacén
 * solo llega a quien tiene "costos".
 */
export function Costos({ servicioId, mantenimientoId, conceptos }: {
  servicioId?: string; mantenimientoId?: string; conceptos: Costo["concepto"][];
}) {
  const { puede } = useSesion();
  const capturar = puede("servicio", 3);
  const lista = useQuery({
    queryKey: [...CLAVE, "costos", servicioId ?? mantenimientoId],
    queryFn: () => {
      let c = supabase.from("costos_servicio").select("id, servicio_id, mantenimiento_id, concepto, descripcion, monto, en");
      c = servicioId ? c.eq("servicio_id", servicioId) : c.eq("mantenimiento_id", mantenimientoId!);
      return q<Costo[]>(c.order("en"));
    },
  });
  const [concepto, setConcepto] = useState<Costo["concepto"]>(conceptos[0]);
  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const alta = useAccion(() => q(supabase.from("costos_servicio").insert({
    servicio_id: servicioId ?? null, mantenimiento_id: mantenimientoId ?? null, concepto, descripcion: desc.trim(), monto: Number(monto),
  })), { exito: "Costo registrado", invalidar: [CLAVE], alTerminar: () => { setDesc(""); setMonto(""); } });
  const baja = useAccion((id: number) => q(supabase.from("costos_servicio").delete().eq("id", id)), { invalidar: [CLAVE] });
  const filas = lista.data ?? [];
  const total = filas.reduce((s, c) => s + Number(c.monto), 0);

  return (
    <div className="space-y-3">
      {filas.length === 0 ? <p className="text-sm text-tenue">{capturar ? "Sin costos registrados. Anótalos aquí para saber cuánto cuesta de verdad." : "Sin costos que puedas ver."}</p> : (
        <table className="tabla">
          <tbody>
            {filas.map((c) => (
              <tr key={c.id}>
                <td><p className="leading-tight">{c.descripcion}</p><p className="text-[11px] text-tenue">{CONCEPTOS[c.concepto]} · {fecha(c.en)}</p></td>
                <td className="text-right cifra whitespace-nowrap">{dinero(c.monto)}</td>
                <td className="w-8">{capturar && c.concepto !== "material" && (
                  <Boton variante="fantasma" tamano="icono" onClick={() => baja.mutate(c.id)} aria-label={`Quitar ${c.descripcion}`}><Trash2 className="h-4 w-4" /></Boton>
                )}</td>
              </tr>
            ))}
            <tr className="font-semibold"><td>Total</td><td className="text-right cifra">{dinero(total)}</td><td /></tr>
          </tbody>
        </table>
      )}
      {capturar && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (desc.trim() && Number(monto) >= 0 && monto !== "") alta.mutate(); }}>
          {concepto === "viaticos" && (
            <div className="flex flex-wrap gap-1">
              {RAPIDOS.map((r) => (
                <button key={r} type="button" onClick={() => setDesc(r)} className="h-7 rounded-full border border-borde px-2.5 text-xs text-tenue hover:text-texto hover:bg-fondo">{r}</button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {conceptos.length > 1 && (
              <Seleccion className="w-auto" value={concepto} onChange={(e) => setConcepto(e.target.value as Costo["concepto"])} aria-label="Concepto">
                {conceptos.map((c) => <option key={c} value={c}>{CONCEPTOS[c]}</option>)}
              </Seleccion>
            )}
            <Entrada className="flex-1 min-w-[160px]" placeholder={EJEMPLO[concepto]} value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Descripción del costo" />
            <Entrada className="w-28" type="number" min="0" step="0.01" placeholder="$" value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Monto" />
            <Boton type="submit" variante="secundario" cargando={alta.isPending} disabled={!desc.trim() || monto === ""}>Agregar</Boton>
          </div>
        </form>
      )}
    </div>
  );
}
