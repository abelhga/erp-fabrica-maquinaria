import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookText, Plus, Sparkles, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { respuestaML } from "@/lib/asistente";
import { GLOSARIO } from "@/tutorial/glosario";

interface Rapida { id: string; titulo: string; texto: string }
const CLAVE_RAPIDAS = ["ml_respuestas_rapidas"];

export function useRespuestasRapidas() {
  return useQuery({ queryKey: CLAVE_RAPIDAS, queryFn: () => q<Rapida[]>(supabase.from("ml_respuestas_rapidas").select("id, titulo, texto").order("titulo")), staleTime: 60_000 });
}

/**
 * Sobre la caja de respuesta: Claude sugiere con la ficha del artículo y de la publicación, o se
 * pone una respuesta rápida. Lo que salga queda en la caja para leerlo y corregirlo: nada se manda solo.
 */
export function AyudaRespuesta({ preguntaId, alPoner }: { preguntaId: number; alPoner: (texto: string) => void }) {
  const rapidas = useRespuestasRapidas();
  const [pensando, setPensando] = useState(false);
  const [nota, setNota] = useState<{ usados: string[]; falta: string; simulado?: boolean } | null>(null);
  async function sugerir() {
    setPensando(true);
    try {
      const r = await respuestaML(preguntaId);
      alPoner(r.respuesta);
      setNota({ usados: r.usados, falta: r.falta, simulado: r.simulado });
    } catch (e) { toast.error(mensajeError(e)); } finally { setPensando(false); }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Boton variante="secundario" tamano="sm" onClick={sugerir} cargando={pensando} data-explain={GLOSARIO.respuestaSugeridaML} data-explain-title="Sugerir respuesta">
          <Sparkles className="h-3.5 w-3.5" /> Sugerir respuesta
        </Boton>
        {(rapidas.data?.length ?? 0) > 0 && (
          <select className="campo h-8 w-auto text-xs" value="" aria-label="Respuestas rápidas" onChange={(e) => {
            const r = rapidas.data!.find((x) => x.id === e.target.value); if (r) alPoner(r.texto);
          }}>
            <option value="">Respuesta rápida…</option>
            {rapidas.data!.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
          </select>
        )}
      </div>
      {nota && (
        <div className="text-xs space-y-0.5">
          {nota.usados.length > 0 && <p className="text-tenue">Usó: {nota.usados.join(" · ")}</p>}
          {nota.falta && <p className="text-aviso">Revisa antes de mandar: {nota.falta}</p>}
          {nota.simulado && <p className="text-tenue">Sin IA: es un arranque, complétala.</p>}
        </div>
      )}
    </div>
  );
}

/** Lo que siempre aplica al contestar (lo usa Claude) y las respuestas rápidas. Lo edita quien atiende ML. */
export function DialogoDatosContestar({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const politicas = useQuery({ queryKey: ["politicas_ml"], enabled: abierto, queryFn: () => q<string | null>(supabase.rpc("politicas_ml")) });
  const rapidas = useRespuestasRapidas();
  const [texto, setTexto] = useState("");
  const [nueva, setNueva] = useState({ titulo: "", texto: "" });
  useEffect(() => { if (politicas.data != null) setTexto(politicas.data); }, [politicas.data]);
  const guardar = useAccion(() => q(supabase.rpc("fijar_politicas_ml", { p_texto: texto })), { exito: "Guardado: la IA ya contesta con esto", invalidar: [["politicas_ml"]] });
  const agregar = useAccion(() => q(supabase.from("ml_respuestas_rapidas").insert({ titulo: nueva.titulo.trim(), texto: nueva.texto.trim() })),
    { exito: "Respuesta rápida agregada", invalidar: [CLAVE_RAPIDAS], alTerminar: () => setNueva({ titulo: "", texto: "" }) });
  const quitar = useAccion((id: string) => q(supabase.from("ml_respuestas_rapidas").delete().eq("id", id)), { exito: "Quitada", invalidar: [CLAVE_RAPIDAS] });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Datos para contestar" ancho="max-w-2xl"
      descripcion="Lo que siempre aplica en Mercado Libre. La IA lo toma como la verdad de la empresa al sugerir respuestas.">
      <div className="space-y-5">
        <Campo etiqueta="Lo que siempre aplica" ayuda="Factura, tiempos de envío, garantía, horario, si se hacen medidas especiales… Un dato por renglón.">
          <textarea className="campo min-h-[140px]" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4000}
            placeholder={"Sí facturamos: después de comprar, manda tus datos fiscales por la mensajería de la compra.\nEnviamos el mismo día si compras antes de la 1 pm (lunes a viernes).\nGarantía de 6 meses por defecto de fabricación."} />
        </Campo>
        <div className="flex justify-end"><Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending}>Guardar</Boton></div>

        <div className="space-y-2 border-t border-borde pt-4" data-explain={GLOSARIO.respuestaRapidaML} data-explain-title="Respuestas rápidas">
          <p className="font-medium flex items-center gap-1.5"><BookText className="h-4 w-4" /> Respuestas rápidas</p>
          <ul className="divide-y divide-borde rounded-lg border border-borde">
            {(rapidas.data ?? []).map((r) => (
              <li key={r.id} className="px-3 py-2 text-sm flex gap-2">
                <div className="flex-1 min-w-0"><p className="font-medium">{r.titulo}</p><p className="text-tenue whitespace-pre-line">{r.texto}</p></div>
                <button type="button" className="p-1 text-tenue hover:text-peligro" aria-label={`Quitar ${r.titulo}`} onClick={() => quitar.mutate(r.id)}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {!rapidas.data?.length && <li className="px-3 py-2 text-sm text-tenue">Todavía no hay. Agrega las que más escribes.</li>}
          </ul>
          <form className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto] items-start" onSubmit={(e) => { e.preventDefault(); if (nueva.titulo.trim() && nueva.texto.trim()) agregar.mutate(undefined); }}>
            <Entrada placeholder="Nombre (p. ej. Factura)" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} maxLength={60} />
            <textarea className="campo min-h-[38px]" placeholder="El texto que se pone en la respuesta" value={nueva.texto} onChange={(e) => setNueva({ ...nueva, texto: e.target.value })} maxLength={2000} />
            <Boton type="submit" variante="secundario" disabled={!nueva.titulo.trim() || !nueva.texto.trim()} cargando={agregar.isPending}><Plus className="h-4 w-4" /> Agregar</Boton>
          </form>
        </div>
      </div>
    </Dialogo>
  );
}
