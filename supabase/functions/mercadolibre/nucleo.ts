// Mercado Libre ↔ ERP. Rutas (la última parte de la URL):
//   POST iniciar      dirección pide el enlace para dar permiso a la cuenta de ML
//   GET  autorizar    ML regresa aquí con el código; se cambia por los tokens
//   POST aviso        ML avisa que cambió una venta, un reclamo o una pregunta (sin sesión)
//   POST procesar     "Revisar ahora": procesa los avisos pendientes
//   POST responder    contestar una pregunta desde el ERP
//   POST desconectar  dirección quita la conexión
//
// Reglas:
//   * Al aviso no se le cree: solo dice qué recurso cambió. Se vuelve a pedir a la API con
//     el token de la cuenta y se ignoran los de otra aplicación u otra cuenta.
//   * ML exige respuesta al aviso en menos de 500 ms: se encola y se contesta 200 ya; el
//     trabajo sigue en segundo plano. Lo que falla se reintenta con el siguiente aviso o con
//     "Revisar ahora", y el error queda a la vista en Configuración → Integraciones.
//   * Lo que se hace en la base (crear el pedido, abrir el reclamo) lo deciden las funciones
//     ml_* de la migración 119. Aquí solo se traduce lo de ML a esa forma.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string; supabaseAnonKey: string; serviceKey: string;
  clientId?: string; clientSecret?: string; appUrl: string;
  enSegundoPlano?: (p: Promise<unknown>) => void;
  /** Para las pruebas: la API de ML falsa. */
  fetch?: typeof fetch;
}

export const API_ML = "https://api.mercadolibre.com";
const AUTORIZACION_ML = "https://auth.mercadolibre.com.mx/authorization";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
const MAX_INTENTOS = 8;

class ErrorML extends Error { constructor(msg: string, readonly status = 0) { super(msg); } }

// -----------------------------------------------------------------------------
// Traducciones de ML a lo que esperan las funciones de la base
// -----------------------------------------------------------------------------
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {});
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** Una venta (GET /orders/{id}) y, si se pidió, su envío (GET /shipments/{id}). */
export function normalizarOrden(orden: Obj, envio?: Obj | null) {
  return {
    id: txt(orden.id),
    estado: txt(orden.status),
    fecha: txt(orden.date_closed) ?? txt(orden.date_created),
    comprador: txt(o(orden.buyer).nickname),
    pack_id: txt(orden.pack_id),
    // Full: la mercancía sale de la bodega de ML, no de planta.
    full: txt(o(envio).logistic_type) === "fulfillment",
    items: (Array.isArray(orden.order_items) ? orden.order_items : []).map((x) => {
      const it = o(o(x).item);
      return { item_id: txt(it.id), titulo: txt(it.title), sku: txt(it.seller_sku), cantidad: num(o(x).quantity) ?? 1, precio: num(o(x).unit_price) ?? 0 };
    }).filter((x) => x.item_id),
  };
}

/** Un reclamo (GET /post-purchase/v1/claims/{id}). La fecha límite es la más próxima de lo que le toca al vendedor. */
export function normalizarReclamo(r: Obj, razon?: string | null) {
  const tipoML = (txt(r.type) ?? "").toLowerCase();
  const tipo = /return/.test(tipoML) ? "devolucion" : /cancel/.test(tipoML) ? "cancelacion" : "reclamo";
  const limites = (Array.isArray(r.players) ? r.players : [])
    .filter((p) => ["respondent", "seller"].includes(txt(o(p).role) ?? "") || txt(o(p).type) === "seller")
    .flatMap((p) => (Array.isArray(o(p).available_actions) ? o(p).available_actions as unknown[] : []))
    .map((a) => txt(o(a).due_date)).filter((d): d is string => !!d).sort();
  return {
    id: txt(r.id),
    order_id: txt(r.resource) === "order" || !txt(r.resource) ? txt(r.resource_id) : txt(r.resource_id),
    tipo,
    motivo: [razon ?? txt(r.reason_id), txt(r.stage) === "dispute" ? "en disputa (mediación de ML)" : null].filter(Boolean).join(" · ") || "Reclamo en Mercado Libre",
    fecha_limite: limites[0] ?? null,
    abierto: (txt(r.status) ?? "opened") === "opened",
  };
}

/** Una pregunta (GET /questions/{id}). */
export function normalizarPregunta(q: Obj, titulo?: string | null) {
  const resp = o(q.answer);
  return {
    id: num(q.id), item_id: txt(q.item_id), titulo: titulo ?? null, texto: txt(q.text) ?? "",
    estado: txt(q.status), fecha: txt(q.date_created), respuesta: txt(resp.text), fecha_respuesta: txt(resp.date_created),
  };
}

// -----------------------------------------------------------------------------
// La cuenta y sus tokens (solo con la llave de servicio)
// -----------------------------------------------------------------------------
interface Cuenta { ml_user_id: number; nickname: string | null; access_token: string; refresh_token: string; expira_en: string }

async function pedirToken(e: Entorno, cuerpo: Record<string, string>) {
  if (!e.clientId || !e.clientSecret) throw new ErrorML("Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en los secretos de Supabase.");
  const r = await (e.fetch ?? fetch)(`${API_ML}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: e.clientId, client_secret: e.clientSecret, ...cuerpo }),
  });
  const d = o(await r.json().catch(() => ({})));
  if (!r.ok || !txt(d.access_token)) throw new ErrorML(`Mercado Libre no dio el permiso: ${txt(d.message) ?? txt(d.error) ?? r.status}`, r.status);
  return { access_token: txt(d.access_token)!, refresh_token: txt(d.refresh_token) ?? "", expires_in: num(d.expires_in) ?? 21600, user_id: num(d.user_id) };
}

/** El token vigente; lo renueva si le quedan menos de 10 minutos (ML lo da por 6 horas). */
async function token(e: Entorno, admin: SupabaseClient): Promise<{ cuenta: Cuenta; access: string }> {
  const { data } = await admin.from("ml_cuenta").select("ml_user_id, nickname, access_token, refresh_token, expira_en").eq("id", 1).maybeSingle();
  const c = data as Cuenta | null;
  if (!c) throw new ErrorML("Mercado Libre no está conectado.");
  if (new Date(c.expira_en).getTime() - Date.now() > 10 * 60_000) return { cuenta: c, access: c.access_token };
  const t = await pedirToken(e, { grant_type: "refresh_token", refresh_token: c.refresh_token });
  // ML cambia también el refresh token; si otro proceso ya lo renovó, gana el suyo.
  await admin.from("ml_cuenta").update({
    access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token,
    expira_en: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }).eq("id", 1).eq("refresh_token", c.refresh_token);
  return { cuenta: c, access: t.access_token };
}

async function apiML(e: Entorno, access: string, ruta: string, init?: RequestInit) {
  const r = await (e.fetch ?? fetch)(`${API_ML}${ruta}`, {
    ...init, headers: { Authorization: `Bearer ${access}`, Accept: "application/json", ...(init?.headers ?? {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorML(`ML ${ruta}: ${txt(o(d).message) ?? txt(o(d).error) ?? r.status}`, r.status);
  return o(d);
}

// -----------------------------------------------------------------------------
// Procesar avisos
// -----------------------------------------------------------------------------
async function procesarUno(e: Entorno, admin: SupabaseClient, access: string, topic: string, resource: string) {
  const rpc = async (fn: string, p: unknown) => {
    const { error } = await admin.rpc(fn, { p });
    if (error) throw new ErrorML(error.message);
  };
  if (topic === "orders_v2" || topic === "orders") {
    const orden = await apiML(e, access, resource);
    const envioId = txt(o(orden.shipping).id);
    const envio = envioId ? await apiML(e, access, `/shipments/${envioId}`, { headers: { "x-format-new": "true" } }).catch(() => null) : null;
    await rpc("ml_registrar_orden", normalizarOrden(orden, envio));
  } else if (topic === "claims") {
    const reclamo = await apiML(e, access, resource);
    const razonId = txt(reclamo.reason_id);
    const razon = razonId ? await apiML(e, access, `/post-purchase/v1/claims/reasons/${razonId}`).then((x) => txt(x.name) ?? txt(x.detail)).catch(() => null) : null;
    await rpc("ml_registrar_reclamo", normalizarReclamo(reclamo, razon));
  } else if (topic === "questions") {
    let pregunta: Obj;
    try { pregunta = await apiML(e, access, resource); } catch (err) {
      if (err instanceof ErrorML && err.status === 404) return; // la borraron en ML
      throw err;
    }
    const item = txt(pregunta.item_id);
    const titulo = item ? await apiML(e, access, `/items/${item}?attributes=title`).then((x) => txt(x.title)).catch(() => null) : null;
    await rpc("ml_registrar_pregunta", normalizarPregunta(pregunta, titulo));
  }
  // Otros tópicos (items, mensajes…) todavía no se usan: se marcan como vistos.
}

export async function procesarPendientes(e: Entorno, admin: SupabaseClient, limite = 20) {
  const { data } = await admin.from("ml_avisos").select("id, topic, resource, intentos")
    .is("procesado_en", null).lt("intentos", MAX_INTENTOS).order("recibido_en").limit(limite);
  const avisos = (data ?? []) as { id: number; topic: string; resource: string; intentos: number }[];
  if (!avisos.length) return { procesados: 0, errores: 0 };
  const { access } = await token(e, admin);
  let errores = 0;
  for (const a of avisos) {
    try {
      await procesarUno(e, admin, access, a.topic, a.resource);
      await admin.from("ml_avisos").update({ procesado_en: new Date().toISOString(), error: null, intentos: a.intentos + 1 }).eq("id", a.id);
    } catch (err) {
      errores++;
      await admin.from("ml_avisos").update({ intentos: a.intentos + 1, error: (err instanceof Error ? err.message : String(err)).slice(0, 500) }).eq("id", a.id);
    }
  }
  return { procesados: avisos.length - errores, errores };
}

/**
 * Traer lo que ya estaba en ML al conectar: los avisos solo llegan de lo que pasa después,
 * así que una pregunta sin contestar o un reclamo abierto de antes no aparecían nunca. Se
 * forman en la misma fila de avisos (mismo procesamiento, sin lógica nueva). Las ventas solo
 * desde la fecha que se pida: las de antes se capturaron a mano y se duplicarían.
 */
export async function sincronizar(e: Entorno, admin: SupabaseClient, ventasDesde: string | null) {
  const { cuenta, access } = await token(e, admin);
  const vendedor = cuenta.ml_user_id;
  const avisos: { topic: string; resource: string; ml_user_id: number }[] = [];

  const preguntas = await apiML(e, access, `/questions/search?seller_id=${vendedor}&status=UNANSWERED&api_version=4&limit=50`);
  for (const q of (Array.isArray(preguntas.questions) ? preguntas.questions : []) as Obj[]) {
    const id = num(q.id); if (id) avisos.push({ topic: "questions", resource: `/questions/${id}`, ml_user_id: vendedor });
  }
  const reclamos = await apiML(e, access, `/post-purchase/v1/claims/search?status=opened&limit=50`).catch(() => ({} as Obj));
  for (const c of (Array.isArray(reclamos.data) ? reclamos.data : []) as Obj[]) {
    const id = num(c.id); if (id) avisos.push({ topic: "claims", resource: `/post-purchase/v1/claims/${id}`, ml_user_id: vendedor });
  }
  let ventas = 0;
  if (ventasDesde) {
    for (let offset = 0; offset < 500; offset += 50) {
      const r = await apiML(e, access, `/orders/search?seller=${vendedor}&order.date_created.from=${ventasDesde}T00:00:00.000-06:00&sort=date_asc&limit=50&offset=${offset}`);
      const lista = (Array.isArray(r.results) ? r.results : []) as Obj[];
      for (const v of lista) { const id = num(v.id); if (id) { avisos.push({ topic: "orders_v2", resource: `/orders/${id}`, ml_user_id: vendedor }); ventas++; } }
      if (lista.length < 50) break;
    }
  }
  if (avisos.length) {
    const { error } = await admin.from("ml_avisos").insert(avisos);
    if (error) throw new ErrorML(error.message);
  }
  // Cuántas publicaciones activas tiene la cuenta: la prueba de que es la cuenta correcta.
  const publicaciones = await apiML(e, access, `/users/${vendedor}/items/search?status=active&limit=1`)
    .then((x) => num(o(x.paging).total) ?? 0).catch(() => null);
  let procesados = 0, errores = 0;
  for (let i = 0; i < 10; i++) {
    const r = await procesarPendientes(e, admin, 50);
    procesados += r.procesados; errores += r.errores;
    if (r.procesados + r.errores < 50) break;
  }
  return { cuenta: cuenta.nickname, publicaciones, preguntas: avisos.filter((a) => a.topic === "questions").length,
    reclamos: avisos.filter((a) => a.topic === "claims").length, ventas, procesados, errores };
}

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------
async function quien(req: Request, e: Entorno) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const yo = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
  const { data } = await yo.auth.getUser(auth.slice(7));
  return data.user ? { id: data.user.id, db: yo } : null;
}
const puede = async (db: SupabaseClient, modulo: string, nivel: number) => (await db.rpc("puede", { p_modulo: modulo, p_nivel: nivel })).data === true;
const esDireccion = async (db: SupabaseClient) => (await db.rpc("tiene_rol", { r: "direccion" })).data === true;

export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const accion = url.pathname.split("/").filter(Boolean).pop();
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const redireccion = `${e.supabaseUrl}/functions/v1/mercadolibre/autorizar`;

  // ML avisa: se encola y se contesta ya.
  if (accion === "aviso" && req.method === "POST") {
    const a = o(await req.json().catch(() => ({})));
    const topic = txt(a.topic), resource = txt(a.resource), app = txt(a.application_id), usuario = num(a.user_id);
    if (!topic || !resource) return json({ ok: false }, 400);
    if (e.clientId && app && app !== e.clientId) return json({ ok: true });      // de otra aplicación: se ignora
    const { data: c } = await admin.from("ml_cuenta").select("ml_user_id").eq("id", 1).maybeSingle();
    if (!c || (usuario && Number((c as { ml_user_id: number }).ml_user_id) !== usuario)) return json({ ok: true });
    // Repetido (ML manda el mismo recurso varias veces): ya está en la cola, se ignora.
    await admin.from("ml_avisos").insert({ topic, resource, ml_user_id: usuario });
    const trabajo = procesarPendientes(e, admin, 10).catch(() => undefined);
    if (e.enSegundoPlano) e.enSegundoPlano(trabajo); else await trabajo;
    return json({ ok: true });
  }

  // ML regresa del permiso.
  if (accion === "autorizar" && req.method === "GET") {
    const volver = (estado: string, detalle?: string) => Response.redirect(
      `${e.appUrl}/sistema/configuracion?seccion=integraciones&ml=${estado}${detalle ? `&detalle=${encodeURIComponent(detalle.slice(0, 200))}` : ""}`, 302);
    const code = url.searchParams.get("code"), state = url.searchParams.get("state");
    if (!code || !state) return volver("error", url.searchParams.get("error_description") ?? "Mercado Libre no mandó el código");
    const { data: pend } = await admin.from("ml_permisos_pendientes").select("usuario_id, creado_en").eq("state", state).maybeSingle();
    await admin.from("ml_permisos_pendientes").delete().eq("state", state);
    const p = pend as { usuario_id: string; creado_en: string } | null;
    if (!p || Date.now() - new Date(p.creado_en).getTime() > 15 * 60_000) return volver("error", "El enlace ya venció: vuelve a dar clic en Conectar");
    try {
      const t = await pedirToken(e, { grant_type: "authorization_code", code, redirect_uri: redireccion });
      const yo = await apiML(e, t.access_token, "/users/me");
      const { error } = await admin.from("ml_cuenta").upsert({
        id: 1, ml_user_id: num(yo.id) ?? t.user_id, nickname: txt(yo.nickname), access_token: t.access_token, refresh_token: t.refresh_token,
        expira_en: new Date(Date.now() + t.expires_in * 1000).toISOString(), conectada_por: p.usuario_id, conectada_en: new Date().toISOString(),
      });
      if (error) throw new ErrorML(error.message);
      return volver("conectada");
    } catch (err) {
      return volver("error", err instanceof Error ? err.message : String(err));
    }
  }

  if (req.method !== "POST") return json({ error: "Ruta no válida" }, 404);
  const u = await quien(req, e);
  if (!u) return json({ error: "Falta la sesión" }, 401);

  if (accion === "iniciar") {
    if (!(await esDireccion(u.db))) return json({ error: "Conectar Mercado Libre es de dirección" }, 403);
    if (!e.clientId || !e.clientSecret) return json({ error: "Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en Supabase → Edge Functions → Secrets." }, 400);
    const state = crypto.randomUUID();
    const { error } = await admin.from("ml_permisos_pendientes").insert({ state, usuario_id: u.id });
    if (error) return json({ error: error.message }, 500);
    const q = new URLSearchParams({ response_type: "code", client_id: e.clientId, redirect_uri: redireccion, state });
    return json({ url: `${AUTORIZACION_ML}?${q}` });
  }

  if (accion === "desconectar") {
    if (!(await esDireccion(u.db))) return json({ error: "Desconectar Mercado Libre es de dirección" }, 403);
    await admin.from("ml_cuenta").delete().eq("id", 1);
    return json({ ok: true });
  }

  if (accion === "procesar") {
    if (!(await puede(u.db, "ventas", 2)) && !(await esDireccion(u.db))) return json({ error: "Sin permiso" }, 403);
    // Lo que se agotó en intentos vuelve a la fila cuando alguien lo pide a mano.
    await admin.from("ml_avisos").update({ intentos: 0 }).is("procesado_en", null).gte("intentos", MAX_INTENTOS);
    try { return json(await procesarPendientes(e, admin, 50)); } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "sincronizar") {
    if (!(await puede(u.db, "ventas", 2)) && !(await esDireccion(u.db))) return json({ error: "Sin permiso" }, 403);
    const b = o(await req.json().catch(() => ({})));
    const desde = txt(b.ventas_desde);
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return json({ error: "La fecha va como AAAA-MM-DD" }, 400);
    try { return json(await sincronizar(e, admin, desde ?? null)); } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "responder") {
    if (!(await puede(u.db, "ventas", 2))) return json({ error: "Contestar preguntas es de ventas" }, 403);
    const b = o(await req.json().catch(() => ({})));
    const id = num(b.pregunta_id), texto = txt(b.texto);
    if (!id || !texto) return json({ error: "Falta la pregunta o la respuesta" }, 400);
    if (texto.length > 2000) return json({ error: "Mercado Libre acepta respuestas de hasta 2,000 caracteres" }, 400);
    try {
      const { access } = await token(e, admin);
      await apiML(e, access, "/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: id, text: texto }) });
      const { error } = await admin.rpc("ml_marcar_contestada", { p_pregunta: id, p_texto: texto, p_usuario: u.id });
      if (error) throw new ErrorML(error.message);
      return json({ ok: true });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  return json({ error: "Ruta no válida" }, 404);
}
