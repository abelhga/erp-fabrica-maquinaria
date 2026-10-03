import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, Mail, MapPin, MessageCircle, Phone, StickyNote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora } from "@/lib/formato";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { hoyMx, type Actividad, haceCuanto } from "../comun";

const TIPOS = [
  { valor: "llamada", texto: "Llamada", icono: Phone },
  { valor: "whatsapp", texto: "WhatsApp", icono: MessageCircle },
  { valor: "visita", texto: "Visita", icono: MapPin },
  { valor: "correo", texto: "Correo", icono: Mail },
  { valor: "nota", texto: "Nota", icono: StickyNote },
  { valor: "tarea", texto: "Tarea", icono: CalendarClock },
] as const;
const ICONO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.icono])) as Record<Actividad["tipo"], typeof Phone>;

type ActividadCon = Actividad & { usuario: { nombre: string } | null };

/**
 * Bitácora comercial del cliente u oportunidad: lo que hoy son las notas
 * "Observación: …" / "Enterado" de los paneles, pero con fecha, autor y tareas
 * que vencen. Registrar es una línea de texto y Enter.
 */
export function Actividades({ clienteId, oportunidadId, puedeCapturar = true, limite }: {
  clienteId?: string | null; oportunidadId?: string | null; puedeCapturar?: boolean; limite?: number;
}) {
  const clave = ["actividades", clienteId ?? null, oportunidadId ?? null];
  const lista = useQuery({
    queryKey: clave,
    queryFn: () => {
      let c = supabase.from("actividades").select("*, usuario:perfiles(nombre)").order("en", { ascending: false }).limit(limite ?? 100);
      c = oportunidadId ? c.eq("oportunidad_id", oportunidadId) : c.eq("cliente_id", clienteId!);
      return q<ActividadCon[]>(c);
    },
    enabled: !!(clienteId || oportunidadId),
  });
  const [tipo, setTipo] = useState<Actividad["tipo"]>("llamada");
  const [texto, setTexto] = useState("");
  const [vence, setVence] = useState("");

  const registrar = useAccion(
    async () => {
      const esTarea = tipo === "tarea" || !!vence;
      await q(supabase.from("actividades").insert({
        cliente_id: clienteId ?? null, oportunidad_id: oportunidadId ?? null, tipo: esTarea ? "tarea" : tipo,
        descripcion: texto.trim(), vence_en: esTarea ? (vence || hoyMx()) : null,
      }));
    },
    { exito: "Registrado", invalidar: [clave, ["actividades"], ["v_oportunidades"], ["indicadores"]], alTerminar: () => { setTexto(""); setVence(""); } },
  );
  const marcar = useAccion(
    (a: { id: string; hecha: boolean }) => q(supabase.from("actividades").update({ hecha: a.hecha }).eq("id", a.id)),
    { invalidar: [clave, ["v_oportunidades"], ["indicadores"]] },
  );

  const pendientes = (lista.data ?? []).filter((a) => a.tipo === "tarea" && !a.hecha).sort((a, b) => (a.vence_en ?? "").localeCompare(b.vence_en ?? ""));
  const historia = (lista.data ?? []).filter((a) => !(a.tipo === "tarea" && !a.hecha));
  const hoy = hoyMx();

  return (
    <div className="space-y-4">
      {puedeCapturar && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) registrar.mutate(undefined); }}>
          <div className="flex flex-wrap gap-1">
            {TIPOS.map((t) => (
              <button key={t.valor} type="button" onClick={() => setTipo(t.valor)}
                className={cn("inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-medium border transition",
                  tipo === t.valor ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>
                <t.icono className="h-3.5 w-3.5" />{t.texto}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="campo flex-1" value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={tipo === "tarea" ? "¿Qué hay que hacer? (p. ej. llamar para cerrar)" : "¿Qué pasó? Enter para guardar"} />
            {(tipo === "tarea" || vence) && (
              <input type="date" className="campo sm:w-40" value={vence || ""} min={hoy} onChange={(e) => setVence(e.target.value)} aria-label="Vence" />
            )}
            <Boton type="submit" disabled={!texto.trim()} cargando={registrar.isPending}>Registrar</Boton>
          </div>
          {tipo !== "tarea" && !vence && (
            <button type="button" className="text-xs text-marca-texto" onClick={() => setVence(hoy)}>+ agregar seguimiento con fecha</button>
          )}
        </form>
      )}

      {lista.isLoading ? <Cargando filas={3} /> : (
        <>
          {pendientes.length > 0 && (
            <div className="space-y-1.5">
              <p className="etiqueta">Pendientes</p>
              {pendientes.map((a) => {
                const vencida = (a.vence_en ?? "") < hoy;
                return (
                  <div key={a.id} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", vencida ? "border-peligro/30 bg-peligro-suave" : "border-borde")}>
                    <button onClick={() => marcar.mutate({ id: a.id, hecha: true })} disabled={!puedeCapturar}
                      className="mt-0.5 h-4 w-4 rounded border border-borde bg-superficie shrink-0 hover:border-ok" aria-label="Marcar como hecha" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.descripcion}</p>
                      <p className={cn("text-xs", vencida ? "text-peligro font-medium" : "text-tenue")}>
                        {vencida ? "Venció" : "Vence"} {a.vence_en === hoy ? "hoy" : fecha(a.vence_en)}{a.usuario ? ` · ${a.usuario.nombre}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {historia.length === 0 && pendientes.length === 0 ? (
            <p className="text-sm text-tenue py-4 text-center">Sin actividad registrada. Anota la primera llamada o visita.</p>
          ) : (
            <ol className="relative border-l border-borde ml-2 space-y-3">
              {historia.map((a) => {
                const I = ICONO[a.tipo];
                return (
                  <li key={a.id} className="ml-4">
                    <span className="absolute -left-[11px] mt-0.5 h-5 w-5 rounded-full bg-superficie border border-borde flex items-center justify-center">
                      {a.hecha && a.tipo === "tarea" ? <Check className="h-3 w-3 text-ok" /> : <I className="h-3 w-3 text-tenue" />}
                    </span>
                    <p className={cn("text-sm", a.hecha && a.tipo === "tarea" && "line-through text-tenue")}>{a.descripcion}</p>
                    <p className="text-xs text-tenue" title={fechaYHora(a.en)}>
                      {haceCuanto(a.en)}{a.usuario ? ` · ${a.usuario.nombre}` : ""}
                      {a.tipo === "tarea" && a.hecha && <> · <Insignia tono="ok" className="py-0">hecha</Insignia></>}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
