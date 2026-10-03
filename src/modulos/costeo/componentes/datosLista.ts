import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { enTrozos, type TipoArticulo } from "./comun";

/** Fila de arbol_lista_materiales: la ruta va por líneas, así cada instancia de un subensamble tiene su propio contenido. */
export interface LineaArbol {
  linea_id: string; ruta: string[]; padre_id: string; articulo_id: string; clave: string; nombre: string; tipo: TipoArticulo;
  unidad: string; cantidad: number; parametro: string | null; por_parametro: number; redondear_arriba: boolean; merma: number;
  grupo: string | null; notas: string | null; orden: number; cantidad_efectiva: number; cantidad_total: number; nivel: number;
  lineas_hijo: number;
}

export interface CostoHijo { articulo_id: string; costo_total: number; sin_costo: number; costo_mas_viejo: string | null }

export const claveArbol = (id: string) => ["costeo", "arbol", id];

export function useArbol(id: string | undefined) {
  return useQuery({
    queryKey: claveArbol(id ?? ""),
    enabled: !!id,
    queryFn: async () => (await q<LineaArbol[]>(supabase.rpc("arbol_lista_materiales", { p_articulo: id }))).map((l) => ({
      ...l, cantidad: Number(l.cantidad), por_parametro: Number(l.por_parametro), merma: Number(l.merma),
      cantidad_efectiva: Number(l.cantidad_efectiva), cantidad_total: Number(l.cantidad_total),
    })),
  });
}

/** Costo unitario (MXN) de cada artículo del árbol. Solo se pide con permiso de costos. */
export function useCostosDe(ids: string[], habilitado: boolean) {
  const llave = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["costeo", "costos-de", llave],
    enabled: habilitado && ids.length > 0,
    queryFn: async () => {
      const filas = await enTrozos<CostoHijo>(ids, (t) =>
        supabase.from("costos_calculados").select("articulo_id, costo_total, sin_costo, costo_mas_viejo").in("articulo_id", t));
      return new Map(filas.map((f) => [f.articulo_id, { ...f, costo_total: Number(f.costo_total) }]));
    },
  });
}

export const llaveRuta = (r: string[]) => r.join("/");
