import type { ReactNode } from "react";

/** Colores de serie en orden fijo: la serie N siempre es el mismo color. */
export const SERIE = (n: number) => `var(--serie-${((n - 1) % 8) + 1})`;

export const ejeProps = {
  stroke: "var(--eje)", fontSize: 12, tickLine: false, axisLine: false,
} as const;

/** Tooltip con tinta de texto (no del color de la serie), con muestra de color al lado. */
export function TooltipGrafica({ active, payload, label, formato }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: ReactNode;
  formato: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[160px]">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-tenue">{p.name}</span>
          <span className="ml-auto cifra font-medium">{formato(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex justify-between border-t border-borde mt-1 pt-1 font-medium"><span>Total</span><span className="cifra">{formato(total)}</span></div>
      )}
    </div>
  );
}

export function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
      {series.map((s) => (
        <span key={s.nombre} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.nombre}
        </span>
      ))}
    </div>
  );
}
