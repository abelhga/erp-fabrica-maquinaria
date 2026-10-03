import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, FilePen, Globe2, PackageCheck, Plus, Truck, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { dinero, dineroCompacto, fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { InsigniaOC, type OrdenCompra } from "./componentes/comun";
import { Requisiciones } from "./componentes/Requisiciones";

type FiltroOC = "abiertas" | "atrasadas" | "borrador" | "por_recibir" | "recibidas" | "todas";

export default function OrdenesCompra() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") === "requisiciones" ? "requisiciones" : "ordenes";
  const filtro = (params.get("filtro") as FiltroOC) || "abiertas";
  const creadas = params.get("creadas")?.split(",").filter(Boolean) ?? [];
  // El almacén ve las órdenes para recibirlas; los importes son de quien ve costos o finanzas.
  const verDinero = puede("costos", 1) || puede("finanzas", 1);

  const ordenes = useQuery({
    queryKey: ["v_ordenes_compra"],
    queryFn: () => todasLasFilas<OrdenCompra>((d, h) => supabase.from("v_ordenes_compra")
      .select("id, folio, proveedor_id, proveedor, es_importacion, estado, fecha, fecha_entrega, moneda, tipo_cambio, total, partidas, avance_recibido, atrasada, dias_atraso, pagado, creado_por_nombre, creado_en, notas, condiciones, factura_proveedor, subtotal, iva, tasa_iva, vence_pago")
      .order("fecha", { ascending: false }).order("folio", { ascending: false }).range(d, h)),
  });
  const reqPendientes = useQuery({
    queryKey: ["requisiciones_pendientes_cuenta"],
    queryFn: async () => {
      const { count } = await supabase.from("requisicion_lineas").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
      return count ?? 0;
    },
  });

  const todas = ordenes.data ?? [];
  const pasa = (o: OrdenCompra, f: FiltroOC) => {
    switch (f) {
      case "abiertas": return ["borrador", "enviada", "parcial"].includes(o.estado);
      case "atrasadas": return o.atrasada;
      case "borrador": return o.estado === "borrador";
      case "por_recibir": return o.estado === "enviada" || o.estado === "parcial";
      case "recibidas": return o.estado === "recibida";
      default: return true;
    }
  };
  const visibles = useMemo(() => creadas.length ? todas.filter((o) => creadas.includes(o.id)) : todas.filter((o) => pasa(o, filtro)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todas, filtro, creadas.join(",")]);
  const porRecibir = todas.filter((o) => pasa(o, "por_recibir"));
  const enPesos = (o: OrdenCompra) => Number(o.total) * Number(o.tipo_cambio);

  const cambiar = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    if (k !== "creadas") p.delete("creadas");
    setParams(p, { replace: true });
  };

  const columnas: Columna<OrdenCompra>[] = [
    { clave: "folio", titulo: "Folio", clase: "whitespace-nowrap font-medium" },
    {
      clave: "proveedor", titulo: "Proveedor", clase: "max-w-[240px]",
      celda: (o) => <>
        <p className="truncate flex items-center gap-1.5" title={o.proveedor}><span className="truncate">{o.proveedor}</span>{o.es_importacion && <Globe2 className="h-3.5 w-3.5 text-info shrink-0" aria-label="importación" />}</p>
        <p className="text-xs text-tenue">{o.partidas} partida(s){o.creado_por_nombre ? ` · ${o.creado_por_nombre}` : ""}</p>
      </>,
    },
    { clave: "fecha", titulo: "Fecha", clase: "whitespace-nowrap text-tenue px-2", valor: (o) => o.fecha, celda: (o) => fecha(o.fecha) },
    {
      clave: "fecha_entrega", titulo: "Entrega", clase: "whitespace-nowrap px-2", valor: (o) => o.fecha_entrega,
      celda: (o) => <span className={cn(o.atrasada && "text-peligro font-medium")}>{fecha(o.fecha_entrega)}</span>,
    },
    { clave: "estado", titulo: "Estado", valor: (o) => o.estado, celda: (o) => <InsigniaOC estado={o.estado} atrasada={o.atrasada} dias={o.dias_atraso} /> },
    {
      clave: "avance_recibido", titulo: "Recibido", sinBusqueda: true, clase: "px-2", valor: (o) => Number(o.avance_recibido),
      celda: (o) => o.estado === "borrador" || o.estado === "cancelada" ? <span className="text-tenue/50">·</span> : (
        <div className="flex items-center gap-2 min-w-[90px]">
          <div className="h-1.5 flex-1 rounded-full bg-fondo overflow-hidden"><div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(Number(o.avance_recibido) * 100)}%` }} /></div>
          <span className="text-xs text-tenue cifra w-9 text-right">{Math.round(Number(o.avance_recibido) * 100)}%</span>
        </div>
      ),
    },
    { clave: "total", titulo: "Total", alinear: "der", sinBusqueda: true, oculta: !verDinero, clase: "px-2 whitespace-nowrap", valor: (o) => Number(o.total), celda: (o) => dinero(o.total, o.moneda === "USD" ? "USD" : "MXN") },
    {
      clave: "saldo", titulo: "Por pagar", alinear: "der", sinBusqueda: true, oculta: !verDinero, clase: "px-2 whitespace-nowrap", valor: (o) => Number(o.total) - Number(o.pagado),
      celda: (o) => o.estado === "borrador" || o.estado === "cancelada" ? <span className="text-tenue/50">·</span>
        : Number(o.total) - Number(o.pagado) <= 0.005 ? <span className="text-ok text-xs">pagada</span>
        : <span className="text-tenue">{dinero(Number(o.total) - Number(o.pagado), o.moneda === "USD" ? "USD" : "MXN")}</span>,
    },
  ];

  return (
    <Pagina
      titulo="Órdenes de compra"
      descripcion="De la requisición al proveedor y del proveedor al almacén: cada orden con su folio, su entrega y lo que ya llegó."
      acciones={puede("compras", 2) && <Boton onClick={() => ir("/compras/ordenes/nueva")}><Plus className="h-4 w-4" /> Nueva orden</Boton>}
    >
      <Pestanas value={vista} onValueChange={(v) => cambiar("vista", v === "ordenes" ? null : v)}>
        <ListaPestanas opciones={[
          { valor: "ordenes", texto: "Órdenes" },
          { valor: "requisiciones", texto: "Requisiciones", cuenta: reqPendientes.data || undefined },
        ]} />
        <ContenidoPestana value="ordenes" className="pt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi titulo="Por recibir" valor={numero(porRecibir.length)} icono={Truck} tono="info"
              detalle={verDinero ? `${dineroCompacto(porRecibir.reduce((s, o) => s + enPesos(o) * (1 - Number(o.avance_recibido)), 0))} en camino` : "enviadas al proveedor"}
              alClic={() => cambiar("filtro", "por_recibir")} />
            <Kpi titulo="Atrasadas" valor={numero(todas.filter((o) => o.atrasada).length)} icono={AlertTriangle}
              tono={todas.some((o) => o.atrasada) ? "peligro" : "ok"} detalle="pasó su fecha de entrega" alClic={() => cambiar("filtro", "atrasadas")} />
            <Kpi titulo="En borrador" valor={numero(todas.filter((o) => o.estado === "borrador").length)} icono={FilePen} tono="neutro"
              detalle="falta enviarlas al proveedor" alClic={() => cambiar("filtro", "borrador")} />
            <Kpi titulo="Requisiciones" valor={numero(reqPendientes.data ?? 0)} icono={ClipboardList} tono="marca"
              detalle="partidas esperando orden de compra" alClic={() => cambiar("vista", "requisiciones")} />
          </div>

          {creadas.length > 0 && (
            <div className="rounded-xl border border-ok/30 bg-ok-suave px-4 py-3 text-sm flex items-center gap-3">
              <PackageCheck className="h-5 w-5 text-ok" />
              <p className="flex-1">Se crearon <b>{creadas.length}</b> órdenes en borrador, una por proveedor. Revisa precios y fechas, y envíalas.</p>
              <button onClick={() => cambiar("creadas", null)} className="p-1 rounded text-tenue hover:bg-fondo" aria-label="Ver todas"><X className="h-4 w-4" /></button>
            </div>
          )}

          <TablaDatos
            filas={visibles}
            columnas={columnas}
            cargando={ordenes.isLoading}
            error={ordenes.error}
            claveFila={(o) => o.id}
            alClicFila={(o) => ir(`/compras/ordenes/${o.id}`)}
            exportarComo="ordenes-compra"
            placeholder="Folio, proveedor…"
            claseFila={(o) => (o.atrasada ? "bg-peligro-suave/30" : undefined)}
            filtros={!creadas.length && (
              <Filtro<FiltroOC> valor={filtro} alCambiar={(f) => cambiar("filtro", f === "abiertas" ? null : f)} opciones={[
                { valor: "abiertas", texto: "Abiertas", cuenta: todas.filter((o) => pasa(o, "abiertas")).length },
                { valor: "atrasadas", texto: "Atrasadas", cuenta: todas.filter((o) => o.atrasada).length },
                { valor: "borrador", texto: "Borradores" },
                { valor: "por_recibir", texto: "Por recibir" },
                { valor: "recibidas", texto: "Recibidas" },
                { valor: "todas", texto: "Todas" },
              ]} />
            )}
            vacio={{
              icono: ClipboardList, titulo: filtro === "atrasadas" ? "Ninguna orden atrasada" : "No hay órdenes con este filtro",
              texto: puede("compras", 2) ? "Crea una desde las requisiciones, desde el reabasto o con “Nueva orden”." : "Cambia el filtro para ver otras.",
            }}
          />
        </ContenidoPestana>
        <ContenidoPestana value="requisiciones" className="pt-5">
          <Requisiciones />
        </ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}
