import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";

export type TipoArticulo = "componente" | "materia_prima" | "subensamble" | "equipo" | "servicio";

export const NOMBRE_TIPO: Record<TipoArticulo, string> = {
  componente: "Componente", materia_prima: "Materia prima", subensamble: "Subensamble", equipo: "Equipo", servicio: "Servicio",
};
export const COMPRADOS: TipoArticulo[] = ["componente", "materia_prima", "servicio"];
export const esFabricado = (t: TipoArticulo | undefined) => t === "equipo" || t === "subensamble";
export const rutaArticulo = (a: { id: string; tipo: TipoArticulo }) =>
  `/costeo/${esFabricado(a.tipo) ? "equipos" : "componentes"}/${a.id}`;

/** Fila de v_catalogo. Los campos de costo solo llegan si el usuario tiene "costos" (y solo se piden entonces). */
export interface ArticuloCatalogo {
  id: string; clave: string; tipo: TipoArticulo; nombre: string; unidad: string; descripcion: string | null;
  categoria_id: number | null; categoria: string | null; familia: string | null; medida_especial: boolean;
  imagen_url: string | null; proveedor_id: string | null; proveedor: string | null; tiempo_entrega_dias: number | null;
  es_importado: boolean; meses_cobertura: number | null; stock_minimo_fijo: number | null; empaque: number;
  kg_por_unidad: number | null; se_vende: boolean; activo: boolean; controla_inventario: boolean;
  precio: number | null; precio_calculado_en: string | null; existencia: number | null; lineas_bom: number; usado_en: number;
  costo_total?: number | null; costo_material?: number | null; costo_mano_obra?: number | null; horas?: number | null;
  sin_costo?: number | null; costo_mas_viejo?: string | null; costo_capturado?: number | null;
  moneda_costo?: "MXN" | "USD" | "EUR" | null; costo_actualizado_en?: string | null;
}

const COLS_BASE = [
  "id", "clave", "tipo", "nombre", "unidad", "descripcion", "categoria_id", "categoria", "familia", "medida_especial",
  "imagen_url", "proveedor_id", "proveedor", "tiempo_entrega_dias", "es_importado", "meses_cobertura", "stock_minimo_fijo",
  "empaque", "kg_por_unidad", "se_vende", "activo", "controla_inventario", "precio", "precio_calculado_en", "existencia",
  "lineas_bom", "usado_en",
];
// Ni siquiera se piden si el usuario no tiene "costos": la RLS ya los devolvería vacíos,
// pero así en la consola de red de un vendedor no aparece ni el nombre de la columna.
const COLS_COSTOS = [
  "costo_total", "costo_material", "costo_mano_obra", "horas", "sin_costo", "costo_mas_viejo", "costo_capturado",
  "moneda_costo", "costo_actualizado_en",
];
export const columnasCatalogo = (conCostos: boolean) => [...COLS_BASE, ...(conCostos ? COLS_COSTOS : [])].join(",");

/** PostgREST corta en 1,000 filas; el catálogo tiene más de 5,000. Pide por páginas hasta acabar. */
export async function traerTodas<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const tam = 1000;
  const todo: T[] = [];
  for (let desde = 0; ; desde += tam) {
    const filas = await q<T[]>(pagina(desde, desde + tam - 1));
    todo.push(...(filas ?? []));
    if (!filas || filas.length < tam) break;
  }
  return todo;
}

/** Trozos para filtros `in (...)`: con cientos de ids la URL se vuelve demasiado larga. */
export async function enTrozos<T>(ids: string[], pedir: (trozo: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const res: T[] = [];
  for (let i = 0; i < ids.length; i += 120) res.push(...(await q<T[]>(pedir(ids.slice(i, i + 120)))));
  return res;
}

export function useCatalogo(tipos: TipoArticulo[]) {
  const { puede } = useSesion();
  const conCostos = puede("costos");
  return useQuery({
    queryKey: ["costeo", "catalogo", tipos.join(","), conCostos],
    queryFn: () => traerTodas<ArticuloCatalogo>((d, h) =>
      supabase.from("v_catalogo").select(columnasCatalogo(conCostos)).in("tipo", tipos).eq("activo", true)
        .order("clave").range(d, h) as unknown as PromiseLike<{ data: ArticuloCatalogo[] | null; error: { message: string } | null }>),
    staleTime: 30_000,
  });
}

export function useArticulo(id: string | undefined) {
  const { puede } = useSesion();
  const conCostos = puede("costos");
  return useQuery({
    queryKey: ["costeo", "articulo", id, conCostos],
    enabled: !!id,
    queryFn: () => q<ArticuloCatalogo | null>(
      supabase.from("v_catalogo").select(columnasCatalogo(conCostos)).eq("id", id!).maybeSingle() as unknown as
        PromiseLike<{ data: ArticuloCatalogo | null; error: { message: string } | null }>),
  });
}

export interface Parametro { articulo_id: string; nombre: string; valor: number; unidad: string | null; descripcion: string | null }

export function useParametros(id: string | undefined) {
  return useQuery({
    queryKey: ["costeo", "parametros", id],
    enabled: !!id,
    queryFn: () => q<Parametro[]>(supabase.from("articulo_parametros").select("*").eq("articulo_id", id!).order("nombre")),
  });
}

export interface Categoria { id: number; nombre: string; politica_id: number | null }
export function useCategorias() {
  return useQuery({
    queryKey: ["costeo", "categorias"],
    queryFn: () => q<Categoria[]>(supabase.from("categorias").select("id, nombre, politica_id").order("nombre")),
    staleTime: 5 * 60_000,
  });
}

/** Los tipos de equipo son las categorías que tienen política propia (las de la pestaña Reglas). */
export function useTiposEquipo() {
  const c = useCategorias();
  return { ...c, data: c.data?.filter((x) => x.politica_id != null) };
}

export interface Proveedor { id: string; nombre: string; es_importacion: boolean; moneda: string; dias_entrega: number | null }
export function useProveedores(habilitado = true) {
  return useQuery({
    queryKey: ["costeo", "proveedores"],
    enabled: habilitado,
    queryFn: () => q<Proveedor[]>(supabase.from("proveedores").select("id, nombre, es_importacion, moneda, dias_entrega").eq("activo", true).order("nombre")),
    staleTime: 5 * 60_000,
  });
}

/** Días desde una fecha `date` de Postgres. */
export function diasDesde(f: string | null | undefined) {
  if (!f) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(f + "T12:00:00") : new Date(f);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
/** Un costo de más de 6 meses ya no es confiable para cotizar (mismo criterio que el tablero de inicio). */
export const DIAS_COSTO_VIEJO = 180;
export const esCostoViejo = (f: string | null | undefined) => (diasDesde(f) ?? 0) > DIAS_COSTO_VIEJO;

const fmtCant = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });
/** Cantidades de lista de materiales: hasta 4 decimales (0.015 cubetas por metro, 0.83 rodillos por metro). */
export const cant = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : fmtCant.format(n));

/** "1,5" o "1.5" → 1.5; vacío → null. */
export function leerNumero(t: string): number | null {
  const limpio = t.trim().replace(/\s|\$/g, "");
  if (!limpio) return null;
  const n = Number(limpio.includes(".") ? limpio.replace(/,/g, "") : limpio.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const fmtPct = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
/** 0.0735 → "7.35 %" sin redondear a un decimal (los recargos llevan centésimas: 0.35 %). */
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${fmtPct.format(n * 100)} %`);
