import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

const tonos = {
  neutro: "bg-fondo text-tenue border-borde",
  marca: "bg-marca-suave text-marca-texto border-marca/20",
  ok: "bg-ok-suave text-ok border-ok/20",
  aviso: "bg-aviso-suave text-aviso border-aviso/25",
  peligro: "bg-peligro-suave text-peligro border-peligro/20",
  info: "bg-info-suave text-info border-info/20",
} as const;
export type Tono = keyof typeof tonos;

export function Insignia({ tono = "neutro", children, className, punto }: {
  tono?: Tono; children: ReactNode; className?: string; punto?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tonos[tono], className)}>
      {punto && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
