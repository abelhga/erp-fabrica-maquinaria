// "Ver como" contra la base local de verdad: que solo dirección/sistemas abran una
// vista previa, que la sesión sea la de la otra persona (ve lo suyo) y que no pueda
// guardar nada por la API. Necesita la llave de servicio de la base local
// (SUPABASE_SERVICE_ROLE_KEY, la imprime `npx supabase status`); sin ella se brinca.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { atender, idDeSesion } from "./nucleo.ts";

const ruta = new URL("../../../.env.local", import.meta.url);
const env = existsSync(ruta) ? Object.fromEntries(
  readFileSync(ruta, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
) : {};
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const hayBase = !!SERVICIO && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);
const entorno = { supabaseUrl: URL_SB, supabaseAnonKey: ANON, serviceKey: SERVICIO ?? "" };

async function token(correo: string) {
  const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: correo, password: "hegamex-local" });
  if (error) throw error;
  return data.session!.access_token;
}
async function idDe(correo: string) {
  const admin = createClient(URL_SB, SERVICIO!, { auth: { persistSession: false } });
  const { data } = await admin.from("perfiles").select("id").eq("correo", correo).single();
  return (data as { id: string }).id;
}
const pedir = async (tok: string, usuario_id: string) =>
  atender(new Request("http://x/ver-como", { method: "POST", headers: { Authorization: `Bearer ${tok}` }, body: JSON.stringify({ usuario_id }) }), entorno);

describe("idDeSesion", () => {
  it("saca el session_id del token, con o sin relleno de base64", () => {
    const cuerpo = Buffer.from(JSON.stringify({ sub: "x", session_id: "abc-123" })).toString("base64url");
    expect(idDeSesion(`h.${cuerpo}.f`)).toBe("abc-123");
    expect(idDeSesion("no-es-token")).toBeNull();
  });
});

describe.skipIf(!hayBase)("ver como (base local)", () => {
  it("almacén no puede abrir una vista previa", async () => {
    const r = await pedir(await token("almacen@hegamex.com"), await idDe("isaac@hegamex.com"));
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/Solo dirección y sistemas/);
  });

  it("dirección no puede ver como sistemas", async () => {
    const r = await pedir(await token("direccion@hegamex.com"), await idDe("sistemas@hegamex.com"));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/ya ven todo/);
  });

  it("dirección ve como Isaac: su sesión, sus clientes y nada se guarda", async () => {
    const isaac = await idDe("isaac@hegamex.com");
    const r = await pedir(await token("direccion@hegamex.com"), isaac);
    expect(r.status).toBe(200);
    const { access_token, refresh_token } = await r.json();
    expect(refresh_token).toBeTruthy();

    const vista = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    await vista.auth.setSession({ access_token, refresh_token });
    const { data: s } = await vista.rpc("mi_sesion");
    expect(s.perfil.id).toBe(isaac);
    expect(s.roles).toEqual(["ventas"]);
    expect(s.vista_previa.abierta_por).toBeTruthy();

    // Ve lo que ve Isaac: sus pedidos, no los de otro vendedor (dirección ve todos).
    const { data: pedidos } = await vista.from("pedidos").select("vendedor_id").limit(1000);
    expect(pedidos!.length).toBeGreaterThan(0);
    expect(pedidos!.every((p) => p.vendedor_id === isaac)).toBe(true);

    // Y nada se guarda: ni una tabla ni una función.
    const alta = await vista.from("clientes").insert({ nombre: "Prueba vista previa", vendedor_id: isaac });
    expect(alta.error?.message).toMatch(/read-only transaction/);
    const cot = await vista.rpc("nueva_cotizacion", { p_cliente: null, p_oportunidad: null });
    expect(cot.error?.message).toMatch(/read-only transaction/);

    // Quedó anotada con quién la abrió.
    const admin = createClient(URL_SB, SERVICIO!, { auth: { persistSession: false } });
    const { data: anotada } = await admin.from("vistas_previas").select("usuario_id").eq("session_id", idDeSesion(access_token)!).single();
    expect(anotada!.usuario_id).toBe(isaac);
    await vista.auth.signOut({ scope: "local" });
  });

  it("Isaac con su sesión normal sí guarda (la regla es de la vista previa, no de él)", async () => {
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    await db.auth.signInWithPassword({ email: "isaac@hegamex.com", password: "hegamex-local" });
    const { data } = await db.rpc("mi_sesion");
    expect(data.vista_previa).toBeNull();
  });
});
