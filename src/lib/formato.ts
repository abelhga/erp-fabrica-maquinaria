// Todo lo que ve el usuario va en formato de México: $1,234.56, 03/oct/2026.
// Fechas y horas siempre en la hora de la planta, no la del aparato: la pantalla del
// taller o una laptop que se quedó en otra zona mostraban "mañana" desde las 6 de la tarde.
const ZONA = "America/Mexico_City";
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const usd = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const compacto = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const fechaCorta = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: ZONA });
const fechaHora = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONA });

export const dinero = (n: number | null | undefined, moneda: "MXN" | "USD" = "MXN") =>
  n == null || Number.isNaN(n) ? "—" : (moneda === "USD" ? usd : mxn).format(n);

export const numero = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : num.format(n));

export const dineroCompacto = (n: number | null | undefined) =>
  n == null ? "—" : "$" + compacto.format(n);

export const porcentaje = (n: number | null | undefined, decimales = 1) =>
  n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(decimales)}%`;

/** Las fechas `date` de Postgres llegan como "2026-10-03"; sin hora, `new Date` las toma a medianoche UTC y
 * en México se ven un día antes. Mediodía de la planta (sin horario de verano desde 2022) cae el mismo día. */
function aFecha(f: string | Date) {
  if (f instanceof Date) return f;
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(f + "T12:00:00-06:00") : new Date(f);
}

export const fecha = (f: string | Date | null | undefined) => (f ? fechaCorta.format(aFecha(f)) : "—");
export const fechaYHora = (f: string | Date | null | undefined) => (f ? fechaHora.format(aFecha(f)) : "—");

export function hace(f: string | Date | null | undefined) {
  if (!f) return "—";
  const ms = Date.now() - aFecha(f).getTime();
  // Con hora (un aviso, un movimiento) lo de hoy se dice en minutos u horas; una fecha sola es "hoy".
  const conHora = f instanceof Date || !/^\d{4}-\d{2}-\d{2}$/.test(f);
  if (conHora && ms < 86_400_000) {
    const min = Math.max(0, Math.round(ms / 60_000));
    return min < 1 ? "ahora" : min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
  }
  const dias = Math.round(ms / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  const anios = Math.round(meses / 12);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

export const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
