// La revisión nocturna, del lado de Claude. La base ya corrió sus reglas (revision_noche); aquí
// se arma un lote con lo de ayer por módulo (y, el día de consejos, una petición por persona),
// se manda a la API de lotes de Anthropic y, en la mañana, se recoge lo que Claude contestó.
//
// Por qué lotes y no una llamada normal: a las 2 de la mañana nadie espera la respuesta, el lote
// cuesta la mitad y la función no se queda prendida esperando (manda y se apaga; recoger es otra
// vuelta de pg_cron). Lo que Claude regresa no se escribe en la base desde aquí: se le pasa a
// revision_guardar_claude / revision_guardar_consejos, que ligan cada cosa al registro y a su
// responsable con lo que sabe la base (no con un nombre que Claude escribió).
//
// Rutas:
//   POST enviar    pg_cron (con la llave de revision_cuenta, sin sesión), después de las reglas
//   POST recoger   pg_cron en la mañana: si el lote ya terminó, guarda y avisa
//   POST estado    dirección, desde la pantalla: anota la dirección de esta función y dice si hay llave
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Lo único del SDK que se usa: así las pruebas pasan un cliente falso. */
export interface ClienteLotes {
  messages: { batches: Pick<Anthropic["messages"]["batches"], "create" | "retrieve" | "results"> };
}

export interface Entorno {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceKey: string;
  anthropicKey?: string;
  crearAnthropic?: () => ClienteLotes;
  enSegundoPlano?: (p: Promise<unknown>) => void;
  /** Para las pruebas: qué día es (el de consejos depende de eso). */
  hoy?: () => Date;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

export const MODULOS = ["inventario", "compras", "ventas", "produccion", "finanzas"] as const;
export type Modulo = (typeof MODULOS)[number];
const TABLAS = ["ordenes_compra", "articulos", "cotizaciones", "pedidos", "clientes", "leads", "movimientos_inventario",
  "ajustes_inventario", "ordenes_produccion", "caja_chica", "movimientos_proveedor"] as const;
const MAX_HALLAZGOS = 8;
const MAX_CONSEJOS = 3;

// -----------------------------------------------------------------------------
// Lo que se le pide a Claude
// -----------------------------------------------------------------------------
export const ESQUEMA_MODULO = {
  type: "object",
  additionalProperties: false,
  required: ["lectura", "hallazgos"],
  properties: {
    lectura: { type: "string", description: "Dos o tres frases: cómo se vio el día en este módulo." },
    hallazgos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "detalle", "para", "tabla", "ref", "gravedad"],
        properties: {
          titulo: { type: "string" },
          detalle: { type: "string" },
          para: { type: "string", enum: ["responsable", "direccion"] },
          tabla: { type: "string", enum: [...TABLAS] },
          ref: { type: "string", description: "El «ref» exacto del registro en los datos." },
          gravedad: { type: "string", enum: ["baja", "media", "alta"] },
        },
      },
    },
  },
} as const;

export const ESQUEMA_CONSEJOS = {
  type: "object",
  additionalProperties: false,
  required: ["consejos"],
  properties: {
    consejos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tema", "titulo", "texto", "por_que", "experimento"],
        properties: {
          tema: { type: "string", enum: ["ventas", "uso_erp", "habito", "experimento", "equipo"] },
          titulo: { type: "string" },
          texto: { type: "string" },
          por_que: { type: "string", description: "El número de sus datos que motiva el consejo." },
          experimento: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
  },
} as const;

const QUE_MIRAR: Record<Modulo, string> = {
  inventario: "salidas, entradas, traspasos y ajustes de inventario: cantidades que no cuadran con la unidad (metros contra piezas), salidas sin orden ni motivo, la misma salida capturada dos veces, un ajuste que contradice otro, quien recibe que no corresponde.",
  compras: "órdenes de compra y artículos dados de alta: un artículo nuevo que ya existía con otro nombre (compáralo con sus «parecidos»), partidas con cantidades raras, fechas de entrega imposibles, notas que contradicen la orden, la misma compra hecha dos veces.",
  ventas: "cotizaciones, seguimientos, clientes y leads nuevos: un cliente dado de alta dos veces escrito distinto, una cotización con tiempo de entrega o condiciones que no cuadran, un seguimiento cerrado con un «qué pasó» que no dice nada o contradice el resultado, leads repetidos.",
  produccion: "problemas reportados, notas, cambios de material, etapas reabiertas y órdenes en espera: un motivo de espera que ya no aplica, el mismo problema reportado varias veces sin seguimiento, notas que señalan un error de captura.",
  finanzas: "caja chica y pagos a proveedores: el mismo gasto o pago capturado dos veces, un concepto que no dice qué se compró, importes con un cero de más o de menos, un pago sin factura que debería tenerla.",
};

function sistemaModulo(modulo: Modulo): string {
  return `Eres el revisor nocturno del ERP de Hegamex, una fábrica mexicana de maquinaria (bandas transportadoras, dosificadoras, cribadoras, tolvas, silos, elevadores) que también vende refacciones. Cada noche lees lo que se capturó ayer en un módulo y señalas lo que parece un ERROR DE CAPTURA o una inconsistencia que una persona debería revisar.

Hoy revisas: ${modulo}. Fíjate sobre todo en ${QUE_MIRAR[modulo]}

Reglas:
- Solo cosas concretas que se puedan revisar en un registro. Nada de opiniones de negocio ni de «podría mejorar».
- Cada hallazgo cita el «ref» EXACTO de un registro de los datos y su tabla. Si no tienes un ref, no lo digas.
- Precisión antes que cantidad: cero hallazgos está muy bien si el día se ve limpio. Máximo ${MAX_HALLAZGOS}.
- «para»: "responsable" si es un error que quien lo capturó puede corregir; "direccion" si es un patrón que podría señalar un mal uso (faltantes que se repiten, gastos raros, salidas que no se parecen a las demás). En ese caso describe el patrón con hechos y NUNCA acuses a nadie ni supongas intención.
- No repitas nada de «ya_dicho». Si alguien contestó que algo está bien así, eso es normal en esta empresa: no lo vuelvas a señalar ni algo igual.
- Las reglas automáticas ya revisan artículos y clientes repetidos por nombre, pagos repetidos, costos de compra fuera de lo normal y compras atrasadas; busca lo que una regla no ve.
- No te nombres ni nombres al modelo o a su proveedor: para la gente esto es «la revisión» o «la IA».
- Escribe en español de México, de tú, claro y corto: el título en una línea (qué y en qué registro), el detalle en dos o tres frases (qué viste, por qué parece error, qué revisar). Sin jerga técnica.
- «lectura»: dos o tres frases de cómo se vio el día en este módulo, para dirección.`;
}

const VICIOS_HOJA = `Hegamex trabajó años con hojas de Google Sheets y apenas se pasó a este ERP. Hábitos que vienen de la hoja y lo que conviene en el ERP:
- Anotar en papel o de memoria y pasarlo todo de golpe al final del día («rachas» de 20 capturas o más en 15 minutos) → capturar al momento: las existencias, el avance del taller y los avisos les llegan a los demás a tiempo.
- Capturar en la noche o el fin de semana para «ponerse al día» → mismo problema, y el día siguiente arranca con datos viejos.
- Dar de alta un artículo o cliente nuevo sin buscar primero → buscarlo antes; si ya existe con otro nombre, usar ese.
- Llevar los pendientes en WhatsApp o en una libreta → pedirlos en «Pendientes» del ERP, con fecha: le llega aviso a la otra persona.
- Bajar todo a Excel para filtrar → las tablas del ERP buscan sin acentos, ordenan y exportan.
- Marcar el trabajo del taller como terminado sin pasar por la terminal → iniciar y terminar en la terminal: así salen las horas hombre solas.
- Corregir un error borrando y capturando de nuevo → en inventario se corrige con un ajuste que autoriza otra persona.`;

const SISTEMA_CONSEJOS = `Eres el coach del ERP de Hegamex, una fábrica mexicana de maquinaria. Cada lunes le escribes a una persona hasta ${MAX_CONSEJOS} consejos cortos con SUS PROPIOS números de las últimas semanas, para que trabaje mejor con el ERP y, si vende, para que venda más.

${VICIOS_HOJA}

Para vendedores, lo que más mueve la aguja:
- Llamar contra solo mandar WhatsApp: compara sus cotizaciones con llamada y sin llamada. Si tiene muy pocas con llamada para concluir, NO concluyas: propón un experimento (por ejemplo, dos semanas llamando el primer día a la mitad de sus cotizaciones nuevas y comparar cuántas cierran de cada mitad en «Cotizaciones»).
- Velocidad: horas al primer contacto de sus leads. Seguimientos a tiempo.
- Que sea su experimento: qué hacer, durante cuánto, y dónde en el ERP ver si funcionó.

Reglas:
- Cada consejo sale de un número de sus datos y lo dice en «por_que» («Solo 2 de tus 52 cotizaciones tuvieron llamada»). Nada genérico.
- Si sus datos no alcanzan para decir algo útil, da menos consejos o ninguno.
- No repitas un consejo que marcó «no_util». Si en semanas anteriores se le propuso un experimento, comenta cómo va con sus números de ahora.
- No te nombres ni nombres al modelo o a su proveedor: para la persona esto es «el ERP» o «la IA».
- Nunca menciones costos, márgenes, utilidad ni sueldos. Nunca nombres ni compares con compañeros. Nada de regaños: de tú, con respeto, como un buen jefe que conoce el sistema.
- Español de México llano, sin jerga técnica. Título en una línea; texto de dos a cuatro frases; «experimento» solo si propones uno (si no, null).`;

// -----------------------------------------------------------------------------
// Armar el lote
// -----------------------------------------------------------------------------
type Dict = Record<string, unknown>;
const o = (v: unknown): Dict => (v && typeof v === "object" && !Array.isArray(v) ? (v as Dict) : {});

/** Un módulo sin nada capturado ayer no gasta una petición. */
export function tieneDatos(bloque: unknown): boolean {
  return Object.values(o(bloque)).some((v) => Array.isArray(v) && v.length > 0);
}

/** Lunes = 1 … domingo = 7, en la hora de la planta. */
export function diaPlanta(d: Date): number {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", weekday: "short" }).format(d);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(dia) + 1;
}

export interface Peticion { custom_id: string; params: Anthropic.MessageCreateParamsNonStreaming }

export function armarPeticiones(datos: Dict, consejos: Dict[] | null, modelo: string): Peticion[] {
  const base = { model: modelo, max_tokens: 16000, thinking: { type: "adaptive" as const } };
  const peticiones: Peticion[] = [];
  for (const m of MODULOS) {
    if (!tieneDatos(datos[m])) continue;
    peticiones.push({
      custom_id: `m-${m}`,
      params: {
        ...base,
        system: sistemaModulo(m),
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_MODULO } },
        messages: [{ role: "user", content: JSON.stringify({ hoy: datos.hoy, [m]: datos[m], ya_dicho: o(datos).ya_dicho ?? [] }) }],
      } as Anthropic.MessageCreateParamsNonStreaming,
    });
  }
  for (const p of consejos ?? []) {
    const id = String(p.usuario ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) continue;
    peticiones.push({
      custom_id: `c-${id}`,
      params: {
        ...base,
        system: SISTEMA_CONSEJOS,
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_CONSEJOS } },
        messages: [{ role: "user", content: JSON.stringify(p) }],
      } as Anthropic.MessageCreateParamsNonStreaming,
    });
  }
  return peticiones;
}

// -----------------------------------------------------------------------------
// Leer lo que regresó
// -----------------------------------------------------------------------------
export interface HallazgoClaude { titulo: string; detalle: string; para: "responsable" | "direccion"; tabla: string; ref: string; gravedad: string }
export interface ConsejoClaude { tema: string; titulo: string; texto: string; por_que: string; experimento: string | null }

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Lo que no cumple la forma se descarta entero (no se guarda medio hallazgo). */
export function leerModulo(valor: unknown): { lectura: string; hallazgos: HallazgoClaude[] } | null {
  const v = o(valor);
  if (typeof v.lectura !== "string" || !Array.isArray(v.hallazgos)) return null;
  const hallazgos = v.hallazgos.map(o).filter((h) =>
    texto(h.titulo) && texto(h.detalle) && texto(h.ref) && (h.para === "responsable" || h.para === "direccion")
    && (TABLAS as readonly string[]).includes(String(h.tabla)) && ["baja", "media", "alta"].includes(String(h.gravedad)),
  ).slice(0, MAX_HALLAZGOS).map((h) => ({
    titulo: texto(h.titulo), detalle: texto(h.detalle), para: h.para as HallazgoClaude["para"], tabla: String(h.tabla), ref: texto(h.ref), gravedad: String(h.gravedad),
  }));
  return { lectura: v.lectura.trim(), hallazgos };
}

export function leerConsejos(valor: unknown): ConsejoClaude[] | null {
  const v = o(valor);
  if (!Array.isArray(v.consejos)) return null;
  return v.consejos.map(o).filter((c) => texto(c.titulo) && texto(c.texto)).slice(0, MAX_CONSEJOS).map((c) => ({
    tema: String(c.tema ?? "uso_erp"), titulo: texto(c.titulo), texto: texto(c.texto), por_que: texto(c.por_que),
    experimento: texto(c.experimento) || null,
  }));
}

/** El JSON va en el último bloque de texto (antes pueden venir bloques de razonamiento). */
export function jsonDeMensaje(m: { content: { type: string; text?: string }[]; stop_reason?: string | null }): unknown {
  if (m.stop_reason === "refusal" || m.stop_reason === "max_tokens") return null;
  const t = [...m.content].reverse().find((b) => b.type === "text")?.text;
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

// -----------------------------------------------------------------------------
// Las dos vueltas
// -----------------------------------------------------------------------------
function anthropic(e: Entorno): ClienteLotes | null {
  if (e.crearAnthropic) return e.crearAnthropic();
  if (!e.anthropicKey) return null;
  return new Anthropic({ apiKey: e.anthropicKey }) as unknown as ClienteLotes;
}

async function rpc<T>(db: SupabaseClient, nombre: string, args?: Dict): Promise<T> {
  const { data, error } = await db.rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data as T;
}

export async function enviar(e: Entorno, admin: SupabaseClient): Promise<Dict> {
  const corrida = await rpc<number | null>(admin, "revision_ultima_sin_lote");
  if (!corrida) return { ok: false, motivo: "No hay corrida esperando lote" };
  const anotarError = (nota: string) => rpc(admin, "revision_anotar_error", { p_corrida: corrida, p_nota: nota.slice(0, 300) });
  try {
    const estado = await rpc<string>(admin, "revision_estado_claude");
    if (estado !== "si") { await anotarError(`IA: ${estado}`); return { ok: false, motivo: estado }; }
    const cliente = anthropic(e);
    if (!cliente) { await anotarError("Falta la llave de la IA en los secretos de la función"); return { ok: false, motivo: "sin llave" }; }

    const { data: cfg } = await admin.from("configuracion").select("valor").eq("clave", "revision_nocturna").maybeSingle();
    const c = o((cfg as { valor?: unknown } | null)?.valor);
    const modelo = typeof c.modelo === "string" && c.modelo ? c.modelo : "claude-opus-5-5";
    const tocaConsejos = c.consejos === true && diaPlanta(e.hoy?.() ?? new Date()) === Number(c.dia_consejos ?? 1);

    const datos = await rpc<Dict>(admin, "revision_datos_noche");
    const gente = tocaConsejos ? await rpc<Dict[]>(admin, "revision_datos_consejos") : null;
    const peticiones = armarPeticiones(datos, gente, modelo);
    if (!peticiones.length) { await anotarError("Nada que leer: ayer no se capturó nada"); return { ok: true, peticiones: 0 }; }

    const lote = await cliente.messages.batches.create({ requests: peticiones });
    await rpc(admin, "revision_anotar_lote", { p_corrida: corrida, p_lote: lote.id, p_peticiones: peticiones.length });
    return { ok: true, lote: lote.id, peticiones: peticiones.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await anotarError(msg).catch(() => undefined);
    throw err;
  }
}

export async function recoger(e: Entorno, admin: SupabaseClient): Promise<Dict> {
  const filas = await rpc<{ id: number; lote_id: string }[]>(admin, "revision_por_recoger");
  const corrida = filas?.[0];
  if (!corrida) return { ok: false, motivo: "Nada por recoger" };
  const cliente = anthropic(e);
  if (!cliente) return { ok: false, motivo: "sin llave" };
  const lote = await cliente.messages.batches.retrieve(corrida.lote_id);
  if (lote.processing_status !== "ended") return { ok: true, esperando: true };

  let entrada = 0, salida = 0, hallazgos = 0, consejos = 0;
  const errores: string[] = [];
  for await (const r of await cliente.messages.batches.results(corrida.lote_id)) {
    if (r.result.type !== "succeeded") { errores.push(`${r.custom_id}: ${r.result.type}`); continue; }
    const m = r.result.message;
    const u = m.usage as unknown as Record<string, number | null | undefined>;
    entrada += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    salida += u.output_tokens ?? 0;
    const valor = jsonDeMensaje(m as unknown as Parameters<typeof jsonDeMensaje>[0]);
    if (r.custom_id.startsWith("m-")) {
      const leido = leerModulo(valor);
      if (!leido) { errores.push(`${r.custom_id}: respuesta sin la forma esperada`); continue; }
      hallazgos += await rpc<number>(admin, "revision_guardar_claude", {
        p_corrida: corrida.id, p_modulo: r.custom_id.slice(2), p_lectura: leido.lectura, p_hallazgos: leido.hallazgos });
    } else if (r.custom_id.startsWith("c-")) {
      const leido = leerConsejos(valor);
      if (!leido) { errores.push(`${r.custom_id}: respuesta sin la forma esperada`); continue; }
      consejos += await rpc<number>(admin, "revision_guardar_consejos", { p_corrida: corrida.id, p_usuario: r.custom_id.slice(2), p_consejos: leido });
    }
  }
  if (errores.length) await rpc(admin, "revision_anotar_error", { p_corrida: corrida.id, p_nota: errores.join("; ").slice(0, 300), p_sigue: true });
  await rpc(admin, "revision_terminar", { p_corrida: corrida.id, p_entrada: entrada, p_salida: salida });
  return { ok: true, hallazgos, consejos, entrada, salida, errores: errores.length };
}

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------
export async function atender(req: Request, e: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Ruta no válida" }, 404);
  const accion = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  const admin = createClient(e.supabaseUrl, e.serviceKey, sinSesion);

  if (accion === "enviar" || accion === "recoger") {
    const { data: ok } = await admin.rpc("revision_llave_valida", { p: req.headers.get("x-llave") ?? "" });
    if (ok !== true) return json({ error: "Llave no válida" }, 401);
    const trabajo = (accion === "enviar" ? enviar(e, admin) : recoger(e, admin)).catch((err) => ({ ok: false, error: String(err) }));
    if (e.enSegundoPlano) { e.enSegundoPlano(trabajo); return json({ ok: true }); }
    return json(await trabajo);
  }

  if (accion === "estado") {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesión" }, 401);
    const yo = createClient(e.supabaseUrl, e.supabaseAnonKey, { ...sinSesion, global: { headers: { Authorization: auth } } });
    const { data: dir } = await yo.rpc("tiene_rol", { r: "direccion" });
    if (dir !== true) return json({ error: "Es de dirección" }, 403);
    // Así pg_cron sabe a dónde llamar aunque Mercado Libre no esté conectado.
    await rpc(admin, "revision_fijar_url", { p: e.supabaseUrl });
    return json({ ok: true, claude: !!(e.anthropicKey || e.crearAnthropic) });
  }

  return json({ error: "Ruta no válida" }, 404);
}
