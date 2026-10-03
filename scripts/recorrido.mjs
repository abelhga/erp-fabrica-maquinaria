// Recorre todas las pantallas con cada rol, toma captura y junta errores de
// consola y pantallas que no cargan. Es la revisión final antes de entregar.
//   node scripts/recorrido.mjs [rol…]      (servidor en APP_URL, por defecto :5173)
// Capturas en capturas/recorrido/<correo>/<ruta>.png y un resumen al final.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.APP_URL ?? "http://localhost:5173";
const RUTAS = [
  "/", "/ventas/oportunidades", "/ventas/cotizaciones", "/ventas/cotizaciones/nueva", "/ventas/pedidos", "/ventas/clientes",
  "/ventas/comisiones", "/costeo/equipos", "/costeo/componentes", "/costeo/margenes", "/costeo/precios-ventas",
  "/compras/precios", "/compras/ordenes", "/compras/proveedores", "/almacen/existencias", "/almacen/movimientos",
  "/almacen/reabasto", "/produccion/gerencia", "/produccion/ordenes", "/produccion/terminal", "/piso",
  "/rrhh/empleados", "/rrhh/incidencias", "/finanzas/cobranza", "/finanzas/pagos", "/sistema/usuarios",
  "/sistema/importar", "/sistema/bitacora", "/sistema/configuracion",
];
const USUARIOS = {
  direccion: "direccion@hegamex.com", ventas: "isaac@hegamex.com", gerente_ventas: "gerente.ventas@hegamex.com",
  ingenieria: "ingenieria@hegamex.com", compras: "compras@hegamex.com", almacen: "almacen@hegamex.com",
  gerente_produccion: "gerente.produccion@hegamex.com", produccion: "taller@hegamex.com", rrhh: "rrhh@hegamex.com",
  finanzas: "finanzas@hegamex.com", admin: "sistemas@hegamex.com", pantalla: "tv@hegamex.com",
};
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(USUARIOS);
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const resumen = [];

for (const rol of roles) {
  const correo = USUARIOS[rol];
  const dir = `capturas/recorrido/${rol}`;
  mkdirSync(dir, { recursive: true });
  const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
  let errores = [];
  pag.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|favicon/.test(m.text())) errores.push(m.text().slice(0, 200)); });
  pag.on("pageerror", (e) => errores.push("EXCEPCIÓN: " + e.message.slice(0, 200)));
  await pag.goto(base);
  await pag.getByText("Entrar con correo y contraseña").click();
  await pag.getByLabel("Correo").fill(correo);
  await pag.getByLabel("Contraseña").fill("hegamex-local");
  await pag.getByRole("button", { name: "Entrar", exact: true }).click();
  await pag.waitForTimeout(1500);
  for (const ruta of rol === "pantalla" ? ["/"] : RUTAS) {
    errores = [];
    await pag.goto(base + ruta);
    await pag.waitForLoadState("networkidle").catch(() => {});
    await pag.waitForTimeout(700);
    const texto = await pag.locator("body").innerText();
    const estado = /no está en tu rol/i.test(texto) ? "sin permiso" : /en construcción/i.test(texto) ? "EN CONSTRUCCIÓN"
      : texto.trim().length < 20 ? "VACÍA" : "ok";
    await pag.screenshot({ path: `${dir}/${ruta.replace(/\//g, "_") || "_inicio"}.png` });
    resumen.push({ rol, ruta, estado, errores: [...new Set(errores)] });
    const marca = errores.length || estado === "VACÍA" || estado === "EN CONSTRUCCIÓN" ? "✘" : "✔";
    console.log(`${marca} ${rol.padEnd(18)} ${ruta.padEnd(28)} ${estado}${errores.length ? " · " + errores[0] : ""}`);
  }
  await pag.close();
}
await nav.close();
writeFileSync("capturas/recorrido/resumen.json", JSON.stringify(resumen, null, 2));
const malos = resumen.filter((r) => r.errores.length || r.estado === "VACÍA" || r.estado === "EN CONSTRUCCIÓN");
console.log(`\n${resumen.length} pantallas · ${malos.length} con problemas`);
process.exit(malos.length ? 1 : 0);
