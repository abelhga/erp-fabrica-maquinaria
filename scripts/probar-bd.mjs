// Corre cada archivo de supabase/pruebas/*.sql dentro de una transacción que
// se deshace al final: las pruebas no ensucian la base local.
// Una prueba falla si lanza excepción (los archivos usan "assert" de plpgsql).
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dir = new URL("../supabase/pruebas/", import.meta.url);
const filtro = process.argv[2];
const archivos = readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.startsWith("_") && (!filtro || f.includes(filtro))).sort();
const ayudas = readFileSync(new URL("_ayudas.sql", dir), "utf8");

const db = new pg.Client({ connectionString: url });
await db.connect();
db.on("notice", (n) => console.log("   ·", n.message));
let fallas = 0;
for (const f of archivos) {
  const sql = readFileSync(new URL(f, dir), "utf8");
  const t0 = Date.now();
  try {
    await db.query("begin");
    await db.query(ayudas);
    await db.query(sql);
    console.log(`✔ ${f} (${Date.now() - t0} ms)`);
  } catch (e) {
    fallas++;
    console.log(`✘ ${f}\n   ${e.message}${e.where ? "\n   " + e.where.split("\n")[0] : ""}`);
  } finally {
    await db.query("rollback");
  }
}
await db.end();
console.log(fallas ? `\n${fallas} archivo(s) con fallas` : `\nTodo bien (${archivos.length} archivos)`);
process.exit(fallas ? 1 : 0);
