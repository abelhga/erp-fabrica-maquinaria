import { useSearchParams } from "react-router-dom";
import { KeyRound, Target } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { cn } from "@/lib/utilidades";
import { BarraPeso, ESTADOS_EVAL, PanelEvaluacion, nombreMes, puntos, useEvaluaciones } from "./componentes/objetivos";

/** Lo que ve cada quien de sus objetivos: solo lo suyo, sin montos, con la evidencia de cada indicador. */
export default function MiDesempeno() {
  const [params, setParams] = useSearchParams();
  const evaluaciones = useEvaluaciones(null, { soloMias: true });
  const lista = evaluaciones.data ?? [];
  const mes = params.get("mes");
  // Por omisión, el último mes ya calificado: el borrador del mes en curso enseña un resultado parcial.
  const elegida = lista.find((e) => e.mes.slice(0, 7) === mes) ?? lista.find((e) => e.estado !== "borrador") ?? lista[0] ?? null;

  return (
    <Pagina titulo="Mi desempeño" ancho="max-w-4xl"
      descripcion="Tus objetivos de cada mes con lo que los explica. Te califica tu jefe directo, RRHH revisa y dirección aprueba; puedes comentar.">
      {evaluaciones.error ? <ErrorCarga error={evaluaciones.error} /> : evaluaciones.isLoading ? <Cargando /> : lista.length === 0 ? (
        <div className="tarjeta">
          <Vacio icono={Target} titulo="Todavía no tienes objetivos"
            texto="Cuando RRHH te asigne un puesto con objetivos, aquí verás cada mes tu resultado, indicador por indicador, con la evidencia (órdenes, conteos, marcas del checklist)." />
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {lista.map((e) => {
              const activo = e.id === elegida?.id;
              return (
                <button key={e.id} onClick={() => setParams({ mes: e.mes.slice(0, 7) }, { replace: true })}
                  className={cn("tarjeta px-4 py-3 text-left min-w-[150px] shrink-0 transition", activo ? "border-marca ring-2 ring-marca/20" : "hover:border-marca/40")}>
                  <p className="text-xs text-tenue first-letter:uppercase">{nombreMes(e.mes)}</p>
                  <p className={cn("text-2xl font-semibold cifra flex items-center gap-1", e.llave_activada && "text-peligro")}>
                    {e.llave_activada && <KeyRound className="h-4 w-4" />}{puntos(e.total_final)}
                  </p>
                  <BarraPeso valor={e.total_final} peso={100} tono={e.llave_activada ? "peligro" : undefined} />
                  <Insignia className="mt-2" tono={ESTADOS_EVAL[e.estado].tono}>{e.estado === "aprobada" ? "Aprobado" : e.estado === "borrador" ? "En calificación" : "En revisión"}</Insignia>
                </button>
              );
            })}
          </div>
          {elegida && (
            <div className="tarjeta p-4 sm:p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-lg first-letter:uppercase">{nombreMes(elegida.mes)}</h2>
                <p className="text-sm text-tenue">{elegida.puesto_nombre}{elegida.estado !== "aprobada" && " · el resultado puede cambiar hasta que dirección lo apruebe"}</p>
              </div>
              <PanelEvaluacion evaluacion={elegida} propia />
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}
