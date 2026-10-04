import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { EN_VISTA_PREVIA, supabase } from "./supabase";
import { MSJ_VISTA_PREVIA } from "./vistaPrevia";

/** Traduce errores de Postgres/PostgREST a algo que un usuario entienda. Los
 *  que lanzamos nosotros (raise exception) ya vienen en español y pasan tal cual. */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/read-only transaction/i.test(m)) return MSJ_VISTA_PREVIA;
  if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para hacer esto.";
  if (/duplicate key value.*\((\w+)\)/i.test(m)) return `Ya existe un registro con ese ${m.match(/\((\w+)\)/)?.[1] ?? "dato"}.`;
  if (/violates foreign key/i.test(m)) return "No se puede: hay otros registros que dependen de este.";
  if (/violates check constraint/i.test(m)) return "Algún dato no es válido (revisa cantidades y porcentajes).";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión con el servidor. Revisa tu internet.";
  return m;
}

/** Lanza el error de Supabase para que React Query lo trate como fallo. */
export async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function useRpc<T>(nombre: string, args: Record<string, unknown> = {}, opciones: { habilitado?: boolean; clave?: QueryKey } = {}) {
  return useQuery({
    queryKey: opciones.clave ?? [nombre, args],
    queryFn: () => q<T>(supabase.rpc(nombre, args) as unknown as PromiseLike<{ data: T; error: { message: string } | null }>),
    enabled: opciones.habilitado ?? true,
  });
}

/** Mutación con aviso de éxito/error y recarga de las consultas afectadas. */
export function useAccion<A, R = unknown>(fn: (a: A) => Promise<R>, opciones: { exito?: string | ((r: R) => string); invalidar?: QueryKey[]; alTerminar?: (r: R) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => (EN_VISTA_PREVIA ? Promise.reject(new Error(MSJ_VISTA_PREVIA)) : fn(a)),
    onSuccess: (r) => {
      if (opciones.exito) toast.success(typeof opciones.exito === "function" ? opciones.exito(r) : opciones.exito);
      opciones.invalidar?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opciones.alTerminar?.(r);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
}

/** Recarga las consultas indicadas cuando cambia una tabla (Supabase Realtime). */
export function useTiempoReal(tabla: string, claves: QueryKey[], filtro?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    // Una acción toca varias filas (una orden y sus 20 partidas) y cada fila manda
    // su aviso: recargar en cada uno hacía que las consultas se cancelaran entre sí.
    // Se junta todo lo que llega en 400 ms y se recarga una vez.
    let espera: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase
      .channel(`rt-${tabla}-${filtro ?? "todo"}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabla, ...(filtro ? { filter: filtro } : {}) }, () => {
        clearTimeout(espera);
        espera = setTimeout(() => claves.forEach((k) => qc.invalidateQueries({ queryKey: k })), 400);
      })
      .subscribe();
    return () => { clearTimeout(espera); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, filtro]);
}
