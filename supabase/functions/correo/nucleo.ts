// Gmail ↔ ERP: cada quien manda la cotización o la orden de compra desde su propio Gmail, e
// importaciones liga a cada embarque los hilos de correo que lo llevan (segunda etapa: leer).
// Rutas (la última parte de la URL):
//   POST iniciar      la persona pide el enlace para darle permiso a su Gmail
//   GET  autorizar    Google regresa aquí con el código; se cambia por los tokens
//   POST enviar       manda el documento con su PDF y lo deja anotado
//   POST desconectar  la persona quita su conexión (y se le retira el permiso en Google)
//   POST buscar       importaciones busca hilos en su Gmail (por BL, referencia, proveedor…)
//   POST ligar        liga un hilo a un embarque y guarda el texto de sus correos
//   POST actualizar   trae lo nuevo de un hilo ligado (solo quien lo ligó: es su Gmail)
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
// Leer (segunda etapa, importaciones): buscar hilos y traer sus correos.
// -----------------------------------------------------------------------------
export const GMAIL_HILOS = "https://gmail.googleapis.com/gmail/v1/users/me/threads";
const MAX_TEXTO = 12_000;
const MAX_RESULTADOS = 15;

async function leerGmail(e: Entorno, admin: SupabaseClient, c: Cuenta, url: string) {
  const f = e.fetch ?? fetch;
  let token = await tokenVigente(e, admin, c);
  for (let intento = 0; intento < 2; intento++) {
    const r = await f(url, { headers: { Authorization: `Bearer ${token}` } });
    const d = o(await r.json().catch(() => ({})));
    if (r.ok) return d;
    if (r.status === 401 && intento === 0) { token = await tokenVigente(e, admin, c, true); continue; }
    const msg = txt(o(d.error).message) ?? String(r.status);
    if (r.status === 403 && /insufficient|scope/i.test(msg)) {
      await admin.from("correo_cuentas").update({ error: "Falta el permiso de leer", error_en: new Date().toISOString() }).eq("usuario_id", c.usuario_id);
      throw new ErrorGoogle("Tu Gmail no dio permiso de leer: vuelve a conectarlo y deja marcada la casilla de leer", 403, true);
    }
    if (r.status === 404) throw new ErrorGoogle("Ese hilo ya no está en tu Gmail (¿se borró?)", 404);
    throw new ErrorGoogle(`Gmail no contestó: ${msg}`, r.status);
  }
  throw new ErrorGoogle("Gmail no contestó");
}

type Parte = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: Parte[]; headers?: { name: string; value: string }[] };
const desdeB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(b, (ch) => ch.charCodeAt(0)));
};
const sinHtml = (h: string) => h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ");

/**
 * Lo que dice este correo, sin lo citado de los anteriores: en un hilo de 80 correos cada uno trae
 * debajo toda la conversación, y leerla 80 veces no dice nada nuevo y cuesta. Se corta en el primer
 * encabezado de cita (Gmail, Outlook, español, inglés, chino) y se quitan los renglones con «>».
 */
export function limpiarCitado(texto: string) {
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n");
  const fin = lineas.findIndex((l, i) => {
    const dos = `${l} ${lineas[i + 1] ?? ""}`.trim();
    return /^(On|El)\s.{6,200}\s(wrote|escribió)\s?:$/i.test(l.trim()) || /^(On|El)\s.{6,200}\s(wrote|escribió)\s?:$/i.test(dos)
      || /^-{2,}\s*(Original Message|Mensaje original)\s*-{2,}/i.test(l.trim())
      || /^\s*在.{4,120}写道\s*[:：]\s*$/.test(l)
      || (/^\*?(De|From)\s*:\*?\s.+/i.test(l.trim()) && lineas.slice(i + 1, i + 5).some((s) => /^\*?(Enviado|Sent|Date|Fecha)\s*:/i.test(s.trim())));
  });
  return (fin >= 0 ? lineas.slice(0, fin) : lineas).filter((l) => !/^\s*>/.test(l)).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXTO);
}

/** El texto (sin HTML) y los nombres de los adjuntos de un mensaje de Gmail. */
export function leerMensaje(payload: Parte) {
  const planos: string[] = [], htmls: string[] = [], adjuntos: string[] = [];
  const recorrer = (p: Parte) => {
    if (p.filename) { adjuntos.push(p.filename); return; }
    if (p.body?.data && p.mimeType === "text/plain") planos.push(desdeB64Url(p.body.data));
    else if (p.body?.data && p.mimeType === "text/html") htmls.push(sinHtml(desdeB64Url(p.body.data)));
    (p.parts ?? []).forEach(recorrer);
  };
  recorrer(payload);
  return { texto: limpiarCitado((planos.length ? planos : htmls).join("\n\n")), adjuntos };
}

const encabezadoDe = (p: Parte | undefined, nombre: string) =>
  p?.headers?.find((h) => h.name.toLowerCase() === nombre.toLowerCase())?.value ?? null;

/** Trae el hilo completo y lo guarda (sin repetir los correos que ya estaban). */
async function guardarHilo(e: Entorno, admin: SupabaseClient, c: Cuenta, embarqueId: string, hiloGmail: string, ligadoPor: string) {
  const d = await leerGmail(e, admin, c, `${GMAIL_HILOS}/${encodeURIComponent(hiloGmail)}?format=full`);
  const msgs = (Array.isArray(d.messages) ? d.messages : []).map(o)
    .filter((m) => !(Array.isArray(m.labelIds) && (m.labelIds as string[]).includes("DRAFT")));
  if (!msgs.length) throw new ErrorGoogle("Ese hilo no tiene correos", 404);
  const filas = msgs.map((m) => {
    const p = o(m.payload) as Parte;
    const { texto, adjuntos } = leerMensaje(p);
    return {
      gmail_id: txt(m.id)!, enviado_en: new Date(Number(m.internalDate) || Date.now()).toISOString(),
      de: encabezadoDe(p, "From"), para: [encabezadoDe(p, "To"), encabezadoDe(p, "Cc")].filter(Boolean).join(", ") || null,
      asunto: encabezadoDe(p, "Subject"), texto, adjuntos,
    };
  }).sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));
  const participantes = [...new Set(filas.flatMap((f) => [f.de, ...(f.para ?? "").split(",")])
    .map((x) => (x ?? "").match(/[^\s<>,;"]+@[^\s<>,;"]+/)?.[0]?.toLowerCase()).filter((x): x is string => !!x))].slice(0, 30);
  const { data: hilo, error } = await admin.from("embarque_hilos").upsert({
    embarque_id: embarqueId, usuario_id: c.usuario_id, cuenta: c.correo, gmail_hilo: hiloGmail, asunto: filas[0].asunto,
    participantes, mensajes: filas.length, primer_mensaje_en: filas[0].enviado_en, ultimo_mensaje_en: filas[filas.length - 1].enviado_en,
    traido_en: new Date().toISOString(), ligado_por: ligadoPor,
  }, { onConflict: "embarque_id,usuario_id,gmail_hilo" }).select("id").single();
  if (error) throw new Error(error.message);
  const hiloId = (hilo as { id: string }).id;
  const { data: ya } = await admin.from("embarque_correos").select("gmail_id").eq("hilo_id", hiloId);
  const tenia = new Set(((ya ?? []) as { gmail_id: string }[]).map((x) => x.gmail_id));
  const nuevos = filas.filter((f) => !tenia.has(f.gmail_id)).map((f) => ({ ...f, hilo_id: hiloId }));
  if (nuevos.length) {
    const { error: e2 } = await admin.from("embarque_correos").insert(nuevos);
    if (e2) throw new Error(e2.message);
  }
  return { hilo_id: hiloId, mensajes: filas.length, nuevos: nuevos.length };
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

  // Leer hilos para un embarque: solo importaciones (con el dinero de importaciones, porque los
  // correos lo traen) y solo del Gmail de quien lo pide.
  if (accion === "buscar" || accion === "ligar" || accion === "actualizar") {
    const [p1, p2] = await Promise.all([u.db.rpc("puede", { p_modulo: "importaciones", p_nivel: 2 }), u.db.rpc("ve_dinero_importacion")]);
    if (p1.data !== true || p2.data !== true) return json({ error: "Leer los correos de los embarques es de importaciones" }, 403);
    const { data: cta } = await admin.from("correo_cuentas").select("usuario_id, correo, access_token, refresh_token, expira_en, alcances, error").eq("usuario_id", u.id).maybeSingle();
    const cuenta = cta as (Cuenta & { alcances: string[]; error: string | null }) | null;
    if (!cuenta) return json({ error: "Conecta tu Gmail para traer los correos", conectar: true }, 409);
    if (cuenta.error) return json({ error: cuenta.error, conectar: true }, 409);
    if (!cuenta.alcances.includes(LEER)) return json({ error: "Tu Gmail no dio permiso de leer: vuelve a conectarlo y deja marcada la casilla de leer", conectar: true }, 409);
    try {
      if (accion === "buscar") {
        const consulta = txt(b.q);
        if (!consulta || consulta.length > 200) return json({ error: "¿Qué busco? Pon el BL, la referencia del agente o el proveedor" }, 400);
        const lista = await leerGmail(e, admin, cuenta, `${GMAIL_HILOS}?maxResults=${MAX_RESULTADOS}&q=${encodeURIComponent(consulta)}`);
        const hilos = (Array.isArray(lista.threads) ? lista.threads : []).map(o);
        const datos = await Promise.all(hilos.map(async (h) => {
          const d = await leerGmail(e, admin, cuenta,
            `${GMAIL_HILOS}/${encodeURIComponent(String(h.id))}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);
          const ms = (Array.isArray(d.messages) ? d.messages : []).map(o);
          const primero = o(ms[0]?.payload) as Parte;
          return { id: txt(h.id), asunto: encabezadoDe(primero, "Subject"), de: encabezadoDe(primero, "From"), mensajes: ms.length,
            ultimo: ms.length ? new Date(Number(ms[ms.length - 1].internalDate) || 0).toISOString() : null, fragmento: txt(h.snippet) };
        }));
        // Lo que ya está ligado a este embarque se marca para no ligarlo dos veces.
        const embarque = txt(b.embarque_id);
        const { data: ligados } = embarque
          ? await u.db.from("embarque_hilos").select("gmail_hilo").eq("embarque_id", embarque).eq("usuario_id", u.id) : { data: [] };
        const ya = new Set(((ligados ?? []) as { gmail_hilo: string }[]).map((x) => x.gmail_hilo));
        return json({ hilos: datos.map((x) => ({ ...x, ligado: ya.has(x.id ?? "") })) });
      }
      if (accion === "ligar") {
        const embarque = txt(b.embarque_id), hilo = txt(b.hilo);
        if (!embarque || !/^[0-9a-f-]{36}$/i.test(embarque) || !hilo || !/^[\w-]{6,40}$/.test(hilo)) return json({ error: "Falta el embarque o el hilo" }, 400);
        const { data: emb } = await u.db.from("embarques").select("id").eq("id", embarque).maybeSingle();
        if (!emb) return json({ error: "No encontramos ese embarque" }, 404);
        return json({ ok: true, ...(await guardarHilo(e, admin, cuenta, embarque, hilo, u.id)) });
      }
      // actualizar: traer lo nuevo de un hilo ya ligado. Solo de su propio Gmail.
      const id = txt(b.hilo_id);
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Falta el hilo" }, 400);
      const { data: h } = await u.db.from("embarque_hilos").select("embarque_id, usuario_id, gmail_hilo, cuenta").eq("id", id).maybeSingle();
      const hilo = h as { embarque_id: string; usuario_id: string; gmail_hilo: string; cuenta: string } | null;
      if (!hilo) return json({ error: "Ese hilo ya no está ligado" }, 404);
      if (hilo.usuario_id !== u.id) return json({ error: `Ese hilo viene del Gmail ${hilo.cuenta}: solo esa persona lo puede actualizar` }, 403);
      return json({ ok: true, ...(await guardarHilo(e, admin, cuenta, hilo.embarque_id, hilo.gmail_hilo, u.id)) });
    } catch (err) {
      const g = err instanceof ErrorGoogle ? err : null;
      return json({ error: err instanceof Error ? err.message : String(err), conectar: g?.reconectar ?? false }, g?.reconectar ? 409 : g?.status === 404 ? 404 : 502);
    }
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
