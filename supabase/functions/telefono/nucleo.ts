// La puerta del conmutador con IA (hegamex-voz) hacia el ERP. El conmutador manda la foto completa
// de cada llamada (al terminar y otra vez cuando llega la grabación); aquí solo se revisa la llave
// y la forma del cuerpo, y la base hace todo lo demás (telefono_registrar_evento): ligar el
// cliente, crear el lead, la actividad y lo que hay que regresar. El contrato está en
// docs/integracion-telefono.md y obliga a los dos lados.
//
// Lo que contesta importa porque el conmutador decide con eso si reintenta:
//   401 llave inválida  → no reintenta hasta que cambie la llave
//   400 cuerpo mal hecho → no reintenta ese envío tal cual
//   5xx                 → reintenta con espera creciente (por eso un error de la base es 500)
//
// Ruta: POST /telefono/evento con la llave en x-llave. Se despliega sin verificar JWT: el
// conmutador no tiene sesión del ERP, entra con la llave que generó dirección.
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

export async function atender(req: Request, e: Entorno): Promise<Response> {
  const ruta = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if (req.method !== "POST" || ruta !== "evento") return json({ error: "Ruta no válida" }, 404);
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);

  const llave = req.headers.get("x-llave") ?? "";
  if (llave.length < 32) return json({ error: "Llave inválida" }, 401);
  const { data: valida, error: errLlave } = await admin.rpc("telefono_llave_valida", { p: llave });
  if (errLlave) return json({ error: "No se pudo revisar la llave" }, 500);
  if (valida !== true) {
    await anotar(admin, "Llegó un aviso con una llave que no es la vigente: revisa ERP_LLAVE en el conmutador.");
    return json({ error: "Llave inválida" }, 401);
  }

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
