import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Boxes, ClipboardList, Globe2, Pencil, Plus, TrendingUp, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { SERIE, ejeProps } from "@/components/graficas/comunes";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { InsigniaOC, type Moneda, type OrdenCompra, hace } from "./componentes/comun";
import { DialogoProveedor } from "./componentes/DialogoProveedor";
import type { ProveedorCompleto } from "./componentes/tipos";

interface ArticuloSurtido {
  articulo_id: string; clave: string; nombre: string; unidad: string; costo: number | null; moneda: Moneda | null;
  actualizado_en: string | null; dias_sin_actualizar: number | null; proveedor_id: string | null;
}
interface PuntoIndice { mes: string; indice: number; articulos: number; cambios: number }
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaMes = (m: string) => { const d = new Date(m + "T12:00:00"); return `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };

export default function DetalleProveedor() {
  const { id } = useParams();
  const { puede } = useSesion();
  const ir = useNavigate();
  const [editando, setEditando] = useState(false);
  const verCostos = puede("costos", 1);
  const verDinero = verCostos || puede("finanzas", 1);

  const prov = useQuery({ queryKey: ["proveedor", id], queryFn: () => q<ProveedorCompleto>(supabase.from("proveedores").select("*").eq("id", id!).single()) });
  const resumen = useQuery({
    queryKey: ["v_proveedores", id],
    queryFn: () => q<{ articulos: number; oc_abiertas: number; oc_atrasadas: number; comprado_12m: number | null; ultima_compra: string | null }>(
      supabase.from("v_proveedores").select("articulos, oc_abiertas, oc_atrasadas, comprado_12m, ultima_compra").eq("id", id!).single()),
  });
  const articulos = useQuery({
    queryKey: ["v_precios_compra", "proveedor", id],
    queryFn: () => todasLasFilas<ArticuloSurtido>((d, h) => supabase.from("v_precios_compra")
      .select("articulo_id, clave, nombre, unidad, costo, moneda, actualizado_en, dias_sin_actualizar, proveedor_id")
      .or(`proveedor_id.eq.${id},proveedor_habitual_id.eq.${id}`).order("nombre").order("articulo_id").range(d, h)),
  });
  const ordenes = useQuery({
    queryKey: ["v_ordenes_compra", "proveedor", id],
    queryFn: () => q<Pick<OrdenCompra, "id" | "folio" | "estado" | "fecha" | "fecha_entrega" | "moneda" | "total" | "atrasada" | "dias_atraso" | "partidas">[]>(
      supabase.from("v_ordenes_compra").select("id, folio, estado, fecha, fecha_entrega, moneda, total, atrasada, dias_atraso, partidas")
      .eq("proveedor_id", id!).order("fecha", { ascending: false }).limit(50)),
  });
  const indice = useQuery({
    queryKey: ["indice_precios_proveedor", id],
    enabled: verCostos,
    queryFn: () => q<PuntoIndice[]>(supabase.rpc("indice_precios_proveedor", { p_proveedor: id, p_meses: 36 })),
  });

  if (prov.error) return <Pagina titulo="Proveedor"><ErrorCarga error={prov.error} /></Pagina>;
  if (!prov.data) return <Pagina titulo="Proveedor"><Cargando /></Pagina>;
  const p = prov.data;
  const serie = (indice.data ?? []).map((x) => ({ ...x, indice: Number(x.indice), etiqueta: etiquetaMes(x.mes) }));
  const ultimo = serie.at(-1);
  const haceUnAnio = serie.length > 12 ? serie[serie.length - 13] : serie[0];
  const variacion12 = ultimo && haceUnAnio && haceUnAnio !== ultimo ? ultimo.indice / haceUnAnio.indice - 1 : null;

  const columnas: Columna<ArticuloSurtido>[] = [
    { clave: "clave", titulo: "Clave", clase: "text-xs text-tenue whitespace-nowrap" },
    { clave: "nombre", titulo: "Artículo", clase: "min-w-[240px]", celda: (a) => <><p>{a.nombre}</p><p className="text-xs text-tenue">{a.unidad}{a.proveedor_id !== id && " · su costo vigente es de otro proveedor"}</p></> },
    { clave: "costo", titulo: "Costo", alinear: "der", sinBusqueda: true, oculta: !verCostos, valor: (a) => Number(a.costo ?? 0),
      celda: (a) => a.costo == null ? <span className="text-peligro text-xs">sin costo</span> : dinero(a.costo, a.moneda === "USD" ? "USD" : "MXN") },
    { clave: "actualizado_en", titulo: "Actualizado", clase: "whitespace-nowrap text-xs", oculta: !verCostos,
      celda: (a) => <span className={cn((a.dias_sin_actualizar ?? 0) > 180 ? "text-aviso" : "text-tenue")}>{hace(a.actualizado_en)}</span> },
  ];

  return (
    <Pagina
      titulo={<span className="flex flex-wrap items-center gap-3">{p.nombre}{p.es_importacion && <Insignia tono="info"><Globe2 className="h-3 w-3" /> Importación</Insignia>}{!p.activo && <Insignia>Inactivo</Insignia>}</span>}
      descripcion={[p.razon_social !== p.nombre ? p.razon_social : null, p.categoria, p.pais].filter(Boolean).join(" · ")}
      acciones={<>
        <Boton variante="fantasma" onClick={() => ir("/compras/proveedores")}><ArrowLeft className="h-4 w-4" /> Proveedores</Boton>
        {puede("compras", 2) && <Boton variante="secundario" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" /> Editar</Boton>}
        {puede("compras", 2) && <Boton onClick={() => ir(`/compras/ordenes/nueva?proveedor=${p.id}`)}><Plus className="h-4 w-4" /> Nueva orden</Boton>}
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Artículos que surte" valor={numero(resumen.data?.articulos ?? 0)} icono={Boxes} tono="marca" detalle={`${p.dias_entrega ?? 7} días hábiles de entrega`} />
        <Kpi titulo="Órdenes abiertas" valor={numero(resumen.data?.oc_abiertas ?? 0)} icono={ClipboardList} tono={resumen.data?.oc_atrasadas ? "peligro" : "info"}
          detalle={resumen.data?.oc_atrasadas ? `${resumen.data.oc_atrasadas} atrasada(s)` : resumen.data?.ultima_compra ? `última el ${fecha(resumen.data.ultima_compra)}` : "sin compras registradas"} />
        {verDinero && <Kpi titulo="Comprado en 12 meses" valor={dineroCompacto(resumen.data?.comprado_12m ?? 0)} icono={Wallet} tono="neutro"
          detalle={p.dias_credito ? `${p.dias_credito} días de crédito · ${p.moneda}` : `de contado · ${p.moneda}`} />}
        {verCostos && <Kpi titulo="Sus precios en 12 meses" valor={variacion12 == null ? "—" : `${variacion12 >= 0 ? "+" : "−"}${porcentaje(Math.abs(variacion12))}`}
          icono={TrendingUp} tono={variacion12 == null ? "neutro" : variacion12 > 0.1 ? "peligro" : variacion12 > 0 ? "aviso" : "ok"}
          detalle="índice de precios de lo que nos vende" />}
      </div>

      <div className="grid gap-5 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-5">
          {verCostos && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Índice de precios del proveedor" descripcion="Base 100 en el primer mes con datos. Media de cuánto cambió cada artículo de un mes al otro (los que no cambiaron cuentan como 0 %)." />
              {indice.isLoading ? <Cargando filas={4} /> : serie.length < 2 ? (
                <p className="px-5 pb-6 text-sm text-tenue">Todavía no hay historial de precios de este proveedor para graficar.</p>
              ) : (
                <div className="h-64 px-2 pb-3">
                  <ResponsiveContainer>
                    <AreaChart data={serie} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="relleno-indice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SERIE(1)} stopOpacity={0.25} /><stop offset="100%" stopColor={SERIE(1)} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                      <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis {...ejeProps} width={40} domain={["auto", "auto"]} tickFormatter={(v) => String(Math.round(v))} />
                      <ReferenceLine y={100} stroke="var(--eje)" strokeDasharray="3 3" />
                      <Tooltip cursor={{ stroke: "var(--eje)", strokeDasharray: "3 3" }} content={<TooltipIndice />} />
                      <Area type="stepAfter" dataKey="indice" name="Índice" stroke={SERIE(1)} strokeWidth={2} fill="url(#relleno-indice)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Tarjeta>
          )}

          <div>
            <h3 className="font-semibold mb-2">Artículos que surte</h3>
            <TablaDatos filas={articulos.data} columnas={columnas} cargando={articulos.isLoading} error={articulos.error}
              claveFila={(a) => a.articulo_id} exportarComo={`articulos-${p.nombre}`} compacta limite={100}
              vacio={{ icono: Boxes, titulo: "No tiene artículos asignados", texto: "Se ligan al capturar su costo en Actualizar precios o al recibir una orden suya." }} />
          </div>
        </div>

        <div className="space-y-5">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos" />
            <dl className="px-5 pb-5 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              {([
                ["Contacto", p.contacto], ["Teléfono", p.telefono], ["Correo", p.correo], ["Sitio", p.sitio], ["RFC", p.rfc],
                ["Domicilio", p.domicilio], ["Moneda", p.moneda], ["Crédito", p.dias_credito ? `${p.dias_credito} días` : "Contado"],
                ["Entrega", p.dias_entrega != null ? `${p.dias_entrega} días hábiles` : "7 días hábiles (estándar)"],
                ["Bancarios", p.datos_bancarios], ["Notas", p.notas],
              ] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-tenue">{k}</dt><dd className="min-w-0 break-words whitespace-pre-line">{v || <span className="text-tenue">—</span>}</dd></div>
              ))}
            </dl>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <EncabezadoTarjeta titulo="Órdenes de compra" descripcion="Las 50 más recientes" />
            {ordenes.isLoading ? <Cargando filas={3} /> : (ordenes.data?.length ?? 0) === 0 ? (
              <p className="px-5 pb-5 text-sm text-tenue">Sin órdenes todavía.</p>
            ) : (
              <ul className="divide-y divide-borde">
                {ordenes.data!.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => ir(`/compras/ordenes/${o.id}`)} className="w-full text-left px-5 py-2.5 hover:bg-fondo flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{o.folio}</p>
                        <p className="text-xs text-tenue">{fecha(o.fecha)} · {o.partidas} partida(s){verDinero && ` · ${dinero(o.total, o.moneda === "USD" ? "USD" : "MXN")}`}</p>
                      </div>
                      <InsigniaOC estado={o.estado} atrasada={o.atrasada} dias={o.dias_atraso} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
      <DialogoProveedor abierto={editando} alCambiar={setEditando} proveedor={p} />
    </Pagina>
  );
}

function TooltipIndice({ active, payload }: { active?: boolean; payload?: { payload: PuntoIndice & { etiqueta: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[150px]">
      <p className="font-medium mb-1">{d.etiqueta}</p>
      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE(1) }} /><span className="text-tenue">Índice</span><span className="ml-auto cifra font-medium">{numero(d.indice)}</span></div>
      <p className="text-tenue mt-1">{d.cambios ? `${d.cambios} de ${d.articulos} artículos cambiaron de precio` : `${d.articulos} artículos, sin cambios`}</p>
    </div>
  );
}
