import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, Check, Factory, FileText, PackageCheck, Plus, Receipt, ShoppingCart, Trash2, Truck, Users, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Barra, CampoNumero, Dato } from "./componentes/campos";
import { DialogoMotivo } from "./componentes/dialogos";
import { CANAL, ESTADO_PEDIDO, LINEA, dineroEn, hoyMx, useVendedores, type EstadoPedido, type Linea, type VPedido } from "./comun";
import { TarjetaEnvio } from "@/modulos/almacen/envios/TarjetaEnvio";

interface Pedido {
  id: string; folio: string; cotizacion_id: string | null; cliente_id: string; vendedor_id: string | null; canal: keyof typeof CANAL;
  id_externo: string | null; fecha: string; fecha_compromiso: string | null; estado: EstadoPedido; moneda: "MXN" | "USD" | "EUR";
  tipo_cambio: number; tasa_iva: number; subtotal: number; iva: number; total: number; condiciones_pago: string | null;
  direccion_entrega: string | null; notas: string | null; motivo_cancelacion: string | null; entregado_en: string | null; creado_en: string;
  historico?: boolean;
}
interface LineaPedido {
  id: string; orden: number; articulo_id: string | null; titulo: string; descripcion: string | null; unidad: string; cantidad: number;
  precio_unitario: number; descuento_pct: number; importe: number; linea: Linea; cantidad_entregada: number;
}
interface Orden { id: string; folio: string; estado: string; fecha_compromiso: string | null; numero_serie: string | null; terminada_en: string | null; creado_en: string; articulo: { nombre: string } | null }
interface Tablero { id: string; avance: number; etapa_actual: string | null; siguiente_etapa: string | null; atrasada: boolean; materiales_faltantes: number; pausada: boolean | null }

const ESTADO_OP: Record<string, string> = { planeada: "Planeada", liberada: "Liberada", en_proceso: "En proceso", terminada: "Terminada", entregada: "Entregada", cancelada: "Cancelada" };
const METODOS = ["transferencia", "efectivo", "tarjeta", "cheque", "mercadopago", "otro"] as const;

export default function DetallePedido() {
  const { id } = useParams();
  const { perfil, puede } = useSesion();
  const esGerente = puede("ventas", 3);
  const [dlg, setDlg] = useState<null | "cancelar" | "cobro" | "factura" | "credito">(null);

  const ped = useQuery({ queryKey: ["pedido", id], queryFn: () => q<Pedido | null>(supabase.from("pedidos").select("*").eq("id", id!).maybeSingle()) });
  const resumen = useQuery({ queryKey: ["v_pedidos", id], queryFn: () => q<VPedido | null>(supabase.from("v_pedidos").select("*").eq("id", id!).maybeSingle()) });
  const lineas = useQuery({ queryKey: ["pedido_lineas", id], queryFn: () => q<LineaPedido[]>(supabase.from("pedido_lineas").select("*").eq("pedido_id", id!).order("orden")) });
  const cobros = useQuery({ queryKey: ["cobros", id], queryFn: () => q<{ id: string; fecha: string; monto: number; metodo: string; referencia: string | null; notas: string | null }[]>(supabase.from("cobros").select("*").eq("pedido_id", id!).order("fecha")) });
  const facturas = useQuery({ queryKey: ["facturas", id], queryFn: () => q<{ id: string; folio: string; uuid_sat: string | null; fecha: string; total: number }[]>(supabase.from("facturas").select("*").eq("pedido_id", id!).order("fecha")) });
  const credito = useQuery({ queryKey: ["pedido_vendedores", id], queryFn: () => q<{ vendedor_id: string; porcentaje: number; vendedor: { nombre: string } | null }[]>(supabase.from("pedido_vendedores").select("vendedor_id, porcentaje, vendedor:perfiles(nombre)").eq("pedido_id", id!) as never) });
  const ordenes = useQuery({
    queryKey: ["ordenes_pedido", id], enabled: puede("produccion") || puede("inventario"),
    queryFn: () => q<Orden[]>(supabase.from("ordenes_produccion").select("id, folio, estado, fecha_compromiso, numero_serie, terminada_en, creado_en, articulo:articulos(nombre)").eq("pedido_id", id!).order("folio") as never),
  });
  const ids = (ordenes.data ?? []).map((o) => o.id);
  const tablero = useQuery({
    queryKey: ["v_tablero_produccion", "pedido", id, ids.join()], enabled: ids.length > 0,
    queryFn: () => q<Tablero[]>(supabase.from("v_tablero_produccion").select("id, avance, etapa_actual, siguiente_etapa, atrasada, materiales_faltantes, pausada").in("id", ids)),
  });
  const p = ped.data;
  const cliente = useQuery({ queryKey: ["cliente", p?.cliente_id], enabled: !!p?.cliente_id, queryFn: () => q<{ nombre: string }>(supabase.from("clientes").select("nombre").eq("id", p!.cliente_id).single()) });
  const vendedor = useQuery({ queryKey: ["perfil", p?.vendedor_id], enabled: !!p?.vendedor_id, queryFn: () => q<{ nombre: string; telefono: string | null; iniciales: string | null }>(supabase.from("perfiles").select("nombre, telefono, iniciales").eq("id", p!.vendedor_id!).single()) });

  const inv = [["pedido", id], ["v_pedidos"], ["pedido_lineas", id], ["indicadores"]];
  const actualizar = useAccion((cambios: Partial<Pedido>) => q(supabase.from("pedidos").update(cambios).eq("id", id!)), { exito: "Pedido actualizado", invalidar: inv });
  const entregar = useAccion(() => q(supabase.rpc("entregar_pedido", { p_id: id })), { exito: "Pedido entregado", invalidar: inv });
  const producir = useAccion(() => q<number>(supabase.rpc("ordenes_desde_pedido", { p_pedido: id })), {
    exito: (n) => (n ? `Se crearon ${n} orden(es) de producción` : "No hay equipos con lista de materiales sin orden en este pedido"),
    invalidar: [...inv, ["ordenes_pedido", id], ["v_tablero_produccion"]],
  });
  const agregar = useAccion((a: { id: string }) => q(supabase.rpc("agregar_partida_pedido", { p_pedido: id, p_articulo: a.id, p_cantidad: 1 })), { invalidar: inv });
  const editarLinea = useAccion((a: { id: string; cambios: Partial<LineaPedido> }) => q(supabase.from("pedido_lineas").update(a.cambios).eq("id", a.id)), { invalidar: inv });
  const quitarLinea = useAccion((lid: string) => q(supabase.from("pedido_lineas").delete().eq("id", lid)), { invalidar: inv });
  const borrarCobro = useAccion((cid: string) => q(supabase.from("cobros").delete().eq("id", cid)), { exito: "Cobro borrado", invalidar: [...inv, ["cobros", id]] });

  if (ped.isLoading) return <div className="p-8"><Cargando filas={8} /></div>;
  if (!p) return <div className="p-8"><div className="tarjeta"><Vacio icono={ShoppingCart} titulo="No encontramos este pedido" texto="Puede ser de otro vendedor." accion={<Boton asChild variante="secundario"><Link to="/ventas/pedidos">Ir a pedidos</Link></Boton>} /></div></div>;

  const mio = p.vendedor_id === perfil?.id;
  const puedeCambiar = (mio && puede("ventas", 2)) || esGerente || puede("produccion", 2) || puede("finanzas", 2);
  const editablePartidas = !p.historico && p.estado === "confirmado" && ((mio && puede("ventas", 2)) || esGerente);
  // El precio que salió de una cotización ya pasó por la autorización: solo la
  // gerencia lo mueve (la base lo exige, trg_pedido_linea_reglas).
  const editablePrecio = editablePartidas && (!p.cotizacion_id || esGerente);
  const abierto = !["entregado", "cancelado"].includes(p.estado);
  const r = resumen.data;
  const avance = ordenes.data?.length ? Math.round((ordenes.data ?? []).filter((o) => o.estado !== "cancelada")
    .reduce((s, o) => s + (["terminada", "entregada"].includes(o.estado) ? 100 : tablero.data?.find((t) => t.id === o.id)?.avance ?? 0), 0) / Math.max(1, ordenes.data.filter((o) => o.estado !== "cancelada").length)) : null;
  const conDescuento = (lineas.data ?? []).some((l) => Number(l.descuento_pct) > 0);
  const sumaCredito = (credito.data ?? []).reduce((s, x) => s + Number(x.porcentaje), 0);

  // Línea de tiempo: lo que pasó y cuándo, sin depender de la bitácora (que solo ve sistemas).
  const primeraOp = (ordenes.data ?? []).map((o) => o.creado_en).sort()[0];
  const terminadas = (ordenes.data ?? []).filter((o) => o.estado !== "cancelada");
  const listoEn = terminadas.length && terminadas.every((o) => o.terminada_en) ? terminadas.map((o) => o.terminada_en!).sort().pop() : null;
  const pasos = [
    { estado: "confirmado", texto: "Confirmado", cuando: p.fecha, hecho: true },
    { estado: "en_produccion", texto: "En producción", cuando: primeraOp, hecho: ["en_produccion", "listo", "entregado"].includes(p.estado) || !!primeraOp },
    { estado: "listo", texto: "Listo", cuando: listoEn, hecho: ["listo", "entregado"].includes(p.estado) },
    { estado: "entregado", texto: "Entregado", cuando: p.entregado_en, hecho: p.estado === "entregado" },
  ];

  return (
    <Pagina ancho="max-w-[1400px]"
      titulo={<span className="inline-flex flex-wrap items-center gap-2"><span className="cifra">{p.folio}</span><Insignia tono={ESTADO_PEDIDO[p.estado].tono} punto>{ESTADO_PEDIDO[p.estado].texto}</Insignia>
        {r?.atrasado && <Insignia tono="peligro">atrasado</Insignia>}{p.historico && <Insignia>histórico (paneles)</Insignia>}</span>}
      descripcion={<span>
        <Link to={`/ventas/clientes/${p.cliente_id}`} className="text-marca-texto hover:underline">{cliente.data?.nombre ?? "…"}</Link>
        {" · "}{CANAL[p.canal]}{p.id_externo ? ` #${p.id_externo}` : ""}
        {/* El folio llega de v_pedidos, que lo trae solo si la RLS deja ver la cotización (finanzas y producción no la ven). */}
        {p.cotizacion_id && (r?.cotizacion_folio
          ? <> · de <Link to={`/ventas/cotizaciones/${p.cotizacion_id}`} className="text-marca-texto hover:underline">{r.cotizacion_folio}</Link></>
          : <> · de cotización</>)}
        {vendedor.data && <> · {vendedor.data.nombre}</>}
      </span>}
      acciones={!p.historico && <>
        {puede("produccion", 2) && ["confirmado", "en_produccion"].includes(p.estado) && (
          <Boton variante="secundario" onClick={() => producir.mutate(undefined)} cargando={producir.isPending}><Factory className="h-4 w-4" />Mandar a producción</Boton>
        )}
        {puedeCambiar && ["confirmado", "en_produccion"].includes(p.estado) && (
          <Boton variante="secundario" onClick={() => actualizar.mutate({ estado: "listo" })}><PackageCheck className="h-4 w-4" />Marcar listo</Boton>
        )}
        {abierto && (puedeCambiar || puede("inventario", 2)) && (
          <Boton variante="exito" onClick={() => {
            const pendientes = (ordenes.data ?? []).filter((o) => !["terminada", "entregada", "cancelada"].includes(o.estado)).length;
            if (pendientes && !confirm(`Hay ${pendientes} orden(es) de producción sin terminar. ¿Entregar de todos modos?`)) return;
            entregar.mutate(undefined);
          }} cargando={entregar.isPending}><Truck className="h-4 w-4" />Entregar</Boton>
        )}
        {abierto && puedeCambiar && <Boton variante="fantasma" className="text-peligro" onClick={() => setDlg("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
      </>}>

      {p.estado === "cancelado" && <p className="rounded-xl border border-peligro/30 bg-peligro-suave px-4 py-3 text-sm text-peligro">Cancelado: {p.motivo_cancelacion}</p>}
      {p.historico && <p className="rounded-xl border border-borde bg-fondo px-4 py-3 text-sm text-tenue">Venta importada de los paneles de ventas (hojas). Cuenta para el historial y las comisiones, pero no es una cuenta por cobrar del ERP.</p>}

      {/* Línea de tiempo */}
      {p.estado !== "cancelado" && (
        <Tarjeta className="px-5 py-4">
          <ol className="grid grid-cols-4 gap-2">
            {pasos.map((s, i) => (
              <li key={s.estado} className="relative">
                {i > 0 && <span className={cn("absolute top-3 right-1/2 w-full h-0.5 -z-0", s.hecho ? "bg-ok" : "bg-borde")} />}
                <div className="relative flex flex-col items-center text-center">
                  <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center bg-superficie",
                    s.hecho ? "border-ok bg-ok text-white" : p.estado === s.estado ? "border-marca" : "border-borde")}>
                    {s.hecho && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <p className={cn("mt-1.5 text-xs font-medium", !s.hecho && "text-tenue")}>{s.texto}</p>
                  <p className="text-[11px] text-tenue">{s.cuando ? (s.cuando.length === 10 ? fecha(s.cuando) : fechaYHora(s.cuando)) : s.estado === "entregado" && p.fecha_compromiso ? `compromiso ${fecha(p.fecha_compromiso)}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-4 min-w-0">
          <Tarjeta className="overflow-visible">
            <EncabezadoTarjeta titulo="Partidas" descripcion={editablePartidas ? "Mientras está confirmado se pueden ajustar." : undefined} />
            {editablePartidas && <div className="px-4 pb-3"><BuscadorArticulo placeholder="Agregar partida desde el catálogo…" alElegir={(a) => agregar.mutate(a)} /></div>}
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead><tr><th>Partida</th><th className="text-right">Cant.</th><th className="text-right">P. unitario</th>{conDescuento && <th className="text-right">Desc.</th>}<th className="text-right">Importe</th>{editablePartidas && <th />}</tr></thead>
                <tbody>
                  {(lineas.data ?? []).map((l) => (
                    <tr key={l.id}>
                      <td className="min-w-[220px]">
                        <p className="font-medium">{l.titulo}</p>
                        <Insignia className="mt-1" tono={l.linea === "maquinaria" ? "marca" : l.linea === "refacciones" ? "info" : "neutro"}>{LINEA[l.linea]}</Insignia>
                      </td>
                      <td className="text-right cifra w-24">
                        {editablePartidas ? <NumeroAlSalir valor={Number(l.cantidad)} decimales={3} min={0.001}
                          alGuardar={(n) => editarLinea.mutate({ id: l.id, cambios: { cantidad: n } })} /> : <span className="whitespace-nowrap">{numero(Number(l.cantidad))} {l.unidad}</span>}
                        {Number(l.cantidad_entregada) > 0 && <span className="block text-[11px] text-ok">{numero(Number(l.cantidad_entregada))} entregado</span>}
                      </td>
                      <td className="text-right cifra w-32">
                        {editablePrecio ? <NumeroAlSalir valor={Number(l.precio_unitario)} min={0}
                          alGuardar={(n) => editarLinea.mutate({ id: l.id, cambios: { precio_unitario: n } })} /> : dineroEn(Number(l.precio_unitario), p.moneda)}
                      </td>
                      {conDescuento && <td className="text-right cifra">{Number(l.descuento_pct) ? porcentaje(Number(l.descuento_pct), 1) : "—"}</td>}
                      <td className="text-right cifra font-medium">{dineroEn(Number(l.importe), p.moneda)}</td>
                      {editablePartidas && <td><Boton variante="fantasma" tamano="icono" aria-label="Quitar" onClick={() => quitarLinea.mutate(l.id)}><Trash2 className="h-4 w-4" /></Boton></td>}
                    </tr>
                  ))}
                  {(lineas.data?.length ?? 0) === 0 && <tr><td colSpan={6} className="text-center text-tenue py-6">Sin partidas: agrégalas con el buscador.</td></tr>}
                </tbody>
              </table>
            </div>
            {editablePartidas && (
              <p className="px-4 py-2 text-xs text-tenue border-t border-borde">
                {editablePrecio ? "Cantidad y precio se guardan al salir del campo (Enter o Tab). Precios sin IVA."
                  : "La cantidad se guarda al salir del campo. Los precios son los de la cotización: para cambiarlos, saca una nueva versión o pídeselo a la gerencia."}
              </p>
            )}
            <div className="flex justify-end px-5 py-4 border-t border-borde">
              <dl className="w-72 text-sm space-y-1">
                <div className="flex justify-between"><dt className="text-tenue">Subtotal</dt><dd className="cifra">{dineroEn(Number(p.subtotal), p.moneda)}</dd></div>
                <div className="flex justify-between"><dt className="text-tenue">IVA {porcentaje(Number(p.tasa_iva), 0)}</dt><dd className="cifra">{dineroEn(Number(p.iva), p.moneda)}</dd></div>
                <div className="flex justify-between font-semibold text-base border-t border-borde pt-1"><dt>Total</dt><dd className="cifra">{dineroEn(Number(p.total), p.moneda)}</dd></div>
                {!p.historico && <>
                  <div className="flex justify-between text-ok"><dt>Cobrado</dt><dd className="cifra">{dineroEn(Number(r?.cobrado ?? 0), p.moneda)}</dd></div>
                  <div className="flex justify-between font-medium text-aviso"><dt>Saldo</dt><dd className="cifra">{dineroEn(Number(r?.saldo ?? 0), p.moneda)}</dd></div>
                </>}
              </dl>
            </div>
          </Tarjeta>

          {(puede("produccion") || puede("inventario")) && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Producción" descripcion={avance != null ? `Avance del pedido: ${avance}%` : "Órdenes de taller de este pedido"}
                acciones={avance != null && <div className="w-32"><Barra valor={avance} tono={avance === 100 ? "ok" : "marca"} /></div>} />
              {(ordenes.data?.length ?? 0) === 0 ? (
                <p className="px-5 pb-5 text-sm text-tenue">
                  Sin órdenes de producción.{puede("produccion", 2) ? " “Mandar a producción” crea una por cada equipo con lista de materiales." : " Producción las crea cuando el pedido entra a taller."}
                </p>
              ) : (
                <table className="tabla">
                  <thead><tr><th>Orden</th><th>Equipo</th><th>Estado</th><th>Etapa</th><th>Compromiso</th><th className="w-40">Avance</th></tr></thead>
                  <tbody>
                    {ordenes.data!.map((o) => {
                      const t = tablero.data?.find((x) => x.id === o.id);
                      const av = ["terminada", "entregada"].includes(o.estado) ? 100 : t?.avance ?? 0;
                      return (
                        <tr key={o.id}>
                          <td className="font-medium cifra">{puede("produccion") ? <Link to={`/produccion/ordenes/${o.id}`} className="text-marca-texto">{o.folio}</Link> : o.folio}{o.numero_serie && <span className="block text-[11px] text-tenue">{o.numero_serie}</span>}</td>
                          <td className="max-w-[240px] truncate">{o.articulo?.nombre}</td>
                          <td><Insignia tono={o.estado === "terminada" || o.estado === "entregada" ? "ok" : o.estado === "en_proceso" ? "info" : "neutro"}>{ESTADO_OP[o.estado] ?? o.estado}</Insignia>
                            {t?.atrasada && <Insignia tono="peligro" className="ml-1">atrasada</Insignia>}
                            {Number(t?.materiales_faltantes ?? 0) > 0 && <Insignia tono="aviso" className="ml-1">faltan materiales</Insignia>}</td>
                          <td className="text-sm">{t?.etapa_actual ?? (t?.siguiente_etapa ? <span className="text-tenue">sigue {t.siguiente_etapa}</span> : "—")}</td>
                          <td>{fecha(o.fecha_compromiso)}</td>
                          <td><div className="flex items-center gap-2"><Barra valor={av} tono={av === 100 ? "ok" : "marca"} /><span className="text-xs cifra w-9 text-right">{av}%</span></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Tarjeta>
          )}
        </div>

        <div className="space-y-4">
          <TarjetaEnvio pedido={p} />
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos del pedido" />
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <Dato etiqueta="Fecha">{fecha(p.fecha)}</Dato>
              <Dato etiqueta="Compromiso">
                {abierto && puedeCambiar && !p.historico ? (
                  <input type="date" className="campo h-8" defaultValue={p.fecha_compromiso ?? ""} min={hoyMx()}
                    onBlur={(e) => { if (e.target.value !== (p.fecha_compromiso ?? "")) actualizar.mutate({ fecha_compromiso: e.target.value || null }); }} />
                ) : fecha(p.fecha_compromiso)}
              </Dato>
              <Dato etiqueta="Canal">{CANAL[p.canal]}</Dato>
              <Dato etiqueta={p.canal === "mercadolibre" ? "Número de venta ML" : "Número externo"}>
                {puedeCambiar && !p.historico ? <CampoExterno valor={p.id_externo} alGuardar={(v) => actualizar.mutate({ id_externo: v })} /> : p.id_externo ?? "—"}
              </Dato>
              <Dato etiqueta="Condiciones de pago" className="col-span-2">{p.condiciones_pago ?? "—"}</Dato>
              {p.notas && <Dato etiqueta="Notas" className="col-span-2">{p.notas}</Dato>}
              {p.moneda !== "MXN" && <Dato etiqueta="Tipo de cambio" className="col-span-2">${numero(Number(p.tipo_cambio))} MXN por {p.moneda}</Dato>}
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Crédito de la venta" descripcion={(credito.data?.length ?? 0) > 1 ? "Compartido entre vendedores" : "Para comisiones"}
              acciones={esGerente && !p.historico && <Boton variante="secundario" tamano="sm" onClick={() => setDlg("credito")}><Users className="h-3.5 w-3.5" />Compartir</Boton>} />
            <div className="px-5 pb-4 space-y-1.5 text-sm">
              {(credito.data?.length ?? 0) === 0 ? <p className="flex justify-between"><span>{vendedor.data?.nombre ?? "Sin vendedor"}</span><span className="cifra">100%</span></p>
                : credito.data!.map((x) => <p key={x.vendedor_id} className="flex justify-between"><span>{x.vendedor?.nombre}</span><span className="cifra font-medium">{numero(Number(x.porcentaje))}%</span></p>)}
              {(credito.data?.length ?? 0) > 0 && Math.abs(sumaCredito - 100) > 0.01 && <p className="text-xs text-peligro">Los porcentajes suman {numero(sumaCredito)}%, no 100%.</p>}
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Facturas" acciones={puede("finanzas", 2) && <Boton variante="secundario" tamano="sm" onClick={() => setDlg("factura")}><FileText className="h-3.5 w-3.5" />Registrar</Boton>} />
            <div className="px-5 pb-4 text-sm space-y-1.5">
              {(facturas.data?.length ?? 0) === 0 ? <p className="text-tenue">Sin facturar.{!puede("finanzas", 2) && " La registra finanzas."}</p>
                : facturas.data!.map((f) => <p key={f.id} className="flex justify-between gap-2"><span><b className="cifra">{f.folio}</b> · {fecha(f.fecha)}</span><span className="cifra">{dineroEn(Number(f.total), p.moneda)}</span></p>)}
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Cobros" descripcion={!p.historico && r ? `${dineroEn(Number(r.cobrado), p.moneda)} de ${dineroEn(Number(p.total), p.moneda)}` : undefined}
              acciones={puede("finanzas", 2) && !p.historico && <Boton variante="secundario" tamano="sm" onClick={() => setDlg("cobro")}><Wallet className="h-3.5 w-3.5" />Registrar</Boton>} />
            <div className="px-5 pb-4 text-sm space-y-2">
              {!p.historico && Number(p.total) > 0 && <Barra valor={(Number(r?.cobrado ?? 0) / Number(p.total)) * 100} tono="ok" />}
              {(cobros.data?.length ?? 0) === 0 ? <p className="text-tenue">Sin cobros registrados.{!puede("finanzas", 2) && " Los captura finanzas."}</p>
                : cobros.data!.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span><Receipt className="inline h-3.5 w-3.5 text-tenue mr-1" />{fecha(c.fecha)} · {c.metodo}{c.referencia ? ` · ${c.referencia}` : ""}</span>
                    <span className="flex items-center gap-1">
                      <span className="cifra font-medium">{dineroEn(Number(c.monto), p.moneda)}</span>
                      {puede("finanzas", 2) && <button className="text-tenue hover:text-peligro" aria-label="Borrar cobro" onClick={() => { if (confirm("¿Borrar este cobro?")) borrarCobro.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></button>}
                    </span>
                  </div>
                ))}
            </div>
          </Tarjeta>
        </div>
      </div>

      <DialogoMotivo abierto={dlg === "cancelar"} alCambiar={(v) => setDlg(v ? "cancelar" : null)} titulo={`Cancelar ${p.folio}`}
        descripcion={(ordenes.data ?? []).some((o) => !["terminada", "entregada", "cancelada"].includes(o.estado)) ? "Ojo: tiene órdenes de producción abiertas; avisa a producción para que las cancele." : "El pedido deja de contar para comisiones y cobranza."}
        sugerencias={["El cliente canceló", "Pedido duplicado", "Sin anticipo en el plazo", "Cambió por otro equipo"]} textoBoton="Cancelar pedido"
        cargando={actualizar.isPending} alConfirmar={(m) => actualizar.mutate({ estado: "cancelado", motivo_cancelacion: m }, { onSuccess: () => setDlg(null) })} />
      <DialogoCobro abierto={dlg === "cobro"} alCambiar={(v) => setDlg(v ? "cobro" : null)} pedidoId={p.id} saldo={Number(r?.saldo ?? 0)} moneda={p.moneda} />
      <DialogoFactura abierto={dlg === "factura"} alCambiar={(v) => setDlg(v ? "factura" : null)} pedidoId={p.id} total={Number(p.total)} />
      <DialogoCredito abierto={dlg === "credito"} alCambiar={(v) => setDlg(v ? "credito" : null)} pedidoId={p.id} vendedorId={p.vendedor_id}
        actual={(credito.data ?? []).map((x) => ({ vendedor_id: x.vendedor_id, porcentaje: Number(x.porcentaje) }))} />
    </Pagina>
  );
}

/** Número que se guarda al salir del campo: en el pedido cada cambio recalcula totales y no conviene hacerlo por tecla. */
function NumeroAlSalir({ valor, alGuardar, decimales, min }: { valor: number; alGuardar: (n: number) => void; decimales?: number; min?: number }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <div onBlur={() => { if (v !== valor && v > 0) alGuardar(v); }}>
      <CampoNumero valor={v} decimales={decimales} min={min} alCambiar={setV} />
    </div>
  );
}

function CampoExterno({ valor, alGuardar }: { valor: string | null; alGuardar: (v: string | null) => void }) {
  const [v, setV] = useState(valor ?? "");
  useEffect(() => setV(valor ?? ""), [valor]);
  return <input className="campo h-8" value={v} placeholder="Opcional" onChange={(e) => setV(e.target.value)} onBlur={() => { if ((v.trim() || null) !== valor) alGuardar(v.trim() || null); }} />;
}

function DialogoCobro({ abierto, alCambiar, pedidoId, saldo, moneda }: { abierto: boolean; alCambiar: (v: boolean) => void; pedidoId: string; saldo: number; moneda: "MXN" | "USD" | "EUR" }) {
  const [f, setF] = useState({ fecha: hoyMx(), monto: 0, metodo: "transferencia", referencia: "" });
  useEffect(() => { if (abierto) setF({ fecha: hoyMx(), monto: Math.max(0, saldo), metodo: "transferencia", referencia: "" }); }, [abierto, saldo]);
  const guardar = useAccion(() => q(supabase.from("cobros").insert({ pedido_id: pedidoId, fecha: f.fecha, monto: f.monto, metodo: f.metodo, referencia: f.referencia || null })),
    { exito: "Cobro registrado", invalidar: [["cobros", pedidoId], ["v_pedidos"], ["pedido", pedidoId], ["indicadores"]], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Registrar cobro" descripcion={`Saldo actual: ${dineroEn(saldo, moneda)}`}
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={!f.monto}>Registrar</Boton></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha"><Entrada type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        <Campo etiqueta={`Monto (${moneda})`}><CampoNumero valor={f.monto} prefijo="$" alCambiar={(n) => setF({ ...f, monto: n })} /></Campo>
        <Campo etiqueta="Forma de pago">
          <Seleccion value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>{METODOS.map((m) => <option key={m} value={m}>{m === "mercadopago" ? "Mercado Pago" : m[0].toUpperCase() + m.slice(1)}</option>)}</Seleccion>
        </Campo>
        <Campo etiqueta="Referencia"><Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, folio de depósito…" /></Campo>
      </div>
    </Dialogo>
  );
}

function DialogoFactura({ abierto, alCambiar, pedidoId, total }: { abierto: boolean; alCambiar: (v: boolean) => void; pedidoId: string; total: number }) {
  const [f, setF] = useState({ folio: "", uuid: "", fecha: hoyMx(), total });
  useEffect(() => { if (abierto) setF({ folio: "", uuid: "", fecha: hoyMx(), total }); }, [abierto, total]);
  const guardar = useAccion(() => q(supabase.from("facturas").insert({ pedido_id: pedidoId, folio: f.folio.trim(), uuid_sat: f.uuid.trim() || null, fecha: f.fecha, total: f.total })),
    { exito: "Factura registrada", invalidar: [["facturas", pedidoId], ["v_pedidos"]], alTerminar: () => alCambiar(false) });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Registrar factura"
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={!f.folio.trim()}>Registrar</Boton></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Folio"><Entrada value={f.folio} onChange={(e) => setF({ ...f, folio: e.target.value })} placeholder="A-2990" /></Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        <Campo etiqueta="UUID del SAT" className="sm:col-span-2"><Entrada value={f.uuid} onChange={(e) => setF({ ...f, uuid: e.target.value })} /></Campo>
        <Campo etiqueta="Total"><CampoNumero valor={f.total} prefijo="$" alCambiar={(n) => setF({ ...f, total: n })} /></Campo>
      </div>
    </Dialogo>
  );
}

/** Crédito compartido ("* Pinto, Isaac, Susy" en la hoja): solo la gerencia. Suma 100 %. */
function DialogoCredito({ abierto, alCambiar, pedidoId, vendedorId, actual }: {
  abierto: boolean; alCambiar: (v: boolean) => void; pedidoId: string; vendedorId: string | null; actual: { vendedor_id: string; porcentaje: number }[];
}) {
  const vendedores = useVendedores(abierto);
  const [filas, setFilas] = useState<{ vendedor_id: string; porcentaje: number }[]>([]);
  useEffect(() => { if (abierto) setFilas(actual.length ? actual : vendedorId ? [{ vendedor_id: vendedorId, porcentaje: 100 }] : []); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [abierto]);
  const suma = filas.reduce((s, x) => s + x.porcentaje, 0);
  // Todo en una llamada: la base revisa que sume 100 % y reescribe el reparto de
  // un jalón (antes eran dos peticiones y una falla dejaba el pedido sin reparto).
  const guardar = useAccion(
    () => q(supabase.rpc("compartir_credito", { p_pedido: pedidoId, p_reparto: filas.filter((x) => x.vendedor_id && x.porcentaje > 0) })),
    { exito: "Crédito actualizado", invalidar: [["pedido_vendedores", pedidoId], ["v_pedidos"]], alTerminar: () => alCambiar(false) },
  );
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Compartir crédito de la venta" descripcion="Cada vendedor cobra comisión sobre su porcentaje."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={Math.abs(suma - 100) > 0.01}>Guardar ({numero(suma)}%)</Boton></>}>
      <div className="space-y-2">
        {filas.map((x, i) => (
          <div key={i} className="flex gap-2">
            <select className="campo pr-8" value={x.vendedor_id} onChange={(e) => setFilas(filas.map((y, j) => (j === i ? { ...y, vendedor_id: e.target.value } : y)))}>
              <option value="">— vendedor —</option>
              {vendedores.data?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
            <CampoNumero className="w-28" valor={x.porcentaje} decimales={2} min={0} max={100} sufijo="%" alCambiar={(n) => setFilas(filas.map((y, j) => (j === i ? { ...y, porcentaje: n } : y)))} />
            <Boton variante="fantasma" tamano="icono" aria-label="Quitar" onClick={() => setFilas(filas.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Boton>
          </div>
        ))}
        <Boton variante="secundario" tamano="sm" onClick={() => setFilas([...filas, { vendedor_id: "", porcentaje: Math.max(0, 100 - suma) }])}><Plus className="h-3.5 w-3.5" />Agregar vendedor</Boton>
      </div>
    </Dialogo>
  );
}
