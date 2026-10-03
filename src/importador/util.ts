// Limpieza de lo que llega de las hojas. La API de Sheets entrega lo que se ve
// (valores con formato): "$1,050.00", "03/03/26", " $ 226,000.00 ", "12.00".

/** "$1,050.00" → 1050 · " $ 226,000.00 " → 226000 · "" → null · "#N/A" → null */
export function dinero(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$\s,]/g, "").replace(/MXN|USD/gi, "");
  if (s === "" || s.startsWith("#") || s === "-") return null;
  const n = Number(s.replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : null;
}

/** Números con comas de miles y, a veces, unidades pegadas: "1,234.5" → 1234.5 · "12 pzas" → 12 */
export function numero(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "" || s.startsWith("#")) return null;
  const m = s.match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Fechas de México: "03/03/26", "3/3/2026", "24/4/2024 13:00:00".
 * Años de dos dígitos → 20xx. Devuelve ISO "2026-03-03" (o con hora si la traía),
 * o null si no es una fecha razonable (la hoja de órdenes trae 2029 y 2035).
 */
export function fecha(v: unknown, opciones: { conHora?: boolean; maxAnio?: number } = {}): string | null {
  if (v == null) return null;
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = Number(m[1]), mes = Number(m[2]);
  let a = Number(m[3]);
  if (a < 100) a += 2000;
  if (mes < 1 || mes > 12 || d < 1 || d > 31 || a < 2000 || a > (opciones.maxAnio ?? new Date().getFullYear() + 1)) return null;
  const f = `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // Valida días imposibles (31/02).
  const prueba = new Date(f + "T12:00:00");
  if (prueba.getMonth() + 1 !== mes) return null;
  if (opciones.conHora && m[4]) return `${f}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}-06:00`;
  return opciones.conHora ? `${f}T12:00:00-06:00` : f;
}

/** Espacios de más y caracteres invisibles fuera. Es la llave por la que se ligan las hojas. */
export function limpiarNombre(v: unknown): string {
  return String(v ?? "").replace(/[​-‏‪-‮⁠﻿]/g, "").replace(/\s+/g, " ").trim();
}

/** Para comparar nombres entre hojas: sin acentos, minúsculas, sin espacios dobles. */
export function llave(v: unknown): string {
  return limpiarNombre(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const UNIDADES: Record<string, string> = {
  pieza: "pieza", piezas: "pieza", pza: "pieza", pzas: "pieza", pz: "pieza",
  metro: "metro", metros: "metro", mts: "metro", mt: "metro", m: "metro",
  cm: "cm", centimetro: "cm", centimetros: "cm",
  kilo: "kilo", kilos: "kilo", kg: "kilo",
  litro: "litro", litros: "litro", lt: "litro", lts: "litro",
  horas: "hora", hora: "hora", hrs: "hora",
  tramo: "tramo", tramos: "tramo", juego: "juego", juegos: "juego", caja: "caja", cajas: "caja",
  carga: "carga", cargas: "carga", servicio: "servicio", m2: "m2", pulgada: "pulgada", pulgadas: "pulgada",
  rollo: "rollo", par: "par", paquete: "paquete", galon: "galón", "galón": "galón", cubeta: "cubeta", kit: "kit",
};
/** "Pieza ", "mts", "Metro" → "pieza", "metro". Lo desconocido se deja en minúsculas. */
export function unidad(v: unknown): string {
  const k = llave(v);
  return UNIDADES[k] ?? (k || "pieza");
}

/** Link de Drive → enlace directo de imagen (lo mismo que hace la columna AG de EQUIPOS). */
export function imagen(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const id = s.match(/\/d\/([\w-]{20,})/)?.[1] ?? s.match(/[?&]id=([\w-]{20,})/)?.[1];
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w1000`;
  return /^https?:\/\/\S+\.(jpe?g|png|webp|gif)(\?\S*)?$/i.test(s) || s.includes("googleusercontent") ? s : null;
}

export function booleano(v: unknown): boolean {
  return ["true", "sí", "si", "x", "1", "verdadero"].includes(llave(v));
}

/** RFC válido del SAT o null. Quita espacios y guiones. */
export function rfc(v: unknown): string | null {
  const s = String(v ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(s) ? s : null;
}

export function telefono(v: unknown): string | null {
  const d = String(v ?? "").replace(/[^\d+]/g, "");
  return d.replace(/\D/g, "").length >= 8 ? d : null;
}

export function correo(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function celda(fila: unknown[] | undefined, i: number): string {
  return limpiarNombre(fila?.[i]);
}
