import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { QueryKey } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { hoyISO } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { METODOS, enMoneda, type Moneda } from "./comun";

export interface CobroEditable { id: string; fecha: string; monto: number; metodo: string; referencia: string | null; cfdi_uuid?: string | null }

/**
 * Corregir un cobro mal capturado, o quitarlo. Antes solo se podía borrar (con un botón que no
 * estaba en Cobranza) y volverlo a capturar, sin rastro de por qué: así se vio pagado completo el
 * PED-26-855 con $148,132 cuando el depósito fue de $92,000. Ahora el motivo es obligatorio y queda
 * en el historial del pedido. Lo hace finanzas nivel 2 (la base lo revisa).
 */
export function CorregirCobro({ cobro, moneda, alCerrar, invalidar }: {
  cobro: CobroEditable | null; moneda: Moneda; alCerrar: () => void; invalidar: QueryKey[];
}) {
  const [f, setF] = useState({ fecha: "", monto: "", metodo: "transferencia", referencia: "" });
  const [motivo, setMotivo] = useState("");
  const [quitar, setQuitar] = useState(false);
  useEffect(() => {
    if (cobro) setF({ fecha: cobro.fecha, monto: String(cobro.monto), metodo: cobro.metodo, referencia: cobro.referencia ?? "" });
    setMotivo(""); setQuitar(false);
  }, [cobro]);
  const todo = [...invalidar, ["pedido_historial"]];
  const guardar = useAccion(() => q(supabase.rpc("corregir_cobro", {
    p_cobro: cobro!.id, p_monto: Number(f.monto), p_fecha: f.fecha, p_metodo: f.metodo, p_referencia: f.referencia.trim() || null, p_motivo: motivo.trim(),
  })), { exito: "Cobro corregido", invalidar: todo, alTerminar: alCerrar });
  const borrar = useAccion(() => q(supabase.rpc("quitar_cobro", { p_cobro: cobro!.id, p_motivo: motivo.trim() })),
    { exito: "Cobro quitado del pedido", invalidar: todo, alTerminar: alCerrar });
  const deComplemento = !!cobro?.cfdi_uuid;
  const motivoOk = motivo.trim().length >= 5;
  return (
    <Dialogo abierto={!!cobro} alCambiar={(v) => !v && alCerrar()} sobreLateral
      titulo={quitar ? "Quitar cobro" : "Corregir cobro"}
      descripcion={cobro && `Capturado: ${enMoneda(Number(cobro.monto), moneda)}. Lo que cambies y por qué queda en el historial del pedido.`}
      pie={<>
        {quitar
          ? <Boton variante="peligro" onClick={() => borrar.mutate(undefined)} cargando={borrar.isPending} disabled={!motivoOk}>Sí, quitarlo</Boton>
          : <Boton variante="fantasma" className="mr-auto text-peligro" data-explain={GLOSARIO.quitarCobro} data-explain-title="Quitar cobro" onClick={() => setQuitar(true)}><Trash2 className="h-4 w-4" />Quitar cobro</Boton>}
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        {!quitar && <Boton type="submit" form="corregir-cobro" cargando={guardar.isPending} disabled={deComplemento || !motivoOk || !(Number(f.monto) > 0) || !f.fecha}>Guardar</Boton>}
      </>}>
      <form id="corregir-cobro" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!quitar && !deComplemento && motivoOk) guardar.mutate(undefined); }}>
        {quitar
          ? <p className="sm:col-span-2 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">Se quita del pedido y el saldo sube otra vez. En el historial queda cómo se había capturado.</p>
          : deComplemento
            ? <p className="sm:col-span-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm">Este cobro salió de un complemento de pago: el monto y la fecha son los del CFDI. Si está mal, quítalo y vuelve a subir el complemento correcto.</p>
            : <>
                <Campo etiqueta={`Monto (${moneda})`}>
                  <Entrada type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" autoFocus required />
                </Campo>
                <Campo etiqueta="Fecha del pago"><Entrada type="date" max={hoyISO()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required /></Campo>
                <Campo etiqueta="Forma de pago">
                  <Seleccion value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>{METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}</Seleccion>
                </Campo>
                <Campo etiqueta="Referencia"><Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, folio de depósito…" /></Campo>
              </>}
        <Campo etiqueta={quitar ? "¿Por qué se quita?" : "¿Qué se corrigió?"} className="sm:col-span-2" ayuda="Obligatorio. Lo ven quienes ven el pedido.">
          <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} autoFocus={quitar || deComplemento}
            placeholder={quitar ? "Ej. era de otro pedido, se capturó dos veces" : "Ej. me equivoqué de monto: el depósito fue de $92,000"} />
        </Campo>
      </form>
    </Dialogo>
  );
}
