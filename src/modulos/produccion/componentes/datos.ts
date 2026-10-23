import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha } from "@/lib/formato";

/** q() para consultas con relaciones (`almacen:almacenes(...)`): supabase-js infiere
 *  las relaciones como arreglos aunque sean de uno; aquí el tipo lo decide quien llama. */
export const consulta = <T,>(p: unknown) => q<T>(p as PromiseLike<{ data: T | null; error: { message: string } | null }>);

// Todo lo de producción cuelga de esta clave: un cambio en el taller (que
// siempre deja un evento) recarga de una vez tablero, carga, piso y detalle.
export const CLAVE = ["produccion"] as const;

export type EstadoOP = "planeada" | "liberada" | "en_proceso" | "terminada" | "entregada" | "cancelada";
export type EstadoOperacion = "pendiente" | "en_proceso" | "pausada" | "terminada";

export interface EtapaActiva {
  id: number; nombre: string; color: string; estado: EstadoOperacion; responsable: string | null; inicio: string | null;
  /** Quién la trabaja: quien tiene su tiempo abierto o, si nadie, la cuadrilla planeada. */
  cuadrilla?: string | null;
  /** Lo que lleva según reportó el piso (0 a menos de 1). */
  avance?: number | null;
}

export interface OrdenTablero {
  id: string; folio: string; numero_serie: string | null; estado: EstadoOP; prioridad: number;
  fecha_compromiso: string | null; inicio_plan: string | null; cantidad: number;
  clave: string; equipo: string; imagen_url: string | null; pedido_folio: string | null; cliente: string | null;
  horas_totales: number; horas_terminadas: number; avance: number;
  etapa_actual: string | null; siguiente_etapa: string | null; pausada: boolean; materiales_faltantes: number;
  dias_restantes: number | null; atrasada: boolean; revisada_ingenieria: boolean; revisada_almacen: boolean;
  ultimo_movimiento: string | null; pedido_id: string | null; para_stock: boolean; etapas_activas: EtapaActiva[];
  siguiente_etapa_id: number | null; siguiente_etapa_color: string | null; horas_pendientes: number;
  material_apartado: boolean; faltantes_sin_pedir: number; terminada_en: string | null; creado_en: string; notas: string | null;
  en_espera_motivo: string | null; en_espera_desde: string | null;
}

export interface Etapa { id: number; nombre: string; orden: number; color: string; activa: boolean; capacidad_horas_semana: number }

export interface CargaEtapa {
  etapa_id: number; nombre: string; color: string; orden: number; capacidad_horas_semana: number;
  horas_pendientes: number; en_proceso: number; pausadas: number; en_espera: number; horas_planeadas: number;
}

export interface OperacionPiso {
  id: string; orden_id: string; etapa_id: number; etapa: string; color: string; etapa_orden: number; estado: EstadoOperacion;
  horas_estimadas: number; inicio: string | null; fin: string | null; responsable: string | null;
  folio: string; numero_serie: string | null; clave: string; equipo: string; cliente: string | null; pedido_folio: string | null;
  prioridad: number; fecha_compromiso: string | null; dias_restantes: number | null; atrasada: boolean; avance: number;
  materiales_faltantes: number; orden_estado: EstadoOP; lista: boolean; espera_a: string | null;
  ultimo_problema: string | null; ultimo_problema_en: string | null;
  turno: number | null; horas_reales: number;
  cuadrilla: string | null; avance_etapa: number | null;
}

/** El personal para elegir en la terminal y el tablero: nombre, su área y dónde está ahorita. */
export interface PersonaPiso { id: string; nombre: string; etapa_id: number | null; trabajando_en: string | null; tiempo_id: string | null }
/** Un tiempo abierto: alguien (o "N sin nombre") trabajando una etapa desde `inicio`. */
export interface TramoAbierto { tiempo_id: string; operacion_id: string; empleado_id: string | null; nombre: string; personas: number; inicio: string }
/** La cuadrilla de una etapa: la que trabaja (en proceso) o la que la va a trabajar. */
export interface Asignacion { operacion_id: string; empleado_id: string }

export type TipoEvento = "creada" | "liberada" | "inicio" | "pausa" | "reanudar" | "fin" | "problema" | "nota" | "surtido"
  | "cambio_material" | "terminada" | "entregada" | "reabierta";

export interface Evento {
  id: number; orden_id: string; operacion_id: string | null; tipo: TipoEvento; nota: string | null; en: string;
  usuario_id: string | null; responsable: string | null; folio: string; numero_serie: string | null; equipo: string;
  etapa: string | null; etapa_color: string | null; usuario: string | null;
}

export interface PasoValidacion {
  paso: "ingenieria" | "apartado" | "faltantes" | "almacen" | "liberada"; titulo: string;
  estado: "hecho" | "parcial" | "pendiente" | "no_aplica"; por: string | null; en: string | null; detalle: string | null;
}

export interface MaterialOP {
  id: string; orden_id: string; articulo_id: string; clave: string; nombre: string; unidad: string;
  requerido: number; surtido: number; ruta: string | null; agregado: boolean; notas: string | null;
  apartado: number; faltante: number; pedido_a_compras: number; existencia_planta: number;
  por_surtir: number; disponible_planta: number; tipo: string;
}

export function useTablero() {
  return useQuery({
    queryKey: [...CLAVE, "tablero"],
    queryFn: () => q<OrdenTablero[]>(supabase.from("v_tablero_produccion").select("*").order("prioridad").order("fecha_compromiso", { nullsFirst: false })),
  });
}

export function useEtapas() {
  return useQuery({
    queryKey: [...CLAVE, "etapas"],
    staleTime: 10 * 60_000,
    queryFn: () => q<Etapa[]>(supabase.from("etapas").select("*").eq("activa", true).order("orden")),
  });
}

export function useCarga() {
  return useQuery({
    queryKey: [...CLAVE, "carga"],
    queryFn: () => q<CargaEtapa[]>(supabase.from("v_carga_etapas").select("*").order("orden")),
  });
}

export function useEventos(limite = 20, ordenId?: string) {
  return useQuery({
    queryKey: [...CLAVE, "eventos", limite, ordenId ?? "todas"],
    queryFn: () => {
      let c = supabase.from("v_op_eventos").select("*").order("en", { ascending: false }).order("id", { ascending: false }).limit(limite);
      if (ordenId) c = c.eq("orden_id", ordenId);
      return q<Evento[]>(c);
    },
  });
}

export function usePiso(opciones: { etapa?: number | null; intervalo?: number } = {}) {
  return useQuery({
    queryKey: [...CLAVE, "piso", opciones.etapa ?? "todas"],
    refetchInterval: opciones.intervalo,
    queryFn: () => {
      let c = supabase.from("v_piso_operaciones").select("*");
      if (opciones.etapa) c = c.eq("etapa_id", opciones.etapa);
      return q<OperacionPiso[]>(c);
    },
  });
}

/** Cómo se cuentan las horas de la terminal (lo elige la gerencia en Personal de piso). */
/** Entrada y salida, como «08:00» y «17:30». */
export type Tramo = [string, string];
export interface Descanso { de: string; a: string; minutos?: number }
export interface HorasTaller {
  modo: "horario" | "terminal"; descansos: Descanso[];
  /** Por día de la semana: "1" = lunes … "7" = domingo; el día que falta no se trabaja. */
  horario?: Record<string, Tramo>;
  /** Días con otro horario («2026-10-24»): tiempo extra, o null si ese día no se trabaja. */
  especiales?: Record<string, Tramo | null>;
}
export function useHorasTaller() {
  return useQuery({
    queryKey: [...CLAVE, "horas_taller"], staleTime: 5 * 60_000,
    queryFn: async () => (await q<{ valor: HorasTaller }[]>(supabase.from("configuracion").select("valor").eq("clave", "horas_taller")))[0]?.valor
      ?? { modo: "horario", descansos: [] } as HorasTaller,
  });
}
/** Lo que da cada día de la semana con el horario de siempre (lo calcula la base). */
export function useJornadas() {
  return useQuery({
    queryKey: [...CLAVE, "horas_taller", "jornadas"], staleTime: 5 * 60_000,
    queryFn: () => q<{ dia: number; entrada: string; salida: string; horas: number }[]>(supabase.rpc("jornadas_taller")),
  });
}
export interface HorarioAhora { modo: HorasTaller["modo"]; en_horario: boolean; cierra: string | null; abre: string | null }
/** ¿El taller está en horario ahorita? Se revisa cada minuto: a las 17:30 la pantalla cambia sola. */
export function useHorarioAhora() {
  return useQuery({
    queryKey: [...CLAVE, "horas_taller", "ahora"], refetchInterval: 60_000, staleTime: 30_000,
    queryFn: () => q<HorarioAhora>(supabase.rpc("horario_taller_ahora")),
  });
}
const DIAS_CORTOS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const hhmm = (h: string) => h.replace(/^0(\d)/, "$1");
/** «de lunes a viernes de 8:00 a 17:30 y el sábado de 8:00 a 14:00». */
export function textoHorario(h: HorasTaller["horario"]) {
  const dias = Object.entries(h ?? {}).filter(([, v]) => v).map(([k, v]) => ({ d: Number(k), v: v as Tramo })).sort((x, y) => x.d - y.d);
  const grupos: { de: number; a: number; v: Tramo }[] = [];
  for (const x of dias) {
    const u = grupos[grupos.length - 1];
    if (u && u.a === x.d - 1 && u.v[0] === x.v[0] && u.v[1] === x.v[1]) u.a = x.d;
    else grupos.push({ de: x.d, a: x.d, v: x.v });
  }
  const t = grupos.map((g) => `${g.de === g.a ? `el ${DIAS_CORTOS[g.de]}` : g.a === g.de + 1 ? `${DIAS_CORTOS[g.de]} y ${DIAS_CORTOS[g.a]}` : `de ${DIAS_CORTOS[g.de]} a ${DIAS_CORTOS[g.a]}`} de ${hhmm(g.v[0])} a ${hhmm(g.v[1])}`);
  return t.length > 1 ? `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}` : t[0] ?? "ningún día";
}
/** «hoy a las 8:00», «mañana a las 8:00», «el lunes a las 8:00»: cuándo vuelve a contar. */
export function cuandoAbre(abre: string | null) {
  if (!abre) return null;
  const d = new Date(abre);
  const dia = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86_400_000);
  const hora = d.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const iso = (new Date(dia(d) + "T12:00:00").getDay() + 6) % 7 + 1;
  const lejos = d.getTime() - hoy.getTime() > 6 * 86_400_000;
  const cuando = dia(d) === dia(hoy) ? "hoy" : dia(d) === dia(manana) ? "mañana" : lejos ? `el ${fecha(dia(d))}` : `el ${DIAS_CORTOS[iso]}`;
  return `${cuando} a las ${hora}`;
}
/** «40 min entre 10:00 y 11:00 y de 15:00 a 15:20», para decir qué se descuenta. */
export function textoDescansos(d: HorasTaller["descansos"]) {
  const t = d.map((x) => (x.minutos ? `${x.minutos} min entre ${x.de} y ${x.a}` : `de ${x.de} a ${x.a}`));
  return t.length > 1 ? `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}` : t[0] ?? "ninguno";
}

export function usePersonalPiso() {
  return useQuery({ queryKey: [...CLAVE, "personal_piso"], staleTime: 30_000, queryFn: () => q<PersonaPiso[]>(supabase.rpc("personal_de_piso")) });
}
export function useCuadrillas() {
  return useQuery({ queryKey: [...CLAVE, "cuadrillas"], queryFn: () => q<TramoAbierto[]>(supabase.rpc("cuadrillas_abiertas")) });
}
export function useAsignaciones() {
  return useQuery({ queryKey: [...CLAVE, "asignaciones"], queryFn: () => q<Asignacion[]>(supabase.from("op_asignaciones").select("operacion_id, empleado_id")) });
}

/**
 * Cada acción de producción deja un evento: con escuchar eventos y órdenes basta
 * para que todo se mueva solo. Una acción toca varias filas a la vez (crear dos
 * órdenes = 2 órdenes + 2 eventos + el pedido); sin juntar los avisos, cada uno
 * cancelaba la recarga anterior y la pantalla tardaba segundos en asentarse.
 */
export function useProduccionEnVivo(tablas: string[] = ["op_eventos", "ordenes_produccion"]) {
  const qc = useQueryClient();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const recargar = () => { clearTimeout(t); t = setTimeout(() => qc.invalidateQueries({ queryKey: CLAVE }), 350); };
    let canal = supabase.channel(`produccion-${Math.random().toString(36).slice(2)}`);
    for (const tabla of tablas) canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, recargar);
    canal.subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, tablas.join(",")]);
}
