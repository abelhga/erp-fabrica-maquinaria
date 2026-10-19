// Skydropx con una API falsa: que los bultos y el destino se traduzcan bien y, contra la base
// local, que cotizar → generar deje el envío en "guía lista" con su PDF, que la tarifa se lea
// de la cotización del envío (no de la pantalla) y que una guía lenta no se compre dos veces.
// Necesita la llave de servicio de la base local (SUPABASE_SERVICE_ROLE_KEY); sin ella se
// brinca esa parte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { API_SKY, atender, envioSky, faltaParaCotizar, leerEnvio, parcels, tarifas, type ConfigSky, type EnvioERP } from "./nucleo.ts";

const CFG: ConfigSky = {
  origen_plantilla_id: "pl-planta", carta_porte: "24112700", tipo_empaque: "4G", formato: "standard",
  origen: { postal_code: "47775", area_level1: "Jalisco", area_level2: "Atotonilco el Alto", area_level3: "Crucero Milpillas",
            street1: "Carretera Atotonilco-La Barca 151", name: "Juan Carlos", company: "Hegamex", phone: "3910000000", email: "envios@hegamex.com", reference: "Planta" },
};
const ENV: EnvioERP = {
  id: "e1", folio: "ENV-1", tipo: "paqueteria", abierto: true, numero_guia: null, destinatario: "Encargado", telefono: "3312345678", cliente: "Granja",
  dest_cp: "45130", dest_estado: "Jalisco", dest_municipio: "Zapopan", dest_colonia: "Centro", dest_calle: "Av. Prueba 120",
  dest_referencia: null, dest_empresa: null, dest_correo: null, skydropx_cotizacion_id: null, skydropx_envio_id: null, servicio: null,
};

describe("traducciones de Skydropx", () => {
  it("bultos a parcels: centímetros enteros hacia arriba y al menos 1 kg", () => {
    expect(parcels([{ peso_kg: 12.34, largo_cm: 38.2, ancho_cm: 62, alto_cm: 29.9 }, { peso_kg: 0.3, largo_cm: 10, ancho_cm: 10, alto_cm: 10 }]))
      .toEqual([{ length: 39, width: 62, height: 30, weight: 12.4 }, { length: 10, width: 10, height: 10, weight: 1 }]);
  });

  it("dice qué falta antes de gastar una cotización", () => {
    const b = [{ peso_kg: 1, largo_cm: 1, ancho_cm: 1, alto_cm: 1 }];
    expect(faltaParaCotizar(ENV, b, CFG)).toBeNull();
    expect(faltaParaCotizar({ ...ENV, tipo: "flete" }, b, CFG)).toMatch(/paquetería/);
    expect(faltaParaCotizar(ENV, b, { ...CFG, origen: null })).toMatch(/origen/);
    expect(faltaParaCotizar({ ...ENV, dest_colonia: null }, b, CFG)).toMatch(/colonia/);
    expect(faltaParaCotizar(ENV, [b[0], { ...b[0], alto_cm: null }], CFG)).toBe("A un bulto le falta peso o medidas.");
  });

  it("tarifas válidas de la más barata a la más cara", () => {
    expect(tarifas({ rates: [
      { id: "r1", success: true, provider_display_name: "FedEx", provider_service_name: "Express", total: "320.50", days: 1 },
      { id: "r2", success: false, provider_display_name: "DHL", total: "100" },
      { id: "r3", success: true, provider_display_name: "Estafeta", provider_service_name: "Terrestre", total: "180", days: 4, pickup: true },
    ] })).toEqual([
      { id: "r3", paqueteria: "Estafeta", servicio: "Terrestre", total: 180, dias: 4, recoleccion: true },
      { id: "r1", paqueteria: "FedEx", servicio: "Express", total: 320.5, dias: 1, recoleccion: false },
    ]);
  });

  it("la guía lleva la plantilla de origen, la carta porte y sin campos vacíos", () => {
    const s = envioSky(ENV, [{ peso_kg: 1, largo_cm: 1, ancho_cm: 1, alto_cm: 1 }], CFG, "r3").shipment;
    expect(s).toMatchObject({ rate_id: "r3", unique_shipment: true, printing_format: "standard" });
    expect(s.address_from).toMatchObject({ address_template_id: "pl-planta", company: "Hegamex" });
    // Sin empresa ni correo del cliente: va el nombre del cliente y el correo de la planta.
    expect(s.address_to).toEqual({ street1: "Av. Prueba 120", name: "Encargado", company: "Granja", phone: "3312345678", email: "envios@hegamex.com" });
    expect(s.packages).toEqual([{ package_number: "1", consignment_note: "24112700", package_type: "4G" }]);
  });

  it("lee en qué va la guía", () => {
    const pendiente = leerEnvio({ data: { id: "s1", attributes: { workflow_status: "pending" } }, included: [] });
    expect(pendiente).toMatchObject({ listo: false, fallo: false });
    const lista = leerEnvio({
      data: { id: "s1", attributes: { workflow_status: "success", total: "180.00", master_tracking_number: "7701", carrier_name: "estafeta" } },
      included: [{ type: "address", attributes: {} }, { type: "package", attributes: { tracking_number: "7701", label_url: "https://x/l.pdf", tracking_url_provider: "https://t/7701" } }],
    });
    expect(lista).toMatchObject({ listo: true, numero: "7701", costo: 180, rastreo: "https://t/7701", etiquetas: ["https://x/l.pdf"] });
    expect(leerEnvio({ data: { attributes: { workflow_status: "failed", error_detail: { error_message: "Dirección no válida" } } } }))
      .toMatchObject({ fallo: true, error: "Dirección no válida" });
  });
});

// -----------------------------------------------------------------------------
const ruta = new URL("../../../.env.local", import.meta.url);
const env = existsSync(ruta) ? Object.fromEntries(
  readFileSync(ruta, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
) : {};
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
// La guía deja evidencia, que la base no deja borrar (a propósito). Para no ensuciar la base
// local, la limpieza va directo a Postgres con los disparadores apagados: sin DATABASE_URL
// esa parte no corre.
const URL_PG = process.env.DATABASE_URL ?? env.DATABASE_URL;
const hayBase = !!SERVICIO && !!URL_PG && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

// La API de Skydropx falsa: responde según la ruta, anota lo que se le pidió y tarda en
// completar la cotización y la guía (como la de verdad).
const pedidos: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
let lecturasCot = 0, lecturasGuia = 0, guiasCreadas = 0;
const PDF = new TextEncoder().encode("%PDF-1.4 guía falsa");
const falsa: typeof fetch = async (entrada, init) => {
  const u = new URL(String(entrada));
  const r = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  if (u.origin === "https://etiquetas.falsas") return new Response(PDF, { headers: { "Content-Type": "application/pdf" } });
  if (!String(entrada).startsWith(API_SKY)) return r({}, 404);
  const metodo = init?.method ?? "GET";
  pedidos.push({ metodo, ruta: u.pathname, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
  if (u.pathname === "/api/v1/oauth/token") return r({ access_token: "tok", expires_in: 7200 });
  if (u.pathname === "/api/v1/finance/credits") return r({ data: { balance: 1520.5, currency: "MXN" } });
  const tarifasF = [
    { id: "r-fedex", success: true, provider_display_name: "FedEx", provider_service_name: "Express", total: "320.50", days: 1 },
    { id: "r-estafeta", success: true, provider_display_name: "Estafeta", provider_service_name: "Terrestre", total: "180.00", days: 4 },
  ];
  if (u.pathname === "/api/v1/quotations" && metodo === "POST") return r({ id: "cot-1", is_completed: false, rates: [] }, 201);
  if (u.pathname === "/api/v1/quotations/cot-1") return r({ id: "cot-1", is_completed: ++lecturasCot >= 2, rates: lecturasCot >= 2 ? tarifasF : [] });
  if (u.pathname === "/api/v1/shipments" && metodo === "POST") { guiasCreadas++; return r({ data: { id: "sky-1", attributes: { workflow_status: "pending" } } }, 202); }
  if (u.pathname === "/api/v1/shipments/sky-1") {
    // Las primeras 15 lecturas sigue "pendiente": generar se rinde y "revisar" la termina.
    const lista = ++lecturasGuia > 15;
    return r({
      data: { id: "sky-1", attributes: { workflow_status: lista ? "success" : "pending", total: "180.00", master_tracking_number: lista ? "EST7701" : null, carrier_name: "estafeta" } },
      included: lista ? [{ type: "package", attributes: { tracking_number: "EST7701", label_url: "https://etiquetas.falsas/sky-1.pdf", tracking_url_provider: "https://estafeta/7701" } }] : [],
    });
  }
  return r({ errors: "not_found" }, 404);
};
const entorno = { supabaseUrl: URL_SB, supabaseAnonKey: ANON, clientId: "CLI-PRUEBA", clientSecret: "x", fetch: falsa, esperar: async () => undefined };

describe.skipIf(!hayBase)("Skydropx contra la base local", () => {
  const admin = createClient(URL_SB, SERVICIO ?? "x", { auth: { persistSession: false } });
  const ids = { articulo: "", cliente: "", pedido: "", envio: "" };
  let cfgAntes: unknown = null, tokenAlmacen = "", tokenCompras = "";
  const llamar = (accion: string, cuerpo: object, token = tokenAlmacen) => atender(new Request(`http://x/functions/v1/skydropx/${accion}`, {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(cuerpo),
  }), entorno);

  beforeAll(async () => {
    if (!hayBase) return;
    const entra = async (correo: string) => {
      const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
      return (await db.auth.signInWithPassword({ email: correo, password: "hegamex-local" })).data.session!.access_token;
    };
    tokenAlmacen = await entra("almacen@hegamex.com");
    tokenCompras = await entra("compras@hegamex.com");
    cfgAntes = (await admin.from("configuracion").select("valor").eq("clave", "skydropx").single()).data!.valor;
    await admin.from("configuracion").update({ valor: CFG }).eq("clave", "skydropx");
    ids.articulo = (await admin.from("articulos").insert({ clave: "T-SKY-COS", tipo: "componente", nombre: "Cosedora prueba Skydropx" }).select("id").single()).data!.id;
    ids.cliente = (await admin.from("clientes").insert({ nombre: "Granja prueba Skydropx" }).select("id").single()).data!.id;
    ids.pedido = (await admin.from("pedidos").insert({ cliente_id: ids.cliente }).select("id").single()).data!.id;
    const { data: e, error } = await admin.from("envios").insert({ pedido_id: ids.pedido, tipo: "paqueteria", destinatario: "Encargado prueba", telefono: "3312345678" }).select("id").single();
    expect(error).toBeNull();
    ids.envio = e!.id;
    await admin.from("envio_bultos").insert({ envio_id: ids.envio, orden: 1, articulo_id: ids.articulo, piezas: 1, peso_kg: 13, largo_cm: 38, ancho_cm: 62, alto_cm: 29 });
  });

  afterAll(async () => {
    if (!hayBase) return;
    const { data: ev } = await admin.from("evidencias_envio").select("ruta").eq("envio_id", ids.envio);
    if (ev?.length) await admin.storage.from("envios").remove(ev.map((x) => x.ruta));
    const c = new pg.Client({ connectionString: URL_PG });
    await c.connect();
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      for (const [tabla, campo, id] of [["evidencias_envio", "envio_id", ids.envio], ["eventos_envio", "envio_id", ids.envio], ["envio_bultos", "envio_id", ids.envio],
        ["envios", "id", ids.envio], ["pedidos", "id", ids.pedido], ["clientes", "id", ids.cliente], ["articulos", "id", ids.articulo]] as const) {
        if (id) await c.query(`delete from public.${tabla} where ${campo} = $1`, [id]);
      }
      await c.query("update public.configuracion set valor = $1 where clave = 'skydropx'", [JSON.stringify(cfgAntes)]);
      await c.query("commit");
    } finally { await c.end(); }
  });

  it("sin sesión 401; sin permiso de envíos 403 y no se le habla a Skydropx", async () => {
    expect((await llamar("cotizar", { envio_id: ids.envio }, "")).status).toBe(401);
    const antes = pedidos.length;
    expect((await llamar("cotizar", { envio_id: ids.envio }, tokenCompras)).status).toBe(403);
    expect((await llamar("probar", {})).status).toBe(403);         // almacén genera guías, no configura
    expect(pedidos.length).toBe(antes);
  });

  it("sin destino por campos no cotiza; con él, espera a todas las paqueterías", async () => {
    const r0 = await llamar("cotizar", { envio_id: ids.envio });
    expect(r0.status).toBe(400);
    expect((await r0.json()).error).toMatch(/destino/);

    const db = createClient(URL_SB, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${tokenAlmacen}` } } });
    const { error } = await db.rpc("guardar_destino_envio", { p_envio: ids.envio, p_datos: {
      cp: "45130", estado: "Jalisco", municipio: "Zapopan", colonia: "Centro", calle: "Av. Prueba 120", destinatario: "Encargado prueba", telefono: "3312345678" } });
    expect(error).toBeNull();
    const r = await llamar("cotizar", { envio_id: ids.envio });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.tarifas.map((t: { id: string }) => t.id)).toEqual(["r-estafeta", "r-fedex"]);
    expect(pedidos.find((p) => p.ruta === "/api/v1/quotations")!.cuerpo).toMatchObject({ quotation: {
      address_from: { address_template_id: "pl-planta", postal_code: "47775" },
      address_to: { postal_code: "45130", area_level2: "Zapopan", area_level3: "Centro" },
      parcels: [{ length: 38, width: 62, height: 29, weight: 13 }],
    } });
    expect((await admin.from("envios").select("skydropx_cotizacion_id").eq("id", ids.envio).single()).data!.skydropx_cotizacion_id).toBe("cot-1");
  });

  it("una tarifa que no es de la cotización del envío no se compra", async () => {
    const r = await llamar("generar", { envio_id: ids.envio, tarifa_id: "r-inventada" });
    expect(r.status).toBe(409);
    expect(guiasCreadas).toBe(0);
  });

  it("generar: si el PDF tarda, queda apuntada; otro clic la revisa y no compra otra", async () => {
    const r = await llamar("generar", { envio_id: ids.envio, tarifa_id: "r-estafeta" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ pendiente: true });
    expect(guiasCreadas).toBe(1);
    const enviado = pedidos.find((p) => p.ruta === "/api/v1/shipments" && p.metodo === "POST")!.cuerpo as { shipment: Record<string, unknown> };
    expect(enviado.shipment).toMatchObject({ rate_id: "r-estafeta", unique_shipment: true,
      address_to: { street1: "Av. Prueba 120", name: "Encargado prueba", company: "Granja prueba Skydropx", phone: "3312345678", email: "envios@hegamex.com" } });
    const { data: medio } = await admin.from("envios").select("skydropx_envio_id, servicio, numero_guia").eq("id", ids.envio).single();
    expect(medio).toEqual({ skydropx_envio_id: "sky-1", servicio: "Estafeta · Terrestre", numero_guia: null });

    // Un segundo "generar" (doble clic, otra pestaña) revisa la misma guía.
    const r2 = await llamar("generar", { envio_id: ids.envio, tarifa_id: "r-fedex" });
    const d2 = await r2.json();
    expect(guiasCreadas).toBe(1);
    expect(d2).toMatchObject({ ok: true, numero: "EST7701", costo: 180 });

    const { data: e } = await admin.from("v_envios").select("estado, numero_guia, costo_real, paqueteria, servicio, rastreo_url, guia_ruta, guia_por_nombre").eq("id", ids.envio).single();
    expect(e).toMatchObject({ estado: "guia_lista", numero_guia: "EST7701", costo_real: 180, paqueteria: "Skydropx", servicio: "Estafeta · Terrestre",
      rastreo_url: "https://estafeta/7701", guia_por_nombre: "Almacenista Hegamex" });
    const pdf = await admin.storage.from("envios").download(e!.guia_ruta!);
    expect(new Uint8Array(await pdf.data!.arrayBuffer())).toEqual(PDF);
  });

  it("un vendedor cotiza un flete sin envío (antes de la venta); producción no", async () => {
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const vend = (await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" })).data.session!.access_token;
    const taller = (await db.auth.signInWithPassword({ email: "taller@hegamex.com", password: "hegamex-local" })).data.session!.access_token;
    const destino = { cp: "45130", estado: "Jalisco", municipio: "Zapopan", colonia: "Centro" };
    const bultos = [{ peso_kg: 13, largo_cm: 38, ancho_cm: 62, alto_cm: 29 }];
    expect((await llamar("cotizar_libre", { destino, bultos }, taller)).status).toBe(403);
    const sinColonia = await llamar("cotizar_libre", { destino: { ...destino, colonia: "" }, bultos }, vend);
    expect(sinColonia.status).toBe(400);
    const sinMedidas = await llamar("cotizar_libre", { destino, bultos: [{ peso_kg: 13 }] }, vend);
    expect((await sinMedidas.json()).error).toMatch(/medidas/);
    const r = await llamar("cotizar_libre", { destino, bultos }, vend);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.tarifas.map((t: { id: string }) => t.id)).toEqual(["r-estafeta", "r-fedex"]);
    expect(d.recargo).toBe(0);
  });

  it("con guía ya no se vuelve a cotizar", async () => {
    const r = await llamar("cotizar", { envio_id: ids.envio });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/ya tiene guía/);
  });
});
