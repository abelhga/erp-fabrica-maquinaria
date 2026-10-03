// Todo lo que ve el usuario va en formato de México: $1,234.56, 03/oct/2026.
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const usd = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const compacto = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const fechaCorta = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fechaHora = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const dinero = (n: number | null | undefined, moneda: "MXN" | "USD" = "MXN") =>
  n == null || Number.isNaN(n) ? "—" : (moneda === "USD" ? usd : mxn).format(n);

export const numero = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : num.format(n));

export const dineroCompacto = (n: number | null | undefined) =>
  n == null ? "—" : "$" + compacto.format(n);

export const porcentaje = (n: number | null | undefined, decimales = 1) =>
  n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(decimales)}%`;

/** Las fechas `date` de Postgres llegan como "2026-10-03"; sin la hora local, `new Date` las corre un día. */
function aFecha(f: string | Date) {
  if (f instanceof Date) return f;
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(f + "T12:00:00") : new Date(f);
}

export const fecha = (f: string | Date | null | undefined) => (f ? fechaCorta.format(aFecha(f)) : "—");
export const fechaYHora = (f: string | Date | null | undefined) => (f ? fechaHora.format(aFecha(f)) : "—");

export function hace(f: string | Date | null | undefined) {
  if (!f) return "—";
  const dias = Math.round((Date.now() - aFecha(f).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${Math.round(meses / 12)} años`;
}

export const hoyISO = () => new Date().toLocaleDateString("en-CA");
