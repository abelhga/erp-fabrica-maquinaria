// Crea en el Supabase LOCAL un usuario por rol (contraseña "hegamex-local")
// para probar pantallas y permisos. Nunca correr contra producción: se niega
// si la URL no es localhost.
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8" }).split("\n")
    .filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const url = env.API_URL;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`Solo para el Supabase local (URL: ${url})`);
const admin = createClient(url, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export const USUARIOS = [
  ["direccion@hegamex.com", "Abel Hernández G", ["direccion"]],
  ["isaac@hegamex.com", "Isaac Hernández", ["ventas"]],
  ["juan@hegamex.com", "Juan Manuel Ramírez", ["ventas"]],
  ["susana@hegamex.com", "Susana Rizo", ["ventas"]],
  ["gerente.ventas@hegamex.com", "Elizabeth Hernández", ["gerente_ventas"]],
  ["ingenieria@hegamex.com", "Miguel Ingeniería", ["ingenieria"]],
  ["compras@hegamex.com", "Comprador Hegamex", ["compras"]],
  ["almacen@hegamex.com", "Almacenista Hegamex", ["almacen"]],
  ["gerente.produccion@hegamex.com", "Gerente de Producción", ["gerente_produccion"]],
  ["taller@hegamex.com", "Supervisor de Taller", ["produccion"]],
  ["rrhh@hegamex.com", "Recursos Humanos", ["rrhh"]],
  ["finanzas@hegamex.com", "Finanzas Hegamex", ["finanzas"]],
  ["sistemas@hegamex.com", "Sistemas Hegamex", ["admin"]],
  ["tv@hegamex.com", "Pantalla del taller", ["pantalla"]],
  ["importaciones@hegamex.com", "Alondra (prueba)", ["importaciones"]],
];

for (const [correo, nombre, roles] of USUARIOS) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let u = lista.users.find((x) => x.email === correo);
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email: correo, password: "hegamex-local", email_confirm: true, user_metadata: { full_name: nombre },
    });
    if (error) throw error;
    u = data.user;
  }
  await admin.from("usuario_roles").delete().eq("usuario_id", u.id);
  const { error } = await admin.from("usuario_roles").insert(roles.map((rol) => ({ usuario_id: u.id, rol })));
  if (error) throw error;
  console.log(`✔ ${correo.padEnd(32)} ${roles.join(", ")}`);
}
// Planes de comisión de los vendedores, como en sus hojas.
const ids = Object.fromEntries((await admin.from("perfiles").select("id, correo")).data.map((p) => [p.correo, p.id]));
const planes = Object.fromEntries((await admin.from("planes_comision").select("id, nombre")).data.map((p) => [p.nombre, p.id]));
await admin.from("vendedor_plan").upsert([
  { vendedor_id: ids["isaac@hegamex.com"], plan_id: planes["General (Isaac, Juan Manuel)"] },
  { vendedor_id: ids["juan@hegamex.com"], plan_id: planes["General (Isaac, Juan Manuel)"] },
  { vendedor_id: ids["susana@hegamex.com"], plan_id: planes["Susana"] },
]);
console.log("Contraseña de todos: hegamex-local");
