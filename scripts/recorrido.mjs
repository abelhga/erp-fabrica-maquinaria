// Recorre todas las pantallas con cada rol, toma captura y junta errores de
// consola y pantallas que no cargan. Es la revisión final antes de entregar.
//   node scripts/recorrido.mjs [rol…]      (servidor en APP_URL, por defecto :5173)
// Contra el sitio publicado, donde no hay conexión directa a la base ni "hegamex-local":
//   APP_URL=https://… CONTRASENAS=claves.json RUTAS_DETALLE=/ventas/pedidos/<id>,… node scripts/recorrido.mjs
// (claves.json = {"correo": "contraseña"}; fuera del repositorio).
// Capturas en capturas/recorrido/<correo>/<ruta>.png y un resumen al final.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const base = process.env.APP_URL ?? "http://localhost:5173";
const RUTAS = [
  "/", "/pendientes", "/semana", "/ventas/para-llamar", "/ventas/oportunidades", "/ventas/cotizaciones", "/ventas/cotizaciones/nueva", "/ventas/pedidos",
  "/ventas/clientes", "/ventas/comisiones", "/ventas/solicitudes", "/ventas/devoluciones", "/costeo/equipos", "/costeo/componentes", "/costeo/planos", "/costeo/margenes",
  "/costeo/precios-ventas", "/compras/precios", "/compras/solicitudes", "/compras/ordenes", "/compras/proveedores", "/almacen/existencias",
  "/almacen/movimientos", "/almacen/reabasto", "/almacen/envios", "/importaciones", "/importaciones/dinero", "/produccion/gerencia",
  "/produccion/ordenes", "/produccion/terminal", "/piso", "/servicio", "/servicio/maquinas", "/servicio/reportar",
  "/servicio/resguardos", "/rrhh/empleados", "/rrhh/incidencias", "/rrhh/objetivos", "/rrhh/checklist", "/rrhh/prenomina",
  "/rrhh/mi-desempeno", "/finanzas/cobranza", "/finanzas/pagos", "/sistema/usuarios", "/sistema/importar",
  "/sistema/bitacora", "/sistema/configuracion", "/analisis", "/analisis/tendencias", "/analisis/clientes",
  "/analisis/producto", "/analisis/planeacion", "/analisis/ubicaciones",
];
// Una ficha de cada tipo, la más reciente: las pantallas de detalle son las que más
// consultas hacen y las que un recorrido solo de listas nunca abre.
const DETALLES = [
  ["/costeo/equipos/", "select id from articulos where tipo = 'equipo' and activo order by (select count(*) from bom_lineas b where b.padre_id = articulos.id) desc limit 1"],
  ["/costeo/componentes/", "select id from articulos where tipo = 'componente' and activo order by clave limit 1"],
  ["/ventas/cotizaciones/", "select id from cotizaciones order by creado_en desc limit 1"],
  ["/ventas/pedidos/", "select id from pedidos order by creado_en desc limit 1"],
  ["/ventas/clientes/", "select cliente_id from historial_ventas_hoja group by 1 order by count(*) desc limit 1"],
  ["/compras/ordenes/", "select id from ordenes_compra order by creado_en desc limit 1"],
  ["/compras/proveedores/", "select proveedor_id from ordenes_compra order by creado_en desc limit 1"],
  ["/produccion/ordenes/", "select id from ordenes_produccion order by creado_en desc limit 1"],
  ["/servicio/maquinas/", "select id from maquinas order by id limit 1"],
  ["/servicio/", "select id from servicios order by creado_en desc limit 1"],
  ["/importaciones/", "select id from embarques order by creado_en desc limit 1"],
];
if (process.env.RUTAS_DETALLE) {
  RUTAS.push(...process.env.RUTAS_DETALLE.split(",").filter(Boolean));
} else {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  await db.connect();
  for (const [prefijo, sql] of DETALLES) {
    const r = await db.query(sql).catch((e) => { console.log(`✘ no se pudo elegir ${prefijo}: ${e.message}`); return { rows: [] }; });
    if (r.rows[0]) RUTAS.push(prefijo + Object.values(r.rows[0])[0]);
  }
  await db.end();
}
const CLAVES = process.env.CONTRASENAS ? JSON.parse(readFileSync(process.env.CONTRASENAS, "utf8")) : {};
const USUARIOS = {
  direccion: "direccion@hegamex.com", ventas: "isaac@hegamex.com", gerente_ventas: "gerente.ventas@hegamex.com",
  ingenieria: "ingenieria@hegamex.com", compras: "compras@hegamex.com", almacen: "almacen@hegamex.com",
  gerente_produccion: "gerente.produccion@hegamex.com", produccion: "taller@hegamex.com", rrhh: "rrhh@hegamex.com",
  finanzas: "finanzas@hegamex.com", admin: "sistemas@hegamex.com", pantalla: "tv@hegamex.com",
  importaciones: "importaciones@hegamex.com",
};
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(USUARIOS);
// CHROMIUM_ARGS: banderas extra del navegador (p. ej. confiar en el certificado de un proxy).
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: (process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });
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
  await pag.getByLabel("Contraseña").fill(CLAVES[correo] ?? "hegamex-local");
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
    await pag.screenshot({ path: `${dir}/${ruta.replace(/\/[0-9a-f-]{8,}$|\/\d+$/, "_ficha").replace(/\//g, "_") || "_inicio"}.png` });
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
