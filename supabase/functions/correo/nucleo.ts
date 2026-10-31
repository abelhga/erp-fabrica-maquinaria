// Gmail ↔ ERP: cada quien manda la cotización o la orden de compra desde su propio Gmail.
// Rutas (la última parte de la URL):
//   POST iniciar      la persona pide el enlace para darle permiso a su Gmail
//   GET  autorizar    Google regresa aquí con el código; se cambia por los tokens
//   POST enviar       manda el documento con su PDF y lo deja anotado
//   POST desconectar  la persona quita su conexión (y se le retira el permiso en Google)
//
// Reglas:
//   * Un correo que sale no se regresa: antes de mandarlo, correo_preparar() revisa con la
//     sesión de la persona (su RLS, sus reglas) que el documento se puede enviar. Después
//     correo_marcar_enviado() hace el cambio. Lo enviado lo registra esta función (con la llave
//     de servicio): la pantalla no puede inventar un correo que no salió.
//   * Los tokens viven en correo_cuentas y nadie con sesión los lee.
//   * Viendo el ERP como otra persona no se conecta ni se manda nada: saldría de su Gmail.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string; supabaseAnonKey: string; serviceKey: string;
  clientId?: string; clientSecret?: string; appUrl: string;
  /** Para las pruebas: Google falso. */
  fetch?: typeof fetch;
}

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke";
export const GMAIL_ENVIAR = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media";
export const ENVIAR = "https://www.googleapis.com/auth/gmail.send";
export const LEER = "https://www.googleapis.com/auth/gmail.readonly";
// Leer va desde ahora (decisión de dirección) para que la segunda etapa no obligue a reconectar.
export const ALCANCES = ["openid", "email", ENVIAR, LEER];
const MAX_PDF = 15 * 1024 * 1024;
const MAX_DESTINOS = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {});
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

class ErrorGoogle extends Error { constructor(msg: string, readonly status = 0, readonly reconectar = false) { super(msg); } }

// -----------------------------------------------------------------------------
// Armar el correo (MIME). Exportado para probarlo sin Google.
// -----------------------------------------------------------------------------
const CORREO = /^[^\s@<>(),;:"\[\]]+@[^\s@<>(),;:"\[\]]+\.[a-z]{2,}$/i;
export const correoValido = (c: string) => CORREO.test(c) && c.length <= 254;

const utf8 = new TextEncoder();
function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const lineas76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n");
/** Encabezado con acentos («Cotización») en la forma que entienden todos los clientes de correo. */
const encabezado = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${base64(utf8.encode(s))}?=`);
const sinSaltos = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export function armarCorreo(m: {
  de: string; nombre?: string | null; para: string[]; cc?: string[]; asunto: string; cuerpo: string;
  adjunto?: { nombre: string; bytes: Uint8Array } | null; frontera?: string;
}) {
  const f = m.frontera ?? `hegamex-${crypto.randomUUID()}`;
  const nombre = m.nombre ? `${encabezado(sinSaltos(m.nombre).replace(/"/g, ""))} ` : "";
  const cab = [
    `From: ${nombre}<${m.de}>`,
    `To: ${m.para.join(", ")}`,
    ...(m.cc?.length ? [`Cc: ${m.cc.join(", ")}`] : []),
    `Subject: ${encabezado(sinSaltos(m.asunto))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${f}"`,
  ];
  const partes = [
    `--${f}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${lineas76(base64(utf8.encode(m.cuerpo)))}`,
  ];
  if (m.adjunto) {
    const n = sinSaltos(m.adjunto.nombre).replace(/"/g, "");
    partes.push(`--${f}\r\nContent-Type: application/pdf; name="${encabezado(n)}"\r\nContent-Transfer-Encoding: base64\r\n` +
      `Content-Disposition: attachment; filename="${encabezado(n)}"; filename*=UTF-8''${encodeURIComponent(n)}\r\n\r\n${lineas76(base64(m.adjunto.bytes))}`);
  }
  return `${cab.join("\r\n")}\r\n\r\n${partes.join("")}--${f}--\r\n`;
}

/** El correo de quien dio permiso, del id_token que Google entrega junto con los tokens. */
export function correoDelToken(idToken: string | undefined) {
  try {
    const p = idToken?.split(".")[1];
    if (!p) return null;
    const datos = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")));
    return datos.email_verified === false ? null : txt(datos.email);
  } catch { return null; }
}

/** Solo rutas del propio ERP («/ventas/…»): un «volver a» con otro dominio sería una puerta. */
export const rutaSegura = (r: unknown) => (typeof r === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(r) && !r.includes("\\") ? r : "/");

// -----------------------------------------------------------------------------
// Google
// -----------------------------------------------------------------------------
async function pedirToken(e: Entorno, cuerpo: Record<string, string>) {
  const f = e.fetch ?? fetch;
  const r = await f(GOOGLE_TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.clientId!, client_secret: e.clientSecret!, ...cuerpo }),
  });
  const d = o(await r.json().catch(() => ({})));
  if (!r.ok) {
    // invalid_grant: la persona quitó el permiso, cambió su contraseña o el token caducó.
    const reconectar = d.error === "invalid_grant";
    throw new ErrorGoogle(reconectar ? "Google ya no deja usar tu Gmail desde el ERP: vuelve a conectarlo" : `Google: ${txt(d.error_description) ?? txt(d.error) ?? r.status}`, r.status, reconectar);
  }
  return d as { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string };
}

interface Cuenta { usuario_id: string; correo: string; access_token: string | null; refresh_token: string; expira_en: string | null }

async function tokenVigente(e: Entorno, admin: SupabaseClient, c: Cuenta, forzar = false) {
  if (!forzar && c.access_token && c.expira_en && new Date(c.expira_en).getTime() > Date.now() + 60_000) return c.access_token;
  try {
    const t = await pedirToken(e, { grant_type: "refresh_token", refresh_token: c.refresh_token });
    await admin.from("correo_cuentas").update({ access_token: t.access_token, expira_en: new Date(Date.now() + t.expires_in * 1000).toISOString(), error: null, error_en: null })
      .eq("usuario_id", c.usuario_id);
    return t.access_token;
  } catch (err) {
    if (err instanceof ErrorGoogle && err.reconectar) {
      await admin.from("correo_cuentas").update({ error: err.message, error_en: new Date().toISOString(), access_token: null }).eq("usuario_id", c.usuario_id);
    }
    throw err;
  }
}

async function mandarGmail(e: Entorno, admin: SupabaseClient, c: Cuenta, mime: string) {
  const f = e.fetch ?? fetch;
  let token = await tokenVigente(e, admin, c);
  for (let intento = 0; intento < 2; intento++) {
    const r = await f(GMAIL_ENVIAR, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "message/rfc822" }, body: mime });
    const d = o(await r.json().catch(() => ({})));
    if (r.ok) return { id: txt(d.id), hilo: txt(d.threadId) };
    // Un token que Google dio por vencido antes de tiempo: uno nuevo y otra vez.
    if (r.status === 401 && intento === 0) { token = await tokenVigente(e, admin, c, true); continue; }
    const msg = txt(o(d.error).message) ?? String(r.status);
    if (r.status === 403 && /insufficient|scope/i.test(msg)) {
      await admin.from("correo_cuentas").update({ error: "Falta el permiso de enviar", error_en: new Date().toISOString() }).eq("usuario_id", c.usuario_id);
      throw new ErrorGoogle("Tu Gmail no dio permiso de enviar: vuelve a conectarlo y deja marcada la casilla de enviar", 403, true);
    }
    throw new ErrorGoogle(`Gmail no mandó el correo: ${msg}`, r.status);
  }
  throw new ErrorGoogle("Gmail no mandó el correo");
}

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------
async function quien(req: Request, e: Entorno) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
  const { data } = await db.auth.getUser(auth.slice(7));
  return data.user ? { id: data.user.id, correo: data.user.email ?? null, db } : null;
}

export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const accion = url.pathname.split("/").filter(Boolean).pop();
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const redireccion = `${e.supabaseUrl}/functions/v1/correo/autorizar`;

  // Google regresa del permiso.
  if (accion === "autorizar" && req.method === "GET") {
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    const { data: pend } = state ? await admin.from("correo_permisos_pendientes").select("usuario_id, volver_a, creado_en").eq("state", state).maybeSingle() : { data: null };
    if (state) await admin.from("correo_permisos_pendientes").delete().eq("state", state);
    const p = pend as { usuario_id: string; volver_a: string | null; creado_en: string } | null;
    const volver = (estado: string, detalle?: string) => {
      const ruta = rutaSegura(p?.volver_a);
      const sep = ruta.includes("?") ? "&" : "?";
      return Response.redirect(`${e.appUrl}${ruta}${sep}correo=${estado}${detalle ? `&detalle=${encodeURIComponent(detalle.slice(0, 200))}` : ""}`, 302);
    };
    if (url.searchParams.get("error") === "access_denied") return volver("error", "No diste el permiso en Google");
    if (!code || !p) return volver("error", "Google no mandó el código");
    if (Date.now() - new Date(p.creado_en).getTime() > 15 * 60_000) return volver("error", "El enlace ya venció: vuelve a dar clic en Conectar mi Gmail");
    try {
      const t = await pedirToken(e, { grant_type: "authorization_code", code, redirect_uri: redireccion });
      const alcances = (t.scope ?? "").split(/\s+/).filter(Boolean);
      // Google deja quitar casillas al dar permiso: sin «enviar» la conexión no sirve.
      if (!alcances.includes(ENVIAR)) return volver("error", "No quedó marcada la casilla de enviar correos: vuelve a conectar y déjala marcada");
      if (!t.refresh_token) return volver("error", "Google no dio permiso permanente: vuelve a conectar");
      const correo = correoDelToken(t.id_token);
      if (!correo) return volver("error", "Google no dijo de qué cuenta es el permiso");
      const { error } = await admin.from("correo_cuentas").upsert({
        usuario_id: p.usuario_id, correo, access_token: t.access_token, refresh_token: t.refresh_token,
        expira_en: new Date(Date.now() + t.expires_in * 1000).toISOString(), alcances, conectada_en: new Date().toISOString(), error: null, error_en: null,
      });
      if (error) throw new Error(error.message);
      return volver("conectado");
    } catch (err) {
      return volver("error", err instanceof Error ? err.message : String(err));
    }
  }

  if (req.method !== "POST") return json({ error: "Ruta no válida" }, 404);
  const u = await quien(req, e);
  if (!u) return json({ error: "Falta la sesión" }, 401);
  // Viendo como otra persona, todo saldría de su cuenta.
  const { data: vista } = await u.db.rpc("en_vista_previa");
  if (vista === true) return json({ error: "Estás viendo el ERP como otra persona: desde aquí no se conecta ni se manda correo" }, 403);
  const b = o(await req.json().catch(() => ({})));

  if (accion === "iniciar") {
    if (!e.clientId || !e.clientSecret) return json({ error: "Falta configurar Google: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Supabase → Edge Functions → Secrets." }, 400);
    const state = crypto.randomUUID();
    const { error } = await admin.from("correo_permisos_pendientes").insert({ state, usuario_id: u.id, volver_a: rutaSegura(b.volver_a) });
    if (error) return json({ error: error.message }, 500);
    const q = new URLSearchParams({
      client_id: e.clientId, redirect_uri: redireccion, response_type: "code", scope: ALCANCES.join(" "),
      access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, ...(u.correo ? { login_hint: u.correo } : {}),
    });
    return json({ url: `${GOOGLE_AUTH}?${q}` });
  }

  if (accion === "desconectar") {
    const { data } = await admin.from("correo_cuentas").select("refresh_token").eq("usuario_id", u.id).maybeSingle();
    const rt = (data as { refresh_token: string } | null)?.refresh_token;
    // Se le retira el permiso en Google también; si Google no contesta, la conexión se borra igual.
    if (rt) await (e.fetch ?? fetch)(`${GOOGLE_REVOKE}?token=${encodeURIComponent(rt)}`, { method: "POST" }).catch(() => undefined);
    await admin.from("correo_cuentas").delete().eq("usuario_id", u.id);
    return json({ ok: true });
  }

  if (accion === "enviar") {
    const tipo = txt(b.tipo), id = txt(b.id);
    if (!tipo || !["cotizacion", "orden_compra"].includes(tipo) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Documento no válido" }, 400);
    const lista = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x.trim().toLowerCase() : "")).filter(Boolean);
    const para = [...new Set(lista(b.para))], cc = [...new Set(lista(b.cc))].filter((x) => !para.includes(x));
    if (!para.length) return json({ error: "¿A quién se lo mandas? Falta el correo" }, 400);
    const malo = [...para, ...cc].find((x) => !correoValido(x));
    if (malo) return json({ error: `«${malo}» no parece un correo` }, 400);
    if (para.length + cc.length > MAX_DESTINOS) return json({ error: `Hasta ${MAX_DESTINOS} destinatarios` }, 400);
    const asunto = txt(b.asunto), cuerpo = typeof b.cuerpo === "string" ? b.cuerpo : "";
    if (!asunto || asunto.length > 200) return json({ error: "Falta el asunto (o es demasiado largo)" }, 400);
    if (cuerpo.length > 20_000) return json({ error: "El mensaje es demasiado largo" }, 400);
    const adj = o(b.adjunto);
    let pdf: Uint8Array | null = null;
    if (txt(adj.base64)) {
      try { pdf = Uint8Array.from(atob(txt(adj.base64)!), (c) => c.charCodeAt(0)); } catch { return json({ error: "El PDF llegó dañado" }, 400); }
      if (pdf.length > MAX_PDF) return json({ error: "El PDF pesa demasiado (más de 15 MB)" }, 400);
      if (String.fromCharCode(...pdf.subarray(0, 5)) !== "%PDF-") return json({ error: "El adjunto no es un PDF" }, 400);
    }

    // ¿Se puede? Con la sesión de la persona: si no, el correo no sale.
    const prep = await u.db.rpc("correo_preparar", { p_tipo: tipo, p_id: id });
    if (prep.error) return json({ error: prep.error.message }, prep.error.code === "42501" ? 403 : 400);
    const doc = o(prep.data);

    const { data: cta } = await admin.from("correo_cuentas").select("usuario_id, correo, access_token, refresh_token, expira_en, error").eq("usuario_id", u.id).maybeSingle();
    const cuenta = cta as (Cuenta & { error: string | null }) | null;
    if (!cuenta) return json({ error: "Conecta tu Gmail para mandar desde el ERP", conectar: true }, 409);
    if (cuenta.error) return json({ error: cuenta.error, conectar: true }, 409);
    const { data: perfil } = await admin.from("perfiles").select("nombre").eq("id", u.id).maybeSingle();
    const archivo = txt(adj.nombre) ?? txt(doc.archivo) ?? "documento.pdf";
    const mime = armarCorreo({
      de: cuenta.correo, nombre: (perfil as { nombre: string | null } | null)?.nombre, para, cc, asunto, cuerpo,
      adjunto: pdf ? { nombre: archivo.endsWith(".pdf") ? archivo : `${archivo}.pdf`, bytes: pdf } : null,
    });
    let enviado: { id: string | null; hilo: string | null };
    try {
      enviado = await mandarGmail(e, admin, cuenta, mime);
    } catch (err) {
      const g = err instanceof ErrorGoogle ? err : null;
      return json({ error: err instanceof Error ? err.message : String(err), conectar: g?.reconectar ?? false }, g?.reconectar ? 409 : 502);
    }

    // Ya salió: lo que falle de aquí en adelante se dice, pero el correo no se puede deshacer.
    const marca = await u.db.rpc("correo_marcar_enviado", { p_tipo: tipo, p_id: id, p_para: para });
    const { error: errReg } = await admin.from("correos_enviados").insert({
      usuario_id: u.id, de: cuenta.correo, tipo, documento_id: id, folio: txt(doc.folio), para, cc, asunto,
      cuerpo: cuerpo || null, adjunto: pdf ? archivo : null, gmail_id: enviado.id, gmail_hilo: enviado.hilo,
    });
    const avisos = [
      marca.error && `El correo salió, pero no se pudo marcar como enviada: ${marca.error.message}`,
      errReg && `El correo salió, pero no quedó en el historial: ${errReg.message}`,
    ].filter(Boolean);
    return json({ ok: true, de: cuenta.correo, gmail_id: enviado.id, hilo: enviado.hilo, aviso: avisos.join(" ") || null });
  }

  return json({ error: "Ruta no válida" }, 404);
}
