import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { dinero } from "@/lib/formato";
import { pesosConLetra } from "@/lib/letra";
import { Logo } from "@/components/layout/Logo";
import { Boton } from "@/components/ui/boton";
import { useEmpresa } from "@/modulos/ventas/comun";

type Tipo = "pagare" | "abono" | "retiro";
interface Documento {
  folio: string; fecha: string; importe?: number; monto?: number; nota?: string | null; saldo_despues?: number;
  descuento_semanal?: number; semanas?: number; primer_pago?: string; motivo?: string; interes_moratorio_pct?: number;
  solicitado_el?: string; prestamo?: string; recibio?: string | null; entrego?: string | null;
  empleado: { nombre: string; numero: string | null; puesto: string | null; domicilio: string | null };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "20 de octubre de 2026": así se fecha un documento que se firma. */
const fechaLarga = (f: string) => { const [a, m, d] = f.slice(0, 10).split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };

/**
 * El pagaré de un préstamo y los recibos de abono y de retiro de ahorro, en hoja carta para
 * imprimir y firmar. Los recibos salen dos veces en la hoja (original y copia) para cortar.
 * Fuera del Shell y siempre en claro: es papel.
 */
export default function DocumentoNomina() {
  const { tipo, id } = useParams<{ tipo: Tipo; id: string }>();
  const doc = useQuery({ queryKey: ["documento_nomina", tipo, id], queryFn: () => q<Documento | null>(supabase.rpc("documento_nomina", { p_tipo: tipo, p_id: id })) });
  const empresa = useEmpresa();
  useEffect(() => {
    const html = document.documentElement;
    const oscuro = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (oscuro) html.classList.add("dark"); };
  }, []);
  useEffect(() => {
    if (!doc.data) return;
    const antes = document.title;
    document.title = `${doc.data.folio} ${doc.data.empleado.nombre} - Hegamex`;
    return () => { document.title = antes; };
  }, [doc.data]);

  if (doc.isLoading) return <p className="p-10 text-center text-tenue">Preparando el documento…</p>;
  if (doc.error || !doc.data) return <p className="p-10 text-center text-tenue">No encontramos este documento (o tu rol no lo puede ver).</p>;
  const d = doc.data;
  const razon = empresa.data?.fiscal?.razon_social || "Hegamex";
  const domicilio = empresa.data?.fiscal?.domicilio || "";
  const ciudad = "Atotonilco el Alto, Jalisco";

  return (
    <div className="min-h-full bg-borde/70 print:bg-superficie">
      <style>{`
        @page { size: letter; margin: 12mm; }
        @media print {
          html, body, #root { height: auto !important; background: white !important; }
          .hoja { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-imprimir sticky top-0 z-10 bg-superficie/90 backdrop-blur border-b border-borde">
        <div className="mx-auto max-w-[8.5in] px-4 py-2.5 flex items-center gap-3">
          <Link to={`/rrhh/prenomina?vista=${tipo === "retiro" ? "ahorro" : "prestamos"}`} className="inline-flex items-center gap-1.5 text-sm text-tenue hover:text-texto">
            <ArrowLeft className="h-4 w-4" /> Volver a Prenómina
          </Link>
          <span className="text-sm text-tenue hidden sm:inline">Imprímelo y que lo firme; o elige “Guardar como PDF”.</span>
          <Boton className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>

      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-superficie text-texto shadow-xl px-[0.6in] py-[0.5in] min-h-[11in] text-[13px] leading-relaxed">
        {tipo === "pagare" ? <Pagare d={d} razon={razon} domicilio={domicilio} ciudad={ciudad} /> : (
          <>
            <Recibo tipo={tipo!} d={d} razon={razon} ciudad={ciudad} copia="Original" />
            <div className="my-8 border-t border-dashed border-borde text-center text-[10px] text-tenue"><span className="relative -top-2 bg-superficie px-2">cortar aquí</span></div>
            <Recibo tipo={tipo!} d={d} razon={razon} ciudad={ciudad} copia="Copia" />
          </>
        )}
      </div>
    </div>
  );
}

function Encabezado({ titulo, folio, derecha }: { titulo: string; folio: string; derecha?: string }) {
  return (
    <header className="flex items-start justify-between gap-6 pb-3 border-b-2 border-marca">
      <div><Logo /><p className="mt-2 text-lg font-bold tracking-wide">{titulo}</p></div>
      <div className="text-right">
        <p className="text-xs text-tenue">Folio</p><p className="font-bold cifra">{folio}</p>
        {derecha && <p className="mt-1 font-bold cifra text-base">{derecha}</p>}
      </div>
    </header>
  );
}

function Firma({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="text-center">
      <div className="h-14 border-b border-texto" />
      <p className="mt-1 font-medium">{nombre}</p>
      <p className="text-xs text-tenue">{rol}</p>
    </div>
  );
}

function Pagare({ d, razon, domicilio, ciudad }: { d: Documento; razon: string; domicilio: string; ciudad: string }) {
  const monto = Number(d.monto);
  const interes = Number(d.interes_moratorio_pct ?? 0);
  return (
    <div className="space-y-5">
      <Encabezado titulo="PAGARÉ" folio={d.folio} derecha={`Bueno por ${dinero(monto)}`} />
      <p className="text-right">En {ciudad}, a {fechaLarga(d.fecha)}.</p>
      <p className="text-justify">
        Debo y pagaré incondicionalmente a la orden de <b>{razon}</b>{domicilio ? <>, en su domicilio ubicado en {domicilio},</> : ""} la cantidad
        de <b>{dinero(monto)} ({pesosConLetra(monto)})</b>, valor recibido a mi entera satisfacción en calidad de préstamo personal.
      </p>
      <p className="text-justify">
        Esta cantidad la pagaré en <b>{d.semanas} abonos semanales de {dinero(d.descuento_semanal ?? 0)}</b> (el último por el resto), que autorizo
        expresamente se descuenten de mi nómina a partir del pago del {fechaLarga(d.primer_pago!)}. Puedo hacer abonos anticipados en cualquier momento.
      </p>
      <p className="text-justify">
        Si mi relación de trabajo termina antes de liquidar este préstamo, autorizo que el saldo pendiente se descuente de mi finiquito o liquidación.
      </p>
      <p className="text-justify">
        Este pagaré no causa intereses ordinarios.
        {interes > 0 && <> En caso de mora, el saldo vencido causará un interés moratorio de {interes.toLocaleString("es-MX")} % mensual hasta su pago total.</>}
      </p>
      <div className="grid grid-cols-2 gap-x-10 gap-y-1 pt-2 text-[12.5px]">
        <p><span className="text-tenue">Nombre del suscriptor:</span> <b>{d.empleado.nombre}</b></p>
        <p><span className="text-tenue">Número de empleado:</span> {d.empleado.numero ?? "—"}</p>
        <p className="col-span-2"><span className="text-tenue">Domicilio:</span> {d.empleado.domicilio ?? "_______________________________________________"}</p>
      </div>
      <div className="grid grid-cols-2 gap-16 pt-10">
        <Firma nombre={d.empleado.nombre} rol="Firma del suscriptor (acepto)" />
        <Firma nombre="" rol="Firma de quien autoriza" />
      </div>
    </div>
  );
}

function Recibo({ tipo, d, razon, ciudad, copia }: { tipo: Tipo; d: Documento; razon: string; ciudad: string; copia: string }) {
  const importe = Number(d.importe);
  return (
    <div className="space-y-4">
      <Encabezado titulo={tipo === "retiro" ? "RECIBO DE RETIRO DE AHORRO" : "RECIBO DE ABONO A PRÉSTAMO"} folio={d.folio} derecha={dinero(importe)} />
      <div className="flex justify-between text-xs text-tenue"><span>{copia}</span><span>En {ciudad}, a {fechaLarga(d.fecha)}.</span></div>
      {tipo === "retiro" ? (
        <p className="text-justify">
          Recibí de <b>{razon}</b> la cantidad de <b>{dinero(importe)} ({pesosConLetra(importe)})</b> por concepto de retiro de mi caja de ahorro,
          que solicité el {fechaLarga(d.solicitado_el!)}.{d.nota ? <> Nota: {d.nota}.</> : ""} Después de este retiro mi saldo de ahorro es
          de <b>{dinero(d.saldo_despues ?? 0)}</b>.
        </p>
      ) : (
        <p className="text-justify">
          <b>{razon}</b> recibió de <b>{d.empleado.nombre}</b> la cantidad de <b>{dinero(importe)} ({pesosConLetra(importe)})</b> como abono a su
          préstamo {d.prestamo} de {dinero(d.monto ?? 0)}.{d.nota ? <> Nota: {d.nota}.</> : ""} Después de este abono el saldo del préstamo es
          de <b>{dinero(d.saldo_despues ?? 0)}</b>.
        </p>
      )}
      <div className="grid grid-cols-2 gap-16 pt-6">
        {tipo === "retiro" ? <>
          <Firma nombre={d.empleado.nombre} rol={`Recibí · núm. ${d.empleado.numero ?? "—"}`} />
          <Firma nombre={d.entrego ?? ""} rol="Entregó (Recursos Humanos)" />
        </> : <>
          <Firma nombre={d.empleado.nombre} rol={`Entregó · núm. ${d.empleado.numero ?? "—"}`} />
          <Firma nombre={d.recibio ?? ""} rol="Recibió (Recursos Humanos)" />
        </>}
      </div>
    </div>
  );
}
