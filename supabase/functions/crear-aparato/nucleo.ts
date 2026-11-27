// Cuenta de aparato (la TV del taller o la tablet de la terminal) ya confirmada, sin correo.
//
// Por qué: se creaba con signUp desde el navegador, y Supabase manda un correo de confirmación
// a cada cuenta nueva. Su servidor de correo deja mandar 2 por hora («email rate limit
// exceeded» a la tercera) y el buzón terminal.…@hegamex.com ni existe: la tablet se quedaba
// sin poder entrar hasta que alguien confirmara un correo que nadie recibe.
//
// Orden (cada paso solo si el anterior salió bien):
//   1. Con la sesión de quien pide: se guarda la invitación con su rol. La base solo deja a
//      administración (invitaciones_admin), y el disparador de alta le pone ese rol a la cuenta.
//   2. Con la llave de servicio: la cuenta con su contraseña, ya confirmada. Si falla, la
//      invitación se borra para no dejar una a medias.
// Solo hace cuentas de aparato (tv.… o terminal.… del dominio de la empresa, rol pantalla o
// terminal): no sirve para dar de alta personas ni otros roles.
import { createClient } from "@supabase/supabase-js";

export interface Entorno { supabaseUrl: string; supabaseAnonKey: string; serviceKey: string; dominio?: string }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
const ROL = { tv: "pantalla", terminal: "terminal" } as const;

/** Qué se pide, ya revisado; o el error en español. */
export function revisar(cuerpo: unknown, dominio: string):
  { tipo: keyof typeof ROL; nombre: string; correo: string; clave: string } | { error: string } {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const tipo = c.tipo;
  if (tipo !== "tv" && tipo !== "terminal") return { error: "Solo se crean cuentas de TV o de terminal" };
  const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  if (nombre.length < 3) return { error: "Escribe el nombre del aparato" };
  const correo = typeof c.correo === "string" ? c.correo.trim().toLowerCase() : "";
  const patron = new RegExp(`^${tipo}\\.[a-z0-9]+(\\.[a-z0-9]+)*@${dominio.replace(/\./g, "\\.")}$`);
  if (!patron.test(correo)) return { error: `El correo debe ser ${tipo}.algo@${dominio}` };
  const clave = typeof c.clave === "string" ? c.clave : "";
  if (clave.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres" };
  return { tipo, nombre, correo, clave };
}

export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesión" }, 401);

  const yo = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
  const { data: u, error: eu } = await yo.auth.getUser(auth.slice(7));
  if (eu || !u.user) return json({ error: "Sesión no válida" }, 401);

  let cuerpo: unknown;
  try { cuerpo = await req.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }
  const p = revisar(cuerpo, e.dominio ?? "hegamex.com");
  if ("error" in p) return json({ error: p.error }, 400);

  // 1. La invitación, con la sesión de quien pide: la base decide si puede.
  const { error: ei } = await yo.from("invitaciones").insert({ correo: p.correo, nombre: p.nombre, roles: [ROL[p.tipo]] });
  if (ei) {
    const prohibido = ei.code === "42501" || /row-level security/i.test(ei.message);
    return json({ error: prohibido ? "Solo administración crea cuentas de aparatos" : /duplicate|unique/i.test(ei.message) ? "Ya hay una invitación con ese correo" : ei.message }, prohibido ? 403 : 400);
  }

  // 2. La cuenta, ya confirmada: no se manda ningún correo.
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const { error: ec } = await admin.auth.admin.createUser({
    email: p.correo, password: p.clave, email_confirm: true, user_metadata: { full_name: p.nombre },
  });
  if (ec) {
    await yo.from("invitaciones").delete().eq("correo", p.correo);
    return json({ error: /registered|already|exists/i.test(ec.message) ? "Ese correo ya tiene cuenta." : "No se pudo crear la cuenta: " + ec.message }, 400);
  }
  return json({ ok: true });
}
