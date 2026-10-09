import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, History, Pencil, StickyNote } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE_EMBARQUES, useEtapas, type Embarque } from "./comun";

interface Evento {
  id: string; tipo: string; fecha: string; detalle: string | null; datos: { antes?: string; despues?: string } | null;
  registrado_en: string; perfiles: { nombre: string } | null;
}

/**
 * Las 29 casillas de la hoja se vuelven fechas reales. Una casilla dice "ya";
 * una fecha dice cuánto tardó cada tramo, que es lo que necesita el reabasto.
 */
export function Etapas({ e }: { e: Embarque }) {
  const { puede } = useSesion();
  const captura = puede("importaciones", 2);
  const etapas = useEtapas();
  const eventos = useQuery({
    queryKey: ["embarque_eventos", e.id],
    queryFn: () => q<Evento[]>(supabase.from("embarque_eventos").select("id, tipo, fecha, detalle, datos, registrado_en, perfiles(nombre)")
      .eq("embarque_id", e.id).order("fecha").order("registrado_en").overrideTypes<Evento[], { merge: false }>()),
  });
  const invalidar = [["embarque_eventos", e.id], CLAVE_EMBARQUES, ["alertas_importacion"], ["embarque", e.id]];
  const registrar = useAccion((x: { tipo: string; fecha: string; detalle?: string }) =>
    q(supabase.rpc("registrar_evento_importacion", { p_embarque: e.id, p_tipo: x.tipo, p_fecha: x.fecha, p_detalle: x.detalle ?? null })),
    { exito: "Fecha registrada", invalidar });
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  if (etapas.isLoading || eventos.isLoading) return <Tarjeta><Cargando /></Tarjeta>;
  const porTipo = new Map((eventos.data ?? []).filter((x) => x.tipo !== "cambio_eta" && x.tipo !== "nota").map((x) => [x.tipo, x]));
  const aplican = (etapas.data ?? []).filter((t) => t.tipo !== "vacio_devuelto" || e.modalidad === "fcl" || e.modalidad === "consolidado");
  const ultima = Math.max(-1, ...aplican.map((t, i) => (porTipo.has(t.tipo) ? i : -1)));
  const historia = (eventos.data ?? []).filter((x) => x.tipo === "cambio_eta" || x.tipo === "nota").reverse();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <Tarjeta>
        <EncabezadoTarjeta titulo="Etapas" descripcion={captura ? "Fecha real de cada paso. Enter guarda; las fechas futuras no se aceptan (para eso está el ETA)." : "Fecha real de cada paso"} />
        <ol className="px-5 pb-5">
          {aplican.map((t, i) => {
            const ev = porTipo.get(t.tipo);
            const siguiente = !ev && i === ultima + 1;
            return (
              <li key={t.tipo} className="relative flex gap-3 pb-4 last:pb-0">
                {i < aplican.length - 1 && <span aria-hidden className={cn("absolute left-[11px] top-6 bottom-0 w-px", ev ? "bg-ok/60" : "bg-borde")} />}
                <span className={cn("relative z-[1] mt-0.5 h-6 w-6 shrink-0 rounded-full grid place-items-center border",
                  ev ? "bg-ok text-white border-ok" : siguiente ? "bg-marca-suave border-marca text-marca" : "bg-superficie border-borde text-tenue")}>
                  {ev ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] cifra">{i + 1}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className={cn("text-sm font-medium", !ev && !siguiente && "text-tenue")}>{t.nombre}</p>
                    {ev && editando !== t.tipo && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="cifra">{fecha(ev.fecha)}</span>
                        {captura && <button className="p-1 rounded text-tenue hover:text-texto hover:bg-fondo" aria-label={`Corregir fecha de ${t.nombre}`}
                          onClick={() => setEditando(t.tipo)}><Pencil className="h-3.5 w-3.5" /></button>}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-tenue">{ev?.detalle ?? t.descripcion}{ev?.perfiles?.nombre ? ` · ${ev.perfiles.nombre}` : ""}</p>
                  {/* Cerrado, lo que no se registró se queda así: solo se corrige lo que ya tiene fecha. */}
                  {captura && (editando === t.tipo || (!ev && e.fase !== "cerrado" && e.fase !== "cancelado" && (siguiente || i <= ultima + 2))) && (
                    <CapturaFecha inicial={ev?.fecha} etiqueta={t.nombre} cargando={registrar.isPending}
                      alGuardar={(f) => registrar.mutate({ tipo: t.tipo, fecha: f }, { onSuccess: () => setEditando(null) })}
                      alCancelar={editando === t.tipo ? () => setEditando(null) : undefined} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Tarjeta>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Historia" descripcion="Cambios de ETA y notas" />
        {captura && (
          <form className="px-5 pb-3 flex gap-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (nota.trim()) registrar.mutate({ tipo: "nota", fecha: hoyISO(), detalle: nota.trim() }, { onSuccess: () => setNota("") }); }}>
            <input className="campo" value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Nota: el agente pide la carta 3.1.8 corregida…" aria-label="Nota" />
            <Boton type="submit" variante="secundario" disabled={!nota.trim()}><StickyNote className="h-4 w-4" /></Boton>
          </form>
        )}
        {historia.length === 0 ? <p className="px-5 pb-5 text-sm text-tenue">Sin cambios de ETA ni notas.</p> : (
          <ul className="divide-y divide-borde border-t border-borde">
            {historia.map((h) => (
              <li key={h.id} className="px-5 py-2.5 text-sm flex gap-2">
                {h.tipo === "cambio_eta" ? <History className="h-4 w-4 text-aviso shrink-0 mt-0.5" /> : <StickyNote className="h-4 w-4 text-tenue shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p>{h.tipo === "cambio_eta" ? `ETA del ${fecha(h.datos?.antes)} al ${fecha(h.datos?.despues)}` : h.detalle}</p>
                  <p className="text-xs text-tenue">{fechaYHora(h.registrado_en)}{h.perfiles?.nombre ? ` · ${h.perfiles.nombre}` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

function CapturaFecha({ inicial, etiqueta, alGuardar, alCancelar, cargando }: {
  inicial?: string; etiqueta: string; alGuardar: (f: string) => void; alCancelar?: () => void; cargando: boolean;
}) {
  const [f, setF] = useState(inicial ?? hoyISO());
  return (
    <form className="mt-1.5 flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); if (f) alGuardar(f); }}>
      <input type="date" className="campo h-8 w-40" value={f} max={hoyISO()} onChange={(ev) => setF(ev.target.value)} aria-label={`Fecha de ${etiqueta}`} />
      <Boton type="submit" tamano="sm" variante="secundario" cargando={cargando}>Registrar</Boton>
      {alCancelar && <Boton type="button" tamano="sm" variante="fantasma" onClick={alCancelar}>Cancelar</Boton>}
    </form>
  );
}
