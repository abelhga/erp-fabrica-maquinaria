import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fechaYHora } from "@/lib/formato";
import { filasDiff, nombreColumna, type Cambios } from "@/modulos/sistema/componentes/diff";

interface Cambio { id: number; accion: "alta" | "cambio" | "baja"; cambios: Cambios; usuario: string | null; en: string }

/**
 * Quién cambió qué de un registro, en su propia ficha. Sale de la bitácora: solo la ve
 * quien puede verla (dirección y sistemas); para los demás la tarjeta no aparece.
 */
export function HistorialCambios({ tabla, id, explica }: { tabla: string; id: string; explica?: string }) {
  const datos = useQuery({
    queryKey: ["v_bitacora", "registro", tabla, id],
    queryFn: () => q<Cambio[]>(supabase.from("v_bitacora").select("id, accion, cambios, usuario, en")
      .eq("tabla", tabla).eq("registro_id", id).order("en", { ascending: false }).limit(15)),
  });
  if (!datos.data?.length) return null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Quién cambió qué" explica={explica} descripcion="Los últimos 15 movimientos" />
      <ol className="px-5 pb-5 space-y-2.5">
        {datos.data.map((c) => {
          const campos = filasDiff(c.cambios, c.accion).map((f) => nombreColumna(f.columna));
          return (
            <li key={c.id} className="flex gap-2.5 text-sm">
              <History className="h-4 w-4 text-tenue shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p><b className="font-medium">{c.usuario ?? "Sistema"}</b> {c.accion === "alta" ? "lo dio de alta" : c.accion === "baja" ? "lo borró" : campos.length ? `cambió ${campos.join(", ").toLowerCase()}` : "lo cambió"}</p>
                <p className="text-xs text-tenue">{fechaYHora(c.en)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Tarjeta>
  );
}
