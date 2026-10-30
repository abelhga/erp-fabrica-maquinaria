// La revisión nocturna con una API de lotes falsa: que el lote lleve solo los módulos con datos
// (y los consejos solo el día que tocan), que lo que Claude regresa mal formado se descarte, y,
// contra la base local, que enviar → recoger deje los hallazgos ligados al registro y a quien lo
// capturó. Necesita la llave de servicio de la base local; sin ella se brinca esa parte.
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { armarPeticiones, atender, diaPlanta, jsonDeMensaje, leerConsejos, leerModulo, tieneDatos, type ClienteLotes } from "./nucleo.ts";

describe("armar y leer", () => {
  const datos = {
    hoy: "2026-11-02 02:07",
    inventario: { salidas_y_entradas: [], ajustes: [] },
    compras: { ordenes: [{ ref: "OC-26-1" }], articulos_nuevos: [] },
    ventas: { cotizaciones: [], seguimientos_cerrados: [{ cotizacion: "COT-1" }] },
    ya_dicho: [{ titulo: "algo" }],
  };

  it("un módulo sin capturas no gasta una petición", () => {
    expect(tieneDatos(datos.inventario)).toBe(false);
    const p = armarPeticiones(datos, null, "claude-opus-5-5");
    expect(p.map((x) => x.custom_id)).toEqual(["m-compras", "m-ventas"]);
    const cuerpo = JSON.parse(String(p[0].params.messages[0].content));
    expect(cuerpo).toEqual({ hoy: datos.hoy, compras: datos.compras, ya_dicho: datos.ya_dicho });
    expect(p[0].params).toMatchObject({ model: "claude-opus-5-5", thinking: { type: "adaptive" } });
  });

  it("una petición por persona, y nada para un id raro", () => {
    const p = armarPeticiones({}, [{ usuario: "0688c701-9d8a-4125-9079-4d3410ac35d7", nombre: "Abel" }, { usuario: "x' or 1=1" }], "m");
    expect(p.map((x) => x.custom_id)).toEqual(["c-0688c701-9d8a-4125-9079-4d3410ac35d7"]);
  });

  it("el día de consejos es el de la planta, no el de UTC", () => {
    expect(diaPlanta(new Date("2026-11-02T03:00:00Z"))).toBe(7);   // domingo 9 p.m. en la planta
    expect(diaPlanta(new Date("2026-11-02T09:00:00Z"))).toBe(1);   // lunes 3 a.m.
  });

  it("lo mal formado se descarta: tabla inventada, sin ref, más de 8", () => {
    const bueno = { titulo: "t", detalle: "d", para: "responsable", tabla: "ordenes_compra", ref: "OC-1", gravedad: "media" };
    const r = leerModulo({ lectura: " Día normal. ", hallazgos: [
      ...Array.from({ length: 9 }, () => bueno), { ...bueno, tabla: "usuarios" }, { ...bueno, ref: "" }, { ...bueno, para: "todos" }] });
    expect(r?.lectura).toBe("Día normal.");
    expect(r?.hallazgos).toHaveLength(8);
    expect(leerModulo({ hallazgos: [] })).toBeNull();
    expect(leerConsejos({ consejos: [{ titulo: "a", texto: "b", experimento: "" }, { titulo: "", texto: "x" }] }))
      .toEqual([{ tema: "uso_erp", titulo: "a", texto: "b", por_que: "", experimento: null }]);
  });

  it("el JSON sale del último bloque de texto; una negativa o un corte no se leen", () => {
    const m = { content: [{ type: "thinking" }, { type: "text", text: '{"a":1}' }], stop_reason: "end_turn" };
    expect(jsonDeMensaje(m)).toEqual({ a: 1 });
    expect(jsonDeMensaje({ ...m, stop_reason: "max_tokens" })).toBeNull();
    expect(jsonDeMensaje({ ...m, stop_reason: "refusal" })).toBeNull();
    expect(jsonDeMensaje({ content: [{ type: "text", text: "no es json" }] })).toBeNull();
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
const URL_PG = process.env.DATABASE_URL ?? env.DATABASE_URL;
const hayBase = !!SERVICIO && !!URL_PG && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

describe.skipIf(!hayBase)("enviar y recoger contra la base local", () => {
  const c = new pg.Client({ connectionString: URL_PG });
  const FOLIO = `OC-T209-${Date.now() % 100000}`;
  let corrida = 0, usuario = "", urlAntes: string | null = null;
  const enviados: { custom_id: string }[][] = [];
  const falso: ClienteLotes = {
    messages: {
      batches: {
        create: (async (b: { requests: { custom_id: string }[] }) => { enviados.push(b.requests); return { id: "msgbatch_prueba" }; }) as never,
        retrieve: (async () => ({ id: "msgbatch_prueba", processing_status: "ended" })) as never,
        results: (async () => (async function* () {
          const msg = (valor: unknown) => ({ type: "succeeded", message: { content: [{ type: "text", text: JSON.stringify(valor) }], stop_reason: "end_turn",
            usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } });
          yield { custom_id: "m-compras", result: msg({ lectura: "Una compra nueva.", hallazgos: [
            { titulo: `${FOLIO} pide 100 tramos y la nota dice 10`, detalle: "Revisa la cantidad.", para: "responsable", tabla: "ordenes_compra", ref: FOLIO, gravedad: "media" }] }) };
          yield { custom_id: `c-${usuario}`, result: msg({ consejos: [
            { tema: "uso_erp", titulo: "Captura al momento", texto: "Pasaste 40 capturas en 15 minutos.", por_que: "3 rachas", experimento: null }] }) };
          yield { custom_id: "m-ventas", result: { type: "errored", error: { type: "error", error: { type: "api_error", message: "x" } } } };
        })()) as never,
      },
    },
  };
  const entorno = { supabaseUrl: URL_SB, supabaseAnonKey: ANON, serviceKey: SERVICIO ?? "", crearAnthropic: () => falso,
    hoy: () => new Date("2026-11-02T09:00:00Z") };
  const pedir = async (accion: string, llave: string) =>
    (await atender(new Request(`http://local/functions/v1/revision/${accion}`, { method: "POST", headers: { "x-llave": llave } }), entorno)).json();

  afterAll(async () => {
    if (!hayBase) return;
    await c.query("delete from public.consejos where corrida_id = $1", [corrida]);
    await c.query("delete from public.revision_hallazgos where corrida_id = $1", [corrida]);
    await c.query("delete from public.avisos where tabla = 'revision_corridas' and registro_id = $1", [String(corrida)]);
    await c.query("delete from public.revision_corridas where id = $1", [corrida]);
    await c.query("delete from public.ordenes_compra where folio = $1", [FOLIO]);
    await c.query("update public.revision_cuenta set url_funciones = $1 where id = 1", [urlAntes]);
    await c.end();
  });

  it("sin la llave de la base no hace nada", async () => {
    await c.connect();
    expect(await pedir("enviar", "no-es-la-llave")).toEqual({ error: "Llave no válida" });
  });

  it("manda un lote con lo de ayer y lo recoge ligado a quien capturó", async () => {
    urlAntes = (await c.query("select url_funciones from public.revision_cuenta where id = 1")).rows[0].url_funciones;
    await c.query("update public.revision_cuenta set url_funciones = 'http://local' where id = 1");
    const llave = (await c.query("select llave from public.revision_cuenta where id = 1")).rows[0].llave as string;
    usuario = (await c.query("select id from public.perfiles order by creado_en limit 1")).rows[0].id;
    const prov = (await c.query("select id from public.proveedores limit 1")).rows[0].id;
    await c.query("insert into public.ordenes_compra (folio, proveedor_id, estado, fecha, creado_por) values ($1, $2, 'enviada', current_date, $3)", [FOLIO, prov, usuario]);
    corrida = Number((await c.query("insert into public.revision_corridas default values returning id")).rows[0].id);

    const r = await pedir("enviar", llave);
    expect(r).toMatchObject({ ok: true, lote: "msgbatch_prueba" });
    const ids = enviados[0].map((x) => x.custom_id);
    expect(ids).toContain("m-compras");
    expect(ids.some((x) => x.startsWith("c-"))).toBe(true);     // lunes: van los consejos
    expect((await c.query("select lote_id, claude_estado from public.revision_corridas where id = $1", [corrida])).rows[0])
      .toEqual({ lote_id: "msgbatch_prueba", claude_estado: "enviado" });

    const g = await pedir("recoger", llave);
    expect(g).toMatchObject({ ok: true, hallazgos: 1, consejos: 1, entrada: 2000, salida: 400, errores: 1 });
    const h = (await c.query("select responsables, ruta, origen from public.revision_hallazgos where corrida_id = $1", [corrida])).rows;
    expect(h).toHaveLength(1);
    expect(h[0].responsables).toEqual([usuario]);
    expect(h[0]).toMatchObject({ origen: "claude" });
    expect(h[0].ruta).toMatch(/^\/compras\/ordenes\//);
    const k = (await c.query("select termino_en is not null termino, claude_estado, lecturas->>'compras' lectura, nota from public.revision_corridas where id = $1", [corrida])).rows[0];
    expect(k).toMatchObject({ termino: true, claude_estado: "recogido", lectura: "Una compra nueva." });
    expect(k.nota).toContain("m-ventas: errored");
    expect((await c.query("select titulo from public.consejos where corrida_id = $1 and usuario_id = $2", [corrida, usuario])).rows)
      .toEqual([{ titulo: "Captura al momento" }]);
  });
});
