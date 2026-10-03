import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";
import type { Tono } from "./insignia";

const fondoIcono: Record<Tono, string> = {
  neutro: "bg-fondo text-tenue", marca: "bg-marca-suave text-marca", ok: "bg-ok-suave text-ok",
  aviso: "bg-aviso-suave text-aviso", peligro: "bg-peligro-suave text-peligro", info: "bg-info-suave text-info",
};

/** Indicador grande del tablero: valor, contexto y, opcionalmente, a dónde lleva al hacer clic. */
export function Kpi({ titulo, valor, detalle, icono: Icono, tono = "marca", alClic }: {
  titulo: string; valor: ReactNode; detalle?: ReactNode; icono: LucideIcon; tono?: Tono; alClic?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alClic}
      disabled={!alClic}
      className={cn("tarjeta p-4 text-left flex gap-3 items-start w-full", alClic && "hover:border-marca/40 hover:shadow-md transition")}
    >
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", fondoIcono[tono])}>
        <Icono className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-tenue">{titulo}</p>
        <p className="text-2xl font-semibold cifra leading-tight mt-0.5 truncate">{valor}</p>
        {detalle && <p className="text-xs text-tenue mt-1">{detalle}</p>}
      </div>
    </button>
  );
}
