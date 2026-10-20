import { useState } from "react";
import { CopyX } from "lucide-react";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { DialogoMotivo } from "@/modulos/ventas/componentes/dialogos";
import { INVALIDAR_PROVEEDORES, type FacturaPendiente } from "./cuentas";

export function InsigniaRepetida() {
  return <span data-explain={GLOSARIO.compraRepetidaHoja} data-explain-title="¿Repetida en la hoja?"><Insignia tono="aviso">¿Repetida en la hoja?</Insignia></span>;
}

/**
 * Una factura de la hoja que parece capturada dos veces (otra igual se pagó). No se "paga":
 * se marca como repetida y deja de contar en el saldo. Se puede deshacer desde Movimientos.
 */
export function BotonRepetida({ factura }: { factura: FacturaPendiente }) {
  const [abierto, setAbierto] = useState(false);
  const marcar = useAccion((motivo: string) => q(supabase.rpc("marcar_compra_repetida", { p_hoja_id: factura.hoja_id, p_motivo: motivo })),
    { exito: "Marcada como repetida: ya no cuenta en el saldo", invalidar: INVALIDAR_PROVEEDORES, alTerminar: () => setAbierto(false) });
  if (!factura.hoja_id) return null;
  return <>
    <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 text-xs text-marca-texto hover:underline">
      <CopyX className="h-3.5 w-3.5" />Estaba repetida</button>
    <DialogoMotivo abierto={abierto} alCambiar={setAbierto} titulo={`Factura ${factura.factura ?? "sin número"} de ${dinero(factura.monto)}`}
      descripcion={<>La del {fecha(factura.fecha)} está dos veces en la hoja y la otra ya se pagó. Al marcarla deja de contar en el saldo; no es un pago y no sale en el historial de pagos.</>}
      etiqueta="¿Cómo lo comprobaste?" sugerencias={["Capturada dos veces en la hoja; se pagó la otra", "El proveedor confirma que no se le debe"]}
      textoBoton="Marcar como repetida" peligro={false} cargando={marcar.isPending} alConfirmar={(m) => marcar.mutate(m)} />
  </>;
}
