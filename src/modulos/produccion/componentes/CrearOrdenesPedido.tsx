import { useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { GLOSARIO } from "@/tutorial/glosario";
import { ESTADO_OP } from "./util";

interface OrdenDeStock { id: string; folio: string; estado: keyof typeof ESTADO_OP; numero_serie: string | null }
interface PartidaConStock { linea_id: string; clave: string; equipo: string; faltan: number; ordenes: OrdenDeStock[] }

const CLAVE_STOCK = "stock_para_pedido";

/**
 * Mandar un pedido a producción sin fabricar lo que ya está hecho: antes de crear las órdenes
 * pregunta a la base si hay equipos iguales para stock y, si los hay, los ofrece.
 *
 * El botón vive en tres pantallas (órdenes, pedidos de la planta y el pedido de ventas) y en las
 * tres pasó lo mismo: se crearon órdenes nuevas de equipos que ya estaban en stock. Por eso es un
 * solo gancho: `pedir(id)` en el botón y `dialogo` en cualquier parte de la pantalla.
 */
export function useCrearOrdenesPedido(op: { invalidar: QueryKey[]; exito: (n: number) => string; alTerminar?: (n: number) => void }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);
  const crear = useAccion((a: { id: string; nuevos: boolean }) =>
    q<number>(supabase.rpc("ordenes_desde_pedido", { p_pedido: a.id, p_fabricar_nuevos: a.nuevos })), {
    exito: op.exito, invalidar: [...op.invalidar, [CLAVE_STOCK]],
    alTerminar: (n) => { setAviso(null); op.alTerminar?.(n); },
  });
  const pedir = async (id: string) => {
    setRevisando(id);
    try {
      const hay = await q<PartidaConStock[]>(supabase.rpc("stock_para_pedido", { p_pedido: id }));
      if (hay.length > 0) { setAviso(id); return; }
    } catch {
      // Si la consulta falla no se pierde nada: la base vuelve a revisar al crear y lo dice.
    } finally { setRevisando(null); }
    crear.mutate({ id, nuevos: false });
  };
  return {
    pedir,
    /** El pedido que está en curso (revisando el stock o creando), para pintar su botón. */
    ocupado: revisando ?? (crear.isPending ? crear.variables?.id ?? null : null),
    dialogo: aviso && (
      <DialogoStock pedido={aviso} alCerrar={() => setAviso(null)} invalidar={op.invalidar}
        creando={crear.isPending} fabricar={() => crear.mutate({ id: aviso, nuevos: true })} />
    ),
  };
}

function DialogoStock({ pedido, alCerrar, invalidar, creando, fabricar }: {
  pedido: string; alCerrar: () => void; invalidar: QueryKey[]; creando: boolean; fabricar: () => void;
}) {
  const { puede } = useSesion();
  const gerencia = puede("produccion", 3);
  const qc = useQueryClient();
  const stock = useQuery({
    queryKey: [CLAVE_STOCK, pedido],
    queryFn: () => q<PartidaConStock[]>(supabase.rpc("stock_para_pedido", { p_pedido: pedido })),
  });
  const [usados, setUsados] = useState(0);
  const asignar = useAccion((a: { op: string; linea: string }) => q(supabase.rpc("asignar_orden_stock", { p_op: a.op, p_linea: a.linea })), {
    exito: "Equipo de stock asignado al pedido", invalidar: [...invalidar, [CLAVE_STOCK]],
    alTerminar: () => setUsados((n) => n + 1),
  });
  const partidas = stock.data ?? [];
  // Ya se usó todo el stock que había. Si al pedido le siguen faltando órdenes, su botón sigue
  // ahí y ahora crea solo lo que falta; aquí ya no hay nada que decidir.
  const agotado = usados > 0 && !stock.isFetching && partidas.length === 0;
  useEffect(() => { if (agotado) { qc.removeQueries({ queryKey: [CLAVE_STOCK, pedido] }); alCerrar(); } }, [agotado]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} sobreLateral ancho="max-w-xl" titulo="Ya hay equipos iguales para stock"
      descripcion="Antes de fabricar otro, revisa si el pedido se surte con lo que ya está hecho o en proceso."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <span className="inline-flex" data-explain={GLOSARIO.fabricarNuevos} data-explain-title="Fabricar nuevos">
          <Boton variante="secundario" onClick={fabricar} cargando={creando} disabled={asignar.isPending}>Fabricar nuevos de todos modos</Boton>
        </span>
      </>}>
      {stock.isLoading ? <Cargando filas={2} /> : (
        <ul className="space-y-3">
          {partidas.map((x) => (
            <li key={x.linea_id} className="rounded-lg border border-borde p-3">
              <p className="font-medium">{x.equipo}</p>
              <p className="text-xs text-tenue"><span className="cifra">{x.clave}</span> · al pedido le {x.faltan === 1 ? "falta 1 orden" : `faltan ${x.faltan} órdenes`}</p>
              <ul className="mt-2 space-y-1.5" data-explain={GLOSARIO.asignarStock} data-explain-title="De stock">
                {x.ordenes.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <PackageCheck className="h-4 w-4 text-tenue shrink-0" />
                    <span className="cifra font-medium">{s.folio}</span>
                    {s.numero_serie && <span className="cifra text-tenue">{s.numero_serie}</span>}
                    <Insignia tono={ESTADO_OP[s.estado]?.tono}>{ESTADO_OP[s.estado]?.texto ?? s.estado}</Insignia>
                    {gerencia && (
                      <Boton tamano="sm" className="ml-auto" disabled={creando}
                        cargando={asignar.isPending && asignar.variables?.op === s.id && asignar.variables?.linea === x.linea_id}
                        onClick={() => asignar.mutate({ op: s.id, linea: x.linea_id })}>
                        Usar este
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!gerencia && <p className="mt-3 text-xs text-tenue">Asignar un equipo de stock a un pedido es de la gerencia de producción: avísale antes de fabricar otro.</p>}
    </Dialogo>
  );
}
