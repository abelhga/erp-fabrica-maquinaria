// Skydropx ↔ ERP. Rutas (la última parte de la URL), todas POST y con la sesión de quien da el clic:
//   probar     saldo y plantillas de dirección (para elegir el origen)        envíos 3
//   catalogo   buscar claves de carta porte o de empaque del SAT              envíos 3
//   saldo      el saldo real de la cuenta de Skydropx                         envíos 2 o finanzas 1
//   cotizar    {envio_id} → tarifas de todas las paqueterías                  envíos 2
//   generar    {envio_id, tarifa_id} → guía pagada, PDF en el envío           envíos 2
//   revisar    {envio_id} → termina una guía que Skydropx tardó en entregar   envíos 2
//
// Reglas:
//   * La cuenta es de PRODUCCIÓN: generar cobra. Por eso la tarifa se vuelve a leer de la
//     cotización de ESTE envío (no se le cree al precio que manda la pantalla), se pide con
//     unique_shipment (un reintento con la misma tarifa regresa la misma guía) y en cuanto
//     Skydropx la acepta se apunta en el envío: un segundo clic revisa esa, no compra otra.
//   * Todo lo de la base va con la sesión del usuario: la guía queda a su nombre y la RLS de
//     envíos y del bucket sigue mandando. Lo que se registra lo deciden las funciones de la
//     migración 120, que terminan en cotizar_envio/registrar_guia como la captura a mano.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string; supabaseAnonKey: string;
  clientId?: string; clientSecret?: string;
  /** Para las pruebas: la API de Skydropx falsa y una espera que no espera. */
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
}

export const API_SKY = "https://api-pro.skydropx.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

class ErrorSky extends Error { constructor(msg: string, readonly status = 400) { super(msg); } }

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

// -----------------------------------------------------------------------------
// Traducciones del ERP a Skydropx y de regreso
// -----------------------------------------------------------------------------
export interface Bulto { peso_kg: number | null; largo_cm: number | null; ancho_cm: number | null; alto_cm: number | null }
export interface EnvioERP {
  id: string; folio: string; tipo: string; abierto: boolean; numero_guia: string | null;
  destinatario: string | null; telefono: string | null; cliente: string | null;
  dest_cp: string | null; dest_estado: string | null; dest_municipio: string | null; dest_colonia: string | null;
  dest_calle: string | null; dest_referencia: string | null; dest_empresa: string | null; dest_correo: string | null;
  skydropx_cotizacion_id: string | null; skydropx_envio_id: string | null; servicio: string | null;
}
export interface ConfigSky {
  origen_plantilla_id: string | null; carta_porte: string | null; tipo_empaque: string | null; formato: string | null;
  origen: { postal_code?: string; area_level1?: string; area_level2?: string; area_level3?: string; street1?: string;
            name?: string; company?: string; phone?: string; email?: string; reference?: string } | null;
}

/** Skydropx pide centímetros enteros y al menos 1 kg: se redondea hacia arriba (redondear abajo es pagar sobrepeso después). */
export function parcels(bultos: Bulto[]) {
  return bultos.map((b) => ({
    length: Math.max(1, Math.ceil(Number(b.largo_cm))), width: Math.max(1, Math.ceil(Number(b.ancho_cm))),
    height: Math.max(1, Math.ceil(Number(b.alto_cm))), weight: Math.max(1, Math.ceil(Number(b.peso_kg) * 10) / 10),
  }));
}

/** Lo que impide cotizar, en palabras de quien lo va a arreglar. */
export function faltaParaCotizar(e: EnvioERP, bultos: Bulto[], cfg: ConfigSky | null): string | null {
  if (e.tipo !== "paqueteria") return "Skydropx solo cotiza envíos por paquetería.";
  if (!e.abierto) return `${e.folio} ya no está abierto.`;
  if (e.numero_guia) return `${e.folio} ya tiene guía.`;
  if (!cfg?.origen?.postal_code) return "Falta elegir la dirección de origen en Configuración → Integraciones → Skydropx.";
  if (!e.dest_cp || !e.dest_estado || !e.dest_municipio || !e.dest_colonia) return "Primero guarda el destino con CP, estado, municipio y colonia.";
  if (bultos.length === 0) return "El envío no tiene bultos: captura al menos uno con su peso y medidas.";
  const sin = bultos.filter((b) => !b.peso_kg || !b.largo_cm || !b.ancho_cm || !b.alto_cm).length;
  if (sin) return sin === 1 ? "A un bulto le falta peso o medidas." : `A ${sin} bultos les falta peso o medidas.`;
  return null;
}

export function cotizacion(e: EnvioERP, bultos: Bulto[], cfg: ConfigSky) {
  const g = cfg.origen!;
  return {
    quotation: {
      address_from: { ...(cfg.origen_plantilla_id ? { address_template_id: cfg.origen_plantilla_id } : {}),
        country_code: "MX", postal_code: g.postal_code, area_level1: g.area_level1, area_level2: g.area_level2, area_level3: g.area_level3 },
      address_to: { country_code: "MX", postal_code: e.dest_cp, area_level1: e.dest_estado, area_level2: e.dest_municipio, area_level3: e.dest_colonia },
      parcels: parcels(bultos),
    },
  };
}

export interface Tarifa { id: string; paqueteria: string; servicio: string; total: number; dias: number | null; recoleccion: boolean }

/** Solo las tarifas que sí salieron, de la más barata a la más cara. */
export function tarifas(cot: Obj): Tarifa[] {
  return lista(cot.rates).map(o)
    .filter((r) => r.success === true && num(r.total) != null && txt(r.id))
    .map((r) => ({
      id: txt(r.id)!, paqueteria: txt(r.provider_display_name) ?? txt(r.provider_name) ?? "Paquetería",
      servicio: txt(r.provider_service_name) ?? "", total: num(r.total)!, dias: num(r.days), recoleccion: r.pickup === true,
    }))
    .sort((a, b) => a.total - b.total || (a.dias ?? 99) - (b.dias ?? 99));
}

/** El cuerpo para comprar la guía. En México el número va dentro de street1. */
export function envioSky(e: EnvioERP, bultos: Bulto[], cfg: ConfigSky, rateId: string) {
  const g = cfg.origen!;
  const quita = (x: Obj) => Object.fromEntries(Object.entries(x).filter(([, v]) => v != null && v !== ""));
  return {
    shipment: {
      rate_id: rateId, unique_shipment: true, printing_format: cfg.formato === "thermal" ? "thermal" : "standard",
      address_from: quita({ address_template_id: cfg.origen_plantilla_id, street1: g.street1, name: g.name, company: g.company,
        phone: g.phone, email: g.email, reference: g.reference }),
      address_to: quita({ street1: e.dest_calle, name: e.destinatario, company: e.dest_empresa || e.cliente || e.destinatario,
        phone: e.telefono, email: e.dest_correo || g.email, reference: e.dest_referencia }),
      packages: bultos.map((_, i) => ({ package_number: String(i + 1), consignment_note: cfg.carta_porte, package_type: cfg.tipo_empaque || "4G" })),
    },
  };
}

/** GET /shipments/{id}: en qué va y, si ya está, las etiquetas. */
export function leerEnvio(d: Obj) {
  const a = o(o(d.data).attributes);
  const paquetes = lista(d.included).map(o).filter((x) => txt(x.type) === "package").map((x) => o(x.attributes));
  const estado = (txt(a.workflow_status) ?? "").toLowerCase();
  const etiquetas = paquetes.map((p) => txt(p.label_url)).filter((u): u is string => !!u);
  const err = o(a.error_detail);
  return {
    id: txt(o(d.data).id) ?? txt(a.id),
    listo: estado === "success" && paquetes.length > 0 && etiquetas.length === paquetes.length,
    fallo: ["failed", "error", "cancelled", "canceled"].includes(estado),
    error: txt(err.error_message_detail) ?? txt(err.error_message) ?? null,
    numero: txt(a.master_tracking_number) ?? txt(paquetes[0]?.tracking_number),
    rastreo: txt(paquetes[0]?.tracking_url_provider),
    costo: num(a.total),
    paqueteria: txt(a.carrier_name),
    etiquetas,
  };
}

/** Los errores de Skydropx vienen como texto o como {campo: [mensajes]}. */
function mensajeError(d: Obj, status: number) {
  const e = d.errors ?? d.error ?? d.message;
  if (typeof e === "string") return e;
  const partes = Object.entries(o(e)).map(([k, v]) => `${k}: ${lista(v).map(String).join(", ") || String(v)}`);
  return partes.join(" · ") || `Skydropx respondió ${status}`;
}

// -----------------------------------------------------------------------------
// La API (token en memoria; Skydropx lo da por 2 horas)
// -----------------------------------------------------------------------------
let token: { clave: string; valor: string; vence: number } | null = null;

async function api(e: Entorno, ruta: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; d: Obj }> {
  if (!e.clientId || !e.clientSecret) throw new ErrorSky("Faltan SKYDROPX_CLIENT_ID y SKYDROPX_CLIENT_SECRET en Supabase → Edge Functions → Secrets.", 400);
  const f = e.fetch ?? fetch;
  if (!token || token.clave !== e.clientId || token.vence - Date.now() < 5 * 60_000) {
    const r = await f(`${API_SKY}/api/v1/oauth/token`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: e.clientId, client_secret: e.clientSecret, grant_type: "client_credentials" }),
    });
    const d = o(await r.json().catch(() => ({})));
    if (!r.ok || !txt(d.access_token)) {
      throw new ErrorSky(r.status === 401 ? "Skydropx no reconoce las credenciales: revisa SKYDROPX_CLIENT_ID y SKYDROPX_CLIENT_SECRET." : `Skydropx no dio acceso (${r.status}).`, 502);
    }
    token = { clave: e.clientId, valor: txt(d.access_token)!, vence: Date.now() + (num(d.expires_in) ?? 7200) * 1000 };
  }
  const r = await f(`${API_SKY}${ruta}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token.valor}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401) token = null;
  return { status: r.status, d: o(await r.json().catch(() => ({}))) };
}

// -----------------------------------------------------------------------------
// Lo del ERP, con la sesión del usuario
// -----------------------------------------------------------------------------
async function quien(req: Request, e: Entorno) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
  const { data } = await db.auth.getUser(auth.slice(7));
  return data.user ? { id: data.user.id, db } : null;
}
const puede = async (db: SupabaseClient, modulo: string, nivel: number) => (await db.rpc("puede", { p_modulo: modulo, p_nivel: nivel })).data === true;

async function rpc(db: SupabaseClient, fn: string, args: Obj) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new ErrorSky(error.message, error.code === "42501" ? 403 : 400);
  return data;
}

async function cargar(db: SupabaseClient, envioId: string) {
  const [env, bul, cfg] = await Promise.all([
    db.from("v_envios").select("id, folio, tipo, abierto, numero_guia, destinatario, telefono, cliente, dest_cp, dest_estado, dest_municipio, dest_colonia, dest_calle, dest_referencia, dest_empresa, dest_correo, skydropx_cotizacion_id, skydropx_envio_id, servicio").eq("id", envioId).maybeSingle(),
    db.from("envio_bultos").select("peso_kg, largo_cm, ancho_cm, alto_cm").eq("envio_id", envioId).order("orden"),
    db.from("configuracion").select("valor").eq("clave", "skydropx").maybeSingle(),
  ]);
  if (!env.data) throw new ErrorSky("No existe el envío", 404);
  return { envio: env.data as EnvioERP, bultos: (bul.data ?? []) as Bulto[], cfg: (cfg.data?.valor ?? null) as ConfigSky | null };
}

/** Consulta hasta que `listo` diga que ya, o se acabe el tiempo. */
async function hastaQue<T>(e: Entorno, leer: () => Promise<T>, listo: (x: T) => boolean, intentos: number, ms: number) {
  const esperar = e.esperar ?? ((t: number) => new Promise<void>((r) => setTimeout(r, t)));
  let x = await leer();
  for (let i = 1; i < intentos && !listo(x); i++) { await esperar(ms); x = await leer(); }
  return x;
}

/** Baja las etiquetas, las sube al envío y registra la guía. */
async function terminarGuia(e: Entorno, db: SupabaseClient, envio: EnvioERP, g: ReturnType<typeof leerEnvio>, servicio: string | null) {
  const rutas: string[] = [];
  for (const url of g.etiquetas) {
    const r = await (e.fetch ?? fetch)(url);
    if (!r.ok) throw new ErrorSky(`No se pudo bajar el PDF de la guía (${r.status}). Vuelve a dar "Revisar guía".`, 502);
    const ruta = `envios/${envio.id}/${crypto.randomUUID()}.pdf`;
    const { error } = await db.storage.from("envios").upload(ruta, new Uint8Array(await r.arrayBuffer()), { contentType: "application/pdf" });
    if (error) throw new ErrorSky(`No se pudo guardar el PDF: ${error.message}`, 500);
    rutas.push(ruta);
  }
  if (!g.numero) throw new ErrorSky("Skydropx no dio el número de guía todavía. Vuelve a dar \"Revisar guía\".", 502);
  if (g.costo == null) throw new ErrorSky("Skydropx no dio el costo de la guía todavía. Vuelve a dar \"Revisar guía\".", 502);
  await rpc(db, "registrar_guia_skydropx", {
    p_envio: envio.id, p_envio_skydropx: g.id, p_numero: g.numero, p_rutas: rutas, p_costo: g.costo,
    p_servicio: servicio ?? envio.servicio ?? g.paqueteria, p_rastreo_url: g.rastreo,
  });
  return { ok: true, numero: g.numero, costo: g.costo, rastreo_url: g.rastreo, etiquetas: rutas.length };
}

async function revisarGuia(e: Entorno, db: SupabaseClient, envio: EnvioERP, servicio: string | null, intentos: number) {
  const g = await hastaQue(e, async () => leerEnvio((await api(e, `/api/v1/shipments/${envio.skydropx_envio_id}`)).d),
    (x) => x.listo || x.fallo, intentos, 2000);
  if (g.fallo) {
    // Skydropx la rechazó (y no la cobró): se suelta para poder pedir otra.
    await rpc(db, "registrar_envio_skydropx", { p_envio: envio.id, p_envio_skydropx: null, p_nota: g.error });
    throw new ErrorSky(`Skydropx no generó la guía${g.error ? `: ${g.error}` : ""}. Vuelve a cotizar.`, 422);
  }
  if (!g.listo) return { ok: false, pendiente: true, mensaje: "Skydropx sigue generando la guía. Ya está pagada: da \"Revisar guía\" en un minuto." };
  return terminarGuia(e, db, envio, g, servicio);
}

// -----------------------------------------------------------------------------
export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Ruta no válida" }, 404);
  const accion = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  const u = await quien(req, e);
  if (!u) return json({ error: "Falta la sesión" }, 401);
  const cuerpo = o(await req.json().catch(() => ({})));
  const db = u.db;

  try {
    if (accion === "probar") {
      if (!(await puede(db, "envios", 3))) return json({ error: "Configurar Skydropx es de quien administra envíos" }, 403);
      const [cred, pl] = await Promise.all([api(e, "/api/v1/finance/credits"), api(e, "/api/v1/address_templates?per_page=50")]);
      if (cred.status >= 400) throw new ErrorSky(mensajeError(cred.d, cred.status), 502);
      return json({
        conectado: true, saldo: num(o(cred.d.data).balance), moneda: txt(o(cred.d.data).currency) ?? "MXN",
        plantillas: lista(pl.d.data).map(o).map((p) => ({
          id: txt(p.id), alias: txt(p.alias_name), tipo: txt(p.address_type), predeterminada: p.default === true, direccion: o(p.address),
        })),
      });
    }

    if (accion === "catalogo") {
      if (!(await puede(db, "envios", 3))) return json({ error: "Configurar Skydropx es de quien administra envíos" }, 403);
      const texto = txt(cuerpo.texto) ?? "";
      const esEmpaque = cuerpo.tipo === "empaque";
      const q = new URLSearchParams({ per_page: "20" });
      if (/^\d+$/.test(texto) && !esEmpaque) q.set("consignment_note", texto); else if (texto) q.set(esEmpaque ? "name" : "description", texto);
      const r = await api(e, `/api/v1/shipments/${esEmpaque ? "packagings" : "consignment_notes"}?${q}`);
      return json({
        opciones: lista(r.d.data).map(o).map((x) => esEmpaque
          ? { clave: txt(x.code), nombre: txt(x.name) }
          : { clave: txt(x.consignment_note), nombre: txt(x.description) }),
      });
    }

    if (accion === "saldo") {
      if (!(await puede(db, "envios", 2)) && !(await puede(db, "finanzas", 1))) return json({ error: "Sin permiso" }, 403);
      if (!e.clientId || !e.clientSecret) return json({ conectado: false });
      const r = await api(e, "/api/v1/finance/credits");
      return json({ conectado: r.status < 400, saldo: num(o(r.d.data).balance), moneda: txt(o(r.d.data).currency) ?? "MXN" });
    }

    const envioId = txt(cuerpo.envio_id);
    if (!envioId) return json({ error: "Falta el envío" }, 400);
    if (!(await puede(db, "envios", 2))) return json({ error: "Sin permiso para cotizar ni generar guías" }, 403);
    const { envio, bultos, cfg } = await cargar(db, envioId);

    if (accion === "cotizar") {
      const falta = faltaParaCotizar(envio, bultos, cfg);
      if (falta) return json({ error: falta }, 400);
      if (envio.skydropx_envio_id) return json({ error: `${envio.folio} ya tiene una guía pedida a Skydropx: da "Revisar guía".` }, 409);
      const r = await api(e, "/api/v1/quotations", { method: "POST", body: cotizacion(envio, bultos, cfg!) });
      if (r.status >= 400) throw new ErrorSky(mensajeError(r.d, r.status), 422);
      const id = txt(r.d.id);
      if (!id) throw new ErrorSky("Skydropx no regresó la cotización", 502);
      // Las paqueterías van contestando: se espera hasta ~20 s a que acaben todas.
      const c = r.d.is_completed === true ? r.d
        : await hastaQue(e, async () => (await api(e, `/api/v1/quotations/${id}`)).d, (x) => x.is_completed === true, 11, 2000);
      await rpc(db, "registrar_cotizacion_skydropx", { p_envio: envio.id, p_cotizacion: id });
      return json({ cotizacion_id: id, completa: c.is_completed === true, tarifas: tarifas(c) });
    }

    if (accion === "generar") {
      const tarifaId = txt(cuerpo.tarifa_id);
      if (!tarifaId) return json({ error: "Elige una tarifa" }, 400);
      if (envio.numero_guia) return json({ error: `${envio.folio} ya tiene guía.` }, 409);
      if (envio.skydropx_envio_id) return json(await revisarGuia(e, db, envio, null, 1));
      const falta = faltaParaCotizar(envio, bultos, cfg);
      if (falta) return json({ error: falta }, 400);
      if (!cfg!.carta_porte) return json({ error: "Falta la clave de carta porte en Configuración → Integraciones → Skydropx." }, 400);
      if (!envio.dest_calle || !envio.destinatario || !envio.telefono) return json({ error: "Faltan calle, quién recibe o teléfono en el destino." }, 400);
      if (!envio.skydropx_cotizacion_id) return json({ error: "Vuelve a cotizar: la dirección cambió o la cotización ya no está." }, 409);
      // La tarifa se busca en la cotización de ESTE envío: precio y paquetería salen de Skydropx, no de la pantalla.
      const c = await api(e, `/api/v1/quotations/${envio.skydropx_cotizacion_id}`);
      const t = tarifas(c.d).find((x) => x.id === tarifaId);
      if (!t) return json({ error: "Esa tarifa ya no está en la cotización. Vuelve a cotizar." }, 409);
      const servicio = [t.paqueteria, t.servicio].filter(Boolean).join(" · ");

      const r = await api(e, "/api/v1/shipments", { method: "POST", body: envioSky(envio, bultos, cfg!, t.id) });
      if (r.status === 409) return json({ error: "Skydropx todavía está procesando esta guía. Espera un momento y da \"Revisar guía\"." }, 409);
      if (r.status >= 400) throw new ErrorSky(`Skydropx no generó la guía: ${mensajeError(r.d, r.status)}`, 422);
      const skyId = txt(o(r.d.data).id) ?? txt(o(o(r.d.data).attributes).id);
      if (!skyId) throw new ErrorSky("Skydropx aceptó la guía pero no dio su número de envío. Revisa en el panel de Skydropx antes de volver a intentar.", 502);
      // Ya está pagada: se apunta antes de cualquier otra cosa.
      await rpc(db, "registrar_envio_skydropx", { p_envio: envio.id, p_envio_skydropx: skyId, p_servicio: servicio }).catch((err) => {
        throw new ErrorSky(`Skydropx generó la guía (envío ${skyId}) pero no se pudo apuntar: ${err.message}. Búscala en el panel de Skydropx antes de pedir otra.`, 500);
      });
      return json(await revisarGuia(e, db, { ...envio, skydropx_envio_id: skyId }, servicio, 15));
    }

    if (accion === "revisar") {
      if (envio.numero_guia) return json({ ok: true, numero: envio.numero_guia });
      if (!envio.skydropx_envio_id) return json({ error: "Este envío no tiene guía pedida a Skydropx." }, 400);
      return json(await revisarGuia(e, db, envio, null, 3));
    }

    return json({ error: "Ruta no válida" }, 404);
  } catch (err) {
    if (err instanceof ErrorSky) return json({ error: err.message }, err.status);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
