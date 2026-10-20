import { useState } from "react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
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

export interface Ignorada { id: number; motivo: string; marcada_en: string; razon: "repetida" | "cancelada" }

/**
 * Quitar un renglón de la hoja que no debe contar: una compra o un pago capturado de más
 * (aunque la copia esté con otro nombre de proveedor), o una factura que se canceló. No se
 * borra de la hoja: queda tachado con el motivo y se puede deshacer.
 */
export function DialogoNoCuenta({ hojaId, tipo, resumen, alCerrar }: { hojaId: number; tipo: "Compra" | "Pago"; resumen: string; alCerrar: () => void }) {
  const [razon, setRazon] = useState<"repetida" | "cancelada">("repetida");
  const [motivo, setMotivo] = useState("");
  const guardar = useAccion(() => q(supabase.rpc("ignorar_movimiento_hoja", { p_hoja_id: hojaId, p_razon: razon, p_motivo: motivo.trim() })),
    { exito: "Listo: ya no cuenta en el saldo", invalidar: INVALIDAR_PROVEEDORES, alTerminar: alCerrar });
  const opciones = [
    { valor: "repetida" as const, texto: tipo === "Pago" ? "El pago está capturado de más" : "La compra está capturada de más" },
    ...(tipo === "Compra" ? [{ valor: "cancelada" as const, texto: "La factura se canceló" }] : []),
  ];
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Que no cuente" descripcion={resumen}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton cargando={guardar.isPending} disabled={motivo.trim().length < 3} onClick={() => guardar.mutate(undefined)}>Que no cuente</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length >= 3) guardar.mutate(undefined); }}>
        <div className="grid gap-1.5">
          {opciones.map((o) => (
            <label key={o.valor} className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="razon" checked={razon === o.valor} onChange={() => setRazon(o.valor)} />{o.texto}
            </label>
          ))}
        </div>
        <Campo etiqueta="¿Cómo lo comprobaste?">
          <Entrada autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={razon === "cancelada" ? "El proveedor la canceló y la sustituyó por…" : "Ya está en la cuenta de…"} />
        </Campo>
        <p className="text-xs text-tenue">No se borra de la hoja: queda tachado con este motivo y se puede deshacer.</p>
      </form>
    </Dialogo>
  );
}
