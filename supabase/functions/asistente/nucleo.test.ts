// Pruebas del asistente contra la base local de verdad (con la RLS de verdad) y un
// Claude falso: lo que se prueba es lo nuestro —que las herramientas lean con la
// sesión de quien pregunta, que el ciclo devuelva cada resultado, que el uso se
// registre y que los errores de la API se expliquen— sin gastar créditos.
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { atender, DOCUMENTOS, ejecutarHerramienta, ejemploDocumento, explicarError, validarEsquema, type Evento, type TipoDocumento } from "./nucleo.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../../../.env.local", import.meta.url), "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
);
// Las variables del proceso ganan, igual que en Vite: así se prueba contra otra base
// local (una recién creada) sin tocar .env.local.
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const hayBase = await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

// Cada prueba con el Claude falso cuenta contra el cupo diario (40) de su usuario,
// y la base local es compartida: tras varias corridas en el día el cupo se agotaba y
// las pruebas fallaban con 429 sin que nada estuviera roto. Se limpia el uso del día
// de los usuarios de prueba antes de empezar (solo en la base local).
if (hayBase) {
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  await db.connect();
  await db.query(`delete from asistente_uso where en >= current_date
    and usuario_id in (select id from auth.users where email in ('isaac@hegamex.com','importaciones@hegamex.com','direccion@hegamex.com','almacen@hegamex.com'))`);
  await db.end();
}

async function sesion(correo: string) {
  const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: correo, password: "hegamex-local" });
  if (error) throw error;
  return { db, token: data.session!.access_token };
}

/** Un Claude falso que contesta lo que le digas, en orden, y guarda lo que recibió. */
function claudeFalso(respuestas: Partial<Anthropic.Beta.BetaMessage>[]) {
  const recibido: Anthropic.Beta.MessageCreateParams[] = [];
  const falso = {
    beta: { messages: { stream: (p: Anthropic.Beta.MessageCreateParams) => {
      recibido.push(structuredClone(p));
      const r = { model: "claude-opus-5-5", usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 }, ...respuestas.shift() };
      const oyentes: ((t: string) => void)[] = [];
      return {
        on: (_e: "text", f: (t: string) => void) => { oyentes.push(f); },
        finalMessage: async () => {
          for (const b of r.content ?? []) if (b.type === "text") oyentes.forEach((f) => f(b.text));
          return r;
        },
      };
    } } },
  };
  return { falso: falso as unknown as Pick<Anthropic, "beta">, recibido };
}

async function leerEventos(r: Response): Promise<Evento[]> {
  const texto = await r.text();
  return texto.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
}

describe.skipIf(!hayBase)("asistente contra la base local", () => {
  let isaac: Awaited<ReturnType<typeof sesion>>;
  beforeAll(async () => { isaac = await sesion("isaac@hegamex.com"); });

  it("ejecuta la herramienta con la sesión del vendedor y le devuelve el resultado a Claude", async () => {
    const { falso, recibido } = claudeFalso([
      { stop_reason: "tool_use", content: [
        { type: "text", text: "Reviso a quién llamar.", citations: null },
        { type: "tool_use", id: "toolu_1", name: "oportunidades_de_venta", input: { limite: 3 } } as Anthropic.Beta.BetaToolUseBlock,
      ] as Anthropic.Beta.BetaContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: " Llama primero a quien tiene la cotización por vencer.", citations: null }] as Anthropic.Beta.BetaContentBlock[] },
    ]);
    const antes = (await isaac.db.from("asistente_uso").select("id", { count: "exact", head: true })).count ?? 0;
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${isaac.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "chat", mensajes: [{ rol: "usuario", texto: "¿A quién llamo hoy?" }], ruta: "/ventas/oportunidades" }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON, crearAnthropic: () => falso });

    const eventos = await leerEventos(r);
    expect(eventos.map((e) => e.tipo)).toEqual(["texto", "herramienta", "texto", "fin"]);
    // La segunda vuelta lleva la respuesta anterior intacta y el resultado de la herramienta.
    expect(recibido).toHaveLength(2);
    const ultima = recibido[1].messages.at(-1)!;
    const resultado = (ultima.content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(resultado.tool_use_id).toBe("toolu_1");
    expect(resultado.is_error).toBeFalsy();
    const filas = JSON.parse(resultado.content as string) as { vendedor: string | null }[];
    expect(filas.length).toBeGreaterThan(0);
    // Un vendedor solo ve sus clientes y los libres.
    expect(filas.every((f) => f.vendedor === null || f.vendedor.startsWith("Isaac"))).toBe(true);
    // Parámetros que Opus 5.5 exige: sin tool_choice forzado, herramientas estrictas, fallbacks.
    expect(recibido[0].tool_choice).toBeUndefined();
    expect(recibido[0].tools!.every((t) => (t as Anthropic.Beta.BetaTool).strict === true)).toBe(true);
    expect(recibido[0].fallbacks).toBe("default");
    const despues = (await isaac.db.from("asistente_uso").select("id", { count: "exact", head: true })).count ?? 0;
    expect(despues).toBe(antes + 1);
  });

  it("un error de herramienta regresa como is_error, no tumba la conversación", async () => {
    const { falso, recibido } = claudeFalso([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "consultar",
        input: { tabla: "proveedores", columnas: ["datos_bancarios"], filtros: [], ordenar_por: "", descendente: false, limite: 5, solo_contar: false } }] as Anthropic.Beta.BetaContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "No tengo ese dato.", citations: null }] as Anthropic.Beta.BetaContentBlock[] },
    ]);
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${isaac.token}` },
      body: JSON.stringify({ modo: "chat", mensajes: [{ rol: "usuario", texto: "Dame la cuenta del proveedor" }] }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON, crearAnthropic: () => falso });
    await leerEventos(r);
    const res = (recibido[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(res.is_error).toBe(true);
    expect(res.content).toMatch(/no permitidas/);
  });

  it("almacén no lee el libro de ventas aunque Claude lo pida", async () => {
    const alm = await sesion("almacen@hegamex.com");
    const r = await ejecutarHerramienta(alm.db, "consultar", {
      tabla: "historial_ventas_hoja", columnas: [], filtros: [], ordenar_por: "", descendente: false, limite: 50, solo_contar: true });
    expect(JSON.parse(r).filas).toBe(0);
  });

  it("sin llave, el resumen sale de los hallazgos de la base y lo dice", async () => {
    const dir = await sesion("direccion@hegamex.com");
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${dir.token}` },
      body: JSON.stringify({ modo: "resumen", area: "direccion", forzar: true }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON });
    const j = await r.json();
    expect(j.simulado).toBe(true);
    expect(j.puntos.length).toBeGreaterThan(0);
  });

  it("la semana sin llave son los números de la base, con los permisos de quien pregunta", async () => {
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${isaac.token}` }, body: JSON.stringify({ modo: "semana", forzar: true }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON });
    const j = await r.json();
    expect(j.simulado).toBe(true);
    expect(j.numeros.ventas.alcance).toBe("tuyas");
    expect(j.numeros.cobranza).toBeUndefined();
    expect(j.titular).toMatch(/ventas/i);
  });

  it("la semana con Claude se narra una vez y se guarda para toda la semana", async () => {
    const dir = await sesion("direccion@hegamex.com");
    const narrada = { titular: "Semana de prueba", resumen: "Texto de prueba.", puntos: [] };
    const { falso, recibido } = claudeFalso([{ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(narrada), citations: null }] }]);
    const pedir = (cuerpo: object, crear: () => Pick<Anthropic, "beta">) => atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${dir.token}` }, body: JSON.stringify(cuerpo),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON, crearAnthropic: crear });
    try {
      const j = await (await pedir({ modo: "semana", forzar: true }, () => falso)).json();
      expect(j.titular).toBe("Semana de prueba");
      expect(j.numeros.ventas.alcance).toBe("empresa");
      // Claude recibe los números de la base, no los inventa.
      expect(JSON.stringify(recibido[0].messages)).toContain("pasada_desde");
      // La segunda vez no se llama a Claude: si lo hiciera, este falso no tiene respuesta.
      const otra = await (await pedir({ modo: "semana" }, () => claudeFalso([]).falso)).json();
      expect(otra.guardado).toBe(true);
      expect(otra.titular).toBe("Semana de prueba");
    } finally {
      // La base es compartida: que la narración falsa no se quede como la semana de dirección.
      const { default: pg } = await import("pg");
      const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
      await db.connect();
      await db.query("delete from asistente_resumenes where area = 'semana' and usuario_id = (select id from auth.users where email = 'direccion@hegamex.com')");
      await db.end();
    }
  });

  it("el mapa de ventas: dirección pregunta por Jalisco por nombre; un vendedor no tiene análisis", async () => {
    const dir = await sesion("direccion@hegamex.com");
    const r = JSON.parse(await ejecutarHerramienta(dir.db, "ventas_por_region", { desde: "2025-01-01", hasta: "2025-12-31", estado: "jalisco" }));
    expect(JSON.stringify(r)).toContain("Zapopan");
    await expect(ejecutarHerramienta(isaac.db, "ventas_por_region", { desde: "2025-01-01", hasta: "2025-12-31", estado: "" }))
      .rejects.toThrow();
  });

  it("la TV del taller no usa el asistente", async () => {
    const tv = await sesion("tv@hegamex.com");
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${tv.token}` }, body: JSON.stringify({ modo: "chat", mensajes: [] }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON });
    expect(r.status).toBe(403);
  });
});

describe.skipIf(!hayBase)("leer documentos de importación", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF").toString("base64");
  const pedir = (token: string, cuerpo: Record<string, unknown>, falso?: Pick<Anthropic, "beta">) =>
    atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "leer_documento", ...cuerpo }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON, ...(falso ? { crearAnthropic: () => falso } : {}) });
  const respuesta = (campos: unknown, stop_reason: Anthropic.Beta.BetaMessage["stop_reason"] = "end_turn") =>
    ({ stop_reason, content: [{ type: "text", text: JSON.stringify(campos), citations: null }] as Anthropic.Beta.BetaContentBlock[] });

  it("el PDF viaja como bloque document, con el esquema estricto del tipo, y lo devuelto se valida", async () => {
    const alondra = await sesion("importaciones@hegamex.com");
    const campos = { ...ejemploDocumento("bl"), advertencias: [] };
    const { falso, recibido } = claudeFalso([respuesta(campos)]);
    const antes = (await alondra.db.from("asistente_uso").select("id", { count: "exact", head: true }).eq("modo", "leer_documento")).count ?? 0;
    const r = await pedir(alondra.token, { tipo: "bl", media_type: "application/pdf", datos: pdf }, falso);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.campos.numero_bl).toBe("800610246498");
    expect(j.simulado).toBeUndefined();
    const contenido = recibido[0].messages[0].content as Anthropic.Beta.BetaContentBlockParam[];
    expect(contenido[0]).toEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
    expect(contenido[1].type).toBe("text");
    expect(recibido[0].output_config?.format).toEqual({ type: "json_schema", schema: DOCUMENTOS.bl.esquema });
    expect(recibido[0].betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(recibido[0].fallbacks).toBe("default");
    const despues = (await alondra.db.from("asistente_uso").select("id", { count: "exact", head: true }).eq("modo", "leer_documento")).count ?? 0;
    expect(despues).toBe(antes + 1);
  });

  it("una foto viaja como bloque image", async () => {
    const alondra = await sesion("importaciones@hegamex.com");
    const { falso, recibido } = claudeFalso([respuesta({ ...ejemploDocumento("lista_empaque"), advertencias: [] })]);
    const r = await pedir(alondra.token, { tipo: "lista_empaque", media_type: "image/png", datos: pdf }, falso);
    expect(r.status).toBe(200);
    const contenido = recibido[0].messages[0].content as Anthropic.Beta.BetaContentBlockParam[];
    expect(contenido[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: pdf } });
  });

  it("si lo devuelto no cumple el esquema o se cortó, no se entrega nada", async () => {
    const alondra = await sesion("importaciones@hegamex.com");
    const { eta: _sinEta, ...incompleto } = ejemploDocumento("bl") as Record<string, unknown>;
    void _sinEta;
    let falso = claudeFalso([respuesta(incompleto)]).falso;
    let r = await pedir(alondra.token, { tipo: "bl", media_type: "application/pdf", datos: pdf }, falso);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/no cumplen el formato.*falta \$\.eta/);
    falso = claudeFalso([respuesta({ ...ejemploDocumento("pedimento"), igi: "6,370" })]).falso;
    r = await pedir(alondra.token, { tipo: "pedimento", media_type: "application/pdf", datos: pdf }, falso);
    expect((await r.json()).error).toMatch(/\$\.igi debe ser número/);
    falso = claudeFalso([respuesta({ numero: "26 16" }, "max_tokens")]).falso;
    r = await pedir(alondra.token, { tipo: "pedimento", media_type: "application/pdf", datos: pdf }, falso);
    expect((await r.json()).error).toMatch(/demasiado largo/);
  });

  it("sin llave es un ejemplo que lo dice; almacén y ventas no leen documentos", async () => {
    const alondra = await sesion("importaciones@hegamex.com");
    const r = await pedir(alondra.token, { tipo: "cuenta_gastos", media_type: "application/pdf", datos: pdf });
    const j = await r.json();
    expect(j.simulado).toBe(true);
    expect(j.campos.advertencias[0]).toMatch(/MODO DEMOSTRACIÓN/);
    for (const correo of ["almacen@hegamex.com", "isaac@hegamex.com"]) {
      const s = await sesion(correo);
      expect((await pedir(s.token, { tipo: "bl", media_type: "application/pdf", datos: pdf })).status).toBe(403);
    }
  });
});

describe("documentos de importación sin base", () => {
  it("cada ejemplo cumple su esquema y el validador atrapa lo que sobra o falta", () => {
    for (const t of Object.keys(DOCUMENTOS) as TipoDocumento[]) expect(validarEsquema(ejemploDocumento(t), DOCUMENTOS[t].esquema)).toEqual([]);
    expect(validarEsquema({ ...ejemploDocumento("bl"), extra: 1 }, DOCUMENTOS.bl.esquema)).toContain("sobra $.extra");
    expect(validarEsquema({ ...ejemploDocumento("bl"), fecha_embarque: "16/09/2026" }, DOCUMENTOS.bl.esquema)[0]).toMatch(/fecha_embarque/);
  });
});

describe("errores de la API en español", () => {
  it("el tope de gasto se distingue de un error cualquiera", () => {
    const tope = new Anthropic.BadRequestError(400, { type: "error" }, "usage limits", new Headers({ "x-should-retry": "false" }));
    expect(explicarError(tope).codigo).toBe("cuenta");
    expect(explicarError(tope).mensaje).toMatch(/console\.anthropic\.com/);
    expect(explicarError(new Anthropic.RateLimitError(429, {}, "x", new Headers())).codigo).toBe("saturado");
    expect(explicarError(new Anthropic.AuthenticationError(401, {}, "x", new Headers())).codigo).toBe("llave");
    expect(explicarError(new Anthropic.BadRequestError(400, {}, "x", new Headers())).codigo).toBe("api");
  });
});
