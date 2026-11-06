// Gmail con un Google falso: que el correo salga bien armado (acentos, adjunto) y, contra la base
// local, que conectar guarde la cuenta, que mandar revise antes las reglas del documento, que
// salga de la cuenta de quien lo manda y quede anotado. Necesita la llave de servicio de la
// base local (SUPABASE_SERVICE_ROLE_KEY) y DATABASE_URL; sin ellas se brinca esa parte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { ENVIAR, GMAIL_ENVIAR, GMAIL_HILOS, GOOGLE_AUTH, GOOGLE_REVOKE, GOOGLE_TOKEN, LEER, armarCorreo, atender, correoDelToken, correoValido, leerMensaje, limpiarCitado, rutaSegura } from "./nucleo.ts";

const deB64 = (s: string) => Buffer.from(s.replace(/\r\n/g, ""), "base64").toString("utf8");
const idToken = (datos: object) => `x.${Buffer.from(JSON.stringify(datos)).toString("base64url")}.y`;

describe("armar el correo", () => {
  it("encabezados con acentos, cuerpo y PDF adjunto", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4 prueba");
    const m = armarCorreo({ de: "isaac@hegamex.com", nombre: "Isaac Peña", para: ["a@x.mx", "b@x.mx"], cc: ["c@x.mx"],
      asunto: "Cotización COT-26-001", cuerpo: "Buen día,\nle mando la cotización.", adjunto: { nombre: "Cotización COT-26-001.pdf", bytes: pdf }, frontera: "F" });
    expect(m).toMatch(/^From: =\?UTF-8\?B\?.+\?= <isaac@hegamex\.com>\r\n/);
    expect(m).toContain("To: a@x.mx, b@x.mx\r\nCc: c@x.mx\r\n");
    const asunto = m.match(/Subject: =\?UTF-8\?B\?(.+)\?=/)![1];
    expect(deB64(asunto)).toBe("Cotización COT-26-001");
    const [, texto, adjunto] = m.split("--F");
    expect(deB64(texto.split("\r\n\r\n")[1])).toBe("Buen día,\nle mando la cotización.");
    expect(adjunto).toContain("Content-Type: application/pdf");
    expect(adjunto).toContain("filename*=UTF-8''Cotizaci%C3%B3n%20COT-26-001.pdf");
    expect(deB64(adjunto.split("\r\n\r\n")[1])).toBe("%PDF-1.4 prueba");
    expect(m.trimEnd().endsWith("--F--")).toBe(true);
  });

  it("un asunto no puede meter encabezados", () => {
    const m = armarCorreo({ de: "a@hegamex.com", para: ["b@x.mx"], asunto: "Hola\r\nBcc: espia@x.mx", cuerpo: "" });
    expect(m).not.toMatch(/^Bcc:/m);
  });

  it("correos, rutas de regreso y el id_token", () => {
    expect(correoValido("compras@aceros.com.mx")).toBe(true);
    expect(correoValido("sin arroba")).toBe(false);
    expect(correoValido("a@b")).toBe(false);
    expect(rutaSegura("/ventas/cotizaciones/1")).toBe("/ventas/cotizaciones/1");
    expect(rutaSegura("//malo.com/x")).toBe("/");
    expect(rutaSegura("https://malo.com")).toBe("/");
    expect(correoDelToken(idToken({ email: "isaac@hegamex.com", email_verified: true }))).toBe("isaac@hegamex.com");
    expect(correoDelToken(idToken({ email: "x@y.com", email_verified: false }))).toBeNull();
    expect(correoDelToken("basura")).toBeNull();
  });
});

describe("leer un correo", () => {
  it("se queda solo con lo nuevo: corta la cita de Gmail, Outlook, español y chino, y los renglones con >", () => {
    expect(limpiarCitado("Ya zarpó el 20.\n\nOn Mon, Oct 20, 2026 at 9:00 AM Lily <lily@x.cn> wrote:\n> Is it ready?")).toBe("Ya zarpó el 20.");
    expect(limpiarCitado("Recibimos BL.\nEl lun, 20 oct 2026 a las 9:00, Alondra\n<alondra@hegamex.com> escribió:\n> ¿Y el BL?")).toBe("Recibimos BL.");
    expect(limpiarCitado("Adjunto CI.\n\nDe: Alondra <a@hegamex.com>\nEnviado: lunes\nPara: Lily\nAsunto: PI")).toBe("Adjunto CI.");
    expect(limpiarCitado("OK\n在 2026年10月20日 写道：\n旧的")).toBe("OK");
    expect(limpiarCitado("Hola\n> citado\nAdiós")).toBe("Hola\nAdiós");
    expect(limpiarCitado("x".repeat(20_000)).length).toBe(12_000);
  });

  it("texto plano antes que HTML, y los adjuntos por nombre", () => {
    const b64 = (t: string) => Buffer.from(t, "utf8").toString("base64url");
    const r = leerMensaje({ mimeType: "multipart/mixed", parts: [
      { mimeType: "multipart/alternative", parts: [
        { mimeType: "text/plain", body: { data: b64("Buque: COSCO ÁFRICA\nETA 27-oct") } },
        { mimeType: "text/html", body: { data: b64("<p>no se usa</p>") } }] },
      { mimeType: "application/pdf", filename: "BL MEHE225.pdf", body: {} }] });
    expect(r).toEqual({ texto: "Buque: COSCO ÁFRICA\nETA 27-oct", adjuntos: ["BL MEHE225.pdf"] });
    const h = leerMensaje({ mimeType: "text/html", body: { data: b64("<div>Recibimos <b>BL</b>&nbsp;y CI<br>Saludos</div><style>x{}</style>") } });
    expect(h.texto).toBe("Recibimos BL y CI\nSaludos");
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

// Un hilo de embarque en Gmail: el forwarder avisa el zarpe (citando lo anterior) y el agente
// contesta solo en HTML. El tercero llega después (actualizar).
const correoFalso = (id: string, ms: number, de: string, asunto: string, texto: string, html = false, adjunto?: string) => ({
  id, internalDate: String(ms), labelIds: ["INBOX"],
  payload: { mimeType: "multipart/mixed", headers: [{ name: "From", value: de }, { name: "To", value: "Alondra <alondra@hegamex.com>" }, { name: "Subject", value: asunto }],
    parts: [{ mimeType: html ? "text/html" : "text/plain", body: { data: Buffer.from(texto, "utf8").toString("base64url") } },
      ...(adjunto ? [{ mimeType: "application/pdf", filename: adjunto, body: {} }] : [])] },
});
const hiloFalso: unknown[] = [
  correoFalso("m1", Date.parse("2026-10-20T15:00:00Z"), "Lily <lily@forwarder.cn>", "Booking MEHE 225",
    "The vessel COSCO AFRICA sailed on Oct 20. Freight USD 1,850.\n\nOn Fri, Oct 17, 2026 at 9:00 AM Alondra <alondra@hegamex.com> wrote:\n> When does it sail?", false, "BL MEHE225.pdf"),
  correoFalso("m2", Date.parse("2026-10-22T16:00:00Z"), "Agencia <agente@aduana.mx>", "RE: Booking MEHE 225", "<p>Recibimos el BL. Favor de mandar la <b>carta 3.1.8</b>.</p>", true),
];

// Google falso: anota lo que se le pidió.
const llamadas: { url: string; cuerpo: string; auth: string | null }[] = [];
let tokenVence = 3600;
const falsa: typeof fetch = async (entrada, init) => {
  const url = String(entrada), cuerpo = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : "";
  llamadas.push({ url, cuerpo, auth: new Headers(init?.headers).get("Authorization") });
  const r = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  if (url === GOOGLE_TOKEN) {
    const p = new URLSearchParams(cuerpo);
    if (p.get("grant_type") === "authorization_code") {
      return r({ access_token: "acceso-1", refresh_token: "refresco-1", expires_in: tokenVence, scope: `openid email ${ENVIAR} ${LEER}`,
        id_token: idToken({ email: "isaac.gmail@hegamex.com", email_verified: true }) });
    }
    if (p.get("refresh_token") === "revocado") return r({ error: "invalid_grant" }, 400);
    return r({ access_token: "acceso-2", expires_in: 3600 });
  }
  if (url === GMAIL_ENVIAR) return r({ id: "msg-217", threadId: "hilo-217" });
  if (url.startsWith(GOOGLE_REVOKE)) return r({});
  if (url.startsWith(GMAIL_HILOS)) {
    const u = new URL(url);
    if (u.pathname.endsWith("/threads")) return r({ threads: [{ id: "hiloemb225", snippet: "The vessel sailed on Oct 20" }] });
    if (decodeURIComponent(u.pathname.split("/").pop()!) !== "hiloemb225") return r({ error: { message: "Not Found" } }, 404);
    return r({ id: "hiloemb225", messages: hiloFalso });
  }
  return r({ error: "ruta falsa" }, 404);
};

describe.skipIf(!hayBase)("Gmail contra la base local", () => {
  const entorno = { supabaseUrl: URL_SB!, supabaseAnonKey: ANON!, serviceKey: SERVICIO!, clientId: "cliente", clientSecret: "secreto", appUrl: "https://erp.x", fetch: falsa };
  const db = createClient(URL_SB!, ANON!, { auth: { persistSession: false } });
  let isaac = "", token = "", tokenCompras = "", cot = "";
  const c = new pg.Client({ connectionString: URL_PG });
  const pedir = (accion: string, cuerpo: unknown, t = token) =>
    atender(new Request(`http://x/functions/v1/correo/${accion}`, { method: "POST", headers: { Authorization: `Bearer ${t}` }, body: JSON.stringify(cuerpo) }), entorno);
  const pdf = Buffer.from("%PDF-1.4 cotizacion de prueba").toString("base64");

  beforeAll(async () => {
    await c.connect();
    const { data: s } = await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    token = s.session!.access_token; isaac = s.user!.id;
    const { data: k } = await db.auth.signInWithPassword({ email: "compras@hegamex.com", password: "hegamex-local" });
    tokenCompras = k.session!.access_token;
    await c.query("delete from public.correo_cuentas where usuario_id = $1", [isaac]);
    const cli = await c.query("insert into public.clientes (nombre, vendedor_id) values ('Granos Gmail 217', $1) returning id", [isaac]);
    const con = await c.query("insert into public.contactos (cliente_id, nombre, correo) values ($1, 'Rosa', 'rosa@granos.mx') returning id", [cli.rows[0].id]);
    const q = await c.query("insert into public.cotizaciones (cliente_id, vendedor_id, contacto_id, tiempo_entrega) values ($1, $2, $3, '20 días hábiles') returning id", [cli.rows[0].id, isaac, con.rows[0].id]);
    cot = q.rows[0].id;
    await c.query("insert into public.cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values ($1, 'Cribadora V3', 15000)", [cot]);   // abajo del tope de partida libre (256): no pide autorización
  });

  afterAll(async () => {
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query("delete from public.correos_enviados where documento_id = $1", [cot]);
      await c.query("delete from public.correo_cuentas where usuario_id = $1", [isaac]);
      await c.query("delete from public.correo_permisos_pendientes where usuario_id = $1", [isaac]);
      await c.query("create temp table _cl on commit drop as select id from public.clientes where nombre = 'Granos Gmail 217'");
      for (const t of ["actividades", "seguimientos_cotizacion"]) {
        await c.query(`delete from public.${t} where oportunidad_id in (select id from public.oportunidades where cliente_id in (select id from _cl))`);
      }
      await c.query("delete from public.actividades where cliente_id in (select id from _cl)");
      await c.query("delete from public.cotizacion_lineas where cotizacion_id in (select id from public.cotizaciones where cliente_id in (select id from _cl))");
      await c.query("delete from public.cotizaciones where cliente_id in (select id from _cl)");
      await c.query("delete from public.oportunidades where cliente_id in (select id from _cl)");
      await c.query("delete from public.contactos where cliente_id in (select id from _cl)");
      await c.query("delete from public.clientes where id in (select id from _cl)");
      await c.query("commit");
    } finally { await c.end(); }
  });

  it("sin Gmail conectado no se manda nada (y la pantalla sabe que hay que conectar)", async () => {
    const r = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["rosa@granos.mx"], asunto: "Cotización", cuerpo: "Hola", adjunto: { base64: pdf } });
    expect(r.status).toBe(409);
    expect((await r.json()).conectar).toBe(true);
    expect(llamadas.some((x) => x.url === GMAIL_ENVIAR)).toBe(false);
  });

  it("conectar: el enlace pide enviar y leer, y Google regresa con la cuenta", async () => {
    const r = await pedir("iniciar", { volver_a: `/ventas/cotizaciones/${cot}` });
    const { url } = await r.json();
    const u = new URL(url);
    expect(url.startsWith(GOOGLE_AUTH)).toBe(true);
    expect(u.searchParams.get("scope")).toContain(ENVIAR);
    expect(u.searchParams.get("scope")).toContain(LEER);
    expect(u.searchParams.get("access_type")).toBe("offline");
    const vuelta = await atender(new Request(`http://x/functions/v1/correo/autorizar?code=abc&state=${u.searchParams.get("state")}`), entorno);
    expect(vuelta.status).toBe(302);
    expect(vuelta.headers.get("Location")).toBe(`https://erp.x/ventas/cotizaciones/${cot}?correo=conectado`);
    const fila = await c.query("select correo, refresh_token, alcances from public.correo_cuentas where usuario_id = $1", [isaac]);
    expect(fila.rows[0]).toMatchObject({ correo: "isaac.gmail@hegamex.com", refresh_token: "refresco-1" });
    // El mismo enlace no sirve dos veces.
    const otra = await atender(new Request(`http://x/functions/v1/correo/autorizar?code=abc&state=${u.searchParams.get("state")}`), entorno);
    expect(otra.headers.get("Location")).toContain("correo=error");
  });

  it("las reglas del documento van antes que el correo: compras no manda cotizaciones", async () => {
    const antes = llamadas.length;
    const r = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["rosa@granos.mx"], asunto: "Cotización", cuerpo: "Hola" }, tokenCompras);
    expect(r.status).toBe(403);
    expect(llamadas.slice(antes).some((x) => x.url === GMAIL_ENVIAR)).toBe(false);
    const malo = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["no es correo"], asunto: "x", cuerpo: "" });
    expect(malo.status).toBe(400);
    const noPdf = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["rosa@granos.mx"], asunto: "x", cuerpo: "", adjunto: { base64: Buffer.from("<html>").toString("base64") } });
    expect((await noPdf.json()).error).toContain("no es un PDF");
  });

  it("mandar: sale de su Gmail con el PDF, la cotización queda enviada y anotada", async () => {
    const antes = llamadas.length;
    const r = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["Rosa@Granos.mx"], cc: ["rosa@granos.mx", "jefe@granos.mx"],
      asunto: "Cotización Hegamex", cuerpo: "Buen día, le comparto la cotización.", adjunto: { base64: pdf, nombre: "Cotizacion prueba.pdf" } });
    const d = await r.json();
    expect(r.status, JSON.stringify(d)).toBe(200);
    expect(d).toMatchObject({ ok: true, de: "isaac.gmail@hegamex.com", hilo: "hilo-217", aviso: null });
    const envio = llamadas.slice(antes).find((x) => x.url === GMAIL_ENVIAR)!;
    expect(envio.auth).toBe("Bearer acceso-1");
    expect(envio.cuerpo).toContain("<isaac.gmail@hegamex.com>");
    // El destinatario repetido en copia se quita.
    expect(envio.cuerpo).toContain("To: rosa@granos.mx\r\nCc: jefe@granos.mx\r\n");
    expect(envio.cuerpo).toContain("application/pdf");
    const q = await c.query("select estado from public.cotizaciones where id = $1", [cot]);
    expect(q.rows[0].estado).toBe("enviada");
    const e = await c.query("select de, para, cc, gmail_hilo, adjunto from public.correos_enviados where documento_id = $1", [cot]);
    expect(e.rows[0]).toMatchObject({ de: "isaac.gmail@hegamex.com", para: ["rosa@granos.mx"], cc: ["jefe@granos.mx"], gmail_hilo: "hilo-217", adjunto: "Cotizacion prueba.pdf" });
    const a = await c.query("select count(*)::int n from public.actividades where tipo = 'correo' and descripcion like '%rosa@granos.mx' and usuario_id = $1 and cliente_id = (select cliente_id from public.cotizaciones where id = $2)", [isaac, cot]);
    expect(a.rows[0].n).toBe(1);
    // Por dónde salió (257): un solo renglón, por correo, con el destinatario (sin la copia repetida).
    const env = await c.query("select canal, destino, marco_enviada from public.cotizacion_envios where cotizacion_id = $1", [cot]);
    expect(env.rows).toEqual([{ canal: "correo", destino: "rosa@granos.mx", marco_enviada: true }]);
  });

  it("si Google retiró el permiso, se pide reconectar y no queda nada a medias", async () => {
    await c.query("update public.correo_cuentas set refresh_token = 'revocado', expira_en = now() - interval '1 hour' where usuario_id = $1", [isaac]);
    const r = await pedir("enviar", { tipo: "cotizacion", id: cot, para: ["rosa@granos.mx"], asunto: "Otra vez", cuerpo: "" });
    expect(r.status).toBe(409);
    expect((await r.json()).conectar).toBe(true);
    const f = await c.query("select error from public.correo_cuentas where usuario_id = $1", [isaac]);
    expect(f.rows[0].error).toContain("vuelve a conectar");
    expect((await c.query("select count(*)::int n from public.correos_enviados where documento_id = $1", [cot])).rows[0].n).toBe(1);
  });

  it("desconectar le quita el permiso en Google y borra la cuenta", async () => {
    const r = await pedir("desconectar", {});
    expect(r.status).toBe(200);
    expect(llamadas.some((x) => x.url.startsWith(GOOGLE_REVOKE))).toBe(true);
    expect((await c.query("select count(*)::int n from public.correo_cuentas where usuario_id = $1", [isaac])).rows[0].n).toBe(0);
  });
});

describe.skipIf(!hayBase)("Correos de un embarque contra la base local", () => {
  const entorno = { supabaseUrl: URL_SB!, supabaseAnonKey: ANON!, serviceKey: SERVICIO!, clientId: "cliente", clientSecret: "secreto", appUrl: "https://erp.x", fetch: falsa };
  const db = createClient(URL_SB!, ANON!, { auth: { persistSession: false } });
  const c = new pg.Client({ connectionString: URL_PG });
  const t: Record<string, string> = {};
  let alondra = "", emb = "";
  const pedir = (accion: string, cuerpo: unknown, quien = "imp") =>
    atender(new Request(`http://x/functions/v1/correo/${accion}`, { method: "POST", headers: { Authorization: `Bearer ${t[quien]}` }, body: JSON.stringify(cuerpo) }), entorno);

  beforeAll(async () => {
    await c.connect();
    for (const [k, correo] of [["imp", "importaciones@hegamex.com"], ["alm", "almacen@hegamex.com"], ["dir", "direccion@hegamex.com"]]) {
      const { data: s } = await db.auth.signInWithPassword({ email: correo, password: "hegamex-local" });
      t[k] = s.session!.access_token;
      if (k === "imp") alondra = s.user!.id;
    }
    await c.query("delete from public.correo_cuentas where usuario_id = $1", [alondra]);
    await c.query(`insert into public.correo_cuentas (usuario_id, correo, access_token, refresh_token, expira_en, alcances)
      values ($1, 'alondra@hegamex.com', 'acceso-imp', 'refresco-imp', now() + interval '1 hour', $2)`, [alondra, ["openid", "email", ENVIAR, LEER]]);
    emb = (await c.query("insert into public.embarques (descripcion, modalidad) values ('Prueba correos 225', 'fcl') returning id")).rows[0].id;
  });

  afterAll(async () => {
    try {
      await c.query("delete from public.embarques where id = $1", [emb]);
      await c.query("delete from public.correo_cuentas where usuario_id = $1 or refresh_token = 'refresco-dir'", [alondra]);
    } finally { await c.end(); }
  });

  it("almacén no busca ni liga correos (traen montos)", async () => {
    const r = await pedir("buscar", { q: "MEHE225" }, "alm");
    expect(r.status).toBe(403);
  });

  it("buscar en su Gmail: el hilo con su asunto, de quién y cuántos correos", async () => {
    const r = await pedir("buscar", { q: "MEHE225", embarque_id: emb });
    const d = await r.json();
    expect(r.status, JSON.stringify(d)).toBe(200);
    expect(d.hilos).toEqual([expect.objectContaining({ id: "hiloemb225", asunto: "Booking MEHE 225", de: "Lily <lily@forwarder.cn>", mensajes: 2, ligado: false })]);
    expect(llamadas.filter((x) => x.url.startsWith(GMAIL_HILOS)).every((x) => x.auth === "Bearer acceso-imp")).toBe(true);
  });

  it("ligar: guarda cada correo sin lo citado, con sus adjuntos", async () => {
    const r = await pedir("ligar", { embarque_id: emb, hilo: "hiloemb225" });
    const d = await r.json();
    expect(r.status, JSON.stringify(d)).toBe(200);
    expect(d).toMatchObject({ mensajes: 2, nuevos: 2 });
    const cs = await c.query(`select c.de, c.texto, c.adjuntos from public.embarque_correos c join public.embarque_hilos h on h.id = c.hilo_id
      where h.embarque_id = $1 order by c.enviado_en`, [emb]);
    expect(cs.rows[0].texto).toBe("The vessel COSCO AFRICA sailed on Oct 20. Freight USD 1,850.");
    expect(cs.rows[0].adjuntos).toEqual(["BL MEHE225.pdf"]);
    expect(cs.rows[1].texto).toBe("Recibimos el BL. Favor de mandar la carta 3.1.8 .");
    const h = await c.query("select cuenta, mensajes, participantes from public.embarque_hilos where embarque_id = $1", [emb]);
    expect(h.rows[0]).toMatchObject({ cuenta: "alondra@hegamex.com", mensajes: 2 });
    expect(h.rows[0].participantes).toEqual(expect.arrayContaining(["lily@forwarder.cn", "agente@aduana.mx", "alondra@hegamex.com"]));
    const otra = await pedir("buscar", { q: "MEHE225", embarque_id: emb });
    expect((await otra.json()).hilos[0].ligado).toBe(true);
  });

  it("actualizar trae solo lo nuevo, y solo lo actualiza quien tiene el Gmail", async () => {
    hiloFalso.push(correoFalso("m3", Date.parse("2026-10-27T14:00:00Z"), "Agencia <agente@aduana.mx>", "RE: Booking MEHE 225", "Llegó a Manzanillo el 27."));
    const { rows } = await c.query("select id from public.embarque_hilos where embarque_id = $1", [emb]);
    // Dirección también tiene su Gmail, pero el hilo vive en el de Alondra.
    await c.query(`insert into public.correo_cuentas (usuario_id, correo, refresh_token, alcances)
      select id, 'abel@hegamex.com', 'refresco-dir', $1 from public.perfiles where correo = 'direccion@hegamex.com'
      on conflict (usuario_id) do nothing`, [["openid", "email", ENVIAR, LEER]]);
    const ajeno = await pedir("actualizar", { hilo_id: rows[0].id }, "dir");
    expect(ajeno.status).toBe(403);
    expect((await ajeno.json()).error).toContain("alondra@hegamex.com");
    const r = await pedir("actualizar", { hilo_id: rows[0].id });
    expect(await r.json()).toMatchObject({ ok: true, mensajes: 3, nuevos: 1 });
    expect((await c.query("select count(*)::int n from public.embarque_correos where hilo_id = $1", [rows[0].id])).rows[0].n).toBe(3);
  });

  it("sin el permiso de leer, se pide reconectar", async () => {
    await c.query("update public.correo_cuentas set alcances = $2 where usuario_id = $1", [alondra, ["openid", "email", ENVIAR]]);
    const r = await pedir("buscar", { q: "MEHE225" });
    expect(r.status).toBe(409);
    expect((await r.json()).conectar).toBe(true);
  });
});
