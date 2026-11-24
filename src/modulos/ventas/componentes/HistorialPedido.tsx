import { useQuery } from "@tanstack/react-query";
import { Boxes, CircleDot, Factory, FilePlus2, PackageCheck, Pencil, PencilLine, Receipt, ListPlus, Trash2, Truck, Undo2, Wallet, Calculator, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fechaYHora } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Cargando } from "@/components/ui/estados";

interface Evento { en: string; tipo: string; texto: string; quien: string | null; nota: string | null }

const ICONO: Record<string, { i: LucideIcon; tono?: string }> = {
  creado: { i: FilePlus2, tono: "text-marca-texto" }, estado: { i: CircleDot, tono: "text-marca-texto" }, cambio: { i: Pencil },
  total: { i: Calculator }, partida: { i: ListPlus }, cobro: { i: Wallet, tono: "text-ok" }, cobro_corregido: { i: PencilLine, tono: "text-aviso" },
  cobro_quitado: { i: Trash2, tono: "text-peligro" }, factura: { i: Receipt }, op: { i: Factory }, entrega: { i: PackageCheck, tono: "text-ok" },
  almacen: { i: Boxes }, envio: { i: Truck }, devolucion: { i: Undo2, tono: "text-peligro" },
};

/**
 * Todo lo que le ha pasado al pedido, más nuevo arriba, con quién y cuándo (como la línea de
 * tiempo de las órdenes). Lo arma la base con la bitácora, que la gente no ve directo; cada
 * quien ve solo lo de las áreas que ya ve en su pantalla.
 */
export function HistorialPedido({ pedidoId, className }: { pedidoId: string; className?: string }) {
  const h = useQuery({
    queryKey: ["pedido_historial", pedidoId],
    queryFn: () => q<Evento[]>(supabase.rpc("pedido_historial", { p_pedido: pedidoId })),
  });
  if (h.isLoading) return <div className={className}><Cargando filas={3} /></div>;
  const ev = h.data ?? [];
  if (!ev.length) return <p className={cn("text-sm text-tenue", className)}>Todavía no hay nada registrado.</p>;
  return (
    <ol className={cn("space-y-0", className)}>
      {ev.map((e, i) => {
        const { i: Icono, tono } = ICONO[e.tipo] ?? { i: CircleDot };
        return (
          <li key={`${e.en}-${i}`} className="relative flex gap-3 pb-3">
            {i < ev.length - 1 && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-borde" />}
            <Icono className={cn("h-4 w-4 mt-0.5 shrink-0 relative bg-superficie", tono ?? "text-tenue")} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm leading-snug", e.tipo === "cobro_quitado" && "text-peligro")}>{e.texto}</p>
              {e.nota && <p className="text-xs text-tenue italic">«{e.nota}»</p>}
              <p className="text-xs text-tenue cifra">{fechaYHora(e.en)}{e.quien && ` · ${e.quien}`}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
