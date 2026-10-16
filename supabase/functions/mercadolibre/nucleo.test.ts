// Mercado Libre con una API falsa: que cada cosa de ML se traduzca bien y, contra la base
// local, que un aviso termine en pedido con su envío, que una pregunta llegue y se
// conteste, y que los avisos de otra aplicación o cuenta se ignoren. Necesita la llave de
// servicio de la base local (SUPABASE_SERVICE_ROLE_KEY); sin ella se brinca esa parte.
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { API_ML, atender, normalizarOrden, normalizarPregunta, normalizarReclamo } from "./nucleo.ts";

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

  it("un reclamo toma la fecha límite más próxima del vendedor", () => {
    const r = normalizarReclamo({
      id: 5001, resource: "order", resource_id: 2000012345, type: "mediations", stage: "claim", status: "opened", reason_id: "PDD9939",
      players: [
        { role: "complainant", available_actions: [{ action: "x", due_date: "2026-10-18T00:00:00Z" }] },
        { role: "respondent", available_actions: [{ action: "send_message_to_complainant", due_date: "2026-10-21T00:00:00Z" },
                                                   { action: "refund", due_date: "2026-10-20T12:00:00Z" }] },
      ],
    }, "Llegó dañado");
    expect(r).toEqual({ id: "5001", order_id: "2000012345", tipo: "reclamo", motivo: "Llegó dañado", fecha_limite: "2026-10-20T12:00:00Z", abierto: true });
    expect(normalizarReclamo({ id: 1, type: "returns", status: "closed" }).tipo).toBe("devolucion");
    expect(normalizarReclamo({ id: 1, type: "cancel_purchase" }).tipo).toBe("cancelacion");
  });

  it("una pregunta con y sin respuesta", () => {
    expect(normalizarPregunta({ id: 77, item_id: "MLM1", text: "¿Hay?", status: "UNANSWERED", date_created: "2026-10-16T09:00:00Z" }, "Polea"))
      .toMatchObject({ id: 77, item_id: "MLM1", titulo: "Polea", texto: "¿Hay?", estado: "UNANSWERED", respuesta: null });
    expect(normalizarPregunta({ id: 78, status: "ANSWERED", answer: { text: "Sí", date_created: "2026-10-16T10:00:00Z" } }).respuesta).toBe("Sí");
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
const hayBase = !!SERVICIO && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

// La API de ML falsa: responde según la ruta y anota lo que se le mandó.
const enviados: { ruta: string; cuerpo: unknown }[] = [];
const ORDEN = 7000000000 + Math.floor(Math.random() * 1e6);
const falsa: typeof fetch = async (entrada, init) => {
  const u = new URL(String(entrada));
  const r = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  if (!String(entrada).startsWith(API_ML)) return r({}, 404);
  if (u.pathname === `/orders/${ORDEN}`) return r({ id: ORDEN, status: "paid", date_closed: "2026-10-16T10:00:00Z", buyer: { nickname: "PRUEBA_ML" },
    shipping: { id: 99 }, order_items: [{ item: { id: "MLM-T-ML", title: "Polea prueba ML", seller_sku: "T-ML-POLEA" }, quantity: 1, unit_price: 1160 }] });
  if (u.pathname === "/shipments/99") return r({ id: 99, logistic_type: "fulfillment" });
  if (u.pathname === "/questions/880001") return r({ id: 880001, item_id: "MLM-T-ML", text: "¿Tienen factura?", status: "UNANSWERED", date_created: "2026-10-16T11:00:00Z" });
  if (u.pathname === "/items/MLM-T-ML") return r({ title: "Polea prueba ML" });
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
    const { data: ped } = await admin.from("pedidos").select("id").eq("canal", "mercadolibre").eq("id_externo", String(ORDEN)).maybeSingle();
    if (ped) {
      const { data: envs } = await admin.from("envios").select("id").eq("pedido_id", ped.id);
      for (const e of envs ?? []) {
        await admin.from("eventos_envio").delete().eq("envio_id", e.id);
        await admin.from("envio_lineas").delete().eq("envio_id", e.id);
        await admin.from("envios").delete().eq("id", e.id);
      }
      await admin.from("ml_ventas").delete().eq("pedido_id", ped.id);
      await admin.from("pedidos").delete().eq("id", ped.id);
    }
    await admin.from("ml_preguntas").delete().eq("id", 880001);
    await admin.from("ml_avisos").delete().in("resource", [`/orders/${ORDEN}`, "/questions/880001"]);
    await admin.from("publicaciones").delete().eq("id_externo", "MLM-T-ML");
    if (articulo) await admin.from("articulos").delete().eq("id", articulo);
    await admin.from("ml_cuenta").delete().eq("id", 1);
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
  });

  it("una pregunta llega pendiente y se contesta desde el ERP", async () => {
    await aviso({ topic: "questions", resource: "/questions/880001", user_id: 4242, application_id: "APP-PRUEBA" });
    const { data: q } = await admin.from("ml_preguntas").select("estado, titulo_publicacion, articulo_id").eq("id", 880001).single();
    expect(q).toEqual({ estado: "pendiente", titulo_publicacion: "Polea prueba ML", articulo_id: articulo });

    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const r = await atender(new Request("http://x/functions/v1/mercadolibre/responder", {
      method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` }, body: JSON.stringify({ pregunta_id: 880001, texto: "Sí, facturamos." }),
    }), entorno);
    expect(r.status).toBe(200);
    expect(enviados).toContainEqual({ ruta: "/answers", cuerpo: { question_id: 880001, text: "Sí, facturamos." } });
    expect((await admin.from("ml_preguntas").select("estado").eq("id", 880001).single()).data!.estado).toBe("contestada");
  });

  it("sin sesión no se contesta ni se conecta", async () => {
    const r = await atender(new Request("http://x/functions/v1/mercadolibre/responder", { method: "POST", body: "{}" }), entorno);
    expect(r.status).toBe(401);
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: s } = await db.auth.signInWithPassword({ email: "almacen@hegamex.com", password: "hegamex-local" });
    const c = await atender(new Request("http://x/functions/v1/mercadolibre/iniciar", { method: "POST", headers: { Authorization: `Bearer ${s.session!.access_token}` } }), entorno);
    expect(c.status).toBe(403);
  });
});
