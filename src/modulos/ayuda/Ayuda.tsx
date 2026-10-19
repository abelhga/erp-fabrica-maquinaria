// Los manuales de uso, dentro del ERP. Cada quien ve los de su trabajo; el menú los filtra
// por comodidad (los archivos no llevan nada que no deba leer cualquiera con sesión).
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Ship, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { useSesion } from "@/lib/sesion";
import { MANUALES, type ClaveManual, type Manual } from "./manuales";

export const ICONO_MANUAL: Record<ClaveManual, LucideIcon> = { general: BookOpen, importaciones: Ship, finanzas: Wallet, susana: UserRound };

/** Quién ve cada manual en la lista. Mismo criterio que el menú de cada módulo. */
export function veManual(m: Manual, s: Pick<ReturnType<typeof useSesion>, "puede" | "tieneRol">) {
  if (m.clave === "importaciones") return s.puede("importaciones", 1);
  if (m.clave === "finanzas") return s.puede("finanzas", 1);
  if (m.clave === "susana") return s.tieneRol("administracion") || s.tieneRol("direccion");
  return true;
}

export default function Ayuda() {
  const sesion = useSesion();
  const mios = MANUALES.filter((m) => veManual(m, sesion));
  return (
    <Pagina titulo="Manuales" descripcion="Cómo se usa el ERP, paso a paso y con prácticas que no guardan nada.">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {mios.map((m) => {
          const Icono = ICONO_MANUAL[m.clave];
          return (
            <Link key={m.clave} to={`/ayuda/${m.clave}`}
              className="tarjeta p-5 flex gap-4 hover:border-marca/40 hover:shadow-md transition group">
              <span className="h-11 w-11 shrink-0 rounded-xl bg-marca-suave text-marca grid place-items-center"><Icono className="h-5 w-5" /></span>
              <span className="min-w-0 space-y-1">
                <span className="block font-semibold">{m.titulo}</span>
                <span className="block text-xs text-tenue">Para: {m.para}</span>
                <span className="block text-sm text-tenue">{m.descripcion}</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-marca-texto pt-1">
                  Abrir manual <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </Pagina>
  );
}
