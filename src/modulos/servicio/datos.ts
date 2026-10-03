import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q, useTiempoReal } from "@/lib/consultas";
import { SERIE } from "@/components/graficas/comunes";
import type { Tono } from "@/components/ui/insignia";

// Todo lo de servicio y mantenimiento cuelga de esta clave: un cambio recarga
// tablero, calendario, ficha de la máquina y resguardos de una vez.
export const CLAVE = ["servicio"] as const;

export type TipoServicio = "instalacion" | "puesta_en_marcha" | "garantia" | "reparacion_planta" | "servicio_campo";
export type EstadoServicio = "solicitada" | "programada" | "en_curso" | "cerrada" | "cancelada";
export type EstadoMaquina = "operando" | "con_falla" | "en_mantenimiento" | "fuera_de_servicio" | "baja";
export type EstadoMto = "pendiente" | "en_proceso" | "cerrada" | "cancelada";
export type Momento = "recepcion" | "antes" | "durante" | "despues" | "entrega" | "firma" | "falla";

/** Color fijo por tipo (la serie N es siempre el mismo tipo, en claro y en oscuro). */
export const TIPOS: Record<TipoServicio, { texto: string; color: string; corto: string }> = {
  instalacion: { texto: "Instalación", corto: "Instalación", color: SERIE(1) },
  puesta_en_marcha: { texto: "Puesta en marcha", corto: "Arranque", color: SERIE(2) },
  garantia: { texto: "Garantía", corto: "Garantía", color: SERIE(3) },
  reparacion_planta: { texto: "Reparación en planta", corto: "Reparación", color: SERIE(4) },
  servicio_campo: { texto: "Servicio en campo", corto: "En campo", color: SERIE(5) },
};
export const ORDEN_TIPOS = Object.keys(TIPOS) as TipoServicio[];

export const ESTADO_SERVICIO: Record<EstadoServicio, { texto: string; tono: Tono }> = {
  solicitada: { texto: "Por programar", tono: "aviso" },
  programada: { texto: "Programado", tono: "info" },
  en_curso: { texto: "En curso", tono: "marca" },
  cerrada: { texto: "Cerrado", tono: "ok" },
  cancelada: { texto: "Cancelado", tono: "neutro" },
};

export const ESTADO_MAQUINA: Record<EstadoMaquina, { texto: string; tono: Tono }> = {
  operando: { texto: "Operando", tono: "ok" },
  con_falla: { texto: "Con falla", tono: "aviso" },
  en_mantenimiento: { texto: "En reparación", tono: "info" },
  fuera_de_servicio: { texto: "Parada", tono: "peligro" },
  baja: { texto: "Dada de baja", tono: "neutro" },
};

export const ESTADO_MTO: Record<EstadoMto, { texto: string; tono: Tono }> = {
  pendiente: { texto: "Sin atender", tono: "aviso" },
  en_proceso: { texto: "En reparación", tono: "info" },
  cerrada: { texto: "Cerrada", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

export const MOMENTOS: Record<Momento, string> = {
  recepcion: "Cómo llegó", antes: "Antes", durante: "Durante", despues: "Terminado", entrega: "Entrega",
  firma: "Firma", falla: "Falla",
};

export const PRIORIDAD: Record<number, { texto: string; tono: Tono }> = {
  1: { texto: "Urgente", tono: "peligro" }, 2: { texto: "Normal", tono: "neutro" }, 3: { texto: "Puede esperar", tono: "neutro" },
};

export interface Persona { id: string; nombre: string; puesto: string | null; etapa: string | null; etapa_color: string | null; jefe?: boolean }

export interface Servicio {
  id: string; folio: string; tipo: TipoServicio; tipo_nombre: string; estado: EstadoServicio; prioridad: number;
  cliente_id: string; cliente: string | null; vendedor_id: string | null; pedido_id: string | null; pedido_folio: string | null;
  orden_produccion_id: string | null; op_folio: string | null; numero_serie: string | null; equipo: string | null;
  descripcion: string; referencia: string | null; lugar: string | null; contacto_nombre: string | null; contacto_telefono: string | null;
  fecha_deseada: string | null; solicitado_por: string | null; solicitado_por_nombre: string | null; solicitado_en: string;
  inicio: string | null; fin: string | null; programado_por_nombre: string | null; programado_en: string | null;
  horas_por_persona: number; cuadrilla: Persona[];
  recibido_en: string | null; recibido_por_nombre: string | null; condicion_recepcion: string | null;
  iniciado_en: string | null; cerrado_en: string | null; cerrado_por_nombre: string | null; recibio_nombre: string | null;
  firma_ruta: string | null; notas_cierre: string | null; garantia_procede: boolean | null;
  cancelado_en: string | null; motivo_cancelacion: string | null;
  equipo_entregado: string | null; garantia_vence: string | null; en_garantia: boolean | null;
  fotos: number; fotos_recepcion: number; insumos_pendientes: number; dias_esperando: number | null;
}

export interface CuadrillaFila {
  servicio_id: string; folio: string; tipo: TipoServicio; tipo_nombre: string; estado: EstadoServicio; cliente: string | null;
  lugar: string | null; empleado_id: string; empleado: string | null; puesto: string | null; etapa_id: number | null;
  etapa: string | null; etapa_color: string | null; jefe: boolean; inicio: string; fin: string; horas_taller: number;
}

export interface PersonaServicio {
  id: string; numero: string | null; nombre: string; puesto: string | null; etapa_id: number | null; etapa: string | null;
  etapa_color: string | null; departamento: string | null; activo: boolean;
}

export interface CargaSemana {
  semana: string; etapa_id: number; etapa: string; color: string; orden: number; capacidad: number; horas_servicio: number;
  capacidad_disponible: number; horas_produccion: number; horas_planeadas: number; carga: number; saldo: number;
  ocupacion: number | null; servicios: { id: string; folio: string; tipo: TipoServicio; horas: number; personas: number }[];
}

export interface Maquina {
  id: string; numero: string; nombre: string; tipo: "maquina" | "herramienta" | "vehiculo" | "instalacion"; categoria: string;
  marca: string | null; modelo: string | null; numero_serie: string | null; etapa_id: number | null; etapa: string | null;
  etapa_color: string | null; ubicacion: string | null; estado: EstadoMaquina; critica: boolean; prestable: boolean;
  usa_horometro: boolean; horas_uso: number; horas_actualizado_en: string | null; foto_ruta: string | null; fecha_alta: string | null;
  notas: string | null; orden_id: string | null; orden_folio: string | null; orden_tipo: "correctivo" | "preventivo" | null;
  orden_estado: EstadoMto | null; orden_falla: string | null; orden_desde: string | null; parada_desde: string | null;
  ordenes_abiertas: number; fallas_12m: number; horas_paro_12m: number; ultima_falla: string | null;
  preventivo_fecha: string | null; preventivo_horas: number | null; preventivo: string | null;
  preventivo_situacion: "vencido" | "por_vencer" | "al_dia" | null;
  resguardo_id: string | null; prestada_a: string | null; prestada_desde: string | null;
}

export const TIPO_MAQUINA: Record<Maquina["tipo"], string> = {
  maquina: "Máquina", herramienta: "Herramienta", vehiculo: "Vehículo", instalacion: "Instalación",
};

export interface OrdenMto {
  id: string; folio: string; maquina_id: string; numero: string; maquina: string; categoria: string; maquina_tipo: string;
  etapa: string | null; tipo: "correctivo" | "preventivo"; estado: EstadoMto; falla: string | null; detiene: boolean;
  reportado_por_nombre: string | null; reportado_en: string; plan_id: string | null; plan: string | null; vence: string | null;
  vence_horas: number | null; diagnostico: string | null; atendido_por: string | null; trabajo_realizado: string | null;
  inicio_en: string | null; cerrada_en: string | null; cerrada_por_nombre: string | null; fuera_desde: string | null;
  fuera_hasta: string | null; horas_paro: number | null; horas_uso_al_cerrar: number | null; motivo_cancelacion: string | null;
  abierta: boolean; vencida: boolean; refacciones: number; refacciones_pendientes: number; fotos: number;
}

export interface Plan {
  id: string; maquina_id: string; numero: string; maquina: string; horas_actuales: number; nombre: string; tareas: string | null;
  cada_dias: number | null; cada_horas: number | null; ultima_fecha: string; ultima_horas: number; anticipacion_dias: number;
  activo: boolean; proxima_fecha: string | null; proximas_horas: number | null; dias_restantes: number | null;
  horas_restantes: number | null; situacion: "vencido" | "por_vencer" | "al_dia"; orden_id: string | null; orden_folio: string | null;
}

export interface Resguardo {
  id: string; maquina_id: string; numero: string; herramienta: string; categoria: string; empleado_id: string | null;
  quien: string; puesto: string | null; persona: string | null; servicio_id: string | null; servicio_folio: string | null;
  entregado_en: string; entregado_por_nombre: string | null; devolver_en: string | null; devuelto_en: string | null;
  recibido_por_nombre: string | null; estado_devolucion: "bien" | "con_dano" | "incompleta" | null; notas: string | null;
  notas_devolucion: string | null; abierto: boolean; dias: number; vencido: boolean;
}

export interface Material {
  id: string; servicio_id: string | null; mantenimiento_id: string | null; folio: string; para: string; articulo_id: string;
  clave: string; nombre: string; unidad: string; cantidad: number; estado: "pendiente" | "surtido" | "en_compra" | "cancelado";
  notas: string | null; pedido_en: string; pedido_por_nombre: string | null; surtido_en: string | null;
  surtido_por_nombre: string | null; requisicion_folio: string | null; existencia_planta: number;
}

export interface Evidencia {
  id: string; servicio_id: string | null; mantenimiento_id: string | null; momento: Momento; ruta: string; nota: string | null;
  en: string; subido_por_nombre: string | null;
}

export interface Costo {
  id: number; servicio_id: string | null; mantenimiento_id: string | null;
  concepto: "viaticos" | "material" | "servicio_externo" | "mano_obra" | "otro"; descripcion: string; monto: number; en: string;
}

export const CONCEPTOS: Record<Costo["concepto"], string> = {
  viaticos: "Viáticos", material: "Refacciones de almacén", servicio_externo: "Servicio externo", mano_obra: "Mano de obra", otro: "Otro",
};

/** Recarga lo de servicio cuando cambia algo en estas tablas (otra persona o el taller). */
export function useServicioEnVivo(tablas = ["servicios", "servicio_cuadrilla", "maquinas", "ordenes_mantenimiento", "resguardos", "servicio_materiales", "servicio_evidencias"]) {
  for (const t of tablas) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTiempoReal(t, [CLAVE]);
  }
}

export function useServicios() {
  return useQuery({
    queryKey: [...CLAVE, "servicios"],
    queryFn: () => q<Servicio[]>(supabase.from("v_servicios").select("*").order("solicitado_en", { ascending: false }).limit(500)),
  });
}

export function usePersonal() {
  return useQuery({
    queryKey: [...CLAVE, "personal"],
    staleTime: 10 * 60_000,
    queryFn: () => q<PersonaServicio[]>(supabase.rpc("personal_servicio")),
  });
}

export function useCarga(semanas = 6) {
  return useQuery({
    queryKey: [...CLAVE, "carga", semanas],
    queryFn: () => q<CargaSemana[]>(supabase.rpc("carga_semanal", { p_semanas: semanas })),
  });
}

export function useMaquinas() {
  return useQuery({
    queryKey: [...CLAVE, "maquinas"],
    queryFn: () => q<Maquina[]>(supabase.from("v_maquinas").select("*").order("numero")),
  });
}

export function useAlmacenesPlanta() {
  return useQuery({
    queryKey: ["almacenes", "planta"],
    staleTime: 30 * 60_000,
    queryFn: () => q<{ id: number; nombre: string }[]>(supabase.from("almacenes").select("id, nombre").eq("disponible_para_planta", true).order("id")),
  });
}

// La planta está en Guadalajara: los horarios de servicio se programan y se leen en
// hora de México, aunque el navegador (o quien lo abra de viaje) esté en otra zona.
// México no tiene horario de verano desde 2022: el desfase es fijo.
export const ZONA = "America/Mexico_City";
const DESFASE = "-06:00";

/** Fecha AAAA-MM-DD en la planta. */
export const isoLocal = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA });

/** "2026-10-05" + "08:30" en la planta → instante (ISO con su desfase). */
export const instanteMx = (dia: string, hora: string) => new Date(`${dia}T${hora}:00${DESFASE}`);

/** Hora HH:MM en la planta. */
export const horaMx = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(dia: string, n: number) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Días entre dos fechas AAAA-MM-DD. */
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

/** Lunes (AAAA-MM-DD) de la semana de un instante, en la planta. */
export function lunesDe(d: Date) {
  const dia = isoLocal(d);
  const dow = new Date(dia + "T12:00:00Z").getUTCDay();
  return sumarDias(dia, -((dow + 6) % 7));
}

export const horas = (h: number | null | undefined) =>
  h == null ? "—" : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(h)} h`;

/** "3 días" o "6 h", según lo que dure. */
export function duracion(inicio: string | null, fin: string | null) {
  if (!inicio || !fin) return "—";
  const h = (new Date(fin).getTime() - new Date(inicio).getTime()) / 3_600_000;
  if (h < 20) return horas(Math.round(h * 10) / 10);
  const dias = Math.round(h / 24 + 0.25);
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

const fmtDia = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "2-digit", month: "short", timeZone: ZONA });
/** "lun 05 oct, 08:30 → mié 07 oct, 17:30" o "mar 06 oct, 09:00 a 15:00" (hora de la planta). */
export function periodo(inicio: string | null, fin: string | null) {
  if (!inicio) return "Sin fecha";
  const a = new Date(inicio), b = fin ? new Date(fin) : null;
  const uno = (d: Date) => `${fmtDia.format(d)}, ${horaMx(d)}`;
  if (!b) return uno(a);
  if (isoLocal(a) === isoLocal(b)) return `${uno(a)} a ${horaMx(b)}`;
  return `${uno(a)} → ${uno(b)}`;
}

// -----------------------------------------------------------------------------
// Fotos: se achican en el teléfono antes de subir (el taller sube con datos del
// celular) y se ven con enlaces firmados, porque el bucket es privado.
// -----------------------------------------------------------------------------
export const BUCKET = "servicio";

export async function comprimirImagen(archivo: File, lado = 1600, calidad = 0.82): Promise<Blob> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/heic" || archivo.type === "image/heif") return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    return blob ?? archivo;
  } catch {
    return archivo;
  }
}

/** Sube un archivo a la carpeta del registro y devuelve su ruta en el bucket. */
export async function subirArchivo(carpeta: string, archivo: Blob, extension = "jpg") {
  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || (extension === "png" ? "image/png" : "image/jpeg"), upsert: false,
  });
  if (error) throw new Error(/row-level security|Unauthorized|403/i.test(error.message) ? "No tienes permiso para subir fotos aquí." : error.message);
  return ruta;
}

export function useUrlsFirmadas(rutas: string[]) {
  const clave = [...rutas].sort().join("|");
  return useQuery({
    queryKey: [...CLAVE, "urls", clave],
    enabled: rutas.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) as Record<string, string>;
    },
  });
}
