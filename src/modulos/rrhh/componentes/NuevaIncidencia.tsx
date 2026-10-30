import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { TIPOS, textoCargos, useEmpleados, useSimularVacaciones, useVacaciones, type TipoIncidencia } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

const UN_DIA: TipoIncidencia[] = ["retardo", "horas_extra"];

/** Registrar vacaciones, permisos, faltas, incapacidades, retardos u horas extra. Los días hábiles los cuenta la base. */
export function NuevaIncidencia({ abierto, alCambiar, empleadoId, inicioSugerido }: {
  abierto: boolean; alCambiar: (v: boolean) => void; empleadoId?: string; inicioSugerido?: string;
}) {
  const { puede } = useSesion();
  const esRrhh = puede("rrhh", 2);
  const empleados = useEmpleados();
  const vacaciones = useVacaciones();
  const inicial = () => ({
    empleado_id: empleadoId ?? "", tipo: "vacaciones" as TipoIncidencia, inicio: inicioSugerido ?? hoyISO(), fin: inicioSugerido ?? hoyISO(),
    horas: "", motivo: "", medio: false, autorizada: esRrhh,
  });
  const [f, setF] = useState(inicial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (abierto) setF(inicial()); }, [abierto, empleadoId, inicioSugerido]);

  const unDia = UN_DIA.includes(f.tipo);
  const fin = unDia ? f.inicio : f.fin < f.inicio ? f.inicio : f.fin;
  const habiles = useQuery({
    queryKey: ["dias_habiles", f.inicio, fin],
    enabled: abierto && !!f.inicio && !!fin,
    queryFn: () => q<number>(supabase.rpc("dias_habiles", { p_inicio: f.inicio, p_fin: fin })),
  });
  const naturales = Math.round((new Date(fin + "T12:00:00").getTime() - new Date(f.inicio + "T12:00:00").getTime()) / 86_400_000) + 1;
  const dias = f.tipo === "incapacidad" ? naturales : f.medio && f.inicio === fin ? 0.5 : habiles.data ?? 0;
  const saldo = vacaciones.data?.find((v) => v.empleado_id === f.empleado_id);
  // De qué periodo saldrían y cuántos serían adelanto, con la regla de la base (cuenta la fecha:
  // después del aniversario ya no son adelanto).
  const sim = useSimularVacaciones(f.tipo === "vacaciones" ? f.empleado_id : null, f.inicio, dias);
  const cargo = sim.data?.length ? textoCargos(sim.data) : null;

  const guardar = useAccion(() => q(supabase.from("incidencias").insert({
    empleado_id: f.empleado_id, tipo: f.tipo, inicio: f.inicio, fin, motivo: f.motivo.trim() || null,
    horas: f.horas ? Number(f.horas) : null, dias: f.medio && f.inicio === fin ? 0.5 : 1,
    estado: esRrhh && f.autorizada ? "aprobada" : "solicitada",
  })), {
    exito: esRrhh && f.autorizada ? "Registrado" : "Solicitud enviada a Recursos Humanos",
    invalidar: [["incidencias"], ["v_vacaciones"]],
    alTerminar: () => alCambiar(false),
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!f.empleado_id) return;
    guardar.mutate(undefined);
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Registrar vacaciones o incidencia" ancho="max-w-xl"
      descripcion={esRrhh ? "Los días hábiles los cuenta el sistema con la semana laboral y los feriados de ley." : "Quedará como solicitud: Recursos Humanos la aprueba o la rechaza."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="nueva-incidencia" cargando={guardar.isPending} disabled={!f.empleado_id || (f.tipo === "horas_extra" && !f.horas)}>
          <CalendarCheck className="h-4 w-4" /> {esRrhh && f.autorizada ? "Registrar" : "Enviar solicitud"}
        </Boton>
      </>}>
      <form id="nueva-incidencia" onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Empleado">
          <Seleccion autoFocus={!empleadoId} required value={f.empleado_id} onChange={(e) => setF({ ...f, empleado_id: e.target.value })}>
            <option value="">Elegir…</option>
            {(empleados.data ?? []).filter((e) => e.activo).map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}{e.puesto ? ` · ${e.puesto}` : ""}</option>
            ))}
          </Seleccion>
        </Campo>
        <div>
          <p className="text-sm font-medium mb-1.5">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TIPOS) as TipoIncidencia[]).map((t) => (
              <button type="button" key={t} onClick={() => setF({ ...f, tipo: t, medio: false })}
                className={cn("h-8 rounded-full px-3 text-xs font-medium border transition",
                  f.tipo === t ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>
                {TIPOS[t].texto}
              </button>
            ))}
          </div>
          <p className="text-xs text-tenue mt-1.5">{TIPOS[f.tipo].ayuda}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={unDia ? "Día" : "Desde"}>
            <Entrada type="date" required value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value, fin: f.fin < e.target.value ? e.target.value : f.fin })} />
          </Campo>
          {unDia ? (
            <Campo etiqueta={f.tipo === "horas_extra" ? "Horas extra" : "Tiempo de retardo (horas)"}>
              <Entrada type="number" step="0.25" min="0" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })}
                placeholder={f.tipo === "retardo" ? "0.5 = media hora" : "4"} required={f.tipo === "horas_extra"} />
            </Campo>
          ) : (
            <Campo etiqueta="Hasta (incluido)">
              <Entrada type="date" required value={fin} min={f.inicio} onChange={(e) => setF({ ...f, fin: e.target.value })} />
            </Campo>
          )}
        </div>
        {!unDia && (
          <div className="rounded-lg bg-fondo border border-borde px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1" data-explain={GLOSARIO.diasHabiles} data-explain-title="Días hábiles">
            <span>
              <b className="cifra">{numero(dias)}</b> {f.tipo === "incapacidad" ? "días naturales (así los cuenta el IMSS)" : dias === 1 ? "día hábil" : "días hábiles"}
              {f.tipo !== "incapacidad" && naturales !== dias && !f.medio && <span className="text-tenue"> de {naturales} días de calendario</span>}
            </span>
            {f.inicio === fin && f.tipo.startsWith("permiso") && (
              <label className="flex items-center gap-1.5 text-tenue">
                <input type="checkbox" checked={f.medio} onChange={(e) => setF({ ...f, medio: e.target.checked })} /> Medio día
              </label>
            )}
          </div>
        )}
        {f.tipo === "vacaciones" && saldo && cargo && (
          <p className={cn("text-sm rounded-lg px-3 py-2 flex gap-2", cargo.adelanto ? "bg-aviso-suave text-aviso" : "bg-ok-suave text-ok")}
            data-explain={cargo.adelanto ? GLOSARIO.adelantoVacaciones : GLOSARIO.periodoVacaciones}
            data-explain-title={cargo.adelanto ? "Adelanto de vacaciones" : "Periodo de vacaciones"}>
            {cargo.adelanto && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>Saldo hoy: {numero(saldo.saldo)} días{saldo.anios < 1 ? ` (cumple su primer año el ${fecha(saldo.proximo_aniversario)})` : ""}. Si se aprueban: {cargo.texto.charAt(0).toLowerCase() + cargo.texto.slice(1)}</span>
          </p>
        )}
        <Campo etiqueta="Motivo o comentario" ayuda={f.tipo === "incapacidad" ? "Anota el folio de la incapacidad del IMSS." : undefined}>
          <Entrada value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        </Campo>
        {esRrhh && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.autorizada} onChange={(e) => setF({ ...f, autorizada: e.target.checked })} />
            Ya está autorizada (si no, queda en "por aprobar")
          </label>
        )}
      </form>
    </Dialogo>
  );
}
