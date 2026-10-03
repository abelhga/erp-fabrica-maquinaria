// Costo puesto en planta. Reemplaza PRORRATEO.xlsx: mismo método (factor por
// valor, o mixto valor + volumen en consolidados), pero con el TC real de cada
// pago, el IVA fuera ANTES de prorratear (la hoja dividía todo entre 1.16) y
// ligado al catálogo: al cerrar el final, el costo del componente se actualiza
// con su historial y su precio de lista se recalcula (costo ÷ 0.70).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Lock } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fechaYHora, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE_EMBARQUES, type Embarque, type Moneda } from "./comun";

interface Costeo {
  id: string; tipo: "preliminar" | "final"; version: number; estado: "borrador" | "cerrado"; valor_mxn: number; gastos_mxn: number;
  iva_acreditable: number; factor: number; calculado_en: string; cerrado_en: string | null; articulos_actualizados: number | null;
  gastos: { descripcion: string; concepto: string; monto_mxn: number; criterio: string; estimado?: boolean; proveedor?: string | null }[];
}
interface Linea {
  id: string; articulo_id: string | null; descripcion: string; cantidad: number; precio: number; moneda: Moneda; tipo_cambio: number;
  valor_mxn: number; gastos_valor: number; gastos_volumen: number; gastos_directos: number; costo_total: number; costo_unitario: number;
  factor: number | null; costo_anterior: number | null; articulos: { clave: string } | null;
}

export function Costeo({ e }: { e: Embarque }) {
  const { puede } = useSesion();
  const calcula = puede("importaciones", 2) && puede("costos");
  const cierra = puede("importaciones", 3) || (puede("importaciones", 2) && puede("costos", 2));
  const [elegido, setElegido] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState<Costeo | null>(null);
  const costeos = useQuery({
    queryKey: ["costeos_importacion", e.id],
    queryFn: () => q<Costeo[]>(supabase.from("costeos_importacion").select("*").eq("embarque_id", e.id)
      .order("tipo").order("version", { ascending: false })),
  });
  // Primero lo que falta cerrar; si no, el final más reciente.
  const actual = costeos.data?.find((c) => c.id === elegido) ?? costeos.data?.find((c) => c.estado === "borrador") ?? costeos.data?.[0];
  useEffect(() => { if (actual && !elegido) setElegido(actual.id); }, [actual, elegido]);
  const lineas = useQuery({
    queryKey: ["costeo_importacion_lineas", actual?.id], enabled: !!actual,
    queryFn: () => q<Linea[]>(supabase.from("costeo_importacion_lineas").select("*, articulos(clave)").eq("costeo_id", actual!.id).order("descripcion")),
  });
  const invalidar = [["costeos_importacion", e.id], ["costeo_importacion_lineas"], ["alertas_importacion"], CLAVE_EMBARQUES];
  const calcular = useAccion((tipo: "preliminar" | "final") => q<string>(supabase.rpc("calcular_costeo_importacion", { p_embarque: e.id, p_tipo: tipo })), {
    exito: "Costeo calculado. Revísalo y ciérralo cuando cuadre.", invalidar, alTerminar: (id) => setElegido(id),
  });
  const cerrar = useAccion((id: string) => q<number>(supabase.rpc("cerrar_costeo_importacion", { p_costeo: id })), {
    exito: (n) => n ? `Costeo cerrado: ${n} ${n === 1 ? "artículo cambió" : "artículos cambiaron"} de costo y sus precios ya se recalcularon` : "Costeo cerrado",
    invalidar: [...invalidar, ["v_precios_compra"], ["costos_articulo"]], alTerminar: () => setCerrando(null),
  });

  if (costeos.isLoading) return <Tarjeta><Cargando /></Tarjeta>;
  const tienePedimento = !!e.fechas.pedimento_pagado;
  const tieneCG = !!e.fechas.cuenta_gastos;

  return (
    <div className="space-y-5">
      <Tarjeta>
        <EncabezadoTarjeta titulo="Costo puesto en planta"
          descripcion="Mercancía al TC real de los pagos + gastos sin IVA, repartidos por valor (o por volumen en un consolidado). El preliminar sale con el pedimento; el final, con la cuenta de gastos, cambia el costo del catálogo."
          acciones={calcula && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Boton variante="secundario" tamano="sm" disabled={!tienePedimento} title={tienePedimento ? undefined : "Primero el pedimento"}
                cargando={calcular.isPending && calcular.variables === "preliminar"} onClick={() => calcular.mutate("preliminar")}>
                <Calculator className="h-4 w-4" /> Preliminar
              </Boton>
              <Boton tamano="sm" disabled={!tieneCG} title={tieneCG ? undefined : "Primero la cuenta de gastos"}
                cargando={calcular.isPending && calcular.variables === "final"} onClick={() => calcular.mutate("final")}>
                <Calculator className="h-4 w-4" /> Final
              </Boton>
            </div>
          )} />
        {!costeos.data?.length ? (
          <Vacio icono={Calculator} titulo="Sin costeo todavía"
            texto={!tienePedimento ? "Cuando se pague el pedimento se puede calcular el preliminar." : "Calcula el preliminar: con eso la entrada a almacén se valúa con el costo real, no con el precio en dólares."} />
        ) : (
          <div className="px-5 pb-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {costeos.data.map((c) => (
                <button key={c.id} onClick={() => setElegido(c.id)}
                  className={cn("rounded-lg border px-3 py-1.5 text-sm text-left", c.id === actual?.id ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
                  <span className="font-medium capitalize">{c.tipo} v{c.version}</span>{" "}
                  <Insignia tono={c.estado === "cerrado" ? "ok" : "aviso"}>{c.estado === "cerrado" ? "cerrado" : "borrador"}</Insignia>
                  <span className="block text-xs text-tenue">{fechaYHora(c.cerrado_en ?? c.calculado_en)}</span>
                </button>
              ))}
            </div>
            {actual && (
              <>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Dato titulo="Mercancía (TC real)" valor={dinero(actual.valor_mxn)} />
                  <Dato titulo="Gastos sin IVA" valor={dinero(actual.gastos_mxn)} />
                  <Dato titulo="Factor" valor={numero(Number(actual.factor))} detalle={`por cada $1 de mercancía, ${dinero(Number(actual.factor))} de indirectos`} />
                  <Dato titulo="IVA acreditable (fuera)" valor={dinero(actual.iva_acreditable)} />
                </div>
                {actual.estado === "borrador" && cierra && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-fondo px-4 py-3">
                    <p className="text-sm flex-1 min-w-[240px]">
                      {actual.tipo === "final"
                        ? "Al cerrarlo, el costo de estos artículos en el catálogo pasa a ser el puesto en planta (en pesos, con historial) y sus precios se recalculan."
                        : "El preliminar no cambia el catálogo: sirve para valuar la entrada a almacén y para ver el costo antes de la cuenta de gastos."}
                    </p>
                    <Boton onClick={() => setCerrando(actual)}><Lock className="h-4 w-4" /> Cerrar {actual.tipo}</Boton>
                  </div>
                )}
                {actual.estado === "cerrado" && actual.tipo === "final" && (
                  <p className="text-sm text-ok">Cerrado: {actual.articulos_actualizados ?? 0} artículos actualizados en el catálogo con origen “importación” y el folio {e.folio}.</p>
                )}
              </>
            )}
          </div>
        )}
      </Tarjeta>

      {actual && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] items-start">
          <Tarjeta className="overflow-hidden">
            <EncabezadoTarjeta titulo="Por partida" descripcion="Costo unitario sin IVA. “Antes” es el del catálogo al calcular." />
            {lineas.isLoading ? <Cargando /> : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead><tr><th>Artículo</th><th className="text-right">Cant.</th><th className="text-right">Precio · TC</th>
                    <th className="text-right">Valor</th><th className="text-right">Gastos</th><th className="text-right">Unitario</th><th className="text-right">Antes</th></tr></thead>
                  <tbody>
                    {(lineas.data ?? []).map((l) => {
                      const cambio = l.costo_anterior ? Number(l.costo_unitario) / Number(l.costo_anterior) - 1 : null;
                      return (
                        <tr key={l.id}>
                          <td className="max-w-[220px]"><p className="truncate" title={l.descripcion}>{l.descripcion}</p><p className="text-xs text-tenue">{l.articulos?.clave ?? "sin artículo del catálogo"}</p></td>
                          <td className="text-right cifra">{numero(l.cantidad)}</td>
                          <td className="text-right cifra whitespace-nowrap">{dinero(l.precio, l.moneda === "USD" ? "USD" : "MXN")}
                            {l.moneda !== "MXN" && <span className="block text-[11px] text-tenue">TC {Number(l.tipo_cambio).toFixed(4)}</span>}</td>
                          <td className="text-right cifra">{dinero(l.valor_mxn)}</td>
                          <td className="text-right cifra">{dinero(Number(l.gastos_valor) + Number(l.gastos_volumen) + Number(l.gastos_directos))}</td>
                          <td className="text-right cifra font-semibold">{dinero(l.costo_unitario)}</td>
                          <td className="text-right whitespace-nowrap">
                            <span className="cifra text-tenue">{l.costo_anterior != null ? dinero(l.costo_anterior) : "—"}</span>
                            {cambio != null && Math.abs(cambio) >= 0.005 && (
                              <span className={cn("block text-[11px] cifra", cambio > 0 ? "text-aviso" : "text-ok")}>{cambio > 0 ? "▲" : "▼"} {porcentaje(Math.abs(cambio))}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo="Gastos que entraron" descripcion={actual.tipo === "final" ? "Sin los estimados: manda la cuenta de gastos." : "Incluye estimados."} />
            <ul className="divide-y divide-borde border-t border-borde">
              {actual.gastos.map((g, i) => (
                <li key={i} className="px-5 py-2 flex items-start gap-2 text-sm">
                  <span className="flex-1 min-w-0">{g.descripcion}<span className="block text-xs text-tenue">
                    {[g.proveedor, g.criterio === "volumen" ? "por volumen" : g.criterio === "directo" ? "directo" : "por valor", g.estimado ? "estimado" : null].filter(Boolean).join(" · ")}</span></span>
                  <span className="cifra">{dinero(g.monto_mxn)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      )}

      <Dialogo abierto={!!cerrando} alCambiar={(v) => !v && setCerrando(null)} titulo={`Cerrar costeo ${cerrando?.tipo ?? ""} v${cerrando?.version ?? ""}`}
        descripcion={cerrando?.tipo === "final"
          ? "El costo de cada artículo de este embarque en el catálogo pasa a ser el puesto en planta. Queda en el historial con el folio del embarque y los precios se recalculan solos."
          : "El preliminar queda como referencia; no cambia el catálogo."}
        pie={<><Boton variante="secundario" onClick={() => setCerrando(null)}>No todavía</Boton>
          <Boton cargando={cerrar.isPending} onClick={() => cerrando && cerrar.mutate(cerrando.id)}>Cerrar costeo</Boton></>}>
        <p className="text-sm text-tenue">Si después llega un complemento (almacenaje, demoras, limpieza), se calcula otra versión del final.</p>
      </Dialogo>
    </div>
  );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-borde p-3">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="text-lg font-semibold cifra">{valor}</p>
      {detalle && <p className="text-[11px] text-tenue">{detalle}</p>}
    </div>
  );
}
