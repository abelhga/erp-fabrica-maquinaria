import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Crown } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { CLAVE, horaMx, horas, instanteMx, isoLocal, periodo, sumarDias, usePersonal, type CuadrillaFila, type Servicio } from "../datos";

// La misma jornada que usa la base (configuracion.servicio) para descontar capacidad.
const JORNADA = { inicio: "08:30", fin: "17:30" };

/** Horas de taller (lunes a viernes, 8:30 a 17:30 en la planta) que caen en un periodo. Como horas_laborables() en la base. */
function horasTaller(a: Date, b: Date) {
  let total = 0;
  for (let dia = isoLocal(a); dia <= isoLocal(b); dia = sumarDias(dia, 1)) {
    const dow = new Date(dia + "T12:00:00Z").getUTCDay();
    if (dow >= 1 && dow <= 5) {
      const ini = instanteMx(dia, JORNADA.inicio), fin = instanteMx(dia, JORNADA.fin);
      total += Math.max(0, Math.min(b.getTime(), fin.getTime()) - Math.max(a.getTime(), ini.getTime())) / 3_600_000;
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * Fecha, duración y cuadrilla. Marca a quien ya va en otro servicio en esas fechas;
 * la base de todos modos no deja encimar a la misma persona (y dice con qué choca).
 */
export function DialogoProgramar({ s, abierto, alCambiar }: { s: Servicio; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const personal = usePersonal();
  const inicioPrevio = s.inicio ? new Date(s.inicio) : null;
  // Sin fecha previa: la que pidió el cliente si no ya pasó; si no, el siguiente día hábil.
  const [dia, setDia] = useState(() => {
    if (inicioPrevio) return isoLocal(inicioPrevio);
    const hoy = isoLocal(new Date());
    if (s.fecha_deseada && s.fecha_deseada > hoy) return s.fecha_deseada;
    let d = sumarDias(hoy, 1);
    while ([0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay())) d = sumarDias(d, 1);
    return d;
  });
  const [hora, setHora] = useState(inicioPrevio ? horaMx(inicioPrevio) : JORNADA.inicio);
  const durPrevia = s.inicio && s.fin ? (new Date(s.fin).getTime() - new Date(s.inicio).getTime()) / 3_600_000 : null;
  const [unidad, setUnidad] = useState<"dias" | "horas">(durPrevia != null && durPrevia < 20 ? "horas" : "dias");
  const [n, setN] = useState(durPrevia == null ? "1" : durPrevia < 20 ? String(Math.round(durPrevia * 10) / 10) : String(Math.round(durPrevia / 24 + 0.25)));
  const [elegidos, setElegidos] = useState<string[]>(s.cuadrilla.map((c) => c.id));
  const [jefe, setJefe] = useState<string>(s.cuadrilla.find((c) => c.jefe)?.id ?? "");

  const inicio = instanteMx(dia, hora);
  const fin = useMemo(() => {
    const k = Number(n);
    if (!(k > 0) || Number.isNaN(inicio.getTime())) return null;
    if (unidad === "horas") return new Date(inicio.getTime() + k * 3_600_000);
    return instanteMx(sumarDias(dia, Math.ceil(k) - 1), JORNADA.fin);
  }, [n, unidad, dia, hora]); // eslint-disable-line react-hooks/exhaustive-deps
  const valido = fin != null && fin > inicio;

  const ocupados = useQuery({
    queryKey: [...CLAVE, "ocupados", s.id, inicio.toISOString(), fin?.toISOString()],
    enabled: abierto && valido,
    queryFn: () => q<CuadrillaFila[]>(supabase.from("v_servicio_cuadrilla").select("*")
      .lt("inicio", fin!.toISOString()).gt("fin", inicio.toISOString()).neq("servicio_id", s.id)),
  });
  const choque = (id: string) => ocupados.data?.find((o) => o.empleado_id === id);

  const programar = useAccion(() => q(supabase.rpc("programar_servicio", {
    p_servicio: s.id, p_inicio: inicio.toISOString(), p_fin: fin!.toISOString(), p_cuadrilla: elegidos, p_jefe: jefe || elegidos[0] || null,
  })), { exito: "Servicio programado: quien lo pidió ya tiene el aviso", invalidar: [CLAVE], alTerminar: () => alCambiar(false) });

  const gente = (personal.data ?? []).filter((p) => p.activo);
  const grupos = [...new Map(gente.map((p) => [p.etapa ?? p.departamento ?? "Otros", [] as typeof gente])).entries()];
  for (const p of gente) grupos.find(([k]) => k === (p.etapa ?? p.departamento ?? "Otros"))![1].push(p);
  const hPersona = valido ? horasTaller(inicio, fin!) : 0;
  const porArea = new Map<string, number>();
  for (const id of elegidos) {
    const p = gente.find((x) => x.id === id);
    if (p?.etapa) porArea.set(p.etapa, (porArea.get(p.etapa) ?? 0) + hPersona);
  }
  const alternar = (id: string) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={s.inicio ? `Reprogramar ${s.folio}` : `Programar ${s.folio}`} ancho="max-w-3xl"
      descripcion={`${s.tipo_nombre} · ${s.cliente ?? ""}${s.lugar ? ` · ${s.lugar}` : ""}`}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="form-programar" disabled={!valido || elegidos.length === 0} cargando={programar.isPending}>
          {s.inicio ? "Guardar cambios" : "Programar"}
        </Boton>
      </>}>
      <form id="form-programar" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido && elegidos.length) programar.mutate(); }}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Campo etiqueta="Día"><Entrada type="date" value={dia} onChange={(e) => setDia(e.target.value)} required /></Campo>
          <Campo etiqueta="Sale a las"><Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} required /></Campo>
          <Campo etiqueta="Duración"><Entrada type="number" min="0.5" step="0.5" value={n} onChange={(e) => setN(e.target.value)} /></Campo>
          <Campo etiqueta="En">
            <Seleccion value={unidad} onChange={(e) => setUnidad(e.target.value as "dias" | "horas")}>
              <option value="dias">días</option><option value="horas">horas</option>
            </Seleccion>
          </Campo>
        </div>
        <p className="text-sm">
          {valido ? <>Ocupa a la cuadrilla: <b>{periodo(inicio.toISOString(), fin!.toISOString())}</b> · <span className="cifra">{horas(hPersona)}</span> de taller por persona.</>
            : <span className="text-peligro">El fin tiene que quedar después del inicio.</span>}
        </p>
        <fieldset>
          <legend className="text-sm font-medium mb-1.5">Cuadrilla <span className="text-tenue font-normal">({elegidos.length})</span></legend>
          <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-borde divide-y divide-borde/70">
            {grupos.map(([area, lista]) => (
              <div key={area} className="p-2">
                <p className="etiqueta px-1 mb-1">{area}</p>
                <div className="grid sm:grid-cols-2 gap-1">
                  {lista.map((p) => {
                    const c = choque(p.id);
                    const marcado = elegidos.includes(p.id);
                    return (
                      <label key={p.id} className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm", marcado ? "bg-marca-suave" : "hover:bg-fondo")}>
                        <input type="checkbox" checked={marcado} onChange={() => alternar(p.id)} className="mt-0.5 accent-[hsl(var(--marca))]" />
                        <span className="min-w-0">
                          <span className="block truncate">{p.nombre}</span>
                          <span className="block text-[11px] text-tenue truncate">{p.puesto}</span>
                          {c && <span className="flex items-center gap-1 text-[11px] text-peligro"><AlertTriangle className="h-3 w-3" />Va en {c.folio} ({c.cliente})</span>}
                        </span>
                        {marcado && (
                          <button type="button" onClick={(e) => { e.preventDefault(); setJefe(p.id); }} title="Jefe de cuadrilla"
                                  className={cn("ml-auto rounded p-0.5", (jefe || elegidos[0]) === p.id ? "text-marca-texto" : "text-tenue/50 hover:text-tenue")}
                                  aria-label={`Hacer a ${p.nombre} jefe de cuadrilla`}>
                            <Crown className="h-4 w-4" />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        {porArea.size > 0 && (
          <p className="text-xs text-tenue">
            Se descuenta de la capacidad del taller: {[...porArea.entries()].map(([a, h]) => `${a} ${horas(h)}`).join(" · ")}.
          </p>
        )}
      </form>
    </Dialogo>
  );
}
