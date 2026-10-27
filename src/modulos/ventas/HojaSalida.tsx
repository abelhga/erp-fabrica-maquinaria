import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Boton } from "@/components/ui/boton";
import { fecha, fechaYHora, numero } from "@/lib/formato";
import { useEmpresa } from "./comun";
import { useHojaSalida } from "./componentes/EntregaPedido";

// «2 pieza» se ve mal en un papel que firma el cliente.
const plural = (u: string, n: number) => (n === 1 || /s$/.test(u) ? u : /[aeiou]$/i.test(u) ? `${u}s` : `${u}es`);

/**
 * La hoja que firma el cliente al recibir: qué se le entrega (con números de serie), sin
 * precios, y los renglones de firma. Va fuera del menú y en claro (es papel). La abre quien
 * ve el pedido, almacén incluido. Con ?salida= es la de esa entrega (con quién recibió); con
 * ?lineas= la de lo que va a salir en una entrega parcial; sin nada, lo que falta por entregar.
 */
export default function HojaSalidaPagina() {
  const { id } = useParams();
  const navegar = useNavigate();
  const hoja = useHojaSalida(id);
  const [params] = useSearchParams();
  const empresa = useEmpresa();
  const h = hoja.data;

  useEffect(() => {
    const html = document.documentElement;
    const oscuro = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (oscuro) html.classList.add("dark"); };
  }, []);
  useEffect(() => {
    if (!h) return;
    const antes = document.title;
    document.title = `Hoja de salida ${h.pedido.folio}${h.cliente ? " " + h.cliente.nombre : ""} - Hegamex`;
    return () => { document.title = antes; };
  }, [h]);

  if (hoja.isLoading) return <p className="p-10 text-center text-tenue">Preparando la hoja de salida…</p>;
  if (!h) return <p className="p-10 text-center text-tenue">No encontramos este pedido (o no lo puedes ver).</p>;

  const fis = empresa.data?.fiscal;
  // Qué entrega es: la que se pidió, o la última si ya está todo entregado (como antes).
  const pedidas = params.get("lineas")?.split(",").map((x) => x.split(":")).map(([lid, c]) => ({ id: lid, cantidad: Number(c) })).filter((x) => x.id && x.cantidad > 0);
  const faltaAlgo = h.partidas.some((p) => Number(p.cantidad) > Number(p.entregado ?? 0));
  const vigente = params.get("salida") ? h.salidas.find((s) => s.id === params.get("salida"))
    : !pedidas?.length && !faltaAlgo ? h.salidas.find((s) => !s.anulada_en) : undefined;
  // Cuánto va de cada partida: lo de esa entrega, lo que va a salir, o lo que falta (todo, si no ha salido nada).
  const cuanto = (p: (typeof h.partidas)[number]) => {
    if (vigente?.lineas) return Number(vigente.lineas.find((l) => l.id === p.id)?.cantidad ?? 0);
    if (pedidas?.length) return Number(pedidas.find((l) => l.id === p.id)?.cantidad ?? 0);
    if (vigente) return Number(p.cantidad);
    return Number(p.cantidad) - Number(p.entregado ?? 0);
  };
  const series = (p: (typeof h.partidas)[number]) => {
    const deEsta = vigente?.lineas?.find((l) => l.id === p.id)?.series;
    return deEsta?.length ? deEsta : p.series;
  };
  const renglones = [
    ...h.partidas.map((p) => ({ p, n: cuanto(p) })).filter((x) => x.n > 0)
      .map(({ p, n }) => ({ clave: p.id, cantidad: `${numero(n)} ${plural(p.unidad, n)}`, texto: p.titulo, detalle: p.descripcion, series: series(p) })),
    ...h.sueltas.map((s) => ({ clave: s.folio, cantidad: "1 pieza", texto: s.equipo, detalle: null, series: s.serie ? [s.serie] : [] })),
  ];

  return (
    <div className="min-h-full bg-borde/70 print:bg-superficie">
      <style>{`
        @page { size: letter; margin: 12mm; }
        @media print {
          html, body, #root { height: auto !important; background: white !important; }
          .hoja { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; min-height: 0 !important; }
          .bloque { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-imprimir sticky top-0 z-10 bg-superficie/90 backdrop-blur border-b border-borde">
        <div className="mx-auto max-w-[8.5in] px-4 py-2.5 flex items-center gap-3">
          <button type="button" onClick={() => (window.history.length > 1 ? navegar(-1) : window.close())} className="inline-flex items-center gap-1.5 text-sm text-tenue hover:text-texto">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <span className="text-sm text-tenue hidden sm:inline">Imprime dos: una se queda el cliente y la firmada regresa a la planta.</span>
          <Boton className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>

      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-superficie text-texto shadow-xl px-[0.55in] py-[0.5in] min-h-[11in] text-[12.5px] leading-snug">
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-marca">
          <div className="min-w-0">
            <Logo grande />
            {fis && (
              <div className="mt-3 text-[11px] text-tenue space-y-0.5">
                <p className="font-semibold text-texto">{fis.razon_social} · RFC: {fis.rfc}</p>
                <p>{fis.domicilio}</p>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[22px] font-bold tracking-[0.12em] text-marca">HOJA DE SALIDA</p>
            <p className="mt-1 text-[15px] font-semibold cifra">{h.pedido.folio}{vigente ? ` · ${vigente.numero}` : ""}</p>
            {h.pedido.folio_anterior && <p className="text-[11px] text-tenue">Antes {h.pedido.folio_anterior}</p>}
            <p className="text-[11px] text-tenue mt-1">Pedido del {fecha(h.pedido.fecha)}</p>
          </div>
        </header>

        <section className="bloque grid grid-cols-2 gap-6 py-4 border-b border-borde">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tenue">Cliente</p>
            <p className="text-[14px] font-semibold">{h.cliente?.nombre ?? "—"}</p>
            {h.cliente?.razon_social && h.cliente.razon_social !== h.cliente.nombre && <p>{h.cliente.razon_social}</p>}
            {h.cliente?.rfc && <p className="text-tenue">RFC: {h.cliente.rfc}</p>}
            {(h.cliente?.ciudad || h.cliente?.estado) && <p className="text-tenue">{[h.cliente.ciudad, h.cliente.estado].filter(Boolean).join(", ")}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tenue">Entrega</p>
            <p>{h.pedido.direccion_entrega || "Recoge en planta"}</p>
            {h.vendedor && <p className="text-tenue mt-1">Vendedor: {h.vendedor.nombre}{h.vendedor.telefono ? ` · ${h.vendedor.telefono}` : ""}</p>}
          </div>
        </section>

        <table className="w-full mt-4 border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-tenue border-b border-borde">
              <th className="py-2 pr-3 w-[16%]">Cantidad</th>
              <th className="py-2 pr-3">Descripción</th>
              <th className="py-2 w-[26%]">Número de serie</th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((r) => (
              <tr key={r.clave} className="bloque border-b border-borde align-top">
                <td className="py-2.5 pr-3 cifra">{r.cantidad}</td>
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{r.texto}</p>
                  {r.detalle && <p className="text-[11px] text-tenue whitespace-pre-line">{r.detalle}</p>}
                </td>
                <td className="py-2.5 cifra">{r.series.length ? r.series.join(", ") : <span className="text-tenue">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {h.como_venia && <p className="mt-2 text-[11px] text-tenue">Así venía en el pedido: {h.como_venia}</p>}

        <section className="bloque mt-6 rounded-lg border border-borde p-3 text-[11.5px]">
          <p>Recibo el equipo descrito arriba completo y en buen estado aparente. Las observaciones, si las hay, se anotan aquí:</p>
          <div className="mt-2 h-14 border-b border-dashed border-borde" />
        </section>

        <section className="bloque mt-10 grid grid-cols-2 gap-10 text-center text-[11.5px]">
          <div>
            <div className="h-16 border-b border-texto flex items-end justify-center pb-1 text-[13px]">{vigente?.entregado_por ?? ""}</div>
            <p className="mt-1 font-semibold">Entrega (Hegamex)</p>
            <p className="text-tenue">Nombre y firma</p>
          </div>
          <div>
            <div className="h-16 border-b border-texto flex items-end justify-center pb-1 text-[13px]">{vigente?.recibio ?? ""}</div>
            <p className="mt-1 font-semibold">Recibe (cliente)</p>
            <p className="text-tenue">Nombre, firma y fecha{vigente ? ` · ${fechaYHora(vigente.entregado_en)}` : ""}</p>
          </div>
        </section>
        <section className="bloque mt-8 grid grid-cols-2 gap-10 text-center text-[11.5px]">
          <div>
            <div className="h-10 border-b border-borde" />
            <p className="mt-1 text-tenue">Transportista o chofer</p>
          </div>
          <div>
            <div className="h-10 border-b border-borde" />
            <p className="mt-1 text-tenue">Placas del vehículo</p>
          </div>
        </section>
      </div>
    </div>
  );
}
