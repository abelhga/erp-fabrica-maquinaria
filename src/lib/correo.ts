// Llamadas a la función de borde "correo" (la que tiene los tokens de Gmail de cada quien).
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const URL_CORREO = import.meta.env.VITE_CORREO_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correo`;

/** Un error del servidor que pide conectar (o reconectar) el Gmail. */
export class ErrorCorreo extends Error { constructor(msg: string, readonly conectar = false) { super(msg); } }

export async function llamarCorreo<T = { ok: boolean }>(accion: "iniciar" | "enviar" | "desconectar", cuerpo: object = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`${URL_CORREO}/${accion}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => { throw new Error("No se pudo hablar con el servidor. ¿Está desplegada la función correo?"); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorCorreo(d.error ?? `El servidor respondió ${r.status}`, !!d.conectar);
  return d as T;
}

export interface MiCorreo { conectado: boolean; correo?: string; conectada_en?: string; error?: string | null; lee?: boolean }

/** Lo que propone la base antes de mandar (y si se puede: si no, la llamada falla con el porqué). */
export interface Preparado {
  folio: string; estado: string; para_nombre: string | null; para: string[]; sugeridos: { nombre: string; correo: string }[];
  asunto: string; archivo: string; ya_enviada: boolean; cliente?: string | null; proveedor?: string | null;
}

/** Va a Google a dar el permiso y regresa a esta misma pantalla. */
export async function conectarGmail() {
  const { url } = await llamarCorreo<{ url: string }>("iniciar", { volver_a: location.pathname + location.search });
  location.assign(url);
}

/** Al regresar de Google la página trae ?correo=conectado (o el error): se avisa una vez y se quita. */
export function useRegresoDeGoogle() {
  const [params, setParams] = useSearchParams();
  const estado = params.get("correo"), detalle = params.get("detalle");
  useEffect(() => {
    if (!estado) return;
    // Con id fijo: si el efecto corre dos veces, sigue siendo un solo aviso.
    if (estado === "conectado") toast.success("Tu Gmail quedó conectado: ya puedes mandar desde el ERP", { id: "regreso-gmail" });
    else toast.error(detalle ?? "No se pudo conectar tu Gmail", { id: "regreso-gmail" });
    setParams((p) => { const q = new URLSearchParams(p); q.delete("correo"); q.delete("detalle"); return q; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
}
