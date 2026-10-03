// La orden de compra y el contrato de compraventa bilingües que pide el agente
// aduanal. Hoy Hegamex "no maneja contratos ni órdenes de compra" y los fabrica
// después (PO Lily.docx, CONTRACT TAVOL); Careaga los observó por no traer domicilio
// completo, incoterm ni términos. Salen de los datos del ERP: proveedor (domicilio y
// TAX ID), empresa, incoterm y puertos del embarque, partidas con su fracción.
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero, fecha, numero } from "@/lib/formato";
import type { OrdenCompra } from "@/modulos/compras/componentes/comun";
import type { LineaOC, ProveedorCompleto } from "@/modulos/compras/componentes/tipos";
import type { Empresa } from "@/modulos/compras/componentes/ImpresionOC";

interface Ligado { embarques: { folio: string; incoterm: string | null; puerto_origen: string | null; puerto_destino: string; modalidad: string } | null; factura: string | null }

export default function ImprimirOC() {
  const { id } = useParams();
  const oc = useQuery({ queryKey: ["oc", id], queryFn: () => q<OrdenCompra>(supabase.from("v_ordenes_compra").select("*").eq("id", id!).single()) });
  const lineas = useQuery({ queryKey: ["oc_lineas", id], queryFn: () => q<LineaOC[]>(supabase.from("v_oc_lineas").select("*").eq("orden_compra_id", id!).order("nombre")) });
  const proveedor = useQuery({ queryKey: ["proveedor", oc.data?.proveedor_id], enabled: !!oc.data,
    queryFn: () => q<ProveedorCompleto & { tax_id: string | null }>(supabase.from("proveedores").select("*").eq("id", oc.data!.proveedor_id).single()) });
  const empresa = useQuery({ queryKey: ["configuracion", "empresa"], staleTime: 10 * 60_000,
    queryFn: async () => (await q<{ valor: Empresa }>(supabase.from("configuracion").select("valor").eq("clave", "empresa").single())).valor });
  const ligado = useQuery({ queryKey: ["embarque_oc", id], queryFn: () => q<Ligado[]>(supabase.from("embarque_oc")
    .select("factura, embarques(folio, incoterm, puerto_origen, puerto_destino, modalidad)").eq("orden_compra_id", id!).overrideTypes<Ligado[], { merge: false }>()) });
  const fracciones = useQuery({
    queryKey: ["fracciones", lineas.data?.map((l) => l.articulo_id).join()], enabled: !!lineas.data?.length,
    queryFn: () => q<{ id: string; fraccion_arancelaria: string | null; nico: string | null; descripcion_aduanal: string | null }[]>(supabase.from("articulos")
      .select("id, fraccion_arancelaria, nico, descripcion_aduanal").in("id", lineas.data!.map((l) => l.articulo_id).filter(Boolean) as string[])),
  });

  if (oc.error) return <div className="p-6"><ErrorCarga error={oc.error} /></div>;
  if (!oc.data || !lineas.data) return <div className="p-6"><Cargando /></div>;
  const o = oc.data, p = proveedor.data, emp = empresa.data, emb = ligado.data?.[0]?.embarques;
  const m = o.moneda === "USD" ? "USD" : "MXN";
  const comprador = emp?.razon_social || emp?.nombre || "Máquinas y Herramientas Gamex";
  const vendedor = p?.razon_social || o.proveedor;
  const incoterm = emb?.incoterm ? `${emb.incoterm} ${["EXW", "FCA", "FAS", "FOB"].includes(emb.incoterm) ? emb.puerto_origen ?? "" : emb.puerto_destino} (Incoterms® 2020)` : "Por definir / To be defined";
  const fr = (art: string | null) => { const f = fracciones.data?.find((x) => x.id === art); return f?.fraccion_arancelaria ? `${f.fraccion_arancelaria}${f.nico ? "-" + f.nico : ""}` : ""; };
  const faltan = [!p?.domicilio && "domicilio del proveedor", !(p?.tax_id || p?.rfc) && "TAX ID del proveedor", !emp?.direccion && "domicilio de la empresa", !emb?.incoterm && "incoterm del embarque"].filter(Boolean);

  return (
    <div className="min-h-full bg-fondo">
      <style>{`
        @page { size: letter; margin: 14mm 12mm; }
        @media print {
          html, body, #root { height: auto !important; overflow: visible !important; }
          body, .hoja { background: #fff !important; }
          .hoja, .hoja * { color: #111 !important; border-color: #bbb !important; box-shadow: none !important; }
          .hoja .tenue { color: #555 !important; }
          .salto { break-before: page; }
        }
      `}</style>
      <div className="no-imprimir max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center gap-2">
        <Boton asChild variante="fantasma"><Link to={`/compras/ordenes/${o.id}`}><ArrowLeft className="h-4 w-4" /> {o.folio}</Link></Boton>
        <p className="text-sm text-tenue flex-1 min-w-[200px]">Orden y contrato bilingües para el agente aduanal. {faltan.length > 0 && <span className="text-aviso">Falta: {faltan.join(", ")}.</span>}</p>
        <Boton onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir o guardar PDF</Boton>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-10 space-y-6 print:p-0 print:space-y-0">
        <section className="hoja tarjeta p-8 text-[11px] leading-snug print:border-0 print:p-0">
          <div className="flex items-start justify-between gap-6 pb-3 border-b-2 border-borde">
            <div>
              <Logo />
              <p className="mt-2 font-semibold">{comprador}</p>
              {emp?.rfc && <p className="tenue text-tenue">RFC {emp.rfc}</p>}
              {emp?.direccion && <p className="tenue text-tenue">{emp.direccion}</p>}
            </div>
            <div className="text-right">
              <p className="text-base font-bold tracking-wide">PURCHASE ORDER</p>
              <p className="text-sm font-semibold">ORDEN DE COMPRA {o.folio}</p>
              <p className="tenue text-tenue">Date / Fecha: {fecha(o.fecha)}</p>
              {ligado.data?.[0]?.factura && <p>Invoice / Factura: {ligado.data[0].factura}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 py-3 border-b border-borde">
            <div>
              <p className="tenue text-tenue uppercase text-[9px] tracking-wider">Seller / Vendedor</p>
              <p className="font-semibold">{vendedor}</p>
              {p?.domicilio && <p>{p.domicilio}</p>}
              <p>{p?.pais}</p>
              {(p?.tax_id || p?.rfc) && <p>TAX ID: {p?.tax_id || p?.rfc}</p>}
              <p>{[p?.contacto, p?.correo, p?.telefono].filter(Boolean).join(" · ")}</p>
            </div>
            <div>
              <p className="tenue text-tenue uppercase text-[9px] tracking-wider">Buyer / Comprador</p>
              <p className="font-semibold">{comprador}</p>
              {emp?.direccion && <p>{emp.direccion}</p>}
              <p>México</p>
              {emp?.rfc && <p>RFC / TAX ID: {emp.rfc}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-borde">
            <div><p className="tenue text-tenue text-[9px] uppercase">Incoterm</p><p>{incoterm}</p></div>
            <div><p className="tenue text-tenue text-[9px] uppercase">Port of loading / Carga</p><p>{emb?.puerto_origen ?? "—"}</p></div>
            <div><p className="tenue text-tenue text-[9px] uppercase">Port of discharge / Descarga</p><p>{emb?.puerto_destino ?? "Manzanillo, México"}</p></div>
            <div><p className="tenue text-tenue text-[9px] uppercase">Payment terms / Pago</p><p>{o.condiciones ?? "—"}</p></div>
          </div>
          <table className="w-full mt-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-borde text-left">
                <th className="py-1.5 pr-2 w-6">#</th><th className="py-1.5 pr-2">Description / Descripción</th><th className="py-1.5 pr-2 w-24">HS code / Fracción</th>
                <th className="py-1.5 pr-2 text-right w-16">Qty / Cant.</th><th className="py-1.5 pr-2 w-12">Unit</th>
                <th className="py-1.5 pr-2 text-right w-24">Unit price / P. unit.</th><th className="py-1.5 text-right w-24">Amount / Importe</th>
              </tr>
            </thead>
            <tbody>
              {lineas.data.map((l, i) => (
                <tr key={l.id} className="border-b border-borde align-top">
                  <td className="py-1.5 pr-2 tenue text-tenue">{i + 1}</td>
                  <td className="py-1.5 pr-2">{l.descripcion || l.nombre}{l.clave && <span className="tenue text-tenue"> · {l.clave}</span>}</td>
                  <td className="py-1.5 pr-2">{fr(l.articulo_id)}</td>
                  <td className="py-1.5 pr-2 text-right">{numero(l.cantidad)}</td>
                  <td className="py-1.5 pr-2">{l.unidad}</td>
                  <td className="py-1.5 pr-2 text-right">{dinero(l.costo_unitario, m)}</td>
                  <td className="py-1.5 text-right">{dinero(l.importe, m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-3">
            <table className="w-64"><tbody>
              <tr className="border-t-2 border-borde font-bold"><td className="py-1">Total {o.moneda}</td><td className="py-1 text-right">{dinero(o.total, m)}</td></tr>
            </tbody></table>
          </div>
          <div className="grid grid-cols-2 gap-16 mt-14 text-center">
            <div className="border-t border-borde pt-1">Buyer / Comprador<br /><span className="tenue text-tenue">{comprador}</span></div>
            <div className="border-t border-borde pt-1">Seller / Vendedor<br /><span className="tenue text-tenue">{vendedor}</span></div>
          </div>
        </section>

        <section className="hoja salto tarjeta p-8 text-[11px] leading-snug print:border-0 print:p-0">
          <p className="text-base font-bold text-center">SALES CONTRACT / CONTRATO DE COMPRAVENTA</p>
          <p className="text-center tenue text-tenue mb-4">No. {o.folio} · {fecha(o.fecha)}</p>
          <p className="mb-3">
            <b>{vendedor}</b>{p?.domicilio ? `, ${p.domicilio}` : ""}{(p?.tax_id || p?.rfc) ? `, TAX ID ${p?.tax_id || p?.rfc}` : ""} (“the Seller / el Vendedor”) and{" "}
            <b>{comprador}</b>{emp?.direccion ? `, ${emp.direccion}` : ""}{emp?.rfc ? `, RFC ${emp.rfc}` : ""} (“the Buyer / el Comprador”) agree / acuerdan:
          </p>
          <ol className="space-y-2.5 list-decimal pl-5">
            <Clausula en={`Object. The Seller sells and the Buyer buys the goods described in Purchase Order ${o.folio}, which is part of this contract.`}
              es={`Objeto. El Vendedor vende y el Comprador compra la mercancía descrita en la orden de compra ${o.folio}, que forma parte de este contrato.`} />
            <Clausula en={`Price. Total ${dinero(o.total, m)}, ${incoterm}. Prices are fixed and include packing suitable for ocean freight.`}
              es={`Precio. Total ${dinero(o.total, m)}, ${incoterm}. Los precios son fijos e incluyen empaque apto para transporte marítimo.`} />
            <Clausula en={`Payment. ${o.condiciones ?? "As agreed in the proforma invoice"}, by bank transfer from the Buyer's accounts. Each payment will be supported by its bank receipt.`}
              es={`Pago. ${o.condiciones ?? "Según la proforma"}, por transferencia desde las cuentas del Comprador. Cada pago se respalda con su comprobante bancario.`} />
            <Clausula en={`Delivery. Shipment${o.fecha_entrega ? ` no later than ${fecha(o.fecha_entrega)}` : " as agreed"} from ${emb?.puerto_origen ?? "the agreed port"} to ${emb?.puerto_destino ?? "Manzanillo, Mexico"}. The Seller will send Commercial Invoice, Packing List, Bill of Lading and Certificate of Origin${emb?.incoterm === "CIF" || emb?.incoterm === "CIP" ? ", and the insurance policy" : ""}, with the same names, addresses and tax IDs as this contract.`}
              es={`Entrega. Embarque${o.fecha_entrega ? ` a más tardar el ${fecha(o.fecha_entrega)}` : " según lo acordado"} de ${emb?.puerto_origen ?? "el puerto acordado"} a ${emb?.puerto_destino ?? "Manzanillo, México"}. El Vendedor enviará factura comercial, lista de empaque, conocimiento de embarque y certificado de origen${emb?.incoterm === "CIF" || emb?.incoterm === "CIP" ? ", y la póliza de seguro" : ""}, con los mismos nombres, domicilios e identificaciones fiscales de este contrato.`} />
            <Clausula en="Quality. Goods will be new and as specified, with brand, model and serial number where applicable, and photos before loading."
              es="Calidad. La mercancía será nueva y conforme a lo especificado, con marca, modelo y número de serie cuando aplique, y fotos antes de cargar." />
            <Clausula en="Claims. The Buyer may claim within 30 days after receiving the goods for damage, shortage or non-conformity."
              es="Reclamaciones. El Comprador podrá reclamar dentro de los 30 días siguientes a la recepción por daño, faltante o inconformidad." />
            <Clausula en="Law. This contract is governed by the United Nations Convention on Contracts for the International Sale of Goods (CISG)."
              es="Ley aplicable. Este contrato se rige por la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías." />
          </ol>
          <div className="grid grid-cols-2 gap-16 mt-16 text-center">
            <div className="border-t border-borde pt-1">The Buyer / El Comprador<br /><span className="tenue text-tenue">{comprador}</span></div>
            <div className="border-t border-borde pt-1">The Seller / El Vendedor<br /><span className="tenue text-tenue">{vendedor}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Clausula({ en, es }: { en: string; es: string }) {
  return <li><p>{en}</p><p className="tenue text-tenue italic">{es}</p></li>;
}
