import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

/** Búsqueda tolerante: sin acentos, sin mayúsculas, todas las palabras en cualquier orden. */
export function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
export function coincide(texto: string, consulta: string) {
  const t = normalizar(texto);
  return normalizar(consulta).split(/\s+/).filter(Boolean).every((p) => t.includes(p));
}
