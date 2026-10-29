import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Boton } from "@/components/ui/boton";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";

/**
 * Lo que se le vendió al cliente, para el taller: cada partida con su descripción como se cotizó,
 * sin un solo precio (sale de v_pedidos_produccion, que no trae montos). La gerencia la copiaba
 * del pedido para imprimirla. Con ?op= solo la partida de esa orden (si la orden no tiene
 * partida, van todas). Va fuera del menú y en claro: es papel.
 */
interface OrdenDePartida { id: string; folio: string; serie: string | null }
interface Partida { linea_id: string; clave: string; titulo: string; cantidad: number; unidad: string; descripcion: string | null; ordenes: OrdenDePartida[] }
interface Pedido {
  id: string; folio: string; cliente: string | null; vendedor: string | null; fecha: string; fecha_compromiso: string | null;
  partidas: Partida[]; ordenes_sueltas: (OrdenDePartida & { equipo: string })[];
}

const plural = (u: string, n: number) => (n === 1 || /s$/.test(u) ? u : /[aeiou]$/i.test(u) ? `${u}s` : `${u}es`);
// La descripción viene como la escribió el vendedor, a veces entre comillas de la hoja.
const limpia = (t: string | null) => (t ?? "").replace(/^\s*"+|"+\s*$/g, "").trim();

export default function ImprimirPedido() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const op = params.get("op");
  const pedido = useQuery({
    queryKey: ["v_pedidos_produccion", "imprimir", id],
    queryFn: () => q<Pedido | null>(supabase.from("v_pedidos_produccion").select("id, folio, cliente, vendedor, fecha, fecha_compromiso, partidas, ordenes_sueltas").eq("id", id!).maybeSingle()),
    enabled: !!id,
  });
  const p = pedido.data;

  useEffect(() => {
    const html = document.documentElement;
    const oscuro = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (oscuro) html.classList.add("dark"); };
  }, []);
  useEffect(() => {
    if (!p) return;
    const antes = document.title;
    document.title = `Descripción ${p.folio}${p.cliente ? " " + p.cliente : ""} - Hegamex`;
    return () => { document.title = antes; };
  }, [p]);

  if (pedido.isLoading) return <p className="p-10 text-center text-tenue">Preparando la hoja…</p>;
  if (!p) return <p className="p-10 text-center text-tenue">No encontramos este pedido (o no lo puedes ver).</p>;

  // De una orden: su partida; si la orden vino de la hoja sin partida, todas las del pedido.
  const deLaOrden = op ? p.partidas.filter((x) => x.ordenes.some((o) => o.id === op)) : [];
  const partidas = deLaOrden.length ? deLaOrden : p.partidas;
  const ordenSuelta = op ? p.ordenes_sueltas.find((o) => o.id === op) : undefined;

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
          <span className="text-sm text-tenue hidden sm:inline">Sin precios: es para el taller.</span>
          <Boton className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>

      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-superficie text-texto shadow-xl px-[0.55in] py-[0.5in] min-h-[11in] text-[12.5px] leading-snug">
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-marca">
          <Logo grande />
          <div className="text-right shrink-0">
            <p className="text-[20px] font-bold tracking-[0.1em] text-marca">DESCRIPCIÓN PARA EL TALLER</p>
            <p className="mt-1 text-[15px] font-semibold cifra">{p.folio}{ordenSuelta ? ` · ${ordenSuelta.folio}` : ""}</p>
            <p className="text-[11px] text-tenue mt-1">Pedido del {fecha(p.fecha)}</p>
          </div>
        </header>

        <section className="bloque grid grid-cols-3 gap-6 py-4 border-b border-borde">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tenue">Cliente</p>
            <p className="text-[14px] font-semibold">{p.cliente ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tenue">Vendedor</p>
            <p>{p.vendedor ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tenue">Compromiso de entrega</p>
            <p className="text-[14px] font-semibold">{p.fecha_compromiso ? fecha(p.fecha_compromiso) : "Sin fecha"}</p>
          </div>
        </section>

        {partidas.length === 0 && <p className="py-6 text-tenue">El pedido no tiene partidas capturadas.</p>}
        <div className="divide-y divide-borde">
          {partidas.map((x) => (
            <section key={x.linea_id} className="bloque py-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[14px] font-semibold">{numero(x.cantidad)} {plural(x.unidad, Number(x.cantidad))} · {x.titulo}</p>
                {x.clave && <p className="text-[11px] text-tenue cifra shrink-0">{x.clave}</p>}
              </div>
              {limpia(x.descripcion)
                ? <p className="mt-2 whitespace-pre-line">{limpia(x.descripcion)}</p>
                : <p className="mt-2 text-tenue">Sin descripción en el pedido.</p>}
              {x.ordenes.length > 0 && (
                <p className="mt-2 text-[11px] text-tenue">
                  {x.ordenes.length === 1 ? "Orden" : "Órdenes"}: {x.ordenes.map((o) => o.folio + (o.serie ? ` (serie ${o.serie})` : "")).join(", ")}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Las órdenes que vinieron de la hoja de Luis no cuelgan de una partida: que no falten en el papel. */}
        {!deLaOrden.length && p.ordenes_sueltas.length > 0 && (
          <section className="bloque py-3 border-t border-borde text-[11.5px]">
            <p className="text-[10px] uppercase tracking-wide text-tenue">También en el taller (sin partida en el pedido)</p>
            <ul className="mt-1 space-y-0.5">
              {p.ordenes_sueltas.map((o) => <li key={o.id}><span className="cifra">{o.folio}</span> · {o.equipo}{o.serie ? ` · serie ${o.serie}` : ""}</li>)}
            </ul>
          </section>
        )}

        <section className="bloque mt-6 rounded-lg border border-borde p-3 text-[11.5px]">
          <p className="font-medium">Observaciones del taller</p>
          <div className="mt-2 h-20 border-b border-dashed border-borde" />
        </section>
      </div>
    </div>
  );
}
