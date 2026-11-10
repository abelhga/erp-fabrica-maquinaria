// La puerta del conmutador: sin la llave vigente contesta 401 (y no toca la base), un cuerpo mal
// hecho 400, y la misma foto dos veces deja una sola llamada y un solo lead. «Quién llama» (GET
// /contexto) contesta 400 a un teléfono que no lo es y, para un cliente con su pedido en planta, el
// folio, el estado y el avance sin ningún monto. Lo de la base (cliente, dueño, regresar llamada,
// el avance) lo prueban supabase/pruebas/258_telefono.sql y 259_telefono_contexto.sql; el coaching y el
// análisis (fase 3), 261_telefono_coaching_analisis.sql; lo que contesta el vendedor por WhatsApp y el
// resumen de la mañana (fase 4), 262_telefono_whatsapp.sql. Aquí, de la fase 4: sin llave 401, un
// cuerpo mal hecho 400, un número no ligado no mueve nada, «contactado» deja el intento a nombre del
// vendedor una sola vez aunque llegue dos, y el resumen trae la liga completa. La parte contra la base
// local necesita la llave de servicio (SUPABASE_SERVICE_ROLE_KEY y DATABASE_URL); sin ella se brinca.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { atender, telefonoValido, validar, validarAccion, validarBorrado } from "./nucleo.ts";

const base = { version: 1, tipo: "llamada", call_sid: "CA-prueba", llamada: { telefono: "+523312345678", nadie_contesto: false }, lead: null };
// Fase 3, como viene en el contrato.
const coaching = {
  rubrica: { clave: "ventas-2026-11", version: 3 }, calificacion: 7.4, calificacion_sin_topes: 8.1,
  criterios: [{ clave: "siguiente_paso", nombre: "Siguiente paso con fecha", peso: 20, nota: 4, evidencia: "«Le marco el jueves a las 10»", segundo: 143 }],
  topes: [{ clave: "sin_canal", nombre: "Colgó sin canal de seguimiento", maximo: 4 }],
  fallos: [{ clave: "no-cerro-fecha", nombre: "No cerró fecha", texto: "Quedó en «luego le hablo»" }],
  tono: [{ clave: "sono-calido", nombre: "Sonó cálido", signo: 1, texto: "Saludó con calma" }],
  lo_bueno: ["Preguntó para qué material"], a_mejorar: ["Cerrar con fecha"], sugerencias: ["Proponer día y hora"],
  resumen: "Buena llamada; faltó cerrar fecha.", atendio_tipo: "persona", modelo: "modelo-x", generado_en: "2026-11-09T18:00:00Z",
};
const analisis = {
  intencion: "cotizar", desenlace: "transferida", equipos: [{ texto: "banda transportadora", clave_catalogo: null }],
  preguntas_sin_respuesta: ["¿Manejan bandas de PVC grado alimenticio?"], objeciones: [{ categoria: "precio", texto: "Le pareció caro" }],
  stt_dudoso: false, fuente_transcripcion: "scribe", modelo: "modelo-x", generado_en: "2026-11-09T18:00:00Z",
};

describe("validar", () => {
  it("acepta la foto del contrato", () => {
    expect(validar(base).ok).toBe(true);
    expect(validar({ ...base, enviado_en: "2026-11-06T22:10:00Z", lead: { nombre: "Juan", interes: "Banda", ciudad: "Tepatitlán", estado: "Jalisco" },
      llamada: { ...base.llamada, duracion_seg: 252, atendio: { nombre: "Isaac", telefono: null }, atendio_ia: "Sofía" } }).ok).toBe(true);
  });
  it("acepta coaching y análisis del contrato (fase 3), y null para borrarlos", () => {
    expect(validar({ ...base, coaching: coaching, analisis: analisis, llamada: { ...base.llamada, historica: true } }).ok).toBe(true);
    expect(validar({ ...base, coaching: null, analisis: null }).ok).toBe(true);
    // Un valor de intención que el ERP todavía no conoce no tira la llamada.
    expect(validar({ ...base, analisis: { ...analisis, intencion: "garantia" } }).ok).toBe(true);
  });
  it.each([
    ["coaching texto", { ...base, coaching: "7.4" }, "coaching debe"],
    ["coaching lista", { ...base, coaching: [] }, "coaching debe"],
    ["calificación 11", { ...base, coaching: { ...coaching, calificacion: 11 } }, "coaching.calificacion"],
    ["calificación 0.5", { ...base, coaching: { ...coaching, calificacion: 0.5 } }, "coaching.calificacion"],
    ["calificación texto", { ...base, coaching: { ...coaching, calificacion: "7" } }, "coaching.calificacion"],
    ["sin topes 12", { ...base, coaching: { ...coaching, calificacion_sin_topes: 12 } }, "calificacion_sin_topes"],
    ["sin atendio_tipo", { ...base, coaching: { ...coaching, atendio_tipo: undefined } }, "atendio_tipo"],
    ["criterios objeto", { ...base, coaching: { ...coaching, criterios: {} } }, "coaching.criterios"],
    ["criterio con nota 11", { ...base, coaching: { ...coaching, criterios: [{ ...coaching.criterios[0], nota: 11 }] } }, "coaching.criterios"],
    ["evidencia larga", { ...base, coaching: { ...coaching, criterios: [{ ...coaching.criterios[0], evidencia: "x".repeat(201) }] } }, "coaching.criterios"],
    ["6 fallos", { ...base, coaching: { ...coaching, fallos: Array(6).fill(coaching.fallos[0]) } }, "coaching.fallos"],
    ["tono sin signo", { ...base, coaching: { ...coaching, tono: [{ clave: "x", nombre: "X" }] } }, "coaching.tono"],
    ["4 sugerencias", { ...base, coaching: { ...coaching, sugerencias: ["a", "b", "c", "d"] } }, "coaching.sugerencias"],
    ["resumen largo", { ...base, coaching: { ...coaching, resumen: "x".repeat(601) } }, "coaching.resumen"],
    ["análisis texto", { ...base, analisis: "cotizar" }, "analisis debe"],
    ["6 preguntas", { ...base, analisis: { ...analisis, preguntas_sin_respuesta: ["1", "2", "3", "4", "5", "6"] } }, "preguntas_sin_respuesta"],
    ["equipo sin objeto", { ...base, analisis: { ...analisis, equipos: ["banda"] } }, "analisis.equipos"],
    ["stt_dudoso texto", { ...base, analisis: { ...analisis, stt_dudoso: "no" } }, "stt_dudoso"],
    ["historica texto", { ...base, llamada: { ...base.llamada, historica: "si" } }, "historica"],
  ])("rechaza %s", (_n, cuerpo, texto) => {
    const r = validar(cuerpo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(texto);
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

// Fase 4, como viene en el contrato.
const accion = {
  version: 1, tipo: "accion", id: "SMprueba", quien: { telefono: "+523311112621", nombre: "Isaac Hernández" },
  lead: { erp_id: "3f2a91c0-0000-4000-8000-000000000001", call_sid: null }, accion: "contactado",
  texto: "Le interesa la de 20 m", motivo: null, cuando: null, canal: null,
};

describe("validarAccion", () => {
  it("acepta la acción del contrato, solo con call_sid y con fecha para recordar", () => {
    expect(validarAccion(accion).ok).toBe(true);
    expect(validarAccion({ ...accion, lead: { erp_id: null, call_sid: "CA123" } }).ok).toBe(true);
    expect(validarAccion({ ...accion, accion: "recordar", cuando: "2026-11-12T09:00:00-06:00", canal: "whatsapp" }).ok).toBe(true);
    expect(validarAccion({ ...accion, accion: "perdido", motivo: "precio", texto: null }).ok).toBe(true);
  });
  it.each([
    ["otra versión", { ...accion, version: 2 }, "Versión"],
    ["otro tipo", { ...accion, tipo: "llamada" }, "Tipo"],
    ["sin id", { ...accion, id: "" }, "id"],
    ["id largo", { ...accion, id: "x".repeat(101) }, "id"],
    ["sin quien", { ...accion, quien: null }, "quien.telefono"],
    ["teléfono corto", { ...accion, quien: { telefono: "12345" } }, "quien.telefono"],
    ["sin lead", { ...accion, lead: { erp_id: null, call_sid: null } }, "erp_id o call_sid"],
    ["erp_id no uuid", { ...accion, lead: { erp_id: "123" } }, "lead.erp_id"],
    ["acción desconocida", { ...accion, accion: "bailar" }, "Acción"],
    ["texto largo", { ...accion, texto: "x".repeat(1001) }, "texto"],
    ["motivo número", { ...accion, motivo: 5 }, "motivo"],
    ["canal fax", { ...accion, canal: "fax" }, "canal"],
    ["cuando sin fecha", { ...accion, cuando: "el jueves" }, "cuando"],
  ])("rechaza %s", (_n, cuerpo, texto) => {
    const r = validarAccion(cuerpo);
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
  it("sin llave, la respuesta de WhatsApp y el resumen también son 401 sin preguntarle a la base", async () => {
    const r = await atender(new Request("http://local/functions/v1/telefono/accion", { method: "POST", body: JSON.stringify(accion) }), entorno);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "Llave inválida" });
    const s = await atender(new Request("http://local/functions/v1/telefono/resumen?tel=%2B523311112621", { headers: { "x-llave": "corta" } }), entorno);
    expect(s.status).toBe(401);
  });
  it("sin llave, borrar una llamada también es 401 sin preguntarle a la base", async () => {
    const r = await atender(new Request("http://local/functions/v1/telefono/borrar", { method: "POST", body: JSON.stringify({ version: 1, tipo: "borrar", call_sid: "CA1" }) }), entorno);
    expect(r.status).toBe(401);
    expect((await atender(new Request("http://local/functions/v1/telefono/borrar"), entorno)).status).toBe(404);
  });
  it("otra ruta u otro método es 404", async () => {
    expect((await atender(new Request("http://local/functions/v1/telefono/accion"), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/resumen", { method: "POST" }), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/otra", { method: "POST" }), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/evento"), entorno)).status).toBe(404);
    expect((await atender(new Request("http://local/functions/v1/telefono/contexto", { method: "POST" }), entorno)).status).toBe(404);
  });
});

describe("validarBorrado", () => {
  it("pide versión 1, tipo borrar y el call_sid", () => {
    expect(validarBorrado({ version: 1, tipo: "borrar", call_sid: " CA123 " })).toEqual({ ok: true, call_sid: "CA123" });
    expect(validarBorrado({ version: 2, tipo: "borrar", call_sid: "CA1" }).ok).toBe(false);
    expect(validarBorrado({ version: 1, tipo: "llamada", call_sid: "CA1" }).ok).toBe(false);
    expect(validarBorrado({ version: 1, tipo: "borrar", call_sid: "" }).ok).toBe(false);
    expect(validarBorrado("x").ok).toBe(false);
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

  it("fase 3: el coaching y el análisis van a sus tablas, no a llamadas.datos; null los borra", async () => {
    const sid = `${SID}-f3`;
    const conF3 = { ...foto, call_sid: sid, lead: null, coaching, analisis, llamada: { ...foto.llamada, nadie_contesto: false, historica: true } };
    try {
      const r = await mandar(conF3);
      expect(r.status).toBe(200);
      const { llamada_id } = await r.json();
      const fila = (await c.query(`select ll.datos, ll.historica, k.calificacion::float cal, k.atendio_tipo, a.intencion
        from public.llamadas ll left join public.llamada_coaching k on k.llamada_id = ll.id left join public.llamada_analisis a on a.llamada_id = ll.id
        where ll.id = $1`, [llamada_id])).rows[0];
      expect(fila).toMatchObject({ historica: true, cal: 7.4, atendio_tipo: "persona", intencion: "cotizar" });
      expect(Object.keys(fila.datos)).not.toContain("coaching");
      expect(Object.keys(fila.datos)).not.toContain("analisis");
      // Un coaching fuera de escala es 400 y no toca lo que había.
      const mal = await mandar({ ...conF3, coaching: { ...coaching, calificacion: 12 } });
      expect(mal.status).toBe(400);
      expect((await c.query("select calificacion::float c from public.llamada_coaching where llamada_id = $1", [llamada_id])).rows[0].c).toBe(7.4);
      expect((await mandar({ ...conF3, coaching: null, analisis: null })).status).toBe(200);
      const n = (await c.query(`select (select count(*) from public.llamada_coaching where llamada_id = $1)::int k,
        (select count(*) from public.llamada_analisis where llamada_id = $1)::int a`, [llamada_id])).rows[0];
      expect(n).toEqual({ k: 0, a: 0 });
    } finally {
      await c.query("delete from public.llamadas where call_sid = $1", [sid]);
    }
  });

  describe("fase 4: lo que contesta el vendedor por WhatsApp", () => {
    const sello = String(Date.now()).slice(-8);
    const TEL_VEN = `+52 33${sello}`, TEL_NADIE = `+52 55${sello}`;
    const APP = "https://erp.prueba";
    const e4 = { ...entorno, appUrl: APP };
    const f4: { ven?: string; lead?: string; otro?: string } = {};
    const ids4: string[] = [];
    const accionar = (cuerpo: unknown, llave = LLAVE) => atender(new Request("http://local/functions/v1/telefono/accion", {
      method: "POST", headers: { "x-llave": llave, "Content-Type": "application/json" },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }), e4);
    const resumir = (tel: string | null, llave = LLAVE) => atender(new Request(
      `http://local/functions/v1/telefono/resumen${tel === null ? "" : `?tel=${encodeURIComponent(tel)}`}`, { headers: { "x-llave": llave } }), e4);
    const msj = (id: string, tel: string, accion: string, texto: string | null = null) => {
      ids4.push(id);
      return { version: 1, tipo: "accion", id, quien: { telefono: tel, nombre: "Vitest WhatsApp" }, lead: { erp_id: f4.lead, call_sid: null },
        accion, texto, motivo: null, cuando: null, canal: null };
    };

    beforeAll(async () => {
      // Un vendedor (con el teléfono de su perfil, así se reconoce sin ligar nada) y dos leads suyos.
      f4.ven = (await c.query(`insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, '{"full_name":"Vitest Vendedor"}') returning id`,
        [`vitest-wa-${sello}@hegamex.com`])).rows[0].id;
      await c.query("insert into public.usuario_roles (usuario_id, rol) values ($1, 'ventas')", [f4.ven]);
      await c.query("update public.perfiles set nombre = 'Vitest Vendedor', telefono = $2 where id = $1", [f4.ven, TEL_VEN]);
      const lead = async (nombre: string) => {
        const id = (await c.query("insert into public.leads (nombre, telefono, interes) values ($1, $2, 'Tolva de prueba') returning id",
          [nombre, `+52 81${sello}`])).rows[0].id;
        await c.query("update public.leads set estado = 'asignado', vendedor_id = $2, como_se_asigno = 'gerente', asignado_en = now() where id = $1", [id, f4.ven]);
        return id as string;
      };
      f4.lead = await lead("Vitest Contactado");
      f4.otro = await lead("Vitest Sin Contactar");
    });
    afterAll(async () => {
      const leads = [f4.lead, f4.otro].filter(Boolean);
      await c.query("delete from public.telefono_acciones where id = any($1::text[])", [ids4]);
      await c.query("delete from public.telefono_directorio where clave = any($1::text[])", [[TEL_NADIE, TEL_VEN].map((t) => t.replace(/\D/g, "").slice(-10))]);
      await c.query("delete from public.lead_intentos where lead_id = any($1::uuid[])", [leads]);
      await c.query("delete from public.avisos where registro_id = any($1::text[]) or usuario_id = $2", [leads, f4.ven]);
      await c.query("delete from public.leads where id = any($1::uuid[])", [leads]);
      if (f4.ven) {
        await c.query("delete from public.usuario_roles where usuario_id = $1", [f4.ven]);
        await c.query("delete from auth.users where id = $1", [f4.ven]);
      }
    });

    it("una llave que no es la vigente es 401; un cuerpo mal hecho, 400, y no se guarda", async () => {
      expect((await accionar(msj("SM-vt-0", TEL_VEN, "nota", "x"), `tel_otra_${"y".repeat(40)}`)).status).toBe(401);
      expect((await accionar("{no es json")).status).toBe(400);
      const r = await accionar({ ...msj("SM-vt-0", TEL_VEN, "nota", "x"), accion: "bailar" });
      expect(r.status).toBe(400);
      expect((await r.json()).error).toContain("Acción");
      expect((await c.query("select count(*)::int n from public.telefono_acciones where id = 'SM-vt-0'")).rows[0].n).toBe(0);
    });

    it("un número que nadie ligó no mueve nada y queda en «Quién contesta»", async () => {
      const r = await accionar(msj(`SM-vt-1-${sello}`, TEL_NADIE, "contactado", "Le interesa la de 20 m"));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, aplicado: false, lead: null, liga: null,
        mensaje: "Tu número no está ligado en el ERP; pídele a dirección que lo ligue en Configuración → Integraciones → Teléfono" });
      expect((await c.query("select count(*)::int n from public.lead_intentos where lead_id = $1", [f4.lead])).rows[0].n).toBe(0);
      expect((await c.query("select perfil_id from public.telefono_directorio where clave = $1", [TEL_NADIE.replace(/\D/g, "").slice(-10)])).rows)
        .toEqual([{ perfil_id: null }]);
    });

    it("«contactado» deja el intento a su nombre, con la liga completa, y el mismo mensaje dos veces lo deja una vez", async () => {
      const cuerpo = msj(`SM-vt-2-${sello}`, TEL_VEN, "contactado", "Le interesa la de 20 m, quiere precio");
      const r1 = await accionar(cuerpo);
      expect(r1.status).toBe(200);
      const a = await r1.json();
      expect(a).toMatchObject({ ok: true, aplicado: true, lead: { id: f4.lead, nombre: "Vitest Contactado", estado: "asignado" },
        liga: `${APP}/ventas/leads?id=${f4.lead}` });
      expect(a.mensaje).toContain("contestó");
      const r2 = await accionar(cuerpo);
      expect(await r2.json()).toEqual(a);
      const intentos = (await c.query("select usuario_id, canal, resultado, via from public.lead_intentos where lead_id = $1", [f4.lead])).rows;
      expect(intentos).toEqual([{ usuario_id: f4.ven, canal: "llamada", resultado: "contesto", via: "whatsapp" }]);
    });

    it("una regla que lo frena es 200 con aplicado:false y el mensaje del ERP", async () => {
      const r = await accionar(msj(`SM-vt-3-${sello}`, TEL_VEN, "contactado"));
      expect(r.status).toBe(200);
      const a = await r.json();
      expect(a).toMatchObject({ ok: true, aplicado: false });
      expect(a.mensaje).toMatch(/^Escribe qué te dijo/);
    });

    it("el resumen de la mañana: sus leads sin contactar, sin montos y con la liga a «A quién llamar hoy»", async () => {
      expect((await resumir(TEL_VEN, `tel_otra_${"y".repeat(40)}`)).status).toBe(401);
      expect((await resumir("12345")).status).toBe(400);
      const r = await resumir(TEL_VEN);
      expect(r.status).toBe(200);
      const d = await r.json();
      expect(d).toMatchObject({ ok: true, vendedor: "Vitest Vendedor" });
      expect(d.texto).toContain("*Leads sin contactar (1):* Vitest Sin Contactar");
      expect(d.texto).not.toContain("Vitest Contactado");
      expect(d.texto.endsWith(`A quién llamar hoy: ${APP}/ventas/para-llamar`)).toBe(true);
      expect(d.texto.length).toBeLessThanOrEqual(1400);
      expect(d.texto).not.toMatch(/\$\s*\d/);
      expect(await (await resumir(TEL_NADIE)).json()).toEqual({ ok: true, vendedor: null, texto: null });
    });
  });

  it("quién llama: sin la llave vigente es 401; sin teléfono o con uno corto, 400", async () => {
    // La llave se revisa al mismo tiempo que la consulta: con una mala, del cliente no sale nada.
    const mala = await pedir(TEL_CLI, `tel_otra_${"y".repeat(40)}`);
    expect(mala.status).toBe(401);
    expect(await mala.json()).toEqual({ error: "Llave inválida" });
    const malaSinTel = await pedir(null, `tel_otra_${"y".repeat(40)}`);
    expect(malaSinTel.status).toBe(401);
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
