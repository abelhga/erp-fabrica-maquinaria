import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Interruptor } from "@/components/ui/interruptor";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

interface FilaCapacidad {
  etapa_id: number; nombre: string; orden: number; activa: boolean; automatica: boolean; personas: number;
  capacidad: number; calculada: number; horas_semana: number; aprovechamiento: number;
}

/**
 * Cuántas horas por semana da cada área y de dónde salen. La cuenta la hace la base
 * (capacidad_taller): aquí solo se ve, se prende o apaga por área y se pone el aprovechamiento.
 */
export function CapacidadTaller() {
  const { puede } = useSesion();
  const editable = puede("produccion", 3) || puede("admin", 3);
  const datos = useQuery({ queryKey: ["capacidad_taller"], queryFn: () => q<FilaCapacidad[]>(supabase.rpc("capacidad_taller")) });
  const invalidar = [["capacidad_taller"], ["etapas"], ["produccion"]];
  const automatica = useAccion((a: { etapa: number; v: boolean }) => q(supabase.rpc("fijar_capacidad_automatica", { p_etapa: a.etapa, p_automatica: a.v })),
    { invalidar, exito: (_r) => "Listo: el plan del taller ya usa esta capacidad" });
  const aprovechar = useAccion((v: number) => q(supabase.rpc("fijar_aprovechamiento_taller", { p_aprovechamiento: v })),
    { invalidar, exito: "Aprovechamiento guardado: las capacidades automáticas se recalcularon" });

  const filas = (datos.data ?? []).filter((f) => f.activa);
  const actual = datos.data?.[0]?.aprovechamiento;
  const [texto, setTexto] = useState("");
  useEffect(() => { if (actual != null) setTexto(String(Math.round(actual * 100))); }, [actual]);
  const guardar = () => {
    const n = Number(texto.replace(",", "."));
    if (!Number.isFinite(n) || actual == null || Math.round(actual * 100) === n) { if (actual != null) setTexto(String(Math.round(actual * 100))); return; }
    aprovechar.mutate(n / 100);
  };

  if (datos.error) return <ErrorCarga error={datos.error} />;
  if (datos.isLoading) return <Cargando filas={4} />;
  const semana = datos.data?.[0]?.horas_semana ?? 0;
  return (
    <section className="rounded-lg border border-borde p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium" data-explain={GLOSARIO.capacidadEtapa} data-explain-title="Capacidad por área">Capacidad por área</p>
        <label className="flex items-center gap-2 text-xs text-tenue" data-explain={GLOSARIO.aprovechamientoTaller} data-explain-title="Aprovechamiento">
          Aprovechamiento
          {editable ? (
            <span className="inline-flex items-center gap-1">
              <input className="campo h-8 w-16 text-right cifra" inputMode="numeric" value={texto} aria-label="Aprovechamiento en porcentaje"
                onChange={(e) => setTexto(e.target.value.replace(/[^\d]/g, ""))} onBlur={guardar}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") setTexto(String(Math.round((actual ?? 0) * 100))); }} />
              %
            </span>
          ) : <b className="text-texto cifra">{porcentaje(actual ?? 0, 0)}</b>}
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr><th>Área</th><th className="!text-right">Personas</th><th className="!text-right">Capacidad h/semana</th><th>De dónde sale</th>
              <th className="!text-center" data-explain={GLOSARIO.capacidadAutomatica}>Automática</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const difiere = !f.automatica && f.personas > 0 && Math.abs(f.calculada - f.capacidad) >= 10;
              return (
                <tr key={f.etapa_id}>
                  <td className="font-medium whitespace-nowrap">{f.nombre}</td>
                  <td className="text-right cifra">{numero(f.personas)}</td>
                  <td className="text-right cifra font-medium">{numero(f.capacidad)}</td>
                  <td className="text-xs text-tenue">
                    {f.automatica
                      ? f.personas > 0 ? `${numero(f.personas)} × ${numero(semana)} h × ${porcentaje(f.aprovechamiento, 0)}` : <span className="text-aviso">Sin gente: conserva su último número</span>
                      : <span className={cn(difiere && "text-aviso")}>A mano{f.personas > 0 && ` · con su gente daría ${numero(f.calculada)}`}</span>}
                  </td>
                  <td className="text-center">
                    {editable
                      ? <Interruptor activo={f.automatica} cargando={automatica.isPending} aria-label={`Capacidad automática de ${f.nombre}`}
                          alCambiar={(v) => automatica.mutate({ etapa: f.etapa_id, v })} />
                      : <Insignia tono={f.automatica ? "ok" : "neutro"}>{f.automatica ? "Sí" : "A mano"}</Insignia>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-tenue">
        Se recalcula sola cuando cambias a alguien de área o de cuadrillas, cuando cambia el horario del taller o el aprovechamiento.
        Las horas por persona son las de la semana del taller ({numero(semana)} h). Lo usan el plan del taller y la fecha realista de entrega.
      </p>
    </section>
  );
}
