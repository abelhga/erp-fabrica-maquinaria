import { useEffect, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE, useEtapas, type MaterialOP } from "./datos";

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
 * Cliente ausente, o lo que sea que detenga el equipo sin cancelarlo: la orden sale de la
 * carga del taller y de las atrasadas hasta que se reactive.
 */
export function DialogoEnEspera({ abierto, alCambiar, o }: { abierto: boolean; alCambiar: (v: boolean) => void; o: OrdenBasica }) {
  const [motivo, setMotivo] = useState("Cliente ausente: dio anticipo, se fabrica cuando regrese");
  const poner = useAccion(() => q(supabase.rpc("poner_en_espera", { p_op: o.id, p_motivo: motivo })), {
    exito: `${o.folio} en espera`, invalidar: [CLAVE], alTerminar: () => alCambiar(false),
  });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Poner en espera ${o.folio}`}
             descripcion="Deja de contar en la carga del taller y en los tiempos de entrega, no sale atrasada y no se puede trabajar en la terminal. Lo que estaba en proceso se pausa. Se reactiva con un clic."
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>No</Boton>
               <Boton onClick={() => poner.mutate(undefined)} disabled={motivo.trim().length < 5} cargando={poner.isPending}>Poner en espera</Boton></>}>
      <Campo etiqueta="¿Por qué?">
        <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
      </Campo>
    </Dialogo>
  );
}

/** Reabrir una etapa terminada por error (gerencia): queda pausada y se anota por qué. */
export function DialogoReabrir({ etapa, alCerrar, o }: { etapa: { id: string; etapa: string } | null; alCerrar: () => void; o: OrdenBasica }) {
  const [motivo, setMotivo] = useState("");
  const reabrir = useAccion(() => q(supabase.rpc("reabrir_etapa", { p_operacion: etapa!.id, p_motivo: motivo })), {
    exito: `${etapa?.etapa ?? "La etapa"} de ${o.folio} reabierta`, invalidar: [CLAVE], alTerminar: () => { setMotivo(""); alCerrar(); },
  });
  return (
    <Dialogo abierto={!!etapa} alCambiar={(v) => !v && alCerrar()} titulo={`Reabrir ${etapa?.etapa ?? ""} de ${o.folio}`}
             descripcion="La etapa regresa a pausada: el taller la reanuda en la terminal eligiendo quién la trabaja. Si era la última, la orden deja de estar terminada (y su pedido de estar listo). Queda en la historia de la orden."
             pie={<><Boton variante="secundario" onClick={alCerrar}>No</Boton>
               <Boton onClick={() => reabrir.mutate(undefined)} disabled={motivo.trim().length < 5} cargando={reabrir.isPending}>Reabrir</Boton></>}>
      <Campo etiqueta="¿Por qué?">
        <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se marcó terminada por error; falta soldar la tolva 3…" autoFocus />
      </Campo>
    </Dialogo>
  );
}

/**
 * Soltar una orden de su pedido (gerencia): «Usar» se le dio a la orden equivocada, o el cliente
 * canceló y el equipo tiene que poder venderse a otro. Vuelve a «Para stock» con todo lo que lleva.
 */
export function DialogoRegresarStock({ orden, pedido, alCerrar, invalidar = [] }: {
  orden: { id: string; folio: string } | null; pedido?: string; alCerrar: () => void; invalidar?: QueryKey[];
}) {
  const [motivo, setMotivo] = useState("");
  const regresar = useAccion(() => q(supabase.rpc("regresar_orden_a_stock", { p_op: orden!.id, p_motivo: motivo })), {
    exito: `${orden?.folio ?? "La orden"} regresó a stock`, invalidar: [CLAVE, ...invalidar], alTerminar: () => { setMotivo(""); alCerrar(); },
  });
  return (
    <Dialogo abierto={!!orden} alCambiar={(v) => !v && alCerrar()} titulo={`Regresar ${orden?.folio ?? ""} a stock`}
             descripcion={`Deja de ser ${pedido ? `del pedido ${pedido}` : "de su pedido"} y vuelve a «Para stock» con su avance, su número de serie y el material que ya se le surtió; se le puede dar a otro pedido con «Usar». En el pedido, el equipo vuelve a quedar «Sin orden». Queda en la historia de la orden.`}
             pie={<><Boton variante="secundario" onClick={alCerrar}>No</Boton>
               <Boton onClick={() => regresar.mutate(undefined)} disabled={motivo.trim().length < 5} cargando={regresar.isPending}>Regresar a stock</Boton></>}>
      <Campo etiqueta="¿Por qué?">
        <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se eligió el THOR equivocado; el cliente canceló el pedido…" autoFocus />
      </Campo>
    </Dialogo>
  );
}

/**
 * La etapa que el equipo no trae en el costeo (OP-2026-00010 se terminó sin Detallado). Solo
 * para esta orden: que las siguientes la traigan es de ingeniería, en la ruta del equipo.
 */
export function DialogoAgregarEtapa({ abierto, alCambiar, o, tiene }: {
  abierto: boolean; alCambiar: (v: boolean) => void; o: OrdenBasica & { terminada: boolean; conPedido: boolean }; tiene: number[];
}) {
  const etapas = useEtapas();
  const [etapa, setEtapa] = useState("");
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const faltan = (etapas.data ?? []).filter((e) => !tiene.includes(e.id));
  useEffect(() => { if (abierto) { setEtapa(""); setHoras(""); setMotivo(""); } }, [abierto]);
  const agregar = useAccion(() => q(supabase.rpc("agregar_etapa_orden", {
    p_op: o.id, p_etapa: Number(etapa), p_horas: Number(horas), p_motivo: motivo,
  })), { exito: "Etapa agregada a la orden", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });
  const listo = !!etapa && Number(horas) > 0 && motivo.trim().length >= 5;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Agregar etapa a ${o.folio}`}
             descripcion={`Solo para esta orden: queda pendiente para que el taller la trabaje.${o.terminada ? ` La orden deja de estar terminada${o.conPedido ? " (y su pedido de estar listo)" : ""}.` : ""} Para que las siguientes órdenes de ${o.equipo} ya la traigan, pídele a ingeniería que la agregue a las horas por etapa del equipo.`}
             pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
               <Boton form="agregar-etapa" type="submit" disabled={!listo} cargando={agregar.isPending}>Agregar</Boton></>}>
      <form id="agregar-etapa" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (listo) agregar.mutate(undefined); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Etapa">
            <Seleccion value={etapa} onChange={(e) => setEtapa(e.target.value)} autoFocus>
              <option value="">Elige…</option>
              {faltan.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Horas estimadas">
            <Entrada type="number" min="0.5" step="0.5" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="15" />
          </Campo>
        </div>
        <Campo etiqueta="¿Por qué?">
          <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El equipo no trae Detallado y la orden se terminó al acabar Pintura…" />
        </Campo>
      </form>
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
