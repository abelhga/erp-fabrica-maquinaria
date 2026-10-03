import { Gauge } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Vacio, Cargando, ErrorCarga } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { useCarga } from "./datos";
import { horas } from "./util";

const sem = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);

/**
 * Cuántas semanas de trabajo tiene cada etapa: horas pendientes ÷ capacidad
 * semanal. Barra sólida = órdenes ya en el taller; clara = planeadas que vienen.
 * Un solo eje (semanas) para todas las etapas, así se comparan entre sí.
 */
export function CargaTaller({ className }: { className?: string }) {
  const carga = useCarga();
  const filas = (carga.data ?? []).map((c) => {
    const cap = Number(c.capacidad_horas_semana) || 0;
    return { ...c, semTaller: cap ? Number(c.horas_pendientes) / cap : 0, semPlan: cap ? Number(c.horas_planeadas) / cap : 0, cap };
  });
  const conCarga = filas.filter((f) => Number(f.horas_pendientes) + Number(f.horas_planeadas) > 0);
  const sinCarga = filas.filter((f) => Number(f.horas_pendientes) + Number(f.horas_planeadas) === 0);
  const maximo = Math.max(4, Math.ceil(Math.max(0, ...conCarga.map((f) => f.semTaller + f.semPlan))));
  const cuello = conCarga.reduce<(typeof conCarga)[number] | null>((m, f) => (!m || f.semTaller > m.semTaller ? f : m), null);
  const marcas = Array.from({ length: maximo + 1 }, (_, i) => i).filter((i) => maximo <= 8 || i % 2 === 0);

  return (
    <Tarjeta className={className}>
      <EncabezadoTarjeta titulo="Carga del taller" descripcion="Semanas de trabajo pendientes por etapa, contra su capacidad semanal" />
      {carga.error ? <ErrorCarga error={carga.error} /> : carga.isLoading ? <Cargando filas={4} /> : conCarga.length === 0 ? (
        <Vacio icono={Gauge} titulo="El taller no tiene horas pendientes" texto="Cuando liberes órdenes, aquí verás cuántas semanas de trabajo tiene cada etapa." />
      ) : (
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue mb-3">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-marca" />En el taller (liberadas)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-marca/30" />Planeadas (aún no liberadas)</span>
          </div>
          <div className="grid grid-cols-[7.5rem_1fr_5.5rem] gap-x-3 items-center">
            <span />
            <div className="relative h-4 text-[11px] text-tenue cifra">
              {marcas.map((i) => (
                <span key={i} className={cn("absolute whitespace-nowrap", i === 0 ? "" : i === maximo ? "-translate-x-full" : "-translate-x-1/2")}
                      style={{ left: `${(i / maximo) * 100}%` }}>{i === 0 ? "0" : `${i} sem`}</span>
              ))}
            </div>
            <span />
            {conCarga.map((f) => (
              <FilaCarga key={f.etapa_id} f={f} maximo={maximo} marcas={marcas} esCuello={cuello?.etapa_id === f.etapa_id && f.semTaller > 1} />
            ))}
          </div>
          {sinCarga.length > 0 && <p className="text-xs text-tenue mt-3">Sin horas pendientes: {sinCarga.map((f) => f.nombre).join(", ")}.</p>}
        </div>
      )}
    </Tarjeta>
  );
}

function FilaCarga({ f, maximo, marcas, esCuello }: {
  f: { nombre: string; color: string; horas_pendientes: number; horas_planeadas: number; cap: number; semTaller: number; semPlan: number;
       en_proceso: number; pausadas: number; en_espera: number };
  maximo: number; marcas: number[]; esCuello: boolean;
}) {
  const ancho = (s: number) => `${Math.min(100, (s / maximo) * 100)}%`;
  const detalle = `${f.nombre}: ${horas(f.horas_pendientes)} en el taller (${sem(f.semTaller)} sem) · ${horas(f.horas_planeadas)} planeadas (${sem(f.semPlan)} sem) · capacidad ${horas(f.cap)}/semana · ${f.en_proceso} en proceso, ${f.pausadas} pausadas, ${f.en_espera} en espera`;
  return (
    <>
      <div className="flex items-center gap-2 py-2 min-w-0">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: f.color }} />
        <span className="text-sm truncate">{f.nombre}</span>
      </div>
      <div className="relative h-7 group" title={detalle}>
        {marcas.map((i) => i > 0 && (
          <span key={i} className="absolute top-0 bottom-0 border-l border-dashed border-borde" style={{ left: `${(i / maximo) * 100}%` }} />
        ))}
        <div className="absolute inset-y-1 left-0 rounded-r-[4px] bg-marca/30" style={{ width: ancho(f.semTaller + f.semPlan) }} />
        <div className={cn("absolute inset-y-1 left-0 bg-marca rounded-l-[4px]", f.semPlan === 0 && "rounded-r-[4px]")}
             style={{ width: ancho(f.semTaller), boxShadow: f.semPlan > 0 ? "2px 0 0 hsl(var(--superficie))" : undefined }} />
      </div>
      <div className="text-right leading-tight">
        <p className="text-sm font-semibold cifra">{sem(f.semTaller)} sem</p>
        {esCuello ? <Insignia tono="aviso" className="mt-0.5">Cuello de botella</Insignia>
          : f.semPlan > 0 && <p className="text-[11px] text-tenue cifra">+{sem(f.semPlan)} planeadas</p>}
      </div>
    </>
  );
}
