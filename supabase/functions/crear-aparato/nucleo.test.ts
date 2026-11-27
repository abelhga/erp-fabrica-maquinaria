// La cuenta de aparato contra la base local de verdad: administración la crea ya confirmada y
// con su rol (entra con contraseña sin confirmar correo); nadie más puede, y no sirve para otros
// correos ni roles. Necesita la llave de servicio de la base local (SUPABASE_SERVICE_ROLE_KEY, la
// imprime `npx supabase status`); sin ella se brinca.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { atender, revisar } from "./nucleo.ts";

const ruta = new URL("../../../.env.local", import.meta.url);
const env = existsSync(ruta) ? Object.fromEntries(
  readFileSync(ruta, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
) : {};
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const hayBase = !!SERVICIO && await fetch(`${URL_SB}/auth/v1/health`, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false);
const entorno = { supabaseUrl: URL_SB, supabaseAnonKey: ANON, serviceKey: SERVICIO ?? "" };

async function token(correo: string, clave = "hegamex-local") {
  const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw error;
  return data.session!.access_token;
}
const pedir = async (tok: string, cuerpo: unknown) =>
  atender(new Request("http://x/crear-aparato", { method: "POST", headers: { Authorization: `Bearer ${tok}` }, body: JSON.stringify(cuerpo) }), entorno);

describe("revisar", () => {
  it("solo deja cuentas de aparato del dominio, con contraseña larga", () => {
    expect(revisar({ tipo: "terminal", nombre: "Terminal de corte", correo: "Terminal.Corte.2@hegamex.com", clave: "abcd-2345-wxyz" }, "hegamex.com"))
      .toEqual({ tipo: "terminal", nombre: "Terminal de corte", correo: "terminal.corte.2@hegamex.com", clave: "abcd-2345-wxyz" });
    expect(revisar({ tipo: "admin", nombre: "x x x", correo: "admin@hegamex.com", clave: "abcd-2345-wxyz" }, "hegamex.com")).toHaveProperty("error");
    expect(revisar({ tipo: "terminal", nombre: "Juan", correo: "juan@hegamex.com", clave: "abcd-2345-wxyz" }, "hegamex.com")).toHaveProperty("error");
    expect(revisar({ tipo: "tv", nombre: "TV pintura", correo: "tv.pintura@gmail.com", clave: "abcd-2345-wxyz" }, "hegamex.com")).toHaveProperty("error");
    expect(revisar({ tipo: "tv", nombre: "TV pintura", correo: "tv.pintura@hegamex.com", clave: "corta" }, "hegamex.com")).toHaveProperty("error");
  });
});

describe.skipIf(!hayBase)("crear-aparato contra la base local", () => {
  const sufijo = Date.now().toString(36);
  const correo = `terminal.prueba.${sufijo}@hegamex.com`;
  const clave = "prueba-2345-wxyz";

  it("un vendedor no puede crearla", async () => {
    const r = await pedir(await token("isaac@hegamex.com"), { tipo: "terminal", nombre: "Terminal de prueba", correo, clave });
    expect(r.status).toBe(403);
  });

  it("dirección la crea ya confirmada, con rol terminal, y entra con su contraseña", async () => {
    const r = await pedir(await token("direccion@hegamex.com"), { tipo: "terminal", nombre: "Terminal de prueba", correo, clave });
    expect(r.status, await r.clone().text()).toBe(200);
    const tok = await token(correo, clave);
    const db = createClient(URL_SB, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${tok}` } } });
    const { data } = await db.rpc("mis_roles");
    expect(data).toEqual(["terminal"]);
    const admin = createClient(URL_SB, SERVICIO!, { auth: { persistSession: false } });
    const { data: inv } = await admin.from("invitaciones").select("correo").eq("correo", correo);
    expect(inv).toEqual([]);
    // Otra vez el mismo correo: avisa y no deja invitación colgada.
    const r2 = await pedir(await token("direccion@hegamex.com"), { tipo: "terminal", nombre: "Terminal de prueba", correo, clave });
    expect(r2.status).toBe(400);
    expect((await r2.json()).error).toMatch(/ya tiene cuenta/);
    const { data: inv2 } = await admin.from("invitaciones").select("correo").eq("correo", correo);
    expect(inv2).toEqual([]);
  });
});
