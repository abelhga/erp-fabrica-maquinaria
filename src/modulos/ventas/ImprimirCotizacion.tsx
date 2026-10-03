import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero, porcentaje } from "@/lib/formato";
import { Logo } from "@/components/layout/Logo";
import { Boton } from "@/components/ui/boton";
import { dineroEn, mensualidad, useEmpresa, usePlanesMeses, venceEl, type Cotizacion, type Partida } from "./comun";

const NOMBRE_MONEDA = { MXN: "Pesos mexicanos (MXN)", USD: "Dólares estadounidenses (USD)", EUR: "Euros (EUR)" } as const;

/**
 * La cotización en hoja carta, lista para "Guardar como PDF": el mismo formato
 * que la plantilla "Aut" de la hoja (logo, datos fiscales, agente con celular,
 * "En atención a", folio con iniciales, partidas en dos renglones con foto,
 * columna "con descuento", leyenda roja de la promoción, condiciones y banner
 * de meses), más lo que nunca tuvo: fecha de emisión y de vencimiento, tipo de
 * cambio a la vista y la co-marca "Powered by HEGAMEX".
 * Va fuera del Shell: sin menú, y siempre en tema claro (es papel).
 */
export default function ImprimirCotizacion() {
  const { id } = useParams();
  const cot = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => q<Cotizacion | null>(supabase.from("cotizaciones").select("*").eq("id", id!).maybeSingle()),
  });
  const lineas = useQuery({
    queryKey: ["cotizacion_lineas", id],
    queryFn: () => q<Partida[]>(supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id!).order("orden")),
  });
  const c = cot.data;
  const vendedor = useQuery({
    queryKey: ["perfil", c?.vendedor_id], enabled: !!c?.vendedor_id,
    queryFn: () => q<{ nombre: string; telefono: string | null; iniciales: string | null; correo: string }>(
      supabase.from("perfiles").select("nombre, telefono, iniciales, correo").eq("id", c!.vendedor_id).single()),
  });
  const cliente = useQuery({
    queryKey: ["cliente_impresion", c?.cliente_id], enabled: !!c?.cliente_id,
    queryFn: () => q<{ nombre: string; razon_social: string | null; rfc: string | null; ciudad: string | null; estado: string | null }>(
      supabase.from("clientes").select("nombre, razon_social, rfc, ciudad, estado").eq("id", c!.cliente_id!).single()),
  });
  const contacto = useQuery({
    queryKey: ["contacto", c?.contacto_id], enabled: !!c?.contacto_id,
    queryFn: () => q<{ telefono: string | null; whatsapp: string | null; correo: string | null } | null>(
      supabase.from("contactos").select("telefono, whatsapp, correo").eq("id", c!.contacto_id!).maybeSingle()),
  });
  const empresa = useEmpresa();
  const planes = usePlanesMeses();

  // Es papel: siempre claro, aunque el usuario use el tema oscuro.
  useEffect(() => {
    const html = document.documentElement;
    const oscuro = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (oscuro) html.classList.add("dark"); };
  }, []);
  // El nombre del PDF sale del título de la página.
  useEffect(() => {
    if (!c) return;
    const antes = document.title;
    document.title = `${c.folio}${cliente.data ? " " + cliente.data.nombre : ""} - Hegamex`;
    return () => { document.title = antes; };
  }, [c, cliente.data]);

  if (cot.isLoading || lineas.isLoading) return <p className="p-10 text-center text-tenue">Preparando la cotización…</p>;
  if (!c) return <p className="p-10 text-center text-tenue">No encontramos esta cotización (o es de otro vendedor).</p>;

  const partidas = lineas.data ?? [];
  const m = c.moneda;
  const fis = empresa.data?.fiscal;
  const plan = planes.data?.find((p) => p.meses === c.plan_meses) ?? null;
  const descGeneral = Number(c.descuento_pct);
  const hayDescuento = descGeneral > 0 || partidas.some((p) => Number(p.descuento_pct) > 0);
  const vence = venceEl(c.fecha, c.vigencia_dias);
  const bruto = (p: Partida) => Number(p.cantidad) * Number(p.precio_unitario);
  const conDescuento = (p: Partida) => bruto(p) * (1 - Number(p.descuento_pct)) * (1 - descGeneral);
  const subtotalBruto = partidas.filter((p) => !p.opcional).reduce((s, p) => s + bruto(p), 0);
  const ahorro = (subtotalBruto - (Number(c.total) - (c.precios_con_iva ? 0 : Number(c.iva)))) * (c.precios_con_iva ? 1 : 1 + Number(c.tasa_iva));
  const iniciales = vendedor.data?.iniciales ?? "";
  const tituloPrecio = c.precios_con_iva ? "Precio unitario neto" : "Precio unitario";

  return (
    <div className="min-h-full bg-[#e9ebef] print:bg-white">
      <style>{`
        @page { size: letter; margin: 11mm 12mm 12mm; }
        @media print {
          html, body, #root { height: auto !important; background: white !important; }
          .hoja { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; min-height: 0 !important; }
          .partida, .bloque { break-inside: avoid; page-break-inside: avoid; }
          thead { display: table-header-group; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-imprimir sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/10">
        <div className="mx-auto max-w-[8.5in] px-4 py-2.5 flex items-center gap-3">
          <Link to={`/ventas/cotizaciones/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Volver al editor
          </Link>
          <span className="text-sm text-slate-500 hidden sm:inline">En la ventana de impresión elige “Guardar como PDF”, tamaño carta.</span>
          <Boton className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>

      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-white text-[#1b2230] shadow-xl px-[0.55in] py-[0.5in] min-h-[11in] text-[12.5px] leading-snug">
        {/* Encabezado */}
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-[#0a74ff]">
          <div className="min-w-0">
            {c.logo_comarca_url ? (
              <div className="flex items-end gap-4">
                <img src={c.logo_comarca_url} alt="" className="max-h-16 max-w-[230px] object-contain" />
                <div className="text-[10px] text-slate-500 pb-1 flex items-center gap-1.5">Powered by <Logo className="scale-[0.72] origin-left" /></div>
              </div>
            ) : <Logo grande />}
            {fis && (
              <div className="mt-3 text-[11px] text-slate-600 space-y-0.5">
                <p className="font-semibold text-slate-800">{fis.razon_social} · RFC: {fis.rfc}</p>
                <p>{fis.domicilio}</p>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[22px] font-bold tracking-[0.12em] text-[#0a74ff]">COTIZACIÓN</p>
            <p className="mt-1 text-[14px] font-semibold tabular-nums">
              {c.folio}
              {iniciales && <span className="ml-2 inline-block rounded bg-[#1b2230] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white align-middle">{iniciales}</span>}
            </p>
            <table className="ml-auto mt-2 text-[11px]">
              <tbody>
                <tr><td className="pr-3 text-slate-500">Fecha de emisión</td><td className="font-medium tabular-nums">{fecha(c.fecha)}</td></tr>
                <tr><td className="pr-3 text-slate-500">Vigente hasta</td><td className="font-medium tabular-nums">{fecha(vence)}</td></tr>
                {c.version > 1 && <tr><td className="pr-3 text-slate-500">Versión</td><td className="font-medium">{c.version}</td></tr>}
              </tbody>
            </table>
          </div>
        </header>

        {/* Agente y cliente */}
        <section className="grid grid-cols-2 gap-4 py-4">
          <div className="rounded-md bg-[#f3f6fb] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">En atención a</p>
            <p className="mt-0.5 text-[14px] font-semibold">{c.atencion || cliente.data?.nombre || "—"}</p>
            {(c.empresa || cliente.data?.razon_social) && <p className="text-slate-700">{c.empresa || cliente.data?.razon_social}</p>}
            <p className="text-[11px] text-slate-500">
              {[cliente.data?.rfc && `RFC ${cliente.data.rfc}`, [cliente.data?.ciudad, cliente.data?.estado].filter(Boolean).join(", "),
                contacto.data?.whatsapp || contacto.data?.telefono, contacto.data?.correo].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="rounded-md bg-[#f3f6fb] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Agente de ventas</p>
            <p className="mt-0.5 text-[14px] font-semibold">{vendedor.data?.nombre}</p>
            <p className="text-slate-700">{vendedor.data?.telefono ? `Cel. ${vendedor.data.telefono}` : ""}</p>
            <p className="text-[11px] text-slate-500">{vendedor.data?.correo}</p>
          </div>
        </section>

        <p className="mb-2 text-[11px] text-slate-600">
          Moneda: <b className="text-slate-800">{NOMBRE_MONEDA[m]}</b>
          {m !== "MXN" && <> · Tipo de cambio: <b className="text-slate-800 tabular-nums">${numero(Number(c.tipo_cambio))} MXN por {m}</b></>}
          {c.precios_con_iva && <> · <b className="text-slate-800">Precios con IVA incluido</b></>}
        </p>

        {/* Partidas: dos renglones por partida (artículo; descripción con foto), como la hoja */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1b2230] text-white text-[10.5px] uppercase tracking-wider">
              <th className="py-2 pl-2 pr-1 text-left font-semibold w-7">#</th>
              <th className="py-2 px-1 text-right font-semibold w-16">Cant.</th>
              <th className="py-2 px-2 text-left font-semibold">Artículo y descripción</th>
              <th className="py-2 px-2 text-right font-semibold w-[1.15in]">{tituloPrecio}</th>
              <th className="py-2 px-2 text-right font-semibold w-[1.15in]">Importe</th>
              {hayDescuento && <th className="py-2 pl-2 pr-2 text-right font-semibold w-[1.15in] bg-[#c81e1e]">Con descuento</th>}
            </tr>
          </thead>
          {partidas.map((p, i) => (
            <tbody key={p.id} className="partida border-b border-slate-200">
              <tr className="align-top">
                <td className="pt-2.5 pl-2 pr-1 text-slate-500 tabular-nums">{i + 1}</td>
                <td className="pt-2.5 px-1 text-right tabular-nums whitespace-nowrap">{numero(Number(p.cantidad))} <span className="text-[10px] text-slate-500">{p.unidad}</span></td>
                <td className="pt-2.5 px-2 font-semibold text-[13px]">
                  {p.titulo}
                  {p.opcional && <span className="ml-2 rounded border border-[#6d4bd6]/40 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-[#6d4bd6] align-middle">Opcional · no incluida en el total</span>}
                </td>
                <td className="pt-2.5 px-2 text-right tabular-nums">
                  {dineroEn(Number(p.precio_unitario), m)}
                  {Number(p.descuento_pct) > 0 && <span className="block text-[10px] text-[#c81e1e]">−{porcentaje(Number(p.descuento_pct), 0)}</span>}
                </td>
                <td className={`pt-2.5 px-2 text-right tabular-nums ${p.opcional ? "text-slate-400" : "font-medium"}`}>{dineroEn(bruto(p), m)}</td>
                {hayDescuento && <td className={`pt-2.5 px-2 text-right tabular-nums ${p.opcional ? "text-slate-400" : "font-semibold text-[#c81e1e]"}`}>{dineroEn(conDescuento(p), m)}</td>}
              </tr>
              <tr>
                <td /><td />
                <td colSpan={hayDescuento ? 4 : 3} className="pb-3 pt-1.5 px-2">
                  <div className="flex gap-3">
                    {p.imagen_url && <img src={p.imagen_url} alt="" className="h-[1.05in] w-[1.05in] rounded object-cover border border-slate-200 shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                    {p.descripcion && <p className="whitespace-pre-line text-[11px] leading-[1.45] text-slate-600">{p.descripcion}</p>}
                  </div>
                </td>
              </tr>
            </tbody>
          ))}
        </table>

        {/* Totales y condiciones */}
        <section className="bloque mt-4 grid grid-cols-[1fr_2.9in] gap-6 items-start">
          <div className="space-y-2.5 text-[11.5px]">
            {c.condiciones_pago && <p><b className="text-slate-800">Pago:</b> {c.condiciones_pago}</p>}
            {c.tiempo_entrega && <p><b className="text-slate-800">Tiempo de entrega:</b> {c.tiempo_entrega}</p>}
            <p><b className="text-slate-800">Vigencia:</b> {c.vigencia_dias} días naturales a partir de su emisión (hasta el {fecha(vence)}).</p>
            {(c.notas?.length ?? 0) > 0 && (
              <div>
                <b className="text-slate-800">Notas:</b>
                <ul className="mt-0.5 list-disc pl-5 text-slate-700 space-y-0.5">{c.notas.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
            {fis?.terminos_url && <p className="text-[10.5px] text-slate-500">Términos y condiciones: {fis.terminos_url.replace(/^https?:\/\//, "")}</p>}
          </div>
          <div>
            <table className="w-full text-[12px]">
              <tbody>
                <tr><td className="py-1 text-slate-600">Subtotal</td><td className="py-1 text-right tabular-nums">{dineroEn(Number(c.subtotal), m)}</td></tr>
                {Number(c.descuento) > 0 && (
                  <tr className="text-[#c81e1e]"><td className="py-1">Descuento {porcentaje(descGeneral, descGeneral * 100 % 1 ? 1 : 0)}</td><td className="py-1 text-right tabular-nums">−{dineroEn(Number(c.descuento), m)}</td></tr>
                )}
                <tr><td className="py-1 text-slate-600">IVA {porcentaje(Number(c.tasa_iva), 0)}{c.precios_con_iva ? " (incluido)" : ""}</td><td className="py-1 text-right tabular-nums">{dineroEn(Number(c.iva), m)}</td></tr>
                <tr className="border-t-2 border-[#1b2230]">
                  <td className="pt-2 text-[13px] font-bold">{c.precios_con_iva ? "TOTAL NETO" : "TOTAL"}</td>
                  <td className="pt-2 text-right text-[17px] font-bold tabular-nums">{dineroEn(Number(c.total), m)}</td>
                </tr>
              </tbody>
            </table>
            {(hayDescuento && ahorro > 0.5) && (
              <p className="mt-2 text-right text-[11.5px] font-semibold text-[#c81e1e]">
                Ahorro de {dineroEn(ahorro, m)} {c.leyenda_promocion ?? "de descuento ya aplicado."}
              </p>
            )}
            {!hayDescuento && c.leyenda_promocion && <p className="mt-2 text-right text-[11.5px] font-semibold text-[#c81e1e]">{c.leyenda_promocion}</p>}
            {partidas.some((p) => p.opcional) && <p className="mt-2 text-right text-[10.5px] text-slate-500">Las partidas opcionales no están incluidas en el total.</p>}
          </div>
        </section>

        {/* Meses con tarjeta */}
        {plan && (
          <section className="bloque mt-5 rounded-lg border border-[#0a74ff]/30 bg-[#eef5ff] px-4 py-3 flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-[#0a74ff] shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-[12.5px]">¡Puedes diferir en hasta 24 meses el total o una parte con cualquier tarjeta de crédito!*</p>
              <p className="text-[10.5px] text-slate-600">
                *Solicítalo con anticipación. Opciones a {planes.data?.map((p) => p.meses).join(", ")} meses.
                {" "}El monto máximo a diferir por transacción es de {dineroEn(empresa.data?.mesesTope ?? 350000)} MXN.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-600">{plan.etiqueta}</p>
              <p className="text-[18px] font-bold text-[#0a74ff] tabular-nums">{dineroEn(mensualidad(Number(c.total), plan), m)}</p>
            </div>
          </section>
        )}

        <footer className="bloque mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <span>{fis?.razon_social ?? "Hegamex"} · Fabricantes de bandas transportadoras, dosificadoras, cribadoras, tolvas, silos y elevadores</span>
          <span className="tabular-nums">{c.folio}{iniciales ? ` · ${iniciales}` : ""}</span>
        </footer>
      </div>
    </div>
  );
}
