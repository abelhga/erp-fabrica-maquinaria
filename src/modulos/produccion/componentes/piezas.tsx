import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, CheckCircle2, CirclePlay, FilePlus2, Flag, MessageSquare, PackageCheck, Pause, Play, Truck, Unlock, Wrench,
} from "lucide-react";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { fecha } from "@/lib/formato";
import type { Evento, TipoEvento } from "./datos";
import { haceRato, textoDias, textoEvento, tonoCompromiso } from "./util";

/** Avance por horas terminadas. El número va aparte, en tinta de texto. */
export function BarraAvance({ valor, className, grosor = "h-1.5" }: { valor: number; className?: string; grosor?: string }) {
  const v = Math.max(0, Math.min(100, Number(valor) || 0));
  return (
    <div className={cn("w-full rounded-full bg-fondo border border-borde/60 overflow-hidden", grosor, className)}
         role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", v >= 100 ? "bg-ok" : "bg-marca")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function InsigniaCompromiso({ dias, fechaCompromiso, cerrada, corta }: {
  dias: number | null; fechaCompromiso: string | null; cerrada?: boolean; corta?: boolean;
}) {
  const tono = tonoCompromiso(dias, cerrada);
  return (
    <Insignia tono={tono} punto className="cifra" >
      {corta ? textoDias(dias) : <>{fecha(fechaCompromiso)}{!cerrada && dias != null && <span className="opacity-80">· {textoDias(dias).toLowerCase()}</span>}</>}
    </Insignia>
  );
}

/** Punto con el color de la etapa (el mismo en la terminal y en la TV) y su nombre. */
export function ChipEtapa({ nombre, color, estado, className }: { nombre: string; color?: string | null; estado?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", estado === "pausada" && "ring-2 ring-aviso ring-offset-1 ring-offset-superficie")}
            style={{ background: color ?? "hsl(var(--tenue))" }} />
      <span className="truncate">{nombre}</span>
    </span>
  );
}

const ICONOS: Record<TipoEvento, { icono: LucideIcon; clase: string }> = {
  creada: { icono: FilePlus2, clase: "text-tenue" },
  liberada: { icono: Unlock, clase: "text-info" },
  inicio: { icono: Play, clase: "text-marca" },
  pausa: { icono: Pause, clase: "text-aviso" },
  reanudar: { icono: CirclePlay, clase: "text-marca" },
  fin: { icono: CheckCircle2, clase: "text-ok" },
  problema: { icono: AlertTriangle, clase: "text-peligro" },
  nota: { icono: MessageSquare, clase: "text-tenue" },
  surtido: { icono: PackageCheck, clase: "text-info" },
  cambio_material: { icono: Wrench, clase: "text-aviso" },
  terminada: { icono: Flag, clase: "text-ok" },
  entregada: { icono: Truck, clase: "text-ok" },
};

export function IconoEvento({ tipo, className }: { tipo: TipoEvento; className?: string }) {
  const { icono: I, clase } = ICONOS[tipo] ?? ICONOS.nota;
  return <I className={cn("h-4 w-4 shrink-0", clase, className)} />;
}

/** Renglón de actividad: qué pasó, quién lo marcó y hace cuánto. */
export function FilaEvento({ e, conFolio = true, alClic, ahora }: { e: Evento; conFolio?: boolean; alClic?: () => void; ahora?: number }) {
  const C = alClic ? "button" : "div";
  return (
    <C onClick={alClic} className={cn("w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left", alClic && "hover:bg-fondo")}>
      <IconoEvento tipo={e.tipo} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {e.etapa_color && <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: e.etapa_color }} />}
          {textoEvento(e, conFolio)}
        </p>
        <p className="text-xs text-tenue mt-0.5">
          {haceRato(e.en, ahora)}{e.usuario && ` · ${e.usuario}`}
        </p>
      </div>
    </C>
  );
}
