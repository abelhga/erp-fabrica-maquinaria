// Las llamadas que manda el conmutador con IA (función «telefono»): en la ficha del cliente, en el
// lead y, las que nadie contestó, en «Regresar llamada». Quién ve cuál lo decide la base (RLS de
// llamadas): el dueño, quien la atendió, la gerencia y, si no son de nadie, recepción. La calificación
// de coaching va aparte (llamada_coaching, con su propia RLS): el dueño del cliente ve la llamada que
// atendió otro vendedor, pero no su calificación. Por eso nunca sale de llamadas.datos.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, Check, Headphones, PhoneCall, PhoneMissed, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto } from "@/components/ui/campo";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { fechaYHora, hace, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

export interface Llamada {
  id: string; telefono: string | null; inicio: string | null; creado_en: string; duracion_seg: number | null;
  area_nombre: string | null; atendio_nombre: string | null; atendio_ia: string | null; nadie_contesto: boolean;
  resumen: string | null; grabacion_url: string | null; grabacion_vence: string | null;
  regresada_en: string | null; regresada_como: "regresada" | "intento" | "volvio_a_llamar" | null; regresada_nota: string | null;
  atendio: { nombre: string } | null; regreso: { nombre: string } | null;
}
export const CLAVE_LLAMADAS = ["llamadas"] as const;

/** «4 min 12 s», «45 s». */
export function duracion(seg: number | null | undefined) {
  if (seg == null) return null;
  const m = Math.floor(seg / 60), s = seg % 60;
  return m ? `${m} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

/** El enlace firmado del conmutador vence (un mes): después ya no se ofrece. */
export const grabacionVigente = (l: Pick<Llamada, "grabacion_url" | "grabacion_vence">) =>
  !!l.grabacion_url && (!l.grabacion_vence || new Date(l.grabacion_vence).getTime() > Date.now());

/** Las llamadas de un cliente o de un lead, la más nueva primero. */
export function useLlamadas(filtro: { cliente?: string; lead?: string }) {
  const clave = [...CLAVE_LLAMADAS, filtro.cliente ?? null, filtro.lead ?? null];
  useTiempoReal("llamadas", [clave]);
  return useQuery({
    queryKey: clave, enabled: !!(filtro.cliente || filtro.lead),
    queryFn: () => {
      let c = supabase.from("llamadas").select("id, telefono, inicio, creado_en, duracion_seg, area_nombre, atendio_nombre, atendio_ia, nadie_contesto, resumen, grabacion_url, grabacion_vence, regresada_en, regresada_como, regresada_nota, atendio:perfiles!llamadas_atendio_perfil_fkey(nombre), regreso:perfiles!llamadas_regresada_por_fkey(nombre)");
      c = filtro.cliente ? c.eq("cliente_id", filtro.cliente) : c.eq("lead_id", filtro.lead!);
      return q<Llamada[]>(c.order("inicio", { ascending: false, nullsFirst: false }).limit(50).returns<Llamada[]>());
    },
  });
}

/** El tono de una calificación de coaching (1 a 10), el mismo en la ficha y en «Coaching». */
export const tonoCalificacion = (v: number): Tono => (v >= 8 ? "ok" : v >= 6 ? "marca" : "aviso");

/** Las calificaciones de coaching de estas llamadas que el usuario puede ver: la RLS de llamada_coaching
 *  deja solo las que atendió él (o todas a la gerencia de ventas y dirección); las demás no llegan. */
export function useCalificaciones(ids: string[]) {
  useTiempoReal("llamada_coaching", [["calificaciones_llamadas"]]);
  return useQuery({
    queryKey: ["calificaciones_llamadas", ids], enabled: ids.length > 0,
    queryFn: () => q<{ llamada_id: string; calificacion: number }[]>(supabase.from("llamada_coaching").select("llamada_id, calificacion").in("llamada_id", ids)),
    select: (r) => new Map(r.map((x) => [x.llamada_id, Number(x.calificacion)])),
  });
}

/** Una llamada en una línea: cuándo, quién la atendió (o nadie), cuánto duró, el resumen y la grabación. */
export function FilaLlamada({ l, calificacion }: { l: Llamada; calificacion?: number }) {
  const quien = l.atendio?.nombre ?? l.atendio_nombre;
  const d = duracion(l.duracion_seg);
  return (
    <li className="py-2.5 flex gap-3 text-sm">
      <span className={l.nadie_contesto ? "text-aviso mt-0.5" : "text-tenue mt-0.5"}>
        {l.nadie_contesto ? <PhoneMissed className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{fechaYHora(l.inicio ?? l.creado_en)}</span>
          {l.nadie_contesto ? (
            <span data-explain={GLOSARIO.nadieContesto} data-explain-title="Nadie contestó"><Insignia tono="aviso">Nadie contestó</Insignia></span>
          ) : quien ? <span>Atendió <b className="font-medium">{quien}</b></span>
            : l.atendio_ia ? <span className="inline-flex items-center gap-1 text-tenue"><Bot className="h-3.5 w-3.5" />La atendió la IA ({l.atendio_ia})</span> : null}
          {d && <span className="text-tenue cifra">{d}</span>}
          {calificacion != null && (
            <Link to={`/ventas/coaching?llamada=${l.id}`} data-explain={GLOSARIO.calificacionEnLlamada} data-explain-title="Calificación de coaching"
              className="inline-flex" aria-label={`Calificación de coaching: ${numero(calificacion)} de 10`}>
              <Insignia tono={tonoCalificacion(calificacion)} className="cifra hover:underline">{numero(calificacion)} de 10</Insignia>
            </Link>
          )}
          {l.area_nombre && <span className="text-tenue">· {l.area_nombre}</span>}
        </p>
        {l.resumen && <p className="break-words">{l.resumen}</p>}
        {l.nadie_contesto && l.regresada_en && (
          <p className="text-xs text-tenue">{l.regresada_como === "volvio_a_llamar" ? "Volvió a llamar y lo atendieron" : `Se la regresó ${l.regreso?.nombre ?? "alguien"}`} {hace(l.regresada_en)}
            {l.regresada_nota ? `: ${l.regresada_nota}` : ""}</p>
        )}
        {grabacionVigente(l) && (
          <a href={l.grabacion_url!} target="_blank" rel="noreferrer" data-explain={GLOSARIO.grabacionLlamada} data-explain-title="Escuchar"
            className="inline-flex items-center gap-1 text-xs text-marca-texto hover:underline"><Headphones className="h-3.5 w-3.5" />Escuchar</a>
        )}
      </div>
    </li>
  );
}

export function ListaLlamadas({ llamadas }: { llamadas: Llamada[] }) {
  const cal = useCalificaciones(llamadas.map((l) => l.id));
  return <ul className="divide-y divide-borde">{llamadas.map((l) => <FilaLlamada key={l.id} l={l} calificacion={cal.data?.get(l.id)} />)}</ul>;
}

// -----------------------------------------------------------------------------
// Regresar llamada
// -----------------------------------------------------------------------------
interface PorRegresar {
  id: string; telefono: string | null; inicio: string; area_nombre: string | null; resumen: string | null; atendio_ia: string | null;
  cliente_id: string | null; cliente_nombre: string | null; lead_id: string | null; lead_nombre: string | null; duenio: string | null;
  grabacion_url: string | null; puede_intento: boolean;
}
const CLAVE_REGRESAR = ["llamadas_por_regresar"] as const;

/** Arriba de «A quién llamar hoy» (y de Leads para recepción): las llamadas que nadie contestó. */
/** `ligar`: el nombre abre el cliente o el lead. Recepción no lee clientes ni los leads que dejó la IA: va sin liga. */
export function RegresarLlamadas({ verDuenio = false, ligar = true }: { verDuenio?: boolean; ligar?: boolean }) {
  useTiempoReal("llamadas", [[...CLAVE_REGRESAR], [...CLAVE_LLAMADAS]]);
  const lista = useQuery({ queryKey: [...CLAVE_REGRESAR], queryFn: () => q<PorRegresar[]>(supabase.rpc("llamadas_por_regresar")) });
  const n = lista.data?.length ?? 0;
  if (!n) return null;
  return (
    <section className="tarjeta border-aviso/40 p-4 space-y-3" data-explain={GLOSARIO.regresarLlamada} data-explain-title="Regresar llamada">
      <h2 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-2 whitespace-nowrap"><PhoneMissed className="h-4 w-4 text-aviso" />Regresar llamada</span>
        <span className="text-sm font-normal text-tenue">{n} {n === 1 ? "llamada que nadie contestó" : "llamadas que nadie contestó"}</span></h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {lista.data!.map((x) => <TarjetaRegresar key={x.id} x={x} verDuenio={verDuenio} ligar={ligar} />)}
      </div>
    </section>
  );
}

function TarjetaRegresar({ x, verDuenio, ligar }: { x: PorRegresar; verDuenio: boolean; ligar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const marcar = useAccion((contesto: boolean | null) => q(supabase.rpc("marcar_llamada_regresada", { p_id: x.id, p_nota: nota.trim() || null, p_contesto: contesto })), {
    exito: "Anotado: ya se le regresó la llamada",
    invalidar: [[...CLAVE_REGRESAR], [...CLAVE_LLAMADAS], ["v_leads"], ["actividades"]],
    alTerminar: () => { setAbierto(false); setNota(""); },
  });
  const nombre = x.lead_nombre ?? x.cliente_nombre;
  return (
    <article className="rounded-lg border border-borde bg-superficie p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium break-words">
            {!ligar ? nombre ?? x.telefono ?? "Número desconocido"
              : x.cliente_id && !x.lead_id ? <Link to={`/ventas/clientes/${x.cliente_id}`} className="hover:underline">{nombre}</Link>
              : x.lead_id ? <Link to={`/ventas/leads?id=${x.lead_id}`} className="hover:underline">{nombre}</Link>
              : x.telefono ?? "Número desconocido"}
          </p>
          <p className="text-xs text-tenue">{hace(x.inicio)} · {fechaYHora(x.inicio)}{x.area_nombre ? ` · ${x.area_nombre}` : ""}
            {verDuenio && x.duenio ? ` · de ${x.duenio}` : ""}</p>
        </div>
        {x.telefono && (
          <Boton asChild tamano="sm" variante="secundario" className="shrink-0">
            <a href={`tel:${x.telefono.replace(/[^\d+]/g, "")}`}><PhoneCall className="h-3.5 w-3.5" />{x.telefono}</a>
          </Boton>
        )}
      </div>
      {x.resumen && <p className="text-sm break-words">{x.resumen}</p>}
      {x.grabacion_url && (
        <a href={x.grabacion_url} target="_blank" rel="noreferrer" data-explain={GLOSARIO.grabacionLlamada} data-explain-title="Escuchar"
          className="inline-flex w-fit items-center gap-1 text-xs text-marca-texto hover:underline"><Headphones className="h-3.5 w-3.5" />Escuchar el recado</a>
      )}
      {abierto ? (
        <div className="space-y-2">
          <AreaTexto rows={2} value={nota} onChange={(e) => setNota(e.target.value)} aria-label="Nota" autoFocus
            placeholder={x.puede_intento ? "Si te contestó: qué te dijo (qué busca, para cuándo)" : "Nota (opcional): qué te dijo"} />
          <div className="flex flex-wrap justify-end gap-2">
            <Boton tamano="sm" variante="fantasma" onClick={() => setAbierto(false)}><X className="h-3.5 w-3.5" />Cancelar</Boton>
            {x.puede_intento ? <>
              <Boton tamano="sm" variante="secundario" cargando={marcar.isPending && marcar.variables === false} onClick={() => marcar.mutate(false)}>No contestó</Boton>
              <Boton tamano="sm" disabled={nota.trim().length < 5} cargando={marcar.isPending && marcar.variables === true} onClick={() => marcar.mutate(true)}><Check className="h-3.5 w-3.5" />Contestó</Boton>
            </> : (
              <Boton tamano="sm" cargando={marcar.isPending} onClick={() => marcar.mutate(null)}><Check className="h-3.5 w-3.5" />Guardar</Boton>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-end mt-auto">
          <Boton tamano="sm" onClick={() => setAbierto(true)} data-explain={GLOSARIO.botonYaLeRegrese} data-explain-title="Ya le regresé"><Check className="h-3.5 w-3.5" />Ya le regresé</Boton>
        </div>
      )}
    </article>
  );
}
