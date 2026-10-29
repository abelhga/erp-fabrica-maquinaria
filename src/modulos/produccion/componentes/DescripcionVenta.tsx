import { useState } from "react";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Lo que se le cotizó al cliente en esa partida (calibres, motor, acabado), sin precio.
 * Las largas se abren con un clic para que el pedido no se vuelva una pared de texto.
 */
export function DescripcionVenta({ texto, className }: { texto: string | null | undefined; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  if (!texto?.trim()) return null;
  const larga = texto.split("\n").length > 4 || texto.length > 280;
  return (
    <div className={cn("mt-2 rounded-md bg-fondo px-3 py-2 text-xs", className)} data-explain={GLOSARIO.descripcionVenta} data-explain-title="Lo que se vendió">
      <p className={cn("whitespace-pre-line text-texto/90 leading-relaxed", larga && !abierta && "line-clamp-4")}>{texto}</p>
      {larga && (
        <button type="button" className="mt-1 text-marca-texto hover:underline" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
          {abierta ? "Ver menos" : "Ver toda la descripción"}
        </button>
      )}
    </div>
  );
}
