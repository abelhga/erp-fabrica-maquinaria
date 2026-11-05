import { useEffect, useRef, useState } from "react";
import { CheckCircle2, GraduationCap, PlayCircle, RotateCcw } from "lucide-react";
import { Interruptor } from "@/components/ui/interruptor";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { useTutorial } from "../preferencia";
import { RECORRIDOS } from "./catalogo";
import { empezarRecorrido, recorridosHechos } from "./Motor";

/**
 * El birrete del encabezado: prende las explicaciones y ofrece los recorridos del puesto de quien
 * entra, con lo que ya hizo. Antes era solo un interruptor; ahora es el lugar para aprender.
 */
export function MenuAprende() {
  const { activo, cambiar } = useTutorial();
  const { puede } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const mios = RECORRIDOS.filter((r) => !r.para || puede(r.para.modulo, r.para.nivel ?? 1));
  const hechos = abierto ? recorridosHechos() : {};
  const cuantos = mios.filter((r) => hechos[r.id]).length;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  return (
    <div className="relative" ref={caja}>
      <button type="button" data-recorrido="aprende" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-haspopup="dialog"
        className={cn("p-2 rounded-lg", activo ? "bg-info-suave text-info" : "hover:bg-fondo text-tenue")}
        aria-label="Aprende a usar el ERP" title="Aprende a usar el ERP: explicaciones y recorridos guiados">
        <GraduationCap className="h-5 w-5" />
      </button>
      {abierto && (
        <div className="tarjeta absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] p-0 shadow-2xl" role="dialog" aria-label="Aprende a usar el ERP">
          <label className="flex items-start gap-3 border-b border-borde px-4 py-3">
            <Interruptor activo={activo} alCambiar={cambiar} aria-label="Explicaciones" />
            <span className="text-sm"><b>Explicaciones</b>
              <span className="block text-tenue">Arriba de cada pantalla, para qué sirve; y todo lo marcado con ? se explica al pasar el mouse o tocarlo.</span></span>
          </label>
          <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Recorridos para tu puesto</p>
            <span className="text-xs text-tenue cifra">{cuantos} de {mios.length}</span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto px-2 pb-2">
            {mios.map((r) => {
              const hecho = !!hechos[r.id];
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => { setAbierto(false); empezarRecorrido(r.id); }}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-fondo">
                    {hecho ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-info" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><b className="text-sm">{r.titulo}</b>
                        <span className="text-xs text-tenue whitespace-nowrap">{r.minutos} min</span></span>
                      <span className="block text-xs text-tenue">{r.descripcion}</span>
                      {hecho && <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-info"><RotateCcw className="h-3 w-3" />Repetir</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
