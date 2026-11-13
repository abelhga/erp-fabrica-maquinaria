import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, ShoppingCart } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

interface Fila {
  pedido_id: string; folio: string; cliente: string | null; vendedor: string | null; fecha_compromiso: string | null; estado: string;
  articulo_id: string; clave: string; articulo: string; unidad: string; pendiente: number; disponible: number;
  en_camino: number; en_requisicion: number; situacion: "hay" | "pedido" | "falta"; envio: string | null;
}

const SITUACION = {
  hay: { texto: "Hay", tono: "ok" as const },
  pedido: { texto: "Ya pedido", tono: "aviso" as const },
  falta: { texto: "Falta", tono: "peligro" as const },
};

/**
 * Los pedidos de componentes que faltan por entregar, con si hay o falta cada partida. Antes almacén
 * se enteraba por un aviso de «Pedido nuevo» que se perdía entre decenas, y si no había material nadie
 * lo pedía a compras (PED-26-842). Aquí está a la vista y se pide con un botón.
 */
export function PedidosPorSurtir() {
  const ir = useNavigate();
  const { puede } = useSesion();
  const lista = useQuery({ queryKey: ["pedidos_por_surtir"], queryFn: () => q<Fila[]>(supabase.rpc("pedidos_por_surtir")) });
  const pedir = useAccion((pedido: string) => q<{ folio: string; partidas: number }>(supabase.rpc("pedir_material_pedido", { p_pedido: pedido })), {
    exito: (r) => `Requisición ${r.folio}: ${r.partidas} partida(s) a compras`,
    invalidar: [["pedidos_por_surtir"], ["requisiciones"]],
  });
  const filas = lista.data ?? [];
  const pedidos = [...new Map(filas.map((f) => [f.pedido_id, f])).values()];
  // Quien ve pedidos con montos va al pedido; almacén y planta, a su vista sin montos.
  const ruta = (id: string) => (puede("ventas", 1) ? `/ventas/pedidos/${id}` : `/produccion/pedidos?pedido=${id}`);

  if (!lista.isLoading && !lista.error && filas.length === 0) return null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Pedidos por entregar" explica={GLOSARIO.pedidosPorSurtir}
        descripcion="Componentes vendidos que todavía no salen. Lo que dice «Falta» hay que pedirlo a compras." />
      {lista.error ? <div className="px-5 pb-5"><ErrorCarga error={lista.error} /></div>
        : lista.isLoading ? <div className="px-5 pb-5"><Cargando filas={3} /></div>
        : pedidos.length === 0 ? <Vacio icono={PackageCheck} titulo="Nada por entregar" className="py-8" texto="Cuando se confirme un pedido de componentes aparece aquí." />
        : (
          <div className="divide-y divide-borde">
            {pedidos.map((p) => {
              const partidas = filas.filter((f) => f.pedido_id === p.pedido_id);
              const falta = partidas.some((f) => f.situacion === "falta");
              const vencido = p.fecha_compromiso != null && p.fecha_compromiso < new Date().toISOString().slice(0, 10);
              return (
                <div key={p.pedido_id} className="px-5 py-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button type="button" className="font-medium cifra hover:underline" onClick={() => ir(ruta(p.pedido_id))}>{p.folio}</button>
                    <span className="text-sm text-tenue truncate max-w-[260px]">{p.cliente}{p.vendedor && ` · ${p.vendedor}`}</span>
                    <span className={vencido ? "text-xs text-peligro" : "text-xs text-tenue"}>
                      {p.fecha_compromiso ? `Compromiso ${fecha(p.fecha_compromiso)}` : "Sin fecha"}
                    </span>
                    {p.envio && <span className="text-xs text-tenue" data-explain={GLOSARIO.pedidosPorSurtir} data-explain-title="Envío">Envío {p.envio}</span>}
                    {falta && (puede("inventario", 2) || puede("compras", 2)) && (
                      <Boton tamano="sm" variante="secundario" className="ml-auto" cargando={pedir.isPending && pedir.variables === p.pedido_id}
                        onClick={() => pedir.mutate(p.pedido_id)} data-explain={GLOSARIO.botonPedirMaterialPedido} data-explain-title="Pedir a compras">
                        <ShoppingCart className="h-4 w-4" /> Pedir a compras lo que falta
                      </Boton>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {partidas.map((f) => (
                      <li key={f.articulo_id} className="flex items-center gap-3 text-sm">
                        <span data-explain={GLOSARIO.situacionPartidaPedido} data-explain-title="Hay / Ya pedido / Falta">
                          <Insignia tono={SITUACION[f.situacion].tono}>{SITUACION[f.situacion].texto}</Insignia>
                        </span>
                        <span className="min-w-0 flex-1 truncate" title={f.articulo}><span className="text-tenue">{f.clave}</span> · {f.articulo}</span>
                        <span className="cifra whitespace-nowrap">{numero(f.pendiente)} {f.unidad}</span>
                        <span className="text-xs text-tenue whitespace-nowrap cifra">
                          hay {numero(f.disponible)}{Number(f.en_camino) > 0 && ` · en camino ${numero(f.en_camino)}`}{Number(f.en_requisicion) > 0 && ` · pedido ${numero(f.en_requisicion)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
    </Tarjeta>
  );
}
