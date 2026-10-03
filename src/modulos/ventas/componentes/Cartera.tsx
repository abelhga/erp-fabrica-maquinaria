import { Insignia } from "@/components/ui/insignia";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

export interface Cartera {
  cliente_id: string; vendedor_id: string | null; vendedor: string | null; ultima_venta: string | null; ultimo_seguimiento: string | null;
  vence_en: string | null; estado: "libre" | "vigente" | "vencido"; dias_restantes: number | null;
}

/** "Cliente de Isaac hasta 12 mar 2027" / "Libre": la regla de cartera (vigencia_cliente) en una insignia. */
export function DuenoCliente({ cartera, vendedor, mio }: { cartera?: Cartera | null; vendedor?: string | null; mio?: boolean }) {
  if (!cartera?.vendedor_id && !vendedor) return <Insignia tono="ok">Libre</Insignia>;
  const nombre = (cartera?.vendedor ?? vendedor ?? "").split(" ").slice(0, 2).join(" ");
  if (!cartera) return <span className="text-sm">{nombre}</span>;
  return (
    <span className="inline-flex flex-col">
      <span className={cn("text-sm", mio && "font-medium")}>{mio ? "Mío" : nombre}</span>
      <span className={cn("text-[11px]", cartera.estado === "vencido" ? "text-peligro" : (cartera.dias_restantes ?? 999) < 30 ? "text-aviso" : "text-tenue")}>
        {cartera.estado === "vencido" ? `venció ${fecha(cartera.vence_en)}` : cartera.vence_en ? `hasta ${fecha(cartera.vence_en)}` : ""}
      </span>
    </span>
  );
}

