// Pruebas del asistente contra la base local de verdad (con la RLS de verdad) y un
// Claude falso: lo que se prueba es lo nuestro —que las herramientas lean con la
// sesión de quien pregunta, que el ciclo devuelva cada resultado, que el uso se
// registre y que los errores de la API se expliquen— sin gastar créditos.
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { atender, ejecutarHerramienta, explicarError, type Evento } from "./nucleo.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../../../.env.local", import.meta.url), "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
);
const URL_SB = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY;
const hayBase = await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);

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

  it("la TV del taller no usa el asistente", async () => {
    const tv = await sesion("tv@hegamex.com");
    const r = await atender(new Request("http://x/", {
      method: "POST", headers: { Authorization: `Bearer ${tv.token}` }, body: JSON.stringify({ modo: "chat", mensajes: [] }),
    }), { supabaseUrl: URL_SB, supabaseAnonKey: ANON });
    expect(r.status).toBe(403);
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
