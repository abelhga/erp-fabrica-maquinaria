import { useState } from "react";
import { useMutation, type QueryKey } from "@tanstack/react-query";
import { Copy, Mail, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { mensajeLead } from "@/lib/asistente";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { enlaceWhatsApp } from "../comun";
import type { Lead } from "./datos";

type Canal = "whatsapp" | "correo";

/**
 * El vendedor dice qué quiere decir (o nada) y la IA escribe el mensaje para ESTE lead. Existe porque
 * a Isaac WhatsApp le bloqueó la cuenta 24 h por mandar casi el mismo texto a todos los leads: el
 * mensaje sale con lo que busca cada quien y distinto a los últimos que mandó. Abrirlo en WhatsApp o
 * en el correo anota «Le escribí» con el texto, que es lo que la IA lee la próxima vez para no repetirse.
 */
export function RedactarLead({ lead: l, alCerrar, invalidar }: { lead: Lead; alCerrar: () => void; invalidar: QueryKey[] }) {
  const [canal, setCanal] = useState<Canal>(l.telefono || !l.correo ? "whatsapp" : "correo");
  const [instruccion, setInstruccion] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const generar = useMutation({
    mutationFn: () => mensajeLead(l.id, canal, instruccion.trim()),
    onSuccess: (r) => { setAsunto(r.asunto ?? ""); setMensaje(r.mensaje ?? ""); },
  });
  const anotar = useAccion((c: Canal) => q(supabase.rpc("registrar_intento_lead", { p_lead: l.id, p_canal: c, p_resultado: "enviado", p_nota: mensaje.trim() })),
    { exito: "Anotado «Le escribí»: cuando te conteste, anota «Contestó»", invalidar, alTerminar: alCerrar });

  const hayMensaje = mensaje.trim().length > 0;
  const cambiarCanal = (c: Canal) => { setCanal(c); setAsunto(""); setMensaje(""); generar.reset(); };

  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo={`Mensaje para ${l.nombre}`} ancho="max-w-xl"
      descripcion={generar.data?.simulado
        ? "Plantilla básica: con la IA conectada, el mensaje se escribe para esta persona."
        : "La IA lo escribe con lo que busca, sus intentos anteriores y lo que le pidas. No inventa precios ni tiempos. Revísalo antes de mandarlo."}
      pie={hayMensaje && (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="secundario" onClick={() => { navigator.clipboard.writeText(mensaje); toast.success("Mensaje copiado"); }}>
            <Copy className="h-4 w-4" />Copiar</Boton>
          {canal === "whatsapp" && l.telefono && (
            <Boton asChild><a href={enlaceWhatsApp(l.telefono, mensaje)} target="_blank" rel="noreferrer" onClick={() => anotar.mutate("whatsapp")}>
              <MessageCircle className="h-4 w-4" />Abrir en WhatsApp</a></Boton>
          )}
          {canal === "correo" && l.correo && (
            <Boton asChild><a href={`mailto:${l.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`} onClick={() => anotar.mutate("correo")}>
              <Mail className="h-4 w-4" />Abrir correo</a></Boton>
          )}
        </div>
      )}>
      <div className="space-y-3">
        {l.telefono && l.correo && (
          <div className="inline-flex rounded-lg border border-borde p-0.5 text-sm">
            {(["whatsapp", "correo"] as const).map((c) => (
              <button key={c} type="button" onClick={() => cambiarCanal(c)}
                className={cn("px-3 h-8 rounded-md", canal === c ? "bg-marca text-white" : "text-tenue hover:text-texto")}>
                {c === "whatsapp" ? "WhatsApp" : "Correo"}
              </button>
            ))}
          </div>
        )}
        <label className="block space-y-1.5" data-explain={GLOSARIO.instruccionIA} data-explain-title="Contexto o instrucción">
          <span className="text-sm font-medium">Contexto o instrucción <span className="font-normal text-tenue">(opcional)</span></span>
          <AreaTexto rows={3} value={instruccion} onChange={(e) => setInstruccion(e.target.value)} maxLength={600}
            placeholder="Ej.: dile que la banda de 6 m está en existencia y que puede venir a verla a planta esta semana"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !generar.isPending) generar.mutate(); }} />
        </label>
        <div className="flex justify-end">
          <Boton variante={hayMensaje ? "secundario" : "primario"} cargando={generar.isPending} onClick={() => generar.mutate()}>
            <Sparkles className="h-4 w-4" />{hayMensaje ? "Volver a generar" : "Generar mensaje"}</Boton>
        </div>
        {generar.isPending && !hayMensaje ? (
          <div className="h-32 rounded-lg bg-fondo animate-pulse grid place-items-center text-sm text-tenue">
            <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Escribiendo…</span>
          </div>
        ) : generar.error ? (
          <p className="text-sm text-peligro">{(generar.error as Error).message}</p>
        ) : hayMensaje && (
          <div className="space-y-2">
            {canal === "correo" && <Entrada value={asunto} onChange={(e) => setAsunto(e.target.value)} aria-label="Asunto" placeholder="Asunto" />}
            <AreaTexto rows={8} value={mensaje} onChange={(e) => setMensaje(e.target.value)} aria-label="Mensaje" className="leading-relaxed" />
            <p className="text-xs text-tenue">Al abrirlo se anota «Le escribí» con este texto. Si le escribes a varios seguidos, deja unos minutos entre uno y otro.</p>
          </div>
        )}
      </div>
    </Dialogo>
  );
}
