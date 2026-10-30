import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estados";
import { useMaquinas } from "./datos";
import { Etiqueta } from "./componentes/EtiquetaQR";

/**
 * Hoja de etiquetas con QR para pegar en las máquinas (carta, recortables). Sin «ids» salen todas
 * las que no están dadas de baja; con «ids», solo esas (la ficha imprime la suya).
 */
export default function Etiquetas() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const maquinas = useMaquinas();
  const lista = (maquinas.data ?? []).filter((m) => (ids.length ? ids.includes(m.id) : m.estado !== "baja"));

  return (
    <div className="min-h-full bg-borde/70 print:bg-white">
      <style>{`
        @page { size: letter; margin: 10mm; }
        @media print {
          html, body, #root { height: auto !important; background: white !important; }
          .hoja { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; min-height: 0 !important; }
          .etiqueta-qr { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-imprimir sticky top-0 z-10 bg-superficie/90 backdrop-blur border-b border-borde">
        <div className="mx-auto max-w-[8.5in] px-4 py-2.5 flex items-center gap-3">
          <button type="button" onClick={() => (window.history.length > 1 ? navegar(-1) : window.close())} className="inline-flex items-center gap-1.5 text-sm text-tenue hover:text-texto">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <span className="text-sm text-tenue">{lista.length} {lista.length === 1 ? "etiqueta" : "etiquetas"} · recórtalas por la línea punteada</span>
          <Boton className="ml-auto" onClick={() => window.print()} disabled={!lista.length}><Printer className="h-4 w-4" />Imprimir / PDF</Boton>
        </div>
      </div>
      <div className="hoja mx-auto my-6 w-[8.5in] max-w-full bg-white shadow-xl p-[0.4in] min-h-[11in]">
        {maquinas.isLoading ? <Cargando filas={6} /> : (
          <div className="grid grid-cols-2 gap-3">
            {lista.map((m) => <Etiqueta key={m.id} m={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}
