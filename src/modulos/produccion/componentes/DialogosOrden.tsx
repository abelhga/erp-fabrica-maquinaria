import { useEffect, useState } from "react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE, type MaterialOP } from "./datos";

export interface OrdenBasica {
  id: string; folio: string; numero_serie: string | null; prioridad: number; fecha_compromiso: string | null; notas: string | null;
  articulo_id: string; equipo: string;
}

/** Reprogramar: prioridad, compromiso, serie y notas. Cada cambio queda en la línea de tiempo. */
export function DialogoEditarOrden({ abierto, alCambiar, o }: { abierto: boolean; alCambiar: (v: boolean) => void; o: OrdenBasica }) {
  const [prioridad, setPrioridad] = useState(String(o.prioridad));
  const [fechaC, setFechaC] = useState(o.fecha_compromiso ?? "");
  const [serie, setSerie] = useState(o.numero_serie ?? "");
  const [notas, setNotas] = useState(o.notas ?? "");
  useEffect(() => {
    if (abierto) { setPrioridad(String(o.prioridad)); setFechaC(o.fecha_compromiso ?? ""); setSerie(o.numero_serie ?? ""); setNotas(o.notas ?? ""); }
  }, [abierto, o]);
  const guardar = useAccion(() => q(supabase.rpc("editar_orden", {
    p_op: o.id, p_prioridad: Number(prioridad), p_fecha_compromiso: fechaC || null, p_numero_serie: serie, p_notas: notas,
  })), { exito: "Orden actualizada", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Editar ${o.folio}`} descripcion="Los cambios quedan en la línea de tiempo con tu nombre."
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton form="editar-orden" type="submit" cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="editar-orden" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
        <Campo etiqueta="Prioridad">
          <Seleccion value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="1">Urgente</option><option value="2">Normal</option><option value="3">Baja</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Fecha compromiso">
          <Entrada type="date" value={fechaC} onChange={(e) => setFechaC(e.target.value)} />
        </Campo>
        <Campo etiqueta="Número de serie" className="col-span-2">
          <Entrada value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="BH1012000N345" />
        </Campo>
        <Campo etiqueta="Notas de la orden" className="col-span-2" ayuda="Lo que el taller debe saber: extras del pedido, sustituciones.">
          <AreaTexto value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
      </form>
    </Dialogo>
  );
}

export function DialogoCancelar({ abierto, alCambiar, o }: { abierto: boolean; alCambiar: (v: boolean) => void; o: OrdenBasica }) {
  const [motivo, setMotivo] = useState("");
  const cancelar = useAccion(() => q(supabase.rpc("cancelar_orden", { p_op: o.id, p_motivo: motivo })), {
    exito: `${o.folio} cancelada`, invalidar: [CLAVE], alTerminar: () => alCambiar(false),
  });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Cancelar ${o.folio}`}
             descripcion="Se suelta el material apartado y se cancela lo que se pidió a compras para esta orden. No se puede deshacer."
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>No cancelar</Boton>
               <Boton variante="peligro" onClick={() => cancelar.mutate(undefined)} disabled={motivo.trim().length < 5} cargando={cancelar.isPending}>Cancelar orden</Boton></>}>
      <Campo etiqueta="¿Por qué se cancela?">
        <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="El cliente cambió el pedido a…" />
      </Campo>
    </Dialogo>
  );
}

/**
 * "Son de 14 pulgadas", "DEBE SER 4X3": lo que hoy se queda en una nota de la
 * hoja llega a ingeniería como pendiente, ligado al material y a la orden.
 */
export function DialogoCambioIngenieria({ abierto, alCambiar, o, material }: {
  abierto: boolean; alCambiar: (v: boolean) => void; o: OrdenBasica; material: MaterialOP[];
}) {
  const [articulo, setArticulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  useEffect(() => { if (abierto) { setArticulo(""); setDescripcion(""); } }, [abierto]);
  const enviar = useAccion(() => q(supabase.rpc("solicitar_cambio_bom", {
    p_op: o.id, p_articulo: articulo || null, p_descripcion: descripcion,
  })), { exito: "Solicitud enviada a ingeniería", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Solicitar cambio a ingeniería"
             descripcion="Para corregir la lista de materiales del equipo (no solo de esta orden). Ingeniería la ve como pendiente y la orden registra la respuesta."
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton form="cambio-ing" type="submit" disabled={descripcion.trim().length < 3} cargando={enviar.isPending}>Enviar a ingeniería</Boton></>}>
      <form id="cambio-ing" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (descripcion.trim().length >= 3) enviar.mutate(undefined); }}>
        <Campo etiqueta="¿Sobre qué?">
          <Seleccion value={articulo} onChange={(e) => setArticulo(e.target.value)}>
            <option value="">El equipo en general ({o.equipo})</option>
            {[...material].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((m) => (
              <option key={m.articulo_id} value={m.articulo_id}>{m.nombre}</option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="¿Qué hay que cambiar?">
          <AreaTexto value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Las poleas son de 14", no de 16"' autoFocus />
        </Campo>
      </form>
    </Dialogo>
  );
}
