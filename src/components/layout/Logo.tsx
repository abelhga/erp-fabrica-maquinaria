import { cn } from "@/lib/utilidades";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_ANCHO_SIN_REGISTRO, LOGO_ENGRANE, LOGO_LETRAS, LOGO_REGISTRO } from "./logoTrazo";

/**
 * El logo oficial de Hegamex (engrane azul + letras), trazado en SVG para que no se pixele en la TV
 * ni en los impresos. Las letras toman el color del texto: negras en claro e impresos, blancas en
 * oscuro. La ® solo sale en grande; en el menú serían tres pixeles ilegibles.
 */
export function Logo({ className, grande }: { className?: string; grande?: boolean }) {
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
