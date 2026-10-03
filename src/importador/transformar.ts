// Convierte las filas de cada hoja (lo que devuelve la API de Sheets: string[][])
// en registros limpios. Sin base de datos ni red: se prueba con filas reales.
//
// Las columnas se buscan por su ENCABEZADO, no por posición: si alguien mueve
// una columna en la hoja, el importador lo nota en vez de cargar datos cruzados.
import { booleano, celda, correo, dinero, fecha, imagen, limpiarNombre, llave, numero, rfc, telefono, unidad } from "./util";

export type Filas = string[][];

/** Ubica columnas por encabezado. Lanza error si falta una obligatoria. */
export function columnas<K extends string>(encabezado: string[], buscar: Record<K, RegExp>, opcionales: NoInfer<K>[] = []): Record<K, number> {
  const r = {} as Record<K, number>;
  const norm = encabezado.map((h) => llave(h));
  for (const k of Object.keys(buscar) as K[]) {
    const i = norm.findIndex((h) => buscar[k].test(h));
    if (i < 0 && !opcionales.includes(k)) throw new Error(`No encontré la columna "${k}" (${buscar[k]}) en: ${encabezado.join(" | ")}`);
    r[k] = i;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Proveedores ("Directorio Proveedores", encabezado en la fila 2)
// ---------------------------------------------------------------------------
export interface Proveedor {
  llave: string; nombre: string; categoria: string | null; telefono: string | null; contacto: string | null;
  correo: string | null; rfc: string | null; domicilio: string | null; pais: string; es_importacion: boolean;
  dias_credito: number; notas: string | null;
}
export function proveedores(v: Filas): Proveedor[] {
  const c = columnas(v[1], {
    nombre: /^nombre$/, tipo: /^tipo de proveedor/, tel: /^telefono$/, contacto: /^contacto 1$/, correo: /^correo electronico contacto 1/,
    celular: /^celular contacto 1/, domicilio: /^domicilio/, municipio: /^municipio/, estado: /^estado$/, pais: /^pais$/, rfc: /^rfc$/,
    notas: /^notas$/, credito: /^dias de credito/,
  }, ["credito", "notas"]);
  const vistos = new Map<string, Proveedor>();
  for (const f of v.slice(2)) {
    const nombre = celda(f, c.nombre);
    if (!nombre) continue;
    const pais = celda(f, c.pais) || "México";
    const p: Proveedor = {
      llave: llave(nombre), nombre, categoria: celda(f, c.tipo) || null,
      telefono: telefono(f[c.tel]) ?? telefono(f[c.celular]), contacto: celda(f, c.contacto) || null,
      correo: correo(f[c.correo]), rfc: rfc(f[c.rfc]),
      domicilio: [celda(f, c.domicilio), celda(f, c.municipio), celda(f, c.estado)].filter(Boolean).join(", ") || null,
      pais, es_importacion: !/mexico/.test(llave(pais)) && pais !== "",
      dias_credito: c.credito >= 0 ? numero(f[c.credito]) ?? 0 : 0, notas: c.notas >= 0 ? celda(f, c.notas) || null : null,
    };
    if (!vistos.has(p.llave)) vistos.set(p.llave, p);
  }
  return [...vistos.values()];
}

// ---------------------------------------------------------------------------
// Componentes ("ListaComponentes", encabezado en la fila 2)
// ---------------------------------------------------------------------------
export interface Componente {
  llave: string; nombre: string; unidad: string; empaque: number; numero_item: string | null;
  costo: number | null; precio_hoja: number | null; fecha_costo: string | null; proveedor: string | null;
  dias_entrega: number | null; descripcion: string | null; imagen: string | null; utilidad_personalizada: number | null;
  es_mano_obra: boolean; fila: number;
}
const MANO_OBRA = /^horas? hombre/;
export function componentes(v: Filas): { componentes: Componente[]; duplicados: string[] } {
  const c = columnas(v[1], {
    nombre: /^componente$/, unidad: /^unidad de medida/, paquete: /cantidad minima/, item: /^numero de item/,
    costo: /^ultimo costo/, precio: /^precio de venta sugerido/, fecha: /^fecha de actualizacion/, proveedor: /^proveedor del ultimo/,
    dias: /^tiempo estimado de entrega/, desc: /^descripcion/, img: /^imagen/, conv: /^link convertido/, ut: /^ut\. personalizada/,
  }, ["img", "conv", "ut", "paquete"]);
  const vistos = new Map<string, Componente>();
  const duplicados: string[] = [];
  v.slice(2).forEach((f, i) => {
    const nombre = celda(f, c.nombre);
    if (!nombre) return;
    const k = llave(nombre);
    const utp = c.ut >= 0 ? numero(String(f[c.ut] ?? "").replace("%", "")) : null;
    const comp: Componente = {
      llave: k, nombre, unidad: unidad(f[c.unidad]),
      empaque: Math.max(numero(f[c.paquete]) ?? 1, 0.001) || 1,
      numero_item: celda(f, c.item) || null,
      costo: dinero(f[c.costo]), precio_hoja: dinero(f[c.precio]), fecha_costo: fecha(f[c.fecha]),
      proveedor: celda(f, c.proveedor) || null, dias_entrega: numero(f[c.dias]),
      descripcion: celda(f, c.desc) ? String(f[c.desc]).trim() : null,
      imagen: (c.conv >= 0 ? imagen(f[c.conv]) : null) ?? (c.img >= 0 ? imagen(f[c.img]) : null),
      utilidad_personalizada: utp != null ? (utp > 1 ? utp / 100 : utp) : null,
      es_mano_obra: etapaDeManoObra(nombre) != null, fila: i + 3,
    };
    if (vistos.has(k)) duplicados.push(nombre);
    else vistos.set(k, comp);
  });
  return { componentes: [...vistos.values()], duplicados };
}

/**
 * Las 4 "horas hombre" que usan las listas de materiales son tarifas por etapa en
 * el ERP. Otras ("Horas hombre Extras" a $8, "habilitado" sin costo) NO: si se
 * mandaban a pailería por descarte, pisaban su tarifa de $87.67 y todos los
 * equipos salían baratos (lo encontró la validación contra Nuevo Costeo).
 */
export function etapaDeManoObra(nombre: string): string | null {
  const k = llave(nombre);
  if (!MANO_OBRA.test(k)) return null;
  if (k.includes("paileria")) return "Pailería";
  if (k.includes("tornero")) return "Torno";
  if (k.includes("pintor")) return "Pintura";
  if (k.includes("detallado")) return "Detallado";
  return null;
}

// Materia prima = acero y similares; se compra por pieza/metro pero no se revende como refacción.
const MATERIA_PRIMA = /^(lamina|placa|ptr|angulo|solera|tubo|canal|redondo|viga|polin|cuadrado|barra|perfil|monten|varilla|malla|rejilla)\b/;
export function tipoComponente(nombre: string, unidadTxt: string): "componente" | "materia_prima" | "servicio" {
  const k = llave(nombre);
  if (unidadTxt === "servicio" || /^(servicio|flete|vulcaniz|calibracion|puesta en marcha|maniobra|grua|horas? hombre)/.test(k)) return "servicio";
  if (MATERIA_PRIMA.test(k)) return "materia_prima";
  return "componente";
}

// ---------------------------------------------------------------------------
// Historial de precios ("ACTUALIZACIONES", encabezado en la fila 6)
// ---------------------------------------------------------------------------
export interface PrecioHistorico { fecha: string; llave: string; nombre: string; costo: number; proveedor: string | null; nota: string | null; fila: number }
export function actualizaciones(v: Filas): { precios: PrecioHistorico[]; descartadas: number } {
  const fe = v.findIndex((f) => llave(f[0]).startsWith("fecha del precio"));
  const c = columnas(v[fe], { fecha: /^fecha del precio/, comp: /^componente$/, costo: /^costo sin iva/, prov: /^proveedor/, nota: /^nota$/ }, ["nota"]);
  const precios: PrecioHistorico[] = [];
  let descartadas = 0;
  v.slice(fe + 1).forEach((f, i) => {
    const nombre = celda(f, c.comp);
    const fch = fecha(f[c.fecha]);
    const costo = dinero(f[c.costo]);
    if (!nombre || !fch || costo == null || costo < 0) { if (nombre) descartadas++; return; }
    precios.push({ fecha: fch, llave: llave(nombre), nombre, costo, proveedor: celda(f, c.prov) || null,
      nota: c.nota >= 0 ? celda(f, c.nota) || null : null, fila: fe + i + 2 });
  });
  return { precios, descartadas };
}

// ---------------------------------------------------------------------------
// Equipos ("EQUIPOS" de Nuevo Costeo, encabezado en la fila 2)
// ---------------------------------------------------------------------------
export interface Equipo {
  clave: string; nombre: string; tipo: string; medida_especial: boolean; descripcion: string | null;
  imagen: string | null; costo_hoja: number | null; precio_hoja: number | null; notas: string | null;
}
export function equipos(v: Filas): Equipo[] {
  const c = columnas(v[1], {
    id: /^id$/, nombre: /^titulo del equipo/, tipo: /^tipo$/, especial: /^¿medida especial|^medida especial/,
    desc: /^descripcion$/, img: /^imagen \(link/, costo: /^costo$/, precio: /^precio de lista bruto/, notas: /^notas$/,
    conv: /^link imagen convertida/,
  }, ["notas", "conv", "img"]);
  const r: Equipo[] = [];
  for (const f of v.slice(2)) {
    const clave = celda(f, c.id).toUpperCase();
    const nombre = celda(f, c.nombre);
    if (!/^E-\d+$/.test(clave) || !nombre || clave === "E-000") continue;
    r.push({
      clave, nombre, tipo: celda(f, c.tipo) || "OTRO", medida_especial: llave(f[c.especial]) === "si",
      descripcion: celda(f, c.desc) ? String(f[c.desc]).trim() : null,
      imagen: (c.conv >= 0 ? imagen(f[c.conv]) : null) ?? (c.img >= 0 ? imagen(f[c.img]) : null),
      costo_hoja: dinero(f[c.costo]), precio_hoja: dinero(f[c.precio]), notas: c.notas >= 0 ? celda(f, c.notas) || null : null,
    });
  }
  return r;
}

// ---------------------------------------------------------------------------
// Lista de materiales ("BASE EQUIPOS", encabezado en la fila 3)
// ---------------------------------------------------------------------------
export interface LineaBom { equipo: string; material: string; llave: string; cantidad: number | null; unidad: string; costo_hoja: number | null; fila: number }
export function baseEquipos(v: Filas): LineaBom[] {
  const fe = v.findIndex((f) => llave(f[0]) === "id" && llave(f[2]) === "material");
  const c = columnas(v[fe], { id: /^id$/, material: /^material$/, cantidad: /^cantidad$/, unidad: /^unidad$/, costo: /^costo unit/ });
  const r: LineaBom[] = [];
  v.slice(fe + 1).forEach((f, i) => {
    const equipo = celda(f, c.id).toUpperCase();
    const material = celda(f, c.material);
    if (!/^E-\d+$/.test(equipo) || equipo === "E-000" || !material) return;
    r.push({ equipo, material, llave: llave(material), cantidad: numero(f[c.cantidad]), unidad: unidad(f[c.unidad]),
      costo_hoja: dinero(f[c.costo]), fila: fe + i + 2 });
  });
  return r;
}

// ---------------------------------------------------------------------------
// Existencias ("Inventario" de 2025 - Inventario 2.0, encabezado en la fila 7)
// ---------------------------------------------------------------------------
// Las columnas de saldo por almacén tienen encabezado "1 - PA", "2 - PB"…; las de
// "Inventario inicial" están a su izquierda. RESERVADO es lo apartado: en el ERP
// se vuelve existencia física (en Planta Baja) más una reserva.
export const ALMACENES_HOJA: Record<string, string> = {
  "1 - pa": "Planta Alta", "2 - pb": "Planta Baja", "3 - m": "Mallado", "4 - c1": "Contenedor 1", "5- c2": "Contenedor 2",
  "5 - c2": "Contenedor 2", r: "Revolución", "6 - ml": "Almacén ML (Full)", "7 - r": "RESERVADO",
};
export interface Existencia { llave: string; nombre: string; unidad: string; concepto: string | null; por_almacen: Record<string, number>; seguridad: number | null; en_ml: boolean; fila: number }
export function inventario(v: Filas): Existencia[] {
  const fe = v.findIndex((f) => llave(f[1]) === "nombre del articulo");
  const enc = v[fe].map((h) => llave(h));
  const cols = Object.entries(ALMACENES_HOJA).map(([h, alm]) => [enc.indexOf(h), alm] as const).filter(([i]) => i >= 0);
  const c = columnas(v[fe], { nombre: /^nombre del articulo/, unidad: /^unidad$/, concepto: /^concepto$/, seguridad: /^inventario de seguridad/, ml: /^¿ml\?|^ml\?/ }, ["seguridad", "ml"]);
  // Un artículo repetido en Inventario muestra la MISMA existencia en ambas filas
  // (la hoja suma por nombre): se toma una sola fila, o se duplicaría el stock.
  const r: Existencia[] = [];
  const vistos = new Set<string>();
  v.slice(fe + 1).forEach((f, i) => {
    const nombre = celda(f, c.nombre);
    if (!nombre || vistos.has(llave(nombre))) return;
    vistos.add(llave(nombre));
    const por: Record<string, number> = {};
    for (const [idx, alm] of cols) {
      const n = numero(f[idx]);
      if (n) por[alm] = (por[alm] ?? 0) + n;
    }
    r.push({ llave: llave(nombre), nombre, unidad: unidad(f[c.unidad]), concepto: celda(f, c.concepto) || null, por_almacen: por,
      seguridad: c.seguridad >= 0 ? numero(f[c.seguridad]) : null, en_ml: c.ml >= 0 ? booleano(f[c.ml]) : false, fila: fe + i + 2 });
  });
  return r;
}

/** "Demanda" de Almacen Registros: empaque y días de entrega capturados a mano. */
export function demanda(v: Filas): Map<string, { empaque: number | null; dias: number | null }> {
  const fe = v.findIndex((f) => llave(f[1]) === "nombre del articulo");
  const c = columnas(v[fe], { nombre: /^nombre del articulo/, paquete: /^cantidad por paquete/, dias: /^dias que tarda/ });
  const m = new Map<string, { empaque: number | null; dias: number | null }>();
  for (const f of v.slice(fe + 1)) {
    const nombre = celda(f, c.nombre);
    if (nombre) m.set(llave(nombre), { empaque: numero(f[c.paquete]), dias: numero(f[c.dias]) });
  }
  return m;
}

// ---------------------------------------------------------------------------
// Movimientos ("Registro" de 2025 - Inventario 2.0; encabezado en la fila 12 de la parte 1)
// ---------------------------------------------------------------------------
export interface MovimientoHoja {
  fecha: string; nombre: string; llave: string; cantidad: number; tipo: string; almacen: string | null; personal: string | null;
  motivo: string | null; documento: string | null; proveedor: string | null; notas: string | null; merma: boolean; fila: number;
}
export function registro(partes: Filas[]): { movimientos: MovimientoHoja[]; descartados: number } {
  const p1 = partes[0];
  const fe = p1.findIndex((f) => llave(f[1]) === "fecha y hora");
  const c = columnas(p1[fe], {
    fecha: /^fecha y hora/, prod: /^producto/, cant: /^cantidad$/, tipo: /^tipo$/, alm: /^almacen$/, personal: /^personal$/,
    motivo: /^n\. de pedido/, doc: /^# factura/, prov: /^proveedor$/, notas: /^notas y comentarios/, merma: /^¿fue una merma/,
  }, ["merma", "notas"]);
  const movimientos: MovimientoHoja[] = [];
  let descartados = 0, fila = 0;
  partes.forEach((parte, pi) => {
    const filas = pi === 0 ? parte.slice(fe + 1) : parte;
    const base = pi === 0 ? fe + 2 : 1 + partes.slice(0, pi).reduce((s, x) => s + x.length, 0);
    filas.forEach((f, i) => {
      fila = base + i;
      const nombre = celda(f, c.prod);
      const fch = fecha(f[c.fecha], { conHora: true });
      const cant = numero(f[c.cant]);
      const tipo = celda(f, c.tipo).toUpperCase();
      if (!nombre || !fch || cant == null || !tipo) { if (nombre) descartados++; return; }
      movimientos.push({ fecha: fch, nombre, llave: llave(nombre), cantidad: Math.abs(cant), tipo, almacen: celda(f, c.alm) || null,
        personal: celda(f, c.personal) || null, motivo: celda(f, c.motivo) || null, documento: celda(f, c.doc) || null,
        proveedor: celda(f, c.prov) || null, notas: c.notas >= 0 ? celda(f, c.notas) || null : null,
        merma: c.merma >= 0 ? booleano(f[c.merma]) : false, fila });
    });
  });
  return { movimientos, descartados };
}

// ---------------------------------------------------------------------------
// Paneles de ventas (uno por vendedor)
// ---------------------------------------------------------------------------
export interface ClientePanel { llave: string; nombre: string; contactos: { nombre: string; correo: string | null; telefono: string | null }[]; estado: string | null; cp: string | null; pais: string | null; domicilio: string | null; ciudad: string | null; rfc: string | null }
export function clientesPanel(v: Filas): ClientePanel[] {
  const e = v[0];
  const c = columnas(e, {
    nombre: /^nombre del cliente/, c1: /^contacto 1$/, m1: /^correo electronico 1/, t1: /^celular 1/,
    c2: /^contacto 2/, m2: /^correo electronico 2/, t2: /^celular 2/, cp: /^cp$/, pais: /^pais$/, dom: /^domicilio/, mun: /^municipio/, rfc: /^rfc/,
  });
  // La columna de estado se llama "ESTADO"… salvo en el panel de Isaac, donde alguien escribió "Coahuila de Zaragoza" encima.
  const iEstado = 7;
  const r = new Map<string, ClientePanel>();
  for (const f of v.slice(1)) {
    const nombre = celda(f, c.nombre);
    if (!nombre) continue;
    const contactos = [[c.c1, c.m1, c.t1], [c.c2, c.m2, c.t2]]
      .map(([n, m, t]) => ({ nombre: celda(f, n), correo: correo(f[m]), telefono: telefono(f[t]) }))
      .filter((x) => x.nombre || x.correo || x.telefono)
      .map((x) => ({ ...x, nombre: x.nombre || "Contacto" }));
    const k = llave(nombre);
    if (!r.has(k)) r.set(k, { llave: k, nombre, contactos, estado: celda(f, iEstado) || null, cp: celda(f, c.cp) || null,
      pais: celda(f, c.pais) || null, domicilio: celda(f, c.dom) || null, ciudad: celda(f, c.mun) || null, rfc: rfc(f[c.rfc]) });
  }
  return [...r.values()];
}

export interface VentaPanel { fecha: string; cliente: string; llave_cliente: string; concepto: string; linea: "maquinaria" | "refacciones" | "otros"; monto: number; fuente: string | null; cotizacion: string | null; factura: string | null; pedido: string | null; notas: string | null; fila: number }
export function ventasPanel(v: Filas): { ventas: VentaPanel[]; descartadas: number } {
  const c = columnas(v[0], {
    fecha: /^fecha$/, cliente: /^cliente$/, concepto: /^concepto/, tipo: /^tipo$/, monto: /^monto bruto/, fuente: /^fuente de la venta/,
    cot: /cotizacion/, fact: /^factura/, ped: /^n\. pedido/, n1: /^nota 1/, n2: /^nota 2/,
  });
  const ventas: VentaPanel[] = [];
  let descartadas = 0;
  v.slice(1).forEach((f, i) => {
    const fch = fecha(f[c.fecha]);
    const monto = dinero(f[c.monto]);
    const cliente = celda(f, c.cliente);
    if (!fch || monto == null || !cliente) { if (cliente || monto) descartadas++; return; }
    const tipo = llave(f[c.tipo]);
    ventas.push({
      fecha: fch, cliente, llave_cliente: llave(cliente), concepto: celda(f, c.concepto) || "Venta",
      linea: tipo.startsWith("refacc") ? "refacciones" : tipo.startsWith("otro") ? "otros" : "maquinaria",
      monto, fuente: celda(f, c.fuente) || null, cotizacion: celda(f, c.cot) || null, factura: celda(f, c.fact) || null,
      pedido: celda(f, c.ped) || null, notas: [celda(f, c.n1), celda(f, c.n2)].filter(Boolean).join(" · ") || null, fila: i + 2,
    });
  });
  return { ventas, descartadas };
}

/** ListaDeDescripciones del cotizador: descripciones e imágenes que no están en el costeo. */
export function descripciones(v: Filas): Map<string, { descripcion: string | null; imagen: string | null }> {
  const fe = v.findIndex((f) => llave(f[1]) === "id" && llave(f[2]) === "nombre");
  const c = columnas(v[fe], { id: /^id$/, nombre: /^nombre$/, desc: /^descripcion$/, img: /^imagen$/ });
  const m = new Map<string, { descripcion: string | null; imagen: string | null }>();
  for (const f of v.slice(fe + 1)) {
    const nombre = celda(f, c.nombre);
    if (!nombre) continue;
    m.set(llave(nombre), { descripcion: celda(f, c.desc) ? String(f[c.desc]).trim() : null, imagen: imagen(f[c.img]) });
  }
  return m;
}

export { limpiarNombre, llave };

// ---------------------------------------------------------------------------
// "BASE DE DATOS ACTUAL HEGAMEX": directorio de clientes, CRM unificado y libro de ventas
// ---------------------------------------------------------------------------
export interface ClienteDirectorio {
  llave: string; nombre: string; rfc: string | null; telefono: string | null; ciudad: string | null; estado: string | null;
  pais: string | null; cp: string | null; domicilio: string | null; agente: string | null; notas: string | null;
  contactos: { nombre: string; correo: string | null; telefono: string | null }[];
}

function contactosDe(f: string[], pares: [number, number, number][]) {
  return pares.map(([n, m, t]) => ({ nombre: celda(f, n), correo: correo(f[m]), telefono: telefono(f[t]) }))
    .filter((x) => x.nombre || x.correo || x.telefono).map((x) => ({ ...x, nombre: x.nombre || "Contacto" }));
}

/** "Directorio Clientes" (encabezado en la fila 3, columna A vacía). */
export function directorioClientes(v: Filas): ClienteDirectorio[] {
  const fe = v.findIndex((f) => llave(f[1]) === "cliente / empresa");
  const c = columnas(v[fe], {
    nombre: /^cliente \/ empresa/, tel: /^telefono$/, c1: /^contacto 1$/, m1: /^correo electronico contacto 1/, t1: /^celular contacto 1/,
    c2: /^contacto 2$/, m2: /^correo electronico contacto 2/, t2: /^celular contacto 2/, dom: /^domicilio/, mun: /^municipio/, cp: /^cp$/,
    estado: /^estado$/, pais: /^pais$/, rfc: /^rfc$/, notas: /^notas$/, agente: /^agente de ventas/,
  });
  const r = new Map<string, ClienteDirectorio>();
  for (const f of v.slice(fe + 1)) {
    const nombre = celda(f, c.nombre);
    if (!nombre || r.has(llave(nombre))) continue;
    r.set(llave(nombre), {
      llave: llave(nombre), nombre, rfc: rfc(f[c.rfc]), telefono: telefono(f[c.tel]), ciudad: celda(f, c.mun) || null,
      estado: celda(f, c.estado) || null, pais: celda(f, c.pais) || null, cp: celda(f, c.cp) || null,
      domicilio: celda(f, c.dom) || null, agente: celda(f, c.agente) || null, notas: celda(f, c.notas) || null,
      contactos: contactosDe(f, [[c.c1, c.m1, c.t1], [c.c2, c.m2, c.t2]]),
    });
  }
  return [...r.values()];
}

/** 'Clientes-Contacto Unified': sin encabezado; columnas A–P en el orden del CRM (ver docs/analisis/04-cotizador.md §2.5). */
export function clientesUnified(v: Filas): ClienteDirectorio[] {
  const r = new Map<string, ClienteDirectorio>();
  for (const f of v) {
    const nombre = celda(f, 0);
    if (!nombre || r.has(llave(nombre))) continue;
    r.set(llave(nombre), {
      llave: llave(nombre), nombre, rfc: null, telefono: telefono(f[1]) ?? telefono(f[2]), ciudad: celda(f, 10) || null,
      estado: celda(f, 12) || null, pais: celda(f, 13) || null, cp: celda(f, 11) || null, domicilio: celda(f, 9) || null,
      agente: celda(f, 15) || null, notas: null, contactos: contactosDe(f, [[3, 4, 5], [6, 7, 8]]),
    });
  }
  return [...r.values()];
}

export interface MovimientoVenta { fecha: string; cliente: string; llave_cliente: string; tipo: string; monto: number; cuenta: string | null; descripcion: string | null; factura: string | null; pedido: string | null; fila: number }
/** Pestaña VENTAS (encabezado en la fila 12): Venta / Pago / Reembolso por cliente y fecha. */
export function libroVentas(v: Filas): { movimientos: MovimientoVenta[]; descartados: number } {
  const fe = v.findIndex((f) => llave(f[1]) === "fecha" && llave(f[3]) === "tipo");
  const c = columnas(v[fe], { fecha: /^fecha$/, cliente: /^cliente/, tipo: /^tipo$/, monto: /^monto neto/, cuenta: /^cuenta receptora/,
    desc: /^descripcion/, fact: /^n\. factura/, ped: /^n\. pedido/ });
  const movimientos: MovimientoVenta[] = [];
  let descartados = 0;
  v.slice(fe + 1).forEach((f, i) => {
    const fch = fecha(f[c.fecha]);
    const monto = dinero(f[c.monto]);
    const cliente = celda(f, c.cliente);
    const tipo = celda(f, c.tipo);
    if (!fch || monto == null || !cliente || !tipo) { if (cliente) descartados++; return; }
    const nulo = (x: string) => (x && x !== "-" ? x : null);
    movimientos.push({ fecha: fch, cliente, llave_cliente: llave(cliente), tipo, monto, cuenta: nulo(celda(f, c.cuenta)),
      descripcion: nulo(celda(f, c.desc)), factura: nulo(celda(f, c.fact)), pedido: nulo(celda(f, c.ped)), fila: fe + i + 2 });
  });
  return { movimientos, descartados };
}
