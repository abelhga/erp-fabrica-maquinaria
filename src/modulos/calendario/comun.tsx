// Lo que comparten el Calendario y la agenda de «Tu semana»: la consulta, los colores por
// área y cómo se pinta un renglón. Las fechas salen de calendario() con tus permisos.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Cake, CalendarOff, ClipboardList, Factory, Hand, HandCoins, KanbanSquare, ListTodo, MessageCircleQuestionMark, PackageCheck, PhoneCall, Ship,
  Truck, Undo2, Wrench, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { fecha, hoyISO } from "@/lib/formato";
import { SERIE } from "@/components/graficas/comunes";
import { Insignia } from "@/components/ui/insignia";
import { GLOSARIO } from "@/tutorial/glosario";

export type TonoCal = "peligro" | "aviso" | "ok" | "neutro" | "info" | "marca";
export interface EventoCal {
  clave: string; tipo: string; area: string; fecha: string; fecha_fin: string | null; hora: string | null;
  titulo: string; detalle: string | null; ruta: string | null; tono: TonoCal; mio: boolean;
}

// Un color por área en orden fijo: la misma área siempre del mismo color, se filtre lo que se
// filtre. Compras e importaciones van juntas (las dos son «lo que llega»): con ocho áreas el
// octavo color era rojo y se confundía con lo atrasado.
export const AREAS = [
  { valor: "ventas", texto: "Ventas", color: SERIE(1) },
  { valor: "produccion", texto: "Producción", color: SERIE(2) },
  { valor: "compras", texto: "Compras e importaciones", color: SERIE(3) },
  { valor: "servicio", texto: "Servicio y mantenimiento", color: SERIE(4) },
  { valor: "finanzas", texto: "Pagos", color: SERIE(5) },
  { valor: "rrhh", texto: "Personas", color: SERIE(6) },
  { valor: "personal", texto: "Pendientes", color: SERIE(7) },
] as const;
export type AreaCal = (typeof AREAS)[number]["valor"];
export const areaDe = (a: string): AreaCal => (a === "importaciones" ? "compras" : (a as AreaCal));
export const colorDe = (a: string) => AREAS.find((x) => x.valor === areaDe(a))?.color ?? SERIE(1);
export const textoArea = (a: string) => AREAS.find((x) => x.valor === areaDe(a))?.texto ?? a;

export const ICONO: Record<string, LucideIcon> = {
  entrega: Truck, oportunidad: KanbanSquare, actividad: PhoneCall, llamar: PhoneCall, seguimiento: MessageCircleQuestionMark, devolucion: Undo2,
  compromiso: Factory, fin_plan: Factory, arranque: Factory, requisicion: ClipboardList, compra: PackageCheck,
  embarque: Ship, recoleccion: Truck, servicio: Wrench, servicio_pedido: Wrench, preventivo: Wrench, resguardo: Hand,
  pago: HandCoins, ausencia: CalendarOff, cumpleanos: Cake, pendiente: ListTodo,
};

/** Fechas como «2026-10-22» (hora de la planta): sumar días sin que el horario de verano mueva nada. */
export const masDias = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
/** 0 = lunes … 6 = domingo. */
export const diaSemana = (iso: string) => (new Date(iso + "T12:00:00").getDay() + 6) % 7;
export const lunesDe = (iso: string) => masDias(iso, -diaSemana(iso));

export function useCalendario(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["calendario", desde, hasta],
    staleTime: 60_000,
    queryFn: () => q<EventoCal[]>(supabase.rpc("calendario", { p_desde: desde, p_hasta: hasta })),
  });
}

/** En rojo: lo vencido, y lo que según el plan sale después de su compromiso (eso es futuro). */
export const enRojo = (e: EventoCal) => e.tono === "peligro";
/** Atrasado de verdad: sigue abierto y su fecha ya pasó. */
export const atrasado = (e: EventoCal) => e.tono === "peligro" && e.fecha < hoyISO();
// Lo que se repite mucho y pesa poco (qué entra a cada área según el plan, cumpleaños, quién
// falta) va al final del día: primero entregas, compromisos y lo que llega.
const AL_FINAL = ["arranque", "cumpleanos", "ausencia"];
export const ordenDelDia = (a: EventoCal, b: EventoCal) => Number(atrasado(b)) - Number(atrasado(a))
  || Number(AL_FINAL.includes(a.tipo)) - Number(AL_FINAL.includes(b.tipo))
  || (a.hora ?? "99").localeCompare(b.hora ?? "99")
  || AREAS.findIndex((x) => x.valor === areaDe(a.area)) - AREAS.findIndex((x) => x.valor === areaDe(b.area));

/** Un renglón de agenda: color del área, qué es, de qué área y si va atrasado. */
export function Renglon({ e, conDia }: { e: EventoCal; conDia?: string }) {
  const Icono = ICONO[e.tipo] ?? ListTodo;
  const cuerpo = (
    <>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorDe(e.area) }} aria-hidden />
      {conDia && <span className={cn("w-[4.5rem] shrink-0 text-xs font-medium cifra first-letter:uppercase", enRojo(e) ? "text-peligro" : "text-tenue")}>{conDia}</span>}
      <Icono className="h-4 w-4 shrink-0 text-tenue" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm truncate", enRojo(e) && "text-peligro")}>{e.titulo}</span>
        <span className="block text-xs text-tenue truncate">{textoArea(e.area)}{e.fecha_fin && ` · hasta el ${fecha(e.fecha_fin)}`}{e.detalle && ` · ${e.detalle}`}</span>
      </span>
      {e.hora && <span className="text-xs cifra text-tenue shrink-0">{e.hora}</span>}
      {/* En celular basta el rojo; la insignia le quitaba espacio al nombre. */}
      {atrasado(e) && <span className="hidden sm:inline-flex" data-explain={GLOSARIO.atrasadoCalendario} data-explain-title="Atrasado"><Insignia tono="peligro">Atrasado</Insignia></span>}
      {enRojo(e) && !atrasado(e) && <span className="hidden sm:inline-flex"><Insignia tono="peligro">Después del compromiso</Insignia></span>}
      {e.mio && !enRojo(e) && <span className="hidden sm:inline-flex" data-explain={GLOSARIO.soloLoMio} data-explain-title="Tuyo"><Insignia tono="marca">Tuyo</Insignia></span>}
    </>
  );
  const clase = "flex items-center gap-3 px-4 py-2.5";
  return e.ruta ? <Link to={e.ruta} className={cn(clase, "hover:bg-fondo")}>{cuerpo}</Link> : <div className={clase}>{cuerpo}</div>;
}
