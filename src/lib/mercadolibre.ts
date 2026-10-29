// Llamadas a la función de borde "mercadolibre" (la que tiene los tokens de ML).
import { supabase } from "@/lib/supabase";

export const URL_ML = import.meta.env.VITE_MERCADOLIBRE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre`;

export async function llamarML<T = { ok: boolean }>(accion: "iniciar" | "procesar" | "responder" | "desconectar" | "sincronizar" | "publicaciones", cuerpo: object = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`${URL_ML}/${accion}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => { throw new Error("No se pudo hablar con el servidor. ¿Está desplegada la función mercadolibre?"); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`);
  return d as T;
}

export interface EstadoML {
  conectada: boolean; nickname: string | null; conectada_en: string | null; conectada_por: string | null;
  responsable_id: string | null; responsable: string | null;
  /** El que eligió dirección; sin elegir, los avisos van a dirección (responsable_id). */
  responsable_elegido_id: string | null; atienden: { id: string | null; nombre: string; correo: string | null; pendiente: boolean }[];
  /** Invitados que todavía no entran: se pueden elegir para atender ML (solo dirección los recibe). */
  invitados: { correo: string; nombre: string }[];
  /** Si las ventas de ML entran como pedidos. Apagado, solo entran preguntas y reclamos. */
  ventas_activas: boolean;
  avisos_pendientes: number; avisos_con_error: number; ultimo_error: string | null; ultimo_aviso: string | null;
  ventas_30d: number; sin_ligar: number; preguntas_pendientes: number;
}

/** Lo que regresa «Traer lo pendiente»: cuánto encontró en ML y cuánto quedó registrado. */
export interface ResultadoSincronizar {
  cuenta: string | null; publicaciones: number | null;
  preguntas: number; reclamos: number; ventas: number; procesados: number; errores: number;
}
