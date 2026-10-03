import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utilidades";

// Boton con asChild falla (Slot recibe el spinner y el hijo como dos elementos),
// así que los enlaces con forma de botón se arman aquí con las mismas clases.
const BASE = "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors h-9 px-4 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/50";
const VARIANTES = {
  primario: "bg-marca text-white hover:bg-marca/90 shadow-sm",
  secundario: "bg-superficie border border-borde hover:bg-fondo text-texto",
};

export function BotonLink({ a, externo, variante = "secundario", children, className }: {
  a: string; externo?: boolean; variante?: keyof typeof VARIANTES; children: ReactNode; className?: string;
}) {
  const clase = cn(BASE, VARIANTES[variante], className);
  if (externo) return <a href={a} target="_blank" rel="noreferrer" className={clase}>{children}</a>;
  return <Link to={a} className={clase}>{children}</Link>;
}
