import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";

/** Traduce errores de Postgres/PostgREST a algo que un usuario entienda. Los
 *  que lanzamos nosotros (raise exception) ya vienen en español y pasan tal cual. */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
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
    mutationFn: fn,
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
    const canal = supabase
      .channel(`rt-${tabla}-${filtro ?? "todo"}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabla, ...(filtro ? { filter: filtro } : {}) }, () => {
        claves.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, filtro]);
}
