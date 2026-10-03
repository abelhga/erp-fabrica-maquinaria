import { Logo } from "@/components/layout/Logo";
import { dinero, fecha, numero } from "@/lib/formato";
import type { OrdenCompra } from "./comun";
import type { LineaOC, ProveedorCompleto } from "./tipos";

export interface Empresa { nombre?: string; razon_social?: string; rfc?: string; telefono?: string; sitio?: string; direccion?: string }

/**
 * La orden como la recibe el proveedor. Solo existe al imprimir (o guardar como
 * PDF): en pantalla está oculta y la pantalla de trabajo se oculta al imprimir.
 * Tinta negra sobre blanco aunque la app esté en modo oscuro.
 */
export function ImpresionOC({ oc, lineas, proveedor, empresa }: {
  oc: OrdenCompra; lineas: LineaOC[]; proveedor: ProveedorCompleto | undefined; empresa: Empresa | undefined;
}) {
  const m = oc.moneda === "USD" ? "USD" : "MXN";
  return (
    <div className="hidden print:block impresion-oc text-[11px] leading-snug">
      {/* Al imprimir, el contenedor con scroll de la app no debe cortar la hoja. */}
      <style>{`
        @page { size: letter; margin: 14mm 12mm; }
        @media print {
          html, body, #root, main, #root > div, #root > div > div { height: auto !important; overflow: visible !important; display: block !important; }
          body { background: #fff !important; }
          .impresion-oc, .impresion-oc * { color: #111 !important; border-color: #bbb !important; }
          .impresion-oc .tenue { color: #555 !important; }
        }
      `}</style>
      <div className="flex items-start justify-between gap-6 pb-3 border-b-2">
        <div>
          <Logo />
          <p className="mt-2 font-medium">{empresa?.razon_social || empresa?.nombre || "Hegamex"}</p>
          <p className="tenue">{[empresa?.rfc && `RFC ${empresa.rfc}`, empresa?.telefono, empresa?.sitio].filter(Boolean).join(" · ")}</p>
          {empresa?.direccion && <p className="tenue">{empresa.direccion}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tracking-wide">ORDEN DE COMPRA</p>
          <p className="text-base font-semibold">{oc.folio}</p>
          <p className="tenue">Fecha: {fecha(oc.fecha)}</p>
          {oc.fecha_entrega && <p>Entrega requerida: <b>{fecha(oc.fecha_entrega)}</b></p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 py-3 border-b">
        <div>
          <p className="tenue uppercase text-[9px] tracking-wider">Proveedor</p>
          <p className="font-semibold">{proveedor?.razon_social || oc.proveedor}</p>
          {proveedor?.rfc && <p>RFC {proveedor.rfc}</p>}
          {proveedor?.domicilio && <p>{proveedor.domicilio}</p>}
          <p>{[proveedor?.contacto, proveedor?.telefono, proveedor?.correo].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="tenue uppercase text-[9px] tracking-wider">Condiciones</p>
          <p>{oc.condiciones || "—"}</p>
          <p>Moneda: {oc.moneda}{oc.moneda !== "MXN" && ` · tipo de cambio de referencia ${numero(oc.tipo_cambio)}`}</p>
          <p>Facturar a: {empresa?.razon_social || empresa?.nombre || "Hegamex"}{empresa?.rfc ? ` (${empresa.rfc})` : ""}</p>
        </div>
      </div>

      <table className="w-full mt-3 border-collapse">
        <thead>
          <tr className="border-b-2 text-left">
            <th className="py-1.5 pr-2 w-8">#</th><th className="py-1.5 pr-2 text-right w-16">Cant.</th><th className="py-1.5 pr-2 w-14">Unidad</th>
            <th className="py-1.5 pr-2 w-24">Clave</th><th className="py-1.5 pr-2">Descripción</th>
            <th className="py-1.5 pr-2 text-right w-24">Precio unitario</th><th className="py-1.5 text-right w-24">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={l.id} className="border-b align-top">
              <td className="py-1.5 pr-2 tenue">{i + 1}</td>
              <td className="py-1.5 pr-2 text-right">{numero(l.cantidad)}</td>
              <td className="py-1.5 pr-2">{l.unidad}</td>
              <td className="py-1.5 pr-2">{l.clave ?? ""}</td>
              <td className="py-1.5 pr-2">{l.descripcion || l.nombre}{l.para && <span className="tenue"> · {l.para}</span>}</td>
              <td className="py-1.5 pr-2 text-right">{dinero(l.costo_unitario, m)}</td>
              <td className="py-1.5 text-right">{dinero(l.importe, m)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mt-3">
        <table className="w-64">
          <tbody>
            <tr><td className="py-0.5">Subtotal</td><td className="py-0.5 text-right">{dinero(oc.subtotal, m)}</td></tr>
            <tr><td className="py-0.5">IVA {Math.round(Number(oc.tasa_iva) * 100)} %</td><td className="py-0.5 text-right">{dinero(oc.iva, m)}</td></tr>
            <tr className="border-t-2 font-bold"><td className="py-1">Total {oc.moneda}</td><td className="py-1 text-right">{dinero(oc.total, m)}</td></tr>
          </tbody>
        </table>
      </div>

      {oc.notas && <div className="mt-4"><p className="tenue uppercase text-[9px] tracking-wider">Notas</p><p className="whitespace-pre-line">{oc.notas}</p></div>}
      <div className="mt-4 tenue">
        <p>Favor de citar el folio {oc.folio} en la factura y en la remisión. Mercancía sujeta a revisión al recibirse en almacén.</p>
      </div>
      <div className="grid grid-cols-2 gap-16 mt-14 text-center">
        <div className="border-t pt-1">Elaboró{oc.creado_por_nombre ? ` · ${oc.creado_por_nombre}` : ""}</div>
        <div className="border-t pt-1">Autorizó</div>
      </div>
    </div>
  );
}
