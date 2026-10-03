import { AlertTriangle, Wallet } from "lucide-react";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { useSaldos } from "./datos";

/**
 * Saldo estimado de cada paquetería de prepago: recargas menos lo que costaron las
 * guías. Se pone en rojo abajo del mínimo (y la base avisa a quien recarga).
 */
export function Saldos({ alRecargar }: { alRecargar?: (paqueteriaId: number) => void }) {
  const saldos = useSaldos();
  // Solo las que se usan: una paquetería sin recargas ni guías no tiene saldo que vigilar.
  const conSaldo = (saldos.data ?? []).filter((s) => s.usa_saldo && (Number(s.recargas) !== 0 || Number(s.consumo) !== 0));
  if (conSaldo.length === 0) return null;
  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
      {conSaldo.map((s) => (
        <button key={s.paqueteria_id} type="button" onClick={alRecargar ? () => alRecargar(s.paqueteria_id) : undefined} disabled={!alRecargar}
          title={`Recargas ${dinero(s.recargas)} − guías ${dinero(s.consumo)}. Mínimo ${dinero(s.saldo_minimo)}.`}
          className={cn("tarjeta flex min-w-0 items-center gap-3 px-3 py-2.5 text-left", alRecargar && "hover:border-marca/40",
            s.bajo && "border-peligro/40 bg-peligro-suave")}>
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.bajo ? "bg-peligro text-white" : "bg-marca-suave text-marca")}>
            {s.bajo ? <AlertTriangle className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs text-tenue">{s.paqueteria}</span>
            <span className={cn("block text-lg font-semibold cifra leading-tight", s.bajo && "text-peligro")}>{dinero(s.saldo)}</span>
            <span className="block truncate text-[11px] text-tenue">
              {s.bajo ? `abajo del mínimo (${dinero(s.saldo_minimo)})` : `${s.guias_30d} guías en 30 días`}
              {s.ultima_recarga && ` · recarga ${fecha(s.ultima_recarga)}`}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
