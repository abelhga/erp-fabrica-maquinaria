// Abre la app en Chromium, entra con un usuario de prueba y toma capturas.
// Uso: node scripts/capturas.mjs <correo> <ruta1> [ruta2…]   (servidor en APP_URL, por defecto :5173)
// Contra el sitio publicado: APP_URL=https://… CONTRASENA=… (los usuarios de la nube no usan "hegamex-local").
// Las capturas quedan en capturas/<usuario>-<ruta>.png. Muestra errores de consola: una pantalla
// que "se ve bien" pero tira errores no está bien.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [correo = "direccion@hegamex.com", ...rutas] = process.argv.slice(2);
const base = process.env.APP_URL ?? "http://localhost:5173";
const ancho = Number(process.env.ANCHO ?? 1440), alto = Number(process.env.ALTO ?? 900);
mkdirSync("capturas", { recursive: true });

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pag = await nav.newPage({ viewport: { width: ancho, height: alto }, colorScheme: process.env.OSCURO ? "dark" : "light" });
const errores = [];
pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
pag.on("pageerror", (e) => errores.push(e.message));

await pag.goto(base);
if (process.env.OSCURO) await pag.evaluate(() => localStorage.setItem("tema", "oscuro"));
await pag.getByText("Entrar con correo y contraseña").click();
await pag.getByLabel("Correo").fill(correo);
await pag.getByLabel("Contraseña").fill(process.env.CONTRASENA ?? "hegamex-local");
await pag.getByRole("button", { name: "Entrar", exact: true }).click();
await pag.waitForTimeout(1500);

for (const ruta of rutas.length ? rutas : ["/"]) {
  await pag.goto(base + ruta);
  await pag.waitForLoadState("networkidle");
  await pag.waitForTimeout(Number(process.env.ESPERA ?? 800));
  // CLIC="texto" pulsa algo antes de la foto (un botón, una pestaña); PREGUNTA="…" la escribe en el asistente.
  if (process.env.CLIC) {
    // CLIC="css=…" para algo sin texto (un ícono); si no, por el texto visible.
    const c = process.env.CLIC;
    await (c.startsWith("css=") ? pag.locator(c.slice(4)) : pag.getByText(c, { exact: false })).first().click();
    await pag.waitForTimeout(600);
  }
  if (process.env.PREGUNTA) {
    await pag.getByPlaceholder("Pregunta algo del negocio…").fill(process.env.PREGUNTA);
    await pag.keyboard.press("Enter");
    await pag.waitForTimeout(Number(process.env.ESPERA ?? 800));
  }
  // La página se desplaza dentro de <main>, no en el documento: para la foto completa se agranda la ventana.
  if (process.env.COMPLETA) {
    const h = await pag.evaluate(() => { const m = document.querySelector("main"); return m ? m.scrollHeight + 64 : document.body.scrollHeight; });
    await pag.setViewportSize({ width: ancho, height: Math.min(Math.max(h, alto), 8000) });
    await pag.waitForTimeout(600);
  }
  const nombre = `capturas/${correo.split("@")[0]}${ruta.replace(/[/?=&]+/g, "-").replace(/-$/, "") || "-inicio"}${process.env.OSCURO ? "-oscuro" : ""}.png`;
  await pag.screenshot({ path: nombre, fullPage: !!process.env.COMPLETA });
  console.log("📸", nombre);
  if (process.env.COMPLETA) await pag.setViewportSize({ width: ancho, height: alto });
}
if (errores.length) { console.log("⚠ errores de consola:\n  " + [...new Set(errores)].join("\n  ")); }
await nav.close();
