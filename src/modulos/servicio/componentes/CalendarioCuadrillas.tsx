import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Leyenda } from "@/components/graficas/comunes";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { CLAVE, ORDEN_TIPOS, TIPOS, diasEntre, horas, instanteMx, isoLocal, lunesDe, periodo, sumarDias, usePersonal, type CuadrillaFila } from "../datos";
import { estiloTipo } from "./piezas";

const DIAS = 14;
// Los días son fechas de la planta (AAAA-MM-DD); se formatean a mediodía UTC para que no se corran.
const fmtDia = new Intl.DateTimeFormat("es-MX", { weekday: "narrow", timeZone: "UTC" });
const fmtMes = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const comoFecha = (dia: string) => new Date(dia + "T12:00:00Z");
const esFinde = (dia: string) => [0, 6].includes(comoFecha(dia).getUTCDay());

/**
 * Calendario de cuadrillas: una fila por persona y una barra por servicio, en su
 * horario real. Reemplaza el "Calendario de actividad" de Drive. Lo que la base
 * impide (una persona en dos servicios a la vez) aquí nunca aparece encimado.
 */
export function CalendarioCuadrillas({ className }: { className?: string }) {
  const ir = useNavigate();
  const [desde, setDesde] = useState(() => lunesDe(new Date()));
  const [todos, setTodos] = useState(false);
  const hasta = sumarDias(desde, DIAS);
  const personal = usePersonal();
  const filas = useQuery({
    queryKey: [...CLAVE, "cuadrillas", desde],
    queryFn: () => q<CuadrillaFila[]>(supabase.from("v_servicio_cuadrilla").select("*")
      .lt("inicio", instanteMx(hasta, "00:00").toISOString()).gt("fin", instanteMx(desde, "00:00").toISOString()).order("inicio")),
  });

  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(desde, i));
  const hoy = isoLocal(new Date());
  const enUso = new Set((filas.data ?? []).map((f) => f.empleado_id));
  // Todo el personal del taller (o solo quien sale a servicio), en el orden de las etapas.
  const gente = (personal.data ?? []).filter((p) => p.activo && (todos ? p.etapa_id != null || enUso.has(p.id) : enUso.has(p.id)));
  for (const f of filas.data ?? []) {
    if (!gente.some((g) => g.id === f.empleado_id)) {
      gente.push({ id: f.empleado_id, nombre: f.empleado ?? "—", puesto: f.puesto, etapa: f.etapa, etapa_color: f.etapa_color,
                   etapa_id: f.etapa_id, numero: null, departamento: null, activo: true });
    }
  }
  const libres = (personal.data ?? []).filter((p) => p.activo && p.etapa_id != null && !enUso.has(p.id)).length;
  const mover = (semanas: number) => setDesde((d) => sumarDias(d, 7 * semanas));
  const tiposVistos = ORDEN_TIPOS.filter((t) => (filas.data ?? []).some((f) => f.tipo === t));

  return (
    <Tarjeta className={className}>
      <EncabezadoTarjeta
        titulo="Calendario de cuadrillas"
        descripcion={`${fmtMes.format(comoFecha(dias[0]))} al ${fmtMes.format(comoFecha(dias[DIAS - 1]))} · ${enUso.size} ${enUso.size === 1 ? "persona sale" : "personas salen"} a servicio, ${libres} del taller sin servicio`}
        acciones={<>
          <Boton variante="fantasma" tamano="icono" onClick={() => mover(-1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Boton>
          <Boton variante="secundario" tamano="sm" onClick={() => setDesde(lunesDe(new Date()))}>Hoy</Boton>
          <Boton variante="fantasma" tamano="icono" onClick={() => mover(1)} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></Boton>
        </>}
      />
      <div className="px-5 pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Leyenda series={(tiposVistos.length ? tiposVistos : ORDEN_TIPOS).map((t) => ({ nombre: TIPOS[t].texto, color: TIPOS[t].color }))} />
          <label className="inline-flex items-center gap-2 text-xs text-tenue cursor-pointer select-none">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="accent-[hsl(var(--marca))]" />
            Ver a todo el taller
          </label>
        </div>
        {filas.error ? <ErrorCarga error={filas.error} /> : filas.isLoading || personal.isLoading ? <Cargando filas={4} /> : gente.length === 0 ? (
          <Vacio icono={CalendarRange} titulo="Nadie sale a servicio en estas dos semanas"
                 texto="Cuando la gerencia programe un servicio con su cuadrilla, aquí se ve quién va, a dónde y cuánto tiempo." />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `minmax(8.5rem, 11rem) repeat(${DIAS}, minmax(2.6rem, 1fr))` }} role="table" aria-label="Calendario de cuadrillas">
              <div role="columnheader" />
              {dias.map((d) => {
                const finde = esFinde(d);
                const esHoy = d === hoy;
                return (
                  <div key={d} role="columnheader"
                       className={cn("text-center text-[11px] leading-tight py-1 border-b border-borde", finde && "bg-fondo text-tenue", esHoy && "text-marca-texto font-semibold")}>
                    <span className="block uppercase">{fmtDia.format(comoFecha(d))}</span>
                    <span className={cn("cifra inline-block min-w-[1.5rem] rounded-full", esHoy && "bg-marca text-white")}>{comoFecha(d).getUTCDate()}</span>
                  </div>
                );
              })}
              {gente.map((p) => {
                const suyas = (filas.data ?? []).filter((f) => f.empleado_id === p.id);
                return (
                  <div key={p.id} className="contents" role="row">
                    <div role="rowheader" className="sticky left-0 z-10 bg-superficie py-1.5 pr-2 border-b border-borde/70 min-w-0">
                      <p className="text-sm truncate">{p.nombre}</p>
                      <p className="text-[11px] text-tenue truncate flex items-center gap-1">
                        {p.etapa_color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.etapa_color }} />}
                        {p.etapa ?? p.puesto ?? "—"}
                      </p>
                    </div>
                    <div className="relative border-b border-borde/70" style={{ gridColumn: `2 / span ${DIAS}` }}>
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DIAS}, 1fr)` }} aria-hidden>
                        {dias.map((d) => (
                          <span key={d} className={cn("border-l border-borde/40", esFinde(d) && "bg-fondo")} />
                        ))}
                      </div>
                      {suyas.map((f) => {
                        // Por día completo: un arreglo de 6 h en planta se ve igual de claro que una
                        // instalación de 3 días. La hora exacta va en el texto y en el globo.
                        const a = Math.max(0, diasEntre(desde, isoLocal(new Date(f.inicio))));
                        const b = Math.min(DIAS - 1, diasEntre(desde, isoLocal(new Date(new Date(f.fin).getTime() - 60_000))));
                        const izq = (a / DIAS) * 100;
                        const ancho = ((b - a + 1) / DIAS) * 100;
                        return (
                          <button key={f.servicio_id} type="button" onClick={() => ir(`/servicio/${f.servicio_id}`)}
                                  title={`${f.folio} · ${TIPOS[f.tipo].texto} · ${f.cliente ?? ""}${f.lugar ? ` · ${f.lugar}` : ""}\n${periodo(f.inicio, f.fin)} · ${horas(f.horas_taller)} de taller${f.jefe ? " · jefe de cuadrilla" : ""}`}
                                  className="absolute top-1 bottom-1 rounded-[4px] px-1.5 text-left text-[11px] leading-tight overflow-hidden hover:ring-2 hover:ring-marca/40 focus-visible:ring-2 focus-visible:ring-marca/60 outline-none"
                                  style={{ left: `calc(${izq}% + 1px)`, width: `calc(${ancho}% - 3px)`, ...estiloTipo(f.tipo), opacity: f.estado === "cerrada" ? 0.6 : 1 }}>
                            <span className="flex items-center gap-1 font-medium truncate">
                              {f.jefe && <Crown className="h-3 w-3 shrink-0" aria-label="Jefe de cuadrilla" />}
                              {f.cliente ?? f.folio}
                            </span>
                            <span className="block truncate text-tenue">{f.lugar ?? TIPOS[f.tipo].corto}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}
