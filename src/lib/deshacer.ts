// Cuántos minutos tiene quien se equivocó para deshacer (almacén) o reabrir (pendientes). Los fija
// dirección o sistemas en Configuración (0 = apagado); la base hace la misma cuenta con
// minutos_deshacer() y es la que decide: esto solo enseña o esconde el botón.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";

export type AreaDeshacer = "almacen" | "pendientes";
const recortar = (v: unknown) => {
  const n = Math.trunc(Number(v ?? 15));
  return Number.isFinite(n) ? Math.max(0, Math.min(240, n)) : 15;
};

export function useMinutosDeshacer(): Record<AreaDeshacer, number> {
  const cfg = useQuery({
    queryKey: ["configuracion", "deshacer"], staleTime: 5 * 60_000,
    queryFn: () => q<{ valor: Partial<Record<AreaDeshacer, number>> } | null>(
      supabase.from("configuracion").select("valor").eq("clave", "deshacer").maybeSingle()),
  });
  const v = cfg.data?.valor ?? {};
  return { almacen: recortar(v.almacen), pendientes: recortar(v.pendientes) };
}
