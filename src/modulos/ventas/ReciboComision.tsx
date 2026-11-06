import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, porcentaje } from "@/lib/formato";
import { pesosConLetra } from "@/lib/letra";
import { Logo } from "@/components/layout/Logo";
import { Boton } from "@/components/ui/boton";
import { hoyMx, useEmpresa } from "./comun";

interface Fila {
  vendedor_id: string; vendedor: string; plan: string; venta_maquinaria: number; venta_refacciones: number; venta_otros: number;
  comision: number; bono_meta: number; bono_refacciones: number; ajustes: number; total: number; pagado_en: string | null;
}
interface Pedido { pedido_id: string; folio: string; fecha: string; cliente: string; parte: number; maquinaria: number; refacciones: number; otros: number }

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => { const [a, n] = m.split("-").map(Number); return `${MESES[n - 1]} de ${a}`; };
const fechaLarga = (f: string) => { const [a, m, d] = f.slice(0, 10).split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };

/**
 * Recibo de la comisión de un vendedor en un mes, en hoja carta, para firmarlo al entregarle el dinero.
 * Sale antes de pagar («Por pagar», con el cálculo de hoy) y ya pagada (con la foto del cálculo que
 * se guardó al marcarla pagada, su fecha y su referencia). No calcula nada: todo sale de
 * comisiones_mes, pedidos_comision y comision_pagos, y la RLS decide quién ve qué.
 * Fuera del Shell y siempre en claro: es papel.
 */
export default function ReciboComision() {
  const { vendedor, mes: mesTexto } = useParams<{ vendedor: string; mes: string }>();
  const mes = `${mesTexto}-01`;
  const filas = useQuery({ queryKey: ["comisiones_mes", mes], queryFn: () => q<Fila[]>(supabase.rpc("comisiones_mes", { p_mes: mes })) });
  const pago = useQuery({
    queryKey: ["comision_pago", vendedor, mes],
    queryFn: () => q<{ total: number; detalle: Fila; pagado_en: string | null; referencia: string | null } | null>(
      supabase.from("comision_pagos").select("total, detalle, pagado_en, referencia").eq("vendedor_id", vendedor!).eq("mes", mes).maybeSingle()),
  });
  const pedidos = useQuery({ queryKey: ["pedidos_comision", vendedor, mes], queryFn: () => q<Pedido[]>(supabase.rpc("pedidos_comision", { p_vendedor: vendedor, p_mes: mes })) });
  const ajustes = useQuery({
    queryKey: ["comision_ajustes", mes, vendedor],
    queryFn: () => q<{ concepto: string; monto: number }[]>(supabase.from("comision_ajustes").select("concepto, monto").eq("mes", mes).eq("vendedor_id", vendedor!).order("creado_en")),
  });
  const planes = useQuery({ queryKey: ["planes_comision"], queryFn: () => q<{ nombre: string; pct_maquinaria: number; otros_como_maquinaria: boolean }[]>(supabase.from("planes_comision").select("nombre, pct_maquinaria, otros_como_maquinaria")) });
  const empresa = useEmpresa();

  useEffect(() => {
    const html = document.documentElement;
    const oscuro = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (oscuro) html.classList.add("dark"); };
  }, []);

  const hoy = filas.data?.find((f) => f.vendedor_id === vendedor);
  const pagada = !!pago.data?.pagado_en;
  // Ya pagada, el recibo dice lo que se pagó (la foto de ese día), no lo que daría el cálculo hoy.
  const f: Fila | undefined = pagada ? { ...(hoy ?? pago.data!.detalle), ...pago.data!.detalle } : hoy;
  const total = pagada ? Number(pago.data!.total) : Number(f?.total ?? 0);
  const difiere = pagada && hoy && Math.abs(Number(hoy.total) - total) > 0.5;

  useEffect(() => {
    if (!f) return;
    const antes = document.title;
    document.title = `Comisión ${nombreMes(mesTexto!)} ${f.vendedor} - Hegamex`;
    return () => { document.title = antes; };
  }, [f, mesTexto]);

  if (filas.isLoading || pago.isLoading) return <p className="p-10 text-center text-tenue">Preparando el recibo…</p>;
  if (!f) return <p className="p-10 text-center text-tenue">No encontramos esta comisión (o tu rol no la puede ver).</p>;

  const plan = planes.data?.find((p) => p.nombre === f.plan);
  const pct = Number(plan?.pct_maquinaria ?? 0.02);
  const baseMaq = Number(f.venta_maquinaria) + (plan?.otros_como_maquinaria ? Number(f.venta_otros) : 0);
  const razon = empresa.data?.fiscal?.razon_social || "Hegamex";
  const folio = `COM-${mesTexto}`;
  const lista = pedidos.data ?? [];
  const suma = (k: "maquinaria" | "refacciones" | "otros") => lista.reduce((s, p) => s + Number(p[k]), 0);

  return (
    <div className="min-h-full bg-borde/70 print:bg-superficie">
      <style>{`
        @page { size: letter; margin: 12mm; }
        @media print {
          html, body, #root { height: auto !important; background: white !important; }
          .hoja { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
          tr { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-imprimir sticky top-0 z-10 bg-superficie/90 backdrop-blur border-b border-borde">
        <div className="mx-auto max-w-[8.5in] px-4 py-2.5 flex items-center gap-3">
          <Link to={`/ventas/comisiones?mes=${mesTexto}`} className="inline-flex items-center gap-1.5 text-sm text-tenue hover:text-texto">
            <ArrowLeft className="h-4 w-4" /> Volver a Comisiones
          </Link>
          <span className="text-sm text-tenue hidden sm:inline">Imprímelo y que lo firme al recibir el pago; o elige “Guardar como PDF”.</span>
          <Boton className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>

      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-superficie text-texto shadow-xl px-[0.6in] py-[0.5in] min-h-[11in] text-[12.5px] leading-relaxed">
        <header className="flex items-start justify-between gap-6 pb-3 border-b-2 border-marca">
          <div><Logo /><p className="mt-2 text-lg font-bold tracking-wide">RECIBO DE COMISIÓN</p></div>
          <div className="text-right">
            <p className="text-xs text-tenue">Folio</p><p className="font-bold cifra">{folio}</p>
            <p className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold ${pagada ? "bg-ok-suave text-ok" : "bg-aviso-suave text-aviso"}`}>
              {pagada ? `PAGADA ${fecha(pago.data!.pagado_en)}` : "POR PAGAR"}
            </p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
          <p><span className="text-tenue">Vendedor: </span><b>{f.vendedor}</b></p>
          <p><span className="text-tenue">Mes: </span><b>{nombreMes(mesTexto!).replace(/^./, (c) => c.toUpperCase())}</b></p>
          <p><span className="text-tenue">Plan: </span>{f.plan}</p>
          <p><span className="text-tenue">{pagada ? "Referencia del pago: " : "Calculado el: "}</span>{pagada ? (pago.data!.referencia || "—") : fechaLarga(hoyMx())}</p>
        </section>

        <table className="mt-4 w-full border-collapse">
          <tbody className="[&_td]:py-1 [&_td]:border-b [&_td]:border-borde">
            <tr><td>Venta de maquinaria{plan?.otros_como_maquinaria ? " y otros" : ""} (sin IVA)</td><td className="text-right cifra">{dinero(baseMaq)}</td></tr>
            <tr><td className="pl-4">Comisión {porcentaje(pct, 0)}</td><td className="text-right cifra">{dinero(f.comision)}</td></tr>
            <tr><td className="pl-4">Bono por escalón de meta</td><td className="text-right cifra">{dinero(f.bono_meta)}</td></tr>
            <tr><td>Venta de refacciones (sin IVA)</td><td className="text-right cifra">{dinero(f.venta_refacciones)}</td></tr>
            <tr><td className="pl-4">Bono por escalón de refacciones</td><td className="text-right cifra">{dinero(f.bono_refacciones)}</td></tr>
            <tr><td>Ajustes y bonos extra</td><td className="text-right cifra">{dinero(f.ajustes)}</td></tr>
            {(ajustes.data ?? []).map((a, i) => (
              <tr key={i} className="text-tenue"><td className="pl-4 text-[11.5px]">{a.concepto}</td><td className="text-right cifra text-[11.5px]">{dinero(a.monto)}</td></tr>
            ))}
            <tr className="font-bold text-[14px]"><td className="!border-b-2 !border-texto">{pagada ? "Total pagado" : "Total a pagar"}</td><td className="text-right cifra !border-b-2 !border-texto">{dinero(total)}</td></tr>
          </tbody>
        </table>
        <p className="mt-1 text-[11.5px]">({pesosConLetra(total)})</p>
        {difiere && (
          <p className="mt-2 text-[11px] text-aviso">Con los pedidos de hoy el cálculo da {dinero(hoy!.total)}; aquí va lo que se pagó. La diferencia se ajusta en el mes siguiente.</p>
        )}

        <h3 className="mt-5 mb-1 font-bold">Pedidos que cuentan este mes</h3>
        {pedidos.isLoading ? <p className="text-tenue">Cargando…</p> : lista.length === 0 ? <p className="text-tenue">Ningún pedido en este mes.</p> : (
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="text-left text-tenue [&_th]:border-b [&_th]:border-texto [&_th]:py-1 [&_th]:font-medium">
                <th>Pedido</th><th>Fecha</th><th>Cliente</th><th className="text-right">Parte</th>
                <th className="text-right">Maquinaria</th><th className="text-right">Refacciones</th><th className="text-right">Otros</th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-0.5 [&_td]:border-b [&_td]:border-borde">
              {lista.map((p) => (
                <tr key={p.pedido_id}>
                  <td className="whitespace-nowrap">{p.folio}</td><td className="whitespace-nowrap">{fecha(p.fecha)}</td>
                  <td className="max-w-[2.3in] truncate">{p.cliente}</td>
                  <td className="text-right cifra">{porcentaje(Number(p.parte), 0)}</td>
                  <td className="text-right cifra">{Number(p.maquinaria) ? dinero(p.maquinaria) : "—"}</td>
                  <td className="text-right cifra">{Number(p.refacciones) ? dinero(p.refacciones) : "—"}</td>
                  <td className="text-right cifra">{Number(p.otros) ? dinero(p.otros) : "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={4}>{lista.length} pedido(s), ya con tu parte del crédito compartido</td>
                <td className="text-right cifra">{dinero(suma("maquinaria"))}</td><td className="text-right cifra">{dinero(suma("refacciones"))}</td><td className="text-right cifra">{dinero(suma("otros"))}</td>
              </tr>
            </tbody>
          </table>
        )}

        <p className="mt-6">
          Recibí de <b>{razon}</b> la cantidad de <b>{dinero(total)} ({pesosConLetra(total)})</b> por concepto de comisiones por ventas
          del mes de {nombreMes(mesTexto!)}, conforme al detalle de este recibo.
        </p>
        <div className="mt-14 grid grid-cols-2 gap-12" style={{ breakInside: "avoid" }}>
          <div className="text-center"><div className="h-12 border-b border-texto" /><p className="mt-1 font-medium">{f.vendedor}</p><p className="text-xs text-tenue">Recibí de conformidad</p></div>
          <div className="text-center"><div className="h-12 border-b border-texto" /><p className="mt-1 font-medium">&nbsp;</p><p className="text-xs text-tenue">Entregó (nombre y firma)</p></div>
        </div>
        <p className="mt-6 text-center text-[10.5px] text-tenue">Atotonilco el Alto, Jalisco, a ______ de ____________________ de ______</p>
      </div>
    </div>
  );
}
