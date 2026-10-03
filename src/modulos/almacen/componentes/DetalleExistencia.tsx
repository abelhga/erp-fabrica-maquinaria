import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, History, PackageOpen } from "lucide-react";
import { Lateral } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CantidadConSigno, InsigniaMovimiento, nombreCorto, useAlmacenes, type TipoMovimiento } from "./comun";
import type { FilaExistencia } from "../Existencias";

interface MovKardex {
  id: number; en: string; tipo: TipoMovimiento; almacen_id: number; almacen: string; cantidad: number; saldo_almacen: number;
  usuario: string | null; referencia: string | null; motivo: string | null; costo_unitario: number | null; fuera_de_lista: boolean;
}
interface MovHoja {
  id: number; fecha: string; tipo: string; almacen: string | null; cantidad: number; personal: string | null; motivo: string | null;
  documento: string | null; proveedor: string | null; merma: boolean;
}
interface Reserva {
  id: string; cantidad: number; surtido: number; pendiente: number; op_folio: string | null; pedido_folio: string | null;
  motivo: string | null; creado_por_nombre: string | null; creado_en: string;
}

/** Panel lateral de un artículo: dónde está, qué está apartado y su kardex (quién movió qué y cuándo). */
export function DetalleExistencia({ articuloId, fila, alCerrar }: {
  articuloId: string | null; fila: (FilaExistencia & { disponible: number }) | null; alCerrar: () => void;
}) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const almacenes = useAlmacenes();
  // Los movimientos traen costo y quién los hizo: la base solo los enseña a almacén y a quien ve costos.
  const verMovimientos = puede("inventario", 2) || puede("costos", 1);

  const kardex = useQuery({
    queryKey: ["kardex", articuloId],
    enabled: !!articuloId && verMovimientos,
    queryFn: () => q<MovKardex[]>(supabase.rpc("kardex", { p_articulo: articuloId, p_limite: 200 })),
  });
  // Lo capturado en A·Registro antes de arrancar el ERP (solo lectura, tal como venía en la hoja).
  const hoja = useQuery({
    queryKey: ["historial_movimientos_hoja", articuloId],
    enabled: !!articuloId && verMovimientos,
    retry: false,
    queryFn: () => q<MovHoja[]>(supabase.from("historial_movimientos_hoja")
      .select("id, fecha, tipo, almacen, cantidad, personal, motivo, documento, proveedor, merma")
      .eq("articulo_id", articuloId!).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(150)),
  });
  const reservas = useQuery({
    queryKey: ["v_reservas", articuloId],
    enabled: !!articuloId,
    queryFn: () => q<Reserva[]>(supabase.from("v_reservas")
      .select("id, cantidad, surtido, pendiente, op_folio, pedido_folio, motivo, creado_por_nombre, creado_en")
      .eq("articulo_id", articuloId!).eq("estado", "activa").order("creado_en")),
  });

  const porAlmacen = (almacenes.data ?? []).map((a) => ({ ...a, cantidad: Number(fila?.por_almacen?.[a.nombre] ?? 0) }));

  return (
    <Lateral
      abierto={!!articuloId}
      alCambiar={(v) => !v && alCerrar()}
      titulo={fila?.nombre ?? "Artículo"}
      subtitulo={fila && <span>{fila.clave} · {fila.unidad}{fila.es_importado && " · importado"}</span>}
      ancho="max-w-3xl"
      acciones={puede("inventario", 2) && articuloId && (
        <Boton variante="secundario" tamano="sm" onClick={() => ir(`/almacen/movimientos?articulo=${articuloId}`)}>
          <ArrowLeftRight className="h-4 w-4" /> Registrar movimiento
        </Boton>
      )}
    >
      {!fila ? <Cargando /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Cifra titulo="En planta" valor={fila.en_planta} />
            <Cifra titulo="Apartado" valor={fila.reservado} tono="aviso" />
            <Cifra titulo="Disponible" valor={fila.disponible} fuerte />
            <Cifra titulo={puede("compras", 1) || puede("finanzas", 1) ? "En tránsito" : "En ML Full"}
              valor={puede("compras", 1) || puede("finanzas", 1) ? fila.en_transito : fila.en_mercadolibre} tono="info" />
          </div>
          {/* Lo importado no "llega en N días": va por tramos y la fecha sale de la etapa real del embarque. */}
          {(puede("compras", 1) || puede("finanzas", 1)) && Number(fila.en_produccion ?? 0) + Number(fila.en_mar ?? 0) + Number(fila.en_puerto ?? 0) > 0 && (
            <p className="text-sm text-tenue -mt-3">
              Importación: {[
                [fila.en_produccion, "con el proveedor"], [fila.en_mar, "en el mar"], [fila.en_puerto, "en puerto"],
              ].filter(([n]) => Number(n ?? 0) > 0).map(([n, t]) => `${numero(Number(n))} ${t}`).join(" · ")}
              {fila.llegada_estimada && <> · a planta hacia el <span className="text-texto">{fecha(fila.llegada_estimada)}</span></>}
            </p>
          )}

          <section>
            <h3 className="etiqueta mb-2">Por almacén</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {porAlmacen.map((a) => (
                <div key={a.id} className={cn("rounded-lg border px-3 py-2", a.cantidad === 0 ? "border-borde/60 text-tenue" : "border-borde")}>
                  <p className="text-xs text-tenue truncate" title={a.nombre}>{nombreCorto(a.nombre)}</p>
                  <p className={cn("cifra font-semibold", a.cantidad < 0 && "text-peligro")}>{numero(a.cantidad)}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="etiqueta mb-2 flex items-center gap-1.5"><PackageOpen className="h-3.5 w-3.5" /> Apartado</h3>
            {reservas.isLoading ? <Cargando filas={2} /> : (reservas.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-tenue">Nada apartado: todo lo que hay en planta está libre.</p>
            ) : (
              <div className="rounded-lg border border-borde divide-y divide-borde">
                {reservas.data!.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.op_folio ?? r.pedido_folio ?? r.motivo ?? "Apartado"}</p>
                      <p className="text-xs text-tenue">
                        {[r.op_folio || r.pedido_folio ? r.motivo : null, r.creado_por_nombre, fecha(r.creado_en)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="cifra font-semibold">{numero(r.pendiente)}</p>
                      {Number(r.surtido) > 0 && <p className="text-xs text-tenue cifra">{numero(r.surtido)} de {numero(r.cantidad)} surtido</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="etiqueta mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Kardex</h3>
            {!verMovimientos ? (
              <p className="text-sm text-tenue rounded-lg bg-fondo px-3 py-3">
                Tu rol ve existencias y apartados. Los movimientos (quién sacó qué y para qué) los consulta almacén.
              </p>
            ) : kardex.error ? <ErrorCarga error={kardex.error} /> : kardex.isLoading ? <Cargando filas={4} /> : (kardex.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-tenue">Sin movimientos registrados.</p>
            ) : (
              <div className="rounded-lg border border-borde overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr><th>Fecha</th><th>Movimiento</th><th className="text-right">Cantidad</th><th className="text-right">Saldo</th><th>Quién · para qué</th></tr>
                  </thead>
                  <tbody>
                    {kardex.data!.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-xs text-tenue">{fechaYHora(m.en)}</td>
                        <td>
                          <InsigniaMovimiento tipo={m.tipo} />{m.fuera_de_lista && <Insignia tono="aviso" className="ml-1">fuera de lista</Insignia>}
                          <p className="text-xs text-tenue mt-0.5">{m.almacen}</p>
                        </td>
                        <td className="text-right"><CantidadConSigno n={Number(m.cantidad)} /></td>
                        <td className="text-right cifra text-tenue">{numero(m.saldo_almacen)}</td>
                        <td className="text-xs max-w-[260px]">
                          <p className="truncate">{m.usuario ?? "—"}{m.referencia && <span className="text-tenue"> · {m.referencia}</span>}</p>
                          {m.motivo && <p className="text-tenue truncate" title={m.motivo}>{m.motivo}</p>}
                          {m.costo_unitario != null && <p className="text-tenue cifra">{dinero(Math.abs(m.cantidad) * m.costo_unitario)}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {verMovimientos && <p className="text-xs text-tenue mt-2">Los movimientos no se editan ni se borran. Una corrección es un ajuste autorizado por otra persona.</p>}
          </section>

          {verMovimientos && (hoja.data?.length ?? 0) > 0 && (
            <section>
              <h3 className="etiqueta mb-1">Movimientos anteriores al ERP</h3>
              <p className="text-xs text-tenue mb-2">Como se capturaron en la hoja de registro (los últimos {hoja.data!.length}). Sirven para el consumo del reabasto; no mueven la existencia.</p>
              <div className="rounded-lg border border-borde overflow-x-auto max-h-[360px]">
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th className="text-right">Cantidad</th><th>Quién · para qué</th></tr></thead>
                  <tbody>
                    {hoja.data!.map((m) => {
                      const sale = /SALIDA/i.test(m.tipo);
                      return (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap text-xs text-tenue">{fecha(m.fecha)}</td>
                          <td className="text-xs"><p>{m.tipo.charAt(0) + m.tipo.slice(1).toLowerCase()}{m.merma && " · merma"}</p><p className="text-tenue">{m.almacen ?? "—"}</p></td>
                          <td className="text-right"><CantidadConSigno n={sale ? -Number(m.cantidad) : Number(m.cantidad)} /></td>
                          <td className="text-xs max-w-[280px]">
                            <p className="truncate">{m.personal ?? "—"}{m.motivo && <span className="text-tenue"> · {m.motivo}</span>}</p>
                            {(m.documento || m.proveedor) && <p className="text-tenue truncate">{[m.documento, m.proveedor].filter(Boolean).join(" · ")}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </Lateral>
  );
}

function Cifra({ titulo, valor, tono, fuerte }: { titulo: string; valor: number; tono?: "aviso" | "info"; fuerte?: boolean }) {
  return (
    <div className={cn("rounded-lg px-3 py-2", fuerte ? "bg-marca-suave" : "bg-fondo")}>
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={cn("text-xl font-semibold cifra", tono === "aviso" && valor > 0 && "text-aviso", tono === "info" && valor > 0 && "text-info",
        valor < 0 && "text-peligro", fuerte && "text-marca-texto")}>{numero(valor)}</p>
    </div>
  );
}
