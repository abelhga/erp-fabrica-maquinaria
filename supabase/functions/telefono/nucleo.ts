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
// GET /telefono/contexto?tel=… (fase 2): al empezar una llamada el conmutador pregunta quién llama
// (telefono_contexto: cliente, su vendedor, pedidos abiertos y cotizaciones vivas, sin montos). Lo
// espera 800 ms y, si no llega, la llamada sigue sin contexto: por eso es una sola consulta a la base.
//
// Se despliega sin verificar JWT: el conmutador no tiene sesión del ERP, entra con la llave que
// generó dirección.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string;
  serviceKey: string;
}

/** Lo que manda el conmutador (versión 1). La base vuelve a revisar fechas y números. */
export interface Evento {
  version: 1;
  tipo: "llamada";
  call_sid: string;
  enviado_en?: string | null;
  llamada: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
/** Una llamada con resumen largo y su lead caben de sobra; más que esto no es una foto de llamada. */
export const TOPE_BYTES = 256 * 1024;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const textoONulo = (v: unknown) => v === undefined || v === null || typeof v === "string";

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
  const ld = cuerpo.lead;
  if (!(ld === undefined || ld === null || esObjeto(ld))) return { ok: false, error: "lead debe ser un objeto o null" };
  if (esObjeto(ld)) {
    for (const k of ["nombre", "empresa", "telefono", "correo", "interes", "detalle", "notas"]) {
      if (!textoONulo(ld[k])) return { ok: false, error: `lead.${k} debe ser texto o null` };
    }
  }
  return { ok: true, evento: cuerpo as unknown as Evento };
}

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
  return json({ error: "Ruta no válida" }, 404);
}

async function contexto(req: Request, url: URL, e: Entorno): Promise<Response> {
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);
  const sinPaso = await revisarLlave(req, admin, "una consulta de quién llama");
  if (sinPaso) return sinPaso;
  const tel = url.searchParams.get("tel");
  if (!telefonoValido(tel)) return json({ error: "Teléfono inválido" }, 400);
  const { data, error } = await admin.rpc("telefono_contexto", { p_tel: tel });
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
