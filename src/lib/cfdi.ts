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
  };
}

/** "A 3354" o solo el folio; el UUID corto si la factura no trae folio. */
export const folioCfdi = (c: Cfdi) => [c.serie, c.folio].filter(Boolean).join(" ") || (c.uuid ? c.uuid.slice(0, 8) : null);
