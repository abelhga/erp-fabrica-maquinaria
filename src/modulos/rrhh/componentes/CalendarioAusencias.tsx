import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { FONDO_TIPO, TIPOS, type Incidencia, type TipoIncidencia } from "./comun";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const AUSENCIAS = (Object.keys(TIPOS) as TipoIncidencia[]).filter((t) => TIPOS[t].ausencia);

const iso = (d: Date) => d.toLocaleDateString("en-CA");
function corto(nombre: string) {
  const p = nombre.split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length > 2 ? p.length - 2 : 1][0]}.` : p[0];
}

/** Quién falta cada día del mes. Las solicitudes por aprobar se ven punteadas. */
export function CalendarioAusencias({ alElegirDia }: { alElegirDia?: (dia: string) => void }) {
  const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const desde = iso(mes);
  const hasta = iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));

  const dias = useQuery({
    queryKey: ["dias_del_mes", desde],
    queryFn: () => q<{ dia: string; habil: boolean; festivo: boolean }[]>(supabase.rpc("dias_del_mes", { p_mes: desde })),
  });
  const inc = useQuery({
    queryKey: ["incidencias", "calendario", desde],
    queryFn: () => q<Incidencia[]>(supabase.from("incidencias").select("*, empleado:empleados(nombre, numero, puesto)")
      .neq("estado", "rechazada").in("tipo", AUSENCIAS).lte("inicio", hasta).gte("fin", desde).order("inicio")),
  });

  const porDia = useMemo(() => {
    const m = new Map<string, Incidencia[]>();
    for (const i of inc.data ?? []) {
      for (let d = new Date(Math.max(new Date(i.inicio + "T12:00:00").getTime(), new Date(desde + "T12:00:00").getTime()));
        iso(d) <= i.fin && iso(d) <= hasta; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        m.set(k, [...(m.get(k) ?? []), i]);
      }
    }
    return m;
  }, [inc.data, desde, hasta]);

  const hoy = hoyISO();
  const primero = (mes.getDay() + 6) % 7;   // lunes = 0
  const celdas: (string | null)[] = [...Array(primero).fill(null), ...(dias.data ?? []).map((d) => d.dia)];
  while (celdas.length % 7) celdas.push(null);
  const info = new Map((dias.data ?? []).map((d) => [d.dia, d]));
  const usados = [...new Set((inc.data ?? []).map((i) => i.tipo))];

  return (
    <div className="tarjeta overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-borde">
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="icono" aria-label="Mes anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Boton>
          <h3 className="font-semibold w-40 text-center capitalize">{MESES[mes.getMonth()]} {mes.getFullYear()}</h3>
          <Boton variante="fantasma" tamano="icono" aria-label="Mes siguiente" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Boton>
        </div>
        <Boton variante="secundario" tamano="sm" onClick={() => { const h = new Date(); setMes(new Date(h.getFullYear(), h.getMonth(), 1)); }}>Hoy</Boton>
        <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-tenue">
          {usados.map((t) => <span key={t} className="inline-flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", FONDO_TIPO[t])} />{TIPOS[t].texto}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-tenue" />Por aprobar</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-fondo border border-borde" />No laborable</span>
        </div>
      </div>
      {dias.isLoading || inc.isLoading ? <Cargando filas={6} /> : (
        <div className="grid grid-cols-7">
          {DIAS_SEMANA.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-tenue border-b border-borde bg-fondo/60">{d}</div>)}
          {celdas.map((dia, k) => {
            if (!dia) return <div key={`v${k}`} className="min-h-[92px] border-b border-r border-borde/60 bg-fondo/40" />;
            const d = info.get(dia)!;
            const lista = porDia.get(dia) ?? [];
            return (
              <button type="button" key={dia} onClick={() => alElegirDia?.(dia)} disabled={!alElegirDia}
                className={cn("min-h-[92px] border-b border-r border-borde/60 p-1 sm:p-1.5 text-left align-top flex flex-col gap-1 enabled:hover:bg-marca-suave/30",
                  !d.habil && "bg-fondo/70")}
                title={alElegirDia ? "Registrar una incidencia este día" : undefined}>
                <span className={cn("text-xs cifra", dia === hoy ? "h-5 w-5 rounded-full bg-marca text-white flex items-center justify-center font-semibold" : "text-tenue")}>
                  {Number(dia.slice(8))}
                </span>
                {d.festivo && <span className="text-[10px] leading-tight text-aviso font-medium">Feriado</span>}
                {d.habil && lista.slice(0, 4).map((i) => (
                  <span key={i.id} title={`${i.empleado?.nombre} · ${TIPOS[i.tipo].texto}${i.estado === "solicitada" ? " (por aprobar)" : ""}`}
                    className={cn("truncate rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight font-medium", FONDO_TIPO[i.tipo],
                      i.estado === "solicitada" && "bg-transparent border border-dashed border-current")}>
                    <span className="sm:hidden">{(i.empleado?.nombre ?? "?").split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                    <span className="hidden sm:inline">{corto(i.empleado?.nombre ?? "?")}</span>
                  </span>
                ))}
                {d.habil && lista.length > 4 && <span className="text-[10px] text-tenue">+{lista.length - 4} más</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
