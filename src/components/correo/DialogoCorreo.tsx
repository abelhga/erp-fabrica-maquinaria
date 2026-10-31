import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileText, Mail, Plus, Send } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { aBase64 } from "@/lib/pdf";
import { ErrorCorreo, conectarGmail, llamarCorreo, type MiCorreo, type Preparado } from "@/lib/correo";
import { GLOSARIO } from "@/tutorial/glosario";

const separar = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Mandar un documento por correo desde el Gmail de quien lo manda, con su PDF. Antes de abrir
 * la base dice si se puede (freno de seguimientos, OC sin precio…): si no, se explica aquí y
 * no sale nada. Ya mandado, la base lo marca enviado (como «Marcar enviada»).
 */
export function DialogoCorreo({ abierto, alCambiar, tipo, id, cuerpo, generarPdf, alEnviar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; tipo: "cotizacion" | "orden_compra"; id: string;
  /** El mensaje que se propone; recibe a quién va dirigido. */
  cuerpo: (p: Preparado) => string;
  generarPdf: () => Promise<Uint8Array>;
  alEnviar?: () => void;
}) {
  const qc = useQueryClient();
  const cuenta = useQuery({
    queryKey: ["mi_correo"], enabled: abierto,
    queryFn: () => q<MiCorreo>(supabase.rpc("mi_correo")),
  });
  // Sin caché: lo que se puede hoy (el freno, el estado) puede cambiar en cualquier momento.
  const prep = useQuery({
    queryKey: ["correo_preparar", tipo, id], enabled: abierto, staleTime: 0, gcTime: 0, retry: false,
    queryFn: () => q<Preparado>(supabase.rpc("correo_preparar", { p_tipo: tipo, p_id: id })),
  });
  const [para, setPara] = useState("");
  const [cc, setCc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [paso, setPaso] = useState<null | "pdf" | "enviando">(null);
  const [conectando, setConectando] = useState(false);

  useEffect(() => {
    const p = prep.data;
    if (!abierto || !p) return;
    setPara(p.para.join(", "));
    setCc("");
    setAsunto(p.asunto);
    setTexto(cuerpo(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, prep.data]);

  const destinos = separar(para);
  const conectado = cuenta.data?.conectado && !cuenta.data.error;

  async function enviar() {
    try {
      setPaso("pdf");
      const pdf = await generarPdf();
      setPaso("enviando");
      const r = await llamarCorreo<{ de: string; aviso: string | null }>("enviar", {
        tipo, id, para: destinos, cc: separar(cc), asunto, cuerpo: texto, adjunto: { nombre: prep.data?.archivo, base64: aBase64(pdf) },
      });
      toast.success(`Enviado desde ${r.de}`);
      if (r.aviso) toast.warning(r.aviso);
      qc.invalidateQueries();
      alEnviar?.();
      alCambiar(false);
    } catch (e) {
      if (e instanceof ErrorCorreo && e.conectar) qc.invalidateQueries({ queryKey: ["mi_correo"] });
      toast.error(mensajeError(e));
    } finally {
      setPaso(null);
    }
  }

  // Para cambiar de cuenta o quitarle el permiso al ERP (también se le retira en Google).
  async function desconectar() {
    if (!confirm(`¿Desconectar ${cuenta.data?.correo}? Para volver a mandar desde el ERP tendrás que conectarlo otra vez.`)) return;
    try { await llamarCorreo("desconectar"); qc.invalidateQueries({ queryKey: ["mi_correo"] }); toast.success("Gmail desconectado"); }
    catch (e) { toast.error(mensajeError(e)); }
  }

  async function conectar() {
    setConectando(true);
    try { await conectarGmail(); } catch (e) { toast.error(mensajeError(e)); setConectando(false); }
  }

  const bloqueo = prep.error ? mensajeError(prep.error) : null;
  const sugeridos = (prep.data?.sugeridos ?? []).filter((s) => !destinos.map((d) => d.toLowerCase()).includes(s.correo.toLowerCase()));

  return (
    <Dialogo abierto={abierto} alCambiar={(v) => { if (!paso) alCambiar(v); }} ancho="max-w-xl"
      titulo={tipo === "cotizacion" ? "Mandar cotización por correo" : "Mandar orden de compra por correo"}
      descripcion={prep.data ? `${prep.data.folio} va con su PDF adjunto${prep.data.ya_enviada ? "; ya estaba enviada, se manda otra vez." : " y queda como enviada."}` : undefined}
      pie={conectado && !bloqueo ? <>
        <Boton variante="secundario" onClick={() => alCambiar(false)} disabled={!!paso}>Cancelar</Boton>
        <Boton onClick={enviar} cargando={!!paso} disabled={!destinos.length || !asunto.trim() || !prep.data}>
          <Send className="h-4 w-4" />{paso === "pdf" ? "Preparando el PDF…" : paso === "enviando" ? "Enviando…" : "Enviar"}
        </Boton>
      </> : <Boton variante="secundario" onClick={() => alCambiar(false)}>Cerrar</Boton>}>
      {cuenta.isLoading || prep.isLoading ? <Cargando filas={4} /> : bloqueo ? (
        <div className="flex items-start gap-3 rounded-lg border border-peligro/30 bg-peligro-suave px-3 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-peligro mt-0.5 shrink-0" /><p>{bloqueo}</p>
        </div>
      ) : !conectado ? (
        <div className="space-y-3 text-sm" data-explain={GLOSARIO.gmailConectado} data-explain-title="Tu Gmail">
          <p>{cuenta.data?.error
            ? <>Google ya no deja usar <b>{cuenta.data.correo}</b> desde el ERP ({cuenta.data.error.toLowerCase()}). Vuelve a conectarlo.</>
            : <>Para mandar desde el ERP, conecta tu Gmail una vez. El correo sale de tu cuenta, así que las respuestas te llegan a ti, como siempre.</>}</p>
          <Boton onClick={conectar} cargando={conectando}><Mail className="h-4 w-4" />Conectar mi Gmail</Boton>
          <p className="text-xs text-tenue">Google te pedirá permiso para enviar y para leer: leer servirá para ligar al ERP las respuestas a lo que mandes desde aquí.</p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (destinos.length) enviar(); }}>
          <p className="text-xs text-tenue" data-explain={GLOSARIO.gmailConectado} data-explain-title="Tu Gmail">Sale de <b className="text-texto">{cuenta.data!.correo}</b>
            {" · "}<button type="button" className="underline hover:text-texto" onClick={desconectar}>Desconectar</button></p>
          <Campo etiqueta="Para" ayuda={prep.data?.para_nombre ? `${prep.data.para_nombre}${prep.data.para.length ? "" : ": no tiene correo guardado, escríbelo"}` : undefined}>
            <Entrada value={para} onChange={(e) => setPara(e.target.value)} placeholder="correo@cliente.com" autoFocus inputMode="email" />
          </Campo>
          {sugeridos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 -mt-1">
              {sugeridos.map((s) => (
                <button key={s.correo} type="button" onClick={() => setPara((x) => [...separar(x), s.correo].join(", "))}
                        className="inline-flex items-center gap-1 rounded-full border border-borde px-2.5 py-0.5 text-xs hover:bg-fondo">
                  <Plus className="h-3 w-3" />{s.nombre} · {s.correo}
                </button>
              ))}
            </div>
          )}
          <Campo etiqueta="Copia (opcional)"><Entrada value={cc} onChange={(e) => setCc(e.target.value)} inputMode="email" /></Campo>
          <Campo etiqueta="Asunto"><Entrada value={asunto} onChange={(e) => setAsunto(e.target.value)} /></Campo>
          <Campo etiqueta="Mensaje"><AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[160px] text-sm" /></Campo>
          <p className="flex items-center gap-2 text-xs text-tenue"><FileText className="h-3.5 w-3.5" />Adjunto: {prep.data?.archivo}</p>
        </form>
      )}
    </Dialogo>
  );
}
