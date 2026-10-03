import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LineChart as IconoGrafica } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, numero } from "@/lib/formato";
import { GraficaCosteo, type PuntoCosteo } from "./Graficas";

/**
 * Pestaña Historial: lo que pidió el dueño, "cuánto ha cambiado el costo de un
 * equipo y su precio, con y sin los cambios de utilidad, para correlacionar con
 * ventas". Tres series en pesos y, si se ve ventas, lo que se vendió de este equipo.
 */
export function Historial({ id }: { id: string }) {
  const { puede } = useSesion();
  const serie = useQuery({
    queryKey: ["costeo", "serie", id],
    queryFn: async () => {
      const [s, h] = await Promise.all([
        q<PuntoCosteo[]>(supabase.rpc("serie_costeo", { p_articulo: id })),
        q<{ en: string; utilidad: number | null }[]>(supabase.from("historial_costeo").select("en, utilidad").eq("articulo_id", id)),
      ]);
      const util = new Map(h.map((x) => [new Date(x.en).getTime(), x.utilidad]));
      return s.map((p) => ({
        ...p, costo: p.costo == null ? null : Number(p.costo), precio_real: p.precio_real == null ? null : Number(p.precio_real),
        precio_constante: p.precio_constante == null ? null : Number(p.precio_constante),
        utilidad: util.get(new Date(p.en).getTime()) ?? null,
      }));
    },
  });
  // Ventas del artículo: el precio al que de verdad se vendió, para ponerlo junto al de lista.
  const ventas = useQuery({
    queryKey: ["costeo", "ventas-de", id],
    enabled: puede("ventas"),
    queryFn: () => q<{ id: string; cantidad: number; precio_unitario: number; descuento_pct: number; pedido: { id: string; folio: string; fecha: string | null; creado_en: string } | null }[]>(
      supabase.from("pedido_lineas").select("id, cantidad, precio_unitario, descuento_pct, pedido:pedidos(id, folio, fecha, creado_en)").eq("articulo_id", id).limit(200) as unknown as
        PromiseLike<{ data: never[] | null; error: { message: string } | null }>),
    retry: false,
  });
  const vendidas = useMemo(() => (ventas.data ?? []).map((v) => ({
    ...v, cuando: v.pedido?.fecha ?? v.pedido?.creado_en ?? null, neto: Number(v.precio_unitario) * (1 - Number(v.descuento_pct)),
  })).sort((a, b) => (b.cuando ?? "").localeCompare(a.cuando ?? "")), [ventas.data]);

  if (serie.isLoading) return <Cargando filas={6} />;
  if (serie.error) return <ErrorCarga error={serie.error} />;
  const puntos = serie.data ?? [];

  return (
    <div className="space-y-4">
      <Tarjeta>
        <EncabezadoTarjeta titulo="Costo y precio en el tiempo"
          descripcion="Costo de fabricarlo, precio de lista que regía y el que habría tenido con la utilidad de hoy: si las dos líneas de precio se separan, la diferencia vino de cambiar la utilidad." />
        <div className="px-5 pb-5">
          {puntos.filter((p) => (p.costo ?? 0) > 0).length < 2 ? (
            <Vacio icono={IconoGrafica} titulo="Todavía no hay historia suficiente"
              texto="Cada vez que cambia el costo o el precio queda una foto. Con el historial de costos de compras se puede reconstruir hacia atrás (Sistema → Importar)." />
          ) : <GraficaCosteo puntos={puntos} />}
        </div>
      </Tarjeta>
      {puede("ventas") && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Ventas de este artículo" descripcion="Precio unitario neto de descuento en cada pedido, para compararlo con el de lista de ese momento" />
          {vendidas.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-tenue">No hay pedidos con este artículo todavía.</p>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="tabla">
                <thead><tr><th>Pedido</th><th>Fecha</th><th className="text-right">Piezas</th><th className="text-right">Precio neto</th><th className="text-right">Descuento</th></tr></thead>
                <tbody>
                  {vendidas.map((v) => (
                    <tr key={v.id}>
                      <td className="cifra font-medium"><Link to={v.pedido ? `/ventas/pedidos/${v.pedido.id}` : "/ventas/pedidos"} className="hover:underline">{v.pedido?.folio}</Link></td>
                      <td>{fecha(v.cuando)}</td>
                      <td className="text-right cifra">{numero(v.cantidad)}</td>
                      <td className="text-right cifra">{dinero(v.neto)}</td>
                      <td className="text-right cifra text-tenue">{Number(v.descuento_pct) ? `${(Number(v.descuento_pct) * 100).toFixed(1)} %` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
