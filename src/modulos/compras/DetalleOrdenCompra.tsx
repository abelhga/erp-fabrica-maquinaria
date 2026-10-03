import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Globe2, PackageCheck, Plus, Printer, Send, Trash2, Truck } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CantidadConSigno, nombreCorto } from "@/modulos/almacen/componentes/comun";
import { InsigniaOC, SelectorProveedor, useTiposCambio, type Moneda, type OrdenCompra, type ProveedorBreve } from "./componentes/comun";
import { DialogoRecibir } from "./componentes/DialogoRecibir";
import { ImpresionOC, type Empresa } from "./componentes/ImpresionOC";
import { PagosOC } from "./componentes/PagosOC";
import type { LineaOC, ProveedorCompleto } from "./componentes/tipos";

export default function DetalleOrdenCompra() {
  const { id } = useParams();
  return id === "nueva" ? <NuevaOrden /> : <Detalle id={id!} />;
}

/** Nueva orden: primero el proveedor (de él salen moneda, crédito y tiempo de entrega). */
function NuevaOrden() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params] = useSearchParams();
  const tc = useTiposCambio();
  const [prov, setProv] = useState<ProveedorBreve | null>(null);
  const desde = params.get("proveedor");
  useEffect(() => {
    if (!desde) return;
    supabase.from("proveedores").select("id, nombre, categoria, pais, es_importacion, moneda, dias_entrega, dias_credito").eq("id", desde).maybeSingle()
      .then(({ data }) => data && setProv(data as ProveedorBreve));
  }, [desde]);

  const crear = useAccion(() => q<{ id: string }>(supabase.from("ordenes_compra").insert({
    proveedor_id: prov!.id, moneda: prov!.moneda, tipo_cambio: tc.data?.[prov!.moneda] ?? 1,
    condiciones: prov!.dias_credito > 0 ? `Crédito a ${prov!.dias_credito} días` : "Contado",
  }).select("id").single()), { alTerminar: (r) => ir(`/compras/ordenes/${r.id}`, { replace: true }), invalidar: [["v_ordenes_compra"]] });

  if (!puede("compras", 2)) return <Pagina titulo="Nueva orden de compra"><div className="tarjeta"><Vacio icono={Truck} titulo="Las órdenes las crea compras" /></div></Pagina>;
  return (
    <Pagina titulo="Nueva orden de compra" descripcion="Elige al proveedor; después agregas las partidas.">
      <Tarjeta className="max-w-lg p-5 space-y-4">
        <SelectorProveedor valor={prov} alCambiar={setProv} />
        {prov && (
          <p className="text-sm text-tenue">
            {prov.es_importacion && <Globe2 className="inline h-4 w-4 text-info mr-1" />}
            En {prov.moneda} · {prov.dias_credito ? `${prov.dias_credito} días de crédito` : "de contado"} · entrega en {prov.dias_entrega ?? 7} días hábiles
          </p>
        )}
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={() => ir("/compras/ordenes")}>Cancelar</Boton>
          <Boton disabled={!prov} onClick={() => crear.mutate(undefined)} cargando={crear.isPending}>Crear orden en borrador</Boton>
        </div>
      </Tarjeta>
    </Pagina>
  );
}

function Detalle({ id }: { id: string }) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const tc = useTiposCambio();
  const [recibiendo, setRecibiendo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const verDinero = puede("costos", 1) || puede("finanzas", 1);
  const compra = puede("compras", 2);

  const oc = useQuery({ queryKey: ["oc", id], queryFn: () => q<OrdenCompra>(supabase.from("v_ordenes_compra").select("*").eq("id", id).single()) });
  const lineas = useQuery({
    queryKey: ["oc_lineas", id],
    queryFn: () => q<LineaOC[]>(supabase.from("v_oc_lineas").select("*").eq("orden_compra_id", id).order("nombre").order("id")),
  });
  const proveedor = useQuery({
    queryKey: ["proveedor", oc.data?.proveedor_id],
    enabled: !!oc.data,
    queryFn: () => q<ProveedorCompleto>(supabase.from("proveedores").select("*").eq("id", oc.data!.proveedor_id).single()),
  });
  const costos = useQuery({
    queryKey: ["costos_vigentes", id, lineas.data?.map((l) => l.articulo_id).join()],
    enabled: verDinero && !!lineas.data?.length,
    queryFn: () => q<{ articulo_id: string; costo: number; moneda: Moneda }[]>(supabase.from("costos_articulo").select("articulo_id, costo, moneda")
      .in("articulo_id", lineas.data!.map((l) => l.articulo_id).filter(Boolean) as string[])),
  });
  const recepciones = useQuery({
    queryKey: ["oc_recepciones", id],
    queryFn: () => q<{ id: number; en: string; nombre: string; unidad: string; almacen: string; cantidad: number; usuario: string | null; motivo: string | null }[]>(
      supabase.from("v_movimientos").select("id, en, nombre, unidad, almacen, cantidad, usuario, motivo").eq("orden_compra_id", id).order("en", { ascending: false })),
  });
  const empresa = useQuery({
    queryKey: ["configuracion", "empresa"], staleTime: 10 * 60_000,
    queryFn: async () => (await q<{ valor: Empresa }>(supabase.from("configuracion").select("valor").eq("clave", "empresa").single())).valor,
  });

  const invalidar = [["oc", id], ["oc_lineas", id], ["v_ordenes_compra"]];
  const actualizar = useAccion((cambios: Record<string, unknown>) => q(supabase.from("ordenes_compra").update(cambios).eq("id", id).select("id").single()), { invalidar });
  const editarLinea = useAccion(({ linea, cambios }: { linea: string; cambios: Record<string, unknown> }) =>
    q(supabase.from("oc_lineas").update(cambios).eq("id", linea).select("id").single()), { invalidar });
  const quitarLinea = useAccion((linea: string) => q(supabase.from("oc_lineas").delete().eq("id", linea)), { invalidar: [...invalidar, ["v_requisicion_lineas"]] });
  const agregar = useAccion((articulo: string) => q(supabase.rpc("agregar_partida_oc", { p_oc: id, p_articulo: articulo, p_cantidad: 1 })), { invalidar });
  const enviar = useAccion(() => q(supabase.rpc("enviar_orden_compra", { p_oc: id })), {
    exito: "Orden enviada: ya cuenta como en tránsito. Imprímela o mándala al proveedor.", invalidar: [...invalidar, ["v_existencias"], ["reabasto_detalle"]],
  });
  const cancelar = useAccion(() => q(supabase.rpc("cancelar_orden_compra", { p_oc: id, p_motivo: motivo })), {
    exito: "Orden cancelada; sus requisiciones regresaron a pendientes", invalidar: [...invalidar, ["v_requisicion_lineas"], ["reabasto_detalle"]],
    alTerminar: () => setCancelando(false),
  });
  const borrar = useAccion(() => q(supabase.from("ordenes_compra").delete().eq("id", id)), {
    exito: "Borrador eliminado", invalidar: [["v_ordenes_compra"], ["v_requisicion_lineas"]], alTerminar: () => ir("/compras/ordenes"),
  });

  if (oc.error) return <Pagina titulo="Orden de compra"><ErrorCarga error={oc.error} /></Pagina>;
  if (!oc.data) return <Pagina titulo="Orden de compra"><Cargando /></Pagina>;
  const o = oc.data;
  const m: "MXN" | "USD" = o.moneda === "USD" ? "USD" : "MXN";
  const borrador = o.estado === "borrador";
  const editable = borrador && compra;
  const recibido = (lineas.data ?? []).some((l) => Number(l.recibido) > 0);
  const costoVigente = (articulo: string | null) => {
    const c = costos.data?.find((x) => x.articulo_id === articulo);
    if (!c || !tc.data) return null;
    return c.moneda === o.moneda ? Number(c.costo) : (Number(c.costo) * tc.data[c.moneda]) / tc.data[o.moneda];
  };

  return (
    <>
      <div className="print:hidden">
        <Pagina
          titulo={<span className="flex flex-wrap items-center gap-3">{o.folio} <InsigniaOC estado={o.estado} atrasada={o.atrasada} dias={o.dias_atraso} /></span>}
          descripcion={<>
            <Link to={`/compras/proveedores/${o.proveedor_id}`} className="text-marca-texto hover:underline">{o.proveedor}</Link>
            {" · "}{fecha(o.fecha)}{o.creado_por_nombre && ` · hizo ${o.creado_por_nombre}`}
          </>}
          acciones={<>
            <Boton variante="fantasma" onClick={() => ir("/compras/ordenes")}><ArrowLeft className="h-4 w-4" /> Órdenes</Boton>
            {verDinero && <Boton variante="secundario" onClick={() => window.print()} disabled={!lineas.data?.length}><Printer className="h-4 w-4" /> Imprimir</Boton>}
            {compra && borrador && <Boton variante="fantasma" onClick={() => { if (confirm(`¿Eliminar el borrador ${o.folio}?`)) borrar.mutate(undefined); }}><Trash2 className="h-4 w-4" /> Eliminar</Boton>}
            {compra && o.estado === "enviada" && !recibido && <Boton variante="secundario" onClick={() => setCancelando(true)}><Ban className="h-4 w-4" /> Cancelar</Boton>}
            {compra && borrador && <Boton onClick={() => enviar.mutate(undefined)} cargando={enviar.isPending} disabled={!lineas.data?.length}><Send className="h-4 w-4" /> Enviar al proveedor</Boton>}
            {puede("inventario", 2) && (o.estado === "enviada" || o.estado === "parcial") && (
              <Boton onClick={() => setRecibiendo(true)}><PackageCheck className="h-4 w-4" /> Recibir</Boton>
            )}
          </>}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="space-y-5">
              <Tarjeta className="overflow-hidden">
                <EncabezadoTarjeta titulo="Partidas" descripcion={editable ? "Cantidad y costo se guardan con Enter. El costo sugerido es el vigente del artículo." : undefined} />
                {lineas.isLoading ? <Cargando /> : (
                  <div className="overflow-x-auto">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Artículo</th><th className="text-right w-28">Cantidad</th>
                          {verDinero && <th className="text-right w-36">Costo unitario</th>}
                          {verDinero && <th className="text-right">Importe</th>}
                          {!borrador && <th className="text-right">Recibido</th>}
                          {editable && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {(lineas.data ?? []).map((l) => {
                          const vig = costoVigente(l.articulo_id);
                          const dif = vig && Number(l.costo_unitario) ? Number(l.costo_unitario) / vig - 1 : null;
                          return (
                            <tr key={l.id}>
                              <td className="max-w-[340px]">
                                <p className="truncate" title={l.nombre}>{l.nombre}</p>
                                <p className="text-xs text-tenue">{[l.clave, l.unidad, l.empaque && Number(l.empaque) > 1 ? `empaque de ${numero(l.empaque)}` : null, l.para && `para ${l.para}`].filter(Boolean).join(" · ")}</p>
                              </td>
                              <td className="text-right">
                                {editable ? <CeldaEditable valor={Number(l.cantidad)} alGuardar={(v) => v > 0 && editarLinea.mutate({ linea: l.id, cambios: { cantidad: v } })} etiqueta={`Cantidad de ${l.nombre}`} />
                                  : <span className="cifra">{numero(l.cantidad)}</span>}
                              </td>
                              {verDinero && (
                                <td className="text-right">
                                  {editable ? <CeldaEditable valor={Number(l.costo_unitario)} alGuardar={(v) => v >= 0 && editarLinea.mutate({ linea: l.id, cambios: { costo_unitario: v } })} etiqueta={`Costo de ${l.nombre}`} />
                                    : <span className="cifra">{dinero(l.costo_unitario, m)}</span>}
                                  {Number(l.costo_unitario) === 0 ? <p className="text-[11px] text-peligro">sin costo</p>
                                    : dif != null && Math.abs(dif) >= 0.005 && <p className={cn("text-[11px] cifra", dif > 0.1 ? "text-peligro" : dif > 0 ? "text-aviso" : "text-ok")}
                                      title={`Costo vigente ${dinero(vig, m)}`}>{dif > 0 ? "▲" : "▼"} {porcentaje(Math.abs(dif))} vs. vigente</p>}
                                </td>
                              )}
                              {verDinero && <td className="text-right cifra">{dinero(l.importe, m)}</td>}
                              {!borrador && (
                                <td className="text-right whitespace-nowrap">
                                  <span className={cn("cifra", Number(l.pendiente) === 0 ? "text-ok" : Number(l.recibido) > 0 ? "text-aviso" : "text-tenue")}>{numero(l.recibido)}</span>
                                  {Number(l.pendiente) > 0 && <span className="text-xs text-tenue"> · faltan {numero(l.pendiente)}</span>}
                                </td>
                              )}
                              {editable && <td><button className="p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label={`Quitar ${l.nombre}`}
                                onClick={() => quitarLinea.mutate(l.id)}><Trash2 className="h-4 w-4" /></button></td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!lineas.data?.length && <Vacio icono={Plus} titulo="Sin partidas" texto={editable ? "Busca abajo el artículo y Enter para agregarlo." : undefined} />}
                  </div>
                )}
                {editable && (
                  <div className="p-3 border-t border-borde">
                    <BuscadorArticulo alElegir={(a) => agregar.mutate(a.id)} tipos={["componente", "materia_prima", "servicio"]} mostrarPrecio={false}
                      placeholder="Agregar artículo: escribe nombre o clave y Enter…" />
                  </div>
                )}
                {verDinero && (
                  <div className="border-t border-borde px-5 py-3 flex justify-end">
                    <dl className="text-sm grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5">
                      <dt className="text-tenue">Subtotal</dt><dd className="text-right cifra">{dinero(o.subtotal, m)}</dd>
                      <dt className="text-tenue">IVA {Math.round(Number(o.tasa_iva) * 100)} %</dt><dd className="text-right cifra">{dinero(o.iva, m)}</dd>
                      <dt className="font-semibold">Total</dt><dd className="text-right cifra font-semibold">{dinero(o.total, m)}</dd>
                      {o.moneda !== "MXN" && <><dt className="text-tenue text-xs">En pesos (TC {numero(o.tipo_cambio)})</dt><dd className="text-right cifra text-xs text-tenue">{dinero(Number(o.total) * Number(o.tipo_cambio))}</dd></>}
                    </dl>
                  </div>
                )}
              </Tarjeta>

              {(recepciones.data?.length ?? 0) > 0 && (
                <Tarjeta className="overflow-hidden">
                  <EncabezadoTarjeta titulo="Recepciones en almacén" descripcion="Cada entrada, con quién la recibió y a qué almacén" />
                  <table className="tabla">
                    <tbody>
                      {recepciones.data!.map((r) => (
                        <tr key={r.id}>
                          <td className="text-xs text-tenue whitespace-nowrap">{fechaYHora(r.en)}</td>
                          <td className="max-w-[260px] truncate">{r.nombre}</td>
                          <td className="text-right"><CantidadConSigno n={Number(r.cantidad)} unidad={r.unidad} /></td>
                          <td className="whitespace-nowrap text-sm">{nombreCorto(r.almacen)}</td>
                          <td className="text-xs text-tenue">{r.usuario}{r.motivo?.includes("factura") && ` · ${r.motivo.split("· ").pop()}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Tarjeta>
              )}
            </div>

            <div className="space-y-5">
              <Tarjeta>
                <EncabezadoTarjeta titulo="Datos de la orden" />
                <div className="px-5 pb-5 space-y-3 text-sm">
                  <Dato etiqueta="Proveedor">
                    {editable ? <SelectorProveedor valor={{ id: o.proveedor_id, nombre: o.proveedor }} alCambiar={(p) => actualizar.mutate({ proveedor_id: p.id, moneda: p.moneda, tipo_cambio: tc.data?.[p.moneda] ?? 1 })} />
                      : <Link className="text-marca-texto hover:underline" to={`/compras/proveedores/${o.proveedor_id}`}>{o.proveedor}</Link>}
                  </Dato>
                  <div className="grid grid-cols-2 gap-3">
                    <Dato etiqueta="Moneda">
                      {editable ? (
                        <Seleccion value={o.moneda} onChange={(e) => { const mo = e.target.value as Moneda; actualizar.mutate({ moneda: mo, tipo_cambio: tc.data?.[mo] ?? 1 }); }}>
                          <option value="MXN">MXN</option><option value="USD">USD</option>
                        </Seleccion>
                      ) : o.moneda}
                    </Dato>
                    <Dato etiqueta="Tipo de cambio">
                      {editable && o.moneda !== "MXN" ? <CeldaEditable valor={Number(o.tipo_cambio)} ancho="w-full" alGuardar={(v) => v > 0 && actualizar.mutate({ tipo_cambio: v })} etiqueta="Tipo de cambio" />
                        : <span className="cifra">{o.moneda === "MXN" ? "—" : numero(o.tipo_cambio)}</span>}
                    </Dato>
                  </div>
                  <Dato etiqueta="Fecha de entrega">
                    {compra && o.estado !== "recibida" && o.estado !== "cancelada" ? (
                      <input type="date" className={cn("campo", o.atrasada && "border-peligro text-peligro")} defaultValue={o.fecha_entrega ?? ""} key={o.fecha_entrega}
                        onBlur={(e) => e.target.value !== (o.fecha_entrega ?? "") && actualizar.mutate({ fecha_entrega: e.target.value || null })} />
                    ) : fecha(o.fecha_entrega)}
                  </Dato>
                  <Dato etiqueta="Condiciones de pago">
                    {compra && o.estado !== "cancelada" ? <CampoTexto valor={o.condiciones} alGuardar={(v) => actualizar.mutate({ condiciones: v })} placeholder="Crédito a 30 días" /> : (o.condiciones ?? "—")}
                  </Dato>
                  {editable && verDinero && (
                    <Dato etiqueta="IVA">
                      <Seleccion value={String(Number(o.tasa_iva))} onChange={(e) => actualizar.mutate({ tasa_iva: Number(e.target.value) })}>
                        <option value="0.16">16 %</option><option value="0.08">8 % (frontera)</option><option value="0">0 % (importación / exento)</option>
                      </Seleccion>
                    </Dato>
                  )}
                  {!borrador && <Dato etiqueta="Factura del proveedor">{o.factura_proveedor ?? <span className="text-tenue">se captura al recibir</span>}</Dato>}
                  <Dato etiqueta="Notas para el proveedor">
                    {compra && o.estado !== "cancelada" ? <CampoTexto valor={o.notas} multilinea alGuardar={(v) => actualizar.mutate({ notas: v })} placeholder="Entregar en planta Atotonilco, horario…" />
                      : <p className="whitespace-pre-line">{o.notas ?? "—"}</p>}
                  </Dato>
                </div>
              </Tarjeta>
              {verDinero && o.estado !== "borrador" && o.estado !== "cancelada" && <PagosOC oc={o} />}
            </div>
          </div>
        </Pagina>
      </div>

      {verDinero && <ImpresionOC oc={o} lineas={lineas.data ?? []} proveedor={proveedor.data} empresa={empresa.data} />}

      <DialogoRecibir abierto={recibiendo} alCambiar={setRecibiendo} ocId={id} folio={o.folio} lineas={lineas.data ?? []} />
      <Dialogo abierto={cancelando} alCambiar={setCancelando} titulo={`Cancelar ${o.folio}`}
        descripcion="Lo que venía de requisiciones regresa a pendiente para volver a pedirse."
        pie={<><Boton variante="secundario" onClick={() => setCancelando(false)}>No cancelar</Boton>
          <Boton variante="peligro" disabled={!motivo.trim()} cargando={cancelar.isPending} onClick={() => cancelar.mutate(undefined)}>Cancelar la orden</Boton></>}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">¿Por qué se cancela?</span>
          <input className="campo" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El proveedor no tiene existencia…" />
        </label>
      </Dialogo>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <div className="space-y-1"><p className="text-xs text-tenue">{etiqueta}</p><div>{children}</div></div>;
}

/** Número que se edita en su lugar: Enter o salir guarda, Esc regresa. */
function CeldaEditable({ valor, alGuardar, etiqueta, ancho = "w-28" }: { valor: number; alGuardar: (v: number) => void; etiqueta: string; ancho?: string }) {
  const [t, setT] = useState(String(valor));
  useEffect(() => setT(String(valor)), [valor]);
  const guardar = () => { const n = Number(t.replace(/,/g, "")); if (!Number.isNaN(n) && n !== valor) alGuardar(n); else setT(String(valor)); };
  return (
    <input inputMode="decimal" aria-label={etiqueta} className={cn("campo h-8 text-right cifra ml-auto block", ancho)} value={t}
      onChange={(e) => setT(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={guardar}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setT(String(valor)); }} />
  );
}

function CampoTexto({ valor, alGuardar, placeholder, multilinea }: { valor: string | null; alGuardar: (v: string | null) => void; placeholder?: string; multilinea?: boolean }) {
  const [t, setT] = useState(valor ?? "");
  useEffect(() => setT(valor ?? ""), [valor]);
  const guardar = () => { if (t.trim() !== (valor ?? "").trim()) alGuardar(t.trim() || null); };
  return multilinea
    ? <textarea className="campo h-auto min-h-[72px] py-2" value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={guardar} />
    : <input className="campo" value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={guardar} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}
