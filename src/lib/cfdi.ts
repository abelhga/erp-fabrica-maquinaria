// Lector de facturas electrónicas (CFDI 3.3 y 4.0, el XML que timbra el SAT).
//
// Sin Claude ni servidor: el XML trae todo en atributos con nombre fijo, así que leerlo
// es determinista (a diferencia de un PDF). Con esto, registrar una compra es subir el
// XML: proveedor por RFC, folio, total, fecha y si es de contado (PUE) o a crédito (PPD).
// Se lee con expresiones regulares y no con DOMParser para que funcione igual en el
// navegador y en las pruebas.

export interface Cfdi {
  version: string | null;
  uuid: string | null;              // folio fiscal: no se repite nunca
  serie: string | null; folio: string | null;
  fecha: string | null;             // AAAA-MM-DD
  tipo: "I" | "E" | "P" | "T" | "N" | null;   // ingreso, egreso (nota de crédito), pago, traslado, nómina
  subtotal: number | null; total: number | null;
  moneda: string | null; tipoCambio: number | null;
  metodoPago: "PUE" | "PPD" | null; formaPago: string | null;
  emisor: { rfc: string | null; nombre: string | null };
  receptor: { rfc: string | null; nombre: string | null };
  conceptos: string[];
  /** Clave de producto o servicio del SAT de cada concepto, con su importe: de ahí se sugiere la categoría. */
  claves: { clave: string; importe: number }[];
  /** Complemento de pago (tipo P): cada pago y las facturas que liquida. */
  pagos: PagoCfdi[];
}
export interface PagoCfdi {
  fecha: string | null; formaPago: string | null; moneda: string | null; monto: number | null;
  doctos: { uuid: string; serie: string | null; folio: string | null; moneda: string | null; parcialidad: number | null; pagado: number | null; saldoInsoluto: number | null }[];
}

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decodificar = (t: string) => t.replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTIDADES[e]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Atributos de la primera etiqueta con ese nombre local (cualquier prefijo: cfdi:, tfd:…). */
function etiqueta(xml: string, nombre: string): Record<string, string> | null {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${nombre}\\b([^>]*)>`));
  if (!m) return null;
  const attrs: Record<string, string> = {};
  for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodificar(a[3] ?? a[4] ?? "");
  return attrs;
}
function todas(xml: string, nombre: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${nombre}\\b([^>]*)>`, "g"))].map((m) => {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodificar(a[3] ?? a[4] ?? "");
    return attrs;
  });
}
const num = (v: string | undefined) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const txt = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Lee el XML. Lanza error si no es un CFDI (así el aviso dice qué pasó, no "monto inválido"). */
export function leerCfdi(xml: string): Cfdi {
  const c = etiqueta(xml, "Comprobante");
  if (!c) throw new Error("Este archivo no es una factura electrónica (CFDI): no trae el comprobante del SAT.");
  const e = etiqueta(xml, "Emisor") ?? {};
  const r = etiqueta(xml, "Receptor") ?? {};
  const t = etiqueta(xml, "TimbreFiscalDigital") ?? {};
  const metodo = txt(c.MetodoPago)?.toUpperCase();
  const tipo = txt(c.TipoDeComprobante)?.toUpperCase();
  return {
    version: txt(c.Version ?? c.version),
    uuid: txt(t.UUID)?.toUpperCase() ?? null,
    serie: txt(c.Serie), folio: txt(c.Folio),
    fecha: txt(c.Fecha)?.slice(0, 10) ?? null,
    tipo: tipo && ["I", "E", "P", "T", "N"].includes(tipo) ? (tipo as Cfdi["tipo"]) : null,
    subtotal: num(c.SubTotal), total: num(c.Total),
    moneda: txt(c.Moneda), tipoCambio: num(c.TipoCambio),
    metodoPago: metodo === "PUE" || metodo === "PPD" ? metodo : null,
    formaPago: txt(c.FormaPago),
    emisor: { rfc: txt(e.Rfc)?.toUpperCase() ?? null, nombre: txt(e.Nombre) },
    receptor: { rfc: txt(r.Rfc)?.toUpperCase() ?? null, nombre: txt(r.Nombre) },
    conceptos: todas(xml, "Concepto").map((k) => txt(k.Descripcion)).filter((x): x is string => !!x),
    claves: todas(xml, "Concepto").map((k) => ({ clave: txt(k.ClaveProdServ) ?? "", importe: num(k.Importe) ?? 0 })).filter((k) => /^\d{8}$/.test(k.clave)),
    pagos: leerPagos(xml),
  };
}

/** Cada concepto con su detalle (para la historia: qué se compró, cuánto y a qué precio). */
export interface ConceptoCfdi { clave: string | null; codigo: string | null; descripcion: string | null; cantidad: number | null; unidad: string | null; importe: number | null }
export function conceptosCfdi(xml: string): ConceptoCfdi[] {
  return todas(xml, "Concepto").map((k) => ({
    clave: txt(k.ClaveProdServ), codigo: txt(k.NoIdentificacion), descripcion: txt(k.Descripcion),
    cantidad: num(k.Cantidad), unidad: txt(k.Unidad) ?? txt(k.ClaveUnidad), importe: num(k.Importe),
  }));
}

/**
 * Los pagos de un complemento de pago (pago10 o pago20). "Pago" seguido de otra letra
 * ("Pagos", "PagoTotales") es otra etiqueta: por eso el \b.
 */
function leerPagos(xml: string): PagoCfdi[] {
  return [...xml.matchAll(/<(?:[\w-]+:)?Pago\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?Pago>/g)].map((m) => {
    const a = etiqueta(`<Pago ${m[1]}>`, "Pago") ?? {};
    return {
      fecha: txt(a.FechaPago)?.slice(0, 10) ?? null, formaPago: txt(a.FormaDePagoP), moneda: txt(a.MonedaP), monto: num(a.Monto),
      doctos: todas(m[2], "DoctoRelacionado").filter((d) => txt(d.IdDocumento)).map((d) => ({
        uuid: txt(d.IdDocumento)!.toUpperCase(), serie: txt(d.Serie), folio: txt(d.Folio), moneda: txt(d.MonedaDR),
        parcialidad: num(d.NumParcialidad), pagado: num(d.ImpPagado), saldoInsoluto: num(d.ImpSaldoInsoluto),
      })),
    };
  });
}

/** Forma de pago del SAT → método de cobro del ERP. */
export function metodoDeFormaPago(forma: string | null): string {
  return ({ "01": "efectivo", "02": "cheque", "03": "transferencia", "04": "tarjeta", "28": "tarjeta" } as Record<string, string>)[forma ?? ""] ?? "otro";
}

/** "A 3354" o solo el folio; el UUID corto si la factura no trae folio. */
export const folioCfdi = (c: Cfdi) => [c.serie, c.folio].filter(Boolean).join(" ") || (c.uuid ? c.uuid.slice(0, 8) : null);

const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
/** El UUID solo vale completo: uno mal leído de un PDF dejaría pasar la factura dos veces. */
export const uuidValido = (u: string | null | undefined) => !!u && UUID.test(u.trim().toUpperCase());
/**
 * Lo mismo que hace la base al guardar: el PDF del SAT trae guiones tipográficos (‐) y a veces
 * caracteres invisibles, y copiado de ahí el UUID se veía bien pero no pasaba. Así el aviso de
 * la pantalla dice lo mismo que la base.
 */
export function limpiarUuid(u: string) {
  const v = u.replace(/[‐‑‒–—―−]/g, "-").replace(/[^0-9A-Za-z-]/g, "").toUpperCase();
  return /^[0-9A-F]{32}$/.test(v) ? [v.slice(0, 8), v.slice(8, 12), v.slice(12, 16), v.slice(16, 20), v.slice(20)].join("-") : v;
}

/**
 * Lo que Claude leyó de un PDF o una foto de factura, en la misma forma que el XML, para que
 * el resto (proveedor por RFC, duplicados, contado o crédito, nota de crédito) sea igual.
 * No es exacto como el XML: quien registra lo revisa antes de guardar.
 */
export function cfdiDeLectura(c: Record<string, unknown>): Cfdi {
  const t = (k: string) => (typeof c[k] === "string" && (c[k] as string).trim() ? (c[k] as string).trim() : null);
  const n = (k: string) => (typeof c[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : null);
  const rfc = (k: string) => t(k)?.toUpperCase().replace(/[\s-]/g, "") ?? null;
  const tipo = t("tipo_comprobante");
  const metodo = t("metodo_pago");
  const uuid = t("uuid")?.toUpperCase() ?? null;
  return {
    version: null,
    uuid: uuidValido(uuid) ? uuid : null,
    serie: t("serie"), folio: t("folio"), fecha: t("fecha"),
    tipo: tipo === "I" || tipo === "E" || tipo === "P" || tipo === "T" || tipo === "N" ? tipo : null,
    subtotal: n("subtotal"), total: n("total"),
    moneda: t("moneda")?.toUpperCase() ?? null, tipoCambio: n("tipo_cambio"),
    metodoPago: metodo === "PUE" || metodo === "PPD" ? metodo : null, formaPago: null,
    emisor: { rfc: rfc("rfc_emisor"), nombre: t("nombre_emisor") },
    receptor: { rfc: rfc("rfc_receptor"), nombre: null },
    conceptos: Array.isArray(c.conceptos) ? (c.conceptos as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()) : [],
    // De un PDF no se confía en la clave del SAT: un dígito mal leído sugeriría otra cosa.
    claves: [],
    pagos: [],
  };
}
