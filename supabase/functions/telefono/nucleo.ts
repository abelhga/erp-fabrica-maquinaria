// La puerta del conmutador con IA (hegamex-voz) hacia el ERP. El contrato está en
// docs/integracion-telefono.md y obliga a los dos lados. Dos rutas, las dos con la llave en x-llave:
//
// POST /telefono/evento (fase 1): el conmutador manda la foto completa de cada llamada (al terminar
// y otra vez cuando llega la grabación); aquí solo se revisa la llave y la forma del cuerpo, y la
// base hace todo lo demás (telefono_registrar_evento): ligar el cliente, crear el lead, la actividad
// y lo que hay que regresar. Lo que contesta importa porque el conmutador decide con eso si reintenta:
//   401 llave inválida  → no reintenta hasta que cambie la llave
//   400 cuerpo mal hecho → no reintenta ese envío tal cual
//   5xx                 → reintenta con espera creciente (por eso un error de la base es 500)
//
// Desde la fase 3 la misma foto puede traer `coaching` y `analisis` (y `llamada.historica`): aquí se
// revisa su forma; la base los guarda en sus tablas, cada una con quién la ve, nunca en llamadas.datos.
//
// GET /telefono/contexto?tel=… (fase 2): al empezar una llamada el conmutador pregunta quién llama
// (telefono_contexto: cliente, su vendedor, pedidos abiertos y cotizaciones vivas, sin montos). Lo
// espera 800 ms y, si no llega, la llamada sigue sin contexto: por eso es una sola consulta a la base,
// que corre al mismo tiempo que la revisión de la llave.
//
// POST /telefono/accion (fase 4): lo que el vendedor contesta por WhatsApp («contactado: …», «no
// contestó», «perdido: precio»…). La base reconoce al vendedor por su número y lo aplica como él, con
// las reglas de siempre (telefono_accion). Lo que una regla frena NO es un error: es 200 con
// aplicado:false y el mensaje del ERP, que el conmutador le contesta tal cual. El mismo id (el
// message_sid) dos veces regresa la misma respuesta. 400 cuerpo mal hecho, 401 llave, 500 lo demás
// (el conmutador lo encola y reintenta).
//
// GET /telefono/resumen?tel=… (fase 4): el resumen de la mañana de ese vendedor, sacado de sus
// pendientes del ERP (telefono_resumen), sin montos y con la liga a «A quién llamar hoy».
//
// Las ligas al ERP se arman aquí con APP_URL: la base solo sabe la ruta.
//
// Se despliega sin verificar JWT: el conmutador no tiene sesión del ERP, entra con la llave que
// generó dirección.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string;
  serviceKey: string;
  /** La dirección del ERP para las ligas que viajan por WhatsApp (APP_URL). */
  appUrl?: string;
}

const APP_URL = "https://erp.hegamex.com";

/** Fase 4: lo que manda el conmutador por cada respuesta de WhatsApp (versión 1). */
export interface Accion {
  version: 1;
  tipo: "accion";
  id: string;
  quien: { telefono: string; nombre?: string | null };
  lead: { erp_id?: string | null; call_sid?: string | null };
  accion: (typeof ACCIONES)[number];
  texto?: string | null;
  motivo?: string | null;
  cuando?: string | null;
  canal?: "llamada" | "whatsapp" | "correo" | "visita" | null;
}
export const ACCIONES = ["tomar", "contactado", "no_contesto", "nota", "cotizado", "cerrado", "perdido", "recordar", "soltar"] as const;
const CANALES = ["llamada", "whatsapp", "correo", "visita"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Una respuesta de WhatsApp: hasta 1000 de texto más poquito; más que esto no es un mensaje. */
export const TOPE_ACCION = 16 * 1024;

/** Lo que manda el conmutador (versión 1). La base vuelve a revisar fechas y números. */
export interface Evento {
  version: 1;
  tipo: "llamada";
  call_sid: string;
  enviado_en?: string | null;
  llamada: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
  /** Fase 3. Ausente = el ERP no toca lo que tenía; null = lo borra; objeto = lo reemplaza completo. */
  coaching?: Record<string, unknown> | null;
  analisis?: Record<string, unknown> | null;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
/** Una llamada con resumen largo y su lead caben de sobra; más que esto no es una foto de llamada. */
export const TOPE_BYTES = 256 * 1024;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const textoONulo = (v: unknown) => v === undefined || v === null || typeof v === "string";
const vacio = (v: unknown) => v === undefined || v === null;
const textoHasta = (v: unknown, max: number) => vacio(v) || (typeof v === "string" && v.length <= max);
const numeroEntre = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
/** Una lista opcional de textos: hasta `n`, cada uno de hasta `max` caracteres. */
const textos = (v: unknown, n: number, max: number) => vacio(v) || (Array.isArray(v) && v.length <= n && v.every((t) => typeof t === "string" && t.length <= max));
/** Una lista opcional de objetos: hasta `n`, y cada uno cumple `ok`. */
const objetos = (v: unknown, n: number, ok: (o: Record<string, unknown>) => boolean) =>
  vacio(v) || (Array.isArray(v) && v.length <= n && v.every((o) => esObjeto(o) && ok(o)));
const conClave = (o: Record<string, unknown>) => typeof o.clave === "string" && o.clave.length > 0 && o.clave.length <= 60 && textoHasta(o.nombre, 120);

/**
 * Fase 3: la forma del coaching (docs/integracion-telefono.md). Los tamaños son los del contrato: el
 * conmutador ya los respeta, y algo más grande es un error suyo que conviene ver (queda anotado) en vez
 * de guardarlo recortado sin que nadie sepa. La calificación la calcula el conmutador: aquí solo se
 * revisa que esté en la escala.
 */
function validarCoaching(co: unknown): string | null {
  if (co === null) return null;
  if (!esObjeto(co)) return "coaching debe ser un objeto o null";
  if (!numeroEntre(co.calificacion, 1, 10)) return "coaching.calificacion debe ser un número de 1 a 10";
  if (!(vacio(co.calificacion_sin_topes) || numeroEntre(co.calificacion_sin_topes, 0, 10))) return "coaching.calificacion_sin_topes debe ser un número de 0 a 10 o null";
  if (co.atendio_tipo !== "persona" && co.atendio_tipo !== "ia") return "coaching.atendio_tipo debe ser \"persona\" o \"ia\"";
  if (!(vacio(co.rubrica) || (esObjeto(co.rubrica) && textoHasta(co.rubrica.clave, 60) && (vacio(co.rubrica.version) || Number.isInteger(co.rubrica.version))))) {
    return "coaching.rubrica debe ser {clave, version entera} o null";
  }
  if (!Array.isArray(co.criterios)) return "coaching.criterios debe ser una lista";
  if (!objetos(co.criterios, 30, (c) => conClave(c) && (vacio(c.peso) || numeroEntre(c.peso, 0, 100))
      && (vacio(c.nota) || (Number.isInteger(c.nota) && numeroEntre(c.nota, 0, 10))) && textoHasta(c.evidencia, 200)
      && (vacio(c.segundo) || numeroEntre(c.segundo, 0, 86_400)))) {
    return "coaching.criterios: hasta 30, cada uno {clave, nombre, peso 0–100, nota entera 0–10, evidencia ≤ 200, segundo}";
  }
  if (!objetos(co.topes, 20, (t) => conClave(t) && (vacio(t.maximo) || numeroEntre(t.maximo, 0, 10)))) return "coaching.topes: hasta 20 {clave, nombre, maximo 0–10}";
  if (!objetos(co.fallos, 5, (f) => conClave(f) && textoHasta(f.texto, 300))) return "coaching.fallos: hasta 5 {clave, nombre, texto ≤ 300}";
  if (!objetos(co.tono, 5, (t) => conClave(t) && (t.signo === 1 || t.signo === -1) && textoHasta(t.texto, 300))) {
    return "coaching.tono: hasta 5 {clave, nombre, signo 1 o -1, texto ≤ 300}";
  }
  for (const k of ["lo_bueno", "a_mejorar", "sugerencias"]) {
    if (!textos(co[k], 3, 300)) return `coaching.${k}: hasta 3 textos de 300 caracteres`;
  }
  if (!textoHasta(co.resumen, 600)) return "coaching.resumen debe ser texto de hasta 600 caracteres o null";
  if (!textoHasta(co.modelo, 100) || !textoONulo(co.generado_en)) return "coaching.modelo y coaching.generado_en deben ser texto o null";
  return null;
}

/** Fase 3: la forma del análisis. Sin listas cerradas de intención o desenlace: un valor nuevo del conmutador no debe tirar la llamada. */
function validarAnalisis(an: unknown): string | null {
  if (an === null) return null;
  if (!esObjeto(an)) return "analisis debe ser un objeto o null";
  for (const k of ["intencion", "desenlace", "fuente_transcripcion"]) if (!textoHasta(an[k], 40)) return `analisis.${k} debe ser texto corto o null`;
  if (!objetos(an.equipos, 20, (e) => textoHasta(e.texto, 120) && textoHasta(e.clave_catalogo, 60))) {
    return "analisis.equipos: hasta 20 {texto ≤ 120, clave_catalogo o null}";
  }
  if (!textos(an.preguntas_sin_respuesta, 5, 300)) return "analisis.preguntas_sin_respuesta: hasta 5 textos de 300 caracteres";
  if (!objetos(an.objeciones, 10, (o) => textoHasta(o.categoria, 40) && textoHasta(o.texto, 300))) {
    return "analisis.objeciones: hasta 10 {categoria, texto ≤ 300}";
  }
  if (!(vacio(an.stt_dudoso) || typeof an.stt_dudoso === "boolean")) return "analisis.stt_dudoso debe ser true, false o null";
  if (!textoHasta(an.modelo, 100) || !textoONulo(an.generado_en)) return "analisis.modelo y analisis.generado_en deben ser texto o null";
  return null;
}

/** Revisa la forma del cuerpo. Devuelve el error en español para el 400 (el conmutador lo anota). */
export function validar(cuerpo: unknown): { ok: true; evento: Evento } | { ok: false; error: string } {
  if (!esObjeto(cuerpo)) return { ok: false, error: "El cuerpo debe ser un objeto JSON" };
  if (cuerpo.version !== 1) return { ok: false, error: `Versión no soportada: ${JSON.stringify(cuerpo.version ?? null)} (se espera 1)` };
  if (cuerpo.tipo !== "llamada") return { ok: false, error: `Tipo no soportado: ${JSON.stringify(cuerpo.tipo ?? null)} (se espera "llamada")` };
  if (typeof cuerpo.call_sid !== "string" || !cuerpo.call_sid.trim() || cuerpo.call_sid.length > 100) {
    return { ok: false, error: "call_sid debe ser un texto de 1 a 100 caracteres" };
  }
  if (!textoONulo(cuerpo.enviado_en)) return { ok: false, error: "enviado_en debe ser texto o null" };
  const ll = cuerpo.llamada;
  if (!esObjeto(ll)) return { ok: false, error: "Falta «llamada» (objeto)" };
  for (const k of ["telefono", "inicio", "fin", "estado", "area", "area_nombre", "atendio_ia", "resumen", "grabacion_url", "grabacion_vence"]) {
    if (!textoONulo(ll[k])) return { ok: false, error: `llamada.${k} debe ser texto o null` };
  }
  if (!(ll.duracion_seg === undefined || ll.duracion_seg === null || (Number.isInteger(ll.duracion_seg) && (ll.duracion_seg as number) >= 0))) {
    return { ok: false, error: "llamada.duracion_seg debe ser un entero de segundos o null" };
  }
  if (!(ll.nadie_contesto === undefined || ll.nadie_contesto === null || typeof ll.nadie_contesto === "boolean")) {
    return { ok: false, error: "llamada.nadie_contesto debe ser true, false o null" };
  }
  if (!(ll.atendio === undefined || ll.atendio === null || (esObjeto(ll.atendio) && textoONulo(ll.atendio.nombre) && textoONulo(ll.atendio.telefono)))) {
    return { ok: false, error: "llamada.atendio debe ser {nombre, telefono} o null" };
  }
  if (!(vacio(ll.historica) || typeof ll.historica === "boolean")) return { ok: false, error: "llamada.historica debe ser true, false o null" };
  const ld = cuerpo.lead;
  if (!(ld === undefined || ld === null || esObjeto(ld))) return { ok: false, error: "lead debe ser un objeto o null" };
  if (esObjeto(ld)) {
    for (const k of ["nombre", "empresa", "telefono", "correo", "ciudad", "estado", "interes", "detalle", "notas"]) {
      if (!textoONulo(ld[k])) return { ok: false, error: `lead.${k} debe ser texto o null` };
    }
  }
  if ("coaching" in cuerpo) { const e = validarCoaching(cuerpo.coaching); if (e) return { ok: false, error: e }; }
  if ("analisis" in cuerpo) { const e = validarAnalisis(cuerpo.analisis); if (e) return { ok: false, error: e }; }
  return { ok: true, evento: cuerpo as unknown as Evento };
}

/** Fase 4: revisa la forma de una acción. La base lo vuelve a revisar (22023 → 400). */
export function validarAccion(cuerpo: unknown): { ok: true; accion: Accion } | { ok: false; error: string } {
  if (!esObjeto(cuerpo)) return { ok: false, error: "El cuerpo debe ser un objeto JSON" };
  if (cuerpo.version !== 1) return { ok: false, error: `Versión no soportada: ${JSON.stringify(cuerpo.version ?? null)} (se espera 1)` };
  if (cuerpo.tipo !== "accion") return { ok: false, error: `Tipo no soportado: ${JSON.stringify(cuerpo.tipo ?? null)} (se espera "accion")` };
  if (typeof cuerpo.id !== "string" || !cuerpo.id.trim() || cuerpo.id.length > 100) return { ok: false, error: "id debe ser el message_sid (1 a 100 caracteres)" };
  const qn = cuerpo.quien;
  if (!esObjeto(qn) || typeof qn.telefono !== "string" || !telefonoValido(qn.telefono)) return { ok: false, error: "quien.telefono debe traer 10 dígitos o más" };
  if (!textoHasta(qn.nombre, 120)) return { ok: false, error: "quien.nombre debe ser texto o null" };
  const ld = cuerpo.lead;
  if (!esObjeto(ld)) return { ok: false, error: "Falta «lead» (objeto con erp_id o call_sid)" };
  if (!(vacio(ld.erp_id) || (typeof ld.erp_id === "string" && UUID.test(ld.erp_id)))) return { ok: false, error: "lead.erp_id debe ser un uuid o null" };
  if (!(vacio(ld.call_sid) || (typeof ld.call_sid === "string" && ld.call_sid.length <= 100))) return { ok: false, error: "lead.call_sid debe ser texto o null" };
  if (vacio(ld.erp_id) && (vacio(ld.call_sid) || !(ld.call_sid as string).trim())) return { ok: false, error: "lead necesita erp_id o call_sid" };
  if (!(ACCIONES as readonly unknown[]).includes(cuerpo.accion)) return { ok: false, error: `Acción no soportada: ${JSON.stringify(cuerpo.accion ?? null)}` };
  if (!textoHasta(cuerpo.texto, 1000)) return { ok: false, error: "texto debe ser texto de hasta 1000 caracteres o null" };
  if (!textoHasta(cuerpo.motivo, 300)) return { ok: false, error: "motivo debe ser texto de hasta 300 caracteres o null" };
  if (!(vacio(cuerpo.canal) || CANALES.includes(cuerpo.canal as string))) return { ok: false, error: "canal debe ser llamada, whatsapp, correo, visita o null" };
  if (!(vacio(cuerpo.cuando) || (typeof cuerpo.cuando === "string" && !Number.isNaN(Date.parse(cuerpo.cuando))))) {
    return { ok: false, error: "cuando debe ser una fecha ISO (2026-11-12T09:00:00-06:00) o null" };
  }
  return { ok: true, accion: cuerpo as unknown as Accion };
}

/** La ruta del ERP que regresa la base, como liga completa para WhatsApp. */
const liga = (e: Entorno, ruta: unknown) => (typeof ruta === "string" && ruta.startsWith("/") ? `${(e.appUrl || APP_URL).replace(/\/+$/, "")}${ruta}` : null);

/** Lo que no se pudo guardar se anota para que dirección lo vea en Integraciones. Nunca tumba la respuesta. */
async function anotar(admin: SupabaseClient, error: string) {
  try { await admin.rpc("telefono_anotar_error", { p: error }); } catch { /* sin anotar, la respuesta igual sale */ }
}

/**
 * La llave del conmutador, igual en las dos rutas. Devuelve la respuesta de error (401/500) o null
 * si pasa. Una llave corta ni se le pregunta a la base. `que` dice en el aviso a dirección qué llegó.
 */
async function revisarLlave(req: Request, admin: SupabaseClient, que: string): Promise<Response | null> {
  const llave = req.headers.get("x-llave") ?? "";
  if (llave.length < 32) return json({ error: "Llave inválida" }, 401);
  const { data: valida, error } = await admin.rpc("telefono_llave_valida", { p: llave });
  if (error) return json({ error: "No se pudo revisar la llave" }, 500);
  if (valida !== true) {
    await anotar(admin, `Llegó ${que} con una llave que no es la vigente: revisa ERP_LLAVE en el conmutador.`);
    return json({ error: "Llave inválida" }, 401);
  }
  return null;
}

/** Un teléfono sirve si trae 10 dígitos o más (la base compara los últimos 10, telefono10). */
export const telefonoValido = (tel: string | null) => (tel ?? "").replace(/\D/g, "").length >= 10;

export async function atender(req: Request, e: Entorno): Promise<Response> {
  const url = new URL(req.url);
  const ruta = url.pathname.split("/").filter(Boolean).pop();
  if (req.method === "POST" && ruta === "evento") return evento(req, e);
  if (req.method === "GET" && ruta === "contexto") return contexto(req, url, e);
  if (req.method === "POST" && ruta === "accion") return accion(req, e);
  if (req.method === "GET" && ruta === "resumen") return resumen(req, url, e);
  return json({ error: "Ruta no válida" }, 404);
}

async function accion(req: Request, e: Entorno): Promise<Response> {
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const sinPaso = await revisarLlave(req, admin, "una respuesta de WhatsApp");
  if (sinPaso) return sinPaso;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TOPE_ACCION) return json({ error: "Cuerpo demasiado grande" }, 400);
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(texto); } catch { return json({ error: "El cuerpo no es JSON válido" }, 400); }
  const v = validarAccion(cuerpo);
  if (!v.ok) { await anotar(admin, `Respuesta de WhatsApp rechazada: ${v.error}`); return json({ error: v.error }, 400); }
  const { data, error } = await admin.rpc("telefono_accion", { p: v.accion });
  if (error) {
    const deDatos = typeof error.code === "string" && error.code.startsWith("22");
    // Sin el teléfono ni el texto en el aviso: dirección ve que falló, no lo que escribió el vendedor.
    await anotar(admin, `No se pudo aplicar la respuesta de WhatsApp ${v.accion.id} (${v.accion.accion}): ${error.message}`);
    return json({ error: deDatos ? error.message : "No se pudo aplicar; se puede reintentar" }, deDatos ? 400 : 500);
  }
  const r = data as { aplicado: boolean; mensaje: string; lead: Record<string, unknown> | null; ruta: string | null };
  return json({ ok: true, aplicado: r.aplicado === true, mensaje: r.mensaje, lead: r.lead ?? null, liga: liga(e, r.ruta) });
}

async function resumen(req: Request, url: URL, e: Entorno): Promise<Response> {
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const sinPaso = await revisarLlave(req, admin, "una consulta del resumen de la mañana");
  if (sinPaso) return sinPaso;
  const tel = url.searchParams.get("tel");
  if (!telefonoValido(tel)) return json({ error: "Teléfono inválido" }, 400);
  const { data, error } = await admin.rpc("telefono_resumen", { p_tel: tel });
  if (error) {
    if (error.code === "22023") return json({ error: "Teléfono inválido" }, 400);
    await anotar(admin, `No se pudo armar el resumen de la mañana: ${error.message}`);
    return json({ error: "No se pudo armar el resumen" }, 500);
  }
  const r = data as { vendedor: string | null; texto: string | null; ruta?: string | null };
  const l = r.texto ? liga(e, r.ruta) : null;
  return json({ ok: true, vendedor: r.vendedor ?? null, texto: r.texto ? `${r.texto}${l ? `\n\nA quién llamar hoy: ${l}` : ""}` : null });
}

async function contexto(req: Request, url: URL, e: Entorno): Promise<Response> {
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const tel = url.searchParams.get("tel");
  // Sin llave, o con una corta, ni se le pregunta a la base (tampoco «al mismo tiempo»).
  if ((req.headers.get("x-llave") ?? "").length < 32 || !telefonoValido(tel)) {
    const sinPaso = await revisarLlave(req, admin, "una consulta de quién llama");
    return sinPaso ?? json({ error: "Teléfono inválido" }, 400);
  }
  // La llave y la consulta van AL MISMO TIEMPO: la base del ERP puede estar lejos de donde corre la
  // función (la de Hegamex está en California y la función en Virginia, junto al conmutador), y una
  // detrás de otra eran dos viajes que se comían los 800 ms que espera la llamada. Lo consultado solo
  // sale si la llave pasa; si no, se tira sin leerlo.
  const [sinPaso, { data, error }] = await Promise.all([
    revisarLlave(req, admin, "una consulta de quién llama"),
    admin.rpc("telefono_contexto", { p_tel: tel }),
  ]);
  if (sinPaso) return sinPaso;
  if (error) {
    if (error.code === "22023") return json({ error: "Teléfono inválido" }, 400);
    // Sin el teléfono en el aviso: dirección ve que falló, no a quién se buscaba.
    await anotar(admin, `No se pudo contestar quién llama: ${error.message}`);
    return json({ error: "No se pudo consultar quién llama" }, 500);
  }
  return json(data);
}

async function evento(req: Request, e: Entorno): Promise<Response> {
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const sinPaso = await revisarLlave(req, admin, "un aviso");
  if (sinPaso) return sinPaso;

  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TOPE_BYTES) return json({ error: "Cuerpo demasiado grande" }, 400);
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(texto); } catch { return json({ error: "El cuerpo no es JSON válido" }, 400); }
  const v = validar(cuerpo);
  if (!v.ok) { await anotar(admin, `Aviso rechazado: ${v.error}`); return json({ error: v.error }, 400); }

  const { data, error } = await admin.rpc("telefono_registrar_evento", { p: v.evento });
  if (error) {
    // 22xxx = un dato mal escrito (fecha, número): reintentarlo igual no sirve.
    const deDatos = typeof error.code === "string" && error.code.startsWith("22");
    await anotar(admin, `${v.evento.call_sid}: ${error.message}`);
    return json({ error: deDatos ? error.message : "No se pudo guardar la llamada; se puede reintentar" }, deDatos ? 400 : 500);
  }
  const r = data as { llamada_id: string; lead_id: string | null; cliente_id: string | null };
  return json({ ok: true, llamada_id: r.llamada_id, lead_id: r.lead_id ?? null, cliente_id: r.cliente_id ?? null });
}
