// Mercado Libre con una API falsa: que cada cosa de ML se traduzca bien y, contra la base
// local, que un aviso termine en pedido con su envío, que una pregunta llegue y se
// conteste, y que los avisos de otra aplicación o cuenta se ignoren. Necesita la llave de
// servicio de la base local (SUPABASE_SERVICE_ROLE_KEY); sin ella se brinca esa parte.
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { API_ML, API_MP, atender, cuerpoCambio, leerEnvio, leerTarifas, leerVisitas, normalizarOrden, normalizarPago, normalizarPregunta, normalizarPublicacion, normalizarReclamo } from "./nucleo.ts";

describe("traducciones de ML", () => {
  it("una venta Full con su SKU y precio con IVA", () => {
    const v = normalizarOrden({
      id: 2000012345, status: "paid", date_closed: "2026-10-15T10:00:00.000-04:00", buyer: { id: 1, nickname: "COMPRADOR" }, pack_id: null,
      order_items: [{ item: { id: "MLM123", title: "Polea", seller_sku: "C-00148" }, quantity: 2, unit_price: 1160 }],
    }, { logistic_type: "fulfillment" });
    expect(v).toMatchObject({ id: "2000012345", estado: "paid", comprador: "COMPRADOR", full: true });
    expect(v.items).toEqual([{ item_id: "MLM123", titulo: "Polea", sku: "C-00148", cantidad: 2, precio: 1160 }]);
    expect(normalizarOrden({ id: 1, status: "paid", order_items: [] }, { logistic_type: "cross_docking" }).full).toBe(false);
  });

  // Con la forma de un pago de verdad de la cuenta (1,480 con envío gratis y retenciones).
  const MP_REAL = {
    id: 1820, status: "approved", date_approved: "2026-09-24T12:13:55.000-04:00", payment_method_id: "visa", transaction_amount: 1480,
    transaction_amount_refunded: 0, money_release_date: "2026-09-30T19:08:07.000-04:00", money_release_status: "released",
    transaction_details: { net_received_amount: 1083.93, total_paid_amount: 1480 },
    charges_details: [
      { name: "tax_withholding-isr", type: "tax", amounts: { original: 31.9, refunded: 0 }, accounts: { from: "collector", to: "600021407" } },
      { name: "tax_withholding-iva", type: "tax", amounts: { original: 102.07, refunded: 0 }, accounts: { from: "collector", to: "600021407" } },
      { name: "meli_fee", type: "fee", amounts: { original: 177.6, refunded: 0 }, accounts: { from: "collector", to: "ml" } },
      { name: "shp_cross_docking", type: "shipping", amounts: { original: 84.5, refunded: 0 }, accounts: { from: "collector", to: "1438203764" } },
      // Lo que paga el comprador (meses con interés) no es del vendedor.
      { name: "financing_fee", type: "fee", amounts: { original: 50, refunded: 0 }, accounts: { from: "payer", to: "mp" } },
    ],
  };

  it("un pago trae lo que se queda ML: comisión, envío, retenciones y lo que llega", () => {
    expect(normalizarPago({ id: 1820, status: "approved", transaction_amount: 1480, marketplace_fee: 177.6 }, MP_REAL)).toMatchObject({
      id: "1820", estado: "approved", total: 1480, comision: 177.6, envio: 84.5, retencion_iva: 102.07, retencion_isr: 31.9, otros: 0,
      neto: 1083.93, libera_en: "2026-09-30T19:08:07.000-04:00", liberado: true, completo: true, metodo: "visa",
    });
    // Sin el detalle de Mercado Pago: la comisión de la orden y «incompleto».
    expect(normalizarPago({ id: 1, status: "approved", transaction_amount: 1480, marketplace_fee: 177.6 }, { _error: "403" }))
      .toMatchObject({ comision: 177.6, retencion_iva: 0, neto: null, completo: false });
  });

  it("el envío en formato nuevo: Full por logistic.type, guía y estado", () => {
    const v = normalizarOrden({ id: 9, status: "paid", shipping: { id: 77 }, payments: [{ id: 1820 }], order_items: [] },
      { id: 77, status: "shipped", substatus: null, tracking_number: "MEL9", logistic: { mode: "me2", type: "fulfillment" } }, [MP_REAL]);
    expect(v).toMatchObject({ full: true, envio_estado: "shipped", envio_id: "77", guia: "MEL9", envio_tipo: "fulfillment" });
    expect(v.pagos[0]).toMatchObject({ id: "1820", neto: 1083.93 });
    expect(normalizarOrden({ id: 9, order_items: [] }, { logistic: { type: "xd_drop_off" } }).full).toBe(false);
  });

  it("un reclamo toma la fecha límite más próxima del vendedor", () => {
    const r = normalizarReclamo({
      id: 5001, resource: "order", resource_id: 2000012345, type: "mediations", stage: "claim", status: "opened", reason_id: "PDD9939",
      players: [
        { role: "complainant", available_actions: [{ action: "x", due_date: "2026-10-18T00:00:00Z" }] },
        { role: "respondent", available_actions: [{ action: "send_message_to_complainant", due_date: "2026-10-21T00:00:00Z" },
                                                   { action: "refund", due_date: "2026-10-20T12:00:00Z" }] },
      ],
    }, "Llegó dañado");
    expect(r).toEqual({ id: "5001", order_id: "2000012345", recurso: "order", tipo: "reclamo", motivo: "Llegó dañado", fecha_limite: "2026-10-20T12:00:00Z", abierto: true });
    // De un carrito: cuelga del envío; la conexión lo traduce a la venta.
    expect(normalizarReclamo({ id: 2, resource: "shipment", resource_id: 48326462274 })).toMatchObject({ order_id: "48326462274", recurso: "shipment" });
    expect(normalizarReclamo({ id: 1, type: "returns", status: "closed" }).tipo).toBe("devolucion");
    expect(normalizarReclamo({ id: 1, type: "cancel_purchase" }).tipo).toBe("cancelacion");
  });

  it("una pregunta con y sin respuesta", () => {
    expect(normalizarPregunta({ id: 77, item_id: "MLM1", text: "¿Hay?", status: "UNANSWERED", date_created: "2026-10-16T09:00:00Z" }, "Polea"))
      .toMatchObject({ id: 77, item_id: "MLM1", titulo: "Polea", texto: "¿Hay?", estado: "UNANSWERED", respuesta: null, comprador_id: null });
    expect(normalizarPregunta({ id: 80, status: "UNANSWERED", from: { id: 555 } }).comprador_id).toBe(555);
  });

  it("una publicación y sus visitas, venga como venga", () => {
    expect(normalizarPublicacion({ id: "MLM1", title: "Polea", price: 1300, available_quantity: 5, pictures: [{}, {}, {}],
      shipping: { logistic_type: "fulfillment", free_shipping: true }, attributes: [{ name: "Material", value_name: "Fierro" }, { name: "Vacío" }] }, 40))
      .toMatchObject({ item_id: "MLM1", precio: 1300, stock: 5, fotos: 3, logistica: "fulfillment", envio_gratis: true, visitas_30d: 40,
        atributos: [{ nombre: "Material", valor: "Fierro" }] });
    expect([...leerVisitas([{ item_id: "MLM1", total_visits: 7 }])]).toEqual([["MLM1", 7]]);
    expect([...leerVisitas({ MLM1: 9 })]).toEqual([["MLM1", 9]]);
    // La cuota fija sale de lo cobrado menos el porcentaje si ML no la desglosa.
    expect(leerTarifas([{ listing_type_id: "gold_special", sale_fee_amount: 67, sale_fee_details: { percentage_fee: 15 } },
      { listing_type_id: "gold_pro", sale_fee_amount: 39, sale_fee_details: { percentage_fee: 19.5, fixed_fee: 0 } }], 200))
      .toEqual({ clasica: { pct: 15, fijo: 37 }, premium: { pct: 19.5, fijo: 0 } });
    expect(leerEnvio({ coverage: { all_country: { list_cost: 99.9, billable_weight: 2 } } })).toEqual({ costo: 99.9, peso: 2 });
    expect(normalizarPregunta({ id: 78, status: "ANSWERED", answer: { text: "Sí", date_created: "2026-10-16T10:00:00Z" } }).respuesta).toBe("Sí");
    // Publicación pausada o cerrada: la base la deja fuera de las pendientes.
    expect(normalizarPregunta({ id: 79, status: "UNANSWERED" }, "Polea", false).item_activo).toBe(false);
  });
});

describe("cambiar una publicación", () => {
  it("con variantes el precio va en cada una y la existencia no se reparte sola", () => {
    const it = { price: 500, available_quantity: 3, variations: [{ id: 11 }, { id: 12 }] };
    expect(cuerpoCambio(it, { campo: "precio", actual: 500, propuesto: 520 })).toEqual({ cuerpo: { variations: [{ id: 11, price: 520 }, { id: 12, price: 520 }] } });
    expect(cuerpoCambio(it, { campo: "existencia", actual: 3, propuesto: 1 })).toEqual({ omitir: expect.stringContaining("variantes") });
    expect(cuerpoCambio({ ...it, variations: [{ id: 11 }] }, { campo: "existencia", actual: 3, propuesto: 1 }))
      .toEqual({ cuerpo: { variations: [{ id: 11, available_quantity: 1 }] } });
    expect(cuerpoCambio({ price: 500, available_quantity: 3 }, { campo: "existencia", actual: 3, propuesto: 1 })).toEqual({ cuerpo: { available_quantity: 1 } });
    // Si ya no es lo que vio el tablero, no se toca.
    expect(cuerpoCambio({ price: 510 }, { campo: "precio", actual: 500, propuesto: 520 })).toEqual({ omitir: expect.stringContaining("ya está en 510") });
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
// La historia del envío no se deja borrar (a propósito): la limpieza va directo a Postgres con
// los disparadores apagados. Sin DATABASE_URL esta parte no corre, para no ensuciar la base.
const URL_PG = process.env.DATABASE_URL ?? env.DATABASE_URL;
const hayBase = !!SERVICIO && !!URL_PG && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

// La API de ML falsa: responde según la ruta y anota lo que se le mandó.
const enviados: { ruta: string; cuerpo: unknown }[] = [];
// El envío de la venta de prueba cambia durante la prueba, como en ML.
let envioML: Record<string, unknown> = { id: 99, logistic_type: "fulfillment", status: "ready_to_ship", substatus: "ready_to_print", tracking_number: "MEL-T-99" };
const ORDEN = 7000000000 + Math.floor(Math.random() * 1e6);
const VIEJA = ORDEN + 1;
// Cómo está la publicación en ML cuando se le pregunta antes de cambiarla (cambia en la prueba).
let enML = { price: 1300, available_quantity: 5 };
const falsa: typeof fetch = async (entrada, init) => {
  const u = new URL(String(entrada));
  const r = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  if (String(entrada) === `${API_MP}/v1/payments/5551`) return r({ id: 5551, status: "approved", date_approved: "2026-10-16T10:00:00Z",
    transaction_amount: 1160, transaction_amount_refunded: 0, transaction_details: { net_received_amount: 870.6 },
    money_release_date: "2026-10-30T10:00:00Z", money_release_status: "pending",
    charges_details: [{ name: "meli_fee", type: "fee", amounts: { original: 139.2, refunded: 0 }, accounts: { from: "collector" } },
                      { name: "tax_withholding-iva", type: "tax", amounts: { original: 80, refunded: 0 }, accounts: { from: "collector" } },
                      { name: "tax_withholding-isr", type: "tax", amounts: { original: 25, refunded: 0 }, accounts: { from: "collector" } },
                      { name: "shp_fulfillment", type: "shipping", amounts: { original: 45.2, refunded: 0 }, accounts: { from: "collector" } }] });
  if (!String(entrada).startsWith(API_ML)) return r({}, 404);
  if (u.pathname === `/orders/${ORDEN}`) return r({ id: ORDEN, status: "paid", date_closed: "2026-10-16T10:00:00Z", buyer: { nickname: "PRUEBA_ML" },
    shipping: { id: 99 }, payments: [{ id: 5551, status: "approved", transaction_amount: 1160, marketplace_fee: 139.2 }],
    order_items: [{ item: { id: "MLM-T-ML", title: "Polea prueba ML", seller_sku: "T-ML-POLEA" }, quantity: 1, unit_price: 1160 }] });
  if (u.pathname === "/shipments/99") return r(envioML);
  if (u.pathname === "/questions/880001") return r({ id: 880001, item_id: "MLM-T-ML", text: "¿Tienen factura?", status: "UNANSWERED", date_created: "2026-10-16T11:00:00Z", from: { id: 555 } });
  if (u.pathname === "/items/MLM-T-ML" && init?.method === "PUT") {
    const cuerpo = JSON.parse(String(init.body));
    enviados.push({ ruta: "/items/MLM-T-ML", cuerpo });
    enML = { ...enML, ...cuerpo };
    return r({ id: "MLM-T-ML", ...enML });
  }
  if (u.pathname === "/items/MLM-T-ML") return r({ id: "MLM-T-ML", title: "Polea prueba ML", status: "active", ...enML,
    attributes: [{ id: "DIAMETER", name: "Diámetro", value_name: "4 pulgadas" }] });
  if (u.pathname === "/items/MLM-T-ML/description") return r({ plain_text: "Polea de fierro de 4 pulgadas, 1 ranura B, barreno de 1 pulgada." });
  // El tablero: la publicación como la ve ML, sus visitas de 30 días y la reputación de la cuenta.
  if (u.pathname === "/items") return r([{ code: 200, body: { id: "MLM-T-ML", title: "Polea prueba ML", status: "active", price: 1300, available_quantity: 5,
    sold_quantity: 12, pictures: [{}, {}], permalink: "https://articulo.mercadolibre.com.mx/MLM-T-ML", listing_type_id: "gold_special",
    shipping: { logistic_type: "xd_drop_off", free_shipping: true }, category_id: "MLM1234",
    attributes: [{ id: "DIAMETER", name: "Diámetro", value_name: "4 pulgadas" }] } }]);
  if (u.pathname === "/visits/items") return r({ "MLM-T-ML": 321 });
  // Lo que cobra ML en esa categoría: clásica 15 % y premium 19.5 %; y lo que cuesta su envío gratis.
  if (u.pathname === "/sites/MLM/listing_prices") return r([
    { listing_type_id: "gold_special", sale_fee_amount: 195, sale_fee_details: { percentage_fee: 15 } },
    { listing_type_id: "gold_pro", sale_fee_amount: 253.5, sale_fee_details: { percentage_fee: 19.5 } },
    { listing_type_id: "free", sale_fee_amount: 0, sale_fee_details: { percentage_fee: 0 } }]);
  if (u.pathname === "/users/4242/shipping_options/free") return r({ coverage: { all_country: { list_cost: 118.5, billable_weight: 1.2 } } });
  if (u.pathname === "/categories/MLM1234") return r({ id: "MLM1234", name: "Poleas" });
  if (u.pathname === "/users/4242") return r({ id: 4242, seller_reputation: { level_id: "5_green", power_seller_status: "gold", transactions: { total: 120 } } });
  // Lo que ya estaba en ML al conectar (sincronizar).
  // Lo que ese comprador ya había preguntado en la publicación (con y sin la pregunta nueva).
  if (u.pathname === "/questions/search" && u.searchParams.get("from") === "555") return r({ questions: [
    { id: 880003, item_id: "MLM-T-ML", text: "¿De qué medida es?", status: "ANSWERED", date_created: "2026-10-15T09:00:00Z", from: { id: 555 },
      answer: { text: "Es de 4 pulgadas.", date_created: "2026-10-15T09:30:00Z" } },
    { id: 880001, item_id: "MLM-T-ML", text: "¿Tienen factura?", status: "UNANSWERED", date_created: "2026-10-16T11:00:00Z", from: { id: 555 } }] });
  if (u.pathname === "/questions/search") return r({ questions: [{ id: 880002 }] });
  if (u.pathname === "/questions/880002") return r({ id: 880002, item_id: "MLM-T-ML", text: "¿Hacen envíos a Monterrey?", status: "UNANSWERED", date_created: "2026-10-10T11:00:00Z" });
  // Un reclamo de una venta de antes de conectar: no está en el ERP y nunca va a llegar sola.
  if (u.pathname === "/post-purchase/v1/claims/search") return r({ data: [{ id: 5009 }] });
  if (u.pathname === "/post-purchase/v1/claims/5009") return r({ id: 5009, resource: "order", resource_id: VIEJA, type: "mediations", status: "opened", players: [] });
  // Un reclamo de carrito: cuelga del envío de la venta de prueba, no de la venta.
  if (u.pathname === "/post-purchase/v1/claims/5010") return r({ id: 5010, resource: "shipment", resource_id: 99, type: "mediations", status: "opened",
    players: [{ role: "respondent", available_actions: [{ action: "refund", due_date: "2026-11-02T12:00:00Z" }] }] });
  if (u.pathname === `/orders/${VIEJA}`) return r({ id: VIEJA, status: "paid", date_closed: "2026-09-01T10:00:00Z", order_items: [] });
  if (u.pathname === "/orders/search") return r({ results: [{ id: ORDEN }] });
  if (u.pathname === "/users/4242/items/search") return r(u.searchParams.get("limit") === "100"
    ? { results: u.searchParams.get("status") === "active" ? ["MLM-T-ML"] : [] } : { paging: { total: 37 } });
  if (u.pathname === "/answers") { enviados.push({ ruta: "/answers", cuerpo: JSON.parse(String(init?.body)) }); return r({ id: 1 }); }
  return r({ message: "not_found" }, 404);
};
const entorno = { supabaseUrl: URL_SB, supabaseAnonKey: ANON, serviceKey: SERVICIO ?? "", clientId: "APP-PRUEBA", clientSecret: "x", appUrl: "http://localhost", fetch: falsa };
const aviso = (cuerpo: object) => atender(new Request("http://x/functions/v1/mercadolibre/aviso", { method: "POST", body: JSON.stringify(cuerpo) }), entorno);

describe.skipIf(!hayBase)("Mercado Libre contra la base local", () => {
  const admin = createClient(URL_SB, SERVICIO ?? "x", { auth: { persistSession: false } });
  let articulo = "";

  afterAll(async () => {
    if (!hayBase) return;
    const c = new pg.Client({ connectionString: URL_PG });
    await c.connect();
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query(`create temp table _p on commit drop as select id from public.pedidos where canal = 'mercadolibre' and id_externo = $1`, [String(ORDEN)]);
      for (const t of ["eventos_envio", "envio_lineas", "envio_bultos"]) {
        await c.query(`delete from public.${t} where envio_id in (select id from public.envios where pedido_id in (select id from _p))`);
      }
      await c.query("delete from public.envios where pedido_id in (select id from _p)");
      await c.query("delete from public.avisos where tipo in ('ml_reclamo', 'devolucion_nueva') and registro_id in (select id::text from public.devoluciones where pedido_id in (select id from _p))");
      await c.query("delete from public.devoluciones where pedido_id in (select id from _p)");
      await c.query("delete from public.ml_ventas where pedido_id in (select id from _p)");
      await c.query("delete from public.pedido_lineas where pedido_id in (select id from _p)");
      await c.query("delete from public.pedidos where id in (select id from _p)");
      await c.query("delete from public.ml_preguntas where id in (880001, 880002, 880003)");
      await c.query("delete from public.avisos where tipo = 'ml_reclamo_sin_venta' and registro_id = '5009'");
      await c.query("delete from public.ml_avisos where resource like '/post-purchase/v1/claims/5009%' or resource = '/post-purchase/v1/claims/5010'");
      await c.query("delete from public.ml_avisos where resource = any($1)", [[`/orders/${ORDEN}`, "/questions/880001", "/questions/880002", "/shipments/99"]]);
      await c.query("delete from public.ml_crudo where order_id = $1", [String(ORDEN)]);
      await c.query("delete from public.publicaciones where id_externo = 'MLM-T-ML'");
      await c.query("delete from public.ml_cambios where item_id = 'MLM-T-ML'");
      if (articulo) await c.query("delete from public.precios_lista where articulo_id = $1", [articulo]);
      await c.query(`update public.configuracion set valor = '{"precio": false, "existencia": false}' where clave = 'mercadolibre_automatico'`);
      if (articulo) await c.query("delete from public.articulos where id = $1", [articulo]);
      await c.query("delete from public.ml_cuenta where id = 1");
      await c.query("delete from public.ml_publicaciones_estado where item_id = 'MLM-T-ML'");
      await c.query("delete from public.ml_reputacion where id = 1");
      await c.query("commit");
    } finally { await c.end(); }
  });

  it("un aviso de venta termina en pedido con envío Full, ligado por SKU", async () => {
    const { data: a, error } = await admin.from("articulos").insert({ clave: "T-ML-POLEA", tipo: "componente", nombre: "Polea prueba ML" }).select("id").single();
    expect(error).toBeNull();
    articulo = a!.id;
    await admin.from("ml_cuenta").upsert({ id: 1, ml_user_id: 4242, nickname: "HEGAMEX_PRUEBA", access_token: "tok", refresh_token: "ref",
      expira_en: new Date(Date.now() + 3600_000).toISOString() });

    // De otra aplicación o de otra cuenta: se ignora.
    await aviso({ topic: "orders_v2", resource: `/orders/${ORDEN}`, user_id: 4242, application_id: "OTRA-APP" });
    await aviso({ topic: "orders_v2", resource: `/orders/${ORDEN}`, user_id: 1111, application_id: "APP-PRUEBA" });
    expect((await admin.from("pedidos").select("id").eq("id_externo", String(ORDEN))).data).toEqual([]);

    const r = await aviso({ topic: "orders_v2", resource: `/orders/${ORDEN}`, user_id: 4242, application_id: "APP-PRUEBA" });
    expect(r.status).toBe(200);
    const { data: ped } = await admin.from("pedidos").select("id, estado, pedido_lineas(articulo_id, precio_unitario)").eq("id_externo", String(ORDEN)).single();
    expect(ped!.estado).toBe("confirmado");
    expect(ped!.pedido_lineas).toEqual([{ articulo_id: articulo, precio_unitario: 1000 }]);
    const { data: env } = await admin.from("envios").select("tipo").eq("pedido_id", ped!.id).single();
    expect(env!.tipo).toBe("full");
    const { data: av } = await admin.from("ml_avisos").select("procesado_en, error").eq("resource", `/orders/${ORDEN}`).single();
    expect(av!.error).toBeNull();
    expect(av!.procesado_en).toBeTruthy();
    // Lo que regresó ML queda tal cual; lo que no dejó leer, anotado (aquí la API falsa no tiene costos).
    const { data: crudo } = await admin.from("ml_crudo").select("orden, envio, costos_envio").eq("order_id", String(ORDEN)).single();
    expect(crudo!.orden).toMatchObject({ id: ORDEN, status: "paid" });
    expect(crudo!.envio).toMatchObject({ logistic_type: "fulfillment" });
    expect(crudo!.costos_envio).toMatchObject({ _error: expect.stringContaining("/shipments/99/costs") });

    // Pagada: el cobro entra a Mercado Pago y queda lo que se quedó ML.
    const { data: cobros } = await admin.from("cobros").select("monto, metodo, referencia").eq("pedido_id", ped!.id);
    expect(cobros).toEqual([{ monto: 1160, metodo: "mercadopago", referencia: "Mercado Pago 5551" }]);
    const { data: pago } = await admin.from("ml_pagos").select("comision, envio, retencion_iva, retencion_isr, neto, completo").eq("pago_id", "5551").single();
    expect(pago).toEqual({ comision: 139.2, envio: 45.2, retencion_iva: 80, retencion_isr: 25, neto: 870.6, completo: true });
    // Un aviso repetido no duplica el cobro.
    await aviso({ topic: "orders_v2", resource: `/orders/${ORDEN}`, user_id: 4242, application_id: "APP-PRUEBA" });
    expect((await admin.from("cobros").select("id").eq("pedido_id", ped!.id)).data!.length).toBe(1);

    // El envío del ERP sigue al de ML: en camino y luego entregado (y el pedido entregado).
    envioML = { ...envioML, status: "shipped", substatus: null };
    await aviso({ topic: "shipments", resource: "/shipments/99", user_id: 4242, application_id: "APP-PRUEBA" });
    expect((await admin.from("envios").select("estado, numero_guia").eq("pedido_id", ped!.id).single()).data).toEqual({ estado: "enviado", numero_guia: "MEL-T-99" });
    envioML = { ...envioML, status: "delivered" };
    await aviso({ topic: "shipments", resource: "/shipments/99", user_id: 4242, application_id: "APP-PRUEBA" });
    expect((await admin.from("envios").select("estado").eq("pedido_id", ped!.id).single()).data!.estado).toBe("entregado");
    expect((await admin.from("pedidos").select("estado").eq("id", ped!.id).single()).data!.estado).toBe("entregado");
    expect((await admin.from("ml_ventas").select("envio_ml, guia").eq("order_id", String(ORDEN)).single()).data).toEqual({ envio_ml: "delivered", guia: "MEL-T-99" });
  }, 20_000);

  it("una pregunta llega pendiente y se contesta desde el ERP", async () => {
    await aviso({ topic: "questions", resource: "/questions/880001", user_id: 4242, application_id: "APP-PRUEBA" });
    const { data: q } = await admin.from("ml_preguntas").select("estado, titulo_publicacion, articulo_id").eq("id", 880001).single();
    expect(q).toEqual({ estado: "pendiente", titulo_publicacion: "Polea prueba ML", articulo_id: articulo });
    // La pregunta anterior del mismo comprador llega ya contestada, como contexto (sin aviso).
    expect((await admin.from("ml_preguntas").select("estado, comprador_id, respuesta").eq("id", 880003).single()).data)
      .toEqual({ estado: "contestada", comprador_id: 555, respuesta: "Es de 4 pulgadas." });

    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const r = await atender(new Request("http://x/functions/v1/mercadolibre/responder", {
      method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` }, body: JSON.stringify({ pregunta_id: 880001, texto: "Sí, facturamos." }),
    }), entorno);
    expect(r.status).toBe(200);
    expect(enviados).toContainEqual({ ruta: "/answers", cuerpo: { question_id: 880001, text: "Sí, facturamos." } });
    expect((await admin.from("ml_preguntas").select("estado").eq("id", 880001).single()).data!.estado).toBe("contestada");
    // Al llegar la pregunta se trajo lo que dice la publicación: con eso se sugiere la respuesta.
    const { data: ficha } = await admin.from("ml_publicaciones_estado").select("descripcion, atributos").eq("item_id", "MLM-T-ML").single();
    expect(ficha!.descripcion).toContain("barreno de 1 pulgada");
    expect(ficha!.atributos).toEqual([{ nombre: "Diámetro", valor: "4 pulgadas" }]);
  });

  it("el tablero trae cada publicación con sus visitas y la reputación de la cuenta", async () => {
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const r = await atender(new Request("http://x/functions/v1/mercadolibre/publicaciones", {
      method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` } }), entorno);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ publicaciones: 1, reputacion: true });
    const { data: e } = await admin.from("ml_publicaciones_estado").select("precio, stock, vendidas, visitas_30d, fotos, logistica, envio_gratis, descripcion, categoria, comision_clasica, fijo_clasica, comision_premium, costo_envio")
      .eq("item_id", "MLM-T-ML").single();
    // La descripción que se trajo con la pregunta no se pierde al actualizar el tablero.
    expect(e).toMatchObject({ precio: 1300, stock: 5, vendidas: 12, visitas_30d: 321, fotos: 2, logistica: "xd_drop_off", envio_gratis: true,
      categoria: "Poleas", comision_clasica: 15, fijo_clasica: 0, comision_premium: 19.5, costo_envio: 118.5 });
    expect(e!.descripcion).toContain("Polea de fierro");
    expect((await admin.from("ml_reputacion").select("datos").eq("id", 1).single()).data!.datos).toMatchObject({ level_id: "5_green" });
    // Lo cruza con el ERP: ligada al artículo de la venta de prueba, con sus preguntas.
    const { data: t, error } = await db.rpc("ml_tablero");
    expect(error).toBeNull();
    expect((t as { item_id: string; clave: string; preguntas_30d: number }[]).find((x) => x.item_id === "MLM-T-ML")).toMatchObject({ clave: "T-ML-POLEA" });
  });

  it("los cambios sugeridos se mandan a ML con el botón, y solos solo si el interruptor está prendido", async () => {
    // Polea: lista $980 → $1,136.80 con IVA + $118.50 de envío, entre 0.85 = $1,477. En ML está a $1,300 (sube 13.6 %).
    await admin.from("precios_lista").upsert({ articulo_id: articulo, precio: 980 });
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const pedir = (accion: string, cuerpo: object, token = s.session!.access_token, extra: Record<string, string> = {}) =>
      atender(new Request(`http://x/functions/v1/mercadolibre/${accion}`, { method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(cuerpo) }), entorno);
    const { data: prop } = await db.rpc("ml_cambios_propuestos");
    expect((prop as { item_id: string; campo: string }[]).filter((x) => x.item_id === "MLM-T-ML"))
      .toEqual(expect.arrayContaining([expect.objectContaining({ campo: "precio", actual: 1300, propuesto: 1477, automatico: true })]));

    // Alguien movió la existencia en ML después de la lectura: esa no se pisa. El precio sí se manda.
    enML = { price: 1300, available_quantity: 7 };
    const r = await pedir("aplicar", { cambios: [{ item_id: "MLM-T-ML", campo: "precio" }, { item_id: "MLM-T-ML", campo: "existencia" }] });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ aplicados: 1, omitidos: 1, errores: 0 });
    expect(enviados).toContainEqual({ ruta: "/items/MLM-T-ML", cuerpo: { price: 1477 } });
    expect(enviados.filter((x) => x.ruta === "/items/MLM-T-ML").length).toBe(1);
    const { data: hist } = await admin.from("ml_cambios").select("campo, antes, despues, origen, estado, detalle").eq("item_id", "MLM-T-ML").order("id");
    expect(hist).toEqual([
      { campo: "precio", antes: 1300, despues: 1477, origen: "boton", estado: "aplicado", detalle: null },
      { campo: "existencia", antes: 5, despues: 0, origen: "boton", estado: "omitido", detalle: expect.stringContaining("ya está en 7") }]);
    expect((await admin.from("ml_publicaciones_estado").select("precio").eq("item_id", "MLM-T-ML").single()).data!.precio).toBe(1477);

    // Almacén no cambia publicaciones; sin la llave no se despierta la vuelta automática.
    const { data: a } = await db.auth.signInWithPassword({ email: "almacen@hegamex.com", password: "hegamex-local" });
    expect((await pedir("aplicar", { cambios: [{ item_id: "MLM-T-ML", campo: "precio" }] }, a.session!.access_token)).status).toBe(403);
    expect((await pedir("automatico", {}, "", { "x-llave": "no-es" })).status).toBe(401);

    // Con el interruptor de precio prendido, la vuelta lee ML (otra vez $1,300) y lo corrige sola;
    // la existencia no, porque está apagada (y dejarla en 0 nunca es automático).
    const { data: cuenta } = await admin.from("ml_cuenta").select("llave_automatico").eq("id", 1).single();
    await admin.from("configuracion").update({ valor: { precio: true, existencia: false } }).eq("clave", "mercadolibre_automatico");
    enML = { price: 1300, available_quantity: 5 };
    const v = await pedir("automatico", {}, "", { "x-llave": cuenta!.llave_automatico });
    expect(v.status).toBe(200);
    expect(await v.json()).toMatchObject({ aplicados: 1, errores: 0 });
    expect(enviados.filter((x) => x.ruta === "/items/MLM-T-ML").length).toBe(2);
    const { data: auto } = await admin.from("ml_cambios").select("campo, origen, estado, usuario_id").eq("item_id", "MLM-T-ML").eq("origen", "automatico");
    expect(auto).toEqual([{ campo: "precio", origen: "automatico", estado: "aplicado", usuario_id: null }]);
    const { data: cfg } = await admin.from("configuracion").select("valor").eq("clave", "mercadolibre_automatico").single();
    expect(cfg!.valor.ultima_corrida).toMatchObject({ aplicados: 1, errores: 0, pendientes: 0 });
    // Y dejó anotado a dónde la llama pg_cron.
    expect((await admin.from("ml_cuenta").select("url_funciones").eq("id", 1).single()).data!.url_funciones).toBe(URL_SB);
  }, 20_000);

  it("sincronizar trae lo que ya estaba: la pregunta pendiente y, si se pide, las ventas desde una fecha", async () => {
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const pedir = (cuerpo: object) => atender(new Request("http://x/functions/v1/mercadolibre/sincronizar",
      { method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` }, body: JSON.stringify(cuerpo) }), entorno);
    const r = await pedir({});
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ publicaciones: 37, preguntas: 1, reclamos: 1, ventas: 0, errores: 0 });
    const { data: p } = await admin.from("ml_preguntas").select("estado, texto").eq("id", 880002).single();
    expect(p).toMatchObject({ estado: "pendiente", texto: "¿Hacen envíos a Monterrey?" });
    // Con fecha trae ventas; la que ya existía no se duplica.
    const r2 = await (await pedir({ ventas_desde: "2026-10-01" })).json();
    expect(r2).toMatchObject({ ventas: 1, errores: 0 });
    const { count } = await admin.from("ml_ventas").select("*", { count: "exact", head: true }).eq("order_id", String(ORDEN));
    expect(count).toBe(1);
    // El reclamo de la venta vieja no se queda reintentando: se avisa una sola vez a quien atiende ML.
    const { data: av } = await admin.from("ml_avisos").select("procesado_en, error").eq("resource", "/post-purchase/v1/claims/5009");
    expect(av!.every((a) => a.procesado_en && !a.error)).toBe(true);
    // Se trajo dos veces (las dos llamadas de arriba) y cada persona tiene un solo aviso.
    const { data: avisos } = await admin.from("avisos").select("usuario_id").eq("tipo", "ml_reclamo_sin_venta").eq("registro_id", "5009");
    expect(avisos!.length).toBeGreaterThan(0);
    expect(new Set(avisos!.map((a) => a.usuario_id)).size).toBe(avisos!.length);
  });

  it("un reclamo que ML avisa como «post_purchase» se atiende igual que «claims»", async () => {
    // Así manda ML los reclamos nuevos (a veces del historial de acciones); antes se marcaban vistos sin leerlos.
    const r = await aviso({ topic: "post_purchase", resource: "/post-purchase/v1/claims/5009/actions-history", user_id: 4242, application_id: "APP-PRUEBA" });
    expect(r.status).toBe(200);
    const { data: av } = await admin.from("ml_avisos").select("procesado_en, error").eq("resource", "/post-purchase/v1/claims/5009/actions-history").single();
    expect(av).toMatchObject({ error: null });
    expect(av!.procesado_en).toBeTruthy();
    expect((await admin.from("avisos").select("id").eq("tipo", "ml_reclamo_sin_venta").eq("registro_id", "5009")).data!.length).toBeGreaterThan(0);
  });

  it("un reclamo de carrito (cuelga del envío) cae en su venta", async () => {
    await aviso({ topic: "post_purchase", resource: "/post-purchase/v1/claims/5010", user_id: 4242, application_id: "APP-PRUEBA" });
    const { data: av } = await admin.from("ml_avisos").select("procesado_en, error").eq("resource", "/post-purchase/v1/claims/5010").single();
    expect(av).toMatchObject({ error: null });
    const { data: ped } = await admin.from("pedidos").select("id").eq("id_externo", String(ORDEN)).single();
    const { data: dev } = await admin.from("devoluciones").select("tipo, fecha_limite").eq("pedido_id", ped!.id);
    expect(dev).toEqual([{ tipo: "reclamo", fecha_limite: expect.stringContaining("2026-11-02") }]);
  });

  it("sin sesión no se contesta ni se conecta", async () => {
    const r = await atender(new Request("http://x/functions/v1/mercadolibre/responder", { method: "POST", body: "{}" }), entorno);
    expect(r.status).toBe(401);
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "almacen@hegamex.com", password: "hegamex-local" });
    const c = await atender(new Request("http://x/functions/v1/mercadolibre/iniciar", { method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` } }), entorno);
    expect(c.status).toBe(403);
  });

  // Dirección sí conecta. Antes la revisión llamaba a tiene_rol con un parámetro que no
  // existe (p_rol), la consulta fallaba y a dirección también le decía que no era suyo.
  it("dirección inicia la conexión y recibe el enlace de Mercado Libre", async () => {
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "direccion@hegamex.com", password: "hegamex-local" });
    const c = await atender(new Request("http://x/functions/v1/mercadolibre/iniciar", { method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` } }), entorno);
    expect(c.status).toBe(200);
    const { url } = await c.json() as { url: string };
    expect(url).toContain("client_id=APP-PRUEBA");
    expect(url).toContain(encodeURIComponent(`${URL_SB}/functions/v1/mercadolibre/autorizar`));
  });
});
