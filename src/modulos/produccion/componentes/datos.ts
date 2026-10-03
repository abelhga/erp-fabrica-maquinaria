import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";

/** q() para consultas con relaciones (`almacen:almacenes(...)`): supabase-js infiere
 *  las relaciones como arreglos aunque sean de uno; aquí el tipo lo decide quien llama. */
export const consulta = <T,>(p: unknown) => q<T>(p as PromiseLike<{ data: T | null; error: { message: string } | null }>);

// Todo lo de producción cuelga de esta clave: un cambio en el taller (que
// siempre deja un evento) recarga de una vez tablero, carga, piso y detalle.
export const CLAVE = ["produccion"] as const;

export type EstadoOP = "planeada" | "liberada" | "en_proceso" | "terminada" | "entregada" | "cancelada";
export type EstadoOperacion = "pendiente" | "en_proceso" | "pausada" | "terminada";

export interface EtapaActiva { id: number; nombre: string; color: string; estado: EstadoOperacion; responsable: string | null; inicio: string | null }

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
}

export type TipoEvento = "creada" | "liberada" | "inicio" | "pausa" | "reanudar" | "fin" | "problema" | "nota" | "surtido"
  | "cambio_material" | "terminada" | "entregada";

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
