import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";
import { CLAVE } from "./datos";

// En el piso se habla en cuartos («va a 3/4»), no en porcentajes.
const PASOS = [{ v: 0.25, t: "¼" }, { v: 0.5, t: "½" }, { v: 0.75, t: "¾" }, { v: 0.9, t: "Casi" }];

/**
 * «¿Cuánto lleva?» de una etapa empezada. Cuenta en el avance de la orden, en lo que le falta
 * al área y en el plan del Gantt; terminar se sigue marcando con «Terminar».
 */
export function AvanceEtapa({ operacion, avance, grande }: { operacion: string; avance: number | null | undefined; grande?: boolean }) {
  const qc = useQueryClient();
  const reportar = useMutation({
    mutationFn: (v: number) => q(supabase.rpc("reportar_avance", { p_operacion: operacion, p_avance: v })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
    onError: (e) => toast.error(mensajeError(e)),
  });
  // El más cercano a lo reportado (puede venir de otro lado con otro número).
  const actual = avance == null ? null : PASOS.reduce((m, p) => (Math.abs(p.v - avance) < Math.abs(m.v - avance) ? p : m)).v;
  return (
    <div className={cn("flex items-center gap-2", grande ? "flex-wrap" : "")} data-explain={GLOSARIO.avanceEtapa} data-explain-title="¿Cuánto lleva?">
      <span className={cn("text-tenue", grande ? "text-lg" : "text-xs")}>¿Cuánto lleva?</span>
      <div className="flex gap-1">
        {PASOS.map((p) => (
          <button key={p.v} type="button" disabled={reportar.isPending} onClick={() => reportar.mutate(p.v)}
            aria-pressed={actual === p.v}
            className={cn("rounded-lg border font-semibold transition disabled:opacity-60",
              grande ? "h-12 min-w-[3.25rem] px-3 text-xl" : "h-7 min-w-[2.25rem] px-2 text-xs",
              actual === p.v ? "border-marca bg-marca text-white" : "border-borde hover:bg-fondo")}>
            {p.t}
          </button>
        ))}
      </div>
    </div>
  );
}
