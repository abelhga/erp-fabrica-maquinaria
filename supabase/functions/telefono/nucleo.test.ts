// La puerta del conmutador: sin la llave vigente contesta 401 (y no toca la base), un cuerpo mal
// hecho 400, y la misma foto dos veces deja una sola llamada y un solo lead. «Quién llama» (GET
// /contexto) contesta 400 a un teléfono que no lo es y, para un cliente con su pedido en planta, el
// folio, el estado y el avance sin ningún monto. Lo de la base (cliente, dueño, regresar llamada,
// el avance) lo prueban supabase/pruebas/258_telefono.sql y 259_telefono_contexto.sql. La parte contra la base
// local necesita la llave de servicio (SUPABASE_SERVICE_ROLE_KEY y DATABASE_URL); sin ella se brinca.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { atender, telefonoValido, validar } from "./nucleo.ts";

const base = { version: 1, tipo: "llamada", call_sid: "CA-prueba", llamada: { telefono: "+523312345678", nadie_contesto: false }, lead: null };

describe("validar", () => {
  it("acepta la foto del contrato", () => {
    expect(validar(base).ok).toBe(true);
    expect(validar({ ...base, enviado_en: "2026-11-06T22:10:00Z", lead: { nombre: "Juan", interes: "Banda", ciudad: "Tepatitlán", estado: "Jalisco" },
      llamada: { ...base.llamada, duracion_seg: 252, atendio: { nombre: "Isaac", telefono: null }, atendio_ia: "Sofía" } }).ok).toBe(true);
  });
  it.each([
    ["sin versión 1", { ...base, version: 2 }, "Versión"],
    ["otro tipo", { ...base, tipo: "sms" }, "Tipo"],
    ["call_sid vacío", { ...base, call_sid: " " }, "call_sid"],
    ["call_sid número", { ...base, call_sid: 12 }, "call_sid"],
    ["sin llamada", { ...base, llamada: null }, "llamada"],
    ["duración negativa", { ...base, llamada: { duracion_seg: -1 } }, "duracion_seg"],
    ["nadie_contesto texto", { ...base, llamada: { nadie_contesto: "no" } }, "nadie_contesto"],
    ["atendio texto", { ...base, llamada: { atendio: "Isaac" } }, "atendio"],
    ["lead lista", { ...base, lead: [] }, "lead"],
    ["lead.correo número", { ...base, lead: { correo: 5 } }, "lead.correo"],
    ["lead.estado número", { ...base, lead: { estado: 14 } }, "lead.estado"],
  ])("rechaza %s", (_n, cuerpo, texto) => {
    const r = validar(cuerpo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(texto);
  });
});

describe("sin llave no entra", () => {
  // La URL no existe: si la función intentara hablar con la base, la prueba tronaría.
  const entorno = { supabaseUrl: "http://127.0.0.1:9", serviceKey: "x" };
  it("una llave corta o ausente es 401 sin preguntarle a la base", async () => {
    const r = await atender(new Request("http://local/functions/v1/telefono/evento", { method: "POST", body: "{}" }), entorno);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "Llave inválida" });
  });
  it("sin llave, «quién llama» también es 401 sin preguntarle a la base", async () => {
    const r = await atender(new Request("http://local/functions/v1/telefono/contexto?tel=%2B523312345678"), entorno);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "Llave inválida" });
    const corta = await atender(new Request("http://local/functions/v1/telefono/contexto?tel=3312345678", { headers: { "x-llave": "corta" } }), entorno);
    expect(corta.status).toBe(401);
  });
  it("otra ruta u otro método es 404", async () => {
    expect((await atender(new Request("http://local/functions/v1/telefono/otra", { method: "POST" }), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/evento"), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/contexto", { method: "POST" }), entorno)).status).toBe(404);
  });
});

describe("telefonoValido", () => {
  it.each([["+523312345678", true], ["33 1234 5678", true], ["5213312345678", true], ["12345", false], ["", false], [null, false], ["abc", false]])(
    "%s → %s", (tel, ok) => expect(telefonoValido(tel)).toBe(ok));
});

// -----------------------------------------------------------------------------
const ruta = new URL("../../../.env.local", import.meta.url);
const env = existsSync(ruta) ? Object.fromEntries(
  readFileSync(ruta, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
) : {};
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const URL_PG = process.env.DATABASE_URL ?? env.DATABASE_URL;
const hayBase = !!SERVICIO && !!URL_PG && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

describe.skipIf(!hayBase)("contra la base local", () => {
  const c = new pg.Client({ connectionString: URL_PG });
  const LLAVE = `tel_prueba_${"x".repeat(40)}`;
  const SID = `CA-vitest-${Date.now()}`;
  let antes: Record<string, unknown> | null = null;
  const entorno = { supabaseUrl: URL_SB, serviceKey: SERVICIO ?? "" };
  const mandar = (cuerpo: unknown, llave = LLAVE) => atender(new Request("http://local/functions/v1/telefono/evento", {
    method: "POST", headers: { "x-llave": llave, "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }), entorno);
  const pedir = (tel: string | null, llave = LLAVE) => atender(new Request(
    `http://local/functions/v1/telefono/contexto${tel === null ? "" : `?tel=${encodeURIComponent(tel)}`}`,
    { headers: { "x-llave": llave } }), entorno);
  // Un cliente con su pedido en producción: Pailería terminada (10 h) y Pintura a la mitad (10 h) = 75 %.
  const TEL_CLI = `33${String(Date.now()).slice(-8)}`;
  const ids: { cliente?: string; articulo?: string; pedido?: string; orden?: string; folio?: string } = {};
  const foto = {
    version: 1, tipo: "llamada", call_sid: SID, enviado_en: new Date().toISOString(),
    llamada: { telefono: "+525550009901", inicio: new Date(Date.now() - 300_000).toISOString(), fin: new Date().toISOString(),
      duracion_seg: 300, estado: "completed", area: "ventas", area_nombre: "Ventas", atendio: null, atendio_ia: "Sofía",
      nadie_contesto: true, resumen: "Prueba de la función: busca una tolva", grabacion_url: null, grabacion_vence: null },
    lead: { id_voz: 1, nombre: "Prueba Vitest", empresa: null, telefono: "+525550009901", correo: null,
      interes: "Tolva de prueba 5 m3", detalle: null, notas: null },
  };

  beforeAll(async () => {
    await c.connect();
    antes = (await c.query("select * from public.telefono_cuenta where id = 1")).rows[0];
    await c.query("update public.telefono_cuenta set llave_huella = public._telefono_huella($1) where id = 1", [LLAVE]);
    const uno = async (sql: string, p: unknown[]) => (await c.query(sql, p)).rows[0];
    ids.cliente = (await uno("insert into public.clientes (nombre) values ('Vitest Contexto') returning id", [])).id;
    await c.query("insert into public.contactos (cliente_id, nombre, telefono, correo) values ($1, 'Vitest', $2, 'vitest@ejemplo.com')", [ids.cliente, TEL_CLI]);
    ids.articulo = (await uno("insert into public.articulos (clave, tipo, nombre) values ($1, 'equipo', 'Banda Vitest') returning id", [`VT-${Date.now()}`])).id;
    const ped = await uno(`insert into public.pedidos (cliente_id, canal, estado, fecha_compromiso)
      values ($1, 'directo', 'en_produccion', current_date + 15) returning id, folio`, [ids.cliente]);
    ids.pedido = ped.id; ids.folio = ped.folio;
    await c.query("insert into public.pedido_lineas (pedido_id, articulo_id, titulo, cantidad, precio_unitario) values ($1, $2, 'Banda Vitest 20 m', 1, 98765.43)", [ids.pedido, ids.articulo]);
    ids.orden = (await uno("insert into public.ordenes_produccion (articulo_id, cantidad, estado, pedido_id) values ($1, 1, 'en_proceso', $2) returning id", [ids.articulo, ids.pedido])).id;
    await c.query(`insert into public.op_operaciones (orden_id, etapa_id, horas_estimadas, estado, avance)
      select $1, id, 10, case nombre when 'Pailería' then 'terminada'::estado_operacion else 'en_proceso' end, case nombre when 'Pintura' then 0.5 end
      from public.etapas where nombre in ('Pailería', 'Pintura')`, [ids.orden]);
  });
  afterAll(async () => {
    const leads = (await c.query("select id from public.leads where llamada_id in (select id from public.llamadas where call_sid = $1)", [SID])).rows.map((r: { id: string }) => r.id);
    await c.query("delete from public.avisos where registro_id = any($1::text[])", [leads]);
    await c.query("delete from public.leads where id = any($1::uuid[])", [leads]);
    await c.query("delete from public.llamadas where call_sid = $1", [SID]);
    if (ids.orden) {
      await c.query("delete from public.op_operaciones where orden_id = $1", [ids.orden]);
      await c.query("delete from public.ordenes_produccion where id = $1", [ids.orden]);
    }
    if (ids.pedido) {
      await c.query("delete from public.avisos where registro_id = any($1::text[])", [[ids.pedido, ids.orden].filter(Boolean)]);
      await c.query("delete from public.pedido_lineas where pedido_id = $1", [ids.pedido]);
      await c.query("delete from public.pedidos where id = $1", [ids.pedido]);
    }
    if (ids.cliente) {
      await c.query("delete from public.contactos where cliente_id = $1", [ids.cliente]);
      await c.query("delete from public.clientes where id = $1", [ids.cliente]);
    }
    if (ids.articulo) await c.query("delete from public.articulos where id = $1", [ids.articulo]);
    if (antes) {
      await c.query(`update public.telefono_cuenta set llave_huella = $1, generada_en = $2, generada_por = $3, ultimo_evento_en = $4,
        ultimo_error = $5, ultimo_error_en = $6 where id = 1`,
        [antes.llave_huella, antes.generada_en, antes.generada_por, antes.ultimo_evento_en, antes.ultimo_error, antes.ultimo_error_en]);
    }
    await c.end();
  });

  it("una llave que no es la vigente es 401 y queda anotado", async () => {
    const r = await mandar(foto, `tel_otra_${"y".repeat(40)}`);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "Llave inválida" });
    expect((await c.query("select ultimo_error from public.telefono_cuenta where id = 1")).rows[0].ultimo_error).toContain("ERP_LLAVE");
    expect((await c.query("select count(*)::int n from public.llamadas where call_sid = $1", [SID])).rows[0].n).toBe(0);
  });

  it("un cuerpo mal hecho es 400", async () => {
    expect((await mandar("{no es json")).status).toBe(400);
    const r = await mandar({ ...foto, version: 2 });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("Versión");
    // La forma está bien pero la fecha no: lo rechaza la base (22xxx) y también es 400.
    const f = await mandar({ ...foto, llamada: { ...foto.llamada, inicio: "ayer en la tarde" } });
    expect(f.status).toBe(400);
  });

  it("la misma foto dos veces deja una llamada y un lead", async () => {
    const r1 = await mandar(foto);
    expect(r1.status).toBe(200);
    const a = await r1.json();
    expect(a).toMatchObject({ ok: true, cliente_id: null });
    expect(a.llamada_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.lead_id).toMatch(/^[0-9a-f-]{36}$/);
    const r2 = await mandar(foto);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual(a);
    expect((await c.query("select count(*)::int n from public.llamadas where call_sid = $1", [SID])).rows[0].n).toBe(1);
    expect((await c.query("select count(*)::int n from public.leads where llamada_id = $1", [a.llamada_id])).rows[0].n).toBe(1);
    const t = (await c.query("select ultimo_evento_en is not null visto, ultimo_error from public.telefono_cuenta where id = 1")).rows[0];
    expect(t).toEqual({ visto: true, ultimo_error: null });
  });

  it("quién llama: sin la llave vigente es 401; sin teléfono o con uno corto, 400", async () => {
    expect((await pedir(TEL_CLI, `tel_otra_${"y".repeat(40)}`)).status).toBe(401);
    for (const tel of [null, "", "12345", "sin numero"]) {
      const r = await pedir(tel);
      expect(r.status, String(tel)).toBe(400);
      expect(await r.json()).toEqual({ error: "Teléfono inválido" });
    }
  });

  it("quién llama: un número que no es de nadie es 200 con conocido:false", async () => {
    const r = await pedir("+52 99 0000 0000");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, conocido: false, cliente: null, lead: null, vendedor: null, pedidos: [], cotizaciones: [] });
  });

  it("quién llama: el cliente con su pedido en producción, con avance y sin montos", async () => {
    const r = await pedir(`+52${TEL_CLI}`);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toMatchObject({ ok: true, conocido: true, cliente: { nombre: "Vitest Contexto" }, vendedor: null, cotizaciones: [] });
    expect(d.pedidos).toHaveLength(1);
    expect(d.pedidos[0]).toMatchObject({ folio: ids.folio, que_es: "Banda Vitest 20 m", estado: "En producción", etapa: "Pintura",
      avance: 75, en_espera: false, atrasado: false });
    // Ni una llave de dinero o datos personales, a ninguna profundidad; ni el precio escrito.
    const llaves: string[] = [];
    const recorrer = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(recorrer);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { llaves.push(k); recorrer(x); }
    };
    recorrer(d);
    expect(llaves.filter((k) => /total|subtotal|importe|precio|costo|margen|monto|iva|rfc|correo|domicilio|direccion/i.test(k))).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/98765|vitest@ejemplo/);
  });
});
