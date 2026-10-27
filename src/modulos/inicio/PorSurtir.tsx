import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { CLAVE } from "@/modulos/produccion/componentes/datos";
import { ESTADO_OP } from "@/modulos/produccion/componentes/util";
import type { EstadoOP } from "@/modulos/produccion/componentes/datos";
import { GLOSARIO } from "@/tutorial/glosario";

interface FilaPorSurtir {
  id: string; folio: string; estado: EstadoOP; equipo: string; pedido: string | null; cliente: string | null; para_stock: boolean;
  partidas: number; empieza: string | null; fecha_compromiso: string | null; previo: boolean;
}

/**
 * Lo que almacén tiene que preparar, en el orden en que el taller lo va a tomar (el plan del
 * taller). Antes almacén se enteraba cuando iban por el material: así lo tiene listo antes.
 */
export function PorSurtir() {
  const ir = useNavigate();
  const lista = useQuery({
    queryKey: [...CLAVE, "por_surtir"],
    queryFn: () => q<FilaPorSurtir[]>(supabase.rpc("ordenes_por_surtir")),
  });
  const filas = lista.data ?? [];
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Por surtir" explica={GLOSARIO.porSurtirAlmacen}
        descripcion="Órdenes con material pendiente, en el orden en que el taller las va a trabajar. Ábrela y usa «Surtir»." />
      {lista.error ? <div className="px-5 pb-5"><ErrorCarga error={lista.error} /></div>
        : lista.isLoading ? <div className="px-5 pb-5"><Cargando filas={3} /></div>
        : filas.length === 0 ? (
          <Vacio icono={PackageCheck} titulo="Nada por surtir" className="py-8"
            texto="Cuando una orden tenga material pendiente aparece aquí, en el orden del plan del taller." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Orden</th><th>Equipo</th><th>Para</th><th className="text-right">Partidas</th><th>Empieza</th></tr></thead>
              <tbody>
                {filas.map((o) => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => ir(`/produccion/ordenes/${o.id}`)}>
                    <td className="whitespace-nowrap">
                      <p className="font-medium cifra">{o.folio}</p>
                      <Insignia tono={ESTADO_OP[o.estado]?.tono ?? "neutro"}>{ESTADO_OP[o.estado]?.texto ?? o.estado}</Insignia>
                    </td>
                    <td className="max-w-[260px] truncate" title={o.equipo}>{o.equipo}</td>
                    <td className="text-tenue max-w-[220px] truncate">{o.para_stock ? "Para stock" : [o.pedido, o.cliente].filter(Boolean).join(" · ")}</td>
                    <td className="text-right cifra">
                      {o.partidas}
                      {o.previo && <span className="block text-[11px] text-tenue" data-explain={GLOSARIO.entregadoAntesDelErp} data-explain-title="Venía de la hoja">venía de la hoja</span>}
                    </td>
                    <td className="whitespace-nowrap">{o.empieza ? fecha(o.empieza) : <span className="text-tenue">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Tarjeta>
  );
}
