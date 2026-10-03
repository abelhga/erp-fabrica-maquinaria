import type { Tono } from "@/components/ui/insignia";
import { hace } from "@/lib/formato";
import type { EstadoOP, EstadoOperacion, Evento } from "./datos";

export const ESTADO_OP: Record<EstadoOP, { texto: string; tono: Tono }> = {
  planeada: { texto: "Planeada", tono: "neutro" },
  liberada: { texto: "Liberada", tono: "info" },
  en_proceso: { texto: "En proceso", tono: "marca" },
  terminada: { texto: "Terminada", tono: "ok" },
  entregada: { texto: "Entregada", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "peligro" },
};

export const ESTADO_OPERACION: Record<EstadoOperacion, { texto: string; tono: Tono }> = {
  pendiente: { texto: "Pendiente", tono: "neutro" },
  en_proceso: { texto: "En proceso", tono: "marca" },
  pausada: { texto: "Pausada", tono: "aviso" },
  terminada: { texto: "Terminada", tono: "ok" },
};

export const PRIORIDAD: Record<number, { texto: string; tono: Tono }> = {
  1: { texto: "Urgente", tono: "peligro" },
  2: { texto: "Normal", tono: "neutro" },
  3: { texto: "Baja", tono: "neutro" },
};

/** Rojo si ya pasó, ámbar si quedan 3 días o menos, verde si va con tiempo. */
export function tonoCompromiso(dias: number | null | undefined, cerrada = false): Tono {
  if (cerrada) return "ok";
  if (dias == null) return "neutro";
  if (dias < 0) return "peligro";
  if (dias <= 3) return "aviso";
  return "ok";
}

export function textoDias(dias: number | null | undefined) {
  if (dias == null) return "Sin fecha";
  if (dias < 0) return `${-dias} ${dias === -1 ? "día" : "días"} tarde`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

/** "OP-2026-00012" → "OP-00012": en el piso el año sobra. */
export const folioCorto = (f: string) => f.replace(/^([A-Z]+)-\d{4}-/, "$1-");

// Los nombres del catálogo son de cotización ("Transportador helicoidal tipo bazuca
// de 10" x 12 metros con motor intermedio"); en una tarjeta o en la TV se leen mejor cortos.
const ABREVIATURAS: [RegExp, string][] = [
  [/Transportador helicoidal tipo bazuca/gi, "Bazuca"],
  [/Transportador helicoidal/gi, "Helicoidal"],
  [/Banda transportadora tipo artesa/gi, "Banda artesa"],
  [/Banda transportadora/gi, "Banda"],
  [/\s*-?\s*Hegamex®?/gi, ""],
  [/ metros cúbicos/gi, " m³"],
  [/ metros?\b/gi, " m"],
  [/ mts\.?/gi, " m"],
  [/ toneladas/gi, " t"],
  [/ inoxidable/gi, " inox"],
  [/ con /gi, " c/ "],
  [/ sin /gi, " s/ "],
  [/ para /gi, " p/ "],
  [/\s{2,}/g, " "],
];
export function abreviarEquipo(nombre: string) {
  return ABREVIATURAS.reduce((s, [re, r]) => s.replace(re, r), nombre).trim();
}

/** "hace 3 min", "hace 2 h", "ayer"… para la actividad y el ticker. */
export function haceRato(f: string | null | undefined, ahora = Date.now()) {
  if (!f) return "—";
  const min = Math.floor((ahora - new Date(f).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return hace(f);
}

/** Una línea legible por evento, la misma en la gerencia, el detalle y la TV. */
export function textoEvento(e: Evento, conFolio = true) {
  const op = conFolio ? folioCorto(e.folio) : "la orden";
  const quien = e.responsable ? ` (${e.responsable})` : "";
  switch (e.tipo) {
    case "creada": return `Se creó ${op}`;
    case "liberada": return `${conFolio ? op : "Orden"} liberada al taller`;
    case "inicio": return `${e.etapa} inició ${op}${quien}`;
    case "pausa": return `${e.etapa} pausó ${op}${quien}`;
    case "reanudar": return `${e.etapa} reanudó ${op}${quien}`;
    case "fin": return `${e.etapa} terminó ${op}${quien}`;
    case "problema": return `Problema en ${e.etapa ?? "el taller"} · ${op}: ${e.nota ?? ""}`;
    case "surtido": return `Almacén surtió material a ${op}${e.nota ? ` (${e.nota})` : ""}`;
    case "terminada": return `${conFolio ? op : "Orden"} terminada`;
    case "entregada": return `${conFolio ? op : "Orden"} entregada`;
    case "cambio_material": return conFolio ? `${op} · ${e.nota}` : e.nota ?? "Cambio de material";
    default: {
      const quien = [e.etapa, conFolio ? op : null].filter(Boolean).join(" · ");
      return quien && e.nota ? `${quien}: ${e.nota}` : quien || e.nota || "Nota";
    }
  }
}

/** La ruta de la explosión empieza con el nombre del equipo; para agrupar sirve lo que sigue. */
export function grupoRuta(ruta: string | null, equipo: string) {
  if (!ruta || ruta === equipo) return "Directo al equipo";
  return ruta.startsWith(equipo + " › ") ? ruta.slice(equipo.length + 3) : ruta;
}

export const cifra = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(Number(n));

export const horas = (n: number | null | undefined) =>
  n == null ? "—" : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(Number(n))} h`;
