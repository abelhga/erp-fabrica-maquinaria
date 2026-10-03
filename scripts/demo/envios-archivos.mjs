// La parte de la demostración de envíos que necesita archivos: fotos de empaque,
// PDF de guías y fotos de cómo llegó una devolución. Se suben a Storage con la
// sesión de quien lo haría (Susana sube guías, almacén toma las fotos), así que
// también prueba las políticas del bucket. Después recorre fechas al pasado para
// que la historia no parezca de hace un minuto.
//
//   psql "$DB_URL" -f scripts/demo/envios.sql && node scripts/demo/envios-archivos.mjs
//
// Idempotente: lo que ya tiene guía, ya está empacado o ya salió, se brinca.
// Solo contra el Supabase LOCAL. Las "fotos" son dibujos de una caja, no fotos reales.
import { readFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_SB = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) throw new Error(`Solo para el Supabase local (URL: ${URL_SB})`);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
await db.connect();

async function entrar(correo) {
  const c = createClient(URL_SB, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: correo, password: "hegamex-local" });
  if (error) throw new Error(`${correo}: ${error.message} (¿corriste scripts/usuarios-locales.mjs?)`);
  return c;
}
const ok = async (p, que) => { const { data, error } = await p; if (error) throw new Error(`${que}: ${error.message}`); return data; };

// ---------------------------------------------------------------------------
// "Fotos": una caja de cartón dibujada (abierta, con lo que lleva, o cerrada con
// su etiqueta), en PNG sin dependencias.
// ---------------------------------------------------------------------------
function png(ancho, alto, pintar) {
  const px = Buffer.alloc(ancho * alto * 3);
  const poner = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= ancho || y >= alto) return; const i = (y * ancho + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
  pintar(poner);
  const crudo = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) { crudo[y * (ancho * 3 + 1)] = 0; px.copy(crudo, y * (ancho * 3 + 1) + 1, y * ancho * 3, (y + 1) * ancho * 3); }
  const bloque = (tipo, datos) => {
    const t = Buffer.from(tipo, "ascii"); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos])) >>> 0);
    return Buffer.concat([l, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque("IHDR", ihdr), bloque("IDAT", deflateSync(crudo)), bloque("IEND", Buffer.alloc(0))]);
}

function foto(variante, semilla) {
  const W = 800, H = 600;
  const rnd = (() => { let s = semilla * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  return png(W, H, (p) => {
    const rect = (x0, y0, x1, y1, c, ruido = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const n = ruido ? Math.floor((rnd() - 0.5) * ruido) : 0; p(x, y, c.map((v) => Math.max(0, Math.min(255, v + n)))); } };
    rect(0, 0, W, H, [184, 184, 178], 14);                         // piso de concreto
    rect(0, 430, W, H, [150, 150, 146], 14);                        // sombra del piso
    const [bx, by, bw, bh] = [170 + Math.floor(rnd() * 40), 140, 460, 330];
    rect(bx + 14, by + 14, bx + bw + 14, by + bh + 14, [120, 118, 112]); // sombra de la caja
    rect(bx, by, bx + bw, by + bh, [196, 152, 98], 10);             // cartón
    if (variante === "abierta") {
      rect(bx + 20, by + 20, bx + bw - 20, by + bh - 20, [120, 86, 50], 8);   // adentro
      // Lo que lleva: piezas grises (metal) y una bolsa de tornillería.
      rect(bx + 50, by + 60, bx + 250, by + 200, [96, 104, 112], 18);
      rect(bx + 70, by + 80, bx + 230, by + 110, [140, 148, 156], 10);
      rect(bx + 280, by + 70, bx + 400, by + 170, [70, 78, 86], 12);
      rect(bx + 60, by + 220, bx + 200, by + 290, [215, 215, 220], 12);        // bolsa
      rect(bx + 230, by + 220, bx + 410, by + 285, [235, 235, 230], 6);         // manual
      rect(bx + 245, by + 235, bx + 395, by + 245, [40, 90, 170]);
    } else {
      rect(bx, by + bh / 2 - 22, bx + bw, by + bh / 2 + 22, [205, 190, 150], 4); // cinta
      rect(bx + 260, by + 40, bx + 430, by + 140, [248, 248, 245], 4);           // etiqueta
      for (let k = 0; k < 6; k++) rect(bx + 275, by + 55 + k * 13, bx + 275 + 60 + Math.floor(rnd() * 90), by + 61 + k * 13, [30, 30, 30]);
      for (let x = bx + 275; x < bx + 415; x += 4) if (rnd() > 0.4) rect(x, by + 120, x + 2, by + 134, [20, 20, 20]); // código de barras
    }
  });
}

// Un PDF de una página con el texto de la guía (solo para la demostración).
function pdfGuia(lineas) {
  const texto = lineas.map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 50 ${760 - i * 26} Td (${l.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
  ];
  let salida = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(salida, "latin1")); salida += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(salida, "latin1");
  salida += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  salida += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(salida, "latin1");
}

async function subir(c, ruta, cuerpo, tipo) {
  await ok(c.storage.from("envios").upload(ruta, cuerpo, { contentType: tipo, upsert: false }), `subir ${ruta}`);
  return ruta;
}

// ---------------------------------------------------------------------------
const susana = await entrar("susana@hegamex.com");
const almacen = await entrar("almacen@hegamex.com");

const { rows: envios } = await db.query(`
  select e.id, e.folio, e.tipo, e.estado, e.numero_guia, e.empacado_en, e.enviado_en, e.entregado_en, p.id_externo, e.costo_cotizado,
         q.nombre paqueteria, e.paqueteria_id
  from envios e left join pedidos p on p.id = e.pedido_id left join clientes c on c.id = p.cliente_id
  left join paqueterias q on q.id = e.paqueteria_id
  where c.nombre like 'DEMO ENV %' or (e.tipo = 'a_full' and e.notas like 'DEMO%')`);
const porVenta = (v) => envios.find((e) => e.id_externo === v);
const checklist = (await db.query("select id from checklist_salida where activo")).rows.map((r) => r.id);
let semilla = 1;

// 1. Guías con su PDF (las genera ventas en línea).
const guias = [["2000009100001", "MEL-44100017-DEMO"], ["2000009100004", "7055 0921 4410 DEMO"], ["2000009100005", "7055 0921 4433 DEMO"], ["2000009100006", "FX 7781 2203 DEMO"]];
for (const [venta, numero] of guias) {
  const e = porVenta(venta);
  if (!e || e.numero_guia) continue;
  const ruta = await subir(susana, `envios/${e.id}/guia-${numero.replace(/\W+/g, "")}.pdf`,
    pdfGuia([`Guia ${e.paqueteria} ${numero}`, `Envio ${e.folio}`, "Documento de demostracion: no es una guia real.", "Hegamex - Carretera Atotonilco-La Barca 151"]), "application/pdf");
  await ok(susana.rpc("registrar_guia", { p_envio: e.id, p_numero: numero, p_ruta: ruta, p_costo: e.costo_cotizado ?? 0, p_paqueteria: e.paqueteria_id }), `guía ${e.folio}`);
  console.log("guía", e.folio, numero);
}

// 2. Almacén empaca con fotos y check list (abierto con lo que lleva y cerrado con la etiqueta).
const aEmpacar = ["2000009100001", "2000009100004", "2000009100005", "2000009100006"].map(porVenta)
  .concat(envios.filter((e) => e.tipo === "recoge")).filter((e) => e && !e.empacado_en && e.estado !== "cancelado");
for (const e of aEmpacar) {
  for (const v of ["abierta", "cerrada"]) {
    const ruta = await subir(almacen, `envios/${e.id}/${v}-${semilla}.png`, foto(v, semilla++), "image/png");
    await ok(almacen.rpc("agregar_archivo_envio", { p_ruta: ruta, p_tipo: "empaque", p_envio: e.id, p_nota: v === "abierta" ? "Abierto, con lo que lleva" : "Cerrado y etiquetado" }), `foto ${e.folio}`);
  }
  // El check list completo que aplica (la base revisa cuál).
  await ok(almacen.rpc("marcar_empacado", { p_envio: e.id, p_checklist: checklist, p_series: {} }), `empacar ${e.folio}`);
  console.log("empacado", e.folio);
}

// 3. Salen (almacén) y se entregan (la vendedora confirma con el comprador).
for (const v of ["2000009100001", "2000009100004", "2000009100005", "2000009100006"]) {
  const e = porVenta(v);
  if (!e || e.enviado_en) continue;
  await ok(almacen.rpc("marcar_enviado", { p_envio: e.id }), `salida ${e.folio}`);
  if (v !== "2000009100001") await ok(susana.rpc("marcar_entregado", { p_envio: e.id, p_recibio: "El comprador (rastreo)" }), `entrega ${e.folio}`);
  console.log("salió", e.folio);
}

// 4. Postventa: un reclamo por vencer, una devolución que ya llegó y otra en camino.
const { rows: devs } = await db.query("select p.id_externo, d.tipo from devoluciones d join pedidos p on p.id = d.pedido_id where p.id_externo like '20000091000%'");
const tiene = (v, t) => devs.some((d) => d.id_externo === v && d.tipo === t);
const pedido = async (v) => (await db.query("select id from pedidos where id_externo = $1 and canal = 'mercadolibre'", [v])).rows[0]?.id;
if (!tiene("2000009100004", "reclamo")) {
  await ok(susana.rpc("abrir_devolucion", { p_pedido: await pedido("2000009100004"), p_tipo: "reclamo", p_motivo: "Dice que le llegó incompleta su compra (falta la cuña)",
    p_fecha_limite: new Date(Date.now() + 5 * 3_600_000).toISOString() }), "reclamo");
}
if (!tiene("2000009100005", "devolucion")) {
  const id = await ok(susana.rpc("abrir_devolucion", { p_pedido: await pedido("2000009100005"), p_tipo: "devolucion", p_motivo: "No es la medida de costal que necesitaba",
    p_codigo: "DEMO-DEV-58213" }), "devolución 5");
  const ruta = await subir(almacen, `devoluciones/${id}/llego-${semilla}.png`, foto("cerrada", semilla++), "image/png");
  await ok(almacen.rpc("agregar_archivo_envio", { p_ruta: ruta, p_tipo: "recepcion", p_devolucion: id, p_nota: "Así llegó: caja cerrada, sin golpes" }), "foto devolución");
  await ok(almacen.rpc("recibir_devolucion", { p_dev: id, p_nota: "Completa, con su manual; la caja viene abierta y vuelta a cerrar" }), "recibir");
}
if (!tiene("2000009100006", "devolucion")) {
  await ok(susana.rpc("abrir_devolucion", { p_pedido: await pedido("2000009100006"), p_tipo: "devolucion", p_motivo: "Una polea llegó con el cuñero mal hecho",
    p_codigo: "DEMO-DEV-58377", p_lineas: [{ pedido_linea_id: (await db.query("select pl.id from pedido_lineas pl join pedidos p on p.id = pl.pedido_id where p.id_externo = '2000009100006'")).rows[0].id, cantidad: 1 }] }), "devolución 6");
}

// 5. Fechas al pasado (solo la demostración): la evidencia y la línea de tiempo no se
// pueden cambiar por la app, así que se hace como superusuario, sin disparadores.
await db.query("begin");
await db.query("set local session_replication_role = replica");
const atras = [["2000009100004", 9, 5], ["2000009100005", 8, 4], ["2000009100006", 6, 3], ["2000009100001", 2, null]];
for (const [v, dias, entrega] of atras) {
  const e = porVenta(v); if (!e) continue;
  const corre = `- interval '${dias} days'`;
  await db.query(`update envios set solicitado_en = solicitado_en ${corre} - interval '4 hours', cotizado_en = cotizado_en ${corre} - interval '3 hours',
    guia_en = guia_en ${corre} - interval '2 hours', empacado_en = empacado_en ${corre} - interval '1 hour', enviado_en = enviado_en ${corre},
    entregado_en = ${entrega == null ? "entregado_en" : `now() - interval '${entrega} days'`} where id = $1 and empacado_en > now() - interval '12 hours'`, [e.id]);
  await db.query(`update evidencias_envio set en = en ${corre} - interval '1 hour' where envio_id = $1 and en > now() - interval '12 hours'`, [e.id]);
}
// Cada paso de la historia, a la hora del paso que registra.
await db.query(`update eventos_envio v set en = coalesce(case v.tipo when 'solicitado' then e.solicitado_en when 'cotizado' then e.cotizado_en
    when 'guia' then e.guia_en when 'empacado' then e.empacado_en when 'inventario' then e.enviado_en when 'enviado' then e.enviado_en + interval '1 second'
    when 'entregado' then e.entregado_en end, v.en)
  from envios e join pedidos p on p.id = e.pedido_id where e.id = v.envio_id and p.id_externo like '20000091000%'`);
await db.query(`update devoluciones d set creado_en = now() - interval '2 days', fecha_esperada = (now() at time zone 'America/Mexico_City')::date - 1,
  recibido_en = now() - interval '3 hours' from pedidos p where p.id = d.pedido_id and p.id_externo = '2000009100005' and d.creado_en > now() - interval '1 day'`);
await db.query("commit");

console.log("Listo: envíos DEMO con fotos, guías, salidas, un reclamo y dos devoluciones.");
await db.end();
