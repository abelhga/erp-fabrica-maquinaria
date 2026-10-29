// Mercado Libre ↔ ERP. Rutas (la última parte de la URL):
//   POST iniciar      dirección pide el enlace para dar permiso a la cuenta de ML
//   GET  autorizar    ML regresa aquí con el código; se cambia por los tokens
//   POST aviso        ML avisa que cambió una venta, un reclamo o una pregunta (sin sesión)
//   POST procesar     "Revisar ahora": procesa los avisos pendientes
//   POST responder    contestar una pregunta desde el ERP
//   POST desconectar  dirección quita la conexión
//   POST publicaciones el tablero: trae cada publicación, su comisión y su envío
//   POST aplicar      «Cambios sugeridos»: manda a ML el precio o la existencia que sugiere el ERP
//   POST automatico   pg_cron cada hora (con la llave de ml_cuenta, sin sesión) si el interruptor está prendido
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
export const API_MP = "https://api.mercadopago.com";
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

/**
 * Un pago de la venta con su detalle de Mercado Pago (GET /v1/payments/{id}). charges_details
 * trae lo que se le cobra al vendedor: meli_fee (comisión), shp_* (el envío que pagamos) y
 * tax_withholding-iva / -isr (retenciones). Lo que paga el comprador (from ≠ collector) no
 * cuenta. Sin el detalle de Mercado Pago queda la comisión de la orden y «completo» en falso.
 */
export function normalizarPago(pago: Obj, mp?: Obj | null) {
  const det = mp && !mp._error ? mp : null;
  const cargos = (Array.isArray(det?.charges_details) ? det!.charges_details as unknown[] : [])
    .map((c) => o(c)).filter((c) => (txt(o(c.accounts).from) ?? "collector") === "collector")
    .map((c) => ({ nombre: txt(c.name) ?? "", tipo: txt(c.type) ?? "", monto: num(o(c.amounts).original) ?? 0, reembolsado: num(o(c.amounts).refunded) ?? 0 }));
  const suma = (f: (c: { nombre: string; tipo: string }) => boolean) => Math.round(cargos.filter(f).reduce((t, c) => t + c.monto, 0) * 100) / 100;
  const esComision = (c: { nombre: string; tipo: string }) => c.nombre === "meli_fee";
  const esEnvio = (c: { tipo: string }) => c.tipo === "shipping";
  const esIva = (c: { nombre: string }) => c.nombre === "tax_withholding-iva";
  const esIsr = (c: { nombre: string }) => c.nombre === "tax_withholding-isr";
  return {
    id: txt(pago.id),
    estado: txt(det?.status) ?? txt(pago.status),
    pagado_en: txt(det?.date_approved) ?? txt(pago.date_approved),
    metodo: txt(det?.payment_method_id) ?? txt(pago.payment_method_id) ?? txt(pago.payment_type),
    total: num(det?.transaction_amount) ?? num(pago.transaction_amount) ?? 0,
    comision: det ? suma(esComision) : num(pago.marketplace_fee) ?? 0,
    envio: suma(esEnvio),
    retencion_iva: suma(esIva),
    retencion_isr: suma(esIsr),
    otros: suma((c) => !esComision(c) && !esEnvio(c) && !esIva(c) && !esIsr(c)),
    reembolsado: num(det?.transaction_amount_refunded) ?? num(pago.transaction_amount_refunded) ?? 0,
    neto: num(o(det?.transaction_details).net_received_amount),
    libera_en: txt(det?.money_release_date),
    liberado: txt(det?.money_release_status) === "released",
    completo: !!det,
    cargos: det ? cargos : null,
  };
}

/** Una venta (GET /orders/{id}), su envío (GET /shipments/{id}) y sus pagos en Mercado Pago. */
export function normalizarOrden(orden: Obj, envio?: Obj | null, pagosMP?: Obj[] | null) {
  const mp = new Map((pagosMP ?? []).map((x) => [txt(x.id), x]));
  const logistica = txt(o(o(envio).logistic).type) ?? txt(o(envio).logistic_type);
  return {
    id: txt(orden.id),
    estado: txt(orden.status),
    fecha: txt(orden.date_closed) ?? txt(orden.date_created),
    comprador: txt(o(orden.buyer).nickname),
    pack_id: txt(orden.pack_id),
    // Full: la mercancía sale de la bodega de ML, no de planta. El formato nuevo del envío lo
    // trae en logistic.type; el viejo, en logistic_type.
    full: logistica === "fulfillment",
    // shipped / delivered: ML ya lo mandó (una venta traída de días anteriores) y no se pide envío.
    envio_estado: txt(o(envio).status),
    envio_sub: txt(o(envio).substatus),
    envio_id: txt(o(orden.shipping).id) ?? txt(o(envio).id),
    envio_tipo: logistica,
    guia: txt(o(envio).tracking_number),
    pagos: (Array.isArray(orden.payments) ? orden.payments as unknown[] : []).map((x) => normalizarPago(o(x), mp.get(txt(o(x).id)))),
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

/**
 * Una pregunta (GET /questions/{id}). itemActivo: si su publicación sigue activa; ML no
 * deja contestar las de publicaciones pausadas o cerradas ("Item must be active").
 */
export function normalizarPregunta(q: Obj, titulo?: string | null, itemActivo?: boolean | null) {
  const resp = o(q.answer);
  return {
    id: num(q.id), item_id: txt(q.item_id), titulo: titulo ?? null, texto: txt(q.text) ?? "",
    estado: txt(q.status), fecha: txt(q.date_created), respuesta: txt(resp.text), fecha_respuesta: txt(resp.date_created),
    item_activo: itemActivo ?? null,
    // Quién preguntó: con eso se muestran sus preguntas anteriores en la misma publicación.
    comprador_id: num(o(q.from).id) ?? null,
  };
}

// -----------------------------------------------------------------------------
// La cuenta y sus tokens (solo con la llave de servicio)
// -----------------------------------------------------------------------------
interface Cuenta { ml_user_id: number; nickname: string | null; access_token: string; refresh_token: string; expira_en: string; conectada_en?: string | null }

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
  const { data } = await admin.from("ml_cuenta").select("ml_user_id, nickname, access_token, refresh_token, expira_en, conectada_en").eq("id", 1).maybeSingle();
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

/** Como apiML, pero deja pasar una lista (el multiget de publicaciones y las visitas la regresan así). */
async function apiMLLista(e: Entorno, access: string, ruta: string): Promise<unknown> {
  const r = await (e.fetch ?? fetch)(`${API_ML}${ruta}`, { headers: { Authorization: `Bearer ${access}`, Accept: "application/json" } });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorML(`ML ${ruta}: ${txt(o(d).message) ?? txt(o(d).error) ?? r.status}`, r.status);
  return d;
}

/**
 * Lo que regresa ML de una venta, tal cual (ml_crudo): la orden con sus pagos, el envío, lo
 * que costó el envío y el pago en Mercado Pago. Sirve para ver de qué campo sale cada cosa
 * (comisión, retenciones, envío) con las ventas de verdad. Nunca frena el aviso: lo que ML no
 * deje leer queda anotado como «_error» (así se sabe qué permiso falta).
 */
async function guardarCrudo(e: Entorno, admin: SupabaseClient, access: string, orden: Obj, envio: Obj | null, pagos: Obj[]) {
  const id = txt(orden.id);
  if (!id) return;
  try {
    const envioId = txt(o(orden.shipping).id);
    const costos = envioId ? await apiML(e, access, `/shipments/${envioId}/costs`).catch((err) => ({ _error: String(err.message ?? err).slice(0, 300) })) : null;
    await admin.from("ml_crudo").upsert({ order_id: id, orden, envio, costos_envio: costos, pagos, actualizado_en: new Date().toISOString() });
  } catch { /* lo crudo es para revisar: si falla, la venta sigue igual */ }
}

/** El detalle de cada pago en Mercado Pago (el mismo token de la cuenta de ML lo lee). */
async function pagosMP(e: Entorno, access: string, orden: Obj): Promise<Obj[]> {
  const pagos: Obj[] = [];
  for (const p of (Array.isArray(orden.payments) ? orden.payments : []) as Obj[]) {
    const pid = txt(o(p).id);
    if (!pid) continue;
    const r = await (e.fetch ?? fetch)(`${API_MP}/v1/payments/${pid}`, { headers: { Authorization: `Bearer ${access}`, Accept: "application/json" } })
      .then(async (x) => ({ ok: x.ok, status: x.status, d: o(await x.json().catch(() => ({}))) }))
      .catch((err) => ({ ok: false, status: 0, d: { _error: String(err) } as Obj }));
    pagos.push(r.ok ? r.d : { id: pid, _error: `Mercado Pago ${r.status}: ${txt(r.d.message) ?? txt(r.d.error) ?? txt(r.d._error) ?? "sin detalle"}` });
  }
  return pagos;
}

/** Una venta completa: la orden, su envío y sus pagos; la deja guardada tal cual y traducida. */
async function leerVenta(e: Entorno, admin: SupabaseClient, access: string, ruta: string) {
  const orden = await apiML(e, access, ruta);
  const envioId = txt(o(orden.shipping).id);
  const envio = envioId ? await apiML(e, access, `/shipments/${envioId}`, { headers: { "x-format-new": "true" } }).catch(() => null) : null;
  const pagos = await pagosMP(e, access, orden);
  await guardarCrudo(e, admin, access, orden, envio, pagos);
  return { orden, datos: normalizarOrden(orden, envio, pagos) };
}

// -----------------------------------------------------------------------------
// Procesar avisos
// -----------------------------------------------------------------------------
async function procesarUno(e: Entorno, admin: SupabaseClient, access: string, topic: string, resource: string, conectadaEn?: string | null) {
  const rpc = async (fn: string, p: unknown) => {
    const { error } = await admin.rpc(fn, { p });
    if (error) throw new ErrorML(error.message);
  };
  if (topic === "orders_v2" || topic === "orders") {
    await rpc("ml_registrar_orden", (await leerVenta(e, admin, access, resource)).datos);
  } else if (topic === "shipments") {
    // Cambió el envío (guía, en camino, entregado): el del ERP lo sigue. El aviso de la venta no
    // llega por esto. Un envío puede llevar varias ventas del mismo carrito: se busca por envío.
    const envio = await apiML(e, access, resource, { headers: { "x-format-new": "true" } });
    await rpc("ml_sincronizar_envio", { envio_id: txt(envio.id), estado: txt(envio.status), subestado: txt(envio.substatus), guia: txt(envio.tracking_number) });
  } else if (topic === "claims" || topic === "post_purchase") {
    // ML manda los reclamos nuevos como «post_purchase» (a veces del historial de acciones del
    // reclamo). Hasta el 29 oct solo se leía «claims» y dos reclamos nuevos nunca entraron.
    const id = /\/claims\/(\d+)/.exec(resource)?.[1];
    if (!id) return;
    const reclamo = await apiML(e, access, `/post-purchase/v1/claims/${id}`);
    const razonId = txt(reclamo.reason_id);
    const razon = razonId ? await apiML(e, access, `/post-purchase/v1/claims/reasons/${razonId}`).then((x) => txt(x.name) ?? txt(x.detail)).catch(() => null) : null;
    const datos = normalizarReclamo(reclamo, razon);
    try {
      await rpc("ml_registrar_reclamo", datos);
    } catch (err) {
      // La venta no está en el ERP. Si es de después de conectar, su aviso solo viene atrasado:
      // se registra aquí y luego el reclamo. Si es de antes, nunca va a llegar sola: se avisa una
      // vez para atenderlo en ML en lugar de reintentarlo para siempre.
      if (!(err instanceof ErrorML) || !/todavía no está en el ERP/.test(err.message) || !datos.order_id) throw err;
      const venta = await leerVenta(e, admin, access, `/orders/${datos.order_id}`);
      const fecha = txt(venta.orden.date_closed) ?? txt(venta.orden.date_created);
      if (fecha && conectadaEn && new Date(fecha) >= new Date(conectadaEn)) {
        await rpc("ml_registrar_orden", venta.datos);
        // Una venta sin pagar no se registra: entonces tampoco hay dónde colgar el reclamo.
        await rpc("ml_registrar_reclamo", datos).catch(() => rpc("ml_reclamo_sin_venta", { ...datos, fecha_venta: fecha }));
      } else {
        await rpc("ml_reclamo_sin_venta", { ...datos, fecha_venta: fecha });
      }
    }
  } else if (topic === "questions") {
    let pregunta: Obj;
    try { pregunta = await apiML(e, access, resource); } catch (err) {
      if (err instanceof ErrorML && err.status === 404) return; // la borraron en ML
      throw err;
    }
    const item = txt(pregunta.item_id);
    const pub = item ? await apiML(e, access, `/items/${item}?attributes=title,status`).catch(() => null) : null;
    const datos = normalizarPregunta(pregunta, pub ? txt(pub.title) : null, pub ? txt(pub.status) === "active" : null);
    await rpc("ml_registrar_pregunta", datos);
    // Lo que dice la publicación (descripción y atributos): con eso se sugiere la respuesta.
    if (item && datos.estado === "UNANSWERED") await traerFicha(e, admin, access, item).catch(() => undefined);
    // Muchas preguntas siguen a otra del mismo comprador en esa publicación (a veces de antes de
    // conectar el ERP): se traen para que quien contesta vea la conversación completa. Si ML no
    // responde, la pregunta ya quedó registrada; lo anterior solo es contexto.
    if (item && datos.comprador_id) {
      const previas = await apiML(e, access, `/questions/search?item=${item}&from=${datos.comprador_id}&api_version=4&limit=50`).catch(() => ({} as Obj));
      for (const q of (Array.isArray(previas.questions) ? previas.questions : []) as Obj[]) {
        if (num(q.id) === datos.id) continue;
        await rpc("ml_registrar_pregunta", normalizarPregunta(q, datos.titulo, datos.item_activo)).catch(() => undefined);
      }
    }
  }
  // Otros tópicos (items, mensajes…) todavía no se usan: se marcan como vistos.
}

export async function procesarPendientes(e: Entorno, admin: SupabaseClient, limite = 20) {
  const { data } = await admin.from("ml_avisos").select("id, topic, resource, intentos")
    .is("procesado_en", null).lt("intentos", MAX_INTENTOS).order("recibido_en").limit(limite);
  const avisos = (data ?? []) as { id: number; topic: string; resource: string; intentos: number }[];
  if (!avisos.length) return { procesados: 0, errores: 0 };
  const { cuenta, access } = await token(e, admin);
  let errores = 0;
  for (const a of avisos) {
    try {
      await procesarUno(e, admin, access, a.topic, a.resource, cuenta.conectada_en);
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
  // Las que el ERP tiene pendientes se revisan otra vez: su publicación pudo pausarse o cerrarse.
  const { data: pendientes } = await admin.from("ml_preguntas").select("id").eq("estado", "pendiente");
  for (const p of (pendientes ?? []) as { id: number }[]) {
    if (!avisos.some((a) => a.resource === `/questions/${p.id}`)) avisos.push({ topic: "questions", resource: `/questions/${p.id}`, ml_user_id: vendedor });
  }
  const reclamos = await apiML(e, access, `/post-purchase/v1/claims/search?status=opened&limit=50`).catch(() => ({} as Obj));
  for (const c of (Array.isArray(reclamos.data) ? reclamos.data : []) as Obj[]) {
    const id = num(c.id); if (id) avisos.push({ topic: "claims", resource: `/post-purchase/v1/claims/${id}`, ml_user_id: vendedor });
  }
  let ventas = 0;
  if (ventasDesde) {
    // Con las ventas apagadas la base no las registraría: mejor decirlo que contarlas como traídas.
    const { data: activas } = await admin.rpc("ml_ventas_activas");
    if (activas === false) throw new ErrorML("Las ventas de Mercado Libre están apagadas: préndelas en Configuración → Integraciones antes de traerlas.");
    for (let offset = 0; offset < 500; offset += 50) {
      const r = await apiML(e, access, `/orders/search?seller=${vendedor}&order.date_created.from=${ventasDesde}T00:00:00.000-06:00&sort=date_asc&limit=50&offset=${offset}`);
      const lista = (Array.isArray(r.results) ? r.results : []) as Obj[];
      for (const v of lista) { const id = num(v.id); if (id) { avisos.push({ topic: "orders_v2", resource: `/orders/${id}`, ml_user_id: vendedor }); ventas++; } }
      if (lista.length < 50) break;
    }
  }
  // Lo que ya está en la fila sin procesar no se vuelve a formar (el índice lo rechazaría todo).
  const { data: enFila } = await admin.from("ml_avisos").select("topic, resource").is("procesado_en", null);
  const ya = new Set(((enFila ?? []) as { topic: string; resource: string }[]).map((a) => `${a.topic} ${a.resource}`));
  const nuevos = avisos.filter((a) => { const k = `${a.topic} ${a.resource}`; if (ya.has(k)) return false; ya.add(k); return true; });
  if (nuevos.length) {
    const { error } = await admin.from("ml_avisos").insert(nuevos);
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
// Publicaciones y reputación (solo lectura): el tablero de Mercado Libre
// -----------------------------------------------------------------------------
/** Una publicación de ML como la guarda el tablero. */
export function normalizarPublicacion(it: Obj, visitas?: number | null) {
  const envio = o(it.shipping);
  const atributos = (Array.isArray(it.attributes) ? it.attributes : []) as Obj[];
  return {
    item_id: txt(it.id), titulo: txt(it.title), estado: txt(it.status), precio: num(it.price), stock: num(it.available_quantity),
    vendidas: num(it.sold_quantity), visitas_30d: visitas ?? null, fotos: Array.isArray(it.pictures) ? it.pictures.length : null,
    permalink: txt(it.permalink), tipo_publicacion: txt(it.listing_type_id), logistica: txt(envio.logistic_type),
    envio_gratis: envio.free_shipping === true, categoria_id: txt(it.category_id),
    atributos: atributos.length ? atributos.map((a) => ({ nombre: txt(a.name) ?? txt(a.id), valor: txt(a.value_name) })).filter((a) => a.valor) : null,
  };
}

/**
 * Lo que ML cobra por vender a ese precio en esa categoría (GET /sites/MLM/listing_prices), para
 * clásica (gold_special) y premium (gold_pro). La comisión cambia con la categoría y el tipo de
 * publicación; abajo de $299 se suma una cuota fija. Si ML no desglosa la cuota, sale de lo cobrado
 * menos el porcentaje.
 */
export function leerTarifas(r: unknown, precio: number | null) {
  const t: Record<string, { pct: number | null; fijo: number | null }> = {};
  for (const x of (Array.isArray(r) ? r : []) as Obj[]) {
    const tipo = txt(x.listing_type_id); if (!tipo) continue;
    const d = o(x.sale_fee_details);
    const pct = num(d.percentage_fee);
    const total = num(x.sale_fee_amount);
    const fijo = num(d.fixed_fee) ?? (total != null && pct != null && precio != null ? Math.max(0, Math.round((total - precio * pct / 100) * 100) / 100) : null);
    t[tipo] = { pct, fijo };
  }
  return { clasica: t.gold_special ?? null, premium: t.gold_pro ?? null };
}

/** Lo que le cuesta a la cuenta el envío gratis de esa publicación (ya con su descuento por reputación y su peso). */
export function leerEnvio(r: unknown) {
  const todo = o(o(o(r).coverage).all_country);
  return { costo: num(todo.list_cost), peso: num(todo.billable_weight) };
}

/** Las visitas de los últimos 30 días; ML las regresa como lista o como mapa según la versión. */
export function leerVisitas(r: unknown): Map<string, number> {
  const m = new Map<string, number>();
  if (Array.isArray(r)) for (const x of r as Obj[]) { const id = txt(x.item_id); const n = num(x.total_visits); if (id && n != null) m.set(id, n); }
  else for (const [id, n] of Object.entries(o(r))) if (typeof n === "number") m.set(id, n);
  return m;
}

/** La descripción y los atributos de una publicación (para contestar con lo que dice). */
async function traerFicha(e: Entorno, admin: SupabaseClient, access: string, item: string) {
  const [desc, it] = await Promise.all([
    apiML(e, access, `/items/${item}/description`).catch(() => ({} as Obj)),
    apiML(e, access, `/items/${item}?attributes=attributes`).catch(() => ({} as Obj)),
  ]);
  const atributos = normalizarPublicacion(it).atributos;
  await admin.rpc("ml_registrar_descripcion", { p_item: item, p_texto: txt(desc.plain_text) ?? txt(desc.text) ?? "", p_atributos: atributos });
}

/** Como Promise.all, pero de pocos en pocos: ML limita cuántas consultas por segundo acepta. */
async function enParalelo<T, R>(lista: T[], cuantos: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const fuera: R[] = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(cuantos, lista.length) }, async () => {
    while (i < lista.length) { const k = i++; fuera[k] = await fn(lista[k]); }
  }));
  return fuera;
}

export async function publicacionesML(e: Entorno, admin: SupabaseClient) {
  const { cuenta, access } = await token(e, admin);
  const vendedor = cuenta.ml_user_id;
  // Las activas y las pausadas (una pausada con preguntas también importa). Hasta 1,000.
  const ids: string[] = [];
  for (const estado of ["active", "paused"]) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const r = await apiML(e, access, `/users/${vendedor}/items/search?status=${estado}&limit=100&offset=${offset}`);
      const lista = (Array.isArray(r.results) ? r.results : []) as unknown[];
      for (const id of lista) if (typeof id === "string") ids.push(id);
      if (lista.length < 100) break;
    }
  }
  const hoy = new Date(), hace30 = new Date(hoy.getTime() - 30 * 86400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const publicaciones: ReturnType<typeof normalizarPublicacion>[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20);
    const [items, visitas] = await Promise.all([
      apiMLLista(e, access, `/items?ids=${lote.join(",")}&attributes=id,title,status,price,available_quantity,sold_quantity,pictures,permalink,listing_type_id,shipping,attributes,category_id`),
      // Sin visitas el tablero sigue sirviendo: no frena lo demás.
      apiMLLista(e, access, `/visits/items?ids=${lote.join(",")}&date_from=${dia(hace30)}&date_to=${dia(hoy)}`).then(leerVisitas).catch(() => new Map<string, number>()),
    ]);
    // El multiget llega como lista de {code, body}.
    const lista = (Array.isArray(items) ? items : []) as Obj[];
    for (const x of lista) {
      const it = o(x.body ?? x);
      const id = txt(it.id);
      if (id) publicaciones.push(normalizarPublicacion(it, visitas.get(id) ?? null));
    }
  }
  // Lo que cobra ML de verdad en cada una: comisión clásica y premium de su categoría, y lo que
  // cuesta su envío gratis (cambia por peso, reputación y tipo de envío). Si ML no responde, el ERP
  // usa sus valores de respaldo y lo dice.
  const categorias = new Map<string, string | null>();
  const conTarifas = await enParalelo(publicaciones, 5, async (p) => {
    const [tarifas, envio] = await Promise.all([
      p.categoria_id && p.precio != null
        ? apiMLLista(e, access, `/sites/MLM/listing_prices?price=${p.precio}&category_id=${p.categoria_id}&currency_id=MXN`).then((x) => leerTarifas(x, p.precio)).catch(() => null)
        : Promise.resolve(null),
      apiML(e, access, `/users/${vendedor}/shipping_options/free?item_id=${p.item_id}`).then(leerEnvio).catch(() => null),
    ]);
    if (p.categoria_id && !categorias.has(p.categoria_id)) {
      categorias.set(p.categoria_id, null);
      categorias.set(p.categoria_id, await apiML(e, access, `/categories/${p.categoria_id}`).then((c) => txt(c.name)).catch(() => null));
    }
    return { ...p, comision_clasica: tarifas?.clasica?.pct ?? null, fijo_clasica: tarifas?.clasica?.fijo ?? null,
      comision_premium: tarifas?.premium?.pct ?? null, fijo_premium: tarifas?.premium?.fijo ?? null,
      costo_envio: envio?.costo ?? null, peso_facturable: envio?.peso ?? null };
  });
  for (const p of conTarifas) (p as Record<string, unknown>).categoria = p.categoria_id ? categorias.get(p.categoria_id) ?? null : null;
  const { data: n, error } = await admin.rpc("ml_registrar_publicaciones", { p: { publicaciones: conTarifas, completo: true } });
  if (error) throw new ErrorML(error.message);
  // La vuelta automática (pg_cron) necesita saber a dónde llamar; así no se configura a mano.
  await admin.rpc("ml_fijar_url", { p: e.supabaseUrl });
  const yo = await apiML(e, access, `/users/${vendedor}`).catch(() => ({} as Obj));
  if (yo.seller_reputation) await admin.rpc("ml_registrar_reputacion", { p: yo.seller_reputation });
  return { publicaciones: n as number, reputacion: !!yo.seller_reputation };
}

// -----------------------------------------------------------------------------
// Cambios de precio y existencia (fase 2): lo que propone ml_cambios_propuestos()
// -----------------------------------------------------------------------------
export interface CambioML {
  item_id: string; titulo: string | null; campo: "precio" | "existencia"; actual: number; propuesto: number;
  motivo: string; automatico: boolean; por_que_no: string | null;
}
type Resultado = { item_id: string; campo: string; estado: "aplicado" | "omitido" | "error"; detalle: string | null };

/**
 * Lo que se le manda a ML para cambiar una publicación, o por qué no se toca. Se lee la
 * publicación otra vez antes: si su precio o existencia ya no es lo que vio el tablero, alguien la
 * cambió en ML después de la última lectura y no se pisa. Con variantes, el precio va en cada una
 * (ML exige el mismo en todas); la existencia no se puede repartir sola entre variantes.
 */
export function cuerpoCambio(it: Obj, c: Pick<CambioML, "campo" | "actual" | "propuesto">): { cuerpo: Obj } | { omitir: string } {
  const variantes = (Array.isArray(it.variations) ? it.variations : []) as Obj[];
  const ahora = c.campo === "precio" ? num(it.price) : num(it.available_quantity);
  if (ahora == null || Math.abs(ahora - Number(c.actual)) > 0.005) {
    return { omitir: `En Mercado Libre ya está en ${ahora ?? "—"} (el tablero decía ${c.actual}): vuelve a traer las publicaciones` };
  }
  if (c.campo === "precio") {
    return { cuerpo: variantes.length ? { variations: variantes.map((v) => ({ id: v.id, price: c.propuesto })) } : { price: c.propuesto } };
  }
  if (variantes.length > 1) return { omitir: "Tiene variantes: la existencia de cada una se cambia en Mercado Libre" };
  return { cuerpo: variantes.length ? { variations: [{ id: variantes[0].id, available_quantity: c.propuesto }] } : { available_quantity: c.propuesto } };
}

async function aplicarCambios(e: Entorno, admin: SupabaseClient, cambios: CambioML[], origen: "boton" | "automatico", usuario: string | null) {
  const { access } = await token(e, admin);
  // De uno en uno: son pocos y ML limita las escrituras por segundo.
  const resultados: Resultado[] = [];
  for (const c of cambios) {
    let r: Resultado;
    try {
      const it = await apiML(e, access, `/items/${c.item_id}?attributes=id,price,available_quantity,variations`);
      const plan = cuerpoCambio(it, c);
      if ("omitir" in plan) r = { item_id: c.item_id, campo: c.campo, estado: "omitido", detalle: plan.omitir };
      else {
        await apiML(e, access, `/items/${c.item_id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan.cuerpo) });
        r = { item_id: c.item_id, campo: c.campo, estado: "aplicado", detalle: null };
      }
    } catch (err) {
      r = { item_id: c.item_id, campo: c.campo, estado: "error", detalle: err instanceof Error ? err.message : String(err) };
    }
    resultados.push(r);
    await admin.rpc("ml_registrar_cambio", { p: { item_id: c.item_id, titulo: c.titulo, campo: c.campo, antes: c.actual, despues: c.propuesto,
      origen, usuario_id: usuario, estado: r.estado, detalle: r.detalle } });
  }
  const cuenta = (x: Resultado["estado"]) => resultados.filter((r) => r.estado === x).length;
  return { aplicados: cuenta("aplicado"), omitidos: cuenta("omitido"), errores: cuenta("error"), resultados };
}

/** Lo que hace la vuelta de cada hora: leer ML al día y aplicar solo lo seguro de lo que esté prendido. */
export const MAX_AUTOMATICOS = 30;
export async function vueltaAutomatica(e: Entorno, admin: SupabaseClient) {
  const { data: cfg } = await admin.from("configuracion").select("valor").eq("clave", "mercadolibre_automatico").maybeSingle();
  const v = o((cfg as { valor: unknown } | null)?.valor);
  const prendido = { precio: v.precio === true, existencia: v.existencia === true };
  if (!prendido.precio && !prendido.existencia) return { aplicados: 0, omitidos: 0, errores: 0, apagado: true };
  try {
    await publicacionesML(e, admin);
    const { data, error } = await admin.rpc("ml_cambios_propuestos");
    if (error) throw new ErrorML(error.message);
    // Un tope por vuelta: si de pronto hay muchos, algo cambió en grande (un precio de lista mal
    // capturado en todo un grupo) y es mejor que lo vea una persona.
    const todos = ((data ?? []) as CambioML[]).filter((c) => c.automatico && prendido[c.campo]);
    const r = await aplicarCambios(e, admin, todos.slice(0, MAX_AUTOMATICOS), "automatico", null);
    const fuera = Math.max(0, todos.length - MAX_AUTOMATICOS);
    await admin.rpc("ml_registrar_corrida", { p: { aplicados: r.aplicados, omitidos: r.omitidos, errores: r.errores, pendientes: fuera } });
    return { aplicados: r.aplicados, omitidos: r.omitidos, errores: r.errores, pendientes: fuera };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.rpc("ml_registrar_corrida", { p: { error: msg.slice(0, 300) } });
    throw err;
  }
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

  // pg_cron: sin sesión, con la llave que solo conocen la base y esta función.
  if (accion === "automatico" && req.method === "POST") {
    const { data: ok } = await admin.rpc("ml_llave_valida", { p: req.headers.get("x-llave") ?? "" });
    if (ok !== true) return json({ error: "Llave no válida" }, 401);
    const trabajo = vueltaAutomatica(e, admin).catch(() => undefined);
    if (e.enSegundoPlano) { e.enSegundoPlano(trabajo); return json({ ok: true }); }
    return json(await trabajo ?? { ok: false });
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
    if (!(await puede(u.db, "mercadolibre", 2)) && !(await esDireccion(u.db))) return json({ error: "Sin permiso" }, 403);
    // Lo que se agotó en intentos vuelve a la fila cuando alguien lo pide a mano.
    await admin.from("ml_avisos").update({ intentos: 0 }).is("procesado_en", null).gte("intentos", MAX_INTENTOS);
    try { return json(await procesarPendientes(e, admin, 50)); } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "sincronizar") {
    if (!(await puede(u.db, "mercadolibre", 2)) && !(await esDireccion(u.db))) return json({ error: "Sin permiso" }, 403);
    const b = o(await req.json().catch(() => ({})));
    const desde = txt(b.ventas_desde);
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return json({ error: "La fecha va como AAAA-MM-DD" }, 400);
    try { return json(await sincronizar(e, admin, desde ?? null)); } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "publicaciones") {
    if (!(await puede(u.db, "mercadolibre", 1)) && !(await esDireccion(u.db))) return json({ error: "Sin permiso" }, 403);
    try { return json(await publicacionesML(e, admin)); } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "aplicar") {
    const b = o(await req.json().catch(() => ({})));
    const pedidos = (Array.isArray(b.cambios) ? b.cambios : []).map(o)
      .map((x) => ({ item_id: txt(x.item_id), campo: txt(x.campo) })).filter((x) => x.item_id && x.campo);
    if (!pedidos.length) return json({ error: "No elegiste ningún cambio" }, 400);
    if (pedidos.length > 100) return json({ error: "Son demasiados de una vez: hasta 100" }, 400);
    // Con la sesión de quien pide: la base revisa que atienda ML y calcula el valor. Nunca se manda
    // un número que venga de la pantalla, solo el sugerido de la base.
    const { data, error } = await u.db.rpc("ml_cambios_propuestos");
    if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 400);
    const propuestos = (data ?? []) as CambioML[];
    const elegidos = propuestos.filter((c) => pedidos.some((p) => p.item_id === c.item_id && p.campo === c.campo));
    try {
      const r = await aplicarCambios(e, admin, elegidos, "boton", u.id);
      return json({ ...r, ya_no_hacen_falta: pedidos.length - elegidos.length });
    } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  }

  if (accion === "responder") {
    if (!(await puede(u.db, "mercadolibre", 2))) return json({ error: "Contestar preguntas es de quien atiende Mercado Libre" }, 403);
    const b = o(await req.json().catch(() => ({})));
    const id = num(b.pregunta_id), texto = txt(b.texto);
    if (!id || !texto) return json({ error: "Falta la pregunta o la respuesta" }, 400);
    if (texto.length > 2000) return json({ error: "Mercado Libre acepta respuestas de hasta 2,000 caracteres" }, 400);
    try {
      const { access } = await token(e, admin);
      try {
        await apiML(e, access, "/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: id, text: texto }) });
      } catch (err) {
        if (err instanceof ErrorML && /must be active/i.test(err.message)) {
          await admin.rpc("ml_pregunta_sin_publicacion", { p_pregunta: id });
          return json({ error: "La publicación está pausada o cerrada en Mercado Libre: ya no deja contestar esta pregunta. La quité de la lista." }, 409);
        }
        throw err;
      }
      const { error } = await admin.rpc("ml_marcar_contestada", { p_pregunta: id, p_texto: texto, p_usuario: u.id });
      if (error) throw new ErrorML(error.message);
      return json({ ok: true });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  return json({ error: "Ruta no válida" }, 404);
}
