// Lo de Mercado Libre que pide la gente de la hoja: cuánto pagó el comprador, qué se quedó ML
// (comisión, envío, retenciones) y cuánto llega a Mercado Pago y cuándo. Sale tal cual del pago
// de Mercado Pago (v_ml_dinero); el ERP no calcula nada.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, HandCoins, Landmark, Receipt, Truck, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { GLOSARIO } from "@/tutorial/glosario";

export interface DineroML {
  pago_id: string; order_id: string; pedido_id: string | null; folio: string | null; comprador: string | null; full_ml: boolean;
  envio_ml: string | null; estado: string | null; pagado_en: string | null; metodo: string | null;
  total: number; comision: number; envio: number; retencion_iva: number; retencion_isr: number; otros: number;
  reembolsado: number; neto: number | null; libera_en: string | null; disponible: boolean; completo: boolean;
}
interface VentaML { order_id: string; envio_ml: string | null; envio_sub: string | null; guia: string | null; full_ml: boolean; nota: string | null }

// Cómo va el envío en Mercado Libre, con las palabras de la app de ML.
export const ENVIO_ML: Record<string, { texto: string; tono: "neutro" | "info" | "aviso" | "ok" | "peligro" }> = {
  pending: { texto: "Pendiente", tono: "neutro" },
  handling: { texto: "En preparación", tono: "info" },
  ready_to_ship: { texto: "Lista para enviar", tono: "info" },
  shipped: { texto: "En camino", tono: "aviso" },
  delivered: { texto: "Entregada", tono: "ok" },
  not_delivered: { texto: "No se entregó", tono: "peligro" },
  cancelled: { texto: "Envío cancelado", tono: "peligro" },
};
const SUB: Record<string, string> = { ready_to_print: "falta imprimir la guía", printed: "guía impresa", in_hub: "en el centro de ML" };
const enMLweb = (order: string) => `https://www.mercadolibre.com.mx/ventas/${order}/detalle`;
const descuentos = (d: DineroML) => d.comision + d.envio + d.retencion_iva + d.retencion_isr + d.otros;

/** El recuadro de Mercado Libre en la ficha del pedido: el envío según ML y el dinero. */
export function TarjetaMercadoLibre({ pedidoId }: { pedidoId: string }) {
  const venta = useQuery({
    queryKey: ["ml_venta", pedidoId],
    queryFn: () => q<VentaML[]>(supabase.from("ml_ventas").select("order_id, envio_ml, envio_sub, guia, full_ml, nota").eq("pedido_id", pedidoId)),
  });
  const pagos = useQuery({
    queryKey: ["ml_dinero", pedidoId],
    queryFn: () => q<DineroML[]>(supabase.from("v_ml_dinero").select("*").eq("pedido_id", pedidoId).order("pagado_en")),
  });
  const v = venta.data?.[0];
  if (!v) return null;
  const env = v.envio_ml ? ENVIO_ML[v.envio_ml] : null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Mercado Libre" explica={GLOSARIO.dineroML}
        acciones={<a href={enMLweb(v.order_id)} target="_blank" rel="noreferrer" className="text-sm text-marca-texto inline-flex items-center gap-1">Ver en ML<ExternalLink className="h-3.5 w-3.5" /></a>} />
      <div className="px-4 pb-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2" data-explain={GLOSARIO.envioML} data-explain-title="Envío en Mercado Libre">
          <Truck className="h-4 w-4 text-tenue" />
          {env ? <Insignia tono={env.tono}>{env.texto}</Insignia> : <span className="text-tenue">Sin envío de ML</span>}
          {v.envio_sub && SUB[v.envio_sub] && <span className="text-xs text-tenue">{SUB[v.envio_sub]}</span>}
          {v.full_ml && <Insignia tono="marca">Full</Insignia>}
          {v.guia && <span className="text-xs text-tenue cifra">guía {v.guia}</span>}
        </div>
        {(pagos.data ?? []).map((d) => (
          <div key={d.pago_id} className="rounded-lg border border-borde">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-borde">
              <span className="font-medium">{d.estado === "refunded" ? "Pago reembolsado" : "Pagado"}{d.pagado_en && <span className="font-normal text-tenue"> · {fecha(d.pagado_en)}</span>}</span>
              <span className="cifra font-semibold">{dinero(d.total)}</span>
            </div>
            <dl className="px-3 py-2 space-y-1 text-[13px]">
              <Renglon t="Comisión de Mercado Libre" v={d.comision} />
              <Renglon t="Envío (lo pagamos nosotros)" v={d.envio} />
              <Renglon t="Retención de IVA" v={d.retencion_iva} explica={GLOSARIO.retencionesML} />
              <Renglon t="Retención de ISR" v={d.retencion_isr} explica={GLOSARIO.retencionesML} />
              {d.otros > 0 && <Renglon t="Otros cargos" v={d.otros} />}
              {d.reembolsado > 0 && <Renglon t="Reembolsado al comprador" v={d.reembolsado} />}
            </dl>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-borde bg-fondo/60 rounded-b-lg" data-explain={GLOSARIO.netoML} data-explain-title="Llega a Mercado Pago">
              <span>
                Llega a Mercado Pago
                <span className="block text-xs text-tenue">
                  {d.disponible ? "Ya disponible" : d.libera_en ? `Disponible el ${fecha(d.libera_en)}` : ""}
                </span>
              </span>
              <span className="cifra font-semibold text-ok">{d.neto != null ? dinero(d.neto) : "—"}</span>
            </div>
            {!d.completo && <p className="px-3 pb-2 text-xs text-aviso">Mercado Pago no dio el desglose de este pago: falta lo que se retuvo.</p>}
          </div>
        ))}
        {pagos.data?.length === 0 && <p className="text-tenue">Todavía sin pago aprobado en Mercado Libre.</p>}
        {v.nota && <p className="text-xs text-aviso">{v.nota}</p>}
      </div>
    </Tarjeta>
  );
}

function Renglon({ t, v, explica }: { t: string; v: number; explica?: string }) {
  return (
    <div className="flex justify-between gap-2" data-explain={explica} data-explain-title={explica ? t : undefined}>
      <dt className="text-tenue">{t}</dt>
      <dd className={cn("cifra", v > 0 ? "text-peligro" : "text-tenue")}>{v > 0 ? `− ${dinero(v)}` : "—"}</dd>
    </div>
  );
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** La pestaña «Dinero»: lo de cada venta del mes y los totales, para conciliar Mercado Pago. */
export function DineroMercadoLibre() {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const datos = useQuery({
    queryKey: ["ml_dinero", "mes", mes],
    queryFn: () => {
      const [a, m] = mes.split("-").map(Number);
      const desde = `${mes}-01`, hasta = new Date(a, m, 1).toLocaleDateString("en-CA");
      return q<DineroML[]>(supabase.from("v_ml_dinero").select("*").gte("pagado_en", desde).lt("pagado_en", hasta).order("pagado_en", { ascending: false }));
    },
  });
  const filas = datos.data ?? [];
  const suma = (f: (d: DineroML) => number) => filas.reduce((t, d) => t + f(d), 0);
  const meses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, texto: `${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : ""}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const columnas: Columna<DineroML>[] = [
    { clave: "pagado_en", titulo: "Pagado", valor: (d) => d.pagado_en ?? "", celda: (d) => <span className="cifra">{fecha(d.pagado_en)}</span> },
    { clave: "folio", titulo: "Pedido", valor: (d) => d.folio ?? d.order_id,
      celda: (d) => d.pedido_id ? <Link to={`/ventas/pedidos/${d.pedido_id}`} className="text-marca-texto hover:underline cifra">{d.folio}</Link> : <span className="cifra">{d.order_id}</span> },
    { clave: "total", titulo: "Pagó el comprador", alinear: "der", sinBusqueda: true, celda: (d) => <span className="cifra">{dinero(d.total)}</span> },
    { clave: "comision", titulo: "Comisión", alinear: "der", sinBusqueda: true, celda: (d) => <span className="cifra">{dinero(d.comision)}</span> },
    { clave: "envio", titulo: "Envío", alinear: "der", sinBusqueda: true, celda: (d) => <span className="cifra">{dinero(d.envio)}</span> },
    { clave: "retencion_iva", titulo: "Ret. IVA", alinear: "der", sinBusqueda: true, explica: GLOSARIO.retencionesML, celda: (d) => <span className="cifra">{dinero(d.retencion_iva)}</span> },
    { clave: "retencion_isr", titulo: "Ret. ISR", alinear: "der", sinBusqueda: true, explica: GLOSARIO.retencionesML, celda: (d) => <span className="cifra">{dinero(d.retencion_isr)}</span> },
    { clave: "reembolsado", titulo: "Reembolsado", alinear: "der", sinBusqueda: true, celda: (d) => <span className="cifra">{d.reembolsado ? dinero(d.reembolsado) : "—"}</span> },
    { clave: "neto", titulo: "Llega a MP", alinear: "der", sinBusqueda: true, explica: GLOSARIO.netoML, celda: (d) => <span className="cifra font-medium">{d.neto != null ? dinero(d.neto) : "—"}</span> },
    { clave: "libera_en", titulo: "Disponible", valor: (d) => d.libera_en ?? "",
      celda: (d) => d.disponible ? <Insignia tono="ok">Ya</Insignia> : <span className="cifra text-tenue">{fecha(d.libera_en)}</span> },
  ];
  return (
    <div className="space-y-4">
      <Filtro opciones={meses} valor={mes} alCambiar={setMes} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Pagaron los compradores" icono={HandCoins} tono="marca" valor={dinero(suma((d) => d.total - d.reembolsado))} detalle={`${filas.length} ${filas.length === 1 ? "pago" : "pagos"}`} />
        <Kpi titulo="Se quedó Mercado Libre" icono={Receipt} tono="aviso" valor={dinero(suma((d) => d.comision + d.envio + d.otros))}
          detalle={`Comisiones ${dinero(suma((d) => d.comision))} · envíos ${dinero(suma((d) => d.envio))}`} />
        <Kpi titulo="Retenciones" icono={Landmark} tono="info" valor={dinero(suma((d) => d.retencion_iva + d.retencion_isr))} explica={GLOSARIO.retencionesML}
          detalle={`IVA ${dinero(suma((d) => d.retencion_iva))} · ISR ${dinero(suma((d) => d.retencion_isr))}`} />
        <Kpi titulo="Llega a Mercado Pago" icono={Wallet} tono="ok" valor={dinero(suma((d) => d.neto ?? 0))} explica={GLOSARIO.netoML}
          detalle={`Por liberar ${dinero(suma((d) => (d.disponible ? 0 : d.neto ?? 0)))}`} />
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(d) => d.pago_id}
        exportarComo={`mercadolibre-dinero-${mes}`} placeholder="Buscar pedido o venta…"
        vacio={{ icono: HandCoins, titulo: "Sin pagos de Mercado Libre este mes", texto: "Cuando una venta de ML se pague, aquí sale lo que pagó el comprador, lo que se quedó ML y lo que llega a Mercado Pago." }} />
      {filas.some((d) => !d.completo) && <p className="text-xs text-aviso">Hay pagos sin el desglose de Mercado Pago: su comisión es la de la venta y faltan las retenciones.</p>}
      <p className="text-xs text-tenue">Total descontado del mes: {dinero(suma(descuentos))}.</p>
    </div>
  );
}
