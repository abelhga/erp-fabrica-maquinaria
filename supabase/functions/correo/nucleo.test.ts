// Gmail con un Google falso: que el correo salga bien armado (acentos, adjunto) y, contra la base
// local, que conectar guarde la cuenta, que mandar revise antes las reglas del documento, que
// salga de la cuenta de quien lo manda y quede anotado. Necesita la llave de servicio de la
// base local (SUPABASE_SERVICE_ROLE_KEY) y DATABASE_URL; sin ellas se brinca esa parte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { ENVIAR, GMAIL_ENVIAR, GOOGLE_AUTH, GOOGLE_REVOKE, GOOGLE_TOKEN, LEER, armarCorreo, atender, correoDelToken, correoValido, rutaSegura } from "./nucleo.ts";

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
    const q = await c.query("insert into public.cotizaciones (cliente_id, vendedor_id, contacto_id) values ($1, $2, $3) returning id", [cli.rows[0].id, isaac, con.rows[0].id]);
    cot = q.rows[0].id;
    await c.query("insert into public.cotizacion_lineas (cotizacion_id, titulo, precio_unitario) values ($1, 'Cribadora V3', 100000)", [cot]);
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
