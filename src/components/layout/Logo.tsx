import { Factory } from "lucide-react";
import { cn } from "@/lib/utilidades";
import { EMPRESA, LOGO_GENERICO, PRODUCTO } from "@/lib/marca";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_ANCHO_SIN_REGISTRO, LOGO_ENGRANE, LOGO_LETRAS, LOGO_REGISTRO } from "./logoTrazo";

/**
 * El logo oficial de Hegamex (engrane azul + letras), trazado en SVG para que no se pixele en la TV
 * ni en los impresos. Las letras toman el color del texto: negras en claro e impresos, blancas en
 * oscuro. La ® solo sale en grande; en el menú serían tres pixeles ilegibles.
 * Construido con VITE_LOGO=generico (la demostración) es una fábrica, el nombre de la empresa y,
 * abajo, el del ERP (VITE_PRODUCTO):
 * el logo de Hegamex (engrane azul) es una marca registrada y no se le presta a nadie; por eso
 * el genérico no es un engrane.
 */
export function Logo({ className, grande }: { className?: string; grande?: boolean }) {
  if (LOGO_GENERICO) {
    return (
      <div className={cn("flex items-center gap-2 select-none", className)} role="img" aria-label={EMPRESA}>
        <Factory className={cn("shrink-0 text-marca", grande ? "h-10 w-10" : "h-7 w-7")} strokeWidth={2.2} />
        <span className="flex flex-col leading-tight min-w-0">
          <span className={cn("font-semibold tracking-tight truncate", grande ? "text-2xl" : "text-[15px]")}>{EMPRESA}</span>
          {PRODUCTO && <span className={cn("text-tenue tracking-wide", grande ? "text-sm" : "text-[11px]")}>{PRODUCTO}</span>}
        </span>
      </div>
    );
  }
  const ancho = grande ? LOGO_ANCHO : LOGO_ANCHO_SIN_REGISTRO;
  return (
    <div className={cn("flex items-center select-none", className)}>
      <svg viewBox={`0 0 ${ancho} ${LOGO_ALTO}`} className={cn("w-auto shrink-0", grande ? "h-10" : "h-6")} role="img" aria-label="Hegamex">
        <path fill="#0079fe" fillRule="evenodd" d={LOGO_ENGRANE} />
        <path fill="currentColor" fillRule="evenodd" d={LOGO_LETRAS} />
        {grande && <path fill="currentColor" fillRule="evenodd" d={LOGO_REGISTRO} />}
      </svg>
    </div>
  );
}
