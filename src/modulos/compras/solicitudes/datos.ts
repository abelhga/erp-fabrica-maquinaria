import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import type { Tono } from "@/components/ui/insignia";
import { comprimirImagen } from "@/modulos/servicio/datos";

// Lo de solicitudes de precio cuelga de esta clave: la cola de compras, "Mis
// solicitudes" y las partidas del cotizador se recargan juntas cuando cambia algo.
export const CLAVE = ["solicitudes_precio"] as const;

export type EstadoSolicitud = "abierta" | "tomada" | "contestada" | "no_se_consigue" | "cancelada";
export type Semaforo = "vencida" | "por_vencer" | "a_tiempo";
export type Moneda = "MXN" | "USD" | "EUR";

/** Una fila de v_solicitudes_precio. costo, moneda y proveedor llegan en null a quien no ve costos. */
export interface Solicitud {
  id: string; folio: string; estado: EstadoSolicitud; urgente: boolean;
  solicitante_id: string; solicitante: string; solicitante_iniciales: string | null;
  cotizacion_id: string | null; cotizacion_folio: string | null; partida_id: string | null; cliente_id: string | null; cliente: string | null;
  articulo_id: string | null; clave: string | null; articulo: string | null; unidad: string; articulo_tipo: string | null;
  descripcion: string | null; marca: string | null; modelo: string | null; cantidad: number; notas: string | null;
  creado_en: string; vence_en: string; tomada_por: string | null; tomada_por_nombre: string | null; tomada_en: string | null;
  contestada_por: string | null; contestada_por_nombre: string | null; contestada_en: string | null;
  tiempo_entrega_dias: number | null; vigencia_hasta: string | null; respuesta: string | null;
  precio_lista: number | null; precio_lista_actual: number | null;
  horas_acuse: number | null; horas_respuesta: number | null; aplicada_en: string | null;
  cancelada_en: string | null; motivo_cancelacion: string | null; cancelada_por_nombre: string | null;
  costo: number | null; moneda: Moneda | null; proveedor_id: string | null; proveedor: string | null;
  fotos: number; horas_restantes: number | null; horas_transcurridas: number | null; horas_vencida: number | null; semaforo: Semaforo | null;
  a_tiempo: boolean | null; usada: boolean | null;
}

export interface ResumenSolicitudes {
  abiertas: number; sin_tomar: number; por_vencer: number; vencidas: number; contestadas_hoy: number; sin_usar: number;
  mes: {
    resueltas: number; mediana_horas: number | null; mediana_acuse: number | null; mas_de_un_dia: number;
    abiertas_mas_de_un_dia: number; pct_mas_de_un_dia: number | null; a_tiempo: number;
  };
  linea_base: { mediana_horas: number; pct_mas_de_un_dia: number; mediana_horas_2026: number; pct_mas_de_un_dia_2026: number; fuente: string };
}

export const ESTADO_SOL: Record<EstadoSolicitud, { texto: string; tono: Tono }> = {
  abierta: { texto: "Sin tomar", tono: "aviso" },
  tomada: { texto: "Cotizando", tono: "info" },
  contestada: { texto: "Con precio", tono: "ok" },
  no_se_consigue: { texto: "No se consigue", tono: "peligro" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

export const SEMAFORO: Record<Semaforo, { texto: string; tono: Tono; punto: string }> = {
  vencida: { texto: "Vencida", tono: "peligro", punto: "bg-peligro" },
  por_vencer: { texto: "Por vencer", tono: "aviso", punto: "bg-aviso" },
  a_tiempo: { texto: "A tiempo", tono: "ok", punto: "bg-ok" },
};

export const abierta = (s: Pick<Solicitud, "estado">) => s.estado === "abierta" || s.estado === "tomada";

/** Lo que se pide, como se lee en una lista: el artículo del catálogo o la descripción libre. */
export const queSePide = (s: Pick<Solicitud, "articulo" | "descripcion">) => s.articulo ?? s.descripcion ?? "—";
export const marcaModelo = (s: Pick<Solicitud, "marca" | "modelo">) => [s.marca, s.modelo].filter(Boolean).join(" ");

const num1 = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
/** 0.4 → "24 min", 3.25 → "3.3 h" (horas hábiles). */
export function horas(h: number | null | undefined) {
  if (h == null) return "—";
  const n = Number(h);
  if (n < 1) return `${Math.max(1, Math.round(n * 60))} min`;
  return `${num1.format(n)} h`;
}

const ZONA = "America/Mexico_City";
const hora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA });
const dia = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "2-digit", month: "short", timeZone: ZONA });
const diaPlanta = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA });

/** "hoy 13:13", "lun 05 oct 10:01" en la hora de la planta. */
export function cuando(f: string | null | undefined) {
  if (!f) return "—";
  const d = new Date(f);
  const hoy = diaPlanta(new Date());
  const manana = diaPlanta(new Date(Date.now() + 86_400_000));
  const ayer = diaPlanta(new Date(Date.now() - 86_400_000));
  const k = diaPlanta(d);
  const prefijo = k === hoy ? "hoy" : k === manana ? "mañana" : k === ayer ? "ayer" : dia.format(d).replace(".", "");
  return `${prefijo} ${hora.format(d)}`;
}

/** El plazo como lo lee compras: "vence hoy 13:13 (quedan 48 min)" o "venció hace 4 h hábiles". */
export function plazo(s: Pick<Solicitud, "semaforo" | "vence_en" | "horas_restantes" | "horas_vencida" | "estado">) {
  if (!abierta(s)) return null;
  if (s.semaforo === "vencida") return `venció ${cuando(s.vence_en)} · hace ${horas(s.horas_vencida)} hábiles`;
  return `vence ${cuando(s.vence_en)} · quedan ${horas(s.horas_restantes)}`;
}

export function useSolicitudes(opciones: { cotizacionId?: string; habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: [...CLAVE, "lista", opciones.cotizacionId ?? "todas"],
    enabled: opciones.habilitado ?? true,
    queryFn: () => {
      let c = supabase.from("v_solicitudes_precio").select("*");
      if (opciones.cotizacionId) c = c.eq("cotizacion_id", opciones.cotizacionId);
      return q<Solicitud[]>(c.order("creado_en", { ascending: false }).limit(1000));
    },
  });
}

export function useResumenSolicitudes() {
  return useQuery({
    queryKey: [...CLAVE, "resumen"],
    queryFn: () => q<ResumenSolicitudes>(supabase.rpc("resumen_solicitudes_precio")),
  });
}

/** Estado en vivo: cuando compras toma o contesta, al vendedor se le actualiza solo (y al revés). */
export function useSolicitudesEnVivo() {
  useTiempoReal("solicitudes_precio", [CLAVE]);
}

// -----------------------------------------------------------------------------
// Fotos ("esta polea"): bucket privado; se achican en el teléfono antes de subir y
// se ven con enlaces firmados.
// -----------------------------------------------------------------------------
export const BUCKET = "solicitudes-precio";

export async function subirFotoSolicitud(solicitudId: string, archivo: File) {
  const blob = await comprimirImagen(archivo);
  const extension = blob.type === "image/png" ? "png" : blob.type === "application/pdf" ? "pdf" : "jpg";
  const ruta = `${solicitudId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(/row-level security|Unauthorized|403/i.test(error.message) ? "No tienes permiso para subir fotos a esta solicitud." : error.message);
  await q(supabase.rpc("agregar_foto_solicitud", { p_solicitud: solicitudId, p_ruta: ruta }));
  return ruta;
}

export function useFotosSolicitud(solicitudId: string | null | undefined, cuantas: number) {
  return useQuery({
    queryKey: [...CLAVE, "fotos", solicitudId, cuantas],
    enabled: !!solicitudId && cuantas > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const filas = await q<{ id: string; ruta: string }[]>(supabase.from("solicitudes_precio_fotos").select("id, ruta").eq("solicitud_id", solicitudId!).order("en"));
      if (!filas.length) return [];
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(filas.map((f) => f.ruta), 3600);
      if (error) throw new Error(error.message);
      const urls = Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
      return filas.map((f) => ({ ...f, url: urls[f.ruta] as string | undefined, pdf: f.ruta.endsWith(".pdf") }));
    },
  });
}
