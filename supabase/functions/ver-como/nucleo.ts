// "Ver como": crea una sesión de otra persona para que dirección o sistemas vean el
// ERP exactamente como ella, en una pestaña aparte y sin poder guardar nada.
//
// Orden (cada paso solo si el anterior salió bien):
//   1. Con la sesión de quien pide: vista_previa_destino() revisa que sea dirección o
//      sistemas, que la otra persona exista, esté activa y no sea dirección/sistemas.
//   2. Con la llave de servicio: un enlace mágico de esa persona, que se canjea aquí
//      mismo. No se manda correo y el enlace nunca sale de la función.
//   3. La sesión se anota en vistas_previas ANTES de entregarla: desde ese momento
//      la base la trata como de solo lectura. Si no se pudo anotar, se cierra y no se
//      entrega (una sesión sin anotar podría guardar a nombre de la otra persona).
import { createClient } from "@supabase/supabase-js";

export interface Entorno { supabaseUrl: string; supabaseAnonKey: string; serviceKey: string }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

/** El session_id que Supabase Auth pone en el token: es lo que la base revisa. */
export function idDeSesion(token: string): string | null {
  const parte = token.split(".")[1];
  if (!parte) return null;
  const b64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
  try { return (JSON.parse(atob(b64)) as { session_id?: string }).session_id ?? null; } catch { return null; }
}

export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesión" }, 401);

  const yo = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
  const { data: u, error: eu } = await yo.auth.getUser(auth.slice(7));
  if (eu || !u.user) return json({ error: "Sesión no válida" }, 401);

  let usuarioId: unknown;
  try { usuarioId = ((await req.json()) as { usuario_id?: unknown }).usuario_id; } catch { return json({ error: "Cuerpo inválido" }, 400); }
  if (typeof usuarioId !== "string" || !UUID.test(usuarioId)) return json({ error: "Falta a quién ver" }, 400);

  // 1. La base decide (y explica en español por qué no).
  const { data: correo, error: ed } = await yo.rpc("vista_previa_destino", { p_usuario: usuarioId });
  if (ed || typeof correo !== "string") return json({ error: ed?.message ?? "No se pudo" }, ed?.code === "42501" ? 403 : 400);

  // 2. La sesión de la otra persona.
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const { data: enlace, error: el } = await admin.auth.admin.generateLink({ type: "magiclink", email: correo });
  if (el || !enlace.properties?.hashed_token) return json({ error: "No se pudo preparar la sesión: " + (el?.message ?? "sin enlace") }, 502);
  const otro = createClient(e.supabaseUrl, e.supabaseAnonKey, sinSesion);
  const { data: s, error: ev } = await otro.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: "magiclink" });
  const sesion = s?.session;
  if (ev || !sesion) return json({ error: "No se pudo abrir la sesión: " + (ev?.message ?? "sin sesión") }, 502);

  // 3. Anotada antes de entregarla, o no se entrega.
  const sessionId = idDeSesion(sesion.access_token);
  const { error: ei } = sessionId
    ? await admin.from("vistas_previas").insert({ session_id: sessionId, usuario_id: usuarioId, abierta_por: u.user.id })
    : { error: { message: "el token no trae session_id" } };
  if (ei) {
    await admin.auth.admin.signOut(sesion.access_token, "local").catch(() => undefined);
    return json({ error: "No se pudo registrar la vista previa: " + ei.message }, 500);
  }
  return json({ access_token: sesion.access_token, refresh_token: sesion.refresh_token, expires_at: sesion.expires_at });
}
